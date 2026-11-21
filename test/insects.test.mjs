// test/insects.test.mjs -- the bugs (GAME_DESIGN.md "Bugs", "Win, lose and
// progress"): the spawn table, AI transitions (only a sweeping pointer
// angers; the warning shows at least 1.5 s before any bite; calming), the
// bite and its floor, flee distance and cool-down, petting once per bug per
// field, nudging friendlies, cells under bugs (skipped, and counted last),
// bugs keeping to the field, and determinism.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World, STEP } from '../game/src/sim/world.mjs';
import { computeLayout } from '../game/src/sim/layout.mjs';
import { getLevel, LEVELS } from '../game/src/sim/levels.mjs';
import { mulberry32 } from '../game/src/sim/rng.mjs';
import {
  SPAWNS, SPECIES, SPECIES_ORDER, WARN_MIN_S, BITE_FRAC, PET_FRAC, PET_SCORE, FLEE_DIST, COOLDOWN_S,
  CALM_FAR, CALM_S, FADE_PER_S, RISE_PER_S, PASS_GAIN, angerRadiusPx, bugSizePx, petRadiusPx, warnRingPx, UNDER_FRAC,
  warnLevel,
} from '../game/src/sim/insects.mjs';

function layoutFor(n, vw = 1280, vh = 800) {
  const s = getLevel(n);
  return computeLayout(vw, vh, s.w, s.h);
}

// A field with no spawned bugs, so a test places exactly the bugs it needs.
function empty(n, opts = {}) {
  return new World(n, layoutFor(n, opts.vw, opts.vh), { bugs: false, ...opts });
}

// Hold a bug still (so a test controls the distance).
function hold(b) { b.state = 'idle'; b.t = 1e9; }

function run(w, secs, fn) {
  const n = Math.round(secs / STEP);
  for (let k = 0; k < n; k++) {
    if (fn) fn(k * STEP);
    w.step(STEP);
  }
}

// Sweep a small circle of radius r px around (cx, cy) px for `secs`.
function circle(w, cx, cy, r, secs, events) {
  let a = 0;
  w.pointerDown(cx + r, cy, 'mouse');
  run(w, secs, () => {
    a += 0.25;
    w.pointerMove(cx + r * Math.cos(a), cy + r * Math.sin(a), STEP);
    if (events) for (const e of w.drainFx()) if (e[0] === 'bug') events.push([w.time, e[1]]);
  });
}

test('insects: speeds, sizes and radii follow the design (CSS px)', () => {
  const px = { ant: 15, bee: 21, wasp: 33, ladybug: 9, butterfly: 24, caterpillar: 6, snail: 4.5 };
  for (const [k, v] of Object.entries(px)) assert.equal(SPECIES[k].speed, v, k);
  for (const k of ['bee', 'wasp', 'ant']) assert.equal(SPECIES[k].hostile, true);
  for (const k of ['ladybug', 'butterfly', 'caterpillar', 'snail']) assert.equal(SPECIES[k].hostile, false);
  assert.equal(SPECIES.caterpillar.long, 1.4);
  assert.equal(bugSizePx(10), 36);       // clamp(2 cells, 36, 72) (milestone 5: bigger on desktop)
  assert.equal(bugSizePx(25), 50);
  assert.equal(bugSizePx(60), 72);
  // The biters' leggy art is drawn larger so it reads next to the round friends.
  assert.equal(bugSizePx(25, 'ant'), 60);
  assert.ok(Math.abs(bugSizePx(25, 'bee') - 55) < 1e-9);
  assert.ok(Math.abs(bugSizePx(25, 'wasp') - 55) < 1e-9);
  assert.equal(bugSizePx(25, 'ladybug'), 50);
  assert.ok(Math.abs(bugSizePx(10, 'ant') - 43.2) < 1e-9);
  assert.equal(angerRadiusPx(10), 40);   // max(1.5 cells, 40 px)
  assert.equal(angerRadiusPx(40), 60);
  assert.equal(warnRingPx(10), 48);      // max(anger + 8, 48)
  assert.equal(warnRingPx(40), 68);
  assert.equal(petRadiusPx(10, 'ladybug'), 24);   // max(24, half + 6)
  assert.equal(petRadiusPx(60, 'ladybug'), 42);
  assert.equal(UNDER_FRAC, 0.35);
});

