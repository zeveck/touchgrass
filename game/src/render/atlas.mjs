// render/atlas.mjs -- the grass tuft atlas (GAME_DESIGN.md "How the grass is drawn").
//
// 6 standing shapes (the five types + loosened stiff) x 6 looks (untouched,
// ready again, resting, and three gold-glow steps; grade.mjs LOOKS) on one
// sheet canvas. Each tile is S x S device px, S = min(192, round(1.6 x cell x
// dpr)), with the tuft's base centre at (S/2, BASE_Y x S). One drawImage per
// cell. (changed) There is no flattened or squat pose any more: touched grass
// stays standing and shows that it's resting by colour and glow, not size.
//
// Where the pictures come from is a `tuftSource` with tile(shape, look, S, grade)
// returning an S x S canvas (base at S/2, BASE_Y x S):
//   makePngSource(urls)  the painted tuft PNGs (256x256, base at (128, 236)),
//                        gradient-mapped per look and time of day (default)
//   codePainter          draws every tuft in code, in the palette (fallback,
//                        and for any shape whose PNG is missing)

import { mulberry32 } from '../sim/rng.mjs';
import { STAND_H } from '../sim/grid.mjs';
import { lookColor, gradePixels, GRADES, LOOKS, LOOK_DEEP, LOOK_CARED, LOOK_YOUNG } from './grade.mjs';

const GRADE_KEYS = new Map(Object.entries(GRADES).map(([k, v]) => [v, k]));

export const SHAPE_LOOSENED = 5;
export const SHAPE_COUNT = 6;
export const BASE_Y = 236 / 256;       // base line within a tile, as a fraction of S
export const SHAPE_NAMES = Object.freeze(['default', 'tall', 'short', 'flowered', 'stiff', 'loosened']);
export const LOOK_COUNT = LOOKS.length;

// Which look a cell is drawn in, from its goldness, height and touched flag:
//   standing (h >= 0.4): untouched -> deep green; touched -> "ready again" green
//   resting (h < 0.4):   touched -> gold glow 1 (just touched) fading by thirds
//                        to the young green as it recharges; untouched (a
//                        pre-mown stripe) -> young green
export function lookIndex(gold, h, touched) {
  if (h >= STAND_H) return touched || gold > 0 ? LOOK_CARED : LOOK_DEEP;
  if (gold <= 0.6) return LOOK_YOUNG;
  const G = (gold - 0.6) / 0.4;            // 1 just touched .. 0 ready
  if (G > 0.75) return 5;
  if (G > 0.42) return 4;
  if (G > 0.1) return 3;
  return LOOK_YOUNG;
}

// How tall a tuft is drawn (a fraction of its full picture): resting grass
// a little shorter, standing grass 0.88 .. 1.0 with height. Never squat.
export const REST_SCALE = 0.84;
export function poseScale(h) {
  if (h < STAND_H) return REST_SCALE;
  return 0.88 + 0.12 * Math.min(1, (h - STAND_H) / (1 - STAND_H));
}

// Tiles are 1.6 cells across (the design's 1.5, a touch more so the painted
// tufts overlap into a lawn rather than sitting in rows).
export const TILE_CELLS = 1.6;

export function tileSize(cellCss, dpr) {
  return Math.max(8, Math.min(192, Math.round(TILE_CELLS * cellCss * Math.min(dpr, 2))));
}

// ---- colours ---------------------------------------------------------------

const INK = 'rgba(43, 42, 38, 0.95)';

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function css(c, a = 1) {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
}

