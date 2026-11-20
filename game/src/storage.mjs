// src/storage.mjs -- the single localStorage key `touchgrass.v1`.
// read / write (deep-merge) with a version number; reads never throw.
// Milestone 2 stores only settings (mute); progress lands later.

export const SAVE_KEY = 'touchgrass.v1';
const VERSION = 1;

function fresh() {
  return { version: VERSION, settings: {} };
}

export function readSave() {
  try {
    if (typeof localStorage === 'undefined') return fresh();
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return fresh();
    s.settings = s.settings && typeof s.settings === 'object' ? s.settings : {};
    return s;
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

export function writeSave(patch) {
  const s = merge(readSave(), patch);
  s.version = VERSION;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch { /* storage full or blocked: settings just won't persist */ }
  return s;
}

// True once the player has progress worth continuing (not just settings).
export function hasProgress() {
  const s = readSave();
  return !!(s.progress && (s.progress.unlocked > 1 || s.progress.level > 1));
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
