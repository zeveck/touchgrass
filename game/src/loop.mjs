// src/loop.mjs -- requestAnimationFrame loop with a fixed-step accumulator,
// a dt clamp and an FPS sampler.
//
// Usage:
//   import { start, stop } from './loop.mjs';
//   start(
//     (dt) => { /* update: called with a FIXED dt (1/60 s), 0..n times a frame */ },
//     (frameDt) => { /* render, once per frame */ },
//     { onErrorBurst: () => { /* show "Something went wrong" */ } },
//   );
//
// The wall-clock gap is clamped (50 ms) so a backgrounded tab never makes the
// sim jump. A thrown error never stops the loop for good: it's logged, that
// frame is skipped, and the loop keeps running. After 10 errors within 5 s,
// `onErrorBurst` is called once (until resetErrors()).

export const STEP = 1 / 60;
const MAX_FRAME_S = 0.05;        // dt clamp, seconds of wall time
const MAX_STEPS = 8;             // never more than this many sim steps a frame
const ERROR_BURST = 10;
const ERROR_WINDOW_MS = 5000;

let rafId = null;
let lastNow = 0;
let running = false;
let acc = 0;
let timeScale = 1;

// FPS sampler state.
let sampleStart = 0;
let sampleFrames = 0;
let fps = 0;
let lowFpsSince = null;

// Error handling state.
let errorTimes = [];
let burstReported = false;
let onErrorBurst = null;
let onLowFps = null;

export function start(updateFn, renderFn, opts = {}) {
  if (running) return;
  running = true;
  lastNow = 0;
  acc = 0;
  sampleStart = 0;
  sampleFrames = 0;
  onErrorBurst = opts.onErrorBurst || null;
  onLowFps = opts.onLowFps || null;

  const tick = (now) => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (lastNow === 0) {
      lastNow = now;
      sampleStart = now;
    }
    const frameDt = Math.min(MAX_FRAME_S * 1000, now - lastNow) / 1000;
    lastNow = now;

    try {
      acc += frameDt * timeScale;
      let steps = 0;
      // (a hair of slack so a 30 fps frame is exactly two steps despite rounding)
      while (acc >= STEP - 1e-9 && steps < MAX_STEPS * Math.max(1, Math.ceil(timeScale))) {
        if (updateFn) updateFn(STEP);
        acc -= STEP;
        steps++;
      }
      if (acc < 0) acc = 0;
      if (acc > STEP) acc = 0;     // fell behind: drop the backlog rather than spiral
      if (renderFn) renderFn(frameDt);
    } catch (err) {
      // Log, skip the rest of this frame, keep running.
      acc = 0;
      reportError(err, now);
    }

    // 1-second FPS sampler.
    sampleFrames++;
    const sampleDurationMs = now - sampleStart;
    if (sampleDurationMs >= 1000) {
      fps = (sampleFrames * 1000) / sampleDurationMs;
      if (fps < 45) {
        if (lowFpsSince === null) lowFpsSince = now;
        else if (now - lowFpsSince >= 2000 && onLowFps) onLowFps(fps);
      } else {
        lowFpsSince = null;
      }
      sampleStart = now;
      sampleFrames = 0;
    }
  };

  rafId = requestAnimationFrame(tick);
}

function reportError(err, now) {
  // eslint-disable-next-line no-console
  console.error('loop tick error:', err);
  errorTimes.push(now);
  while (errorTimes.length && now - errorTimes[0] > ERROR_WINDOW_MS) errorTimes.shift();
  if (!burstReported && errorTimes.length >= ERROR_BURST) {
    burstReported = true;
    if (onErrorBurst) {
      try { onErrorBurst(err); } catch (e) { console.error('onErrorBurst threw:', e); }
    }
  }
}

export function resetErrors() {
  errorTimes = [];
  burstReported = false;
}

export function stop() {
  running = false;
  if (rafId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(rafId);
  }
  rafId = null;
}

export function isRunning() {
  return running;
}

export function getFps() {
  return fps;
}

export function setTimeScale(x) {
  const v = Number(x);
  timeScale = Number.isFinite(v) && v >= 0 ? Math.min(v, 16) : 1;
}

export function getTimeScale() {
  return timeScale;
}
