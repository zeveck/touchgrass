// render/atlas.mjs -- the grass tuft atlas (GAME_DESIGN.md "How the grass is drawn").
//
// 11 shapes (6 standing: the five types + loosened stiff; 5 flattened tints)
// x 5 goldness steps (0, 0.4, 0.6, 0.8, 1.0) = 55 tiles on one sheet canvas.
// Each tile is S x S device px, S = min(192, round(1.5 x cell x dpr)), with the
// tuft's base centre at (S/2, BASE_Y x S). One drawImage per cell.
//
// Where the pictures come from is a `tuftSource`:
//   codePainter          draws every tuft in code, in the palette (default)
//   makePngSource(urls)  uses tuft PNGs (256x256, base at (128, 236)) for the
//                        shapes it has, and the code painter for the rest.

import { mulberry32 } from '../sim/rng.mjs';

export const GOLD_STEPS = Object.freeze([0, 0.4, 0.6, 0.8, 1.0]);
export const SHAPE_LOOSENED = 5;
export const SHAPE_FLAT0 = 6;          // + type id
export const SHAPE_COUNT = 11;
export const BASE_Y = 236 / 256;       // base line within a tile, as a fraction of S
export const SHAPE_NAMES = Object.freeze([
  'default', 'tall', 'short', 'flowered', 'stiff', 'loosened',
  'flat-default', 'flat-tall', 'flat-short', 'flat-flowered', 'flat-stiff',
]);

export function goldStepIndex(g) {
  // Nearest of 0, 0.4, 0.6, 0.8, 1.0.
  if (g < 0.2) return 0;
  if (g < 0.5) return 1;
  if (g < 0.7) return 2;
  if (g < 0.9) return 3;
  return 4;
}

export function tileSize(cellCss, dpr) {
  return Math.max(8, Math.min(192, Math.round(1.5 * cellCss * Math.min(dpr, 2))));
}

// ---- colours ---------------------------------------------------------------

// Green ramp (never warmer than ~100 deg hue) and gold ramp, dark/mid/light.
const GREEN = [[38, 92, 44], [86, 148, 62], [142, 194, 98]];
const GOLD = [[170, 118, 36], [228, 180, 72], [250, 226, 140]];
const INK = 'rgba(43, 42, 38, 0.95)';

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function shade(c, k) {
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}
function css(c, a = 1) {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
}
function ramp(gold, k = 1) {
  return [0, 1, 2].map((j) => shade(mix(GREEN[j], GOLD[j], gold), k));
}

// ---- the code painter -------------------------------------------------------

