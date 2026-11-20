// sim/moves.mjs -- the three moves (GAME_DESIGN.md "Moves"): sizes, the
// cells each covers, and the price rule. Pure.
//
// The price rule: a move never adds to the meter. It flattens the standing
// grass it covers and gives that grass's normal energy (type multiplier x h,
// no speed bonus), and costs the full-height value of the same cells (type
// multiplier x 1 each). Low grass is bent and touched, free. Cells under bugs
// are skipped and not charged. Paid and paid back in the same instant, so the
// meter only ever stays level or dips. Moves ignore the stiff grass's
// fresh-stroke rule (a Line's job is to flatten stiff grass in one go).

import { MULT } from './types.mjs';
import { STAND_H } from './grid.mjs';
import { stampCapsule } from './brush.mjs';

export const MOVE_KINDS = Object.freeze(['ring', 'line', 'clear']);
export const MOVE_UNLOCK = Object.freeze({ ring: 6, line: 9, clear: 11 });
export const MOVE_NAMES = Object.freeze({ ring: 'Ring', line: 'Line', clear: 'Full Clear' });
export const MOVE_KEYS = Object.freeze({ 1: 'ring', 2: 'line', 3: 'clear' });
export const ARM_TIMEOUT_S = 5;

// Moves available on field n (unlocked there, and on every later field).
export function unlockedMoves(n) {
  return MOVE_KINDS.filter((k) => n >= MOVE_UNLOCK[k]);
}

// Ring radius in cells: max(3 cells, 2.5 x brush radius).
export function ringRadiusCells(brushCells) {
  return Math.max(3, 2.5 * brushCells);
}
// Line corridor half-width in cells: the corridor is 3 x brush radius wide.
export function lineHalfWidthCells(brushCells) {
  return 1.5 * brushCells;
}

// Valid cells whose centre lies within rc of (cx, cy) (cells).
export function ringCells(grid, cx, cy, rc) {
  const out = [];
  const r0 = Math.max(0, Math.floor(cy - rc)), r1 = Math.min(grid.H - 1, Math.ceil(cy + rc));
  const c0 = Math.max(0, Math.floor(cx - rc)), c1 = Math.min(grid.W - 1, Math.ceil(cx + rc));
  const rc2 = rc * rc;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = c + 0.5 - cx, dy = r + 0.5 - cy;
      const i = r * grid.W + c;
      if (dx * dx + dy * dy <= rc2 && grid.valid[i]) out.push(i);
    }
  }
  return out;
}

function inField(grid, x, y) {
  if (x < 0 || y < 0 || x >= grid.W || y >= grid.H) return false;
  return grid.valid[Math.floor(y) * grid.W + Math.floor(x)] === 1;
}

// The part of a dragged path (cells) a Line fires along: from the first point
// over the field, at most maxLen long. Thumbs overshoot edges, so the release
// may be off the field. Returns [] if the drag never touched the field.
export function linePath(grid, path, maxLen = Math.max(grid.W, grid.H)) {
  if (!path.length) return [];
  // Find the first on-field point (sampled every quarter cell).
  let start = -1, sx = 0, sy = 0;
  for (let k = 0; k < path.length && start < 0; k++) {
    const [ax, ay] = path[k];
    if (inField(grid, ax, ay)) { start = k; sx = ax; sy = ay; break; }
    if (k + 1 < path.length) {
      const [bx, by] = path[k + 1];
      const L = Math.hypot(bx - ax, by - ay);
      const n = Math.ceil(L / 0.25);
      for (let j = 1; j < n; j++) {
        const x = ax + (bx - ax) * (j / n), y = ay + (by - ay) * (j / n);
        if (inField(grid, x, y)) { start = k + 1; sx = x; sy = y; break; }
      }
    }
  }
  if (start < 0) return [];
  const out = [[sx, sy]];
  let left = maxLen;
  for (let k = start; k < path.length && left > 0; k++) {
    const [px, py] = out[out.length - 1];
    const [qx, qy] = path[k];
    const L = Math.hypot(qx - px, qy - py);
    if (L < 1e-9) continue;
    if (L <= left) { out.push([qx, qy]); left -= L; } else {
      out.push([px + (qx - px) * (left / L), py + (qy - py) * (left / L)]);
      left = 0;
    }
  }
  return out;
}

