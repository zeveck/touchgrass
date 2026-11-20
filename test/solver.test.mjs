// test/solver.test.mjs -- the headless solver wins every field with every
// profile at the phone (390x844) and desktop (1280x800) layouts, inside the
// design's windows (GAME_DESIGN.md Tech plan): average within 15% of par,
// fast and scribble within 1.5x par, calm within 2.5x par. Fast is never
// slower than average. See design/tuning/tuned.md for the scribble note.
// Bugs are in: good play (every pacing profile) steers round the biters and
// is never bitten; a careless scribbler gets bitten and still always wins.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runField, PACING_PROFILES, serpentineLanes } from '../game/src/sim/solver.mjs';
import { LEVELS } from '../game/src/sim/levels.mjs';
import { World } from '../game/src/sim/world.mjs';
import { computeLayout } from '../game/src/sim/layout.mjs';

// Scribbling is random; on desktop it can run a few percent behind the
// methodical average on shaped fields (the design's own simulator shows the
// same). It must never be more than this much slower.
const SCRIBBLE_VS_AVERAGE_MAX = 1.1;

const results = {};
for (const layout of ['phone', 'desktop']) {
  for (const l of LEVELS) {
    test(`solver: field ${l.n} (${l.name}) wins on ${layout} with every profile`, () => {
      const r = {};
      for (const p of PACING_PROFILES) {
        r[p] = runField(l.n, layout, p);
        assert.equal(r[p].won, true, `${p} won (meter ${r[p].meter}%)`);
        assert.equal(r[p].bites, 0, `${p} steers round the biters: never bitten`);
      }
      results[`${layout}:${l.n}`] = r;
      const par = l.par;
      assert.ok(r.average.time <= par * 1.15, `average ${r.average.time}s within 15% of par ${par}`);
      assert.ok(r.fast.time <= par * 1.5, `fast ${r.fast.time}s within 1.5x par`);
      assert.ok(r.scribble.time <= par * 1.5, `scribble ${r.scribble.time}s within 1.5x par`);
      assert.ok(r.calm.time <= par * 2.5, `calm ${r.calm.time}s within 2.5x par`);
      assert.ok(r.fast.time <= r.average.time, `fast ${r.fast.time}s never slower than average ${r.average.time}s`);
      assert.ok(r.scribble.time <= r.average.time * SCRIBBLE_VS_AVERAGE_MAX,
        `scribble ${r.scribble.time}s vs average ${r.average.time}s`);
      // Nothing wins too quickly: the meter is about laps, not one patch.
      assert.ok(r.fast.time >= 10, `fast ${r.fast.time}s is not under 10 s`);
    });
  }
}

test('solver: par is the slower layout average, rounded up to 5 s', () => {
  for (const l of LEVELS) {
    const a = Math.max(runField(l.n, 'phone', 'average').time, runField(l.n, 'desktop', 'average').time);
    assert.equal(l.par, Math.ceil(a / 5) * 5, `field ${l.n}: average ${a}s`);
  }
});

test('solver: serpentine lanes cover every valid cell of every field', () => {
  for (const l of LEVELS) {
    for (const [vw, vh, pt] of [[390, 844, 'touch'], [1280, 800, 'mouse']]) {
      const lay = computeLayout(vw, vh, l.w, l.h);
      // The lanes' geometry alone: no bugs (a friendly nudged off a cell
      // after its lane passed leaves that cell for the next lap).
      const w = new World(l.n, lay, { collectFx: false, bugs: false });
      for (const lane of serpentineLanes(w, pt)) {
        w.pointerDown(lane.lo * lay.cell, lane.y * lay.cell, pt);
        w.pointerMove(lane.hi * lay.cell, lane.y * lay.cell, 0.5);
        w.pointerUp();
      }
      assert.equal(w.grid.wholeField(), 1, `field ${l.n} at ${vw}x${vh}`);
    }
  }
});

test('solver: the same field and profile give the same result (deterministic)', () => {
  const a = runField(7, 'phone', 'scribble');
  const b = runField(7, 'phone', 'scribble');
  assert.deepEqual(a, b);
});

test('solver: a head start makes a field quicker but never wins it at once', () => {
  const plain = runField(2, 'phone', 'fast');
  const hs = runField(2, 'phone', 'fast', { headStart: true });
  assert.ok(hs.time < plain.time);
  assert.ok(hs.time >= 10, `head start field 2 fast: ${hs.time}s`);
});

test('solver: the "bitten" check -- a careless scribbler (never steers) gets bitten and still wins every field', () => {
  let bites = 0;
  for (const layout of ['phone', 'desktop']) {
    for (const l of LEVELS) {
      const r = runField(l.n, layout, 'careless');
      assert.equal(r.won, true, `field ${l.n} ${layout} (meter ${r.meter}%)`);
      assert.ok(r.time <= l.par * 2.5, `field ${l.n} ${layout}: ${r.time}s`);
      bites += r.bites;
    }
  }
  assert.ok(bites > 0, 'it really was bitten');
});

test('solver: good play pets every friendly on the field', () => {
  for (const n of [3, 7, 14, 15]) {
    const r = runField(n, 'phone', 'average');
    const friends = { 3: 1, 7: 3, 14: 4, 15: 5 }[n];
    assert.equal(r.petted, friends, `field ${n}`);
  }
});
