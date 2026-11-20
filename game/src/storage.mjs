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