test('insects: every field spawns the plan\'s table (plus a snail on field 7), the same on every layout', () => {
  assert.equal(SPAWNS[7].snail, 1);
  for (const l of LEVELS) {
    const a = new World(l.n, layoutFor(l.n, 390, 844), { collectFx: false });
    const b = new World(l.n, layoutFor(l.n, 1280, 800), { collectFx: false });
    const want = SPAWNS[l.n];
    for (const sp of SPECIES_ORDER) {
      assert.equal(a.bugs.list.filter((x) => x.sp === sp).length, want[sp] || 0, `field ${l.n} ${sp}`);
    }
    assert.deepEqual(a.bugs.list.map((x) => [x.sp, x.x, x.y]), b.bugs.list.map((x) => [x.sp, x.x, x.y]),
      `field ${l.n} spawns the same on phone and desktop`);
    for (const x of a.bugs.list) {
      assert.equal(a.grid.valid[Math.floor(x.y) * a.grid.W + Math.floor(x.x)], 1, `field ${l.n} ${x.sp} on the field`);
    }
  }
  // Field 11: the bee and the ants start at the L's inner corner.
  const w11 = new World(11, layoutFor(11), { collectFx: false });
  for (const x of w11.bugs.list.filter((q) => q.hostile)) {
    assert.ok(Math.hypot(x.x - 16, x.y - 16) < 4.5, `${x.sp} at ${x.x},${x.y}`);
  }
});

test('insects: only a sweeping pointer angers a biter (a still finger or no finger does not)', () => {
  const w = empty(6);
  const c = w.layout.cell;
  const ant = w.bugs.spawn('ant', 5.5, 5.5);
  hold(ant);
  // Pressed right next to it but held still: the press sweeps once, then
  // after 0.4 s it isn't sweeping.
  w.pointerDown(5.5 * c + 10, 5.5 * c, 'mouse');
  run(w, 0.45);
  ant.state = 'idle'; ant.angerT = 0;   // whatever the press did, start clean
  run(w, 3);
  assert.notEqual(ant.state, 'angry', 'a finger held still never angers');
  assert.equal(w.bites, 0);
  w.pointerUp();
  run(w, 3);
  assert.notEqual(ant.state, 'angry');
  // A moving finger inside the radius does.
  circle(w, 5.5 * c, 5.5 * c, 20, 0.2);
  assert.equal(ant.state, 'angry');
});

test('insects: the warning shows at least 1.5 s before a bite; the bite takes 3% of the line', () => {
  const w = empty(6);
  const c = w.layout.cell;
  w.energy.set(0.5 * w.energy.line);
  const ant = w.bugs.spawn('ant', 5.5, 5.5);
  hold(ant);
  const ev = [];
  circle(w, 5.5 * c, 5.5 * c, 15, 1.4, ev);
  assert.equal(ant.state, 'angry');
  assert.equal(w.bites, 0, 'no bite before 1.5 s');
  circle(w, 5.5 * c, 5.5 * c, 15, 0.4, ev);
  assert.equal(w.bites, 1);
  const angry = ev.find((e) => e[1] === 'angry'), bite = ev.find((e) => e[1] === 'bite');
  assert.ok(bite[0] - angry[0] >= WARN_MIN_S - 1e-9, `warned ${bite[0] - angry[0]} s`);
  assert.equal(ant.state, 'flee');
});

