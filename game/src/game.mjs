// src/game.mjs -- the gameplay screen: owns the field World, the canvases,
// input, the HUD and cards, and drives them from the fixed-step loop.
//
// The sim (src/sim/) is pure; this module is the browser glue around it.

import { getState, setState, onChange } from './state.mjs';
import { start as startLoop, STEP, getFps, setTimeScale, getTimeScale, resetErrors } from './loop.mjs';
import { World } from './sim/world.mjs';
import { LEVEL_COUNT, getLevel } from './sim/levels.mjs';
import { Autopilot, PROFILES } from './sim/solver.mjs';
import { createCanvases, resizeCanvases } from './render/canvas.mjs';
import { drawStatic } from './render/edge.mjs';
import { GrassRenderer } from './render/grass.mjs';
import { codePainter, makePngSource } from './render/atlas.mjs';
import { Motes } from './render/particles.mjs';
import { PointerInput } from './input/pointer.mjs';
import { Hud } from './ui/hud.mjs';
import { Cards } from './ui/cards.mjs';

const GAME_STATES = new Set(['playing', 'paused', 'level-won', 'ending', 'hint']);
const WIN_DELAY_S = 0.9;     // let the last motes land before the card

export class Game {
  constructor({ tuftSource } = {}) {
    const root = document.createElement('div');
    root.id = 'game';
    root.className = 'game-root';
    root.hidden = true;
    document.body.appendChild(root);
    this.root = root;
    this.cv = createCanvases(root);
    this.hud = new Hud(root, { onPause: () => this.pause() });
    this.cards = new Cards(root);
    this.input = new PointerInput(this.cv.live);
    this.input.attach();
    this.grass = new GrassRenderer(tuftSource || codePainter);
    this.motes = new Motes();
    this.world = null;
    this.layout = null;
    this.n = 0;
    this.pendingField = 1;
    this.pendingHeadStart = null;     // { field } -- at most one held
    this.startedWithHeadStart = false;
    this.lastInputT = 0;
    this.autopilot = null;
    this.solveResolve = null;
    this.winT = null;
    this.frameLog = [];
    this.dirty = true;          // redraw needed while not playing
    this.lastMoteBox = null;    // where motes were drawn last frame (CSS px)
    this.perfMode = false;
    this.renderMs = 0;
    this.sampleRender = [];

    onChange((next, prev) => this._onState(next, prev));
    window.addEventListener('resize', () => this.relayout());
    window.addEventListener('orientationchange', () => this.relayout());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.input.release();
        if (getState() === 'playing') this.pause();
      }
    });
    window.addEventListener('keydown', (e) => this._onKey(e));

    startLoop((dt) => this.update(dt), (fdt) => this.render(fdt), {
      onErrorBurst: () => this._showError(),
      // Performance mode: under 45 fps for 2 s, particles cap at 50.
      onLowFps: () => {
        if (!this.perfMode) {
          this.perfMode = true;
          this.motes.cap = 50;
          // Resampled tufts are the main raster cost on slow devices: draw
          // them unsmoothed (they're small, so it barely shows).
          this.grass.smooth = false;
        }
      },
    });
  }

  // ---- screens -----------------------------------------------------------

  _onState(next, prev) {
    this.root.hidden = !GAME_STATES.has(next);
    this.dirty = true;
    if (next === 'playing') {
      if (prev === 'title' || prev === 'challenge' || prev === 'map' || !this.world) {
        this.open(this.pendingField || 1);
      }
      if (this.cards.kind !== 'error') this.cards.close();
      this.hud.show(true);
    } else if (next === 'paused') {
      this.input.release();
      this.cards.showPause({
        fieldName: this.world ? `${this.n}. ${this.world.spec.name}` : '',
        onResume: () => this.resume(),
        onRestart: () => this.restart(),
        onTitle: () => setState('title'),
      });
    } else if (next === 'level-won') {
      this.input.release();
      const w = this.world;
      this.hud.announce(`Field ${this.n} complete`);
      this.cards.showComplete({
        n: this.n, name: w.spec.name, time: w.wonAt, par: w.spec.par, whole: w.wholeAtWin,
        headStartEarned: w.headStartEarned, headStartUsed: w.energy.headStart,
        last: this.n >= LEVEL_COUNT,
        onNext: () => this.next(),
      });
    } else if (next === 'ending') {
      this.cards.showDone({
        onTitle: () => setState('title'),
        onReplay: () => { this.open(1); setState('playing'); },
      });
    } else if (next === 'title') {
      this.input.release();
      this.cards.close();
      this.autopilot = null;
    }
  }

  _onKey(e) {
    const s = getState();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (s === 'playing') { e.preventDefault(); this.pause(); }
      else if (s === 'paused') { e.preventDefault(); this.resume(); }
    }
  }

  pause() {
    if (getState() === 'playing') setState('paused');
  }

  resume() {
    if (getState() === 'paused') setState('playing');
  }

  restart() {
    // A restart keeps a head start the field was started with.
    this.open(this.n || 1, { keepHeadStart: true });
    if (getState() !== 'playing') setState('playing');
    this.cards.close();
  }

  next() {
    if (this.n >= LEVEL_COUNT) {
      setState('ending');
      return;
    }
    this.open(this.n + 1);
    setState('playing');
  }

  // Load field n. Uses a pending head start for n (once), or keeps the one
  // this field was started with on a restart.
  open(n, { keepHeadStart = false } = {}) {
    let headStart = false;
    if (keepHeadStart && this.n === n && this.startedWithHeadStart) {
      headStart = true;
    } else if (this.pendingHeadStart && this.pendingHeadStart.field === n) {
      headStart = true;
      this.pendingHeadStart = null;
    }
    this.n = n;
    this.pendingField = n;
    this.startedWithHeadStart = headStart;
    const spec = getLevel(n);
    this.layout = resizeCanvases(this.cv, spec.w, spec.h);
    this.world = new World(n, this.layout, { headStart });
    this.input.release();
    this.input.drain();
    this.autopilot = null;
    this.winT = null;
    this.motes.clear();
    this.grass.prepare(this.world, this.layout, this.layout.dpr);
    drawStatic(this.cv.bgCtx, spec, this.layout);
    this.hud.setField(spec, n);
    this.hud.layout(this.layout);
    this.dirty = true;
    if (headStart) this.hud.showToast('Head start: +15%');
    this.root.dataset.field = String(n);
    return this.world;
  }

  relayout() {
    if (!this.world) return;
    const spec = this.world.spec;
    this.layout = resizeCanvases(this.cv, spec.w, spec.h);
    this.world.setLayout(this.layout);
    this.grass.prepare(this.world, this.layout, this.layout.dpr);
    drawStatic(this.cv.bgCtx, spec, this.layout);
    this.hud.layout(this.layout);
    this.dirty = true;
  }

  _showError() {
    this.input.release();
    this.cards.showError({
      onRestart: () => {
        resetErrors();
        this.cards.close();
        this.restart();
      },
    });
  }

  // ---- per step / per frame -----------------------------------------------

  _applyInput() {
    const events = this.input.drain();
    const w = this.world;
    if (!w || getState() !== 'playing' || this.cards.kind) return;
    const fx = this.layout.field.x, fy = this.layout.field.y;
    for (const ev of events) {
      if (ev.kind === 'down') {
        w.pointerDown(ev.x - fx, ev.y - fy, ev.type);
        this.lastInputT = ev.t;
      } else if (ev.kind === 'move') {
        if (!w.pointer) continue;
        const dt = Math.max(0.001, ev.t - this.lastInputT);
        this.lastInputT = ev.t;
        w.pointerMove(ev.x - fx, ev.y - fy, dt);
      } else if (ev.kind === 'up') {
        w.pointerUp();
      }
    }
  }

  // One fixed step of the sim.
  simStep(dt = STEP) {
    const w = this.world;
    if (!w) return;
    if (this.autopilot) this.autopilot.tick(dt);
    w.step(dt);
  }

  update(dt) {
    // Paused, on a card, or showing "Something went wrong": the sim waits.
    if (getState() !== 'playing' || this.cards.kind === 'error') { this.input.drain(); return; }
    this._applyInput();
    this.simStep(dt);
    const w = this.world;
    if (!w) return;
    if (w.won) {
      if (this.winT === null) {
        this.winT = 0;
        this.input.release();
        this.autopilot = null;
        if (w.headStartEarned) this.pendingHeadStart = { field: this.n + 1 };
        if (this.solveResolve) { const r = this.solveResolve; this.solveResolve = null; r(w.summary()); }
      }
      this.winT += dt;
      if (this.winT >= WIN_DELAY_S && getState() === 'playing') setState('level-won');
    }
  }

  _consumeFx() {
    const w = this.world;
    const fx = w.drainFx();
    if (!fx.length) return;
    const L = this.layout;
    const tgt = this.hud.moteTarget(w.energy.frac);
    for (const e of fx) {
      const kind = e[0], i = e[1];
      if (kind === 'flat') {
        const c = i % w.grid.W, r = (i / w.grid.W) | 0;
        const x = L.field.x + (c + 0.5) * L.cell, y = L.field.y + (r + 0.5) * L.cell;
        this.motes.spawn(x, y, tgt.x, tgt.y, e[2] > 1.3 ? 2 : 1);
      } else if (kind === 'stand') {
        this.grass.popCell(i);
      }
    }
  }

  render(frameDt) {
    const s = getState();
    this._logFrame(s + (this.cards.kind ? `>${this.cards.kind}` : ''));
    if (!this.world || !GAME_STATES.has(s)) return;
    // Nothing moves while paused or on a card: keep the last frame.
    if (s !== 'playing' && !this.dirty && !this.motes.list.length) return;
    this.dirty = false;
    const t0 = performance.now();
    const ctx = this.cv.liveCtx;
    const L = this.layout;
    const dpr = L.dpr;
    // Clear only what was drawn: the field (plus the tufts' upward spill)
    // and last frame's motes.
    const spill = this.grass.atlas ? this.grass.atlas.S : 0;
    let cx0 = L.field.x * dpr - spill, cy0 = L.field.y * dpr - spill;
    let cx1 = (L.field.x + L.field.w) * dpr + spill, cy1 = (L.field.y + L.field.h) * dpr + spill * 0.5;
    const mb = this.lastMoteBox;
    if (mb) {
      cx0 = Math.min(cx0, mb.x0 * dpr); cy0 = Math.min(cy0, mb.y0 * dpr);
      cx1 = Math.max(cx1, mb.x1 * dpr); cy1 = Math.max(cy1, mb.y1 * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(Math.floor(cx0) - 2, Math.floor(cy0) - 2, Math.ceil(cx1 - cx0) + 4, Math.ceil(cy1 - cy0) + 4);
    this._consumeFx();
    const whole = this.world.grid.wholeField();
    const shimmer = whole >= 0.9 && whole < 1 ? 0.5 + 0.5 * Math.sin(performance.now() / 260) : 0;
    this.grass.draw(ctx, this.world, L, dpr, s === 'playing' ? frameDt : 0, shimmer);
    if (s === 'playing') this.motes.update(frameDt);
    this.lastMoteBox = this.motes.draw(ctx, dpr);
    if (this.motes.arrived) { this.motes.arrived = 0; this.hud.pulse(); }
    this.hud.update(this.world.energy.frac, whole, this.world.grid.untouchedLeft(), frameDt);
    const ms = performance.now() - t0;
    this.sampleRender.push(ms);
    if (this.sampleRender.length > 120) this.sampleRender.shift();
  }

  _logFrame(name) {
    const log = this.frameLog;
    const last = log[log.length - 1];
    if (last && last[0] === name) last[1]++;
    else { log.push([name, 1]); if (log.length > 200) log.shift(); }
  }

  // ---- debug helpers (window.__game) ---------------------------------------

  solve(profile = 'average', { pointerType } = {}) {
    if (!this.world) return Promise.reject(new Error('No field loaded'));
    if (!PROFILES[profile]) return Promise.reject(new Error(`Unknown profile ${profile}`));
    const pt = pointerType || (matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
    this.input.release();
    this.world.pointerUp();
    this.autopilot = new Autopilot(this.world, profile, { pointerType: pt });
    return new Promise((resolve) => { this.solveResolve = resolve; });
  }

  stats() {
    const r = this.sampleRender.slice().sort((a, b) => a - b);
    const avg = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
    return {
      fps: +getFps().toFixed(1),
      renderMsAvg: +avg.toFixed(2),
      renderMsP95: r.length ? +r[Math.floor(r.length * 0.95)].toFixed(2) : 0,
      atlas: this.grass.atlas ? { S: this.grass.atlas.S, source: this.grass.atlas.source } : null,
      motes: this.motes.list.length,
      perfMode: this.perfMode,
    };
  }

  setTuftSource(kind) {
    const src = kind === 'png'
      ? makePngSource({ default: 'assets/tufts/default.png', stiff: 'assets/tufts/stiff.png' })
      : codePainter;
    return src.ready.then(() => {
      this.grass.setSource(src);
      if (this.world) this.grass.prepare(this.world, this.layout, this.layout.dpr);
      return src.name;
    });
  }

  get timeScale() { return getTimeScale(); }
  set timeScale(x) { setTimeScale(x); }
}
