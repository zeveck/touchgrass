// test/moves.test.mjs -- the three moves (GAME_DESIGN.md "Moves"): unlocks,
// sizes, the price rule (the meter is never higher after any move, across
// random aims and field states), each move's job (Ring calms biters, Line
// flattens stiff grass in one go, Full Clear touches every blade), the Line's
// off-field release, cells under bugs skipped and not charged, and no field
// won in under 10 s with moves and a head start.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World, STEP } from '../game/src/sim/world.mjs';
import { computeLayout } from '../game/src/sim/layout.mjs';
import { getLevel, LEVELS } from '../game/src/sim/levels.mjs';
import { mulberry32 } from '../game/src/sim/rng.mjs';
import { T_STIFF, MULT } from '../game/src/sim/types.mjs';
import { STAND_H } from '../game/src/sim/grid.mjs';
import { runField } from '../game/src/sim/solver.mjs';
import {
  unlockedMoves, MOVE_UNLOCK, ringRadiusCells, lineHalfWidthCells, linePath, priceOf,
} from '../game/src/sim/moves.mjs';

function layoutFor(n, vw = 1280, vh = 800) {
  const s = getLevel(n);
  return computeLayout(vw, vh, s.w, s.h);
}

test('moves: Ring unlocks on field 6, Line on 9, Full Clear on 11, and stay on later fields', () => {
  assert.deepEqual(MOVE_UNLOCK, { ring: 6, line: 9, clear: 11 });
  for (let n = 1; n <= 5; n++) assert.deepEqual(unlockedMoves(n), []);
  for (const n of [6, 7, 8]) assert.deepEqual(unlockedMoves(n), ['ring']);
  for (const n of [9, 10]) assert.deepEqual(unlockedMoves(n), ['ring', 'line']);
  for (let n = 11; n <= 15; n++) assert.deepEqual(unlockedMoves(n), ['ring', 'line', 'clear']);
});

test('moves: sizes (Ring max(3 cells, 2.5 brush), Line 3 x brush wide)', () => {
  assert.equal(ringRadiusCells(1), 3);
  assert.equal(ringRadiusCells(2), 5);
  assert.equal(lineHalfWidthCells(2), 3);
  const w = new World(6, layoutFor(6), { bugs: false });
  const a = w.moveArea('ring', { x: 10.5, y: 5.5 }, 'mouse');
  const rc = ringRadiusCells(w.brushCells('mouse'));
  assert.equal(a.rc, rc);
  for (const i of a.cells) {
    assert.ok(Math.hypot((i % w.grid.W) + 0.5 - 10.5, Math.floor(i / w.grid.W) + 0.5 - 5.5) <= rc + 1e-9);
  }
});

// Put a field in a random state: random strokes and random waits.
function scramble(w, rng, secs) {
  const c = w.layout.cell;
  const steps = Math.round(secs / STEP);
  let x = rng() * w.grid.W * c, y = rng() * w.grid.H * c, down = false;
  for (let k = 0; k < steps; k++) {
    if (!down && rng() < 0.3) { w.pointerDown(x, y, 'mouse'); down = true; }
    if (down) {
      x = Math.max(0, Math.min(w.grid.W * c, x + (rng() - 0.5) * 40));
      y = Math.max(0, Math.min(w.grid.H * c, y + (rng() - 0.5) * 40));
      w.pointerMove(x, y, STEP);
      if (rng() < 0.02) { w.pointerUp(); down = false; }
    }
    w.step(STEP);
  }
  w.pointerUp();
}

