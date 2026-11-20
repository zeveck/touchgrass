// test/loop.test.mjs -- fixed-step accumulator and error survival.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// A manual requestAnimationFrame so frames can be driven by hand.
let queue = [];
globalThis.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
globalThis.cancelAnimationFrame = () => { queue = []; };
function frame(now) {
  const q = queue;
  queue = [];
  for (const cb of q) cb(now);
}

const loop = await import('../game/src/loop.mjs');

test('loop: updates run with a fixed dt, several per long frame, none on a short one', () => {
  const dts = [];
  loop.start((dt) => dts.push(dt), () => {});
  try {
    frame(1000);                 // first frame: establishes the clock
    frame(1000 + 1000 / 30);     // a 30 fps frame: two 60 Hz steps
    assert.equal(dts.length, 2);
    assert.ok(dts.every((d) => d === loop.STEP));
    frame(1000 + 1000 / 30 + 5); // 5 ms later: no step yet
    assert.equal(dts.length, 2);
    frame(1000 + 1000 / 30 + 5000);   // a huge gap is clamped to 50 ms: 3 steps
    assert.equal(dts.length, 5);
  } finally {
    loop.stop();
  }
});

test('loop: timeScale speeds the sim up', () => {
  const dts = [];
  loop.setTimeScale(4);
  loop.start((dt) => dts.push(dt), () => {});
  try {
    frame(0.5); frame(0.5 + 1000 / 60);
    assert.equal(dts.length, 4);
  } finally {
    loop.stop();
    loop.setTimeScale(1);
  }
});

test('loop: a thrown error is logged, the frame skipped, and the loop keeps running', () => {
  const origError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a);
  let burst = 0;
  let calls = 0;
  let renders = 0;
  loop.resetErrors();
  try {
    loop.start(() => { calls++; if (calls <= 12) throw new Error('boom'); }, () => { renders++; }, {
      onErrorBurst: () => { burst++; },
    });
    let t = 100;
    frame(t);
    for (let j = 0; j < 20; j++) { t += 1000 / 60 + 0.1; frame(t); }
    assert.ok(loop.isRunning(), 'still running');
    assert.ok(logged.length >= 10, 'errors logged');
    assert.equal(burst, 1, 'error card offered once after 10 errors in 5 s');
    assert.ok(calls > 12, 'updates continued after the errors');
    assert.ok(renders > 0, 'frames render again');
  } finally {
    loop.stop();
    console.error = origError;
  }
});
