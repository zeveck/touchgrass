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
    info: () => ({ screen: getState(), ...(game.world ? game.world.summary() : {}), card: game.cards.kind, armed: game.armed }),
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
    // Bugs: list them, add one at a cell (r, c), remove them all.
    bugs: () => (game.world ? game.world.bugs.list.map((b) => ({
      id: b.id, sp: b.sp, hostile: b.hostile, state: b.state, x: +b.x.toFixed(3), y: +b.y.toFixed(3),
      angerT: +b.angerT.toFixed(3), cool: +b.cool.toFixed(3), petted: b.petted, pets: b.pets,
      page: game.layout ? { x: game.layout.field.x + b.x * game.layout.cell, y: game.layout.field.y + b.y * game.layout.cell } : null,
    })) : []),
    spawn(sp, r, c) { const b = game.world.bugs.spawn(sp, c + 0.5, r + 0.5); return b.id; },
    clearBugs() { game.world.bugs.clear(); },
    // Freeze a bug where it is (so a test can tap it): speed 0 via idle.
    holdBug(id, s = 30) { const b = game.world.bugs.list.find((x) => x.id === id); if (b) { b.state = 'idle'; b.t = s; } return !!b; },
    get armed() { return game.armed; },
    moves: () => ({ armed: game.armed, prices: { ...game.prices }, fired: game.world ? { ...game.world.movesFired } : null }),
    hint: () => (game.hint ? game.hint.id : null),
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
  const devHost = isDevHost();
  const game = new Game({
    tufts: params.get('tufts') === 'code' ? 'code' : 'png',
    // Dev only: ?hints=0 skips hint cards, ?bugs=0 opens fields with no bugs.
    hints: !(devHost && params.get('hints') === '0'),
    bugs: !(devHost && params.get('bugs') === '0'),
  });

  if (devHost) installDebugHook(game);

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
