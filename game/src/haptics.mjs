// src/haptics.mjs -- short vibrations where supported (GAME_DESIGN.md Juice):
// 8 ms at stroke start, 25 ms on a pet, 15 ms on a bite, 20 ms when a bug gets
// angry, 10 ms when stiff grass loosens.

export function vibrate(ms) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ }
}
