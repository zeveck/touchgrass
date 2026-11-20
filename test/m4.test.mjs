// test/m4.test.mjs -- milestone 4 (the whole game): the score formula, the
// save's shape (touchgrass.v1), challenge links, the map layout, and the
// every-button transition walk.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { fieldScore, scoreOf, fmtScore, SCORE } from '../game/src/sim/score.mjs';
import {
  readSave, writeSave, migrate, recordResult, nextUnfinished, allDone, totalScore, setHeadStart, takeHeadStart,
  headStartFor, clearSave, hasProgress, isUnlocked, befriend, SAVE_KEY,
} from '../game/src/storage.mjs';
import { normalize, cleanName, DEFAULTS } from '../game/src/prefs.mjs';
import { parseChallenge, stripChallenge, hasChallengeParams, challengeUrl, challengeLine, FALLBACK_NAME } from '../game/src/share/link.mjs';
import { runShare } from '../game/src/share/flow.mjs';
import { mapLayout, MIN_TOKEN, LABEL, HEADER, PORTRAIT, LANDSCAPE } from '../game/src/ui/maplayout.mjs';
import { NAV, RETURNS, go } from '../game/src/nav.mjs';
import {
  STATE_NAMES, canTransition, setState, getState, __resetForTests,
} from '../game/src/state.mjs';
import { LEVELS } from '../game/src/sim/levels.mjs';
import { heartsFor, firstFieldOf, FRIENDS } from '../game/src/ui/garden.mjs';
import { checklistFor } from '../game/src/hints.mjs';

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

// ---- score -------------------------------------------------------------------

test('score: field x 100 + whole 250 + 2 per second under par (max 100) + 25 per pet', () => {
  assert.equal(scoreOf({ n: 1, time: 40, par: 30, whole: 0.5, petted: 0 }), 100);
  assert.equal(scoreOf({ n: 1, time: 20, par: 30, whole: 0.5, petted: 0 }), 120);
  assert.equal(scoreOf({ n: 1, time: 20.6, par: 30, whole: 0.5, petted: 0 }), 118, 'whole seconds under par');
  assert.equal(scoreOf({ n: 3, time: 0, par: 40, whole: 1, petted: 1 }), 300 + 250 + 80 + 25);
  assert.equal(scoreOf({ n: 15, time: 10, par: 100, whole: 1, petted: 9 }), 1500 + 250 + 100 + 225, 'speed caps at 100');
  assert.equal(scoreOf({ n: 7, time: 70, par: 55, whole: 0.999, petted: 2 }), 750, 'no whole bonus under 100%');
  const parts = fieldScore({ n: 2, time: 30, par: 35, whole: 1, petted: 0 });
  assert.deepEqual([parts.field, parts.whole, parts.speed, parts.pets, parts.total], [200, 250, 10, 0, 460]);
  assert.equal(SCORE.speedMax, 100);
});

test('score: formatting with commas', () => {
  assert.equal(fmtScore(0), '0');
  assert.equal(fmtScore(999), '999');
  assert.equal(fmtScore(1240), '1,240');
  assert.equal(fmtScore(999999), '999,999');
});

// ---- the save ------------------------------------------------------------------

test('storage: a fresh save has the full shape under one key', () => {
  const s = readSave();
  assert.deepEqual(s, { version: 1, settings: {}, progress: { unlocked: 1, fields: {} }, allTimeBest: 0, headStart: null });
  assert.equal(hasProgress(), false);
  assert.equal(nextUnfinished(), 1);
  assert.equal(localStorage.getItem(SAVE_KEY), null, 'reading never writes');
});

test('storage: a win unlocks the next field, keeps the best, and the all-time best', () => {
  let r = recordResult(1, { score: 300, cleared: false });
  assert.deepEqual(r, { best: 300, prevBest: null, isBest: true, allTimeBest: 300 });
  r = recordResult(1, { score: 250, cleared: true });
  assert.equal(r.best, 300);
  assert.equal(r.isBest, false);
  r = recordResult(2, { score: 460, cleared: true });
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  assert.equal(s.version, 1);
  assert.deepEqual(s.progress, { unlocked: 3, fields: { 1: { best: 300, cleared: true }, 2: { best: 460, cleared: true } } });
  assert.equal(s.allTimeBest, 460);
  assert.equal(nextUnfinished(), 3);
  assert.equal(isUnlocked(3), true);
  assert.equal(isUnlocked(4), false);
  assert.equal(hasProgress(), true);
  assert.equal(totalScore(), 760);
});

