// sim/levels.mjs -- the 15 fields: shapes, mixes, pacing (k, g, par) and
// seeded placement (types, field 11's tall hedge, pre-mown stripes on 2 and 13).
//
// Polygons and mixes are the original plan's Phase 3 table (kept). k, g and
// starting par are GAME_DESIGN.md "Pacing" (tuned values: design/tuning/tuned.md).
// Pure: no DOM, no wall clock.

import { computeMask, countValid } from './mask.mjs';
import { mulberry32, fieldSeed, shuffle } from './rng.mjs';
import { TYPE_BY_KEY, MULT, T_TALL } from './types.mjs';

const sq = (n) => [[0, 0], [n, 0], [n, n], [0, n]];

// k = laps to the line, g = regrow scale, par in seconds. k and g are the
// design's table; par is the headless solver's slower 'average' time (phone or
// desktop), rounded up to 5 s, with every field's bugs in (milestone 3; see
// design/tuning/tuned.md, tools/solve-all.mjs).
export const LEVELS = Object.freeze([
  { n: 1, name: 'The Back Lawn', time: 'morning', w: 12, h: 12, polygons: [sq(12)],
    mix: { default: 1.0 }, validCells: 144, k: 1.5, g: 1.5, par: 30 },
  { n: 2, name: 'Dew Patch', time: 'morning', w: 13, h: 13, polygons: [sq(13)],
    mix: { default: 1.0 }, validCells: 169, k: 1.6, g: 1.5, par: 35, stripes: 'single' },
  { n: 3, name: 'Clover Corner', time: 'morning', w: 15, h: 15, polygons: [sq(15)],
    mix: { default: 0.8, short: 0.2 }, validCells: 225, k: 1.7, g: 1.3, par: 40 },
  { n: 4, name: 'Long Meadow', time: 'morning', w: 17, h: 19,
    polygons: [[[0, 0], [17, 0], [17, 19], [0, 19]]],
    mix: { default: 0.7, tall: 0.3 }, validCells: 323, k: 1.8, g: 1.3, par: 45 },
  { n: 5, name: 'Buttercup Field', time: 'morning', w: 19, h: 19, polygons: [sq(19)],
    mix: { default: 0.6, short: 0.2, flowered: 0.2 }, validCells: 361, k: 1.9, g: 1.2, par: 45 },
  { n: 6, name: 'The Garden Corner', time: 'afternoon', w: 21, h: 21,
    polygons: [[[0, 0], [21, 0], [21, 12], [12, 12], [12, 21], [0, 21]]],
    mix: { default: 0.6, tall: 0.2, short: 0.2 }, validCells: 360, k: 2.0, g: 1.1, par: 45 },
  { n: 7, name: 'Picnic Lawn', time: 'afternoon', w: 23, h: 23, polygons: [sq(23)],
    mix: { default: 0.5, tall: 0.2, short: 0.2, flowered: 0.1 }, validCells: 529, k: 2.2, g: 1.0, par: 55 },
  { n: 8, name: 'Butterfly Bend', time: 'afternoon', w: 25, h: 25,
    polygons: [[[0, 0], [25, 0], [25, 15], [14, 15], [14, 25], [0, 25]]],
    mix: { default: 0.5, tall: 0.25, flowered: 0.25 }, validCells: 515, k: 2.3, g: 1.0, par: 50 },
  { n: 9, name: 'Crossroads', time: 'afternoon', w: 27, h: 27,
    polygons: [[[9, 0], [18, 0], [18, 9], [27, 9], [27, 18], [18, 18], [18, 27], [9, 27], [9, 18],
      [0, 18], [0, 9], [9, 9]]],
    mix: { default: 0.5, tall: 0.2, flowered: 0.2, stiff: 0.1 }, validCells: 405, k: 2.4, g: 1.0, par: 55 },
  { n: 10, name: 'Orchard Grass', time: 'afternoon', w: 29, h: 29, polygons: [sq(29)],
    mix: { default: 0.4, tall: 0.2, short: 0.2, flowered: 0.1, stiff: 0.1 }, validCells: 841,
    k: 2.6, g: 0.95, par: 70 },
  { n: 11, name: 'Hedge Garden', time: 'golden', w: 31, h: 31,
    polygons: [[[0, 0], [31, 0], [31, 18], [18, 18], [18, 31], [0, 31]]],
    mix: { default: 0.4, tall: 0.25, flowered: 0.2, stiff: 0.15 }, validCells: 792,
    k: 2.7, g: 0.9, par: 75, hedge: true },
  { n: 12, name: 'Five-Stone Lawn', time: 'golden', w: 33, h: 33,
    polygons: [[[16, 0], [33, 12], [27, 33], [6, 33], [0, 12]]],
    mix: { default: 0.4, tall: 0.2, short: 0.2, flowered: 0.1, stiff: 0.1 }, validCells: 765,
    k: 2.8, g: 0.9, par: 70 },
  { n: 13, name: 'The Big Green', time: 'golden', w: 34, h: 34, polygons: [sq(34)],
    mix: { default: 0.3, tall: 0.25, short: 0.15, flowered: 0.2, stiff: 0.1 }, validCells: 1156,
    k: 3.0, g: 0.85, par: 90, stripes: 'alternating' },
  { n: 14, name: 'Two Islands', time: 'golden', w: 35, h: 35,
    polygons: [[[0, 0], [35, 0], [35, 20], [0, 20]], [[8, 25], [28, 25], [28, 33], [8, 33]]],
    mix: { default: 0.3, tall: 0.25, short: 0.15, flowered: 0.15, stiff: 0.15 }, validCells: 860,
    k: 3.2, g: 0.85, par: 85 },
  { n: 15, name: 'Sunset Meadow', time: 'golden', w: 36, h: 36,
    polygons: [[[6, 0], [30, 0], [36, 10], [36, 26], [30, 36], [6, 36], [0, 26], [0, 10]]],
    mix: { default: 0.25, tall: 0.25, short: 0.2, flowered: 0.15, stiff: 0.15 }, validCells: 1176,
    k: 3.5, g: 0.8, par: 100 },
].map((l) => Object.freeze(l)));

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(n) {
  const spec = LEVELS[n - 1];
  if (!spec) throw new Error(`No field ${n}`);
  return spec;
}

