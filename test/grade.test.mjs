// test/grade.test.mjs -- the grass colour grade: green never warmer than
// ~100 deg, gold stays apart from green under every time of day, ink and
// flowers keep their colours, flattened mats lift above the soil.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GRADES, gradeFor, hueOf, rampColor, gradePixels } from '../game/src/render/grade.mjs';

const TIMES = ['morning', 'afternoon', 'golden'];
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('grade: the green ramp never goes warmer than ~100 deg at any time of day', () => {
  for (const t of TIMES) {
    for (let j = 0; j <= 20; j++) {
      const c = rampColor(GRADES[t], 0, j / 20);
      assert.ok(hueOf(c) >= 99.5, `${t} t=${j / 20}: hue ${hueOf(c).toFixed(1)}`);
    }
  }
});

test('grade: untouched, touched (0.4) and just swept (1.0) are far apart under every grade', () => {
  for (const t of TIMES) {
    const g = GRADES[t];
    const u = rampColor(g, 0, 0.6), touched = rampColor(g, 0.4, 0.6), swept = rampColor(g, 1, 0.6);
    assert.ok(dist(u, touched) > 40, `${t}: untouched vs touched ${dist(u, touched).toFixed(0)}`);
    assert.ok(dist(touched, swept) > 40, `${t}: touched vs swept ${dist(touched, swept).toFixed(0)}`);
    assert.ok(hueOf(swept) < 50, `${t}: swept is gold (${hueOf(swept).toFixed(0)} deg)`);
  }
  // Golden hour's gold is paler and warmer than the afternoon's.
  assert.ok(lum(rampColor(GRADES.golden, 1, 0.6)) > lum(rampColor(GRADES.afternoon, 1, 0.6)));
  assert.equal(gradeFor('nope'), GRADES.afternoon);
});

test('grade: gradePixels maps grass, keeps ink outlines, transparency and flowers', () => {
  const px = Uint8ClampedArray.from([
    90, 170, 70, 255,     // light grass green
    20, 20, 18, 255,      // ink
    250, 250, 240, 255,   // white petal
    90, 170, 70, 0,       // transparent
  ]);
  gradePixels(px, GRADES.afternoon, 1);
  assert.ok(hueOf([px[0], px[1], px[2]]) < 55, 'grass turned gold');
  assert.deepEqual([px[4], px[5], px[6]], [20, 20, 18], 'ink kept');
  assert.ok(px[8] > 230 && px[9] > 220, 'petal stays light');
  assert.deepEqual([px[12], px[13], px[14], px[15]], [90, 170, 70, 0], 'transparent untouched');
});

test('grade: lift keeps flattened mats lighter than their darkest tones', () => {
  const a = Uint8ClampedArray.from([40, 70, 35, 255]);
  const b = Uint8ClampedArray.from([40, 70, 35, 255]);
  gradePixels(a, GRADES.golden, 1, 1, 0);
  gradePixels(b, GRADES.golden, 1, 1, 0.3);
  assert.ok(lum([b[0], b[1], b[2]]) > lum([a[0], a[1], a[2]]) + 20);
});
