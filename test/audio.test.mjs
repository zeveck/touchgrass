// test/audio.test.mjs -- the pure parts of audio and storage: silence trim,
// the D-major bell notes, per-effect gains from ASSETS.md, settings storage
// without localStorage.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findTrim, NOTES, EFFECTS, TRACKS } from '../game/src/audio.mjs';
import { readSave, writeSave, hasProgress } from '../game/src/storage.mjs';

function fakeBuffer(samples, rate = 1000) {
  const d = Float32Array.from(samples);
  return { length: d.length, sampleRate: rate, duration: d.length / rate, numberOfChannels: 1, getChannelData: () => d };
}

test('audio: findTrim finds the first and last sample above -40 dB', () => {
  const s = new Array(1000).fill(0);
  for (let i = 100; i < 900; i++) s[i] = 0.5 * Math.sin(i);
  s[100] = 0.5; s[899] = 0.5;
  const t = findTrim(fakeBuffer(s));
  assert.ok(Math.abs(t.start - 0.1) < 0.002);
  assert.ok(Math.abs(t.end - 0.9) < 0.002);
  // All silent: the whole buffer.
  const z = findTrim(fakeBuffer(new Array(100).fill(0.001)));
  assert.equal(z.start, 0);
});

test('audio: bells are in D major', () => {
  const ratio = (a, b) => 1200 * Math.log2(a / b);   // cents
  assert.ok(Math.abs(ratio(NOTES['F#5'], NOTES.D5) - 400) < 2, 'major third');
  assert.ok(Math.abs(ratio(NOTES.A5, NOTES.D5) - 700) < 3, 'fifth');
  assert.ok(Math.abs(ratio(NOTES.D6, NOTES.D5) - 1200) < 1, 'octave');
});

test('audio: per-effect gains and the afternoon trim follow ASSETS.md', () => {
  const db = (g) => 20 * Math.log10(g);
  assert.ok(Math.abs(db(EFFECTS.gust.gain) - 8) < 0.1);
  assert.ok(Math.abs(db(EFFECTS.twang.gain) - 5) < 0.1);
  assert.ok(Math.abs(db(EFFECTS.whoosh.gain) + 2) < 0.1);
  assert.ok(Math.abs(db(TRACKS.afternoon.gain) - 4) < 0.1);
});

test('storage: works without localStorage (fresh save, no progress)', () => {
  const s = readSave();
  assert.equal(s.version, 1);
  assert.deepEqual(s.settings, {});
  const w = writeSave({ settings: { muted: true } });
  assert.equal(w.settings.muted, true);
  assert.equal(hasProgress(), false);
});
