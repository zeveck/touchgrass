// src/state.mjs -- minimal state machine for Touch Grass.
//
// States: 'title' | 'playing' | 'paused' | 'level-won' | 'settings' | 'farm'
//         | 'hint' | 'map' | 'ending' | 'challenge' | 'garden'
// ('garden' is the design's Bug Garden; 'farm' stays for the title's current
// button until the garden screen lands.)
//
// Exposes: getState(), getPrevious(), setState(next), onChange(cb)
// Invalid transitions throw in dev mode (anywhere the host isn't a production
// hostname -- matches the dev-level-skip guard in main.mjs). In production an
// invalid transition is logged and the title (the nearest safe screen) is
// shown instead of being silently ignored.

const STATES = Object.freeze([
  'title',
  'playing',
  'paused',
  'level-won',
  'settings',
  'farm',
  'hint',
  'map',
  'ending',
  'challenge',
  'garden',
]);

// Allowed transitions. Kept permissive for Phase 1 -- later phases will
// tighten this where needed. Entries are "from" -> array of allowed "to".
const TRANSITIONS = Object.freeze({
  title:       ['playing', 'settings', 'farm', 'garden', 'map', 'challenge'],
  playing:     ['paused', 'level-won', 'title', 'hint'],
  paused:      ['playing', 'title', 'settings', 'map'],
  'level-won': ['playing', 'title', 'map', 'ending'],
  settings:    ['title', 'playing', 'paused', 'map', 'garden'],
  farm:        ['title'],
  hint:        ['playing', 'paused'],
  map:         ['playing', 'title', 'garden', 'settings'],
  ending:      ['title', 'map', 'playing'],
  challenge:   ['playing', 'title'],
  garden:      ['title', 'map', 'settings'],
});

let current = 'title';
let previous = null;
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

// The state before the current one (for "return to previous" screens).
export function getPrevious() {
  return previous;
}

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
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
    // eslint-disable-next-line no-console
    console.error(`Invalid transition: ${current} -> ${next}; showing the title`);
    if (current === 'title') return;
    next = 'title';
  }
  const prev = current;
  previous = prev;
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
  previous = null;
  listeners.clear();
}

export const STATE_NAMES = STATES;
export const STATE_TRANSITIONS = TRANSITIONS;
