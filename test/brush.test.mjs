// test/brush.test.mjs -- brush radius rule and capsule stamping.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brushRadiusPx, stampCapsule } from '../game/src/sim/brush.mjs';
import { computeLayout, LAYOUTS } from '../game/src/sim/layout.mjs';
import { getLevel } from '../game/src/sim/levels.mjs';

function radiusFor(n, layoutName) {
  const L = LAYOUTS[layoutName];
  const s = getLevel(n);
  const lay = computeLayout(L.vw, L.vh, s.w, s.h);
  return { r: brushRadiusPx(lay.cell, lay.shortSide, L.pointerType), cell: lay.cell };
}

test('brush: radius = max(0.75 cells, 5% of the field short side, 18 touch / 14 mouse px)', () => {
  assert.equal(brushRadiusPx(10, 100, 'touch'), 18);
  assert.equal(brushRadiusPx(10, 100, 'mouse'), 14);
  assert.equal(brushRadiusPx(10, 100, 'pen'), 14);
  assert.equal(brushRadiusPx(40, 100, 'mouse'), 30);       // 0.75 cells
  assert.equal(brushRadiusPx(10, 1000, 'touch'), 50);      // 5% of the side
});

test('brush: design sizes -- field 15 is 18 px on a phone and ~38 px on desktop; field 1 ~23 and ~47 px', () => {
  const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(1)} vs ${b}`);
  near(radiusFor(15, 'phone').r, 18.3, 0.5, 'f15 phone');
  near(radiusFor(15, 'desktop').r, 37.6, 0.6, 'f15 desktop');
  near(radiusFor(1, 'phone').r, 22.9, 0.6, 'f1 phone');
  near(radiusFor(1, 'desktop').r, 47, 0.6, 'f1 desktop');
  near(radiusFor(15, 'phone').cell, 10.2, 0.1, 'f15 phone cell');
  near(radiusFor(15, 'desktop').cell, 20.9, 0.1, 'f15 desktop cell');
});

test('brush: a capsule stamps every cell within R of the segment, each once', () => {
  const W = 20, H = 5;
  const hits = new Map();
  stampCapsule(W, H, 0.5, 2.5, 19.5, 2.5, 1.0, (i) => hits.set(i, (hits.get(i) || 0) + 1));
  for (let c = 0; c < W; c++) {
    for (const r of [1, 2, 3]) assert.equal(hits.get(r * W + c), 1, `r${r} c${c}`);
    assert.equal(hits.get(0 * W + c), undefined);
    assert.equal(hits.get(4 * W + c), undefined);
  }
});

test('brush: a fast swipe (one huge segment) skips no cells along its path', () => {
  const W = 36, H = 36;
  const hit = new Uint8Array(W * H);
  stampCapsule(W, H, 0.2, 0.2, 35.8, 35.8, 0.75, (i) => { hit[i] = 1; });
  for (let k = 0; k < W; k++) assert.equal(hit[k * W + k], 1, `diagonal cell ${k}`);
});

test('brush: a dot (zero-length segment) stamps a disc', () => {
  const W = 9, H = 9;
  const hit = [];
  stampCapsule(W, H, 4.5, 4.5, 4.5, 4.5, 1.2, (i) => hit.push(i));
  assert.deepEqual(hit.sort((a, b) => a - b), [31, 39, 40, 41, 49]);
});

test('layout: phone portrait puts the HUD on top; desktop puts it on the left; field fits inside', () => {
  const p = computeLayout(390, 844, 36, 36);
  assert.equal(p.portrait, true);
  assert.equal(p.hud.y, 0);
  assert.ok(p.field.y >= p.hud.y + p.hud.h);
  assert.ok(p.field.y + p.field.h <= p.toolbar.y);
  const d = computeLayout(1280, 800, 36, 36);
  assert.equal(d.portrait, false);
  assert.ok(d.field.x >= d.hud.x + d.hud.w);
  assert.ok(d.field.x + d.field.w <= d.toolbar.x);
  const l = computeLayout(844, 390, 36, 36);
  assert.equal(l.portrait, false);
  assert.ok(l.field.h <= 390 && l.field.w <= 844);
  // Safe-area insets are respected.
  const s = computeLayout(390, 844, 12, 12, { top: 47, bottom: 34 });
  assert.equal(s.hud.y, 47);
  assert.ok(s.toolbar.y + s.toolbar.h <= 844 - 34);
});
