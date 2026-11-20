// render/grade.mjs -- the grass colour grade (GAME_DESIGN.md "Time-of-day
// grade"). Pure (pixel arrays in, pixel arrays out), so it's unit-tested.
//
// Each grass pixel is gradient-mapped by its lightness onto a ramp that mixes
// the GREEN ramp (untouched) with the GOLD ramp (just swept) by the cell's
// goldness. The time of day changes only value and highlight warmth:
//   - the green ramp's hue never goes warmer than about 100 deg (yellow-green),
//   - the gold ramp gets paler and warmer at golden hour,
// so green and gold always stay apart. Ink outlines and non-grass colours
// (flowers, seed heads) keep their own colours.

export const GRADES = Object.freeze({
  morning: Object.freeze({
    green: [[20, 62, 42], [52, 114, 62], [112, 178, 108]],
    gold: [[160, 104, 30], [232, 176, 62], [252, 226, 136]],
    soil: { tint: [70, 90, 120], alpha: 0.10, value: 1.0 },
  }),
  afternoon: Object.freeze({
    green: [[24, 66, 36], [58, 118, 54], [118, 180, 98]],
    gold: [[166, 108, 30], [236, 180, 62], [254, 230, 138]],
    soil: { tint: [0, 0, 0], alpha: 0, value: 1.0 },
  }),
  golden: Object.freeze({
    green: [[26, 66, 34], [62, 118, 50], [120, 182, 92]],
    gold: [[184, 116, 34], [250, 190, 76], [255, 238, 160]],
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

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Colour at lightness position t (0 dark .. 1 light), goldness gold, value k.
export function rampColor(grade, gold, t, k = 1) {
  const pick = (r) => (t < 0.5 ? lerp3(r[0], r[1], t * 2) : lerp3(r[1], r[2], (t - 0.5) * 2));
  const c = lerp3(pick(grade.green), pick(grade.gold), gold);
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}

const INK_L = 0.17;     // darker than this is outline: kept
const TOP_L = 0.86;

// Grade RGBA pixels in place. k darkens or lightens the whole tuft (tall
// grass is darker, for example). lift (0..1) raises the darkest tones, so
// flattened mats always stay lighter than the soil under them.
export function gradePixels(data, grade, gold, k = 1, lift = 0) {
  // Precompute 64 ramp entries.
  const N = 64;
  const lut = new Float32Array(N * 3);
  for (let j = 0; j < N; j++) {
    const c = rampColor(grade, gold, j / (N - 1), k);
    lut[j * 3] = c[0]; lut[j * 3 + 1] = c[1]; lut[j * 3 + 2] = c[2];
  }
  const warm = rampColor(grade, 1, 0.75, 1);
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
      // Flowers, seed heads, highlights: keep them, warmed a little with gold.
      const w = 0.25 * gold;
      data[p] = r + (warm[0] - r) * w;
      data[p + 1] = g + (warm[1] - g) * w;
      data[p + 2] = b + (warm[2] - b) * w;
      continue;
    }
    let t = (L - INK_L) / (TOP_L - INK_L);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    t = lift + (1 - lift) * t;
    const j = Math.round(t * (N - 1)) * 3;
    data[p] = lut[j]; data[p + 1] = lut[j + 1]; data[p + 2] = lut[j + 2];
  }
  return data;
}