test('insects: across random strokes near biters, every bite comes 1.5 s or more after its warning began', () => {
  let bites = 0, warnings = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rng = mulberry32(seed);
    const n = [6, 9, 12, 15][seed % 4];
    const w = new World(n, layoutFor(n, seed % 2 ? 390 : 1280, seed % 2 ? 844 : 800), { bugSeed: seed });
    const c = w.layout.cell;
    const started = new Map();
    let x = (w.grid.W / 2) * c, y = (w.grid.H / 2) * c, ang = 0;
    let down = false;
    for (let k = 0; k < 60 * 40; k++) {
      // Random strokes, steered towards a biter now and then.
      if (!down && rng() < 0.2) { w.pointerDown(x, y, 'mouse'); down = true; }
      if (down) {
        const h = w.bugs.list.filter((b) => b.hostile);
        if (h.length && rng() < 0.05) {
          const b = h[Math.floor(rng() * h.length)];
          ang = Math.atan2(b.y * c - y, b.x * c - x);
        }
        ang += (rng() - 0.5) * 0.8;
        const v = 100 + rng() * 500;
        x = Math.max(0, Math.min(w.grid.W * c, x + Math.cos(ang) * v * STEP));
        y = Math.max(0, Math.min(w.grid.H * c, y + Math.sin(ang) * v * STEP));
        if (rng() >= 0.03) w.pointerMove(x, y, STEP);   // now and then the finger rests
        if (rng() < 0.01) { w.pointerUp(); down = false; }
      }
      w.step(STEP);
      for (const e of w.drainFx()) {
        if (e[0] !== 'bug') continue;
        if (e[1] === 'angry') { started.set(e[2].id, w.time); warnings++; }
        if (e[1] === 'bite') {
          bites++;
          const t0 = started.get(e[2].id);
          assert.ok(t0 !== undefined && w.time - t0 >= WARN_MIN_S - 1e-9, `seed ${seed}: warned ${w.time - t0} s`);
          started.delete(e[2].id);
        }
        if (e[1] === 'calm') started.delete(e[2].id);
      }
      assert.ok(w.energy.value >= 0);
    }
  }
  assert.ok(bites > 0 && warnings > bites, `the strokes did get warned (${warnings}) and bitten (${bites})`);
});

test('insects: an angry biter calms once its build-up has faded and the finger has been away 0.5 s, without biting', () => {
  const w = empty(6);
  const c = w.layout.cell;
  const Ra = angerRadiusPx(c);
  const ant = w.bugs.spawn('ant', 4.5, 4.5);
  hold(ant);
  circle(w, 4.5 * c, 4.5 * c, 15, 0.15);
  assert.equal(ant.state, 'angry');
  const built = ant.angerT;
  assert.ok(built >= PASS_GAIN, `built up ${built}`);
  // Keep sweeping, but well away (beyond 1.25 x the radius): the build-up
  // fades at FADE_PER_S, it doesn't reset, and the bug stays angry till it's gone.
  const fx = 4.5 * c + CALM_FAR * Ra + 25;
  circle(w, fx + 15, 14 * c, 15, 0.5);
  assert.equal(ant.state, 'angry', 'not calm yet: some build-up left');
  assert.ok(Math.abs(ant.angerT - (built - FADE_PER_S * 0.5)) < 0.02, `faded to ${ant.angerT}`);
  circle(w, fx + 15, 14 * c, 15, built / FADE_PER_S - 0.5 + 0.1);
  assert.equal(ant.state, 'wander');
  assert.equal(w.bites, 0);
  // Angry again, then the finger lifts: calm once the build-up has faded
  // (and never sooner than CALM_S).
  circle(w, 4.5 * c, 4.5 * c, 15, 0.05);
  assert.equal(ant.state, 'angry');
  const b2 = ant.angerT;
  w.pointerUp();
  run(w, Math.max(CALM_S, b2 / FADE_PER_S) - 0.05);
  assert.equal(ant.state, 'angry');
  run(w, 0.1);
  assert.equal(ant.state, 'wander');
  assert.equal(w.bites, 0);
});

