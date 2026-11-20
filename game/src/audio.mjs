// src/audio.mjs -- Web Audio for Touch Grass (GAME_DESIGN.md "Audio direction").
//
// master -> music bus (low: the tracks are mastered loud), ambience bus
// (+18 dB: the meadow loops are very quiet), effects bus. Mute is the master
// gain and persists in touchgrass.v1.
//
// - The AudioContext is created on the first pointerdown or key press, and
//   resume() is called again on pointerup / click / keydown until it runs
//   (older iOS only unlocks on touchend / click).
// - Music: near-silent padding is trimmed at decode; each track loops with a
//   3 s overlapping crossfade (two sources on the music bus); switching
//   tracks crossfades over 1 s. Paused: the music ducks.
// - Ambience: native loop over the trimmed region (loopStart / loopEnd).
// - Effects: played as a window from the first sample above -40 dB, with a
//   10 ms fade-out; per-effect gains from design/ASSETS.md.
// - Rustle: one looping source that runs for the whole field; its gain and
//   playbackRate follow the stroke (0.8 + 0.4 h, louder when faster, softer
//   over low grass) and fade out when the stroke stops, so it never clicks.
// - Bells: soft FM bells in D major, made in code.

import { readSave, writeSave } from './storage.mjs';

const A = 'assets/audio/';
export const TRACKS = Object.freeze({
  title: { url: `${A}music-title.mp3`, gain: 1.0 },
  morning: { url: `${A}music-morning.mp3`, gain: 1.0 },
  afternoon: { url: `${A}music-afternoon.mp3`, gain: 1.58 },   // ~6 dB quieter than M04: +4 dB
  golden: { url: `${A}music-golden.mp3`, gain: 1.0 },
});
const AMBIENCE = Object.freeze({
  meadow: `${A}amb-meadow.mp3`,
  dusk: `${A}amb-dusk.mp3`,
});
// dB -> gain: gust +8, twang +5, swish +4, click +3, bonk +2, tap/whoomp 0, whoosh/chirp -2.
export const EFFECTS = Object.freeze({
  twang: { url: `${A}twang.mp3`, gain: 1.78 },
  bonk: { url: `${A}bonk.mp3`, gain: 1.26 },
  chirp: { url: `${A}chirp.mp3`, gain: 0.79 },
  click: { url: `${A}click.mp3`, gain: 1.41 },
  whoomp: { url: `${A}whoomp.mp3`, gain: 1.0 },
  swish: { url: `${A}swish.mp3`, gain: 1.58 },
  gust: { url: `${A}gust.mp3`, gain: 2.51 },
  tap: { url: `${A}tap.mp3`, gain: 1.0 },
  whoosh: { url: `${A}whoosh.mp3`, gain: 0.79 },
});
const RUSTLE_URL = `${A}rustle.wav`;
const BUZZ_URL = `${A}buzz.wav`;
const BUZZ_GAIN = 0.5;

const MUSIC_BUS = 0.2;
const AMB_BUS = 7.9;        // +18 dB
const SFX_BUS = 0.7;
const BELL_GAIN = 0.32;
const RUSTLE_GAIN = 0.55;
const XFADE_LOOP = 3;       // s, overlap when a track loops
const XFADE_SWITCH = 1;     // s, between tracks
const SILENCE = 0.01;       // -40 dB

// D major bell notes.
export const NOTES = Object.freeze({ D5: 587.33, 'F#5': 739.99, A5: 880.0, D6: 1174.66, 'F#6': 1479.98 });

// First and last sample above -40 dB in any channel (seconds).
export function findTrim(buffer, threshold = SILENCE) {
  const n = buffer.length;
  let first = n, last = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < n; i++) if (Math.abs(d[i]) > threshold) { if (i < first) first = i; break; }
    for (let i = n - 1; i >= 0; i--) if (Math.abs(d[i]) > threshold) { if (i > last) last = i; break; }
  }
  if (first >= last) return { start: 0, end: buffer.duration };
  return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
}

class Audio {
  constructor() {
    this.ctx = null;
    this.muted = !!readSave().settings.muted;
    this.raw = new Map();        // url -> Promise<ArrayBuffer>
    this.buffers = new Map();    // url -> Promise<{ buffer, trim }>
    this.scene = null;           // music wanted: 'title' | 'morning' | ...
    this.amb = null;             // ambience wanted: 'meadow' | 'dusk' | null
    this.track = null;           // { name, gain, next, sources, timer }
    this.ambNode = null;
    this.ducked = false;
    this.rustle = null;          // { src, gain }
    this.rustleWanted = false;
    this.buzz = null;            // { src, gain } while a biter is angry
    this.buzzLevel = 0;
    this.played = [];
    this.lastTwang = 0;
    this.listeners = new Set();
    this._unlock = this._unlock.bind(this);
    this._resume = this._resume.bind(this);
  }

