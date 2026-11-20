// test/grid.test.mjs -- the grass rules (GAME_DESIGN.md "Grass, energy and
// regrowth rules"): standing height, low-grass bend, regrowth, rest,
// goldness floor, stiff fresh-stroke rule, under-bug skip, speed factor.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Grid, STAND_H, REST_S, SEED_H, GOLD_FLOOR, speedFactor,
  SWEEP_FLAT, SWEEP_BEND, SWEEP_LOOSEN, SWEEP_NONE,
} from '../game/src/sim/grid.mjs';
import { T_DEFAULT, T_TALL, T_SHORT, T_STIFF, RATE, MULT } from '../game/src/sim/types.mjs';

function grid1(type = T_DEFAULT, h = 1, g = 1) {
  return new Grid(1, 1, Uint8Array.of(1), Uint8Array.of(type), Float32Array.of(h), g);
}

const DT = 1 / 60;
function run(grid, seconds) {
  const n = Math.round(seconds / DT);
  for (let j = 0; j < n; j++) grid.update(DT);
}

test('grid: standing height is 0.4', () => {
  assert.equal(STAND_H, 0.4);
});

test('grid: sweeping standing grass pays mult x h x speed factor, then h = 0, gold = 1, touched, rest 1.5 s', () => {
  const g = grid1(T_TALL, 0.8);
  const res = g.sweepCell(0, 1, 1.0, 1, 0);
  assert.equal(res, SWEEP_FLAT);
  assert.ok(Math.abs(g.lastGain - MULT[T_TALL] * 0.8) < 1e-6);
  assert.equal(g.h[0], 0);
  assert.equal(g.gold[0], 1);
  assert.equal(g.touched[0], 1);
  assert.equal(g.rest[0], REST_S);
  // Exactly at the standing height still pays.
  const g2 = grid1(T_DEFAULT, 0.4);
  assert.equal(g2.sweepCell(0, 1, 1.2), SWEEP_FLAT);
  assert.ok(Math.abs(g2.lastGain - 0.4 * 1.2) < 1e-6);
});

test('grid: speed factor is +20% at 600 px/s and above, none at 150 or below', () => {
  assert.equal(speedFactor(0), 1);
  assert.equal(speedFactor(150), 1);
  assert.ok(Math.abs(speedFactor(375) - 1.1) < 1e-9);
  assert.ok(Math.abs(speedFactor(600) - 1.2) < 1e-9);
  assert.ok(Math.abs(speedFactor(5000) - 1.2) < 1e-9);
});

test('grid: low grass (h < 0.4) only bends: no energy, height and regrowth carry on, touched', () => {
  const g = grid1(T_DEFAULT, 0.39);
  g.rest[0] = 0;
  const res = g.sweepCell(0, 1, 1.2, 0, 1);
  assert.equal(res, SWEEP_BEND);
  assert.ok(Math.abs(g.h[0] - 0.39) < 1e-6, 'height unchanged');
  assert.equal(g.rest[0], 0, 'no new rest');
  assert.equal(g.touched[0], 1);
  assert.equal(g.by[0], 1, 'bent along the stroke');
  // Rubbing low grass every step for a while never resets it: it keeps growing.
  const gl = grid1(T_DEFAULT, 0.2);
  for (let j = 0; j < 60; j++) { assert.equal(gl.sweepCell(0, 1, 1.2, 0, 1), SWEEP_BEND); gl.update(DT); }
  assert.ok(gl.h[0] > 0.24, `kept growing under the rubbing (${gl.h[0]})`);
  // A cell resting after a sweep isn't reset by rubbing either.
  const g3 = grid1(T_DEFAULT, 1);
  g3.sweepCell(0, 1, 1);
  run(g3, 0.5);
  g3.sweepCell(0, 2, 1);
  assert.ok(Math.abs(g3.rest[0] - (REST_S - 0.5)) < 0.02, 'rest timer not restarted');
});

test('grid: rest of 1.5 s before regrowth starts', () => {
  const g = grid1(T_DEFAULT, 1);
  g.sweepCell(0, 1, 1);
  run(g, 1.45);
  assert.equal(g.h[0], 0, 'still resting');
  run(g, 0.2);
  assert.ok(g.h[0] > 0, 'regrowing after rest');
});

test('grid: logistic regrowth from a seed matches h += r g max(h, 0.08)(1 - h) dt', () => {
  const g = grid1(T_DEFAULT, 0.2, 1.5);
  g.rest[0] = 0;
  const h0 = g.h[0];
  g.update(DT);
  const expect = h0 + RATE[T_DEFAULT] * 1.5 * Math.max(h0, SEED_H) * (1 - h0) * DT;
  assert.ok(Math.abs(g.h[0] - expect) < 1e-6);
  // From 0 it uses the 0.08 seed.
  const g0 = grid1(T_DEFAULT, 0, 1);
  g0.update(DT);
  assert.ok(Math.abs(g0.h[0] - RATE[T_DEFAULT] * SEED_H * DT) < 1e-7);
});

