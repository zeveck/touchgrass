// render/titletoy.mjs -- the title's toy (GAME_DESIGN.md "Screens", Title):
// grass along the bottom edge that bends away as the pointer passes over it,
// and the ladybug wandering in the meadow behind it (the crawl frames, A26).
// Drawn on one canvas over the painting; the screen hands it pointer moves.

import { loadAll, imageNow } from '../assets.mjs';

export const CRAWL_URLS = Object.freeze([0, 1, 2, 3].map((k) => `assets/sprites/ladybug-crawl/frame_${k}.png`));
const GREENS = ['#4f8f3c', '#5f9e45', '#6aab4c', '#467f36', '#78b556', '#3f7431'];

// A tiny seeded RNG so the grass looks the same every visit.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TitleToy {
  constructor(canvas, { reduced = () => false } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = reduced;
    this.blades = [];
    this.ptr = null;          // { x, y, vx, t }
    this.bug = null;
    this.raf = 0;
    this.last = 0;
    this.w = 0; this.h = 0; this.dpr = 1;
    this._frame = this._frame.bind(this);
    loadAll(CRAWL_URLS).catch(() => {});
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height; this.dpr = dpr;
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    const rand = rng(7);
    const gap = 5.5;
    const n = Math.ceil(this.w / gap) + 2;
    const scale = Math.max(0.7, Math.min(1.25, this.h / 800));
    this.blades = [];
    for (let i = 0; i < n; i++) {
      // Two layers: a taller back row and a short front row.
      for (let layer = 0; layer < 2; layer++) {
        const H = (layer === 0 ? 46 + rand() * 40 : 22 + rand() * 26) * scale;
        this.blades.push({
          x: i * gap - 4 + rand() * gap,
          h: H,
          wBase: (layer === 0 ? 4.2 : 3.4) * scale * (0.8 + rand() * 0.5),
          lean: (rand() - 0.5) * 0.35,
          col: GREENS[Math.floor(rand() * GREENS.length)],
          layer,
          a: 0, v: 0,
          ph: rand() * Math.PI * 2,
        });
      }
    }
    this.blades.sort((p, q) => p.layer - q.layer);
    if (!this.bug) {
      this.bug = { x: this.w * 0.3, y: this.h * 0.86, hd: 0, tgt: 0.3, speed: 0, rest: 1.5, frame: 0, ft: 0 };
    }
    this.bug.x = Math.min(this.w - 30, Math.max(30, this.bug.x));
    this.bug.y = Math.min(this.h * 0.93, Math.max(this.h * 0.80, this.bug.y));
  }

  pointer(x, y) {
    const now = performance.now() / 1000;
    if (this.ptr) {
      const dt = Math.max(0.008, now - this.ptr.t);
      this.ptr.vx = (x - this.ptr.x) / dt;
    }
    this.ptr = { x, y, vx: this.ptr ? this.ptr.vx : 0, t: now };
  }

  leave() { this.ptr = null; }

  start() {
    if (this.raf) return;
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _frame(now) {
    this.raf = requestAnimationFrame(this._frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this._update(dt, now / 1000);
    this._draw(now / 1000);
  }

  _update(dt, t) {
    const reduced = this.reduced();
    const p = this.ptr && t - this.ptr.t < 1.2 ? this.ptr : null;
    const R = 70;
    for (const b of this.blades) {
      let target = b.lean;
      if (p) {
        const dx = b.x - p.x;
        const top = this.h - b.h * 1.5;
        if (Math.abs(dx) < R && p.y > top) {
          const k = 1 - Math.abs(dx) / R;
          // Pushed away from the pointer, a little further along its motion.
          target += Math.sign(dx || 1) * k * 0.95 + Math.max(-0.4, Math.min(0.4, p.vx / 2500)) * k;
        }
      }
      if (!reduced) target += 0.04 * Math.sin(t * 1.3 + b.ph);   // a soft breeze
      // A spring: springy normally, critically damped with reduced motion.
      const kS = 60, c = reduced ? 2 * Math.sqrt(kS) : 7;
      b.v += (-(b.a - target) * kS - b.v * c) * dt;
      b.a += b.v * dt;
    }
    // The ladybug wanders in the meadow, and hurries off from the pointer.
    const g = this.bug;
    if (!g) return;
    let scared = false;
    if (p && Math.hypot(p.x - g.x, p.y - g.y) < 60) {
      g.tgt = Math.atan2(g.y - p.y, g.x - p.x);
      g.rest = 0;
      scared = true;
    }
    if (g.rest > 0) {
      g.rest -= dt;
      g.speed = Math.max(0, g.speed - 40 * dt);
    } else {
      if (!scared && Math.random() < 0.6 * dt) g.tgt = g.hd + (Math.random() - 0.5) * 1.6;
      if (!scared && Math.random() < 0.12 * dt) g.rest = 1 + Math.random() * 2.5;
      const want = scared ? 55 : 20;
      g.speed += (want - g.speed) * Math.min(1, 3 * dt);
    }
    // Keep to the meadow band.
    const yMin = this.h * 0.79, yMax = this.h * 0.93;
    if (g.x < 30) g.tgt = 0; else if (g.x > this.w - 30) g.tgt = Math.PI;
    if (g.y < yMin) g.tgt = Math.PI / 2 * (g.x < this.w / 2 ? 0.5 : 1.5); else if (g.y > yMax) g.tgt = -Math.PI / 2;
    let d = g.tgt - g.hd;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    g.hd += Math.max(-3 * dt, Math.min(3 * dt, d));
    g.x += Math.cos(g.hd) * g.speed * dt;
    g.y += Math.sin(g.hd) * g.speed * dt;
    g.x = Math.min(this.w - 20, Math.max(20, g.x));
    g.y = Math.min(yMax + 8, Math.max(yMin - 8, g.y));
    if (g.speed > 4) {
      g.ft += dt * (8 + g.speed / 6);
      g.frame = Math.floor(g.ft) % 4;
    }
  }

  _draw(t) {
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The ladybug, behind the front grass.
    const g = this.bug;
    const img = g ? imageNow(CRAWL_URLS[g.frame]) : null;
    if (img) {
      const S = Math.max(40, Math.min(58, this.h * 0.065));
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = 'rgba(43, 42, 38, 0.18)';
      ctx.beginPath();
      ctx.ellipse(2, 5, S * 0.34, S * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(g.hd + Math.PI / 2);     // the art faces up
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
      ctx.restore();
    }
    // The grass: tapered blades bending from their base.
    const H = this.h;
    for (const b of this.blades) {
      const a = b.a;
      const tipX = b.x + Math.sin(a) * b.h, tipY = H - Math.cos(a) * b.h;
      const midX = b.x + Math.sin(a * 0.45) * b.h * 0.55, midY = H - Math.cos(a * 0.45) * b.h * 0.55;
      const w = b.wBase;
      ctx.beginPath();
      ctx.moveTo(b.x - w, H + 2);
      ctx.quadraticCurveTo(midX - w * 0.6, midY, tipX, tipY);
      ctx.quadraticCurveTo(midX + w * 0.6, midY, b.x + w, H + 2);
      ctx.closePath();
      ctx.fillStyle = b.col;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(43, 42, 38, 0.35)';
      ctx.stroke();
    }
    void t;
  }
}
