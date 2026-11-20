// sim/solver.mjs -- generated brush paths ("solve") and the headless runner.
//
// Profiles (CSS px/s), from GAME_DESIGN.md Tech plan:
//   fast      600, serpentine lanes, one stroke per lane, lifts 0.12 s at each turn
//   average   350, serpentine, lifts 0.2 s
//   calm      150, serpentine, lifts 0.4 s
//   scribble  700, random curving strokes of 1.5 s with 0.1 s lifts
//   careless  the scribbler, ignoring the bugs: it never steers, so it gets
//             bitten (the "bitten" check: even a careless player wins)
// Every profile but "careless" plays well with bugs: it steers around
// hostiles' anger radii (lifting and hopping past a biter in its lane, and
// re-planning as they move), so good play is never bitten, and it pets each
// friendly once (a tap between strokes).
// Lane spacing is 0.9 x the brush diameter, as in the design's pacing
// simulator (design/tuning/sim3.mjs). The same Autopilot drives the browser's
// window.__game.solve() and the Node runner, through World's pointer API.
// Pure.

import { World, STEP } from './world.mjs';
import { computeLayout, LAYOUTS } from './layout.mjs';
import { getLevel, shapeBounds } from './levels.mjs';
import { mulberry32 } from './rng.mjs';
import { angerRadiusPx } from './insects.mjs';

export const PROFILES = Object.freeze({
  fast: Object.freeze({ kind: 'serp', v: 600, turn: 0.12 }),
  average: Object.freeze({ kind: 'serp', v: 350, turn: 0.2 }),
  calm: Object.freeze({ kind: 'serp', v: 150, turn: 0.4 }),
  scribble: Object.freeze({ kind: 'scrib', v: 700, turn: 0.1, wiggle: 1.2, strokeLen: 1.5, hop: 0.25 }),
  careless: Object.freeze({ kind: 'scrib', v: 700, turn: 0.1, wiggle: 1.2, strokeLen: 1.5, hop: 0.25, careless: true }),
});
// The profiles the pacing table and par use (careless is the bitten check).
export const PACING_PROFILES = Object.freeze(['fast', 'average', 'calm', 'scribble']);

