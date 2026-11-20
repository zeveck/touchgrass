// test/state.test.mjs -- the extended state machine: every state has a way
// out, and the milestone-1 flow (title -> play -> pause -> won -> ending).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getState, getPrevious, setState, canTransition, __resetForTests, STATE_NAMES, STATE_TRANSITIONS,
} from '../game/src/state.mjs';

test('state: every state has a way out, and every target is a known state', () => {
  for (const s of STATE_NAMES) {
    const outs = STATE_TRANSITIONS[s];
    assert.ok(Array.isArray(outs) && outs.length > 0, `${s} has exits`);
    for (const t of outs) assert.ok(STATE_NAMES.includes(t), `${s} -> ${t}`);
  }
});

test('state: every state can reach the title', () => {
  for (const s of STATE_NAMES) {
    const seen = new Set([s]);
    const q = [s];
    while (q.length) {
      const x = q.shift();
      for (const t of STATE_TRANSITIONS[x]) if (!seen.has(t)) { seen.add(t); q.push(t); }
    }
    assert.ok(seen.has('title'), `${s} reaches title`);
  }
});

test('state: milestone-1 flow and previous()', () => {
  __resetForTests();
  setState('playing');
  setState('paused');
  assert.equal(getPrevious(), 'playing');
  setState('playing');
  setState('level-won');
  setState('playing');           // next field
  setState('level-won');
  setState('ending');            // after field 15
  assert.equal(getState(), 'ending');
  setState('title');
  assert.equal(getPrevious(), 'ending');
  assert.equal(canTransition('title', 'level-won'), false);
  assert.equal(canTransition('playing', 'paused'), true);
});
