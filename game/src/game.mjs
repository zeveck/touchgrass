// src/game.mjs -- the gameplay screen: owns the field World, the canvases,
// input, the HUD and cards, and drives them from the fixed-step loop.
//
// The sim (src/sim/) is pure; this module is the browser glue around it.

import { getState, setState, onChange } from './state.mjs';
import { start as startLoop, STEP, getFps, setTimeScale, getTimeScale, resetErrors } from './loop.mjs';
import { World } from './sim/world.mjs';
import { LEVEL_COUNT, getLevel, shapeBounds } from './sim/levels.mjs';
import { Autopilot, PROFILES } from './sim/solver.mjs';
import { createCanvases, resizeCanvases, currentDpr } from './render/canvas.mjs';
import { drawStatic } from './render/edge.mjs';
import { GrassRenderer } from './render/grass.mjs';
import { codePainter, makePngSource } from './render/atlas.mjs';
import { Motes } from './render/particles.mjs';
import { Bloom } from './render/bloom.mjs';
import { PointerInput } from './input/pointer.mjs';
import { Hud } from './ui/hud.mjs';
import { Cards } from './ui/cards.mjs';
import { audio } from './audio.mjs';
import { TUFT_URLS, FLOWER_URLS, SOIL_URL, sceneUrl, loadAll, imageNow } from './assets.mjs';
import { vibrate } from './haptics.mjs';
import { SPECIES, bugSizePx, warnLevel } from './sim/insects.mjs';
import { unlockedMoves, MOVE_KEYS, MOVE_NAMES, ARM_TIMEOUT_S } from './sim/moves.mjs';
import { BugRenderer, bugPortrait } from './render/bugs.mjs';
import { drawPreview, previewLabel, MoveFx } from './render/moves.mjs';
import { Toolbar } from './ui/toolbar.mjs';
import { PressWait } from './input/tap.mjs';
import { hintFor, hintsSeenList, checklistFor } from './hints.mjs';
import {
  befriend, hintsSeen, markHintSeen, recordResult, setHeadStart, takeHeadStart, readSave,
} from './storage.mjs';
import { scoreOf } from './sim/score.mjs';
import { reducedMotion as prefReduced, getSettings } from './prefs.mjs';
import { SWEEP_IDLE_S } from './sim/world.mjs';
import { go } from './nav.mjs';
import { FADE_MS } from './ui/screens.mjs';
import { ENDING_FADE_MS } from './ui/ending.mjs';
import { share } from './ui/share.mjs';
import { isModalOpen } from './ui/modal.mjs';

const HAND_URL = 'assets/ui/hand.png';
const MOVE_HOWTO = {
  ring: 'Ring: press the field, drag to aim, let go to fire',
  line: 'Line: drag along the field, let go to fire',
  clear: 'Full Clear: tap the field',
};

// Reduced motion: the Settings choice (Auto follows the system).
const reducedMotion = prefReduced;

// The bug report form is open: the game ignores its own keys and pointer.
export function reportOpen() {
  return typeof window !== 'undefined' && !!window.gameReport?.isOpen?.();
}

function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

// The states drawn by the field's layer (the others are DOM screens above it).
const GAME_STATES = new Set(['playing', 'paused', 'level-won', 'hint']);
const WIN_DELAY_S = 2.4;     // the bloom plays before the card

