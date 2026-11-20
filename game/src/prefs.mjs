// src/prefs.mjs -- the player's settings (GAME_DESIGN.md "Screens", Settings):
// music and sound volume, haptics, reduced motion (Auto / Off / On), sweep by
// hovering, and the name used in challenge links. Saved in touchgrass.v1
// (settings), cached here so per-frame checks don't parse the save.

import { readSave, writeSave } from './storage.mjs';

export const NAME_MAX = 12;
export const DEFAULTS = Object.freeze({
  muted: false,
  music: 0.8,          // 0..1, on top of the music bus level
  sound: 0.8,          // 0..1: effects, bells and ambience
  haptics: true,
  motion: 'auto',      // 'auto' (follow the system) | 'off' | 'on'
  hover: false,        // sweep by hovering (desktop), off by default
  name: '',
  askedName: false,    // the share flow asked for a name once
});

const clamp01 = (v, d) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);

// Clean a name for challenge links: control characters removed, trimmed,
// at most 12 characters.
export function cleanName(v) {
  // eslint-disable-next-line no-control-regex
  return String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, NAME_MAX).trim();
}

export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    muted: !!r.muted,
    music: clamp01(r.music, DEFAULTS.music),
    sound: clamp01(r.sound, DEFAULTS.sound),
    haptics: r.haptics !== false,
    motion: ['auto', 'off', 'on'].includes(r.motion) ? r.motion : 'auto',
    hover: r.hover === true,
    name: cleanName(r.name),
    askedName: r.askedName === true,
  };
}

let cache = null;
const listeners = new Set();

export function getSettings() {
  if (!cache) cache = normalize(readSave().settings);
  return cache;
}

export function setSetting(key, value) {
  const next = normalize({ ...getSettings(), [key]: value });
  cache = next;
  writeSave({ settings: { [key]: next[key] } });
  applyMotion();
  for (const cb of listeners) { try { cb(next, key); } catch { /* ignore */ } }
  return next[key];
}

export function onSettings(cb) { listeners.add(cb); return () => listeners.delete(cb); }

// After clear data: forget the cache and tell everyone the defaults are back.
export function reloadSettings() {
  cache = null;
  const s = getSettings();
  applyMotion();
  for (const cb of listeners) { try { cb(s, null); } catch { /* ignore */ } }
  return s;
}

function systemReduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Reduced motion, honoured everywhere: the setting, or the system's when Auto.
export function reducedMotion() {
  const m = getSettings().motion;
  if (m === 'on') return true;
  if (m === 'off') return false;
  return systemReduced();
}

// The page's CSS follows `html.reduce-motion` (not the media query), so the
// setting can override the system either way.
export function applyMotion() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reduce-motion', reducedMotion());
}

let watching = false;
export function watchMotion() {
  applyMotion();
  if (watching || typeof matchMedia !== 'function') return;
  watching = true;
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.addEventListener) mq.addEventListener('change', applyMotion);
}

// Haptics: only on touch devices that can vibrate (desktop Chrome has the
// API but nothing to buzz).
export function hapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
    && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// Hover-sweep is a desktop setting: shown where there's a mouse or trackpad.
export function hoverSupported() {
  return typeof matchMedia === 'function' && matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
}