test('storage: Play goes to the lowest unfinished field, then the map once all are done', () => {
  for (let n = 1; n <= 15; n++) recordResult(n, { score: 100 * n, cleared: false });
  assert.equal(nextUnfinished(), null);
  assert.equal(allDone(), true);
  assert.equal(readSave().progress.unlocked, 15, 'never past 15');
});

test('storage: one head start held, used once, only on its field', () => {
  setHeadStart(4);
  assert.equal(headStartFor(4), true);
  assert.equal(takeHeadStart(3), false);
  assert.equal(takeHeadStart(4), true);
  assert.equal(takeHeadStart(4), false, 'used once');
  setHeadStart(5);
  setHeadStart(7);
  assert.deepEqual(readSave().headStart, { field: 7 }, 'a new one replaces it');
});

test('storage: migrate() mends damaged saves and moves the old farm to the garden', () => {
  const m = migrate({ farm: { ladybug: { firstMet: 'x', fields: [3] } }, progress: { unlocked: 99, fields: { 2: { best: 'a' }, 20: { best: 5 }, 3: { best: 410.4, cleared: 1 } } }, allTimeBest: -5, headStart: { field: 1 } });
  assert.deepEqual(m.garden, { ladybug: { firstMet: 'x', fields: [3] } });
  assert.equal(m.farm, undefined);
  assert.deepEqual(m.progress.fields, { 2: { best: 0, cleared: false }, 3: { best: 410, cleared: true } });
  assert.equal(m.progress.unlocked, 4, 'a finished field unlocks the next; a bad number is ignored');
  assert.equal(m.allTimeBest, 410);
  assert.equal(m.headStart, null, 'field 1 never has a head start');
  assert.deepEqual(migrate('nonsense').progress, { unlocked: 1, fields: {} });
  localStorage.setItem(SAVE_KEY, '{not json');
  assert.equal(readSave().progress.unlocked, 1, 'a broken save reads as fresh');
});

test('storage: clear data removes everything', () => {
  recordResult(1, { score: 300, cleared: true });
  befriend('ladybug', 3);
  writeSave({ settings: { music: 0.3 } });
  clearSave();
  assert.equal(localStorage.getItem(SAVE_KEY), null);
  assert.deepEqual(readSave().progress, { unlocked: 1, fields: {} });
});

test('settings: defaults, cleaning and limits', () => {
  assert.deepEqual(normalize({}), { ...DEFAULTS });
  const n = normalize({ music: 3, sound: -1, motion: 'sideways', hover: 'yes', haptics: false, name: '  Sam\u0007antha the Great ' });
  assert.equal(n.music, 1);
  assert.equal(n.sound, 0);
  assert.equal(n.motion, 'auto');
  assert.equal(n.hover, false, 'hover-sweep is off unless set true');
  assert.equal(n.haptics, false);
  assert.equal(n.name, 'Samantha the');
  assert.equal(cleanName('\u0000\u001f'), '');
});

// ---- challenge links ------------------------------------------------------------

test('challenge: valid links read f, s and n', () => {
  assert.deepEqual(parseChallenge('?f=15&s=1240&n=Sam'), { f: 15, s: 1240, n: 'Sam' });
  assert.deepEqual(parseChallenge('?f=3&s=900'), { f: 3, s: 900, n: FALLBACK_NAME });
  assert.deepEqual(parseChallenge('?f=1'), { f: 1, s: 0, n: FALLBACK_NAME });
  assert.equal(parseChallenge('?dev=1&level=3'), null, 'no f: no challenge');
});

test('challenge: f must be a whole number 1..15 or the link is ignored', () => {
  for (const f of ['0', '16', '-1', '2.5', 'abc', '', '1e1', '0x3', ' ', '1;alert(1)']) {
    assert.equal(parseChallenge(`?f=${encodeURIComponent(f)}&s=10`), null, `f=${f}`);
  }
});

test('challenge: s is clamped to a whole number 0..999,999', () => {
  assert.equal(parseChallenge('?f=2&s=99999999999').s, 999999);
  assert.equal(parseChallenge('?f=2&s=-50').s, 0);
  assert.equal(parseChallenge('?f=2&s=12.9').s, 12);
  assert.equal(parseChallenge('?f=2&s=lots').s, 0);
  assert.equal(parseChallenge('?f=2&s=Infinity').s, 0);
});

test('challenge: n is cleaned (control characters, 12 characters) and only ever text', () => {
  assert.equal(parseChallenge('?f=2&n=%3Cscript%3Ealert(1)%3C%2Fscript%3E').n, '<script>aler', 'kept as text, cut to 12');
  assert.equal(parseChallenge('?f=2&n=%0A%0D%09').n, FALLBACK_NAME);
  assert.equal(parseChallenge('?f=2&n=' + encodeURIComponent('Ann\u0000\u007fie')).n, 'Annie');
  assert.equal(parseChallenge('?f=2&n=' + 'x'.repeat(5000)).n.length, 12);
  assert.equal(challengeLine({ s: 1240, n: 'Sam' }, 'Sunset Meadow'), 'Sam scored 1,240 on Sunset Meadow. Beat them?');
});