  // Hook the first input. Safe to call once at boot.
  install() {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerdown', this._unlock, { capture: true });
    window.addEventListener('keydown', this._unlock, { capture: true });
    for (const t of ['pointerup', 'click', 'keydown', 'touchend']) {
      window.addEventListener(t, this._resume, { capture: true });
    }
    // Fetch the bytes early (decoding needs the context).
    this._fetch(RUSTLE_URL);
    this._fetch(BUZZ_URL);
    for (const e of Object.values(EFFECTS)) this._fetch(e.url);
    this._fetch(TRACKS.title.url);
    this._fetch(AMBIENCE.meadow);
  }

  _unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      console.warn('audio: no AudioContext', e);
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = MUSIC_BUS; this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = AMB_BUS; this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = SFX_BUS; this.sfxBus.connect(this.master);
    this._resume();
    window.removeEventListener('pointerdown', this._unlock, { capture: true });
    window.removeEventListener('keydown', this._unlock, { capture: true });
    // Start whatever the current screen wants.
    if (this.scene) { const s = this.scene; this.scene = null; this.setMusic(s); }
    if (this.amb) { const a = this.amb; this.amb = null; this.setAmbience(a); }
    if (this.rustleWanted) this._startRustle();
    this._emit();
  }

  _resume() {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      this.ctx.resume().then(() => this._emit(), () => {});
    } else {
      for (const t of ['pointerup', 'click', 'keydown', 'touchend']) {
        window.removeEventListener(t, this._resume, { capture: true });
      }
    }
  }

  _fetch(url) {
    if (!this.raw.has(url)) {
      const p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.arrayBuffer();
      });
      // The eager prefetch has no consumer yet: a failed or cancelled load
      // (e.g. the page is reloading) must not become an unhandled rejection.
      // Consumers still see the rejection through the stored promise.
      p.catch(() => {});
      this.raw.set(url, p);
    }
    return this.raw.get(url);
  }

  _buffer(url) {
    if (!this.ctx) return Promise.reject(new Error('audio locked'));
    if (!this.buffers.has(url)) {
      this.buffers.set(url, this._fetch(url)
        .then((ab) => new Promise((res, rej) => this.ctx.decodeAudioData(ab.slice(0), res, rej)))
        .then((buffer) => ({ buffer, trim: findTrim(buffer) })));
    }
    return this.buffers.get(url);
  }

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  _emit() { for (const cb of this.listeners) { try { cb(this.state()); } catch { /* ignore */ } } }

  state() {
    return {
      context: this.ctx ? this.ctx.state : 'none',
      muted: this.muted,
      music: this.track ? this.track.name : null,
      ambience: this.ambNode ? this.amb : null,
      ducked: this.ducked,
      rustle: this.rustle ? +this.rustle.gain.gain.value.toFixed(3) : null,
      rustleRate: this.rustle ? +this.rustle.src.playbackRate.value.toFixed(3) : null,
      buzz: this.buzz ? +this.buzz.gain.gain.value.toFixed(3) : null,
      played: this.played.slice(-12),
    };
  }

  // ---- mute ---------------------------------------------------------------

  setMuted(m) {
    this.muted = !!m;
    writeSave({ settings: { muted: this.muted } });
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    }
    this._emit();
  }

  toggleMute() { this.setMuted(!this.muted); }

  // ---- music ----------------------------------------------------------------

  setMusic(name) {
    if (name === this.scene && (this.track || !this.ctx)) return;
    this.scene = name;
    if (!this.ctx) return;
    const old = this.track;
    if (old && old.name === name) return;
    if (old) this._fadeOutTrack(old, XFADE_SWITCH);
    this.track = null;
    if (!name || !TRACKS[name]) return;
    const spec = TRACKS[name];
    const ctx = this.ctx;
    const tg = ctx.createGain();
    tg.gain.value = 0;
    tg.connect(this.musicBus);
    const track = { name, gain: tg, sources: [], next: 0, timer: null, data: null };
    this.track = track;
    this._buffer(spec.url).then((data) => {
      if (this.track !== track) return;
      track.data = data;
      const t = ctx.currentTime + 0.05;
      tg.gain.setValueAtTime(0, t);
      tg.gain.linearRampToValueAtTime(spec.gain, t + XFADE_SWITCH);
      track.next = t;
      this._scheduleTrack(track, true);
      track.timer = setInterval(() => this._scheduleTrack(track, false), 250);
      this._emit();
    }).catch((e) => console.warn('music:', e.message));
  }

  _scheduleTrack(track, first) {
    const ctx = this.ctx;
    const { buffer, trim } = track.data;
    const dur = trim.end - trim.start;
    while (track.next < ctx.currentTime + 1.5) {
      const when = track.next;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      // Each pass fades in over the overlap (except the very first, which
      // the track's own 1 s fade covers) and out over the last 3 s.
      if (first) g.gain.setValueAtTime(1, when);
      else { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + XFADE_LOOP); }
      g.gain.setValueAtTime(1, when + dur - XFADE_LOOP);
      g.gain.linearRampToValueAtTime(0, when + dur);
      src.connect(g).connect(track.gain);
      src.start(when, trim.start, dur);
      src.onended = () => { track.sources = track.sources.filter((s) => s !== src); };
      track.sources.push(src);
      track.next = when + dur - XFADE_LOOP;
      first = false;
    }
  }

  _fadeOutTrack(track, secs) {
    clearInterval(track.timer);
    const t = this.ctx.currentTime;
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(track.gain.gain.value, t);
    track.gain.gain.linearRampToValueAtTime(0, t + secs);
    for (const s of track.sources) { try { s.stop(t + secs + 0.05); } catch { /* already stopped */ } }
    setTimeout(() => { try { track.gain.disconnect(); } catch { /* ignore */ } }, (secs + 0.2) * 1000);
  }

  duck(on) {
    this.ducked = !!on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(MUSIC_BUS * (on ? 0.35 : 1), t, 0.15);
    this.ambBus.gain.setTargetAtTime(AMB_BUS * (on ? 0.4 : 1), t, 0.15);
    if (on) { this.setRustle(false); this.setBuzz(0); }
    this._emit();
  }

  // ---- ambience -----------------------------------------------------------

  setAmbience(name) {
    if (name === this.amb && (this.ambNode || !this.ctx)) return;
    this.amb = name;
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (this.ambNode) {
      const old = this.ambNode, t = ctx.currentTime;
      old.gain.gain.setTargetAtTime(0, t, 0.4);
      try { old.src.stop(t + 2); } catch { /* ignore */ }
      this.ambNode = null;
    }
    if (!name || !AMBIENCE[name]) return;
    this._buffer(AMBIENCE[name]).then(({ buffer, trim }) => {
      if (this.amb !== name || this.ambNode) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = trim.start;
      src.loopEnd = trim.end;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
      src.connect(g).connect(this.ambBus);
      src.start(ctx.currentTime, trim.start);
      this.ambNode = { src, gain: g };
      this._emit();
    }).catch((e) => console.warn('ambience:', e.message));
  }

  // ---- effects ----------------------------------------------------------------

  play(name, { rate = 1, gain = 1 } = {}) {
    const fx = EFFECTS[name];
    // A short log of what was asked for (dev checks read it via state()).
    this.played.push(rate === 1 ? name : `${name}@${rate.toFixed(2)}`);
    if (this.played.length > 30) this.played.shift();
    if (!fx || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    this._buffer(fx.url).then(({ buffer, trim }) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      const dur = trim.end - trim.start;
      const real = dur / rate;
      g.gain.setValueAtTime(fx.gain * gain, t);
      g.gain.setValueAtTime(fx.gain * gain, t + Math.max(0, real - 0.01));
      g.gain.linearRampToValueAtTime(0, t + real);
      src.connect(g).connect(this.sfxBus);
      src.start(t, trim.start, dur);
    }).catch(() => {});
  }

  // Stiff grass twangs at most once every 120 ms.
  twang() {
    const now = performance.now();
    if (now - this.lastTwang < 120) return;
    this.lastTwang = now;
    this.play('twang', { rate: 0.95 + Math.random() * 0.1 });
  }

  // ---- the rustle ---------------------------------------------------------------

  // Field audio on/off (the loop keeps running silently while on).
  setRustle(on) {
    this.rustleWanted = !!on;
    if (!this.ctx) return;
    if (on) this._startRustle();
    else if (this.rustle) {
      const r = this.rustle, t = this.ctx.currentTime;
      r.gain.gain.cancelScheduledValues(t);
      r.gain.gain.setTargetAtTime(0, t, 0.08);
      try { r.src.stop(t + 0.6); } catch { /* ignore */ }
      this.rustle = null;
    }
  }

  _startRustle() {
    if (this.rustle || this.rustlePending) return;
    this.rustlePending = true;
    this._buffer(RUSTLE_URL).then(({ buffer }) => {
      this.rustlePending = false;
      if (!this.rustleWanted || this.rustle) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;          // a native loop, made to loop (no trim)
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.sfxBus);
      src.start(ctx.currentTime, Math.random() * buffer.duration * 0.5);
      this.rustle = { src, gain: g };
    }).catch((e) => { this.rustlePending = false; console.warn('rustle:', e.message); });
  }

  // Per frame while in a field: sweeping? speed (CSS px/s), h (grass height
  // under the brush).
  updateRustle(sweeping, speed, h) {
    const r = this.rustle;
    if (!r) return;
    const t = this.ctx.currentTime;
    let target = 0;
    if (sweeping && speed > 5) {
      const fast = Math.min(1, speed / 700);
      target = RUSTLE_GAIN * (0.3 + 0.7 * fast) * (h >= 0.4 ? 1 : 0.45);
    }
    // Quick attack, softer release (fades out when the stroke stops).
    r.gain.gain.setTargetAtTime(target, t, target > r.gain.gain.value ? 0.04 : 0.12);
    r.src.playbackRate.setTargetAtTime(0.8 + 0.4 * Math.max(0, Math.min(1, h)), t, 0.06);
  }

  // ---- the angry buzz ---------------------------------------------------------

  // level: 0 = no biter angry (fades out); else 0..1, how far into its
  // warning the angriest biter is: the buzz rises in pitch and loudness.
  setBuzz(level) {
    this.buzzLevel = level;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (level > 0) {
      if (!this.buzz && !this.buzzPending) {
        this.buzzPending = true;
        this._buffer(BUZZ_URL).then(({ buffer }) => {
          this.buzzPending = false;
          if (this.buzz || this.buzzLevel <= 0) return;
          const ctx = this.ctx;
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.loop = true;
          const g = ctx.createGain();
          g.gain.value = 0;
          src.connect(g).connect(this.sfxBus);
          src.start(ctx.currentTime, Math.random() * buffer.duration * 0.5);
          this.buzz = { src, gain: g };
          this.setBuzz(this.buzzLevel);
        }).catch(() => { this.buzzPending = false; });
        return;
      }
      if (!this.buzz) return;
      const u = Math.max(0, Math.min(1, level));
      this.buzz.gain.gain.setTargetAtTime(BUZZ_GAIN * (0.45 + 0.55 * u), t, 0.05);
      this.buzz.src.playbackRate.setTargetAtTime(0.9 + 0.35 * u, t, 0.08);
    } else if (this.buzz) {
      const b = this.buzz;
      this.buzz = null;
      b.gain.gain.cancelScheduledValues(t);
      b.gain.gain.setTargetAtTime(0, t, 0.08);
      try { b.src.stop(t + 0.6); } catch { /* ignore */ }
    }
  }

  // A friendly bug chirps when petted, pitched per species.
  chirp(rate = 1) { this.play('chirp', { rate: rate * (0.97 + Math.random() * 0.06) }); }
  // The soft low click: a disabled move, or a move you can't afford.
  lowClick() { this.play('click', { rate: 0.7, gain: 0.7 }); }

  // ---- bells ----------------------------------------------------------------

  bell(freq, when = 0, gain = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;          // one inharmonic FM partial: bell-like
    modGain.gain.setValueAtTime(freq * 1.6, t);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.6);
    mod.connect(modGain).connect(car.frequency);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(BELL_GAIN * gain, t + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    car.connect(amp).connect(this.sfxBus);
    car.start(t); mod.start(t);
    car.stop(t + 1.3); mod.stop(t + 1.3);
  }

  milestone(q) {   // q = 1, 2, 3 -> D5, F#5, A5
    const f = [null, NOTES.D5, NOTES['F#5'], NOTES.A5][q];
    if (f) this.bell(f, 0, 0.8);
  }
  wholeFieldTing() { this.bell(NOTES.D6, 0, 0.8); }
  bloomArpeggio() {
    [NOTES.D5, NOTES['F#5'], NOTES.A5, NOTES.D6].forEach((f, j) => this.bell(f, j * 0.16, 0.9));
  }
  newFriendJingle() {
    [NOTES.A5, NOTES.D6, NOTES['F#6']].forEach((f, j) => this.bell(f, j * 0.12, 0.8));
  }
}

export const audio = new Audio();
