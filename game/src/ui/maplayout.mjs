// ui/maplayout.mjs -- where the meadow map's 15 patch tokens go
// (GAME_DESIGN.md "Screens", Meadow map). Pure: no DOM.
//
// One list of coordinates per orientation, as fractions of the free area
// under the header:
// - Portrait (the 9:16 painting, morning at the bottom, sunset at the top):
//   five rows of three, serpentine from the bottom left.
// - Landscape and desktop (the 16:9 painting, morning left, sunset right):
//   three rows of five, the path snaking down and up each column.
// Tokens are at least 56 px across and nothing scrolls.

export const HEADER = 64;      // the map's top bar (48 px buttons + margins)
export const LABEL = 22;       // the best score under a finished token
export const MIN_TOKEN = 56;
export const MAX_TOKEN = 104;
export const PAD = 14;

export const PORTRAIT = Object.freeze([
  [0.16, 0.95], [0.50, 0.90], [0.84, 0.94],
  [0.82, 0.71], [0.50, 0.69], [0.18, 0.72],
  [0.16, 0.49], [0.50, 0.46], [0.84, 0.49],
  [0.82, 0.27], [0.50, 0.25], [0.18, 0.28],
  [0.18, 0.05], [0.50, 0.02], [0.82, 0.06],
]);

export const LANDSCAPE = Object.freeze([
  [0.02, 0.04], [0.06, 0.50], [0.02, 0.96],
  [0.27, 0.94], [0.25, 0.49], [0.28, 0.04],
  [0.50, 0.07], [0.52, 0.52], [0.49, 0.95],
  [0.73, 0.93], [0.71, 0.47], [0.74, 0.04],
  [0.97, 0.05], [0.94, 0.50], [0.98, 0.96],
]);

// w, h: the window (CSS px); safe: the safe-area insets.
// Returns { portrait, size, label, tokens: [{ n, x, y }] } with x, y the
// token centres in CSS px.
export function mapLayout(w, h, safe = {}) {
  const st = safe.top || 0, sr = safe.right || 0, sb = safe.bottom || 0, sl = safe.left || 0;
  const portrait = h > w;
  const coords = portrait ? PORTRAIT : LANDSCAPE;
  const cols = portrait ? 3 : 5, rows = portrait ? 5 : 3;
  const x0 = sl + PAD, x1 = w - sr - PAD;
  const y0 = st + HEADER, y1 = h - sb - PAD;
  const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0);
  const cellW = W / cols, cellH = H / rows;
  const size = Math.round(Math.max(MIN_TOKEN, Math.min(MAX_TOKEN, cellW * 0.62, (cellH - LABEL) * 0.74)));
  // Centres run over the area left once a token (and its label) fits inside.
  const ux0 = x0 + size / 2, ux1 = x1 - size / 2;
  const uy0 = y0 + size / 2, uy1 = y1 - size / 2 - LABEL;
  const tokens = coords.map(([u, v], i) => ({
    n: i + 1,
    x: Math.round(ux0 + u * (ux1 - ux0)),
    y: Math.round(uy0 + v * (uy1 - uy0)),
  }));
  return { portrait, size, label: LABEL, tokens };
}

// A smooth path through the token centres (Catmull-Rom as cubic Béziers),
// as an SVG path string.
export function pathThrough(points) {
  if (!points.length) return '';
  const p = points;
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], e = p[Math.min(p.length - 1, i + 2)];
    const c1x = b.x + (c.x - a.x) / 6, c1y = b.y + (c.y - a.y) / 6;
    const c2x = c.x - (e.x - b.x) / 6, c2y = c.y - (e.y - b.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${c.x},${c.y}`;
  }
  return d;
}