test('insects: anger builds over repeated passes (not speed) -- one pass warns, sweeping back and forth bites, after 1.5 s of warning', () => {
  for (const [vw, vh] of [[1280, 800], [390, 844]]) {
    const w = empty(10, { vw, vh });
    const c = w.layout.cell;
    const Ra = angerRadiusPx(c);
    w.energy.set(0.5 * w.energy.line);
    const bx = 14.5, by = 14.5;
    const bee = w.bugs.spawn('bee', bx, by);
    hold(bee);
    // Straight strokes through the bee, 3 x its radius each way, at 350 px/s.
    const L = 3 * Ra, v = 350;
    let t0 = null, biteAt = null, minLevelAtBite = null, maxLevelBefore = 0;
    let x = bx * c - L, dir = 1;
    w.pointerDown(x, by * c, 'mouse');
    const passes = [];
    let inside = false;
    for (let k = 0; k < 60 * 20 && biteAt === null; k++) {
      x += dir * v * STEP;
      if (x > bx * c + L || x < bx * c - L) dir = -dir;
      const lvl = warnLevel(bee);
      w.pointerMove(x, by * c, STEP);
      w.step(STEP);
      const now = Math.abs(x - bx * c) <= Ra;
      if (now && !inside) passes.push(w.time);
      inside = now;
      for (const e of w.drainFx()) {
        if (e[0] !== 'bug') continue;
        if (e[1] === 'angry' && t0 === null) t0 = w.time;
        if (e[1] === 'bite') { biteAt = w.time; minLevelAtBite = lvl; }
        if (e[1] === 'calm') t0 = null;
      }
      if (biteAt === null) maxLevelBefore = Math.max(maxLevelBefore, warnLevel(bee));
      if (passes.length === 1 && !now && bee.state === 'angry') {
        // After the first pass: warned, but nowhere near a bite.
        assert.ok(warnLevel(bee) < 1, `${vw}: one pass doesn't fill the warning`);
      }
    }
    assert.ok(biteAt !== null, `${vw}x${vh}: sweeping back and forth past a bee bites`);
    assert.ok(passes.length >= 3, `${vw}x${vh}: it took a few passes (${passes.length})`);
    assert.ok(biteAt - t0 >= WARN_MIN_S - 1e-9, `${vw}x${vh}: warned ${biteAt - t0} s first`);
    assert.equal(minLevelAtBite, 1, 'the arc was full just before the bite (it shows the build-up honestly)');
    assert.equal(w.bites, 1);
  }
});

test('insects: the build-up fades slowly when the pointer leaves (it does not reset), and a Ring clears it', () => {
  const w = empty(6);
  const c = w.layout.cell;
  const ant = w.bugs.spawn('ant', 5.5, 5.5);
  hold(ant);
  circle(w, 5.5 * c, 5.5 * c, 15, 0.2);
  const a1 = ant.angerT;
  // One pass: its pass gain, plus a little for the time inside.
  assert.ok(a1 >= PASS_GAIN && a1 <= PASS_GAIN + RISE_PER_S * 0.2 + 1e-6, `built ${a1}`);
  w.pointerUp();
  run(w, 1);
  assert.equal(ant.state, 'angry', 'still grumpy a second later');
  assert.ok(Math.abs(ant.angerT - (a1 - FADE_PER_S)) < 0.02, `faded to ${ant.angerT}, not reset`);
  // Back for another short pass: it carries on from where it was (a new pass adds its gain).
  const a2 = ant.angerT;
  circle(w, 5.5 * c, 5.5 * c, 15, 0.1);
  assert.ok(ant.angerT >= a2 + PASS_GAIN - 1e-9, `built on: ${a2} -> ${ant.angerT}`);
  w.pointerUp();
  w.energy.set(0.5 * w.energy.line);
  assert.equal(w.fireMove('ring', { x: 5.5, y: 5.5 }).fired, true);
  assert.equal(ant.state, 'flee');
  assert.equal(ant.angerT, 0);
  assert.equal(w.bites, 0);
});

