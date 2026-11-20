// sim/world.mjs -- one field in play, stepped by a fixed dt. Pure: no DOM, no
// wall clock. The browser and the headless solver drive it the same way:
//
//   const w = new World(n, layout, { headStart });
//   w.pointerDown(x, y, 'mouse');      // field-relative CSS px
//   w.pointerMove(x, y, dtSinceLastSample);
//   w.pointerUp();
//   w.step(1 / 60);
//
// Pointer calls stamp brush capsules immediately; step() advances regrowth,
// bends and the win check.

import { buildField, getLevel, LEVEL_COUNT } from './levels.mjs';
import { fieldSeed } from './rng.mjs';
import { Grid, speedFactor, SWEEP_FLAT, SWEEP_LOOSEN } from './grid.mjs';
import { brushRadiusPx, stampCapsuleWake } from './brush.mjs';
import { Energy, meterLine, earnsHeadStart } from './energy.mjs';

export const STEP = 1 / 60;
export const SWEEP_IDLE_S = 0.4;
export const WAKE_BEND = 0.55;     // bend at the brush's edge, fading to 0 across the wake   // a pointer that hasn't moved for 0.4 s doesn't sweep
const SPEED_TAU = 0.06;            // speed smoothing, seconds

export class World {
  // layout: { cell, shortSide } in CSS px (from computeLayout()).
  constructor(n, layout, { headStart = false, seed, collectFx = true } = {}) {
    this.n = n;
    this.spec = getLevel(n);
    this.field = buildField(n, seed ?? fieldSeed(n));
    const f = this.field;
    this.grid = new Grid(f.W, f.H, f.valid, f.types, f.h0, this.spec.g);
    this.energy = new Energy(meterLine(this.spec.k, f.lap), { headStart });
    this.layout = layout;
    this.time = 0;
    this.strokeId = 0;
    this.pointer = null;      // { x, y, type, idle, speed } in field px while down
    this.won = false;
    this.wonAt = null;
    this.headStartEarned = false;
    this.wholeAtWin = 0;
    this.firstStrokeAt = null;
    this.collectFx = collectFx;
    this.fx = [];             // renderer events: ['flat', i, gain] | ['loosen', i] | ['bend', i] | ['stand', i]
    this.flatCount = 0;
    this.brushH = 0;          // mean height under the brush at the last stamp (for the rustle)
    this.loosenCount = 0;
  }

  setLayout(layout) { this.layout = layout; }

  brushRadiusPx(pointerType) {
    return brushRadiusPx(this.layout.cell, this.layout.shortSide, pointerType);
  }

  // Is the pointer "sweeping" (pressed and moved in the last 0.4 s)?
  get sweeping() {
    return !!this.pointer && this.pointer.idle < SWEEP_IDLE_S;
  }

  pointerDown(x, y, pointerType = 'mouse') {
    if (this.won) return;
    this.strokeId++;
    this.pointer = { x, y, type: pointerType, idle: 0, speed: 0 };
    if (this.firstStrokeAt === null) this.firstStrokeAt = this.time;
    // A press sweeps at once, at the press point.
    this._stamp(x, y, x, y, 0);
  }

  pointerMove(x, y, dt = STEP) {
    const p = this.pointer;
    if (!p || this.won) return;
    const dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const inst = d / Math.max(dt, 0.004);
    const a = 1 - Math.exp(-Math.max(dt, 0.004) / SPEED_TAU);
    p.speed = p.speed === 0 ? inst : p.speed + (inst - p.speed) * a;
    this._stamp(p.x, p.y, x, y, p.speed);
    p.x = x; p.y = y; p.idle = 0;
  }

  pointerUp() {
    this.pointer = null;
  }

  _stamp(x0, y0, x1, y1, speedPx) {
    const cell = this.layout.cell;
    const R = this.brushRadiusPx(this.pointer ? this.pointer.type : 'mouse') / cell;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = len > 0 ? (x1 - x0) / len : 0, uy = len > 0 ? (y1 - y0) / len : 0;
    const sf = speedFactor(speedPx);
    const grid = this.grid, energy = this.energy, fx = this.fx, collect = this.collectFx;
    const sid = this.strokeId;
    // The wake: grass up to max(0.9 cells, 0.7 R) beyond the brush parts
    // around the finger, leaning away from the path and a little along it.
    const Rw = R + Math.max(0.9, 0.7 * R);
    let hSum = 0, hN = 0;
    const wake = (i, f, nx, ny) => {
      let wx = nx + 0.5 * ux, wy = ny + 0.5 * uy;
      const m = Math.hypot(wx, wy) || 1;
      grid.nudge(i, wx / m, wy / m, WAKE_BEND * f);
    };
    stampCapsuleWake(grid.W, grid.H, x0 / cell, y0 / cell, x1 / cell, y1 / cell, R, Rw, (i) => {
      if (grid.valid[i]) { hSum += grid.h[i]; hN++; }
      const res = grid.sweepCell(i, sid, sf, ux, uy);
      if (res === SWEEP_FLAT) {
        energy.add(grid.lastGain);
        this.flatCount++;
        if (collect) fx.push(['flat', i, grid.lastGain]);
      } else if (res === SWEEP_LOOSEN) {
        this.loosenCount++;
        if (collect) fx.push(['loosen', i]);
      }
    }, wake);
    // For the rustle: how tall the grass under the brush was.
    if (hN > 0) this.brushH = hSum / hN;
  }

  step(dt = STEP) {
    this.time += dt;
    if (this.pointer) this.pointer.idle += dt;
    this.grid.update(dt);
    if (this.collectFx) {
      for (const e of this.grid.events) this.fx.push(e);
    }
    this.grid.events.length = 0;
    if (!this.won && this.energy.full) {
      this.won = true;
      this.wonAt = this.time;
      this.wholeAtWin = this.grid.wholeField();
      this.headStartEarned = earnsHeadStart(this.n, this.wholeAtWin, LEVEL_COUNT);
      this.pointer = null;
    }
  }

  drainFx() {
    const out = this.fx;
    this.fx = [];
    return out;
  }

  summary() {
    return {
      field: this.n,
      name: this.spec.name,
      time: +this.time.toFixed(2),
      energy: +this.energy.value.toFixed(3),
      line: +this.energy.line.toFixed(3),
      meter: +this.energy.frac.toFixed(4),
      whole: +this.grid.wholeField().toFixed(4),
      touched: this.grid.touchedCount,
      valid: this.grid.validCount,
      won: this.won,
      wonAt: this.wonAt === null ? null : +this.wonAt.toFixed(2),
      headStart: this.energy.headStart,
      headStartEarned: this.headStartEarned,
      strokeId: this.strokeId,
      sweeping: this.sweeping,
    };
  }
}