test('grid: stands up again at the design times (g = 1, including the 1.5 s rest)', () => {
  // Types table: default ~12 s, tall ~19 s, short ~7 s, stiff ~14 s.
  const expect = { [T_DEFAULT]: 12, [T_TALL]: 19, [T_SHORT]: 7, [T_STIFF]: 14 };
  for (const [type, secs] of Object.entries(expect)) {
    const g = grid1(Number(type), 1, 1);
    g.sweepCell(0, 1, 1);
    g.sweepCell(0, 2, 1);   // stiff grass needs a second, fresh stroke
    assert.equal(g.h[0], 0);
    let t = 0;
    while (g.h[0] < STAND_H && t < 60) { g.update(DT); t += DT; }
    assert.ok(Math.abs(t - secs) <= 1.2, `type ${type}: stood up at ${t.toFixed(1)} s, design ~${secs} s`);
  }
});

test('grid: goldness is 1 when swept, then max(0.4, 1 - h); untouched stays 0', () => {
  const g = new Grid(2, 1, Uint8Array.of(1, 1), Uint8Array.of(0, 0), Float32Array.of(1, 1), 3);
  g.sweepCell(0, 1, 1);
  assert.equal(g.gold[0], 1);
  assert.equal(g.gold[1], 0);
  run(g, 4);
  assert.ok(g.h[0] > 0 && g.h[0] < 0.6);
  assert.ok(Math.abs(g.gold[0] - Math.max(GOLD_FLOOR, 1 - g.h[0])) < 1e-6);
  run(g, 60);
  assert.ok(g.h[0] > 0.99);
  assert.ok(Math.abs(g.gold[0] - GOLD_FLOOR) < 1e-6, 'touched grass never goes fully green again');
  assert.equal(g.gold[1], 0, 'untouched grass stays deep green');
});

test('grid: stiff grass needs a fresh stroke; zig-zag in the same stroke does nothing more', () => {
  const g = grid1(T_STIFF, 1);
  assert.ok(g.isStiff(0));
  assert.equal(g.sweepCell(0, 7, 1), SWEEP_LOOSEN, 'first stroke loosens');
  assert.equal(g.h[0], 1, 'not flattened');
  assert.ok(g.isLoosened(0));
  assert.equal(g.touched[0], 1, 'loosening touches it');
  assert.equal(g.sweepCell(0, 7, 1), SWEEP_NONE, 'same stroke: nothing more');
  assert.equal(g.sweepCell(0, 7, 1), SWEEP_NONE);
  assert.equal(g.h[0], 1);
  assert.equal(g.sweepCell(0, 8, 1), SWEEP_FLAT, 'a new stroke flattens it');
  assert.ok(Math.abs(g.lastGain - 1.0) < 1e-6);
  assert.equal(g.h[0], 0);
});

test('grid: loosened stiff grass stays loosened until flattened; regrown stiff grass is stiff again', () => {
  const g = grid1(T_STIFF, 1, 2);
  g.sweepCell(0, 1, 1);
  run(g, 5);
  assert.ok(g.isLoosened(0), 'still loosened after a while');
  g.sweepCell(0, 2, 1);
  assert.equal(g.h[0], 0);
  assert.ok(!g.isStiff(0) && !g.isLoosened(0), 'low stiff grass is neither');
  let t = 0;
  while (g.h[0] < STAND_H && t < 60) { g.update(DT); t += DT; }
  assert.ok(g.isStiff(0), 'stiff again the moment it stands up');
  assert.ok(g.events.some((e) => e[0] === 'stand' && e[1] === 0), 'stand event emitted');
  assert.equal(g.sweepCell(0, 3, 1), SWEEP_LOOSEN, 'needs loosening again');
});

test('grid: cells under a bug are skipped (no energy, no touch, no change)', () => {
  const g = grid1(T_DEFAULT, 1);
  g.blocked[0] = 1;
  assert.equal(g.sweepCell(0, 1, 1), SWEEP_NONE);
  assert.equal(g.h[0], 1);
  assert.equal(g.touched[0], 0);
  g.blocked[0] = 0;
  assert.equal(g.sweepCell(0, 1, 1), SWEEP_FLAT);
});

test('grid: whole field counts a cell under a bug once every other cell is touched', () => {
  const g = new Grid(3, 1, Uint8Array.of(1, 1, 1), Uint8Array.of(0, 0, 0), Float32Array.of(1, 1, 1));
  g.blocked[2] = 1;
  g.sweepCell(0, 1, 1);
  assert.ok(Math.abs(g.wholeField() - 1 / 3) < 1e-9);
  assert.equal(g.untouchedLeft(), 2);
  g.sweepCell(1, 1, 1);
  assert.equal(g.wholeField(), 1, 'the bug cell counts last');
  assert.equal(g.untouchedLeft(), 0);
});

test('grid: invalid cells are never swept', () => {
  const g = new Grid(2, 1, Uint8Array.of(0, 1), Uint8Array.of(0, 0), Float32Array.of(1, 1));
  assert.equal(g.sweepCell(0, 1, 1), SWEEP_NONE);
  assert.equal(g.validCount, 1);
});

test('grid: bend springs back to zero with a slight overshoot', () => {
  const g = grid1(T_DEFAULT, 0.2);
  g.sweepCell(0, 1, 1, 1, 0);
  let minBx = 1;
  for (let j = 0; j < 120; j++) { g.update(DT); minBx = Math.min(minBx, g.bx[0]); }
  assert.ok(minBx < -0.05, 'overshoots past zero');
  assert.ok(Math.abs(g.bx[0]) < 0.01, 'settles');
});
