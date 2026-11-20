// test/energy.test.mjs -- meter line, win, head start, whole-field.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Energy, meterLine, earnsHeadStart, HEAD_START_FRAC } from '../game/src/sim/energy.mjs';
import { World, STEP } from '../game/src/sim/world.mjs';
import { computeLayout } from '../game/src/sim/layout.mjs';
import { getLevel, buildField } from '../game/src/sim/levels.mjs';

function layoutFor(n) {
  const s = getLevel(n);
  return computeLayout(1280, 800, s.w, s.h);
}

test('energy: the line is k x one lap (valid cells x average multiplier)', () => {
  assert.equal(meterLine(2, 10), 20);
  for (const n of [1, 9, 15]) {
    const w = new World(n, layoutFor(n), { collectFx: false });
    const f = buildField(n);
    assert.ok(Math.abs(w.energy.line - getLevel(n).k * f.vc * f.avgMult) < 1e-6, `field ${n}`);
  }
  // Field 1: 144 default cells x 1.5 laps.
  assert.ok(Math.abs(new World(1, layoutFor(1)).energy.line - 216) < 1e-9);
});

test('energy: never below zero', () => {
  const e = new Energy(100);
  e.add(5);
  e.add(-10);
  assert.equal(e.value, 0);
  e.set(-3);
  assert.equal(e.value, 0);
});

test('energy: a head start is 15% of the (next) field line', () => {
  assert.equal(HEAD_START_FRAC, 0.15);
  const e = new Energy(200, { headStart: true });
  assert.equal(e.value, 30);
  const w = new World(4, layoutFor(4), { headStart: true, collectFx: false });
  assert.ok(Math.abs(w.energy.frac - 0.15) < 1e-9);
});

test('energy: head start is earned only with the whole field touched, and never on field 15', () => {
  assert.equal(earnsHeadStart(3, 1), true);
  assert.equal(earnsHeadStart(3, 0.99), false);
  assert.equal(earnsHeadStart(15, 1), false);
});

test('world: the meter reaching the line wins; head start earned iff the whole field was touched', () => {
  const lay = layoutFor(1);
  // Win with the whole field touched: sweep every cell, then top up the meter.
  const w = new World(1, lay, { collectFx: false });
  const cell = lay.cell;
  for (let r = 0; r < 12; r++) {
    w.pointerDown(0.5 * cell, (r + 0.5) * cell, 'mouse');
    w.pointerMove(11.5 * cell, (r + 0.5) * cell, 0.1);
    w.pointerUp();
  }
  assert.equal(w.grid.wholeField(), 1);
  assert.equal(w.won, false);
  w.energy.set(w.energy.line);
  w.step(STEP);
  assert.equal(w.won, true);
  assert.equal(w.headStartEarned, true);
  // Win without it.
  const w2 = new World(1, lay, { collectFx: false });
  w2.energy.set(w2.energy.line);
  w2.step(STEP);
  assert.equal(w2.won, true);
  assert.equal(w2.headStartEarned, false);
  // Field 15 never earns one.
  const w15 = new World(15, layoutFor(15), { collectFx: false });
  for (let i = 0; i < w15.grid.N; i++) if (w15.grid.valid[i]) w15.grid.sweepCell(i, 1, 1);
  w15.energy.set(w15.energy.line);
  w15.step(STEP);
  assert.equal(w15.won, true);
  assert.equal(w15.headStartEarned, false);
});

test('world: after the win, strokes do nothing more', () => {
  const lay = layoutFor(1);
  const w = new World(1, lay, { collectFx: false });
  w.energy.set(w.energy.line);
  w.step(STEP);
  const before = w.grid.touchedCount;
  w.pointerDown(5 * lay.cell, 5 * lay.cell, 'mouse');
  w.pointerMove(8 * lay.cell, 5 * lay.cell);
  assert.equal(w.grid.touchedCount, before);
});

test('world: a press sweeps at once; a pointer held still stops sweeping after 0.4 s', () => {
  const lay = layoutFor(1);
  const w = new World(1, lay, { collectFx: false });
  w.pointerDown(6 * lay.cell, 6 * lay.cell, 'mouse');
  assert.ok(w.grid.touchedCount > 0, 'press sweeps');
  assert.equal(w.sweeping, true);
  for (let j = 0; j < 30; j++) w.step(STEP);
  assert.equal(w.sweeping, false, 'held still for 0.5 s');
  w.pointerMove(7 * lay.cell, 6 * lay.cell, STEP);
  assert.equal(w.sweeping, true, 'moving again');
});

test('world: a new press is a new stroke (stiff grass flattens on the second press)', () => {
  // Find a stiff cell on field 9.
  const lay = layoutFor(9);
  const w = new World(9, lay, { collectFx: false });
  const g = w.grid;
  let i = 0;
  while (!(g.valid[i] && g.type[i] === 4)) i++;
  const x = ((i % g.W) + 0.5) * lay.cell, y = (Math.floor(i / g.W) + 0.5) * lay.cell;
  w.pointerDown(x, y, 'mouse');
  w.pointerMove(x + 2, y, STEP);
  w.pointerMove(x - 2, y, STEP);
  assert.equal(g.h[i], 1, 'loosened, not flattened, by one stroke');
  assert.ok(g.isLoosened(i));
  w.pointerUp();
  w.pointerDown(x, y, 'mouse');
  assert.equal(g.h[i], 0, 'flattened by a fresh stroke');
});

test('world: faster strokes pay a little more (speed factor from pointer samples)', () => {
  const lay = layoutFor(1);
  const slow = new World(1, lay, { collectFx: false });
  const fast = new World(1, lay, { collectFx: false });
  const y = 6 * lay.cell;
  for (const [w, dt] of [[slow, 1], [fast, 0.01]]) {
    w.pointerDown(0, y, 'mouse');
    for (let k = 1; k <= 20; k++) w.pointerMove(k * 0.6 * lay.cell, y, dt);
  }
  assert.ok(fast.energy.value > slow.energy.value * 1.1, `${fast.energy.value} vs ${slow.energy.value}`);
});
