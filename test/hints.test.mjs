// test/hints.test.mjs -- hint cards are shown once (GAME_DESIGN.md
// "Structure and difficulty"), the Bug Garden data saved on a first pet, and
// the tap-or-sweep rule (350 ms / 14 px).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { HINTS, hintFor, hintsSeenList } from '../game/src/hints.mjs';
import { hintsSeen, markHintSeen, befriend, gardenOf, readSave, SAVE_KEY } from '../game/src/storage.mjs';
import { PressWait, TAP_MAX_S, TAP_MAX_PX } from '../game/src/input/tap.mjs';
import { unlockedMoves } from '../game/src/sim/moves.mjs';
import { SPAWNS } from '../game/src/sim/insects.mjs';

// A tiny in-memory localStorage.
function installStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  return m;
}

beforeEach(() => { installStorage(); });

test('hints: one per field, unique ids; field 1 teaches by doing (ghost hand, no card)', () => {
  assert.equal(HINTS.length, 15);
  assert.equal(new Set(HINTS.map((h) => h.id)).size, 15);
  for (let n = 1; n <= 15; n++) assert.equal(HINTS.filter((h) => h.field === n).length, 1, `field ${n}`);
  assert.equal(hintFor(1, []), null);
  for (let n = 2; n <= 15; n++) assert.ok(hintFor(n, []), `field ${n} has a card`);
});

test('hints: each card names what\'s new (its move unlock, its first bug) and draws them from game art', () => {
  const firstBug = {};
  for (let n = 1; n <= 15; n++) for (const sp of Object.keys(SPAWNS[n])) if (!(sp in firstBug)) firstBug[sp] = n;
  for (const h of HINTS) {
    const arts = h.art.map((a) => a.bug || a.move || a.tuft || (a.hand && 'hand') || (a.leaf && 'leaf') || (a.arrow && 'arrow'));
    assert.ok(arts.every(Boolean), h.id);
    const newMove = unlockedMoves(h.field).find((k) => !unlockedMoves(h.field - 1).includes(k));
    if (newMove) assert.ok(arts.includes(newMove), `${h.id} shows the ${newMove} icon`);
    for (const [sp, n] of Object.entries(firstBug)) if (n === h.field) assert.ok(arts.includes(sp), `${h.id} shows the ${sp}`);
  }
});

test('hints: a hint seen is never shown again, and How to play lists the hints seen so far', () => {
  assert.deepEqual(hintsSeen(), []);
  const h6 = hintFor(6, hintsSeen());
  assert.equal(h6.id, 'ant-ring');
  markHintSeen(h6.id);
  assert.deepEqual(hintsSeen(), ['ant-ring']);
  assert.equal(hintFor(6, hintsSeen()), null, 'not again');
  assert.equal(hintFor(7, hintsSeen()).id, 'snail', 'others still show');
  markHintSeen('sweep');
  markHintSeen('stiff-line');
  assert.deepEqual(hintsSeenList(hintsSeen()).map((h) => h.id), ['sweep', 'ant-ring', 'stiff-line'], 'field order');
  // Saved in the one key.
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).hints['ant-ring'], true);
});

test('bug garden: a first meeting is new; later pets add the field once; first met is kept', () => {
  const t0 = new Date('2026-11-20T10:00:00Z');
  assert.deepEqual(befriend('ladybug', 3, t0), { isNew: true });
  assert.deepEqual(befriend('ladybug', 4, new Date('2026-11-21T10:00:00Z')), { isNew: false });
  assert.deepEqual(befriend('ladybug', 3), { isNew: false });
  const g = gardenOf();
  assert.deepEqual(g.ladybug, { firstMet: t0.toISOString(), fields: [3, 4] });
  assert.deepEqual(befriend('snail', 7, t0), { isNew: true });
  assert.deepEqual(Object.keys(gardenOf(readSave())).sort(), ['ladybug', 'snail']);
});

test('tap or sweep: released within 350 ms after moving under 14 px is a tap; else a sweep', () => {
  assert.equal(TAP_MAX_S, 0.35);
  assert.equal(TAP_MAX_PX, 14);
  const bug = { id: 1 };
  const a = new PressWait(bug, 100, 100, 10);
  assert.equal(a.move({ x: 105, y: 100, t: 10.05 }), 'wait');
  assert.equal(a.move({ x: 108, y: 104, t: 10.1 }), 'wait');
  assert.equal(a.up(10.12), 'tap');
  assert.equal(a.bug, bug, 'latched at press');
  // Moved 14 px in total (back and forth counts): a sweep.
  const b = new PressWait(bug, 100, 100, 10);
  b.move({ x: 107, y: 100, t: 10.02 });
  assert.equal(b.move({ x: 100, y: 100, t: 10.04 }), 'drag');
  // Held too long: a sweep (even without moving).
  const c = new PressWait(bug, 100, 100, 10);
  assert.equal(c.expired(10.3), false);
  assert.equal(c.expired(10.36), true);
  assert.equal(c.up(10.4), 'drag');
  // A relaxed 300 ms tap with a 10 px wobble is still a pet (the plan's
  // 200 ms / 10 px made it a sweep).
  const d = new PressWait(bug, 50, 50, 1);
  d.move({ x: 56, y: 58, t: 1.2 });
  assert.equal(d.up(1.3), 'tap');
});