test('insects: scribbling for 20 s beside a bee gets bitten (warned 1.5 s first); a single pass never does', () => {
  for (const [vw, vh] of [[1280, 800], [390, 844]]) {
    const w = empty(10, { vw, vh });
    const c = w.layout.cell;
    const Ra = angerRadiusPx(c);
    w.energy.set(0.5 * w.energy.line);
    const bee = w.bugs.spawn('bee', 14.5, 14.5);
    hold(bee);
    const rng = mulberry32(5);
    const cx = 14.5 * c, cy = 14.5 * c, box = 2.5 * Ra;
    let x = cx + box * 0.8, y = cy, ang = 0, angryAt = null;
    w.pointerDown(x, y, 'mouse');
    for (let k = 0; k < 60 * 20 && !w.bites; k++) {
      ang += (rng() - 0.5) * 0.9;
      x += Math.cos(ang) * 400 * STEP; y += Math.sin(ang) * 400 * STEP;
      if (Math.abs(x - cx) > box || Math.abs(y - cy) > box) {
        ang = Math.atan2(cy - y, cx - x) + (rng() - 0.5);
        x = Math.max(cx - box, Math.min(cx + box, x)); y = Math.max(cy - box, Math.min(cy + box, y));
      }
      w.pointerMove(x, y, STEP);
      w.step(STEP);
      for (const e of w.drainFx()) {
        if (e[0] === 'bug' && e[1] === 'angry') angryAt = w.time;
        if (e[0] === 'bug' && e[1] === 'bite') assert.ok(w.time - angryAt >= WARN_MIN_S - 1e-9);
      }
    }
    assert.ok(w.bites >= 1, `${vw}x${vh}: scribbling beside a bee bites`);
    // One straight pass right through the middle, at a calm 150 px/s: warned, not bitten.
    const w2 = empty(10, { vw, vh });
    const b2 = w2.bugs.spawn('bee', 14.5, 14.5);
    hold(b2);
    let px = cx - 3 * Ra;
    w2.pointerDown(px, cy, 'mouse');
    while (px < cx + 3 * Ra) { px += 150 * STEP; w2.pointerMove(px, cy, STEP); w2.step(STEP); }
    w2.pointerUp();
    run(w2, 8);
    assert.equal(w2.warnings, 1);
    assert.equal(w2.bites, 0, `${vw}x${vh}: one slow pass through a bee never bites`);
  }
});

test('insects: a bite never takes the meter below 0', () => {
  const w = empty(6);
  const c = w.layout.cell;
  w.energy.set(0.01 * w.energy.line);
  const ant = w.bugs.spawn('ant', 5.5, 5.5);
  hold(ant);
  circle(w, 5.5 * c, 5.5 * c, 15, 1.7);
  assert.equal(w.bites, 1);
  assert.equal(w.energy.value, 0);
  // With more energy, exactly 3% of the line.
  const w2 = empty(6);
  w2.energy.set(0.5 * w2.energy.line);
  const a2 = w2.bugs.spawn('ant', 5.5, 5.5);
  hold(a2);
  let before = 0;
  let a = 0;
  w2.pointerDown(5.5 * c + 15, 5.5 * c, 'mouse');
  run(w2, 1.7, () => {
    // Sweep on low (already swept) grass only: no energy from the stroke.
    a += 0.25;
    if (w2.bites === 0) before = w2.energy.value;
    w2.pointerMove(5.5 * c + 15 * Math.cos(a), 5.5 * c + 15 * Math.sin(a), STEP);
  });
  assert.equal(w2.bites, 1);
  assert.ok(Math.abs((before - w2.energy.value) - BITE_FRAC * w2.energy.line) < 1e-6,
    `bite took ${before - w2.energy.value}, want ${BITE_FRAC * w2.energy.line}`);
});

