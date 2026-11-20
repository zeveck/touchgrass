// sim/brush.mjs -- brush radius rule and capsule stamping.
//
// Radius = max(0.75 cells, 5% of the field's shorter on-screen side,
//              18 CSS px for touch / 14 CSS px for mouse or pen).
// Each frame the segment between pointer samples is stamped as a capsule, so
// fast swipes never skip cells. Pure.

export const BRUSH_MIN_TOUCH_PX = 18;
export const BRUSH_MIN_MOUSE_PX = 14;
export const BRUSH_CELL_FRAC = 0.75;
export const BRUSH_FIELD_FRAC = 0.05;

export function brushRadiusPx(cellPx, fieldShortSidePx, pointerType = 'mouse') {
  const min = pointerType === 'touch' ? BRUSH_MIN_TOUCH_PX : BRUSH_MIN_MOUSE_PX;
  return Math.max(BRUSH_CELL_FRAC * cellPx, BRUSH_FIELD_FRAC * fieldShortSidePx, min);
}

// Call fn(i) for every cell (index r * W + c) whose centre lies within R of
// the segment (x0, y0)-(x1, y1). All in cell units. Each cell at most once.
export function stampCapsule(W, H, x0, y0, x1, y1, R, fn) {
  const r0 = Math.max(0, Math.floor(Math.min(y0, y1) - R));
  const r1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + R));
  const c0 = Math.max(0, Math.floor(Math.min(x0, x1) - R));
  const c1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + R));
  const dx = x1 - x0, dy = y1 - y0;
  const L2 = dx * dx + dy * dy;
  const R2 = R * R;
  for (let r = r0; r <= r1; r++) {
    const cy = r + 0.5;
    for (let c = c0; c <= c1; c++) {
      const cx = c + 0.5;
      let u = L2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / L2 : 0;
      if (u < 0) u = 0; else if (u > 1) u = 1;
      const ex = x0 + u * dx - cx, ey = y0 + u * dy - cy;
      if (ex * ex + ey * ey <= R2) fn(r * W + c);
    }
  }
}

// Like stampCapsule, plus a wake: cells whose centre is within Rw (> R) but
// outside R get wake(i, f, nx, ny), where f fades 1 -> 0 from R to Rw and
// (nx, ny) is the unit vector from the path to the cell (zero on the path).
export function stampCapsuleWake(W, H, x0, y0, x1, y1, R, Rw, fn, wake) {
  const r0 = Math.max(0, Math.floor(Math.min(y0, y1) - Rw));
  const r1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + Rw));
  const c0 = Math.max(0, Math.floor(Math.min(x0, x1) - Rw));
  const c1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + Rw));
  const dx = x1 - x0, dy = y1 - y0;
  const L2 = dx * dx + dy * dy;
  const R2 = R * R, Rw2 = Rw * Rw;
  for (let r = r0; r <= r1; r++) {
    const cy = r + 0.5;
    for (let c = c0; c <= c1; c++) {
      const cx = c + 0.5;
      let u = L2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / L2 : 0;
      if (u < 0) u = 0; else if (u > 1) u = 1;
      const ex = cx - (x0 + u * dx), ey = cy - (y0 + u * dy);
      const d2 = ex * ex + ey * ey;
      if (d2 <= R2) fn(r * W + c);
      else if (d2 <= Rw2) {
        const d = Math.sqrt(d2);
        wake(r * W + c, 1 - (d - R) / (Rw - R), ex / d, ey / d);
      }
    }
  }
}
