// sim/world.mjs -- one field in play, stepped by a fixed dt. Pure: no DOM, no
// wall clock. The browser and the headless solver drive it the same way:
//
//   const w = new World(n, layout, { headStart });
//   w.pointerDown(x, y, 'mouse');      // field-relative CSS px
//   w.pointerMove(x, y, dtSinceLastSample);
//   w.pointerUp();
//   w.step(1 / 60);
//
// Pointer calls stamp brush capsules immediately; step() advances the bugs,
// regrowth, bends and the win check. Moves fire through fireMove(); friendly
// bugs are petted through pet() (the browser decides tap or sweep).

import { buildField, getLevel, LEVEL_COUNT } from './levels.mjs';
import { fieldSeed } from './rng.mjs';
import { Grid, speedFactor, SWEEP_FLAT, SWEEP_LOOSEN, STAND_H as STAND_H_W } from './grid.mjs';
import { MULT as MULT_W } from './types.mjs';
import { brushRadiusPx, stampCapsuleWake } from './brush.mjs';
import { Energy, meterLine, earnsHeadStart } from './energy.mjs';
import { Bugs } from './insects.mjs';
import {
  ringRadiusCells, lineHalfWidthCells, ringCells, linePath, lineCells, clearCells, priceOf,
  clampToField, typicalPrice,
} from './moves.mjs';

export const STEP = 1 / 60;
export const SWEEP_IDLE_S = 0.4;
export const WAKE_BEND = 0.55;     // bend at the brush's edge, fading to 0 across the wake   // a pointer that hasn't moved for 0.4 s doesn't sweep
const SPEED_TAU = 0.06;            // speed smoothing, seconds

export class World {
  // layout: { cell, shortSide } in CSS px (from computeLayout()).
  // bugs: false leaves the field empty (dev / tests of sweeping alone).
  constructor(n, layout, { headStart = false, seed, collectFx = true, bugs = true, bugSeed } = {}) {
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
    this.bites = 0;
    this.petScore = 0;        // 25 per bug petted (once per bug per field)
    this.movesFired = { ring: 0, line: 0, clear: 0 };
    this.bugs = new Bugs(this, bugSeed);
    if (!bugs) this.bugs.clear();
  }

  get petted() { return this.bugs.list.filter((b) => b.petted).length; }

  brushCells(pointerType = 'mouse') {
    return this.brushRadiusPx(pointerType) / this.layout.cell;
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
    // Friendly bugs in the way are nudged aside.
    this.bugs.nudge(x0 / cell, y0 / cell, x1 / cell, y1 / cell, R);
  }

  // ---- bugs ---------------------------------------------------------------

  // The friendly bug whose pet area holds this field-px point, or null.
  friendAt(x, y) { return this.bugs.friendAt(x, y); }

  // Pet a friendly bug (a tap). See Bugs.pet().
  pet(bug) {
    if (this.won) return null;
    return this.bugs.pet(bug);
  }

  // ---- moves --------------------------------------------------------------

  // The cells a move covers. arg: ring { x, y } (cells, clamped to the
  // field), line { path: [[x, y], ...] } (cells, the dragged path), clear: -.
  moveArea(kind, arg = {}, pointerType = 'mouse') {
    const g = this.grid;
    const bc = this.brushCells(pointerType);
    if (kind === 'ring') {
      const [x, y] = clampToField(g, arg.x, arg.y);
      const rc = ringRadiusCells(bc);
      return { kind, x, y, rc, cells: ringCells(g, x, y, rc) };
    }
    if (kind === 'line') {
      const path = linePath(g, arg.path || []);
      const hw = lineHalfWidthCells(bc);
      return { kind, path, hw, cells: path.length ? lineCells(g, path, hw) : [] };
    }
    if (kind === 'clear') return { kind, cells: clearCells(g) };
    throw new Error(`No move ${kind}`);
  }

  // Exact price of a move here: { cost, gain, net, standing, cells, frac,
  // affordable }. frac is the cost as a share of the line.
  movePrice(kind, arg, pointerType) {
    const area = arg && arg.cells ? arg : this.moveArea(kind, arg, pointerType);
    const p = priceOf(this.grid, area.cells);
    p.frac = this.energy.line > 0 ? p.cost / this.energy.line : 0;
    p.affordable = p.cost <= this.energy.value + 1e-9;
    p.area = area;
    return p;
  }