// Starting height of pre-mown cells (field 2's stripe, field 13's stripes).
export const PREMOWN_H = 0.05;

// Brush radius in cells when the field's shorter side sets it (layout-free):
// max(0.75 cells, 5% of the shorter side). Used for the stripe width, which the
// design defines as "one brush-width wide".
export function nominalBrushCells(spec) {
  return Math.max(0.75, 0.05 * Math.min(spec.w, spec.h));
}
export function stripeWidth(spec) {
  return Math.max(2, Math.ceil(2 * nominalBrushCells(spec)));
}

// Split vc cells into exact per-type counts (largest remainder), in mix order.
export function mixCounts(mix, vc) {
  const keys = Object.keys(mix);
  const raw = keys.map((k) => mix[k] * vc);
  const counts = raw.map(Math.floor);
  let left = vc - counts.reduce((a, b) => a + b, 0);
  const order = keys.map((_, i) => i).sort((a, b) => (raw[b] - counts[b]) - (raw[a] - counts[a]) || a - b);
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) counts[order[i]]++;
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]]));
}

// Distance from a point to a segment.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let u = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  u = Math.max(0, Math.min(1, u));
  const ex = ax + u * dx - px, ey = ay + u * dy - py;
  return Math.hypot(ex, ey);
}

// Distance of each valid cell's centre to the polygon edges that lie on the
// field's bounding box (the "outer edges"; the L's inner corner is excluded).
function outerEdgeDepth(spec, valid) {
  const { w: W, h: H } = spec;
  const edges = [];
  for (const poly of spec.polygons) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const onBox = (a[0] === b[0] && (a[0] === 0 || a[0] === W)) ||
        (a[1] === b[1] && (a[1] === 0 || a[1] === H));
      if (onBox) edges.push([a[0], a[1], b[0], b[1]]);
    }
  }
  const depth = new Float32Array(W * H).fill(Infinity);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (!valid[i]) continue;
      let d = Infinity;
      for (const e of edges) d = Math.min(d, segDist(c + 0.5, r + 0.5, e[0], e[1], e[2], e[3]));
      depth[i] = d;
    }
  }
  return depth;
}

// Build a field's starting layout: mask, types, starting heights.
// Deterministic for a given (n, seed).
export function buildField(n, seed = fieldSeed(n)) {
  const spec = getLevel(n);
  const { w: W, h: H } = spec;
  const N = W * H;
  const valid = computeMask(W, H, spec.polygons);
  const vc = countValid(valid);
  const rng = mulberry32(seed);
  const types = new Uint8Array(N);
  const h0 = new Float32Array(N);
  const premown = new Uint8Array(N);

  const cells = [];
  for (let i = 0; i < N; i++) if (valid[i]) cells.push(i);

  const counts = mixCounts(spec.mix, vc);
  const unassigned = new Set(cells);

  if (spec.hedge && counts.tall) {
    // Field 11: the tall grass lines the outer edges, nearest first; ties are
    // broken by the field's RNG so the hedge's inner edge is ragged.
    const depth = outerEdgeDepth(spec, valid);
    const jitter = new Float32Array(N);
    for (const i of cells) jitter[i] = rng();
    const byDepth = cells.slice().sort((a, b) => (depth[a] - depth[b]) || (jitter[a] - jitter[b]));
    for (let j = 0; j < counts.tall; j++) {
      types[byDepth[j]] = T_TALL;
      unassigned.delete(byDepth[j]);
    }
  }

  const bag = [];
  for (const key of Object.keys(counts)) {
    if (spec.hedge && key === 'tall') continue;
    for (let j = 0; j < counts[key]; j++) bag.push(TYPE_BY_KEY[key]);
  }
  shuffle(bag, rng);
  let b = 0;
  for (const i of cells) if (unassigned.has(i)) types[i] = bag[b++];

  // Starting heights: full, except pre-mown stripes.
  const sw = stripeWidth(spec);
  for (const i of cells) {
    const r = Math.floor(i / W);
    let mown = false;
    if (spec.stripes === 'single') {
      const start = Math.floor((H - sw) / 2);
      mown = r >= start && r < start + sw;
    } else if (spec.stripes === 'alternating') {
      mown = Math.floor(r / sw) % 2 === 1;
    }
    h0[i] = mown ? PREMOWN_H : 1;
    premown[i] = mown ? 1 : 0;
  }

  let lap = 0;
  for (const i of cells) lap += MULT[types[i]];

  return { spec, W, H, N, valid, vc, types, h0, premown, lap, avgMult: lap / vc, seed };
}
