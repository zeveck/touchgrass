// test/review.test.mjs -- fixes from the final review that are plain logic:
// names lose bidi and zero-width marks and are cut by code points, saved
// scores are clamped, an old `progress.level` save plays its first unfinished
// unlocked field, and a failing save is reported once.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { cleanName, NAME_MAX } from '../game/src/prefs.mjs';
import {
  migrate, readSave, writeSave, nextUnfinished, isUnlocked, onSaveFail, SAVE_KEY, SCORE_MAX,
} from '../game/src/storage.mjs';
import { SCORE_MAX as LINK_SCORE_MAX, parseChallenge } from '../game/src/share/link.mjs';

let failing = false;
function installStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (failing) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
  };
}
beforeEach(() => { failing = false; installStorage(); });

test('names: bidi controls and zero-width marks are stripped', () => {
  // U+202E (right-to-left override) would flip the text after it.
  assert.equal(cleanName('Sam‮evil'), 'Samevil');
  for (const c of ['​', '‌', '‍', '‎', '‏', '‪', '‫', '‬', '‭', '‮',
    '⁦', '⁧', '⁨', '⁩']) {
    assert.equal(cleanName(`A${c}b`), 'Ab', `U+${c.codePointAt(0).toString(16)}`);
  }
  assert.equal(cleanName('⁧​'), '', 'nothing but marks is no name');
  // A challenge link's name is cleaned the same way.
  assert.equal(parseChallenge('?f=3&s=10&n=' + encodeURIComponent('Jo‮ey')).n, 'Joey');
});

test('names: cut to 12 code points, so an emoji is never split', () => {
  const name = '\u{1F41E}'.repeat(15);   // 15 ladybugs, 30 UTF-16 units
  const c = cleanName(name);
  assert.equal(Array.from(c).length, NAME_MAX);
  assert.equal(c, '\u{1F41E}'.repeat(NAME_MAX));
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(c), 'no lone surrogate');
  assert.equal(cleanName('abcdefghijklmnop'), 'abcdefghijkl');
});

test('storage: saved bests and the all-time best are clamped to the score maximum', () => {
  assert.equal(SCORE_MAX, 999999);
  assert.equal(LINK_SCORE_MAX, SCORE_MAX, 'one maximum for saves and links');
  const m = migrate({ progress: { fields: { 2: { best: 1e12 }, 3: { best: 500 } } }, allTimeBest: 5e9 });
  assert.equal(m.progress.fields[2].best, SCORE_MAX);
  assert.equal(m.progress.fields[3].best, 500);
  assert.equal(m.allTimeBest, SCORE_MAX);
  assert.equal(migrate({ allTimeBest: Infinity }).allTimeBest, 0);
});

test('storage: an old progress.level save plays its first unfinished unlocked field, everywhere', () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ progress: { level: 5 } }));
  let s = readSave();
  assert.equal(s.progress.unlocked, 5);
  for (let n = 1; n <= 5; n++) assert.ok(isUnlocked(n, s));
  assert.ok(!isUnlocked(6, s));
  assert.equal(nextUnfinished(s), 1, 'nothing is recorded as finished: field 1');
  // Some finished: the first gap, never a locked field.
  localStorage.setItem(SAVE_KEY, JSON.stringify({ progress: { level: 5, fields: { 1: { best: 300 }, 2: { best: 400 }, 4: { best: 500 } } } }));
  s = readSave();
  assert.equal(nextUnfinished(s), 3);
  assert.ok(isUnlocked(nextUnfinished(s), s));
  // All unlocked ones finished: the newly unlocked next field.
  localStorage.setItem(SAVE_KEY, JSON.stringify({ progress: { level: 3, fields: { 1: { best: 1 }, 2: { best: 1 }, 3: { best: 1 } } } }));
  s = readSave();
  assert.equal(s.progress.unlocked, 4);
  assert.equal(nextUnfinished(s), 4);
  // Once written back, the save is in the current shape and reads the same.
  writeSave({ settings: { music: 0.5 } });
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  assert.equal(raw.progress.level, undefined);
  assert.equal(raw.progress.unlocked, 4);
  assert.equal(nextUnfinished(readSave()), 4);
});

test('storage: a failing save (full or blocked) is reported once, and the game carries on', () => {
  let told = 0;
  onSaveFail(() => { told++; });
  writeSave({ settings: { music: 0.4 } });
  assert.equal(told, 0);
  failing = true;
  assert.doesNotThrow(() => writeSave({ settings: { music: 0.3 } }));
  writeSave({ settings: { music: 0.2 } });
  writeSave({ settings: { music: 0.1 } });
  assert.equal(told, 1, 'told once, not on every save');
  onSaveFail(null);
});