  // The "~N%" a move's button shows (share of the line, average spot).
  typicalPrice(kind, pointerType) {
    return typicalPrice(this.grid, kind, this.brushCells(pointerType), this.energy.line, this.field.avgMult);
  }

  // Fire a move: pay its cost and its gain in the same instant (the meter
  // never rises), flatten the standing grass it covers, touch the rest, and
  // calm every biter in it. Returns { fired, reason?, price }.
  fireMove(kind, arg, pointerType = 'mouse') {
    if (this.won) return { fired: false, reason: 'won' };
    const price = this.movePrice(kind, arg, pointerType);
    const area = price.area;
    if (!area.cells.length) return { fired: false, reason: 'empty', price };
    if (!price.affordable) return { fired: false, reason: 'afford', price };
    const g = this.grid;
    let gain = 0, cost = 0;
    const W = g.W;
    // Bend directions: out from the Ring's centre; along the Line.
    let dirOf = () => [0, 0];
    if (kind === 'ring') {
      dirOf = (i) => {
        const dx = (i % W) + 0.5 - area.x, dy = Math.floor(i / W) + 0.5 - area.y;
        const m = Math.hypot(dx, dy) || 1;
        return [dx / m, dy / m];
      };
    } else if (kind === 'line') {
      const p = area.path;
      const a = p[0], b = p[p.length - 1];
      const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const d = [(b[0] - a[0]) / m, (b[1] - a[1]) / m];
      dirOf = () => d;
    }
    for (const i of area.cells) {
      const h = g.h[i];
      const [dx, dy] = dirOf(i);
      const res = g.moveCell(i, dx, dy);
      if (res < 0) continue;
      if (h >= STAND_H_W) { gain += res; cost += MULT_W[g.type[i]]; }
    }
    // Paid and paid back at once: never more than it costs.
    this.energy.add(Math.min(0, gain - cost));
    if (kind === 'clear') {
      // Every other blade is touched now, so the cells under bugs count too
      // ("counts last"), and keep counting when the bugs wander off.
      for (const i of area.cells) if (g.blocked[i]) g.touchCovered(i);
    }
    this.movesFired[kind]++;
    // Moves calm biters: a Ring every biter in its disc, a Line every biter
    // its corridor passes over. They flee from the move.
    for (const b of this.bugs.list) {
      if (!b.hostile || b.state === 'flee') continue;
      const reach = 0.35 * this.bugs.sizeCells();
      if (kind === 'ring') {
        if (Math.hypot(b.x - area.x, b.y - area.y) <= area.rc + reach) this.bugs.scare(b, area.x, area.y);
      } else if (kind === 'line') {
        const q = nearestOnPath(area.path, b.x, b.y);
        if (q.d <= area.hw + reach) this.bugs.scare(b, q.x, q.y);
      }
    }
    if (this.collectFx) this.fx.push(['move', kind, area, { gain, cost }]);
    return { fired: true, price, gain, cost };
  }

  step(dt = STEP) {
    this.time += dt;
    if (this.pointer) this.pointer.idle += dt;
    this.bugs.step(dt);
    if (this.bugs.events.length) {
      if (this.collectFx) for (const e of this.bugs.events) this.fx.push(['bug', e[0], e[1], e[2]]);
      this.bugs.events.length = 0;
    }
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
      bites: this.bites,
      petted: this.petted,
      petScore: this.petScore,
      bugs: this.bugs.list.length,
    };
  }
}

// Nearest point on a polyline (cells) to (x, y): { x, y, d }.
function nearestOnPath(path, x, y) {
  let best = { x: path[0][0], y: path[0][1], d: Math.hypot(x - path[0][0], y - path[0][1]) };
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = path[k - 1], [bx, by] = path[k];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let u = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
    u = Math.max(0, Math.min(1, u));
    const qx = ax + u * dx, qy = ay + u * dy;
    const d = Math.hypot(x - qx, y - qy);
    if (d < best.d) best = { x: qx, y: qy, d };
  }
  return best;
}
