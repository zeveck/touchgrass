// render/particles.mjs -- gold motes that lift from flattened grass and fly
// to the meter. Render-only (not part of the sim). Capped for performance.

const MAX_MOTES = 260;

export class Motes {
  constructor() {
    this.list = [];
    this.cap = MAX_MOTES;
    this.arrived = 0;   // motes that reached the meter since last read
  }

  clear() { this.list.length = 0; }

  // x, y: start in CSS px; tx, ty: meter target in CSS px.
  spawn(x, y, tx, ty, n) {
    for (let j = 0; j < n && this.list.length < this.cap; j++) {
      const a = Math.random() * Math.PI * 2;
      this.list.push({
        x0: x + Math.cos(a) * 4, y0: y + Math.sin(a) * 3,
        // Lift a little, then curve to the meter.
        lx: x + (Math.random() - 0.5) * 30, ly: y - 18 - Math.random() * 26,
        tx: tx + (Math.random() - 0.5) * 10, ty,
        t: -Math.random() * 0.12, dur: 0.75 + Math.random() * 0.35,
        r: 1.6 + Math.random() * 1.6,
      });
    }
  }

  update(dt) {
    const L = this.list;
    let w = 0;
    for (let j = 0; j < L.length; j++) {
      const m = L[j];
      m.t += dt;
      if (m.t >= m.dur) { this.arrived++; continue; }
      L[w++] = m;
    }
    L.length = w;
  }

  // Draws the motes; returns their bounding box in CSS px (or null).
  draw(ctx, dpr) {
    if (!this.list.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.list) {
      if (m.t < 0) continue;
      const u = m.t / m.dur;
      // Quadratic bezier: start -> lift point -> meter, eased in.
      const e = u * u * (3 - 2 * u);
      const x = (1 - e) * (1 - e) * m.x0 + 2 * (1 - e) * e * m.lx + e * e * m.tx;
      const y = (1 - e) * (1 - e) * m.y0 + 2 * (1 - e) * e * m.ly + e * e * m.ty;
      const a = u < 0.8 ? 1 : (1 - u) / 0.2;
      const rr = m.r * 2.2;
      if (x - rr < x0) x0 = x - rr;
      if (y - rr < y0) y0 = y - rr;
      if (x + rr > x1) x1 = x + rr;
      if (y + rr > y1) y1 = y + rr;
      ctx.fillStyle = `rgba(255, 214, 110, ${0.35 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, m.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 240, 170, ${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }
}