test('challenge: the address loses f, s and n but keeps the rest', () => {
  assert.equal(stripChallenge('?f=3&s=9&n=Sam'), '');
  assert.equal(stripChallenge('?sw=1&f=3&n=x'), '?sw=1');
  assert.equal(hasChallengeParams('?sw=1'), false);
  assert.equal(hasChallengeParams('?n=x'), true);
  const url = challengeUrl('https://example.com/touchgrass/', { f: 7, s: 1240.4, n: ' Sam ' });
  assert.equal(url, 'https://example.com/touchgrass/?f=7&s=1240&n=Sam');
  assert.deepEqual(parseChallenge(new URL(url).search), { f: 7, s: 1240, n: 'Sam' });
  assert.equal(challengeUrl('https://x/', { f: 1, s: 5, n: '' }), 'https://x/?f=1&s=5');
});

// ---- share flow --------------------------------------------------------------------

test('share: file share, then text share, then clipboard, then download; a cancel stops', async () => {
  class FakeFile { constructor(parts, name, o) { this.name = name; this.type = o.type; } }
  const card = { blob: {}, title: 'T', text: 'hi', url: 'https://x/?f=1' };
  const log = [];
  const env = (nav) => ({ nav, File: FakeFile, toast: (t) => log.push(`toast:${t}`), showDownload: () => log.push('download') });
  const abort = () => { const e = new Error('cancel'); e.name = 'AbortError'; return e; };

  assert.equal(await runShare(card, env({ canShare: () => true, share: async (d) => { log.push(d.files ? 'file' : 'link'); } })), 'file');
  assert.equal(await runShare(card, env({ canShare: () => false, share: async () => {} })), 'link');
  assert.equal(await runShare(card, env({ canShare: () => true, share: async () => { throw abort(); } })), 'aborted');
  assert.equal(await runShare(card, env({ share: async () => { throw new Error('nope'); }, clipboard: { writeText: async (t) => log.push(`clip:${t}`) } })), 'copied');
  assert.ok(log.includes('clip:hi https://x/?f=1') && log.includes('toast:Link copied'));
  assert.equal(await runShare(card, env({ clipboard: { writeText: async () => { throw new Error('blocked'); } } })), 'download');
  assert.equal(await runShare({ ...card, blob: null }, env({})), 'download');
  assert.equal(log.filter((x) => x === 'download').length, 2);
});

// ---- the map ----------------------------------------------------------------------

const SIZES = [[1280, 800], [390, 844], [844, 390], [1024, 768], [360, 640], [667, 375]];

test('map: one coordinate list per orientation, 15 tokens, serpentine', () => {
  assert.equal(PORTRAIT.length, 15);
  assert.equal(LANDSCAPE.length, 15);
  // Portrait: morning at the bottom (field 1 lowest), sunset at the top.
  assert.ok(PORTRAIT[0][1] > PORTRAIT[14][1]);
  // Landscape: morning on the left, sunset on the right.
  assert.ok(LANDSCAPE[0][0] < LANDSCAPE[14][0]);
});

for (const [w, h] of SIZES) {
  test(`map: ${w}x${h}: tokens >= 56 px, on screen under the header, none overlapping`, () => {
    const L = mapLayout(w, h);
    assert.equal(L.portrait, h > w);
    assert.ok(L.size >= MIN_TOKEN, `size ${L.size}`);
    assert.equal(L.tokens.length, 15);
    const r = L.size / 2;
    for (const t of L.tokens) {
      assert.ok(t.x - r >= 0 && t.x + r <= w, `field ${t.n} x ${t.x}`);
      assert.ok(t.y - r >= HEADER, `field ${t.n} under the header (y ${t.y})`);
      assert.ok(t.y + r + LABEL <= h, `field ${t.n} label on screen (y ${t.y})`);
    }
    // Token boxes (with the score label under each) never overlap.
    for (let i = 0; i < 15; i++) {
      for (let j = i + 1; j < 15; j++) {
        const a = L.tokens[i], b = L.tokens[j];
        const apart = Math.abs(a.x - b.x) >= L.size + 4 || Math.abs(a.y - b.y) >= L.size + LABEL + 4;
        assert.ok(apart, `fields ${a.n} and ${b.n} overlap at ${w}x${h}`);
      }
    }
  });
}

