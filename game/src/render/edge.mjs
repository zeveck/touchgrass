// render/edge.mjs -- the static layer: surroundings (code gradient for now;
// the painted scenes drop in later), soil clipped to the field's polygons,
// a 6 px soil lip and a 2 px ink line along the polygon.

const SKY = {
  morning: ['#f3f1dc', '#dfe9c4', '#c9dca8'],
  afternoon: ['#f7efd2', '#e3e2b4', '#cdd69d'],
  golden: ['#f8e2bf', '#ecc995', '#d7b17a'],
};

function polyPath(ctx, polygons, ox, oy, cell) {
  ctx.beginPath();
  for (const poly of polygons) {
    poly.forEach(([x, y], j) => {
      const px = ox + x * cell, py = oy + y * cell;
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
}

export function drawStatic(ctx, spec, layout) {
  const dpr = layout.dpr;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sky = SKY[spec.time] || SKY.morning;
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, sky[0]);
  gr.addColorStop(0.55, sky[1]);
  gr.addColorStop(1, sky[2]);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);

  // Soft mown-lawn texture: faint stripes so the surroundings aren't flat.
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#2f6b34';
  const stripe = 28 * dpr;
  for (let x = -H; x < W; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, H); ctx.lineTo(x + stripe, H); ctx.lineTo(x + stripe + H * 0.4, 0); ctx.lineTo(x + H * 0.4, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const cell = layout.cell * dpr;
  const ox = layout.field.x * dpr, oy = layout.field.y * dpr;

  // Soil lip (6 px, under the ink line), then the soil itself.
  ctx.lineJoin = 'round';
  polyPath(ctx, spec.polygons, ox, oy, cell);
  ctx.lineWidth = 12 * dpr;
  ctx.strokeStyle = '#8a6a45';
  ctx.stroke();
  const soil = ctx.createRadialGradient(ox + layout.field.w * dpr / 2, oy + layout.field.h * dpr / 2, 0,
    ox + layout.field.w * dpr / 2, oy + layout.field.h * dpr / 2, Math.max(layout.field.w, layout.field.h) * dpr * 0.7);
  soil.addColorStop(0, '#7f5e3d');
  soil.addColorStop(1, '#6a4c30');
  ctx.fillStyle = soil;
  ctx.fill();

  // A little grain in the soil.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(40, 26, 14, 0.18)';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const n = Math.min(4000, Math.round(layout.field.w * layout.field.h / 40));
  for (let j = 0; j < n; j++) {
    ctx.fillRect(ox + rnd() * layout.field.w * dpr, oy + rnd() * layout.field.h * dpr, 1.5 * dpr, 1.5 * dpr);
  }
  ctx.restore();

  // Ink line.
  polyPath(ctx, spec.polygons, ox, oy, cell);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = '#2b2a26';
  ctx.stroke();
}
