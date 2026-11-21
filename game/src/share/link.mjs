// share/link.mjs -- challenge links (GAME_DESIGN.md "Screens", Challenge
// links): `?f=<field 1-15>&s=<score>&n=<name>`.
// - f must be a whole number from 1 to 15, or the link is ignored.
// - s is clamped to a whole number from 0 to 999,999.
// - n has control characters removed, is trimmed to 12 characters, and falls
//   back to "A friend".
// The values are only ever shown with textContent. Pure: no DOM.

import { cleanName } from '../prefs.mjs';
import { fmtScore } from '../sim/score.mjs';

export { SCORE_MAX } from '../storage.mjs';
import { SCORE_MAX } from '../storage.mjs';
export const FALLBACK_NAME = 'A friend';
export const CHALLENGE_KEYS = Object.freeze(['f', 's', 'n']);

// search: a query string ("?f=3&s=900") or URLSearchParams. Returns
// { f, s, n } or null when there's no valid challenge in it.
export function parseChallenge(search, fieldCount = 15) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ''));
  if (!q.has('f')) return null;
  const fRaw = String(q.get('f')).trim();
  if (!/^\d{1,3}$/.test(fRaw)) return null;
  const f = Number(fRaw);
  if (f < 1 || f > fieldCount) return null;
  let s = Number(String(q.get('s') ?? '').trim());
  if (!Number.isFinite(s)) s = 0;
  s = Math.max(0, Math.min(SCORE_MAX, Math.floor(s)));
  const n = cleanName(q.get('n')) || FALLBACK_NAME;
  return { f, s, n };
}

// True if the address carries any challenge parameter (to strip them).
export function hasChallengeParams(search) {
  const q = new URLSearchParams(String(search || ''));
  return CHALLENGE_KEYS.some((k) => q.has(k));
}

// The query without the challenge parameters ("" or "?dev=1").
export function stripChallenge(search) {
  const q = new URLSearchParams(String(search || ''));
  for (const k of CHALLENGE_KEYS) q.delete(k);
  const out = q.toString();
  return out ? `?${out}` : '';
}

// The link a share sends: the game's clean address plus the challenge.
export function challengeUrl(base, { f, s, n }) {
  const q = new URLSearchParams();
  q.set('f', String(f));
  q.set('s', String(Math.max(0, Math.min(SCORE_MAX, Math.round(s)))));
  const name = cleanName(n);
  if (name) q.set('n', name);
  return `${base}?${q.toString()}`;
}

// "Sam scored 1,240 on Sunset Meadow. Beat them?"
export function challengeLine({ s, n }, fieldName) {
  return `${n} scored ${fmtScore(s)} on ${fieldName}. Beat them?`;
}
