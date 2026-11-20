// input/tap.mjs -- tap or sweep (GAME_DESIGN.md "Controls"). A press that
// starts on a friendly bug's pet area waits to see what it is: released
// within 350 ms after moving less than 14 px in total, it's a pet; anything
// else turns into a sweep (or the armed move's drag) from the press point.
// A press anywhere else sweeps at once. Pure.

export const TAP_MAX_S = 0.35;
export const TAP_MAX_PX = 14;

export class PressWait {
  // x, y: CSS px; t: seconds (event time).
  constructor(bug, x, y, t) {
    this.bug = bug;          // latched at press: a moving bug is still petted
    this.x0 = x; this.y0 = y; this.t0 = t;
    this.lx = x; this.ly = y;
    this.path = 0;           // total CSS px moved
    this.buffered = [];      // moves held back while waiting
  }

  // A move while waiting. Returns 'wait' or 'drag' (it's a sweep after all).
  move(ev) {
    this.path += Math.hypot(ev.x - this.lx, ev.y - this.ly);
    this.lx = ev.x; this.ly = ev.y;
    this.buffered.push(ev);
    return this.path >= TAP_MAX_PX || ev.t - this.t0 > TAP_MAX_S ? 'drag' : 'wait';
  }

  // Held too long without a release: a sweep from the press point.
  expired(now) {
    return now - this.t0 > TAP_MAX_S;
  }

  // The release. Returns 'tap' or 'drag'.
  up(t) {
    return t - this.t0 <= TAP_MAX_S && this.path < TAP_MAX_PX ? 'tap' : 'drag';
  }
}
