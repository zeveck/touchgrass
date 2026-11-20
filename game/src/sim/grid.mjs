// sim/grid.mjs -- the grass grid and every per-cell rule in GAME_DESIGN.md
// "Grass, energy and regrowth rules". Pure: no DOM, no wall clock; time only
// advances through update(dt).
//
// Per cell (row-major, index i = r * W + c):
//   h        height 0..1
//   gold     goldness 0..1 (0 untouched; 1 when swept; then max(0.4, 1 - h))
//   touched  1 once swept or brushed this field
//   rest     seconds left before regrowth starts (1.5 s after a sweep)
//   loosened stroke id that loosened a standing stiff cell, or -1
//   bx, by   bend vector (stroke direction), on a damped spring back to 0
//   blocked  1 while a bug sits on the cell (strokes and moves skip it)

import { MULT, RATE, T_STIFF } from './types.mjs';

export const STAND_H = 0.4;          // F: grass at or above this stands and pays
export const REST_S = 1.5;           // rest after a sweep before regrowing
export const SEED_H = 0.08;          // logistic regrowth seed: max(h, 0.08)
export const GOLD_FLOOR = 0.4;       // touched grass never goes fully green again
export const BEND_OMEGA = 10;        // bend spring, rad/s
export const BEND_ZETA = 0.5;        // bend spring damping ratio

// Speed factor: +20% at 600 CSS px/s or faster, nothing at 150 or slower.
export function speedFactor(speedPx) {
  const t = Math.max(0, Math.min(1, (speedPx - 150) / 450));
  return 1 + 0.2 * t;
}

// Result codes of sweepCell().
export const SWEEP_NONE = 0;      // invalid, blocked, or nothing more this stroke
export const SWEEP_FLAT = 1;      // standing grass flattened, energy paid
export const SWEEP_BEND = 2;      // low grass bent (touched, nothing paid)
export const SWEEP_LOOSEN = 3;    // standing stiff grass loosened (touched, nothing paid)

export class Grid {
  constructor(W, H, valid, types, h0, g = 1) {
    this.W = W; this.H = H; this.N = W * H;
    this.g = g;
    this.valid = valid;
    this.type = types;
    this.h = Float32Array.from(h0);
    this.gold = new Float32Array(this.N);
    this.touched = new Uint8Array(this.N);
    this.rest = new Float32Array(this.N);
    this.loosened = new Int32Array(this.N).fill(-1);
    this.bx = new Float32Array(this.N);
    this.by = new Float32Array(this.N);
    this.bvx = new Float32Array(this.N);
    this.bvy = new Float32Array(this.N);
    this.blocked = new Uint8Array(this.N);
    this.validCount = 0;
    for (let i = 0; i < this.N; i++) this.validCount += valid[i];
    this.touchedCount = 0;
    this.lastGain = 0;         // energy of the last SWEEP_FLAT
    this.events = [];          // [kind, i] for the renderer ('stand' when grass stands up)
  }

  // Stiff grass is "stiff" (needs a fresh stroke) while standing and not loosened.
  isStiff(i) {
    return this.type[i] === T_STIFF && this.h[i] >= STAND_H && this.loosened[i] < 0;
  }
  isLoosened(i) {
    return this.type[i] === T_STIFF && this.h[i] >= STAND_H && this.loosened[i] >= 0;
  }

  _touch(i) {
    if (!this.touched[i]) {
      this.touched[i] = 1;
      this.touchedCount++;
      if (this.gold[i] < GOLD_FLOOR) this.gold[i] = Math.max(GOLD_FLOOR, 1 - this.h[i]);
    }
  }

  _bend(i, dx, dy) {
    this.bx[i] = dx; this.by[i] = dy;
    this.bvx[i] = 0; this.bvy[i] = 0;
  }

  // Sweep one cell with a stroke. (dx, dy) is the unit stroke direction.
  // `sf` is the speed factor (speedFactor()). Returns a SWEEP_* code; on
  // SWEEP_FLAT the energy gained is in this.lastGain.
  sweepCell(i, strokeId, sf, dx = 0, dy = 0) {
    if (!this.valid[i] || this.blocked[i]) return SWEEP_NONE;
    const h = this.h[i];
    if (h < STAND_H) {
      // Low grass only bends: no energy, height and regrowth carry on.
      this._touch(i);
      this._bend(i, dx, dy);
      return SWEEP_BEND;
    }
    if (this.type[i] === T_STIFF) {
      const by = this.loosened[i];
      if (by < 0) {
        this.loosened[i] = strokeId;
        this._touch(i);
        this._bend(i, dx * 0.6, dy * 0.6);
        return SWEEP_LOOSEN;
      }
      if (by === strokeId) return SWEEP_NONE;   // zig-zag in the same stroke: nothing more
    }
    const gain = MULT[this.type[i]] * h * sf;
    this.lastGain = gain;
    this.h[i] = 0;
    this.gold[i] = 1;
    this.rest[i] = REST_S;
    this.loosened[i] = -1;
    this._touch(i);
    this._bend(i, dx, dy);
    return SWEEP_FLAT;
  }

  // Advance regrowth, goldness and bend springs by dt seconds.
  update(dt) {
    const { N, valid, h, rest, gold, touched, type, loosened, bx, by, bvx, bvy } = this;
    const g = this.g;
    const k2 = BEND_OMEGA * BEND_OMEGA, c2 = 2 * BEND_ZETA * BEND_OMEGA;
    for (let i = 0; i < N; i++) {
      if (!valid[i]) continue;
      if (rest[i] > 0) {
        rest[i] -= dt;
        if (rest[i] < 0) rest[i] = 0;
      } else if (h[i] < 1) {
        const was = h[i];
        let nh = was + RATE[type[i]] * g * Math.max(was, SEED_H) * (1 - was) * dt;
        if (nh > 1) nh = 1;
        h[i] = nh;
        if (was < STAND_H && nh >= STAND_H) {
          // Stands up again: worth sweeping. Stiff grass is stiff again.
          if (type[i] === T_STIFF) loosened[i] = -1;
          this.events.push(['stand', i]);
        }
      }
      if (touched[i]) {
        const gg = 1 - h[i];
        gold[i] = gg > GOLD_FLOOR ? gg : GOLD_FLOOR;
      }
      const x = bx[i], y = by[i];
      if (x !== 0 || y !== 0 || bvx[i] !== 0 || bvy[i] !== 0) {
        bvx[i] += (-k2 * x - c2 * bvx[i]) * dt;
        bvy[i] += (-k2 * y - c2 * bvy[i]) * dt;
        bx[i] = x + bvx[i] * dt;
        by[i] = y + bvy[i] * dt;
        if (Math.abs(bx[i]) < 1e-3 && Math.abs(by[i]) < 1e-3 &&
            Math.abs(bvx[i]) < 1e-2 && Math.abs(bvy[i]) < 1e-2) {
          bx[i] = 0; by[i] = 0; bvx[i] = 0; bvy[i] = 0;
        }
      }
    }
  }

  // Whole-field fraction. A cell under a bug counts as touched once every
  // other valid cell is touched.
  wholeField() {
    let blockedUntouched = 0;
    for (let i = 0; i < this.N; i++) {
      if (this.valid[i] && this.blocked[i] && !this.touched[i]) blockedUntouched++;
    }
    const others = this.validCount - blockedUntouched;
    if (this.touchedCount >= others) return 1;
    return this.touchedCount / this.validCount;
  }

  untouchedLeft() {
    return this.wholeField() >= 1 ? 0 : this.validCount - this.touchedCount;
  }
}