// Valid cells within hw of a path (cells), each once.
export function lineCells(grid, path, hw) {
  const seen = new Uint8Array(grid.N);
  const out = [];
  const add = (i) => { if (!seen[i] && grid.valid[i]) { seen[i] = 1; out.push(i); } };
  if (path.length === 1) stampCapsule(grid.W, grid.H, path[0][0], path[0][1], path[0][0], path[0][1], hw, add);
  for (let k = 1; k < path.length; k++) {
    stampCapsule(grid.W, grid.H, path[k - 1][0], path[k - 1][1], path[k][0], path[k][1], hw, add);
  }
  return out;
}

export function clearCells(grid) {
  const out = [];
  for (let i = 0; i < grid.N; i++) if (grid.valid[i]) out.push(i);
  return out;
}

// Price of a move over these cells: cost (full-height value of the standing
// cells it flattens) and gain (their normal energy). Cells under bugs are
// skipped and not charged.
export function priceOf(grid, cells) {
  let cost = 0, gain = 0, standing = 0, n = 0;
  for (const i of cells) {
    if (!grid.valid[i] || grid.blocked[i]) continue;
    n++;
    const h = grid.h[i];
    if (h >= STAND_H) {
      cost += MULT[grid.type[i]];
      gain += MULT[grid.type[i]] * h;
      standing++;
    }
  }
  return { cost, gain, net: gain - cost, standing, cells: n };
}

// Nearest valid cell centre to (x, y) (cells): the Ring's aim is clamped to
// the field's shape.
export function clampToField(grid, x, y) {
  if (inField(grid, x, y)) return [x, y];
  let best = null, bd = Infinity;
  for (let i = 0; i < grid.N; i++) {
    if (!grid.valid[i]) continue;
    const cx = (i % grid.W) + 0.5, cy = Math.floor(i / grid.W) + 0.5;
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d < bd) { bd = d; best = [cx, cy]; }
  }
  return best || [x, y];
}

// The "~N%" a button shows: the price for an average spot as a share of the
// line, at full height and the field's average mix (Full Clear shows its
// exact price instead, see World.movePrice).
export function typicalPrice(grid, kind, brushCells, line, avgMult) {
  if (line <= 0) return 0;
  if (kind === 'ring') {
    const rc = ringRadiusCells(brushCells);
    // Average over every on-field aim of the valid cells in the disc.
    let tot = 0, n = 0;
    for (let i = 0; i < grid.N; i++) {
      if (!grid.valid[i]) continue;
      tot += ringCells(grid, (i % grid.W) + 0.5, Math.floor(i / grid.W) + 0.5, rc).length;
      n++;
    }
    return n ? (tot / n) * avgMult / line : 0;
  }
  if (kind === 'line') {
    // A straight Line across the field: the corridor's rows, averaged over
    // every row a horizontal drag could run along.
    const hw = lineHalfWidthCells(brushCells);
    let tot = 0, n = 0;
    for (let r = 0; r < grid.H; r++) {
      const y = r + 0.5;
      let lo = -1, hi = -1;
      for (let c = 0; c < grid.W; c++) if (grid.valid[r * grid.W + c]) { if (lo < 0) lo = c; hi = c; }
      if (lo < 0) continue;
      tot += lineCells(grid, [[lo + 0.5, y], [hi + 0.5, y]], hw).length;
      n++;
    }
    return n ? (tot / n) * avgMult / line : 0;
  }
  let cost = 0;
  for (let i = 0; i < grid.N; i++) if (grid.valid[i]) cost += MULT[grid.type[i]];
  return cost / line;
}