test('insects: after a bite the biter flees to 1.5 x its radius, then can\'t get angry for 2 s', () => {
  const w = empty(6);
  const c = w.layout.cell;
  const Ra = angerRadiusPx(c);
  const ant = w.bugs.spawn('ant', 9.5, 5.5);
  hold(ant);
  const px = 9.5 * c, py = 5.5 * c;
  circle(w, px, py, 12, 1.6);
  assert.equal(w.bites, 1);
  assert.equal(ant.state, 'flee');
  // Leave the pointer down at the bite spot, still.
  const bx = w.pointer.x, by = w.pointer.y;
  let fled = null;
  run(w, 4, () => {
    if (fled === null && ant.state !== 'flee') fled = Math.hypot(ant.x * c - bx, ant.y * c - by);
  });
  assert.ok(fled !== null, 'stopped fleeing');
  assert.ok(fled >= FLEE_DIST * Ra - 1e-6, `fled to ${fled} px, want ${FLEE_DIST * Ra}`);
  // Cool-down: sweeping right over it doesn't anger it for 2 s after it stops fleeing.
  const w2 = empty(6);
  const b2 = w2.bugs.spawn('ant', 9.5, 5.5);
  hold(b2);
  circle(w2, px, py, 12, 1.6);
  while (b2.state === 'flee') w2.step(STEP);
  assert.ok(Math.abs(b2.cool - COOLDOWN_S) < 1e-9);
  hold(b2);
  circle(w2, b2.x * c, b2.y * c, 12, COOLDOWN_S - 0.1);
  assert.notEqual(b2.state, 'angry', 'cooling down');
  circle(w2, b2.x * c, b2.y * c, 12, 0.3);
  assert.equal(b2.state, 'angry', 'angry again after the cool-down');
});

test('insects: petting pays 2% of the line and 25 once per bug per field; more taps still hop', () => {
  const w = empty(3);
  const lb = w.bugs.spawn('ladybug', 7.5, 7.5);
  const lb2 = w.bugs.spawn('ladybug', 3.5, 3.5);
  const line = w.energy.line;
  const r1 = w.pet(lb);
  assert.deepEqual(r1, { first: true, species: 'ladybug' });
  assert.ok(Math.abs(w.energy.value - PET_FRAC * line) < 1e-9);
  assert.equal(w.petScore, PET_SCORE);
  const r2 = w.pet(lb);
  assert.equal(r2.first, false);
  assert.ok(Math.abs(w.energy.value - PET_FRAC * line) < 1e-9, 'no more energy');
  assert.equal(w.petScore, PET_SCORE);
  assert.equal(lb.pets, 2);
  w.pet(lb2);
  assert.ok(Math.abs(w.energy.value - 2 * PET_FRAC * line) < 1e-9, 'a second bug pays');
  assert.equal(w.petScore, 2 * PET_SCORE);
  assert.equal(w.petted, 2);
  const kinds = w.drainFx().filter((e) => e[0] === 'bug').map((e) => [e[1], e[3]]);
  w.step(STEP);
  const all = kinds.concat(w.drainFx().filter((e) => e[0] === 'bug' && e[1] === 'pet').map((e) => [e[1], e[3]]));
  assert.deepEqual(all, [['pet', true], ['pet', false], ['pet', true]]);
  // Biters can't be petted; a new field pays again.
  const ant = w.bugs.spawn('ant', 10.5, 10.5);
  assert.equal(w.pet(ant), null);
  const w2 = empty(3);
  assert.equal(w2.pet(w2.bugs.spawn('ladybug', 7.5, 7.5)).first, true);
});

test('insects: the friend under a press is found within its pet area', () => {
  const w = empty(3);
  const c = w.layout.cell;
  const lb = w.bugs.spawn('ladybug', 7.5, 7.5);
  w.bugs.spawn('ant', 3.5, 3.5);
  const r = petRadiusPx(c, 'ladybug');
  assert.equal(w.friendAt(7.5 * c + r - 1, 7.5 * c), lb);
  assert.equal(w.friendAt(7.5 * c + r + 1, 7.5 * c), null);
  assert.equal(w.friendAt(3.5 * c, 3.5 * c), null, 'a biter is never a pet target');
});

