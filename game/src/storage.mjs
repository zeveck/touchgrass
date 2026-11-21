// src/storage.mjs -- the single localStorage key `touchgrass.v1`
// (GAME_DESIGN.md "Win, lose and progress"): read / write (deep-merge) with a
// version number and migrate(); reads never throw.
//
// Shape:
//   { version: 1,
//     settings: { muted, music, sound, haptics, motion, hover, name, askedName },
//     progress: { unlocked: 1..15, fields: { [n]: { best, cleared } } },
//     allTimeBest: number,              // the best single field score
//     headStart: null | { field: n },   // at most one held, used once
//     garden: { [species]: { firstMet, fields: [n...] } },
//     hints: { [id]: true } }

export const SAVE_KEY = 'touchgrass.v1';
export const FIELD_COUNT = 15;
export const SCORE_MAX = 999999;    // as challenge links (share/link.mjs)
const score = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(SCORE_MAX, Math.round(v))) : 0);
const VERSION = 1;

function fresh() {
  return { version: VERSION, settings: {}, progress: { unlocked: 1, fields: {} }, allTimeBest: 0, headStart: null };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const wholeIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Bring any older or damaged save into the current shape. Pure: returns a
// new object.
export function migrate(raw) {
  const s = isObj(raw) ? { ...raw } : {};
  s.version = VERSION;
  s.settings = isObj(s.settings) ? { ...s.settings } : {};
  // The plan's Insect Farm became the Bug Garden.
  if (isObj(s.farm)) {
    if (!isObj(s.garden)) s.garden = s.farm;
    delete s.farm;
  }
  const p = isObj(s.progress) ? s.progress : {};
  const fields = {};
  if (isObj(p.fields)) {
    for (const [k, v] of Object.entries(p.fields)) {
      const n = Number(k);
      if (!wholeIn(n, 1, FIELD_COUNT) || !isObj(v)) continue;
      fields[n] = { best: score(v.best), cleared: !!v.cleared };
    }
  }
  let unlocked = wholeIn(p.unlocked, 1, FIELD_COUNT) ? p.unlocked : 1;
  // The original scaffold saved `level`; a finished field always unlocks the next.
  if (wholeIn(p.level, 1, FIELD_COUNT)) unlocked = Math.max(unlocked, p.level);
  for (const k of Object.keys(fields)) unlocked = Math.max(unlocked, Math.min(FIELD_COUNT, Number(k) + 1));
  s.progress = { unlocked, fields };
  s.allTimeBest = score(s.allTimeBest);
  for (const f of Object.values(fields)) s.allTimeBest = Math.max(s.allTimeBest, f.best);
  s.headStart = isObj(s.headStart) && wholeIn(s.headStart.field, 2, FIELD_COUNT) ? { field: s.headStart.field } : null;
  if (!isObj(s.garden)) delete s.garden;
  if (!isObj(s.hints)) delete s.hints;
  return s;
}

export function readSave() {
  try {
    if (typeof localStorage === 'undefined') return fresh();
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh();
    return migrate(JSON.parse(raw));
  } catch {
    return fresh();
  }
}

function merge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') merge(a[k], v);
    else a[k] = v;
  }
  return a;
}

// Told once, the first time a save fails (storage full or blocked): the game
// carries on, it just won't remember. See onSaveFail().
let saveFailed = null;
let saveFailTold = false;
export function onSaveFail(cb) { saveFailed = cb; }

function store(s) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: it just won't persist.
    if (!saveFailTold && saveFailed) {
      saveFailTold = true;
      try { saveFailed(); } catch { /* ignore */ }
    }
  }
  return s;
}

export function writeSave(patch) {
  const s = merge(readSave(), patch);
  s.version = VERSION;
  return store(s);
}

// Clear data: everything goes, back to a fresh save.
export function clearSave() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
  return fresh();
}

// True once the player has progress worth continuing (not just settings).
export function hasProgress(s = readSave()) {
  return s.progress.unlocked > 1 || Object.keys(s.progress.fields).length > 0;
}

// ---- progress -----------------------------------------------------------------

export function progressOf(s = readSave()) {
  return s.progress;
}

export function isUnlocked(n, s = readSave()) {
  return wholeIn(n, 1, FIELD_COUNT) && n <= s.progress.unlocked;
}

// The field Play goes to: the lowest unlocked field not finished yet, or null
// once all fifteen are done (Play then opens the map).
export function nextUnfinished(s = readSave()) {
  for (let n = 1; n <= s.progress.unlocked; n++) if (!s.progress.fields[n]) return n;
  return null;
}

export function allDone(s = readSave()) {
  return nextUnfinished(s) === null && s.progress.unlocked >= FIELD_COUNT;
}

// The sum of every field's best (the ending's total score).
export function totalScore(s = readSave()) {
  return Object.values(s.progress.fields).reduce((t, f) => t + f.best, 0);
}

// A field was won (not as a guest): unlock the next, keep the best, mark it
// cleared if every blade was touched. Saved at once.
export function recordResult(n, { score, cleared }) {
  const s = readSave();
  const had = s.progress.fields[n];
  const prevBest = had ? had.best : null;
  const best = Math.max(prevBest ?? 0, Math.round(score));
  s.progress.fields[n] = { best, cleared: !!(cleared || (had && had.cleared)) };
  s.progress.unlocked = Math.max(s.progress.unlocked, Math.min(FIELD_COUNT, n + 1));
  s.allTimeBest = Math.max(s.allTimeBest, best);
  store(s);
  return { best, prevBest, isBest: prevBest === null || score > prevBest, allTimeBest: s.allTimeBest };
}

// ---- the head start (one held at most, used once) ----------------------------

export function headStartFor(n, s = readSave()) {
  return !!(s.headStart && s.headStart.field === n);
}

export function setHeadStart(field) {
  const s = readSave();
  s.headStart = field ? { field } : null;
  store(s);
}

// Use the held head start if it's for field n. Returns true if it was.
export function takeHeadStart(n) {
  const s = readSave();
  if (!s.headStart || s.headStart.field !== n) return false;
  s.headStart = null;
  store(s);
  return true;
}

// ---- the Bug Garden ---------------------------------------------------------
// garden: { [species]: { firstMet: ISO date, fields: [field numbers petted in] } }

export function gardenOf(s = readSave()) {
  const g = s.garden && typeof s.garden === 'object' ? s.garden : {};
  return g;
}

// A friend was petted on field n. Returns { isNew } (true the first time this
// species is ever met). Saved at once.
export function befriend(species, field, when = new Date()) {
  const s = readSave();
  const g = gardenOf(s);
  const had = g[species];
  const entry = had && typeof had === 'object' ? had : {};
  const fields = Array.isArray(entry.fields) ? entry.fields.filter((x) => Number.isInteger(x)) : [];
  if (!fields.includes(field)) fields.push(field);
  fields.sort((a, b) => a - b);
  const firstMet = typeof entry.firstMet === 'string' ? entry.firstMet : when.toISOString();
  writeSave({ garden: { [species]: { firstMet, fields } } });
  return { isNew: !had };
}

// ---- hints seen ---------------------------------------------------------------

export function hintsSeen(s = readSave()) {
  const h = s.hints && typeof s.hints === 'object' ? s.hints : {};
  return Object.keys(h).filter((k) => h[k]);
}

export function markHintSeen(id) {
  writeSave({ hints: { [id]: true } });
}
