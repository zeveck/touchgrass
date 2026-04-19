// src/loop.mjs -- requestAnimationFrame loop with FPS sampler.
//
// Usage:
//   import { start, stop } from './loop.mjs';
//   start(
//     (dt) => { /* update, dt is seconds, clamped to <= 0.05 */ },
//     () => { /* render */ },
//   );
//
// The `dt` clamp guards against tab-backgrounding producing huge jumps.
// A 1-second FPS sampler warns when sampled FPS < 45 (full perf-degradation
// wiring lands in Phase 6).

let rafId = null;
let lastNow = 0;
let running = false;

// FPS sampler state.
let sampleStart = 0;
let sampleFrames = 0;

export function start(updateFn, renderFn) {
  if (running) return;
  running = true;
  lastNow = 0;
  sampleStart = 0;
  sampleFrames = 0;

  const tick = (now) => {
    if (!running) return;
    if (lastNow === 0) {
      lastNow = now;
      sampleStart = now;
    }
    const dt = Math.min(50, now - lastNow) / 1000;   // clamp at 50ms wall time, convert to seconds
    lastNow = now;

    try {
      if (updateFn) updateFn(dt);
      if (renderFn) renderFn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('loop tick error:', err);
      running = false;
      return;
    }

    // 1-second FPS sampler.
    sampleFrames++;
    const sampleDurationMs = now - sampleStart;
    if (sampleDurationMs >= 1000) {
      const fps = (sampleFrames * 1000) / sampleDurationMs;
      if (fps < 45) {
        // eslint-disable-next-line no-console
        console.warn(`loop: low FPS sampled (${fps.toFixed(1)}); perf-degradation wiring lands in Phase 6`);
      }
      sampleStart = now;
      sampleFrames = 0;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
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
