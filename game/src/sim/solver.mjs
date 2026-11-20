// sim/solver.mjs -- generated brush paths ("solve") and the headless runner.
//
// Profiles (CSS px/s), from GAME_DESIGN.md Tech plan:
//   fast      600, serpentine lanes, one stroke per lane, lifts 0.12 s at each turn
//   average   350, serpentine, lifts 0.2 s
//   calm      150, serpentine, lifts 0.4 s
//   scribble  700, random curving strokes of 1.5 s with 0.1 s lifts
// Lane spacing is 0.9 x the brush diameter, as in the design's pacing
// simulator (design/tuning/sim3.mjs). The same Autopilot drives the browser's
// window.__game.solve() and the Node runner, through World's pointer API.
// Pure.

import { World, STEP } from './world.mjs';
import { computeLayout, LAYOUTS } from './layout.mjs';
import { getLevel } from './levels.mjs';
import { mulberry32 } from './rng.mjs';

export const PROFILES = Object.freeze({
  fast: Object.freeze({ kind: 'serp', v: 600, turn: 0.12 }),
  average: Object.freeze({ kind: 'serp', v: 350, turn: 0.2 }),
  calm: Object.freeze({ kind: 'serp', v: 150, turn: 0.4 }),
  scribble: Object.freeze({ kind: 'scrib', v: 700, turn: 0.1, wiggle: 1.2, strokeLen: 1.5, hop: 0.25 }),
});

// Lanes for a serpentine sweep: [{ y, lo, hi }] in cell units, top to bottom.
export function serpentineLanes(world, pointerType) {
  const grid = world.grid;
  const { W, H, valid } = grid;
  const R = world.brushRadiusPx(pointerType) / world.layout.cell;
  const sp = Math.max(1, 2 * R * 0.9);
  const lanes = [];
  for (let y = Math.min(R, H / 2); y < H; y += sp) {
    let lo = W, hi = 0;
    const ra = Math.max(0, Math.floor(y - R + 0.5)), rb = Math.min(H - 1, Math.floor(y + R - 0.5));
    for (let r = ra; r <= rb; r++) {
      for (let c = 0; c < W; c++) {
        if (valid[r * W + c]) { if (c < lo) lo = c; if (c + 1 > hi) hi = c + 1; }
      }
    }
    if (lo < hi) lanes.push({ y, lo: Math.min(lo + 0.5, hi - 0.5), hi: Math.max(hi - 0.5, lo + 0.5) });
  }
  return lanes;
}

// Drives a World with a profile's path. Call tick(dt) once per fixed step,
// before world.step(dt).
export class Autopilot {
  constructor(world, profileName = 'average', { pointerType, seed } = {}) {
    this.world = world;
    this.profile = PROFILES[profileName];
    if (!this.profile) throw new Error(`Unknown profile ${profileName}`);
    this.name = profileName;
    this.pointerType = pointerType || 'mouse';
    this.cell = world.layout.cell;
    this.lift = 0;
    this.down = false;
    const p = this.profile;
    if (p.kind === 'serp') {
      this.lanes = serpentineLanes(world, this.pointerType);
      this.lane = 0;
      this.dir = 1;
      const L = this.lanes[0];
      this.x = L.lo; this.y = L.y;
    } else {
      this.rng = mulberry32(seed ?? (99 + world.n));
      this.ang = this.rng() * Math.PI * 2;
      this.validCells = [];
      for (let i = 0; i < world.grid.N; i++) if (world.grid.valid[i]) this.validCells.push(i);
      const c = this._onField(world.grid.W / 2, world.grid.H / 2) ? [world.grid.W / 2, world.grid.H / 2] : this._randomCell();
      this.x = c[0]; this.y = c[1];
      this.strokeT = 0;
    }
  }

  _onField(x, y) {
    const { W, H, valid } = this.world.grid;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return valid[Math.floor(y) * W + Math.floor(x)] === 1;
  }

  _randomCell() {
    const W = this.world.grid.W;
    const i = this.validCells[Math.floor(this.rng() * this.validCells.length)];
    return [(i % W) + 0.5, Math.floor(i / W) + 0.5];
  }

  _press() {
    this.world.pointerDown(this.x * this.cell, this.y * this.cell, this.pointerType);
    this.down = true;
  }

  _release(liftS) {
    this.world.pointerUp();
    this.down = false;
    this.lift = liftS;
  }

  tick(dt = STEP) {
    if (this.world.won) { if (this.down) this._release(0); return; }
    if (this.lift > 0) {
      this.lift -= dt;
      if (this.lift > 0) return;
    }
    if (!this.down) { this._press(); return; }
    const p = this.profile;
    const v = p.v / this.cell;   // cells per second
    if (p.kind === 'serp') {
      const L = this.lanes[this.lane];
      this.x += this.dir * v * dt;
      const end = this.dir > 0 ? L.hi : L.lo;
      const past = this.dir > 0 ? this.x >= end : this.x <= end;
      if (past) this.x = end;
      this.world.pointerMove(this.x * this.cell, this.y * this.cell, dt);
      if (past) {
        this._release(p.turn);
        this.lane = (this.lane + 1) % this.lanes.length;
        this.dir = -this.dir;
        const N = this.lanes[this.lane];
        this.y = N.y;
        this.x = this.dir > 0 ? N.lo : N.hi;
      }
    } else {
      // A scribbler scribbles on the field: it turns back at the field's
      // edge (the polygon, not its bounding box).
      this.ang += (this.rng() - 0.5) * p.wiggle;
      const step = v * dt;
      let nx = this.x + Math.cos(this.ang) * step, ny = this.y + Math.sin(this.ang) * step;
      if (!this._onField(nx, ny)) {
        const tries = [Math.PI - this.ang, -this.ang, this.ang + Math.PI];
        for (const a of tries) {
          const tx = this.x + Math.cos(a) * step, ty = this.y + Math.sin(a) * step;
          if (this._onField(tx, ty)) { this.ang = a; nx = tx; ny = ty; break; }
        }
        if (!this._onField(nx, ny)) { nx = this.x; ny = this.y; this.ang = this.rng() * Math.PI * 2; }
      }
      this.x = nx; this.y = ny;
      this.world.pointerMove(this.x * this.cell, this.y * this.cell, dt);
      this.strokeT += dt;
      if (this.strokeT > p.strokeLen) {
        this.strokeT = 0;
        this._release(p.turn);
        // Now and then the next stroke starts somewhere else on the field.
        if (this.rng() < p.hop) { const c = this._randomCell(); this.x = c[0]; this.y = c[1]; }
      }
    }
  }
}

// Run one field headless. Returns { won, time, meter, whole, ... }.
export function runField(n, layoutName = 'phone', profileName = 'average', opts = {}) {
  const L = LAYOUTS[layoutName];
  const spec = getLevel(n);
  const layout = computeLayout(L.vw, L.vh, spec.w, spec.h);
  const world = new World(n, layout, { headStart: !!opts.headStart, collectFx: false, seed: opts.seed });
  const pilot = new Autopilot(world, profileName, { pointerType: L.pointerType });
  const tmax = opts.tmax ?? 900;
  while (!world.won && world.time < tmax) {
    pilot.tick(STEP);
    world.step(STEP);
  }
  const s = world.summary();
  return {
    field: n, layout: layoutName, profile: profileName,
    won: world.won, time: world.won ? +world.wonAt.toFixed(1) : null,
    meter: +(100 * s.meter).toFixed(1), whole: +(100 * s.whole).toFixed(1),
    cell: +layout.cell.toFixed(1), brushPx: +world.brushRadiusPx(L.pointerType).toFixed(1),
  };
}