test('moves: the price rule -- after any move the meter is never higher, across random aims and states', () => {
  let fired = 0, refused = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mulberry32(seed * 977);
    const n = 6 + (seed % 10);
    const w = new World(n, layoutFor(n, seed % 2 ? 390 : 1280, seed % 2 ? 844 : 800), { bugSeed: seed });
    scramble(w, rng, 3 + rng() * 25);
    w.energy.set(rng() * w.energy.line * 0.9);
    for (let m = 0; m < 12; m++) {
      const kinds = unlockedMoves(n);
      const kind = kinds[Math.floor(rng() * kinds.length)];
      let arg = {};
      if (kind === 'ring') arg = { x: -3 + rng() * (w.grid.W + 6), y: -3 + rng() * (w.grid.H + 6) };
      if (kind === 'line') {
        const path = [];
        let px = -4 + rng() * (w.grid.W + 8), py = -4 + rng() * (w.grid.H + 8);
        for (let j = 0; j < 2 + rng() * 6; j++) {
          path.push([px, py]);
          px += (rng() - 0.5) * 20; py += (rng() - 0.5) * 20;
        }
        arg = { path };
      }
      const pt = rng() < 0.5 ? 'touch' : 'mouse';
      const before = w.energy.value;
      const price = w.movePrice(kind, arg, pt);
      const res = w.fireMove(kind, arg, pt);
      assert.ok(w.energy.value <= before + 1e-9, `seed ${seed} ${kind}: ${before} -> ${w.energy.value}`);
      assert.ok(w.energy.value >= 0);
      if (res.fired) {
        fired++;
        assert.ok(price.gain <= price.cost + 1e-9);
        assert.ok(Math.abs(w.energy.value - (before - price.cost + price.gain)) < 1e-6, 'paid and paid back at once');
      } else {
        refused++;
        assert.equal(w.energy.value, before, 'nothing charged when it can\'t fire');
        if (res.reason === 'afford') assert.ok(price.cost > before);
      }
      scramble(w, rng, rng() * 3);
    }
  }
  assert.ok(fired > 100 && refused > 0, `fired ${fired}, refused ${refused}`);
});

test('moves: a move flattens standing grass (mult x h) for the full-height price; low grass is touched free', () => {
  const w = new World(6, layoutFor(6), { bugs: false });
  const g = w.grid;
  const area = w.moveArea('ring', { x: 5.5, y: 5.5 }, 'mouse');
  // Half the cells low, half at assorted standing heights.
  area.cells.forEach((i, j) => { g.h[i] = j % 2 ? 0.2 : 0.4 + 0.6 * ((j * 37) % 11) / 10; });
  let cost = 0, gain = 0;
  for (const i of area.cells) if (g.h[i] >= STAND_H) { cost += MULT[g.type[i]]; gain += MULT[g.type[i]] * g.h[i]; }
  const p = priceOf(g, area.cells);
  assert.ok(Math.abs(p.cost - cost) < 1e-6 && Math.abs(p.gain - gain) < 1e-6);
  w.energy.set(cost + 5);
  const lowBefore = area.cells.filter((i) => g.h[i] < STAND_H).map((i) => [i, g.h[i]]);
  const res = w.fireMove('ring', { x: 5.5, y: 5.5 }, 'mouse');
  assert.equal(res.fired, true);
  assert.ok(Math.abs(w.energy.value - (cost + 5 - cost + gain)) < 1e-6);
  for (const i of area.cells) assert.equal(g.touched[i], 1);
  for (const [i, h] of lowBefore) assert.equal(g.h[i], h, 'low grass keeps its height');
  for (const i of area.cells) if (!lowBefore.some(([k]) => k === i)) assert.equal(g.h[i], 0);
});

test('moves: can\'t afford it -> nothing fires, nothing charged', () => {
  const w = new World(6, layoutFor(6), { bugs: false });
  w.energy.set(1);
  const h0 = w.grid.h.slice();
  const res = w.fireMove('ring', { x: 5.5, y: 5.5 }, 'mouse');
  assert.equal(res.fired, false);
  assert.equal(res.reason, 'afford');
  assert.equal(w.energy.value, 1);
  assert.deepEqual(w.grid.h, h0);
});

