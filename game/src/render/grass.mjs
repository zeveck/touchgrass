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
import { gradeFor } from './grade.mjs';
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
    this.cacheOn = true;  // the still-cell band cache (small tiles only)
    this.bandRows = BAND_ROWS;
    this.cacheHits = 0;
    this.cacheBuilds = 0;
  }

  setSource(source) {
    this.source = source;
    this.key = '';
  }

  // Call when a field loads or the layout / DPR changes.
  prepare(world, layout, dpr) {
    const S = tileSize(layout.cell, dpr);
    const time = world.spec.time;
    const key = `${this.source.name}:${S}:${time}`;
    if (key !== this.key) {
      this.atlas = buildAtlas(this.source, S, gradeFor(time));
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
  // bloom: a Bloom (render/bloom.mjs) while the field-complete ripple runs:
  // cells it has passed stand up (with a spring) whatever their height.
  //
  // Still-cell cache (small tiles only): rows are grouped in bands of 2. A
  // band whose cells are all drawn exactly as last frame (same pre-sized tile,
  // not bending, popping or shimmering) is one drawImage of its cached
  // picture; a band with anything moving draws cell by cell, as before.
  // Compositing a band's picture equals drawing its cells in order, so the
  // row order (tufts overlapping the row behind) is kept.
  // reveal: a move effect (render/moves.mjs MoveFx) while its wave rolls:
  // cells it hasn't reached yet are drawn as they were before the move.
  draw(ctx, world, layout, dpr, dt, shimmer = 0, bloom = null, reveal = null) {
    const atlas = this.atlas;
    if (!atlas) return;
    const g = world.grid;
    const { W, H, N, valid, h, gold, type, loosened, bx, by, touched } = g;
    const S = atlas.S;
    const cell = layout.cell * dpr;
    const fx = layout.field.x * dpr, fy = layout.field.y * dpr;
    const jy = this.jy;
    const jit = this.jit, jx = this.jx, pop = this.pop;
    const rowOf = atlas.rowOf, stepped = atlas.stepped;
    const popDecay = Math.exp(-dt * 6);
    let bloomR2 = 0;
    if (bloom) {
      bloomR2 = bloom.radius * bloom.radius;
      if (!this.bloomed || this.bloomed.length !== N) this.bloomed = new Uint8Array(N);
    } else if (this.bloomed) this.bloomed = null;
    if (!this.cRow || this.cRow.length !== N) {
      this.cRow = new Int16Array(N); this.cGi = new Int8Array(N);
      this.cSx = new Float32Array(N); this.cSy = new Float32Array(N);
      this.cEx = new Float32Array(N); this.cBy = new Float32Array(N);
      this.cFast = new Uint8Array(N); this.keys = new Int32Array(N).fill(-2);
    }
    const { cRow, cGi, cSx, cSy, cEx, cBy, cFast, keys } = this;
    const useCache = this.cacheOn !== false && stepped && shimmer === 0 && !bloom && !reveal;
    const before = reveal ? reveal.before : null;
    const bands = useCache ? this._bands(world, layout, dpr) : null;
    ctx.imageSmoothingEnabled = this.smooth;
    const B = this.bandRows;
    for (let b0 = 0; b0 < H; b0 += B) {
      const b1 = Math.min(H, b0 + B);
      let moving = false, changed = false;
      // Work out how each cell in the band is drawn this frame.
      for (let r = b0; r < b1; r++) {
        const rowY = fy + (r + 0.88) * cell;
        for (let c = 0; c < W; c++) {
          const i = r * W + c;
          if (!valid[i]) continue;
          let hi = h[i];
          let gv = gold[i], lo = loosened[i];
          if (reveal && reveal.hidden(i, c, r)) { hi = before.h[i]; gv = before.gold[i]; lo = before.loosened[i]; }
          const t = type[i];
          if (bloom) {
            const dx = c + 0.5 - bloom.ox, dy = r + 0.5 - bloom.oy;
            if (dx * dx + dy * dy < bloomR2) {
              if (!this.bloomed[i]) { this.bloomed[i] = 1; if (!bloom.reduced) pop[i] = 1; }
              hi = 1;
            }
          }
          // Pose and size: standing tufts are 0.6 + 0.4 h tall; flattened ones
          // grow from 70% to 100% of their size as h goes 0 -> 0.4.
          let shape, row, sx, sy;
          if (hi >= STAND_H) {
            shape = (t === T_STIFF && lo >= 0) ? SHAPE_LOOSENED : t;
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
          const gi = goldStepIndex(gv);
          const fast = bx[i] === 0 && by[i] === 0 && p === 0 && (stepped || hi >= 0.999);
          cRow[i] = row; cGi[i] = gi; cSx[i] = sx; cSy[i] = sy; cFast[i] = fast ? 1 : 0;
          cEx[i] = fx + (c + 0.5 + jx[i]) * cell;
          cBy[i] = rowY + jy[i] * cell;
          const key = fast ? row * 8 + gi : -1;
          if (!fast) moving = true;
          if (keys[i] !== key) { changed = true; keys[i] = key; }
        }
      }
      if (bands && !moving) {
        const band = bands[(b0 / B) | 0];
        if (changed || !band.valid) {
          band.ctx.setTransform(1, 0, 0, 1, 0, 0);
          band.ctx.clearRect(0, 0, band.canvas.width, band.canvas.height);
          this._drawCells(band.ctx, g, b0, b1, shimmer, -band.x0, -band.y0);
          band.valid = true;
          this.cacheBuilds++;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(band.canvas, band.x0, band.y0);
        this.cacheHits++;
      } else {
        if (bands) bands[(b0 / B) | 0].valid = false;
        this._drawCells(ctx, g, b0, b1, shimmer, 0, 0);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Draw rows [r0, r1) cell by cell (offset ox, oy in device px).
  _drawCells(ctx, g, r0, r1, shimmer, ox, oy) {
    const { W, valid, touched, bx, by } = g;
    const atlas = this.atlas, S = atlas.S, sheet = atlas.canvas;
    const baseOff = BASE_Y * S;
    const flip = this.flip;
    const { cRow, cGi, cSx, cSy, cEx, cBy, cFast } = this;
    ctx.imageSmoothingEnabled = this.smooth;
    for (let r = r0; r < r1; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (!valid[i]) continue;
        const dim = shimmer > 0 && !touched[i];
        if (dim) ctx.globalAlpha = 1 - 0.35 * shimmer;
        if (cFast[i]) {
          // Not bending (most cells, most of the time): an unscaled,
          // pixel-aligned blit of a pre-sized tile.
          ctx.setTransform(flip[i], 0, 0, 1, Math.round(cEx[i]) + ox, Math.round(cBy[i]) + oy);
        } else {
          // Bend: a shear about the tuft's base from the cell's bend vector.
          const sx = cSx[i], bxi = bx[i], byi = by[i];
          ctx.setTransform(sx * flip[i], 0, -sx * bxi * 0.8, cSy[i] * (1 - 0.3 * Math.abs(byi)), cEx[i] + ox, cBy[i] + oy);
        }
        ctx.drawImage(sheet, cGi[i] * S, cRow[i] * S, S, S, -S / 2, -baseOff, S, S);
        if (dim) ctx.globalAlpha = 1;
      }
    }
  }

  // Band canvases for the current field and layout.
  _bands(world, layout, dpr) {
    const S = this.atlas.S;
    const key = `${this.bandRows}:${world.n}:${layout.field.x}:${layout.field.y}:${layout.cell}:${dpr}:${S}:${this.key}`;
    if (this.bandKey === key) return this.bandList;
    const cell = layout.cell * dpr;
    const fx = layout.field.x * dpr, fy = layout.field.y * dpr;
    const H = world.grid.H, W = world.grid.W;
    const list = [];
    for (let b0 = 0; b0 < H; b0 += this.bandRows) {
      const b1 = Math.min(H, b0 + this.bandRows);
      const x0 = Math.floor(fx - S), x1 = Math.ceil(fx + W * cell + S);
      const y0 = Math.floor(fy + (b0 + 0.75) * cell - BASE_Y * S) - 2;
      const y1 = Math.ceil(fy + (b1 - 1 + 1.0) * cell + (1 - BASE_Y) * S * 1.3) + 2;
      const canvas = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(x1 - x0, y1 - y0)
        : Object.assign(document.createElement('canvas'), { width: x1 - x0, height: y1 - y0 });
      list.push({ canvas, ctx: canvas.getContext('2d'), x0, y0, valid: false });
    }
    this.keys.fill(-2);
    this.bandKey = key;
    this.bandList = list;
    return list;
  }
}

export const BAND_ROWS = 2;
