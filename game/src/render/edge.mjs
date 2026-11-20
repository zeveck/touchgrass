// render/edge.mjs -- the static layer: the painted surroundings for the
// field's time of day (cover-fit, 16:9 or 9:16 by aspect), the soil texture
// graded per time and clipped to the field's polygons, a 6 px soil lip, a
// 2 px ink line, and small buttercups, daisies and clover every ~80 px along
// the edge. Redrawn only on resize, a new field, or when a picture arrives.
//
// art: { scene, soil, flowers: [img, img, img] } -- any may be null (not
// loaded yet): a soft gradient and plain soil stand in.

import { mulberry32 } from '../sim/rng.mjs';
import { gradeFor } from './grade.mjs';

const SKY = {
  morning: ['#f3f1dc', '#dfe9c4', '#c9dca8'],
  afternoon: ['#f7efd2', '#e3e2b4', '#cdd69d'],
  golden: ['#f8e2bf', '#ecc995', '#d7b17a'],
};

export function polyPath(ctx, polygons, ox, oy, cell) {
  ctx.beginPath();
  for (const poly of polygons) {
    poly.forEach(([x, y], j) => {
      const px = ox + x * cell, py = oy + y * cell;
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
}

function drawCover(ctx, img, W, H) {
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// Points every ~step px along the polygons' edges (device px), with the
// outward-ish normal side ignored: flowers sit right on the line.
function edgePoints(polygons, ox, oy, cell, step) {
  const pts = [];
  for (const poly of polygons) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ax = ox + a[0] * cell, ay = oy + a[1] * cell;
      const bx = ox + b[0] * cell, by = oy + b[1] * cell;
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.round(len / step));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      }
    }
  }
  return pts;
}

export function drawStatic(ctx, spec, layout, art = {}) {
  const dpr = layout.bgDpr || layout.dpr;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const grade = gradeFor(spec.time);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Surroundings.
  if (art.scene) {
    ctx.imageSmoothingQuality = 'high';
    drawCover(ctx, art.scene, W, H);
  } else {
    const sky = SKY[spec.time] || SKY.morning;
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, sky[0]);
    gr.addColorStop(0.55, sky[1]);
    gr.addColorStop(1, sky[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  const cell = layout.cell * dpr;
  const ox = layout.field.x * dpr, oy = layout.field.y * dpr;

  // Soft shadow + soil lip (6 px, under the ink line).
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.shadowColor = 'rgba(43, 42, 38, 0.35)';
  ctx.shadowBlur = 14 * dpr;
  ctx.shadowOffsetY = 4 * dpr;
  polyPath(ctx, spec.polygons, ox, oy, cell);
  ctx.lineWidth = 12 * dpr;
  ctx.strokeStyle = '#8a6a45';
  ctx.stroke();
  ctx.restore();

  // Soil, clipped to the field.
  ctx.save();
  polyPath(ctx, spec.polygons, ox, oy, cell);
  ctx.clip();
  if (art.soil) {
    const pat = ctx.createPattern(art.soil, 'repeat');
    if (pat.setTransform && typeof DOMMatrix !== 'undefined') {
      const k = 0.55 * dpr;
      pat.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]));
    }
    ctx.fillStyle = pat;
  } else {
    ctx.fillStyle = '#74553a';
  }
  ctx.fillRect(ox - 8, oy - 8, layout.field.w * dpr + 16, layout.field.h * dpr + 16);
  // Grade the soil per time of day (tint, then value), so it stays darker
  // than every grass colour, gold included.
  if (grade.soil.alpha > 0) {
    const t = grade.soil.tint;
    ctx.fillStyle = `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${grade.soil.alpha})`;
    ctx.fillRect(ox - 8, oy - 8, layout.field.w * dpr + 16, layout.field.h * dpr + 16);
  }
  ctx.fillStyle = `rgba(30, 18, 8, ${0.18 + (1 - grade.soil.value)})`;
  ctx.fillRect(ox - 8, oy - 8, layout.field.w * dpr + 16, layout.field.h * dpr + 16);
  // A little inner shade along the edge.
  ctx.lineWidth = 10 * dpr;
  ctx.strokeStyle = 'rgba(30, 18, 8, 0.22)';
  polyPath(ctx, spec.polygons, ox, oy, cell);
  ctx.stroke();
  ctx.restore();

  // Ink line.
  polyPath(ctx, spec.polygons, ox, oy, cell);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = '#2b2a26';
  ctx.stroke();

  // Little flowers dotted along the edge, about every 80 px.
  const flowers = (art.flowers || []).filter(Boolean);
  if (flowers.length) {
    const rng = mulberry32(31 + spec.n);
    const size = (layout.portrait || Math.min(layout.vw, layout.vh) < 500 ? 18 : 24) * dpr;
    for (const [x, y] of edgePoints(spec.polygons, ox, oy, cell, 80 * dpr)) {
      const img = flowers[Math.floor(rng() * flowers.length)];
      const s = size * (0.85 + 0.3 * rng());
      ctx.save();
      ctx.translate(x + (rng() - 0.5) * 6 * dpr, y + (rng() - 0.5) * 6 * dpr);
      ctx.rotate((rng() - 0.5) * 0.8);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
}