test('moves: the Ring calms every biter in its disc (they flee); friendlies are never harmed', () => {
  const w = new World(9, layoutFor(9), { bugs: false });
  w.energy.set(0.9 * w.energy.line);
  const ant = w.bugs.spawn('ant', 13.5, 13.5);
  const far = w.bugs.spawn('ant', 13.5, 3.5);
  const lb = w.bugs.spawn('ladybug', 14.5, 12.5);
  ant.state = 'angry'; ant.angerT = 1.2;
  w.step(STEP);
  const under = [];
  for (let i = 0; i < w.grid.N; i++) if (w.grid.blocked[i]) under.push(i);
  const res = w.fireMove('ring', { x: 13.5, y: 13.5 }, 'mouse');
  assert.equal(res.fired, true);
  assert.equal(ant.state, 'flee');
  assert.notEqual(far.state, 'flee', 'outside the disc');
  assert.equal(lb.state === 'flee', false);
  // Cells under bugs were skipped and not charged.
  for (const i of under) {
    if (!res.price.area.cells.includes(i)) continue;
    assert.equal(w.grid.h[i], 1);
  }
  assert.equal(res.price.cells, res.price.area.cells.filter((i) => !under.includes(i)).length);
  run(w, 3);
  assert.ok(Math.hypot(ant.x - 13.5, ant.y - 13.5) > 3, 'it ran off');
});

function run(w, secs) { for (let k = 0; k < Math.round(secs / STEP); k++) w.step(STEP); }

test('moves: a Line passing over a biter calms it too', () => {
  const w = new World(9, layoutFor(9), { bugs: false });
  w.energy.set(0.9 * w.energy.line);
  const ant = w.bugs.spawn('ant', 13.5, 13.5);
  const res = w.fireMove('line', { path: [[1, 13.2], [26, 13.2]] }, 'mouse');
  assert.equal(res.fired, true);
  assert.equal(ant.state, 'flee');
});

test('moves: the Line flattens stiff grass in one go (no fresh stroke needed)', () => {
  const w = new World(9, layoutFor(9), { bugs: false });
  const g = w.grid;
  w.energy.set(0.9 * w.energy.line);
  const row = 13;
  const stiff = [];
  for (let c = 0; c < g.W; c++) {
    const i = row * g.W + c;
    if (g.valid[i]) { g.type[i] = T_STIFF; stiff.push(i); }
  }
  assert.ok(stiff.every((i) => g.isStiff(i)));
  const res = w.fireMove('line', { path: [[0.5, row + 0.5], [26.5, row + 0.5]] }, 'mouse');
  assert.equal(res.fired, true);
  for (const i of stiff) assert.equal(g.h[i], 0, 'flattened at once');
  // A stroke would only have loosened it.
  const w2 = new World(9, layoutFor(9), { bugs: false });
  const i2 = row * w2.grid.W + 13;
  w2.grid.type[i2] = T_STIFF;
  const c = w2.layout.cell;
  w2.pointerDown(0.5 * c, (row + 0.5) * c, 'mouse');
  w2.pointerMove(26.5 * c, (row + 0.5) * c, 0.2);
  assert.equal(w2.grid.h[i2], 1);
  assert.ok(w2.grid.isLoosened(i2));
});

test('moves: a Line released past the edge fires its on-field part; one that never touches fires nothing', () => {
  const w = new World(9, layoutFor(9), { bugs: false });
  const g = w.grid;
  w.energy.set(0.9 * w.energy.line);
  // Field 9 is a cross: from the middle out past the right edge.
  const path = [[13.5, 13.5], [40, 13.5]];
  const lp = linePath(g, path);
  assert.ok(lp.length >= 2);
  const res = w.fireMove('line', { path }, 'mouse');
  assert.equal(res.fired, true);
  assert.equal(g.h[13 * g.W + 25], 0, 'cells near the edge flattened');
  // Never on the field (the cross's empty corner, and outside).
  const before = w.energy.value;
  const h0 = g.h.slice();
  const off = w.fireMove('line', { path: [[1, 1], [6, 2], [-5, -5]] }, 'mouse');
  assert.equal(off.fired, false);
  assert.equal(off.reason, 'empty');
  assert.equal(w.energy.value, before);
  assert.deepEqual(g.h, h0);
  // At most the field's width long.
  const long = linePath(g, [[9.5, 0.5], [9.5, 26.5], [17.5, 26.5], [17.5, 0.5]]);
  let L = 0;
  for (let k = 1; k < long.length; k++) L += Math.hypot(long[k][0] - long[k - 1][0], long[k][1] - long[k - 1][1]);
  assert.ok(Math.abs(L - 27) < 1e-6, `length ${L}`);
});

