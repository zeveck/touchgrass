// src/state.mjs -- minimal state machine for Touch Grass.
//
// States: 'title' | 'playing' | 'paused' | 'level-won' | 'settings' | 'farm'
//
// Exposes: getState(), setState(next), onChange(cb)
// Invalid transitions throw in dev mode (anywhere the host isn't a production
// hostname -- matches the dev-level-skip guard in main.mjs).

const STATES = Object.freeze([
  'title',
  'playing',
  'paused',
  'level-won',
  'settings',
  'farm',
]);

// Allowed transitions. Kept permissive for Phase 1 -- later phases will
// tighten this where needed. Entries are "from" -> array of allowed "to".
const TRANSITIONS = Object.freeze({
  title:       ['playing', 'settings', 'farm'],
  playing:     ['paused', 'level-won', 'title'],
  paused:      ['playing', 'title', 'settings'],
  'level-won': ['playing', 'title'],
  settings:    ['title', 'playing', 'paused'],
  farm:        ['title'],
});

let current = 'title';
const listeners = new Set();

function isDevMode() {
  // In node (tests), there is no `location` -- treat that as dev.
  if (typeof location === 'undefined') return true;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^(10|172|192)\./.test(host)) return true;
  return false;
}

export function getState() {
  return current;
}

export function setState(next) {
  if (!STATES.includes(next)) {
    if (isDevMode()) {
      throw new Error(`Invalid state: ${next}`);
    }
    return;
  }
  if (next === current) return;
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    if (isDevMode()) {
      throw new Error(`Invalid transition: ${current} -> ${next}`);
    }
    return;
  }
  const prev = current;
  current = next;
  for (const cb of listeners) {
    try {
      cb(current, prev);
    } catch (err) {
      // Never let a listener crash the state machine.
      // eslint-disable-next-line no-console
      console.error('state onChange listener threw:', err);
    }
  }
}

export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Test-only hook: reset state to 'title'. Exposed for unit tests so they can
// run in any order. Not part of the public runtime API.
export function __resetForTests() {
  current = 'title';
  listeners.clear();
}

export const STATE_NAMES = STATES;
