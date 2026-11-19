// test/smoke.test.mjs -- unit smoke tests for the state machine.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getState, setState, __resetForTests } from '../game/src/state.mjs';

test('state: starts in title', () => {
  __resetForTests();
  assert.equal(getState(), 'title');
});

test('state: title -> playing is allowed', () => {
  __resetForTests();
  setState('playing');
  assert.equal(getState(), 'playing');
});

test('state: invalid transition throws in dev mode', () => {
  __resetForTests();
  // title -> level-won is not a valid transition.
  assert.throws(() => setState('level-won'), /Invalid transition/);
  assert.equal(getState(), 'title');
});

test('state: unknown state throws in dev mode', () => {
  __resetForTests();
  assert.throws(() => setState('not-a-state'), /Invalid state/);
});