function newCanvas(w, h) {
  return (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
}

// The warm glow baked into a resting tuft's tile (so it costs nothing per
// frame): a luminous sheen over the tuft itself, brightest round the tips,
// and a soft pool of warm light behind it. G: the look's glow 0..1. Call
// after the tuft is drawn.
function paintGlow(ctx, S, G) {
  if (G <= 0) return;
  const cx = S / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sy = BASE_Y * S - 0.62 * S;
  const sh = ctx.createRadialGradient(cx, sy, 0, cx, sy, 0.55 * S);
  sh.addColorStop(0, `rgba(255, 230, 130, ${0.35 * G})`);
  sh.addColorStop(1, 'rgba(255, 236, 150, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'destination-over';
  const cy = BASE_Y * S - 0.5 * S;
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.5 * S);
  gr.addColorStop(0, `rgba(255, 228, 130, ${0.75 * G})`);
  gr.addColorStop(0.5, `rgba(250, 206, 92, ${0.38 * G})`);
  gr.addColorStop(1, 'rgba(244, 211, 94, 0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

// ---- the code painter -------------------------------------------------------

// Blade sets per shape, generated once from a fixed seed so tufts are stable.
const SHAPE_PARAMS = [
  { n: 13, len: [0.42, 0.8], w: [0.09, 0.13], lean: 0.32, curve: 0.35, k: 1.0, outline: 1 },           // default
  { n: 11, len: [0.66, 0.92], w: [0.06, 0.085], lean: 0.42, curve: 0.6, k: 0.8, outline: 1 },           // tall
  { n: 9, len: [0.2, 0.36], w: [0.1, 0.14], lean: 0.32, curve: 0.2, k: 1.1, outline: 1, clover: 4 },    // short
  { n: 12, len: [0.4, 0.74], w: [0.09, 0.12], lean: 0.32, curve: 0.35, k: 1.0, outline: 1, flowers: 3 },// flowered
  { n: 14, len: [0.48, 0.86], w: [0.055, 0.075], lean: 0.16, curve: 0.04, k: 0.8, outline: 1.4 },       // stiff
  { n: 12, len: [0.4, 0.62], w: [0.06, 0.08], lean: 0.5, curve: 0.9, k: 1.22, outline: 0, side: 1 },    // loosened
];

function makeBlades(shape) {
  const p = SHAPE_PARAMS[shape];
  const rng = mulberry32(1000 + shape * 77);
  const blades = [];
  for (let j = 0; j < p.n; j++) {
    const u = p.n === 1 ? 0.5 : j / (p.n - 1);
    const spread = (u - 0.5);
    const len = p.len[0] + (p.len[1] - p.len[0]) * rng();
    const w = p.w[0] + (p.w[1] - p.w[0]) * rng();
    let tipX, tipY, ctrlX, ctrlY;
    const x0 = spread * 0.4 + (rng() - 0.5) * 0.06;
    if (p.side) {
      // Loosened stiff: bent over to one side.
      tipX = x0 + 0.18 + p.lean * (0.6 + 0.4 * rng());
      tipY = -len * (0.45 + 0.2 * rng());
      ctrlX = x0 + 0.02;
      ctrlY = -len * 0.75;
    } else {
      tipX = x0 + spread * p.lean * 2 + (rng() - 0.5) * p.lean * 0.6;
      tipY = -len;
      ctrlX = x0 + (tipX - x0) * (0.3 - p.curve * 0.2);
      ctrlY = -len * (0.55 + p.curve * 0.25);
    }
    blades.push({ x0, w, tipX, tipY, ctrlX, ctrlY, depth: rng() });
  }
  // Back blades first (smaller depth), so front ones overlap.
  blades.sort((a, b) => a.depth - b.depth);
  return blades;
}
const BLADES = SHAPE_PARAMS.map((_, s) => makeBlades(s));

function bladePath(ctx, b, S, ox, oy) {
  const bx = ox + b.x0 * S, by = oy;
  const hw = b.w * S * 0.5;
  const tx = ox + b.tipX * S, ty = oy + b.tipY * S;
  const cx = ox + b.ctrlX * S, cy = oy + b.ctrlY * S;
  ctx.beginPath();
  ctx.moveTo(bx - hw, by);
  ctx.quadraticCurveTo(cx - hw * 0.8, cy, tx, ty);
  ctx.quadraticCurveTo(cx + hw * 0.8, cy, bx + hw, by);
  ctx.closePath();
}

function paintCode(ctx, shape, look, S, ox, oy, grade) {
  const p = SHAPE_PARAMS[shape];
  const lw = Math.max(0.6, S / 70) * p.outline;
  // Tip position u: blades reach up to about 0.92 S.
  const col = (t, y) => lookColor(grade, look, t, p.k, Math.min(1, -y / 0.8));
  for (const b of BLADES[shape]) {
    bladePath(ctx, b, S, ox, oy);
    const gr = ctx.createLinearGradient(0, oy, 0, oy + Math.min(b.tipY, -0.05) * S);
    gr.addColorStop(0, css(col(0.1, 0)));
    gr.addColorStop(0.55, css(col(0.5, b.tipY * 0.55)));
    gr.addColorStop(1, css(col(0.95, b.tipY)));
    ctx.fillStyle = gr;
    ctx.fill();
    if (p.outline > 0) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
  if (p.clover) {
    // Clover trefoils on the stubble.
    const rng = mulberry32(55);
    for (let j = 0; j < p.clover; j++) {
      const cx = ox + (rng() - 0.5) * 0.42 * S;
      const cy = oy - (0.12 + 0.12 * rng()) * S;
      const r = 0.055 * S;
      ctx.fillStyle = css(mix(col(0.5, -0.2), col(0.95, -0.2), 0.35));
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw * 0.8;
      for (let q = 0; q < 3; q++) {
        const a = (q / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  if (p.flowers) {
    for (let j = 0; j < p.flowers; j++) {
      const b = BLADES[shape][BLADES[shape].length - 1 - j * 2];
      const fx = ox + b.tipX * S * 0.92, fy = oy + b.tipY * S * 0.92;
      const r = 0.06 * S;
      const petal = j % 2 === 0 ? [252, 250, 240] : [246, 214, 82];
      ctx.fillStyle = css(mix(petal, [255, 236, 170], look.glow * 0.3));
      for (let q = 0; q < 5; q++) {
        const a = (q / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * r * 0.75, fy + Math.sin(a) * r * 0.75, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = j % 2 === 0 ? 'rgb(240, 190, 60)' : 'rgb(214, 120, 40)';
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function lookOf(look) {
  return typeof look === 'number' ? LOOKS[look] : look;
}

export const codePainter = Object.freeze({
  name: 'code',
  ready: Promise.resolve(),
  tile(shape, look, S, grade) {
    look = lookOf(look);
    const c = newCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.lineJoin = 'round';
    paintCode(ctx, shape, look, S, S / 2, BASE_Y * S, grade);
    paintGlow(ctx, S, look.glow);
    return c;
  },
});

// ---- PNG tufts --------------------------------------------------------------

const STAND_K = [1.0, 0.86, 1.04, 1.0, 0.8, 1.06];

// urls: { default, tall, short, flowered, stiff, loosened } (others ignored).
export function makePngSource(urls) {
  const images = {};
  const loads = Object.entries(urls).filter(([name]) => SHAPE_NAMES.includes(name)).map(([name, url]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = () => resolve();     // fall back to the code painter for this shape
    img.src = url;
  }));
  const ready = Promise.all(loads).then(() => Object.keys(images).length);
  const cache = new Map();
  // How far up the tuft each pixel row is (0 at the base .. 1 at its top).
  const tips = new Map();
  function tipRows(name, data) {
    let t = tips.get(name);
    if (t) return t;
    let top = 236;
    for (let y = 0; y < 256 && top === 236; y++) {
      for (let x = 0; x < 256; x++) if (data[(y * 256 + x) * 4 + 3] > 24) { top = y; break; }
    }
    t = new Float32Array(256);
    const span = Math.max(1, 236 - top);
    for (let y = 0; y < 256; y++) t[y] = Math.max(0, Math.min(1, (236 - y) / span));
    tips.set(name, t);
    return t;
  }
  // The 256 px picture for a shape, graded for a look and time of day.
  function graded(shape, li, look, grade, img) {
    const key = `${shape}:${li}:${GRADE_KEYS.get(grade) || 'x'}`;
    let c = cache.get(key);
    if (c) return c;
    c = newCanvas(256, 256);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, 256, 256);
    gradePixels(id.data, grade, look, STAND_K[shape], 0, tipRows(SHAPE_NAMES[shape], id.data), 256);
    ctx.putImageData(id, 0, 0);
    cache.set(key, c);
    return c;
  }
  const sils = new Map();
  function silhouette(full) {
    let c = sils.get(full);
    if (c) return c;
    c = newCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.drawImage(full, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#2b2a26';
    ctx.fillRect(0, 0, 256, 256);
    sils.set(full, c);
    return c;
  }
  return {
    name: 'png',
    ready,
    has: (shape) => !!images[SHAPE_NAMES[shape]],
    tile(shape, li, S, grade) {
      const look = lookOf(li);
      const img = images[SHAPE_NAMES[shape]];
      if (!img) return codePainter.tile(shape, look, S, grade);
      // Grade at full size (clean ink edges), cached; then scale down once.
      const full = graded(shape, typeof li === 'number' ? li : `${look.base}${look.glow}`, look, grade, img);
      const c = newCanvas(S, S);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (S < 96) {
        // Small tiles lose the painted ink line when scaled down: put a thin
        // ink silhouette behind the tuft so it keeps its outline.
        const sil = silhouette(full);
        const o = Math.max(0.6, S / 64);
        ctx.globalAlpha = 0.85;
        for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) ctx.drawImage(sil, 0, 0, 256, 256, dx, dy, S, S);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(full, 0, 0, 256, 256, 0, 0, S, S);
      paintGlow(ctx, S, look.glow);
      return c;
    },
  };
}

// ---- the atlas sheet ---------------------------------------------------------

// On fields with small tiles (S <= 64 device px: the big fields, where there
// are the most cells), each shape is also pre-drawn at each of its heights
// (POSE_STEPS). Then a cell that isn't bending is one unscaled, pixel-aligned
// blit, which is far cheaper to raster than a resampled draw. (Big tiles keep
// one size, scaled per draw, so the sheet stays small: 6 x 17 x 192^2 x 4 B,
// about 15 MB, at worst, on fields 1 to 4 on a high-DPI desktop.)
export const POSE_STEPS = Object.freeze([0.84, 0.88, 0.92, 0.96, 1.0]);
export const STEPPED_MAX_S = 64;

// Touched cells keep a tiny blossom (daisy, buttercup, pink clover) on the
// tuft, baked into the atlas: the sheet's columns are a look with no blossom
// or with one of the three. Only the combinations that occur are built.
export const BLOSSOM_KINDS = 3;
const BLOSSOM_Y = [0.5, 0.58, 0.3, 0.5, 0.52, 0.42];   // up from the base, per shape (x S)
const BLOSSOM_X = [-0.12, 0.1, -0.02];                 // across the tuft, per kind (x S)
const BLOSSOMS = [
  { petals: 'rgb(252, 250, 240)', centre: 'rgb(240, 190, 60)', n: 6 },    // daisy
  { petals: 'rgb(246, 211, 70)', centre: 'rgb(214, 130, 40)', n: 5 },     // buttercup
  { petals: 'rgb(236, 160, 186)', centre: 'rgb(250, 220, 230)', n: 7 },   // pink clover
];
// [look, blossom kind or -1] per column.
export const COLUMNS = Object.freeze([
  [LOOK_DEEP, -1], [LOOK_YOUNG, -1],
  ...[LOOK_CARED, LOOK_YOUNG, 3, 4, 5].flatMap((li) => [0, 1, 2].map((k) => [li, k])),
]);
const COL_OF = LOOKS.map((_, li) => [-1, 0, 1, 2].map((k) => {
  let j = COLUMNS.findIndex(([l, b]) => l === li && b === k);
  if (j < 0) j = COLUMNS.findIndex(([l, b]) => l === li && b === 0);   // touched looks always blossom
  if (j < 0) j = COLUMNS.findIndex(([l]) => l === li);
  return j;
}));
export function columnOf(li, kind) {
  return COL_OF[li][kind + 1];
}

// The three blossoms side by side, painted once per atlas into a small
// sprite (b px each) and stamped onto the tiles.
function blossomSprite(S) {
  const r = Math.max(2, 0.1 * S), o = Math.max(0.6, S / 70);
  const b = Math.ceil(2 * (r + o)) + 2;
  const c = newCanvas(b * BLOSSOM_KINDS, b);
  const ctx = c.getContext('2d');
  BLOSSOMS.forEach((f, k) => {
    const cx = k * b + b / 2, cy = b / 2;
    ctx.fillStyle = 'rgba(43, 42, 38, 0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, r + o, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = f.petals;
    for (let q = 0; q < f.n; q++) {
      const a = (q / f.n) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = f.centre;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2); ctx.fill();
  });
  return { c, b };
}

function paintBlossom(ctx, sprite, kind, shape, S) {
  const { c, b } = sprite;
  ctx.drawImage(c, kind * b, 0, b, b, BLOSSOM_X[kind] * S - b / 2, -BLOSSOM_Y[shape] * S - b / 2, b, b);
}

export function poseStep(scale) {
  return Math.max(0, Math.min(POSE_STEPS.length - 1, Math.round((scale - POSE_STEPS[0]) / 0.04)));
}

export function buildAtlas(source, S, grade = GRADES.afternoon) {
  const stepped = S <= STEPPED_MAX_S;
  const cols = COLUMNS.length;
  const rowOf = [];        // rowOf[shape][stepIndex] -> sheet row
  const plan = [];         // [shape, scale]
  for (let shape = 0; shape < SHAPE_COUNT; shape++) {
    const steps = stepped ? POSE_STEPS : [1];
    rowOf[shape] = [];
    for (const k of steps) {
      rowOf[shape].push(plan.length);
      plan.push([shape, k]);
    }
  }
  const rows = plan.length;
  const canvas = newCanvas(S * cols, S * rows);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const tiles = new Map();
  const sprite = blossomSprite(S);
  const tileFor = (shape, li, kind = -1) => {
    const key = (shape * 10 + li) * 4 + kind + 1;
    if (!tiles.has(key)) {
      let t;
      if (kind < 0) t = source.tile(shape, li, S, grade);
      else {
        // The look's tile with its blossom, as one tile (stamping blossoms
        // straight into the big sheet crashed WebKit's page on unload).
        t = newCanvas(S, S);
        const tc = t.getContext('2d');
        tc.drawImage(tileFor(shape, li), 0, 0);
        tc.translate(S / 2, BASE_Y * S);
        paintBlossom(tc, sprite, kind, shape, S);
      }
      tiles.set(key, t);
    }
    return tiles.get(key);
  };
  plan.forEach(([shape, k], row) => {
    for (let col = 0; col < cols; col++) {
      const [li, kind] = COLUMNS[col];
      ctx.save();
      ctx.beginPath();
      ctx.rect(col * S, row * S, S, S);
      ctx.clip();
      ctx.translate(col * S + S / 2, row * S + BASE_Y * S);
      ctx.scale(1, k);
      ctx.drawImage(tileFor(shape, li, kind), -S / 2, -BASE_Y * S);
      ctx.restore();
    }
  });
  return { canvas, S, cols, rows, rowOf, stepped, source: source.name };
}