// Clearance kept from a hostile, as a multiple of its anger radius.
export const STEER_CLEAR = 1.2;
// A tap on a friendly: the hand travels there at twice the stroke speed,
// presses for 0.12 s and lifts.
const TAP_S = 0.12;
// How far ahead (in steps) a scribbler looks for a biter in its way. A
// scribbler mostly reacts to the red glow instead (see tick()); looking ahead
// bends its random strokes and costs coverage, so it's off.
const SCRIB_AHEAD = 0;

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
    this.hops = 0;
    this.taps = 0;
    const p = this.profile;
    this.careless = !!p.careless;
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

  // Hostiles to steer around (a fleeing bug can't get angry).
  _hazards() {
    if (this.careless) return [];
    return this.world.bugs.list.filter((b) => b.hostile && b.state !== 'flee');
  }

  // Is (x, y) (cells) clear of every hostile's anger radius (with margin)?
  _clear(x, y, hz, k = STEER_CLEAR) {
    const R = k * angerRadiusPx(this.cell) / this.cell;
    for (const b of hz) if (Math.hypot(b.x - x, b.y - y) < R) return false;
    return true;
  }

  // Between strokes: tap a friendly not yet petted this field (nearest first).
  _maybeTap() {
    if (this.careless) return;
    let best = null, bd = Infinity;
    for (const b of this.world.bugs.list) {
      if (b.hostile || b.petted) continue;
      const d = Math.hypot(b.x - this.x, b.y - this.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    this.world.pet(best);
    this.taps++;
    this.lift += TAP_S + (bd * this.cell) / (2 * this.profile.v);
  }

  _release(liftS) {
    this.world.pointerUp();
    this.down = false;
    this.lift = liftS;
  }

  _nextLane() {
    this.lane = (this.lane + 1) % this.lanes.length;
    this.dir = -this.dir;
    const N = this.lanes[this.lane];
    this.y = N.y;
    this.x = this.dir > 0 ? N.lo : N.hi;
  }

  // Further along this lane, the first point clear of every biter. Returns
  // false if there's none before the lane's end.
  _hopAlong(hz) {
    const L = this.lanes[this.lane];
    const end = this.dir > 0 ? L.hi : L.lo;
    for (let x = this.x; this.dir > 0 ? x <= end : x >= end; x += this.dir * 0.5) {
      if (this._clear(x, this.y, hz, STEER_CLEAR + 0.15)) { this.x = x; return true; }
    }
    return false;
  }

  // A scribbler's fresh start: a random spot clear of every biter.
  _hopAway(hz) {
    for (let k = 0; k < 30; k++) {
      const c = this._randomCell();
      if (this._clear(c[0], c[1], hz, STEER_CLEAR + 0.3)) { this.x = c[0]; this.y = c[1]; return; }
    }
    const c = this._randomCell();
    this.x = c[0]; this.y = c[1];
  }

  tick(dt = STEP) {
    if (this.world.won) { if (this.down) this._release(0); return; }
    if (this.lift > 0) {
      this.lift -= dt;
      if (this.lift > 0) return;
    }
    const p = this.profile;
    if (!this.down) {
      const hz = this._hazards();
      if (hz.length && !this._clear(this.x, this.y, hz)) {
        // The press point isn't safe (a biter wandered over): re-plan.
        if (p.kind === 'serp') { if (!this._hopAlong(hz)) this._nextLane(); } else this._hopAway(hz);
        this.lift = 0.05;
        return;
      }
      this._press();
      return;
    }
    const v = p.v / this.cell;   // cells per second
    if (p.kind === 'serp') {
      const L = this.lanes[this.lane];
      const hz = this._hazards();
      let nx = this.x + this.dir * v * dt;
      const end = this.dir > 0 ? L.hi : L.lo;
      const past = this.dir > 0 ? nx >= end : nx <= end;
      if (past) nx = end;
      if (hz.length && !this._clear(nx, this.y, hz)) {
        // A biter ahead: lift, and press again past it (or on the next lane).
        this._release(Math.min(p.turn, 0.15));
        this.hops++;
        if (!this._hopAlong(hz)) this._nextLane();
        return;
      }
      this.x = nx;
      this.world.pointerMove(this.x * this.cell, this.y * this.cell, dt);
      if (past) {
        this._release(p.turn);
        this._maybeTap();
        this._nextLane();
      }
    } else {
      // A scribbler scribbles on the field: it turns back at the field's
      // edge (the polygon, not its bounding box).
      this.ang += (this.rng() - 0.5) * p.wiggle;
      const step = v * dt;
      const hz = this._hazards();
      if (hz.length) {
        // A scribbler watches the red glow: it turns away from an angry biter
        // (which calms once the finger is 1.25 x its radius away), and veers
        // off a biter just ahead before it gets there.
        const Ra = angerRadiusPx(this.cell) / this.cell;
        let near = null, nd = Infinity;
        for (const b of hz) {
          const d = Math.hypot(b.x - this.x, b.y - this.y);
          const ahead = SCRIB_AHEAD > 0 ? Math.hypot(b.x - (this.x + Math.cos(this.ang) * step * SCRIB_AHEAD),
            b.y - (this.y + Math.sin(this.ang) * step * SCRIB_AHEAD)) : Infinity;
          if ((b.state === 'angry' && d < 1.6 * Ra) || ahead < Ra) {
            if (d < nd) { nd = d; near = b; }
          }
        }
        if (near && near.state === 'angry' && near.angerT > 0.8 && nd < 1.3 * Ra) {
          // Still close after most of the warning: lift and start elsewhere.
          this._release(p.turn);
          this.hops++;
          this._hopAway(hz);
          return;
        }
        if (near) this.ang = Math.atan2(this.y - near.y, this.x - near.x) + (this.rng() - 0.5) * 0.8;
      }
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
        this._maybeTap();
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
  const layout = computeLayout(L.vw, L.vh, spec.w, spec.h, {}, shapeBounds(spec));
  const world = new World(n, layout, {
    headStart: !!opts.headStart, collectFx: false, seed: opts.seed, bugs: opts.bugs !== false,
  });
  const pilot = new Autopilot(world, profileName, { pointerType: L.pointerType });
  const tmax = opts.tmax ?? 900;
  while (!world.won && world.time < tmax) {
    pilot.tick(STEP);
    if (opts.onStep) opts.onStep(world, pilot);
    world.step(STEP);
  }
  const s = world.summary();
  return {
    field: n, layout: layoutName, profile: profileName,
    won: world.won, time: world.won ? +world.wonAt.toFixed(1) : null,
    meter: +(100 * s.meter).toFixed(1), whole: +(100 * s.whole).toFixed(1),
    cell: +layout.cell.toFixed(1), brushPx: +world.brushRadiusPx(L.pointerType).toFixed(1),
    bites: world.bites, petted: world.petted, bugs: world.bugs.list.length, hops: pilot.hops,
  };
}
