// sim/mask.mjs -- polygon masks for the fields.
//
// Coordinates are in grid units: the cell at row r, column c has its centre at
// (c + 0.5, r + 0.5). A cell is valid iff its centre is inside ANY polygon
// (union), by the ray-cast rule from the original plan (Phase 3).

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y)) {
      const xCross = (xj - xi) * (y - yi) / (yj - yi) + xi;
      if (x < xCross) inside = !inside;
    }
  }
  return inside;
}

// Returns a Uint8Array of length W*H (row-major): 1 = valid cell.
export function computeMask(W, H, polygons) {
  const valid = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const x = c + 0.5, y = r + 0.5;
      for (const poly of polygons) {
        if (pointInPolygon(x, y, poly)) { valid[r * W + c] = 1; break; }
      }
    }
  }
  return valid;
}

export function countValid(valid) {
  let n = 0;
  for (let i = 0; i < valid.length; i++) n += valid[i];
  return n;
}
