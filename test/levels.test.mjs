// test/levels.test.mjs -- the 15 fields: masks (valid counts from the
// original plan's table), seeded placement, mixes, stripes, hedge, pacing table.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pointInPolygon, computeMask, countValid } from '../game/src/sim/mask.mjs';
import {
  LEVELS, LEVEL_COUNT, buildField, mixCounts, stripeWidth, PREMOWN_H, getLevel,
} from '../game/src/sim/levels.mjs';
import { T_TALL, TYPE_BY_KEY, MULT } from '../game/src/sim/types.mjs';

// From plans/touch-grass.md, Phase 3 progression table.
const PLAN_VALID = [144, 169, 225, 323, 361, 360, 529, 515, 405, 841, 792, 765, 1156, 860, 1176];

test('levels: there are 15 fields', () => {
  assert.equal(LEVEL_COUNT, 15);
  LEVELS.forEach((l, j) => assert.equal(l.n, j + 1));
});

test('levels: valid-cell counts match the plan for all 15 fields', () => {
  for (const l of LEVELS) {
    const valid = computeMask(l.w, l.h, l.polygons);
    assert.equal(countValid(valid), PLAN_VALID[l.n - 1], `field ${l.n}`);
    assert.equal(l.validCells, PLAN_VALID[l.n - 1]);
  }
});

test('mask: point in polygon (square, L notch, pentagon)', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(pointInPolygon(5, 5, sq), true);
  assert.equal(pointInPolygon(15, 5, sq), false);
  const L = getLevel(6).polygons[0];
  assert.equal(pointInPolygon(5, 5, L), true);
  assert.equal(pointInPolygon(16.5, 16.5, L), false, 'the notch is outside');
  const pent = getLevel(12).polygons[0];
  assert.equal(pointInPolygon(16.5, 16.5, pent), true);
  assert.equal(pointInPolygon(0.5, 0.5, pent), false);
  assert.equal(pointInPolygon(32.5, 32.5, pent), false);
});

test('mask: two islands are a union with a gap between them (field 14)', () => {
  const l = getLevel(14);
  assert.equal(l.polygons.length, 2);
  const valid = computeMask(l.w, l.h, l.polygons);
  const at = (x, y) => valid[Math.floor(y) * l.w + Math.floor(x)];
  assert.equal(at(17, 10), 1, 'main');
  assert.equal(at(18, 29), 1, 'island');
  assert.equal(at(18, 23), 0, 'gap');
});

test('levels: placement is deterministic per field and matches the mix exactly', () => {
  for (const l of LEVELS) {
    const a = buildField(l.n), b = buildField(l.n);
    assert.deepEqual(a.types, b.types, `field ${l.n} deterministic`);
    const counts = mixCounts(l.mix, a.vc);
    for (const [key, want] of Object.entries(counts)) {
      let got = 0;
      for (let i = 0; i < a.N; i++) if (a.valid[i] && a.types[i] === TYPE_BY_KEY[key]) got++;
      assert.equal(got, want, `field ${l.n} ${key}`);
    }
    let lap = 0;
    for (let i = 0; i < a.N; i++) if (a.valid[i]) lap += MULT[a.types[i]];
    assert.ok(Math.abs(lap - a.lap) < 1e-6);
  }
});

test('levels: a different seed gives a different placement', () => {
  const a = buildField(10), b = buildField(10, 999);
  assert.notDeepEqual(a.types, b.types);
});

test('levels: fields start fully grown except the pre-mown stripes on 2 and 13', () => {
  for (const l of LEVELS) {
    const f = buildField(l.n);
    let mown = 0;
    for (let i = 0; i < f.N; i++) {
      if (!f.valid[i]) continue;
      if (f.h0[i] < 1) { mown++; assert.ok(Math.abs(f.h0[i] - PREMOWN_H) < 1e-6); }
    }
    if (l.n === 2 || l.n === 13) assert.ok(mown > 0, `field ${l.n} has mown cells`);
    else assert.equal(mown, 0, `field ${l.n} fully grown`);
  }
  // Field 2: one stripe, one brush-width wide, through the middle.
  const f2 = buildField(2);
  const sw = stripeWidth(getLevel(2));
  const rows = new Set();
  for (let i = 0; i < f2.N; i++) if (f2.premown[i]) rows.add(Math.floor(i / f2.W));
  assert.equal(rows.size, sw);
  // Field 13: alternating stripes.
  const f13 = buildField(13);
  const sw13 = stripeWidth(getLevel(13));
  for (let r = 0; r < f13.H; r++) {
    const want = Math.floor(r / sw13) % 2 === 1 ? 1 : 0;
    assert.equal(f13.premown[r * f13.W + 5], want, `row ${r}`);
  }
});

test('levels: field 11 has a hedge of tall grass along its outer edges', () => {
  const f = buildField(11);
  const W = f.W;
  // Every cell on the top row and left column is tall.
  for (let c = 0; c < W; c++) assert.equal(f.types[c], T_TALL, `top row c=${c}`);
  for (let r = 0; r < f.H; r++) assert.equal(f.types[r * W], T_TALL, `left col r=${r}`);
  // The inner corner of the L is not hedged.
  // (all tall grass is in the hedge, so cells deep inside are never tall).
  assert.notEqual(f.types[17 * W + 17], T_TALL);
  assert.notEqual(f.types[15 * W + 15], T_TALL);
  // The mix is unchanged.
  let tall = 0;
  for (let i = 0; i < f.N; i++) if (f.valid[i] && f.types[i] === T_TALL) tall++;
  assert.equal(tall, mixCounts(getLevel(11).mix, f.vc).tall);
});

test('levels: pacing table k and g are the design values, par is set', () => {
  const K = [1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 3.0, 3.2, 3.5];
  const G = [1.5, 1.5, 1.3, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0, 0.95, 0.9, 0.9, 0.85, 0.85, 0.8];
  for (const l of LEVELS) {
    assert.equal(l.k, K[l.n - 1]);
    assert.equal(l.g, G[l.n - 1]);
    assert.ok(l.par > 0 && l.par % 5 === 0);
    assert.ok(['morning', 'afternoon', 'golden'].includes(l.time));
    assert.ok(l.name.length > 0);
  }
});
