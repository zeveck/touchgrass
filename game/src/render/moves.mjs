// render/moves.mjs -- the moves on the canvas (GAME_DESIGN.md "Moves",
// "Juice"): the armed preview (the Ring's circle and the Line's corridor
// under the pointer, Full Clear's whole field, with the grass they'd flatten
// shimmering and the exact price; grey when it can't be afforded) and the
// effects when one fires (the Ring's shock-wave, the Line's breeze trail,
// Full Clear's gust rolling across the meadow).
//
// While an effect plays, cells the wave hasn't reached yet are drawn as they
// were before the move (`reveal`), so the grass goes down as the wave passes.
// Render-only.

import { STAND_H } from '../sim/grid.mjs';

const RING_S = 0.38;      // shock-wave out to the Ring's edge
const LINE_S = 0.9;       // breeze trail
const GUST_S = 1.15;      // the gust's front crosses the field

function pricePill(ctx, x, y, text, ok) {
  ctx.font = '800 14px Nunito, sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = ok ? 'rgba(251, 243, 223, 0.95)' : 'rgba(225, 222, 214, 0.95)';
  ctx.strokeStyle = ok ? '#2b2a26' : '#77736a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 13, w, 26, 13); else ctx.rect(x - w / 2, y - 13, w, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ok ? '#2b2a26' : '#77736a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  return w;
}

function pct(frac) {
  const p = frac * 100;
  return p < 1 && p > 0 ? '<1%' : `${Math.round(p)}%`;
}

// Soft light over the standing cells a move would flatten.
function shimmerCells(ctx, grid, cells, layout, t, ok, reduced) {
  const cell = layout.cell, fx = layout.field.x, fy = layout.field.y;
  const a = reduced ? 0.22 : 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(t * 7));
  ctx.fillStyle = ok ? `rgba(255, 236, 160, ${a})` : `rgba(120, 120, 120, ${a * 0.8})`;
  // One path, one fill: neighbouring cells merge with no seams between them.
  ctx.beginPath();
  for (const i of cells) {
    if (grid.blocked[i] || grid.h[i] < STAND_H) continue;
    const c = i % grid.W, r = (i / grid.W) | 0;
    ctx.rect(fx + c * cell, fy + r * cell, cell + 0.5, cell + 0.5);
  }
  ctx.fill();
}

