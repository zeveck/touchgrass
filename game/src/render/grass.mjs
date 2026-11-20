// render/grass.mjs -- draws every valid cell's tuft from the atlas, in row
// order from the top row down (so a tuft spilling upward is drawn over the
// row behind it). One setTransform + one drawImage per cell.
//
// Pose: standing if h >= 0.4 (scaled vertically to 0.6 + 0.4 h); below that,
// the flattened tuft growing from 70% to 100% of its size as h goes 0 -> 0.4.
// Bend: shear about the tuft's base from the cell's spring-driven bend vector.
// Colour: the atlas tile for the cell's nearest goldness step.

import { STAND_H } from '../sim/grid.mjs';
import { T_STIFF } from '../sim/types.mjs';
import { mulberry32 } from '../sim/rng.mjs';
import {
  buildAtlas, tileSize, goldStepIndex, BASE_Y, SHAPE_LOOSENED, SHAPE_FLAT0, STAND_STEPS, FLAT_STEPS,
} from './atlas.mjs';

export class GrassRenderer {
  constructor(tuftSource) {
    this.source = tuftSource;
    this.atlas = null;
    this.key = '';
    this.jit = null;      // per-cell size jitter
    this.jx = null;       // per-cell x offset (cells)
    this.flip = null;     // per-cell mirror
    this.pop = null;      // per-cell "stood up" spring (render-only)
    this.smooth = true;   // false in performance mode
  }

  setSource(source) {
    this.source = source;
    this.key = '';
  }

  // Call when a field loads or the layout / DPR changes.
  prepare(world, layout, dpr) {
    const S = tileSize(layout.cell, dpr);
    const key = `${this.source.name}:${S}`;
    if (key !== this.key) {
      this.atlas = buildAtlas(this.source, S);
      this.key = key;
    }
    const N = world.grid.N;
    if (!this.jit || this.jit.length !== N || this.fieldN !== world.n) {
      const rng = mulberry32(4242 + world.n);
      this.jit = new Float32Array(N);
      this.jx = new Float32Array(N);
      this.jy = new Float32Array(N);
      this.flip = new Int8Array(N);
      this.pop = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        this.jit[i] = 0.9 + 0.2 * rng();
        this.jx[i] = (rng() - 0.5) * 0.24;   // x jitter (cells) breaks up the grid
        this.jy[i] = (rng() - 0.5) * 0.2;    // and a little y jitter, so rows don't read as stripes
        this.flip[i] = rng() < 0.5 ? -1 : 1;
      }
      this.fieldN = world.n;
    }
  }

  // A cell just stood back up: give it a little spring.
  popCell(i) {
    if (this.pop) this.pop[i] = 1;
  }

  // dt: frame time (for the render-only pop spring). shimmer: 0..1 pulse for
  // untouched cells (from 90% whole-field), or 0.
  draw(ctx, world, layout, dpr, dt, shimmer = 0) {
    const atlas = this.atlas;
    if (!atlas) return;
    const g = world.grid;
    const { W, H, valid, h, gold, type, loosened, bx, by, touched } = g;
    const S = atlas.S;
    const sheet = atlas.canvas;
    const cell = layout.cell * dpr;
    const fx = layout.field.x * dpr, fy = layout.field.y * dpr;
    const baseOff = BASE_Y * S;
    const jy = this.jy;
    const jit = this.jit, jx = this.jx, flip = this.flip, pop = this.pop;
    const rowOf = atlas.rowOf, stepped = atlas.stepped;
    const popDecay = Math.exp(-dt * 6);
    ctx.imageSmoothingEnabled = this.smooth;
    for (let r = 0; r < H; r++) {
      const rowY = fy + (r + 0.88) * cell;
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (!valid[i]) continue;
        const hi = h[i];
        const t = type[i];
        // Pose and size: standing tufts are 0.6 + 0.4 h tall; flattened ones
        // grow from 70% to 100% of their size as h goes 0 -> 0.4.
        let shape, row, sx, sy;
        if (hi >= STAND_H) {
          shape = (t === T_STIFF && loosened[i] >= 0) ? SHAPE_LOOSENED : t;
          const hs = 0.6 + 0.4 * hi;
          if (stepped) {
            const k = Math.round((hs - 0.6) * 10);
            row = rowOf[shape][k];
            sx = 1; sy = hs / STAND_STEPS[k];
          } else {
            row = rowOf[shape][0];
            sx = 1; sy = hs;
          }
        } else {
          shape = SHAPE_FLAT0 + t;
          const fs = 0.7 + 0.3 * (hi / STAND_H);
          if (stepped) {
            const k = Math.round((fs - 0.7) * 10);
            row = rowOf[shape][k];
            sx = sy = fs / FLAT_STEPS[k];
          } else {
            row = rowOf[shape][0];
            sx = sy = fs * jit[i];
          }
        }
        let p = 0;
        if (pop[i] > 0.01) {
          // Standing up: a quick squash-and-stretch.
          p = pop[i];
          sy *= 1 + 0.25 * Math.sin((1 - p) * Math.PI * 3) * p;
          pop[i] *= popDecay;
        } else if (pop[i] !== 0) pop[i] = 0;
        const gi = goldStepIndex(gold[i]);
        const bxi = bx[i], byi = by[i];
        const ex = fx + (c + 0.5 + jx[i]) * cell;
        const baseY = rowY + jy[i] * cell;
        const dim = shimmer > 0 && !touched[i];
        if (dim) ctx.globalAlpha = 1 - 0.35 * shimmer;
        if (bxi === 0 && byi === 0 && p === 0 && (stepped || (hi >= 0.999))) {
          // Not bending (most cells, most of the time): an unscaled,
          // pixel-aligned blit of a pre-sized tile.
          ctx.setTransform(flip[i], 0, 0, 1, Math.round(ex), Math.round(baseY));
        } else {
          // Bend: a shear about the tuft's base from the cell's bend vector.
          ctx.setTransform(sx * flip[i], 0, -sx * bxi * 0.8, sy * (1 - 0.3 * Math.abs(byi)), ex, baseY);
        }
        ctx.drawImage(sheet, gi * S, row * S, S, S, -S / 2, -baseOff, S, S);
        if (dim) ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