export class Game {
  // hints: false never shows hint cards; bugs: false opens fields empty
  // (dev / e2e of sweeping alone, `?hints=0`, `?bugs=0` on dev hosts).
  constructor({ tufts = 'png', hints = true, bugs = true } = {}) {
    this.hintsOn = hints;
    this.bugsOn = bugs;
    const root = document.createElement('div');
    root.id = 'game';
    root.className = 'game-root';
    root.hidden = true;
    document.body.appendChild(root);
    this.root = root;
    this.cv = createCanvases(root);
    this.hud = new Hud(root, { onPause: () => this.pause(), onMute: () => audio.toggleMute() });
    this.hud.setMuted(audio.muted);
    audio.onChange((st) => this.hud.setMuted(st.muted));
    this.hud.onMilestone = (m) => { if (m < 4) audio.milestone(m); };
    this.hud.onWhole = () => audio.wholeFieldTing();
    this.cards = new Cards(root);
    this.toolbar = new Toolbar(root, { onPress: (k) => this.pressMove(k) });
    this.bugsR = new BugRenderer();
    this.input = new PointerInput(this.cv.live);
    this.input.attach();
    this.input.hover = getSettings().hover;
    // Painted tufts by default; the code painter draws until they've loaded
    // (and stays, with ?tufts=code).
    this.grass = new GrassRenderer(codePainter);
    this.tuftsReady = tufts === 'png'
      ? this.setTuftSource('png') : Promise.resolve('code');
    this.motes = new Motes();
    this.art = {};
    this.artReady = Promise.resolve();
    this.world = null;
    this.layout = null;
    this.n = 0;
    this.pendingField = 1;
    this.startedWithHeadStart = false;   // the held head start lives in the save
    this.challenge = null;      // { f, s, n, guest } while playing a challenge link
    this.result = null;         // the last win: { score, best, isBest, prevBest }
    this.hoverOn = false;       // hover-sweep: a stroke with no button held
    this.hoverMoveT = 0;
    this.hideT = 0;
    this.lastInputT = 0;
    this.autopilot = null;
    this.solveResolve = null;
    this.winT = null;
    this.frameLog = [];
    this.dirty = true;          // redraw needed while not playing
    this.lastMoteBox = null;    // where motes were drawn last frame (CSS px)
    this.perfMode = false;
    this.liveScale = null;      // performance mode: the live canvas at 1x
    this.armed = null;          // 'ring' | 'line' | 'clear' while a move is armed
    this.armT = 0;              // seconds armed (paused while the pointer is down)
    this.press = null;          // the gesture in progress (see _down)
    this.fxList = [];           // move effects in play
    this.prices = {};           // each move's full charge (share of the line): the meter must hold it
    this.losses = {};           // each move's net cost, shown on its button (refreshed twice a second)
    this.clearPrice = null;     // Full Clear's exact price (refreshed twice a second)
    this.priceT = 0;
    this.pendingHint = null;
    this.hint = null;
    this.lastOverlayBox = null;
    this.ptype = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
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
          // The live canvas's pixels are the rest of it: draw the moving
          // layer at 1x (the painted static layer stays sharp). Measured on
          // field 15 at 390x844, 4x CPU throttle: ~35 fps -> ~55 fps.
          if (currentDpr() > 1.25) {
            this.liveScale = 1;
            this.relayout();
          }
        }
      },
    });
  }

  // Preload what the first fields need while the title shows (called once
  // the title is up, so it never holds up the title's own art).
  preload() {
    loadAll([SOIL_URL, ...FLOWER_URLS, 'assets/ui/flower-petal.png', sceneUrl('morning', true), sceneUrl('morning', false),
      HAND_URL, 'assets/ui/ring.png', 'assets/ui/line.png', 'assets/ui/clear.png']).catch(() => {});
  }

  // ---- screens -----------------------------------------------------------

  _onState(next, prev) {
    this.dirty = true;
    this._audioFor(next, prev);
    clearTimeout(this.hideT);
    if (GAME_STATES.has(next)) {
      this.root.hidden = false;
    } else {
      // A DOM screen fades in over the field: hide the field (and its card)
      // once it's covered, so nothing underneath flashes through.
      this.input.release();
      this._hoverEnd();
      this.autopilot = null;
      if (next === 'ending') this.cards.close();
      const ms = (reducedMotion() ? 0 : next === 'ending' ? ENDING_FADE_MS : FADE_MS) + 80;
      this.hideT = setTimeout(() => {
        if (GAME_STATES.has(getState())) return;
        this.root.hidden = true;
        if (this.cards.kind !== 'error') this.cards.close();
      }, ms);
      if (next === 'title' || next === 'map') this.challenge = null;
    }
    if (next !== 'playing') {
      this.disarm();
      audio.setBuzz(0);
      // Leaving play mid-stroke (pause, a hidden tab, a card) ends the stroke
      // now: the release queued by input.release() is drained, not applied,
      // while the field waits.
      if (this.press && this.press.kind === 'sweep' && this.world) this.world.pointerUp();
      this.press = null;
    }
    if (next === 'playing') {
      if (prev === 'title' || prev === 'challenge' || prev === 'map' || prev === 'ending' || !this.world) {
        this.open(this.pendingField || 1);
      }
      if (this.cards.kind !== 'error') this.cards.close();
      this.hud.show(true);
      this.toolbar.show(true);
      if (prev === 'paused') window.gameReport?.resumed();
    } else if (next === 'hint') {
      this.input.release();
      this.input.drain();
      const h = this.hint;
      if (h && h.checklist) this.cards.showChecklist(h.items, h.name, () => this.dismissHint(), this.ptype);
      else if (h) this.cards.showHint(h, () => this.dismissHint(), this.ptype);
    } else if (next === 'paused') {
      this.input.release();
      this._hoverEnd();
      // The report's picture is the field as it was, not the pause card.
      if (prev === 'playing') window.gameReport?.snapshot();
      this._showPauseCard();
    } else if (next === 'level-won') {
      this.input.release();
      const w = this.world;
      const r = this.result || { score: 0, best: 0, isBest: false, prevBest: null };
      this.hud.announce(`Field ${this.n} complete`);
      const guest = !!(this.challenge && this.challenge.guest);
      this.cards.showComplete({
        n: this.n, name: w.spec.name, time: w.wonAt, par: w.spec.par, whole: w.wholeAtWin,
        headStartEarned: w.headStartEarned, headStartUsed: w.energy.headStart,
        last: this.n >= LEVEL_COUNT,
        petted: w.petted, friends: w.bugs.list.filter((b) => !b.hostile).length,
        score: r.score, best: r.best, isBest: r.isBest, prevBest: r.prevBest,
        guest, challenge: this.challenge,
        onNext: () => this.next(),
        onMap: () => go('level-won', 'btn-complete-map'),
        onShare: () => share({ kind: 'field', n: this.n, score: r.score, friends: this._friendsForShare() }),
        onTryAgain: () => { this.open(this.n); go('level-won', 'btn-try-again'); },
      });
    } else if (next === 'title') {
      this.autopilot = null;
    }
  }

  // Up to three friends for the scorecard: petted on this field first, then
  // any met before.
  _friendsForShare() {
    const out = [];
    if (this.world) for (const b of this.world.bugs.list) if (!b.hostile && b.petted && !out.includes(b.sp)) out.push(b.sp);
    const g = readSave().garden || {};
    for (const sp of ['ladybug', 'butterfly', 'caterpillar', 'snail']) if (g[sp] && !out.includes(sp)) out.push(sp);
    return out.slice(0, 3);
  }

  _showPauseCard() {
    this.cards.showPause({
      fieldName: this.world ? `${this.n}. ${this.world.spec.name}` : '',
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onTitle: () => go('paused', 'btn-pause-title'),
      onHowTo: hintsSeenList(hintsSeen()).length ? () => this.showHowTo() : null,
      onSettings: () => go('paused', 'btn-pause-settings'),
      onMap: () => go('paused', 'btn-pause-map'),
      onReport: window.gameReport?.shown() ? () => window.gameReport?.open() : null,
    });
  }

  // Start field n from a menu (Play, a map patch, a challenge): the field
  // opens as the state changes to 'playing'.
  setPending(n, challenge = null) {
    this.pendingField = n;
    this.challenge = challenge;
  }

  // What the bug report and the debug hook read.
  reportState() {
    const w = this.world;
    return {
      screen: getState(),
      field: w ? this.n : null,
      meter: w ? +w.energy.frac.toFixed(3) : null,
      whole: w ? +w.grid.wholeField().toFixed(3) : null,
      time: w ? +w.time.toFixed(1) : null,
      card: this.cards.kind,
      armed: this.armed,
      guest: !!(this.challenge && this.challenge.guest),
      input: this.ptype,
    };
  }

  // The field as a PNG (both layers), for the bug report.
  grab() {
    const c = document.createElement('canvas');
    c.width = this.cv.bg.width;
    c.height = this.cv.bg.height;
    const x = c.getContext('2d');
    x.drawImage(this.cv.bg, 0, 0);
    // (The live layer may be at a lower scale in performance mode.)
    x.drawImage(this.cv.live, 0, 0, c.width, c.height);
    return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  }

  showHowTo() {
    this.cards.showHowTo(hintsSeenList(hintsSeen()), () => {
      if (getState() === 'paused') this._showPauseCard();
    }, this.ptype);
  }

  // The hint card was dismissed: saved as seen, and the field starts.
  dismissHint() {
    const h = this.hint;
    if (h && !h.checklist) markHintSeen(h.id);
    if (h && h.checklist && this.challenge) this.challenge.checked = true;
    this.hint = null;
    if (getState() === 'hint') go('hint', h && h.checklist ? 'btn-checklist-ok' : 'btn-hint-ok');
  }

  // Music, ambience and the rustle for a screen.
  _audioFor(s, prev) {
    // Settings over a paused field keeps the field's music, un-ducked so the
    // Music slider can be judged (back to pause ducks it again).
    if (s === 'settings' && prev === 'paused') { audio.duck(false); return; }
    if (s === 'level-won' && this.challenge && this.challenge.guest) {
      // The guest-challenge result plays the title theme.
      audio.setMusic('title');
      audio.setAmbience('meadow');
      audio.duck(false);
      audio.setRustle(false);
    } else if (s === 'playing' || s === 'paused' || s === 'level-won' || s === 'hint') {
      if (this.world) audio.setMusic(this.world.spec.time);
      audio.setAmbience('meadow');
      audio.duck(s === 'paused');
      audio.setRustle(s === 'playing');
    } else if (s === 'ending') {
      audio.setMusic('golden');
      audio.setAmbience('dusk');
      audio.duck(false);
      audio.setRustle(false);
    } else {
      audio.setMusic('title');
      audio.setAmbience(null);
      audio.duck(false);
      audio.setRustle(false);
    }
  }

  _onKey(e) {
    // The report form, a modal card, or typing in a text box: not the game's keys.
    if (reportOpen() || isModalOpen()) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    const s = getState();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
      e.preventDefault();
      audio.toggleMute();
      return;
    }
    if (s === 'hint') {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.cards.dismissHint) this.cards.dismissHint();
      }
      return;
    }
    if (s === 'playing' && MOVE_KEYS[e.key] && !e.repeat) {
      e.preventDefault();
      this.pressMove(MOVE_KEYS[e.key]);
      return;
    }
    // Esc cancels an armed move first; only when nothing is armed does it pause.
    if (e.key === 'Escape' && s === 'playing' && this.armed) {
      e.preventDefault();
      this.disarm();
      audio.play('click', { rate: 0.85 });
      return;
    }
    // Esc on How to play goes back to the pause card (like its Back button).
    if (e.key === 'Escape' && s === 'paused' && this.cards.kind === 'howto') {
      e.preventDefault();
      this._showPauseCard();
      return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (s === 'playing') { e.preventDefault(); this.pause(); }
      else if (s === 'paused' && this.cards.kind === 'pause') { e.preventDefault(); this.resume(); }
    }
  }

  pause() {
    if (getState() === 'playing') go('playing', 'btn-pause');
  }

  resume() {
    if (getState() === 'paused') go('paused', 'btn-resume');
  }

  restart() {
    // A restart keeps a head start the field was started with.
    this.open(this.n || 1, { keepHeadStart: true });
    if (getState() === 'paused') go('paused', 'btn-restart');
    else if (getState() !== 'playing') setState('playing');
    this.cards.close();
  }

  next() {
    if (this.n >= LEVEL_COUNT) {
      go('level-won', 'btn-next-field', 'ending');
      return;
    }
    this.challenge = null;
    this.open(this.n + 1);
    go('level-won', 'btn-next-field', 'playing');
  }

  get guest() { return !!(this.challenge && this.challenge.guest); }

  // Load field n. Uses the held head start for n (once), or keeps the one
  // this field was started with on a restart. A guest challenge never uses
  // or earns one.
  open(n, { keepHeadStart = false } = {}) {
    let headStart = false;
    if (this.challenge && this.challenge.f !== n) this.challenge = null;
    if (this.guest) {
      headStart = false;
    } else if (keepHeadStart && this.n === n && this.startedWithHeadStart) {
      headStart = true;
    } else if (takeHeadStart(n)) {
      headStart = true;
    }
    this.n = n;
    this.pendingField = n;
    this.startedWithHeadStart = headStart;
    const spec = getLevel(n);
    this.layout = resizeCanvases(this.cv, spec.w, spec.h, shapeBounds(spec), this.liveScale);
    // Each frame clears only what it drew: wipe the last field's leftovers
    // (its edges, or petals) once, or they'd stay round a smaller field.
    this._wipeLive();
    this.world = new World(n, this.layout, { headStart, bugs: this.bugsOn });
    this.input.release();
    this.input.drain();
    this.press = null;
    this.hoverOn = false;
    this.result = null;
    this.disarm();
    this.fxList = [];
    this.bugsR.clear();
    audio.setBuzz(0);
    this.toolbar.setMoves(unlockedMoves(n));
    this._typicalPrices();
    // A hint card for what's new here, shown before the first stroke.
    this.hint = null;
    // A guest challenge shows its checklist instead (hints aren't marked seen).
    if (this.guest) {
      // Once per challenge: Try again goes straight in.
      this.pendingHint = this.hintsOn && !this.challenge.checked
        ? { checklist: true, id: 'checklist', items: checklistFor(n), name: spec.name } : null;
    } else {
      this.pendingHint = this.hintsOn ? hintFor(n, hintsSeen()) : null;
    }
    this.autopilot = null;
    this.winT = null;
    this.bloom = null;
    this.lastTouch = null;
    this.motes.clear();
    this.grass.prepare(this.world, this.layout, this.layout.dpr);
    this._loadArt();
    this.hud.setField(spec, n);
    this.hud.layout(this.layout);
    this.toolbar.layout(this.layout);
    this.dirty = true;
    // Shown once the field is really playing (after any hint card), so a card
    // never hides it.
    this.pendingToast = headStart ? 'Head start: +15%' : null;
    this.hud.hideToast();
    this.root.dataset.field = String(n);
    if (getState() === 'playing') audio.setMusic(spec.time);
    return this.world;
  }

  _wipeLive() {
    const c = this.cv.liveCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.live.width, this.cv.live.height);
    this.lastMoteBox = null;
    this.lastOverlayBox = null;
  }

  relayout() {
    if (!this.world) return;
    const spec = this.world.spec;
    this.layout = resizeCanvases(this.cv, spec.w, spec.h, shapeBounds(spec), this.liveScale);
    this._wipeLive();
    this.world.setLayout(this.layout);
    this.grass.prepare(this.world, this.layout, this.layout.dpr);
    this._loadArt();
    this.hud.layout(this.layout);
    this.toolbar.layout(this.layout);
    this._typicalPrices();
    this.dirty = true;
  }

  // ---- moves ------------------------------------------------------------------

  // The toolbar's prices. The full charge (what the meter must hold to fire):
  // the Ring's and Line's for an average spot (fixed per field and layout),
  // Full Clear's exact one. The net cost shown on each button (what the meter
  // really loses) comes from the grass as it stands, so it's worked out when
  // a field loads and twice a second after (_livePrices).
  _typicalPrices() {
    const w = this.world;
    if (!w) return;
    this.prices = {};
    for (const k of unlockedMoves(this.n)) {
      if (k !== 'clear') this.prices[k] = w.typicalPrice(k, this.ptype);
    }
    this._livePrices();
  }

  _livePrices() {
    const w = this.world;
    this.priceT = 0;
    if (!w) return;
    this.losses = {};
    this.clearPrice = null;
    for (const k of unlockedMoves(this.n)) {
      if (k === 'clear') {
        this.clearPrice = w.movePrice('clear', {}, this.ptype);
        this.prices.clear = this.clearPrice.frac;
        this.losses.clear = this.clearPrice.lossFrac;
      } else this.losses[k] = w.typicalLoss(k, this.ptype);
    }
    // Written at once, so a hint card over a new field never shows the last
    // field's prices.
    this.toolbar.update(this.prices, this.losses, w.energy.frac, this.armed);
  }

  // A toolbar button or key 1 / 2 / 3: arm the move, or cancel it if armed.
  pressMove(k) {
    if (getState() !== 'playing' || !this.world || this.world.won) return;
    if (!unlockedMoves(this.n).includes(k)) return;
    if (this.armed === k) {
      this.disarm();
      audio.play('click', { rate: 0.85 });
      return;
    }
    if (this.toolbar.isDisabled(k)) {
      audio.lowClick();
      this.hud.showToast(`${MOVE_NAMES[k]} needs ${Math.max(1, Math.round((this.prices[k] || 0) * 100))}% on the meter`, 1800);
      return;
    }
    // Arming never drains the meter: it's paid when it fires.
    if (this.press && this.press.kind !== 'sweep' && this.press.kind !== 'wait') this.press = null;
    this.armed = k;
    this.armT = 0;
    audio.play('click');
    // (Full Clear's preview says what to do itself.)
    if (k !== 'clear') this.hud.showToast(MOVE_HOWTO[k], 2400);
    else this.hud.hideToast();
    this.hud.announce(`${MOVE_NAMES[k]} armed`);
  }

  // Cancel an armed move. Nothing was paid, so there's nothing to refund.
  disarm() {
    if (!this.armed) return;
    this.armed = null;
    this.hud.hideToast();
    this.armT = 0;
    if (this.press && (this.press.kind === 'ring' || this.press.kind === 'line' || this.press.kind === 'clear')) {
      this.press = { kind: 'dead' };    // the rest of this press does nothing
    }
  }

  _fire(kind, arg, type) {
    const w = this.world;
    const g = w.grid;
    const before = { h: g.h.slice(), gold: g.gold.slice(), loosened: g.loosened.slice() };
    const res = w.fireMove(kind, arg, type);
    if (!res.fired) {
      // Can't afford it here (or the drag never touched the field): nothing
      // is charged, a soft low click, and the move stays armed.
      audio.lowClick();
      if (res.reason === 'afford') this.hud.showToast('Not enough energy for that spot', 1800);
      else if (res.reason === 'empty') this.hud.showToast('Drag across the field', 1600);
      this.armT = 0;
      return;
    }
    this.fxList.push(new MoveFx(kind, res.price.area, before, this.layout, w));
    this.hud.hideToast();
    audio.play(kind === 'ring' ? 'whoomp' : kind === 'line' ? 'swish' : 'gust');
    vibrate(12);
    this.armed = null;
    this.armT = 0;
    this._livePrices();
  }

  // Field-relative cells for a page point.
  _cells(ev) {
    const L = this.layout;
    return [(ev.x - L.field.x) / L.cell, (ev.y - L.field.y) / L.cell];
  }

  // The static layer's pictures for this field and orientation: draw now with
  // whatever is loaded, and again once everything has arrived.
  _loadArt() {
    const spec = this.world.spec;
    const urls = [sceneUrl(spec.time, this.layout.portrait), SOIL_URL, ...FLOWER_URLS];
    const pick = () => ({ scene: imageNow(urls[0]), soil: imageNow(urls[1]), flowers: FLOWER_URLS.map(imageNow) });
    this.art = pick();
    drawStatic(this.cv.bgCtx, spec, this.layout, this.art);
    const world = this.world, layout = this.layout;
    this.artReady = loadAll(urls).then(() => {
      if (this.world !== world || this.layout !== layout) return;
      this.art = pick();
      drawStatic(this.cv.bgCtx, spec, this.layout, this.art);
    }).catch((e) => console.warn('art:', e.message));
    // Warm up the next time of day's scene in the background.
    const next = this.n < LEVEL_COUNT ? getLevel(this.n + 1).time : null;
    if (next && next !== spec.time) loadAll([sceneUrl(next, this.layout.portrait)]).catch(() => {});
  }

  whenReady() {
    return Promise.all([this.tuftsReady, this.artReady]).then(() => true);
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
    for (const ev of events) {
      if (ev.kind === 'down') this._down(ev);
      else if (ev.kind === 'move') this._move(ev);
      else if (ev.kind === 'up') this._up(ev);
      else if (ev.kind === 'hover') this._hover(ev);
      else if (ev.kind === 'hoverend') this._hoverEnd();
    }
  }

  // Hover-sweep (Settings, desktop): the pointer sweeps whenever it moves
  // over the field with no button held. Clicks still pet bugs and fire moves
  // (a press ends the hover stroke). Resting the pointer for 0.4 s lifts it,
  // so stiff grass gets its second stroke.
  _hover(ev) {
    const w = this.world, L = this.layout;
    if (this.press || this.armed || w.won) return;
    this.lastTouch = { x: ev.x, y: ev.y };
    // Over a friend the sweep pauses (it would nudge the friend away), so a
    // click can pet it.
    if (w.friendAt(ev.x - L.field.x, ev.y - L.field.y)) { this._hoverEnd(); return; }
    if (!this.hoverOn) {
      w.pointerDown(ev.x - L.field.x, ev.y - L.field.y, 'mouse');
      this.hoverOn = true;
      this.lastInputT = ev.t;
      if (this.n === 1) markHintSeen('sweep');
    } else {
      const dt = Math.max(0.001, ev.t - this.lastInputT);
      this.lastInputT = ev.t;
      w.pointerMove(ev.x - L.field.x, ev.y - L.field.y, dt);
    }
    this.hoverMoveT = ev.t;
  }

  _hoverEnd() {
    if (!this.hoverOn) return;
    this.hoverOn = false;
    if (this.world && !this.press) this.world.pointerUp();
  }

  setHover(on) {
    this.input.hover = !!on;
    if (!on) this._hoverEnd();
  }

  // A press. On a friendly bug's pet area it waits to see if it's a tap (a
  // pet) or a drag (a sweep, or the armed move, from the press point).
  // Anywhere else it sweeps (or starts the armed move) at once.
  _down(ev) {
    const L = this.layout;
    this._hoverEnd();
    const pt = ev.type === 'touch' ? 'touch' : 'mouse';
    if (pt !== this.ptype) { this.ptype = pt; this._typicalPrices(); }   // brush (and so prices) differ by pointer
    this.lastTouch = { x: ev.x, y: ev.y };
    const bug = this.world.friendAt(ev.x - L.field.x, ev.y - L.field.y);
    if (bug) {
      this.press = { kind: 'wait', wait: new PressWait(bug, ev.x, ev.y, ev.t), down: ev };
      return;
    }
    this._begin(ev);
  }

  _begin(ev) {
    const w = this.world, L = this.layout;
    this.lastInputT = ev.t;
    if (this.armed === 'ring') {
      const [x, y] = this._cells(ev);
      this.press = { kind: 'ring', type: ev.type, x, y };
    } else if (this.armed === 'line') {
      this.press = { kind: 'line', type: ev.type, path: [this._cells(ev)] };
    } else if (this.armed === 'clear') {
      this.press = { kind: 'clear', type: ev.type, at: this._cells(ev) };
    } else {
      w.pointerDown(ev.x - L.field.x, ev.y - L.field.y, ev.type);
      this.press = { kind: 'sweep' };
      vibrate(8);
      if (this.n === 1) markHintSeen('sweep');
    }
  }

  _move(ev) {
    const p = this.press;
    if (!p) return;
    const w = this.world, L = this.layout;
    this.lastTouch = { x: ev.x, y: ev.y };
    if (p.kind === 'wait') {
      if (p.wait.move(ev) === 'drag') this._resolveWait();
      return;
    }
    if (p.kind === 'sweep') {
      if (!w.pointer) return;
      const dt = Math.max(0.001, ev.t - this.lastInputT);
      this.lastInputT = ev.t;
      w.pointerMove(ev.x - L.field.x, ev.y - L.field.y, dt);
    } else if (p.kind === 'ring') {
      [p.x, p.y] = this._cells(ev);
    } else if (p.kind === 'line') {
      const q = this._cells(ev);
      const last = p.path[p.path.length - 1];
      if (Math.hypot(q[0] - last[0], q[1] - last[1]) >= 0.25) p.path.push(q);
      else p.end = q;
    }
  }

  // A wait on a bug turned out to be a drag: start it from the press point
  // and replay the moves held back.
  _resolveWait() {
    const p = this.press;
    this._begin(p.down);
    for (const m of p.wait.buffered) this._move(m);
  }

  _up(ev) {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.kind === 'wait') {
      if (ev.cancel) return;
      if (p.wait.up(ev.t) === 'tap') {
        // A pet (also while a move is armed: the move stays armed).
        this.world.pet(p.wait.bug);
        return;
      }
      this.press = p;
      this._resolveWait();
      const q = this.press;
      this.press = null;
      this._finish(q, ev);
      return;
    }
    this._finish(p, ev);
  }

  _finish(p, ev) {
    const w = this.world;
    if (p.kind === 'sweep') { w.pointerUp(); return; }
    if (p.kind === 'dead') return;
    if (ev.cancel) {
      // pointercancel, lost capture or blur: an armed move is cancelled,
      // nothing paid.
      this.disarm();
      return;
    }
    if (p.kind === 'ring') this._fire('ring', { x: p.x, y: p.y }, p.type);
    else if (p.kind === 'line') {
      const path = p.end ? [...p.path, p.end] : p.path;
      this._fire('line', { path }, p.type);
    } else if (p.kind === 'clear') {
      const [x, y] = p.at;
      const g = w.grid;
      const on = x >= 0 && y >= 0 && x < g.W && y < g.H && g.valid[Math.floor(y) * g.W + Math.floor(x)];
      if (on) this._fire('clear', {}, p.type);
      else this.hud.showToast('Tap the field', 1400);
    }
  }

  // Held on a bug past 350 ms without moving: a sweep from the press point.
  _tickPress() {
    const p = this.press;
    if (p && p.kind === 'wait' && p.wait.expired(performance.now() / 1000)) this._resolveWait();
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
    if (this.pendingHint && this.world) {
      // What's new here: a hint card, before the first stroke, field paused.
      const h = this.pendingHint;
      this.pendingHint = null;
      if (this.world.firstStrokeAt === null && !this.autopilot) {
        this.hint = h;
        this.input.release();
        this.input.drain();
        this.press = null;
        setState('hint');
        return;
      }
    }
    if (this.pendingToast) {
      this.hud.showToast(this.pendingToast);
      this.pendingToast = null;
    }
    this._applyInput();
    this._tickPress();
    if (this.hoverOn && performance.now() / 1000 - this.hoverMoveT > SWEEP_IDLE_S) this._hoverEnd();
    if (this.armed && !this.input.down) {
      // The 5 s auto-cancel is paused while the pointer is down.
      this.armT += dt;
      if (this.armT >= ARM_TIMEOUT_S) {
        this.disarm();
        audio.play('click', { rate: 0.85 });
      }
    }
    this.simStep(dt);
    const w = this.world;
    if (!w) return;
    this.priceT += dt;
    if (this.priceT >= 0.5) this._livePrices();
    if (w.won) {
      if (this.winT === null) {
        this.winT = 0;
        this.input.release();
        this.press = null;
        this.disarm();
        audio.setBuzz(0);
        this.hud.setWarn(null);
        this.autopilot = null;
        this._hoverEnd();
        this._recordWin(w);
        audio.bloomArpeggio();
        const L = this.layout;
        const origin = this.lastTouch || { x: L.field.x + L.field.w / 2, y: L.field.y + L.field.h / 2 };
        this.bloom = new Bloom(w, L, origin, {
          flowers: FLOWER_URLS.map(imageNow),
          petal: imageNow('assets/ui/flower-petal.png'),
          reduced: reducedMotion(),
        });
        audio.updateRustle(false, 0, 0);
        if (this.solveResolve) { const r = this.solveResolve; this.solveResolve = null; r(w.summary()); }
      }
      this.winT += dt;
      if (this.winT >= WIN_DELAY_S && getState() === 'playing') setState('level-won');
    }
  }

  // The win is scored and saved at once (a guest result isn't: no unlock, no
  // best, no head start). Friends petted were saved as they were petted.
  _recordWin(w) {
    const score = scoreOf({ n: this.n, time: w.wonAt, par: w.spec.par, whole: w.wholeAtWin, petted: w.petted });
    if (this.guest) {
      this.result = { score, best: null, isBest: false, prevBest: null };
      return;
    }
    const r = recordResult(this.n, { score, cleared: w.wholeAtWin >= 1 });
    this.result = { score, best: r.best, isBest: r.isBest, prevBest: r.prevBest };
    // At most one head start is held: a new one replaces it.
    if (w.headStartEarned) setHeadStart(this.n + 1);
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
      } else if (kind === 'loosen') {
        audio.twang();
        if (performance.now() - (this.lastLoosenBuzz || 0) > 120) { this.lastLoosenBuzz = performance.now(); vibrate(10); }
      } else if (kind === 'bug') {
        this._bugEvent(e[1], e[2], e[3]);
      }
    }
  }

  _bugEvent(kind, b, extra) {
    const L = this.layout;
    const x = L.field.x + (b.x + b.slideX) * L.cell, y = L.field.y + (b.y + b.slideY) * L.cell;
    const size = bugSizePx(L.cell, b.sp);
    const target = kind === 'bite' ? this.hud.moteTarget(this.world.energy.frac) : null;
    this.bugsR.onEvent(kind, b, extra, x, y, size, reducedMotion(), target);
    const sp = SPECIES[b.sp];
    if (kind === 'pet') {
      audio.chirp(sp.chirp || 1);
      vibrate(25);
      if (extra) {
        // First pet of this bug on this field: saved to the Bug Garden.
        const { isNew } = befriend(b.sp, this.n);
        if (isNew) {
          this.hud.showRibbon(sp.name, bugPortrait(b.sp));
          audio.newFriendJingle();
          this.hud.announce(`New friend: ${sp.name}`);
        }
      }
    } else if (kind === 'angry') {
      vibrate(20);
      this.hud.announce(`A grumpy ${sp.name.toLowerCase()}: move away`);
    } else if (kind === 'bite') {
      audio.play('bonk');
      vibrate(15);
      // The meter flashes red (a colour change, so it stays with reduced
      // motion); the shake doesn't.
      this.hud.bitten();
      if (!reducedMotion()) this.hud.shake();
    }
  }

  // The angry buzz, and the meter's red edge on the side nearest the bug.
  _warnings() {
    const w = this.world;
    let worst = null;
    for (const b of w.bugs.list) if (b.state === 'angry' && (!worst || warnLevel(b) > warnLevel(worst))) worst = b;
    if (!worst || getState() !== 'playing') {
      audio.setBuzz(0);
      this.hud.setWarn(null);
      return;
    }
    audio.setBuzz(0.05 + 0.95 * warnLevel(worst));
    const L = this.layout;
    const bx = L.field.x + worst.x * L.cell;
    const mb = this.hud.meterEl.getBoundingClientRect();
    this.hud.setWarn(L.portrait ? (bx < mb.left + mb.width / 2 ? 'left' : 'right') : 'right');
  }

  // Field 1: a ghost hand glides along a stroke until the first stroke.
  _drawHand(ctx, dpr) {
    const w = this.world;
    if (this.n !== 1 || w.firstStrokeAt !== null) return null;
    const img = imageNow(HAND_URL);
    if (!img) return null;
    const L = this.layout;
    const T = 2.8;
    const u = ((performance.now() / 1000) % T) / T;
    // Fade in, glide, fade out, rest.
    let a, k;
    if (u < 0.12) { a = u / 0.12; k = 0; } else if (u < 0.72) { a = 1; k = (u - 0.12) / 0.6; } else if (u < 0.85) { a = 1 - (u - 0.72) / 0.13; k = 1; } else { a = 0; k = 1; }
    const e = k * k * (3 - 2 * k);
    const fx = L.field.x, fy = L.field.y, fw = L.field.w, fh = L.field.h;
    const px = (t) => fx + fw * (0.2 + 0.6 * t);
    const py = (t) => fy + fh * (0.58 - 0.16 * t + 0.1 * Math.sin(t * Math.PI));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A faint gold trail behind the fingertip.
    if (a > 0 && e > 0.02) {
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(10, this.world.brushRadiusPx(this.ptype) * 1.2);
      ctx.strokeStyle = `rgba(255, 228, 140, ${0.35 * a})`;
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      for (let j = 1; j <= 20; j++) { const t = (j / 20) * e; ctx.lineTo(px(t), py(t)); }
      ctx.stroke();
    }
    const H = Math.max(64, Math.min(120, fw * 0.24));
    const sc = H / 192;
    const x = px(e), y = py(e);
    ctx.globalAlpha = 0.85 * a;
    // The fingertip (80, 14 in the art) sits on the path.
    ctx.drawImage(img, x - 80 * sc, y - 14 * sc, 192 * sc, 192 * sc);
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { x0: fx, y0: fy - 10, x1: fx + fw, y1: fy + fh + H };
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
    const mb = union(this.lastMoteBox, this.lastOverlayBox);
    const bb = this.bloom ? this.bloom.box() : null;
    if (bb) {
      cx0 = Math.min(cx0, bb.x0 * dpr); cy0 = Math.min(cy0, bb.y0 * dpr);
      cx1 = Math.max(cx1, bb.x1 * dpr); cy1 = Math.max(cy1, bb.y1 * dpr);
    }
    if (mb) {
      cx0 = Math.min(cx0, mb.x0 * dpr); cy0 = Math.min(cy0, mb.y0 * dpr);
      cx1 = Math.max(cx1, mb.x1 * dpr); cy1 = Math.max(cy1, mb.y1 * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(Math.floor(cx0) - 2, Math.floor(cy0) - 2, Math.ceil(cx1 - cx0) + 4, Math.ceil(cy1 - cy0) + 4);
    this._consumeFx();
    const whole = this.world.grid.wholeField();
    const shimmer = whole >= 0.9 && whole < 1 ? 0.5 + 0.5 * Math.sin(performance.now() / 260) : 0;
    const playing = s === 'playing';
    const reduced = reducedMotion();
    // Move effects roll; a wave not there yet leaves the grass as it was.
    if (playing) for (const f of this.fxList) f.update(frameDt);
    this.fxList = this.fxList.filter((f) => !f.done());
    const reveal = this.fxList.find((f) => f.kind !== 'line') || null;
    this.grass.draw(ctx, this.world, L, dpr, playing ? frameDt : 0, shimmer, this.bloom, reveal);
    if (this.bloom) {
      if (playing) this.bloom.update(frameDt);
      this.bloom.draw(ctx, dpr);
    }
    let over = null;
    for (const f of this.fxList) over = union(over, f.draw(ctx, dpr, reduced));
    if (this.armed && playing) {
      const w = this.world;
      const p = this.press;
      const tNow = performance.now() / 1000;
      let price = null, extra = null;
      if (this.armed === 'clear') price = w.movePrice('clear', {}, this.ptype);   // exact, every frame
      else if (this.armed === 'ring' && p && p.kind === 'ring') price = w.movePrice('ring', { x: p.x, y: p.y }, p.type);
      else if (this.armed === 'line' && p && p.kind === 'line') {
        const path = p.end ? [...p.path, p.end] : p.path;
        price = w.movePrice('line', { path }, p.type);
        extra = { path, hw: 1.5 * w.brushCells(p.type) };
      }
      this.preview = { kind: this.armed, label: previewLabel(this.armed, price), lossFrac: price ? price.lossFrac : null };
      over = union(over, drawPreview(ctx, w, L, dpr, tNow, this.armed, price, extra, reduced));
    }
    over = union(over, this.bugsR.draw(ctx, this.world, L, dpr, frameDt, { reduced, paused: !playing }));
    if (playing) over = union(over, this._drawHand(ctx, dpr));
    this.lastOverlayBox = over;
    if (playing) {
      this._warnings();
      this.toolbar.update(this.prices, this.losses, this.world.energy.frac, this.armed);
      this.motes.update(frameDt);
      const p = this.world.pointer;
      audio.updateRustle(!!p && p.idle < 0.1, p ? p.speed : 0, this.world.brushH);
    }
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
    if (getState() === 'hint') this.dismissHint();
    this.pendingHint = null;
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
      liveScale: this.liveScale,
    };
  }

  setTuftSource(kind) {
    const src = kind === 'png' ? makePngSource(TUFT_URLS) : codePainter;
    return src.ready.then(() => {
      this.grass.setSource(src);
      if (this.world) this.grass.prepare(this.world, this.layout, this.layout.dpr);
      this.dirty = true;
      return src.name;
    });
  }

  get timeScale() { return getTimeScale(); }
  set timeScale(x) { setTimeScale(x); }
}
