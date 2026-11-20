// src/main.mjs -- thin bootstrap.
//
// Mounts the title UI and the gameplay screen, and wires up a dev-only
// `window.__game` object (dev hosts only). Also parses `?dev=1&level=N` and,
// when running on a dev host, jumps straight into field N.

import { getState, setState, onChange } from './state.mjs';
import { renderTitle } from './ui/title.mjs';
import { Game } from './game.mjs';
import { LEVELS, LEVEL_COUNT } from './sim/levels.mjs';
import { STEP } from './loop.mjs';
import { audio } from './audio.mjs';

function isDevHost() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^(10|172|192)\./.test(host)) return true;
  return false;
}

function installDebugHook(game) {
  const loadLevel = (n) => {
    const k = Number(n);
    if (!Number.isInteger(k) || k < 1 || k > LEVEL_COUNT) throw new Error(`No field ${n}`);
    const s = getState();
    if (s === 'title' || s === 'map' || s === 'challenge') {
      game.pendingField = k;
      setState('playing');
    } else {
      game.open(k);
      if (getState() !== 'playing') setState('playing');
    }
    return game.world.summary();
  };
  window.__game = {
    get state() { return getState(); },
    setState,
    onChange,
    // Detailed state (the screen string stays on `state` for the original e2e).
    info: () => ({ screen: getState(), ...(game.world ? game.world.summary() : {}), card: game.cards.kind }),
    loadLevel,
    goToLevel: loadLevel,
    levels: () => LEVEL_COUNT,
    levelSpecs: () => LEVELS.map((l) => ({ n: l.n, name: l.name, w: l.w, h: l.h, k: l.k, g: l.g, par: l.par })),
    get world() { return game.world; },
    get grid() { return game.world ? game.world.grid : null; },
    get energy() { return game.world ? game.world.energy : null; },
    get layout() { return game.layout; },
    get input() { return { ...game.input.stats, queued: game.input.queue.length, held: game.input.down }; },
    step(n = 1) {
      for (let j = 0; j < n; j++) game.simStep(STEP);
      return game.world ? game.world.summary() : null;
    },
    get timeScale() { return game.timeScale; },
    set timeScale(x) { game.timeScale = x; },
    setEnergy(x) { if (game.world) game.world.energy.set(Number(x)); return game.world?.energy.value; },
    setMeter(frac) { if (game.world) game.world.energy.set(Number(frac) * game.world.energy.line); return game.world?.energy.frac; },
    solve: (profile, opts) => game.solve(profile, opts),
    get fps() { return game.stats().fps; },
    stats: () => game.stats(),
    audioState: () => audio.state(),
    _game: game,   // dev-only escape hatch for profiling
    // Resolves once the painted art (tufts, scene, soil) for the field is in.
    ready: () => game.whenReady(),
    frames: () => game.frameLog,
    setTuftSource: (kind) => game.setTuftSource(kind),
    // Cell centre in page CSS px (for tests that drag over specific cells).
    cellToPage(r, c) {
      const L = game.layout;
      return { x: L.field.x + (c + 0.5) * L.cell, y: L.field.y + (r + 0.5) * L.cell };
    },
  };
}

function mount() {
  const root = document.getElementById('app');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  audio.install();
  // Every button taps (a soft sound on press).
  document.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) audio.play('tap');
  }, true);
  const game = new Game({ tufts: params.get('tufts') === 'code' ? 'code' : 'png' });

  if (isDevHost()) installDebugHook(game);

  const renderFor = (state) => {
    if (state === 'title') {
      renderTitle(root);
      audio.setMusic('title');
    } else {
      // Gameplay draws in its own layer (#game); other screens land later.
      root.innerHTML = '';
    }
  };

  onChange((next) => {
    renderFor(next);
  });

  // Parse dev-level-skip query params. Guarded by hostname so production
  // deploys never expose this backdoor.
  const dev = params.get('dev') === '1';
  const levelStr = params.get('level');
  if (dev && isDevHost() && levelStr !== null) {
    const levelNum = Number(levelStr);
    if (Number.isInteger(levelNum) && levelNum >= 1 && levelNum <= LEVEL_COUNT) {
      game.pendingField = levelNum;
      setState('playing');
      return;
    }
  }

  renderFor(getState());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