// Blade sets per shape, generated once from a fixed seed so tufts are stable.
const SHAPE_PARAMS = [
  // standing
  { n: 13, len: [0.42, 0.8], w: [0.09, 0.13], lean: 0.32, curve: 0.35, k: 1.0, outline: 1 },           // default
  { n: 11, len: [0.66, 0.92], w: [0.06, 0.085], lean: 0.42, curve: 0.6, k: 0.8, outline: 1 },           // tall
  { n: 9, len: [0.2, 0.36], w: [0.1, 0.14], lean: 0.32, curve: 0.2, k: 1.1, outline: 1, clover: 4 },    // short
  { n: 12, len: [0.4, 0.74], w: [0.09, 0.12], lean: 0.32, curve: 0.35, k: 1.0, outline: 1, flowers: 3 },// flowered
  { n: 14, len: [0.48, 0.86], w: [0.055, 0.075], lean: 0.16, curve: 0.04, k: 0.8, outline: 1.4 },       // stiff
  { n: 12, len: [0.4, 0.62], w: [0.06, 0.08], lean: 0.5, curve: 0.9, k: 1.22, outline: 0, side: 1 },    // loosened
  // flattened mats (lying blades, tinted per type)
  { n: 11, len: [0.3, 0.46], w: [0.11, 0.15], lean: 0, curve: 0.2, k: 1.0, outline: 0.7, flat: 1 },
  { n: 10, len: [0.4, 0.56], w: [0.08, 0.11], lean: 0, curve: 0.25, k: 0.82, outline: 0.7, flat: 1 },
  { n: 10, len: [0.18, 0.28], w: [0.12, 0.16], lean: 0, curve: 0.1, k: 1.1, outline: 0.7, flat: 1 },
  { n: 11, len: [0.3, 0.46], w: [0.11, 0.15], lean: 0, curve: 0.2, k: 1.0, outline: 0.7, flat: 1, flecks: 4 },
  { n: 12, len: [0.32, 0.48], w: [0.07, 0.09], lean: 0, curve: 0.05, k: 0.72, outline: 0.9, flat: 1 },
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
    const x0 = spread * (p.flat ? 0.5 : 0.4) + (rng() - 0.5) * 0.06;
    if (p.flat) {
      // Lying blades fan out sideways, close to the ground.
      const dir = j % 2 === 0 ? -1 : 1;
      const ang = (0.06 + 0.14 * rng()) * Math.PI;   // 11..36 deg above horizontal
      tipX = x0 + dir * Math.cos(ang) * len;
      tipY = -Math.sin(ang) * len - 0.02;
      ctrlX = x0 + dir * len * 0.45;
      ctrlY = tipY * 0.4 - p.curve * 0.05;
    } else if (p.side) {
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

function paintCode(ctx, shape, gold, S, ox, oy) {
  const p = SHAPE_PARAMS[shape];
  const [dark, mid, light] = ramp(gold, p.k);
  const lw = Math.max(0.6, S / 70) * p.outline;
  if (p.flat) {
    // A low mat under the lying blades gives the flattened tuft some body.
    ctx.beginPath();
    ctx.ellipse(ox, oy - 0.07 * S, 0.44 * S, 0.15 * S, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(mix(dark, mid, 0.6));
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = 'rgba(43, 42, 38, 0.6)';
    ctx.stroke();
  }
  for (const b of BLADES[shape]) {
    bladePath(ctx, b, S, ox, oy);
    const gr = ctx.createLinearGradient(0, oy, 0, oy + Math.min(b.tipY, -0.05) * S);
    gr.addColorStop(0, css(dark));
    gr.addColorStop(0.55, css(mid));
    gr.addColorStop(1, css(light));
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
      ctx.fillStyle = css(mix(mid, light, 0.35));
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
  if (p.flowers || p.flecks) {
    const rng = mulberry32(91 + shape);
    const n = p.flowers || p.flecks;
    for (let j = 0; j < n; j++) {
      let fx, fy;
      if (p.flowers) {
        const b = BLADES[shape][BLADES[shape].length - 1 - j * 2];
        fx = ox + b.tipX * S * 0.92; fy = oy + b.tipY * S * 0.92;
      } else {
        fx = ox + (rng() - 0.5) * 0.6 * S; fy = oy - (0.03 + 0.08 * rng()) * S;
      }
      const r = (p.flowers ? 0.06 : 0.035) * S;
      const petal = j % 2 === 0 ? [252, 250, 240] : [246, 214, 82];
      ctx.fillStyle = css(mix(petal, [250, 236, 180], gold * 0.3));
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

export const codePainter = Object.freeze({
  name: 'code',
  ready: Promise.resolve(),
  // Paint one tile: shape, goldness, tile size S, base at (ox, oy) in ctx.
  paint(ctx, shape, gold, S, ox, oy) {
    paintCode(ctx, shape, gold, S, ox, oy);
  },
});

// ---- PNG tufts --------------------------------------------------------------

// shapeUrls: { default: 'assets/tufts/default.png', stiff: '...', ... } keyed by
// SHAPE_NAMES. Missing shapes fall back to the code painter. The gold steps
// are made in code by tinting toward the gold ramp.
export function makePngSource(shapeUrls) {
  const images = {};
  const loads = Object.entries(shapeUrls).map(([name, url]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = () => resolve();     // fall back to code for this shape
    img.src = url;
  }));
  let scratch = null;
  return {
    name: 'png',
    ready: Promise.all(loads),
    paint(ctx, shape, gold, S, ox, oy) {
      const img = images[SHAPE_NAMES[shape]];
      if (!img) { paintCode(ctx, shape, gold, S, ox, oy); return; }
      // Draw the PNG with its base (128, 236) on (ox, oy), then tint toward gold.
      const k = S / 256;
      if (!scratch || scratch.width !== S) {
        scratch = (typeof OffscreenCanvas !== 'undefined')
          ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
        scratch.width = S; scratch.height = S;
      }
      const sc = scratch.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.clearRect(0, 0, S, S);
      sc.globalCompositeOperation = 'source-over';
      sc.drawImage(img, 0, 0, 256, 256, 0, 0, S, S);
      if (gold > 0) {
        sc.globalCompositeOperation = 'source-atop';
        sc.fillStyle = css(GOLD[1], 0.25 + 0.5 * gold);
        sc.fillRect(0, 0, S, S);
        sc.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(scratch, ox - 128 * k, oy - 236 * k);
    },
  };
}

// ---- the atlas sheet ---------------------------------------------------------

// On fields with small tiles (S <= 64 device px: the big fields, where there
// are the most cells), each shape is also pre-drawn at a few sizes: standing
// tufts at heights 0.6..1.0 and flattened ones at 70..100%. Then a cell that
// isn't bending is one unscaled, pixel-aligned blit, which is far cheaper to
// raster than a resampled draw. (Big tiles keep one size, scaled per draw, so
// the sheet stays small: 55 x 192^2 x 4 B, about 8 MB, at worst.)
export const STAND_STEPS = Object.freeze([0.6, 0.7, 0.8, 0.9, 1.0]);
export const FLAT_STEPS = Object.freeze([0.7, 0.8, 0.9, 1.0]);
export const STEPPED_MAX_S = 64;

export function buildAtlas(source, S) {
  const stepped = S <= STEPPED_MAX_S;
  const cols = GOLD_STEPS.length;
  const rowOf = [];        // rowOf[shape][stepIndex] -> sheet row
  const plan = [];         // [shape, sx, sy]
  for (let shape = 0; shape < SHAPE_COUNT; shape++) {
    const flat = shape >= SHAPE_FLAT0;
    const steps = stepped ? (flat ? FLAT_STEPS : STAND_STEPS) : [1];
    rowOf[shape] = [];
    for (const k of steps) {
      rowOf[shape].push(plan.length);
      plan.push([shape, flat ? k : 1, k]);
    }
  }
  const rows = plan.length;
  const canvas = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(S * cols, S * rows)
    : Object.assign(document.createElement('canvas'), { width: S * cols, height: S * rows });
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  plan.forEach(([shape, kx, ky], row) => {
    for (let g = 0; g < cols; g++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(g * S, row * S, S, S);
      ctx.clip();
      ctx.translate(g * S + S / 2, row * S + BASE_Y * S);
      ctx.scale(kx, ky);
      source.paint(ctx, shape, GOLD_STEPS[g], S, 0, 0);
      ctx.restore();
    }
  });
  return { canvas, S, cols, rows, rowOf, stepped, source: source.name };
}