test('insects: strokes skip the cells under a bug; those cells count last for the whole field', () => {
  const w = empty(3);
  const c = w.layout.cell;
  const ant = w.bugs.spawn('ant', 7.5, 7.5);
  hold(ant);
  w.step(STEP);
  const under = [];
  for (let i = 0; i < w.grid.N; i++) if (w.grid.blocked[i]) under.push(i);
  assert.ok(under.length >= 1);
  const R = (UNDER_FRAC * bugSizePx(c)) / c;
  for (const i of under) {
    const dx = (i % w.grid.W) + 0.5 - 7.5, dy = Math.floor(i / w.grid.W) + 0.5 - 7.5;
    assert.ok(Math.hypot(dx, dy) <= R + 1e-9);
  }
  // Sweep every row: everything but the cells under the ant is touched.
  for (let r = 0; r < w.grid.H; r++) {
    w.pointerDown(0, (r + 0.5) * c, 'mouse');
    w.pointerMove(w.grid.W * c, (r + 0.5) * c, 0.2);
    w.pointerUp();
  }
  for (const i of under) {
    assert.equal(w.grid.touched[i], 0, 'skipped');
    assert.equal(w.grid.h[i], 1, 'not flattened');
  }
  assert.equal(w.grid.touchedCount, w.grid.validCount - under.length);
  assert.equal(w.grid.wholeField(), 1, 'cells under a bug count once every other cell is touched');
  // One other cell untouched: not whole yet.
  const w2 = empty(3);
  const a2 = w2.bugs.spawn('ant', 7.5, 7.5);
  hold(a2);
  w2.step(STEP);
  for (let r = 1; r < w2.grid.H; r++) {
    w2.pointerDown(0, (r + 0.5) * c, 'mouse');
    w2.pointerMove(w2.grid.W * c, (r + 0.5) * c, 0.2);
    w2.pointerUp();
  }
  assert.ok(w2.grid.wholeField() < 1);
});

test('insects: a sweep nudges a friendly aside (one brush-width) and never flattens the grass under it', () => {
  const w = empty(3);
  const c = w.layout.cell;
  const lb = w.bugs.spawn('ladybug', 7.5, 7.5);
  hold(lb);
  w.step(STEP);
  const R = w.brushRadiusPx('mouse') / c;
  w.pointerDown(0.5 * c, 7.6 * c, 'mouse');
  for (let x = 0.5; x <= 14.5; x += 0.25) w.pointerMove(x * c, 7.6 * c, STEP);
  w.pointerUp();
  const d = Math.abs(lb.y - 7.6);
  assert.ok(d >= 2 * R - 1e-6, `nudged to ${d} cells from the path (brush ${R})`);
  assert.ok(lb.x >= 0 && lb.x < w.grid.W && lb.y >= 0 && lb.y < w.grid.H);
  // The cells it sits on now were never flattened.
  w.bugs.updateBlocked();
  for (let i = 0; i < w.grid.N; i++) if (w.grid.blocked[i]) assert.equal(w.grid.h[i], 1);
});

test('insects: bugs keep to valid cells on shaped fields (L, cross, islands, octagon)', () => {
  for (const n of [6, 9, 14, 15]) {
    for (const [vw, vh] of [[390, 844], [1280, 800]]) {
      const w = new World(n, layoutFor(n, vw, vh), { collectFx: false });
      for (let k = 0; k < 60 * 60; k++) {
        w.step(STEP);
        if (k % 10) continue;
        for (const b of w.bugs.list) {
          const i = Math.floor(b.y) * w.grid.W + Math.floor(b.x);
          assert.equal(w.grid.valid[i], 1, `field ${n} ${b.sp} at ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
        }
      }
    }
  }
});

test('insects: bugs are deterministic per field (a solution replays)', () => {
  const a = new World(15, layoutFor(15), { collectFx: false });
  const b = new World(15, layoutFor(15), { collectFx: false });
  for (let k = 0; k < 600; k++) { a.step(STEP); b.step(STEP); }
  assert.deepEqual(a.bugs.list.map((x) => [x.sp, x.x, x.y, x.state]), b.bugs.list.map((x) => [x.sp, x.x, x.y, x.state]));
});
