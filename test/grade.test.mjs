// test/grade.test.mjs -- the grass colour grade: green never warmer than
// ~100 deg, gold stays apart from green under every time of day, ink and
// flowers keep their colours, flattened mats lift above the soil.
// (changed) Touching makes grass happier: no look is brown, beige or greyed,
// the gold is a rich honey-to-buttercup, and no state is drawn squat.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GRADES, gradeFor, hueOf, hslOf, rampColor, gradePixels, lookColor, LOOKS, goldWeight } from '../game/src/render/grade.mjs';
import { lookIndex, poseScale, REST_SCALE, SHAPE_COUNT, SHAPE_NAMES, POSE_STEPS } from '../game/src/render/atlas.mjs';
import { STAND_H } from '../game/src/sim/grid.mjs';

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

test('grade: the gold ramp is a rich honey-to-buttercup, never desaturated straw or brown', () => {
  for (const t of TIMES) {
    for (let j = 0; j <= 20; j++) {
      const c = lookColor(GRADES[t], LOOKS[5], j / 20);
      const { h, s, l } = hslOf(c);
      assert.ok(h >= 34 && h <= 55, `${t} t=${j / 20}: gold hue ${h.toFixed(0)}`);
      assert.ok(s >= 0.6, `${t} t=${j / 20}: gold saturation ${s.toFixed(2)}`);
      assert.ok(l >= 0.45, `${t} t=${j / 20}: gold lightness ${l.toFixed(2)} (brown below)`);
    }
    // The design's honey #e7b84a and buttercup #f4d35e are on the ramp's light half.
    const mid = lookColor(GRADES[t], LOOKS[5], 0.5), light = lookColor(GRADES[t], LOOKS[5], 1);
    assert.ok(Math.hypot(mid[0] - 231, mid[1] - 184, mid[2] - 74) < 30, `${t}: mid near honey ${mid.map(Math.round)}`);
    assert.ok(Math.hypot(light[0] - 244, light[1] - 211, light[2] - 94) < 40, `${t}: light near buttercup ${light.map(Math.round)}`);
  }
});

test('grade: every look at every tip position stays healthy (no brown, beige or grey states)', () => {
  for (const t of TIMES) {
    for (const look of LOOKS) {
      for (let u = 0; u <= 1.0001; u += 0.1) {
        for (let j = 2; j <= 20; j++) {        // the darkest tones are shading next to the ink
          const c = lookColor(GRADES[t], look, j / 20, 1, u);
          const { h, s, l } = hslOf(c);
          const where = `${t} ${look.name} u=${u.toFixed(1)} t=${j / 20}: ${c.map(Math.round)}`;
          // Greens may be calm, never grey; warm hues (gold) must be vivid
          // and light: dark or dull warm colours read as brown, straw, dead.
          assert.ok(s >= 0.25, `${where} saturation ${s.toFixed(2)}`);
          if (h < 70) {
            assert.ok(s >= 0.5, `${where} warm saturation ${s.toFixed(2)}`);
            assert.ok(l >= 0.42, `${where} lightness ${l.toFixed(2)}`);
          }
          assert.ok(h >= 34 && h <= 160, `${where} hue ${h.toFixed(0)}`);
        }
      }
    }
  }
});

test('grade: touched grass that is ready again is livelier than untouched; resting is lighter still', () => {
  for (const t of TIMES) {
    const g = GRADES[t];
    const deep = lookColor(g, LOOKS[0], 0.6), cared = lookColor(g, LOOKS[1], 0.6), young = lookColor(g, LOOKS[2], 0.6);
    assert.ok(hslOf(cared).l > hslOf(deep).l + 0.05, `${t}: cared lighter than untouched`);
    assert.ok(hslOf(cared).s >= hslOf(deep).s, `${t}: cared at least as vivid`);
    assert.ok(hslOf(young).l > hslOf(cared).l, `${t}: resting green is lighter`);
    // Golden hour keeps untouched grass green, not olive.
    for (let j = 0; j <= 20; j++) assert.ok(hueOf(lookColor(g, LOOKS[0], j / 20)) >= 99.5);
  }
  // The gold sits on the tips: full glow covers most of the tuft, a fading
  // glow only the tips.
  assert.ok(goldWeight(1, 0.4) > 0.9 && goldWeight(1 / 3, 0.4) < 0.05 && goldWeight(1 / 3, 1) > 0.5);
  assert.equal(goldWeight(0, 1), 0);
});

test('looks: untouched / just touched / recharging / ready again are four different looks', () => {
  // Sim states: untouched standing; just swept (h 0, gold 1); recharging
  // (gold = 1 - h); ready again (standing, gold at its 0.4 floor).
  assert.equal(lookIndex(0, 1, false), 0);
  assert.equal(lookIndex(1, 0, true), 5);
  const mid = lookIndex(1 - 0.2, 0.2, true);
  assert.ok(mid === 3 || mid === 4, `recharging look ${mid}`);
  assert.equal(lookIndex(0.4, 0.8, true), 1);
  assert.equal(lookIndex(0.6, STAND_H, true), 1);          // ready again the moment it stands
  assert.equal(lookIndex(0, 0.2, false), 2);               // a pre-mown stripe, not touched yet
  // The glow fades monotonically as the grass recharges.
  let last = 9;
  for (let h = 0; h < STAND_H; h += 0.01) {
    const li = lookIndex(1 - h, h, true);
    const rank = li === 2 ? 2 : li;
    assert.ok(rank <= last, `glow went up at h=${h}`);
    last = rank;
  }
});

test('pose: no state is drawn squat or lying down', () => {
  assert.equal(SHAPE_COUNT, 6);
  assert.ok(!SHAPE_NAMES.some((n) => /flat/.test(n)), 'no flattened shapes in the atlas');
  for (let h = 0; h <= 1.0001; h += 0.01) {
    const s = poseScale(h);
    assert.ok(s >= 0.84 && s <= 1, `h=${h.toFixed(2)}: scale ${s}`);
  }
  assert.equal(poseScale(0), REST_SCALE);
  assert.equal(poseScale(1), 1);
  assert.ok(POSE_STEPS[0] >= 0.84);
});