// The armed preview. `aim` (CSS px, page) is where the pointer is, or null.
// Returns the CSS-px box drawn.
export function drawPreview(ctx, world, layout, dpr, t, armed, price, extra, reduced) {
  const cell = layout.cell, fx = layout.field.x, fy = layout.field.y;
  const ok = !price || price.affordable;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let box = null;
  if (armed === 'clear') {
    // The whole field shimmers.
    ctx.save();
    if (price) shimmerCells(ctx, world.grid, price.area.cells, layout, t, ok, reduced);
    ctx.restore();
    const label = price ? `Full Clear ${pct(price.frac)}: tap the field` : 'Full Clear';
    // Above the field when there's room (below the HUD strip in portrait).
    const top = layout.portrait ? layout.hud.y + layout.hud.h : 0;
    pricePill(ctx, fx + layout.field.w / 2, fy - 34 > top ? fy - 20 : fy + 18, label, ok);
    box = { x0: fx - 120, y0: fy - 40, x1: fx + layout.field.w + 120, y1: fy + layout.field.h + 20 };
  } else if (armed === 'ring' && price) {
    const a = price.area;
    const x = fx + a.x * cell, y = fy + a.y * cell, r = a.rc * cell;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    shimmerCells(ctx, world.grid, a.cells, layout, t, ok, reduced);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = reduced ? 0 : -t * 30;
    ctx.strokeStyle = ok ? 'rgba(255, 246, 214, 0.95)' : 'rgba(150, 148, 140, 0.95)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ok ? 'rgba(43, 42, 38, 0.6)' : 'rgba(80, 80, 80, 0.5)';
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke();
    pricePill(ctx, x, y - r - 18, pct(price.frac), ok);
    box = { x0: x - r - 60, y0: y - r - 40, x1: x + r + 60, y1: y + r + 10 };
  } else if (armed === 'line' && extra && extra.path && extra.path.length) {
    const path = extra.path;   // the raw drag (cells), drawn as dragged
    const hw = price && price.area.hw ? price.area.hw : extra.hw;
    if (price && price.area.cells.length) {
      ctx.save();
      shimmerCells(ctx, world.grid, price.area.cells, layout, t, ok, reduced);
      ctx.restore();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(fx + path[0][0] * cell, fy + path[0][1] * cell);
    for (const p of path) ctx.lineTo(fx + p[0] * cell, fy + p[1] * cell);
    ctx.lineWidth = 2 * hw * cell;
    ctx.strokeStyle = ok ? 'rgba(255, 246, 214, 0.22)' : 'rgba(150, 150, 150, 0.25)';
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = reduced ? 0 : -t * 40;
    ctx.strokeStyle = ok ? 'rgba(255, 246, 214, 0.95)' : 'rgba(150, 148, 140, 0.95)';
    ctx.stroke();
    ctx.setLineDash([]);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of path) {
      const x = fx + p[0] * cell, y = fy + p[1] * cell;
      bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
    }
    const end = path[path.length - 1];
    const ex = fx + end[0] * cell, ey = fy + end[1] * cell;
    if (price) pricePill(ctx, ex, ey - hw * cell - 20, price.area.cells.length ? pct(price.frac) : 'Drag over the field', ok && price.area.cells.length > 0);
    const m = hw * cell + 80;
    box = { x0: bx0 - m, y0: by0 - m, x1: bx1 + m, y1: by1 + m };
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return box;
}

// One move effect in play.
export class MoveFx {
  // before: { h, gold, loosened } copies taken just before the move fired.
  constructor(kind, area, before, layout, world) {
    this.kind = kind;
    this.area = area;
    this.before = before;
    this.layout = layout;
    this.world = world;
    this.t = 0;
    this.dur = kind === 'ring' ? RING_S + 0.45 : kind === 'line' ? LINE_S : GUST_S + 0.5;
    this.hit = new Uint8Array(world.grid.N);
    for (const i of area.cells) this.hit[i] = 1;
    this.bent = new Uint8Array(world.grid.N);
    if (kind === 'line') {
      // Breeze streaks along the path.
      this.streaks = [];
      for (let k = 0; k < 14; k++) {
        this.streaks.push({ u: Math.random(), off: (Math.random() - 0.5) * 1.6, len: 0.06 + Math.random() * 0.08, sp: 0.6 + Math.random() * 0.6 });
      }
      let L = 0;
      const p = area.path;
      this.segL = [0];
      for (let k = 1; k < p.length; k++) { L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); this.segL.push(L); }
      this.len = L || 1;
    }
    if (kind === 'clear') {
      const g = world.grid;
      this.streaks = [];
      for (let k = 0; k < 26; k++) this.streaks.push({ y: Math.random() * g.H, len: 1.5 + Math.random() * 3, lag: Math.random() * 3 });
    }
  }

  done() { return this.t >= this.dur; }

  // The wave's reach: cells it hasn't reached are drawn as they were.
  // Ring: radius from the centre; Clear: the gust's front (column).
  get front() {
    const g = this.world.grid;
    if (this.kind === 'ring') return (this.t / RING_S) * this.area.rc;
    if (this.kind === 'clear') return -2 + (this.t / GUST_S) * (g.W + 4);
    return Infinity;
  }

  // True if cell (c, r) is still drawn as before the move.
  hidden(i, c, r) {
    if (!this.hit[i]) return false;
    if (this.kind === 'ring') {
      const dx = c + 0.5 - this.area.x, dy = r + 0.5 - this.area.y;
      return dx * dx + dy * dy > this.front * this.front;
    }
    if (this.kind === 'clear') return c + 0.5 > this.front;
    return false;
  }

  update(dt) {
    this.t += dt;
    // The gust bends the grass as its front passes.
    if (this.kind === 'clear') {
      const g = this.world.grid;
      const f = this.front;
      for (let i = 0; i < g.N; i++) {
        if (!this.hit[i] || this.bent[i]) continue;
        if ((i % g.W) + 0.5 <= f) {
          this.bent[i] = 1;
          g.nudge(i, 0.95, 0.15, 0.9);
        }
      }
    }
  }

  // Overlay: the shock-wave ring, the breeze trail, the gust's streaks.
  draw(ctx, dpr, reduced) {
    const L = this.layout, cell = L.cell, fx = L.field.x, fy = L.field.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let box = null;
    if (this.kind === 'ring') {
      const x = fx + this.area.x * cell, y = fy + this.area.y * cell;
      const r = Math.min(this.front, this.area.rc * 1.25) * cell;
      const a = Math.max(0, 1 - this.t / this.dur);
      if (!reduced) {
        ctx.lineWidth = Math.max(4, cell * 0.6);
        ctx.strokeStyle = `rgba(255, 246, 214, ${0.75 * a})`;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(231, 184, 74, ${0.8 * a})`;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * 0.82), 0, Math.PI * 2); ctx.stroke();
      }
      const R = this.area.rc * cell * 1.3 + 10;
      box = { x0: x - R, y0: y - R, x1: x + R, y1: y + R };
    } else if (this.kind === 'line' && !reduced) {
      const p = this.area.path;
      // The breeze stays on the field (a thumb may overshoot its edge).
      ctx.save();
      ctx.beginPath();
      for (const poly of this.world.spec.polygons) {
        poly.forEach(([px, py], j) => (j ? ctx.lineTo(fx + px * cell, fy + py * cell) : ctx.moveTo(fx + px * cell, fy + py * cell)));
        ctx.closePath();
      }
      ctx.clip();
      const a = Math.max(0, 1 - this.t / this.dur);
      const hw = this.area.hw;
      ctx.lineCap = 'round';
      // The corridor glows briefly...
      ctx.beginPath();
      ctx.moveTo(fx + p[0][0] * cell, fy + p[0][1] * cell);
      for (const q of p) ctx.lineTo(fx + q[0] * cell, fy + q[1] * cell);
      ctx.lineWidth = 2 * hw * cell;
      ctx.strokeStyle = `rgba(255, 246, 214, ${0.25 * a * a})`;
      ctx.stroke();
      // ...and breeze streaks run along it.
      ctx.lineWidth = 2;
      for (const s of this.streaks) {
        const u0 = (s.u + this.t * s.sp) % 1;
        const u1 = Math.min(1, u0 + s.len);
        const A = this._at(u0, s.off * hw), B = this._at(u1, s.off * hw);
        ctx.strokeStyle = `rgba(255, 255, 240, ${0.8 * a})`;
        ctx.beginPath();
        ctx.moveTo(fx + A[0] * cell, fy + A[1] * cell);
        ctx.lineTo(fx + B[0] * cell, fy + B[1] * cell);
        ctx.stroke();
      }
      ctx.restore();
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const q of p) {
        bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]);
      }
      const m = (hw + 2) * cell;
      box = { x0: fx + bx0 * cell - m, y0: fy + by0 * cell - m, x1: fx + bx1 * cell + m, y1: fy + by1 * cell + m };
    } else if (this.kind === 'clear') {
      const f = this.front;
      const a = Math.max(0, Math.min(1, (GUST_S + 0.5 - this.t) / 0.5));
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, L.field.w, L.field.h);
      ctx.clip();
      // A bright band at the front.
      const gx = fx + f * cell;
      const grad = ctx.createLinearGradient(gx - 6 * cell, 0, gx + cell, 0);
      grad.addColorStop(0, 'rgba(255, 246, 214, 0)');
      grad.addColorStop(0.8, `rgba(255, 246, 214, ${0.35 * a})`);
      grad.addColorStop(1, 'rgba(255, 246, 214, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - 6 * cell, fy, 7 * cell, L.field.h);
      if (!reduced) {
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255, 255, 240, ${0.75 * a})`;
        for (const s of this.streaks) {
          const x1s = f - s.lag, x0s = x1s - s.len;
          const y = s.y + Math.sin(this.t * 4 + s.lag) * 0.4;
          ctx.beginPath();
          ctx.moveTo(fx + x0s * cell, fy + y * cell);
          ctx.quadraticCurveTo(fx + (x0s + x1s) / 2 * cell, fy + (y - 0.3) * cell, fx + x1s * cell, fy + y * cell);
          ctx.stroke();
        }
      }
      ctx.restore();
      box = { x0: fx, y0: fy, x1: fx + L.field.w, y1: fy + L.field.h };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return box;
  }

  // A point u (0..1) along the Line's path, offset sideways by `off` cells.
  _at(u, off) {
    const p = this.area.path;
    if (p.length < 2) return [p[0][0], p[0][1]];
    const d = u * this.len;
    let k = 1;
    while (k < p.length - 1 && this.segL[k] < d) k++;
    const a = p[k - 1], b = p[k];
    const sl = this.segL[k] - this.segL[k - 1] || 1;
    const v = Math.max(0, Math.min(1, (d - this.segL[k - 1]) / sl));
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const m = Math.hypot(dx, dy) || 1;
    return [a[0] + dx * v - (dy / m) * off, a[1] + dy * v + (dx / m) * off];
  }
}