test('map: the safe-area insets push tokens inside them', () => {
  const L = mapLayout(390, 844, { top: 47, bottom: 34, left: 0, right: 0 });
  for (const t of L.tokens) {
    assert.ok(t.y - L.size / 2 >= 47 + HEADER);
    assert.ok(t.y + L.size / 2 + LABEL <= 844 - 34);
  }
});

// ---- every button on every screen ------------------------------------------------

test('nav: every screen is in the table, every button leads to an allowed state', () => {
  for (const s of STATE_NAMES) assert.ok(NAV[s], `${s} has buttons`);
  for (const [screen, buttons] of Object.entries(NAV)) {
    assert.ok(STATE_NAMES.includes(screen), screen);
    for (const [id, targets] of Object.entries(buttons)) {
      assert.ok(targets.length > 0, `${screen}/${id}`);
      for (const t of targets) {
        if (t === null) continue;
        if (t === 'previous') {
          const from = RETURNS[screen];
          assert.ok(from && from.length, `${screen} returns somewhere`);
          for (const p of from) {
            assert.ok(canTransition(p, screen), `${p} opens ${screen}`);
            assert.ok(canTransition(screen, p), `${screen}/${id} returns to ${p}`);
          }
        } else {
          assert.ok(canTransition(screen, t), `${screen}/${id} -> ${t}`);
        }
      }
    }
  }
});

test('nav: no dead ends: every screen has a button out of it, and the title is reachable by buttons', () => {
  const edges = {};
  for (const [screen, buttons] of Object.entries(NAV)) {
    edges[screen] = new Set();
    for (const targets of Object.values(buttons)) {
      for (const t of targets) {
        if (t === 'previous') for (const p of RETURNS[screen]) edges[screen].add(p);
        else if (t) edges[screen].add(t);
      }
    }
    assert.ok(edges[screen].size > 0, `${screen} has a way out`);
  }
  // 'playing' leaves by the pause button (and winning: level-won).
  edges.playing.add('level-won');
  edges.playing.add('hint');
  for (const s of STATE_NAMES) {
    const seen = new Set([s]);
    const q = [s];
    while (q.length) { const x = q.shift(); for (const t of edges[x]) if (!seen.has(t)) { seen.add(t); q.push(t); } }
    assert.ok(seen.has('title'), `${s} reaches the title by buttons`);
    if (s !== 'challenge') assert.ok(!seen.has('challenge'), 'only a link opens a challenge');
  }
});

test('nav: go() follows the table, returns to the previous screen, and refuses unlisted moves', () => {
  __resetForTests();
  go('title', 'btn-settings');
  assert.equal(getState(), 'settings');
  go('settings', 'btn-settings-back');
  assert.equal(getState(), 'title', 'back to the title');
  go('title', 'btn-map');
  go('map', 'btn-map-garden');
  go('garden', 'btn-garden-back');
  assert.equal(getState(), 'map', 'back to the map');
  go('map', 'map-token', 'playing');
  go('playing', 'btn-pause');
  go('paused', 'btn-pause-settings');
  go('settings', 'btn-settings-back');
  assert.equal(getState(), 'paused', 'back to the paused field');
  assert.throws(() => go('paused', 'btn-resume', 'map'), /can't go/);
  assert.throws(() => go('paused', 'btn-nope'), /no button/);
  assert.equal(go('level-won', 'btn-complete-share'), null, 'acts in place');
  go('paused', 'btn-resume');
  setState('level-won');
  go('level-won', 'btn-next-field', 'ending');
  go('ending', 'btn-ending-map');
  assert.equal(getState(), 'map');
  __resetForTests();
});

// ---- the garden and the guest checklist ------------------------------------------

test('garden: hearts at 1, 5 and 15 fields; every friend lives somewhere', () => {
  assert.deepEqual([0, 1, 4, 5, 14, 15].map(heartsFor), [0, 1, 1, 2, 2, 3]);
  for (const sp of FRIENDS) assert.ok(firstFieldOf(sp) >= 3, sp);
  assert.equal(firstFieldOf('ladybug'), 3);
  assert.equal(firstFieldOf('snail'), 7);
});

test('guest checklist: grows with the field, says what is new', () => {
  assert.equal(checklistFor(1).length, 1);
  const c15 = checklistFor(15);
  assert.ok(c15.some((t) => /Stiff grass needs two strokes/.test(t)));
  assert.ok(c15.some((t) => /glow red/.test(t)));
  assert.ok(checklistFor(5).every((t) => !/Ring/.test(t)), 'nothing from later fields');
  assert.equal(LEVELS.length, 15);
});
