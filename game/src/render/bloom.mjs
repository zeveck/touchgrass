// render/bloom.mjs -- the field-complete bloom (GAME_DESIGN.md Juice): a
// ripple runs out from the last touch, every tuft springs up as it passes,
// buttercups, daisies and clover pop open across the field, and petals swirl.
// With reduced motion: no ripple ring, no swirl, no bounce; the flowers simply
// appear. Render-only: the sim isn't touched.

import { mulberry32 } from '../sim/rng.mjs';

const RIPPLE_S = 1.1;     // time for the ripple to cross the field

export class Bloom {
  // origin: CSS px (page). flowers / petal: images (may be null).
  constructor(world, layout, origin, { flowers = [], petal = null, reduced = false } = {}) {
    const g = world.grid;
    this.layout = layout;
    this.reduced = reduced;
    this.t = 0;
    this.ox = (origin.x - layout.field.x) / layout.cell;   // cells
    this.oy = (origin.y - layout.field.y) / layout.cell;
    // Farthest valid cell from the origin sets the ripple speed.
    let far = 1;
    for (let i = 0; i < g.N; i++) {
      if (!g.valid[i]) continue;
      const d = Math.hypot((i % g.W) + 0.5 - this.ox, Math.floor(i / g.W) + 0.5 - this.oy);
      if (d > far) far = d;
    }
    this.far = far;
    this.speed = far / RIPPLE_S;
    const rng = mulberry32(900 + world.n);
    const imgs = flowers.filter(Boolean);
    this.flowers = [];
    if (imgs.length) {
      const cells = [];
      for (let i = 0; i < g.N; i++) if (g.valid[i]) cells.push(i);
      const n = Math.min(48, Math.max(8, Math.round(cells.length / 6)));
      for (let j = 0; j < n; j++) {
        const i = cells[Math.floor(rng() * cells.length)];
        const x = (i % g.W) + 0.2 + 0.6 * rng(), y = Math.floor(i / g.W) + 0.2 + 0.6 * rng();
        this.flowers.push({
          x, y, img: imgs[Math.floor(rng() * imgs.length)],
          at: Math.hypot(x - this.ox, y - this.oy) / this.speed + 0.05 * rng(),
          rot: (rng() - 0.5) * 0.6, s: 0.85 + 0.3 * rng(),
        });
      }
      this.flowers.sort((a, b) => a.y - b.y);
    }
    this.petal = petal;
    this.petals = [];
    if (!reduced && petal) {
      for (let j = 0; j < 28; j++) {
        this.petals.push({
          a: rng() * Math.PI * 2, r0: 4 + 10 * rng(), v: 60 + 90 * rng(), spin: (rng() - 0.5) * 8,
          swirl: 1.2 + rng(), life: 1.6 + 0.8 * rng(), size: 9 + 6 * rng(),
        });
      }
    }
  }

  // Ripple radius in cells.
  get radius() { return this.t * this.speed; }

  done() { return this.t > RIPPLE_S + 2.6; }

  update(dt) { this.t += dt; }

  // Drawn over the grass.
  draw(ctx, dpr) {
    const L = this.layout;
    const cell = L.cell;
    const fx = L.field.x, fy = L.field.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The ripple ring.
    if (!this.reduced && this.t < RIPPLE_S + 0.3) {
      const r = this.radius * cell;
      const a = Math.max(0, 1 - this.t / (RIPPLE_S + 0.3));
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, L.field.w, L.field.h);
      ctx.clip();
      ctx.lineWidth = Math.max(6, cell * 0.8);
      ctx.strokeStyle = `rgba(255, 240, 180, ${0.45 * a})`;
      ctx.beginPath();
      ctx.arc(fx + this.ox * cell, fy + this.oy * cell, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Flowers pop open as the ripple reaches them.
    const size = Math.max(18, cell * 1.15);
    for (const f of this.flowers) {
      const u = this.t - f.at;
      if (u <= 0) continue;
      let k;
      if (this.reduced) k = 1;
      else {
        const p = Math.min(1, u / 0.35);
        k = p < 1 ? (1 - Math.pow(1 - p, 3)) * (1 + 0.25 * Math.sin(p * Math.PI)) : 1;
      }
      const s = size * f.s * k;
      ctx.save();
      ctx.translate(fx + f.x * cell, fy + f.y * cell);
      ctx.rotate(f.rot);
      ctx.drawImage(f.img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    // Petals swirl out from the last touch.
    if (this.petals.length) {
      for (const p of this.petals) {
        const u = this.t / p.life;
        if (u >= 1) continue;
        const r = p.r0 + p.v * this.t;
        const ang = p.a + p.swirl * this.t;
        const x = fx + this.ox * cell + Math.cos(ang) * r;
        const y = fy + this.oy * cell + Math.sin(ang) * r - 30 * this.t;
        ctx.save();
        ctx.globalAlpha = 1 - u * u;
        ctx.translate(x, y);
        ctx.rotate(p.a + p.spin * this.t);
        ctx.drawImage(this.petal, -p.size / 2, -p.size / 2, p.size, p.size * 1.05);
        ctx.restore();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Bounding box (CSS px) of what it draws: the field plus the petals' reach.
  box() {
    const L = this.layout;
    const m = this.petals.length ? 260 : 20;
    return { x0: L.field.x - m, y0: L.field.y - m, x1: L.field.x + L.field.w + m, y1: L.field.y + L.field.h + m };
  }
}
