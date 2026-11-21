// render/grade.mjs -- the grass colour grade (GAME_DESIGN.md "Time-of-day
// grade", "How the grass is drawn"). Pure (pixel arrays in, pixel arrays
// out), so it's unit-tested.
//
// (changed) Touching makes the grass happier, never "dead": every look is a
// healthy, saturated colour. Each grass pixel is gradient-mapped by its
// lightness onto one of three greens, and then, on a touched cell that is
// still resting, blended toward a luminous honey-to-buttercup GOLD ramp,
// strongest at the blade tips (u = how far up the tuft the pixel is):
//   - DEEP   untouched, ready grass: a deeper, calmer green,
//   - CARED  touched grass that is ready again: a brighter, livelier green,
//   - YOUNG  resting grass (not ready yet): a light spring green,
//   - glow   0..1 on resting touched grass: gold over the tips, fading to
//            YOUNG as the grass recharges.
// The time of day changes only value and highlight warmth: the greens' hue
// never goes warmer than about 100 deg, so green and gold always stay apart.
// Ink outlines and non-grass colours (flowers, seed heads) keep their own
// colours.

export const GRADES = Object.freeze({
  morning: Object.freeze({
    green: [[20, 62, 42], [52, 114, 62], [112, 178, 108]],
    cared: [[26, 82, 50], [80, 160, 76], [150, 214, 120]],
    young: [[48, 118, 58], [116, 186, 88], [190, 232, 146]],
    gold: [[208, 150, 46], [234, 188, 78], [250, 220, 112]],
    soil: { tint: [70, 90, 120], alpha: 0.10, value: 1.0 },
  }),
  afternoon: Object.freeze({
    green: [[24, 66, 36], [58, 118, 54], [118, 180, 98]],
    cared: [[30, 86, 42], [86, 162, 64], [156, 214, 106]],
    young: [[52, 120, 50], [122, 188, 78], [194, 232, 136]],
    gold: [[212, 146, 40], [231, 184, 74], [248, 214, 100]],
    soil: { tint: [0, 0, 0], alpha: 0, value: 1.0 },
  }),
  golden: Object.freeze({
    green: [[22, 66, 38], [54, 120, 54], [112, 182, 96]],
    cared: [[28, 88, 44], [80, 164, 64], [150, 216, 104]],
    young: [[50, 122, 50], [118, 190, 76], [188, 232, 132]],
    gold: [[222, 144, 42], [246, 190, 80], [254, 224, 120]],
    soil: { tint: [120, 60, 30], alpha: 0.16, value: 0.92 },
  }),
});

export function gradeFor(time) {
  return GRADES[time] || GRADES.afternoon;
}

// Hue in degrees (0..360) of an [r, g, b] colour.
export function hueOf([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// HSL saturation and lightness (0..1) of an [r, g, b] colour.
export function hslOf([r, g, b]) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: hueOf([r, g, b]), s, l };
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const pick = (r, t) => (t < 0.5 ? lerp3(r[0], r[1], t * 2) : lerp3(r[1], r[2], (t - 0.5) * 2));
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rgbToHsl([r, g, b]) {
  const { h, s, l } = hslOf([r, g, b]);
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// Mix two colours through hue, saturation and lightness, so green-to-gold
// passes through a fresh lime rather than a greyed olive.
function mixHsl(a, b, t) {
  const A = rgbToHsl(a), B = rgbToHsl(b);
  return hslToRgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

// The looks a tuft can be drawn in (the atlas columns).
export const LOOK_DEEP = 0, LOOK_CARED = 1, LOOK_YOUNG = 2;
export const LOOKS = Object.freeze([
  Object.freeze({ name: 'untouched', base: 'green', glow: 0 }),
  Object.freeze({ name: 'ready again', base: 'cared', glow: 0 }),
  Object.freeze({ name: 'resting', base: 'young', glow: 0 }),
  Object.freeze({ name: 'glow 1/3', base: 'young', glow: 1 / 3 }),
  Object.freeze({ name: 'glow 2/3', base: 'young', glow: 2 / 3 }),
  Object.freeze({ name: 'just touched', base: 'young', glow: 1 }),
]);

// How much gold a pixel at tip position u (0 base .. 1 tip) gets at glow G:
// at full glow nearly the whole tuft is gold over a green base; as it fades
// the gold retreats to the tips and softens.
export function goldWeight(G, u = 1) {
  if (G <= 0) return 0;
  const lo = 0.02 + 0.75 * (1 - G);
  return (0.45 + 0.55 * G) * smooth(lo, lo + 0.35, u);
}

// Colour of a look at lightness t (0 dark .. 1 light), value k, tip position u.
export function lookColor(grade, look, t, k = 1, u = 1) {
  let c = pick(grade[look.base], t);
  const w = goldWeight(look.glow, u);
  if (w > 0) c = mixHsl(c, pick(grade.gold, t), w);
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}

// The look for a goldness value (kept for the old callers and tests):
// 0 untouched, 0.4..0.6 touched and ready again, above 0.6 resting with a
// glow that is 1 at goldness 1 (just touched).
export function lookForGold(gold) {
  if (gold <= 0) return LOOKS[LOOK_DEEP];
  if (gold <= 0.6) return LOOKS[LOOK_CARED];
  return { base: 'young', glow: Math.min(1, (gold - 0.6) / 0.4) };
}

export function rampColor(grade, gold, t, k = 1, u = 1) {
  return lookColor(grade, lookForGold(gold), t, k, u);
}

const INK_L = 0.17;     // darker than this is outline: kept
const TOP_L = 0.86;

// Grade RGBA pixels in place for a look (or a goldness number). k darkens or
// lightens the whole tuft (tall grass is darker, for example). lift (0..1)
// raises the darkest tones. tip (optional, one value per pixel row, with
// `width` pixels a row) is how far up the tuft each row is (0 base .. 1 tip);
// without it every pixel counts as a tip.
export function gradePixels(data, grade, look, k = 1, lift = 0, tip = null, width = 256) {
  if (typeof look === 'number') look = lookForGold(look);
  const N = 64;
  const rows = tip ? 17 : 1;          // tip position quantised to 17 levels
  const lut = new Float32Array(rows * N * 3);
  for (let q = 0; q < rows; q++) {
    const u = tip ? q / (rows - 1) : 1;
    for (let j = 0; j < N; j++) {
      const c = lookColor(grade, look, j / (N - 1), k, u);
      const o = (q * N + j) * 3;
      lut[o] = c[0]; lut[o + 1] = c[1]; lut[o + 2] = c[2];
    }
  }
  const warm = pick(grade.gold, 0.8);
  const wf = 0.3 * look.glow;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 0) continue;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (L < INK_L) continue;                          // ink outline
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const h = hueOf([r, g, b]);
    const grassy = h >= 55 && h <= 175 && sat > 0.12;
    if (!grassy) {
      // Flowers, seed heads, highlights: keep them, warmed a little by the glow.
      data[p] = r + (warm[0] - r) * wf;
      data[p + 1] = g + (warm[1] - g) * wf;
      data[p + 2] = b + (warm[2] - b) * wf;
      continue;
    }
    let t = (L - INK_L) / (TOP_L - INK_L);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    t = lift + (1 - lift) * t;
    let q = 0;
    if (tip) {
      const u = tip[((p >> 2) / width) | 0];
      q = Math.round((u < 0 ? 0 : u > 1 ? 1 : u) * (rows - 1));
    }
    const j = (q * N + Math.round(t * (N - 1))) * 3;
    data[p] = lut[j]; data[p + 1] = lut[j + 1]; data[p + 2] = lut[j + 2];
  }
  return data;
}
