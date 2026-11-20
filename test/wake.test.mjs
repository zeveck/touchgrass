// test/wake.test.mjs -- the stroke's wake: grass just outside the brush
// leans away from the path, fading with distance; it's never touched, paid
// or flattened.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World } from '../game/src/sim/world.mjs';
import { computeLayout } from '../game/src/sim/layout.mjs';
import { stampCapsuleWake } from '../game/src/sim/brush.mjs';

test('wake: cells within the wake band get a fading factor and an outward normal', () => {
  const got = new Map();
  const inner = new Set();
  stampCapsuleWake(20, 9, 0.5, 4.5, 19.5, 4.5, 1.0, 3.0, (i) => inner.add(i), (i, f, nx, ny) => got.set(i, [f, nx, ny]));
  const at = (r, c) => got.get(r * 20 + c);
  assert.ok(inner.has(4 * 20 + 5) && inner.has(3 * 20 + 5));
  assert.ok(at(2, 5)[0] > at(1, 5)[0], 'fades with distance');
  assert.ok(at(2, 5)[2] < 0 && at(6, 5)[2] > 0, 'normals point away from the path');
  assert.equal(at(0, 5), undefined, 'beyond the wake: nothing');
});

test('wake: a stroke bends standing grass beside it without touching or paying for it', () => {
  const lay = computeLayout(1280, 800, 15, 15);
  const w = new World(3, lay, { collectFx: false });
  const g = w.grid;
  const y = 7.5 * lay.cell;
  w.pointerDown(0.5 * lay.cell, y, 'mouse');
  w.pointerMove(14.5 * lay.cell, y, 0.3);
  const R = w.brushRadiusPx('mouse') / lay.cell;
  // Find a valid cell just outside the brush, above the path.
  const r = Math.floor(7.5 - R - 0.6);
  const i = r * g.W + 7;
  assert.equal(g.touched[i], 0, 'not touched');
  assert.equal(g.h[i], 1, 'not flattened');
  assert.ok(g.by[i] < -0.05, `leans away (up): by=${g.by[i]}`);
  // Energy came only from the flattened cells (each full-height cell pays
  // its multiplier x the speed factor; the wake adds nothing).
  let flat = 0;
  for (let j = 0; j < g.N; j++) if (g.touched[j] && g.h[j] === 0) flat++;
  assert.ok(flat > 0);
  assert.ok(w.energy.value <= flat * 1.6 * 1.2 + 1e-6);
  // And it springs back.
  for (let k = 0; k < 120; k++) w.step(1 / 60);
  assert.ok(Math.abs(g.by[i]) < 0.02);
});

test('wake: brushH reports the grass height under the brush (for the rustle)', () => {
  const lay = computeLayout(1280, 800, 12, 12);
  const w = new World(1, lay, { collectFx: false });
  w.pointerDown(6 * lay.cell, 6 * lay.cell, 'mouse');
  assert.ok(Math.abs(w.brushH - 1) < 1e-6, 'full grass');
  w.pointerUp();
  w.pointerDown(6 * lay.cell, 6 * lay.cell, 'mouse');
  assert.ok(w.brushH < 0.01, 'just swept: low');
});