test('moves: the Ring\'s aim is clamped to the field\'s shape', () => {
  const w = new World(6, layoutFor(6), { bugs: false });
  const a = w.moveArea('ring', { x: 18, y: 18 }, 'mouse');   // in the L's notch
  const i = Math.floor(a.y) * w.grid.W + Math.floor(a.x);
  assert.equal(w.grid.valid[i], 1);
  assert.ok(a.cells.length > 0);
});

test('moves: Full Clear touches every blade (the whole field is done), skipping cells under bugs', () => {
  const w = new World(15, layoutFor(15), {});
  w.step(STEP);
  w.energy.set(0.9 * w.energy.line);
  const under = [];
  for (let i = 0; i < w.grid.N; i++) if (w.grid.blocked[i]) under.push(i);
  assert.ok(under.length > 0);
  const res = w.fireMove('clear', {}, 'mouse');
  assert.equal(res.fired, true);
  assert.equal(w.grid.wholeField(), 1);
  for (const i of under) assert.equal(w.grid.h[i], 1, 'grass under a bug is never flattened');
  // ...and stays whole after the bugs wander off.
  run(w, 10);
  assert.equal(w.grid.wholeField(), 1);
});

test('moves: typical prices are a few percent for the Ring and Line, at most 1/k for Full Clear', () => {
  const w6 = new World(6, layoutFor(6), { bugs: false });
  const r6 = w6.typicalPrice('ring', 'mouse');
  assert.ok(r6 > 0.02 && r6 < 0.07, `ring field 6 ${r6}`);
  const w9 = new World(9, layoutFor(9), { bugs: false });
  const l9 = w9.typicalPrice('line', 'mouse');
  assert.ok(l9 > 0.03 && l9 < 0.15, `line field 9 ${l9}`);
  for (const n of [11, 15]) {
    const w = new World(n, layoutFor(n), { bugs: false });
    const c = w.typicalPrice('clear', 'mouse');
    assert.ok(Math.abs(c - 1 / getLevel(n).k) < 1e-9, `clear field ${n} ${c}`);
  }
});

test('moves: no field is won in under 10 s, with any moves and a head start', () => {
  // Random moves cost energy (some runs never win in the time allowed, which
  // is fine): the point is that none wins quickly.
  let runs = 0, wins = 0;
  for (const l of LEVELS) {
    for (const lay of ['phone', 'desktop']) {
      for (const prof of ['fast', 'scribble']) {
        const rng = mulberry32(l.n * 31 + (lay === 'phone' ? 1 : 2));
        const kinds = unlockedMoves(l.n);
        const r = runField(l.n, lay, prof, {
          headStart: true,
          tmax: 180,
          onStep: (w) => {
            // A move every four seconds or so, anywhere.
            if (!kinds.length || rng() > 0.004) return;
            const kind = kinds[Math.floor(rng() * kinds.length)];
            const arg = kind === 'ring' ? { x: rng() * w.grid.W, y: rng() * w.grid.H }
              : kind === 'line' ? { path: [[rng() * w.grid.W, rng() * w.grid.H], [rng() * w.grid.W, rng() * w.grid.H]] } : {};
            const before = w.energy.value;
            w.fireMove(kind, arg, 'mouse');
            assert.ok(w.energy.value <= before + 1e-9);
          },
        });
        runs++;
        if (!r.won) continue;
        wins++;
        assert.ok(r.time >= 10, `field ${l.n} ${lay} ${prof}: won in ${r.time} s`);
      }
    }
  }
  assert.ok(wins >= runs / 2, `${wins} of ${runs} runs won`);
  // The quickest case of all: field 2 with a head start, no moves (moves
  // never add to the meter, so they can't make it quicker).
  for (const lay of ['phone', 'desktop']) {
    for (const prof of ['fast', 'scribble']) {
      const r = runField(2, lay, prof, { headStart: true });
      assert.ok(r.won && r.time >= 10, `field 2 ${lay} ${prof} with a head start: ${r.time} s`);
    }
  }
});
