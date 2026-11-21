// src/main.mjs -- the bootstrap.
//
// Mounts the gameplay layer and the DOM screens (title, map, Bug Garden,
// settings, challenge, ending) with cross-fades, reads a challenge link,
// hooks up the bug report, registers the offline service worker, and wires a
// dev-only `window.__game` object (dev hosts only). `?dev=1&level=N` on a dev
// host jumps straight into field N (and wins over a challenge link).

import { getState, setState, onChange } from './state.mjs';
import { renderTitle } from './ui/title.mjs';
import { renderMap } from './ui/map.mjs';
import { renderGarden } from './ui/garden.mjs';
import { renderSettings } from './ui/settings.mjs';
import { renderEnding, ENDING_FADE_MS } from './ui/ending.mjs';
import { renderChallenge } from './ui/challenge.mjs';
import { Screens } from './ui/screens.mjs';
import { escapeModal, isModalOpen, toast } from './ui/modal.mjs';
import { scorecardDataUrl } from './ui/share.mjs';
import { Game, reportOpen } from './game.mjs';
import { LEVELS, LEVEL_COUNT } from './sim/levels.mjs';
import { STEP } from './loop.mjs';
import { audio } from './audio.mjs';
import { go } from './nav.mjs';
import { readSave, writeSave, isUnlocked, onSaveFail } from './storage.mjs';
import { watchMotion, onSettings } from './prefs.mjs';
import { parseChallenge, hasChallengeParams, stripChallenge } from './share/link.mjs';
import { loadAll } from './assets.mjs';
import { CRAWL_URLS } from './render/titletoy.mjs';
import { warnLevel } from './sim/insects.mjs';

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
    if (s === 'title' || s === 'map' || s === 'challenge' || s === 'ending') {
      game.setPending(k);
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
    info: () => ({ screen: getState(), ...(game.world ? game.world.summary() : {}), card: game.cards.kind, armed: game.armed, guest: game.guest }),
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
    // Dev: stop the context the way an OS interruption does (a call, Siri).
    audioInterrupt: () => (audio.ctx ? audio.ctx.suspend().then(() => audio.ctx.state) : Promise.resolve('none')),
    _game: game,   // dev-only escape hatch for profiling
    save: () => readSave(),
    report: () => game.reportState(),
    result: () => game.result,
    challenge: () => game.challenge,
    // Dev: unlock fields 1..n as if played (for map / ending checks).
    unlockTo(n) {
      const s = readSave();
      for (let k = 1; k < n; k++) if (!s.progress.fields[k]) s.progress.fields[k] = { best: 100 * k + 200, cleared: k % 3 === 0 };
      writeSave({ progress: { unlocked: Math.max(s.progress.unlocked, n), fields: s.progress.fields } });
      return readSave().progress;
    },
    scorecard: (o = {}) => scorecardDataUrl(o),
    // Resolves once the painted art (tufts, scene, soil) for the field is in.
    ready: () => game.whenReady(),
    frames: () => game.frameLog,
    setTuftSource: (kind) => game.setTuftSource(kind),
    // Bugs: list them, add one at a cell (r, c), remove them all.
    bugs: () => (game.world ? game.world.bugs.list.map((b) => ({
      id: b.id, sp: b.sp, hostile: b.hostile, state: b.state, x: +b.x.toFixed(3), y: +b.y.toFixed(3),
      angerT: +b.angerT.toFixed(3), warnT: +b.warnT.toFixed(3), warn: +warnLevel(b).toFixed(3), cool: +b.cool.toFixed(3), petted: b.petted, pets: b.pets,
      page: game.layout ? { x: game.layout.field.x + b.x * game.layout.cell, y: game.layout.field.y + b.y * game.layout.cell } : null,
    })) : []),
    spawn(sp, r, c) { const b = game.world.bugs.spawn(sp, c + 0.5, r + 0.5); return b.id; },
    clearBugs() { game.world.bugs.clear(); },
    // Freeze a bug where it is (so a test can tap it): speed 0 via idle.
    holdBug(id, s = 30) { const b = game.world.bugs.list.find((x) => x.id === id); if (b) { b.state = 'idle'; b.t = s; } return !!b; },
    get armed() { return game.armed; },
    moves: () => ({
      armed: game.armed, prices: { ...game.prices }, losses: { ...game.losses },
      preview: game.armed && game.preview && game.preview.kind === game.armed ? { ...game.preview } : null,
      fired: game.world ? { ...game.world.movesFired } : null,
    }),
    hint: () => (game.hint ? game.hint.id : null),
    // Cell centre in page CSS px (for tests that drag over specific cells).
    cellToPage(r, c) {
      const L = game.layout;
      return { x: L.field.x + (c + 0.5) * L.cell, y: L.field.y + (r + 0.5) * L.cell };
    },
  };
}


// Which screen each state shows in #app (the others are the field's layer).
const DOM_SCREENS = {
  title: (el, app) => renderTitle(el, app),
  map: (el, app) => renderMap(el, app),
  garden: (el) => renderGarden(el),
  settings: (el, app) => renderSettings(el, app),
  ending: (el) => renderEnding(el),
  challenge: (el, app) => renderChallenge(el, app, app.pendingChallenge),
};

// Load the title's look (fonts and painting) before it shows, so it appears
// once, in its real fonts and art (capped, so a slow font never blocks).
const TITLE_ICONS = ['sound-on', 'sound-off', 'settings', 'map', 'garden'].map((n) => `assets/ui/${n}.png`);

function titleReady() {
  const portrait = innerHeight > innerWidth;
  const wait = Promise.all([
    document.fonts ? document.fonts.load('600 64px Fraunces') : null,
    document.fonts ? document.fonts.load('700 18px Nunito') : null,
    loadAll([`assets/scenes/title-${portrait ? '9x16' : '16x9'}.jpg`, ...TITLE_ICONS, ...CRAWL_URLS]),
  ]).catch(() => {});
  return Promise.race([wait, new Promise((r) => setTimeout(r, 6000))]);
}

// Once the title is up: the other screens' paintings, so they're there when
// a screen fades in.
function warmScreens() {
  const o = innerHeight > innerWidth ? '9x16' : '16x9';
  loadAll(['map', 'garden', 'ending'].map((n) => `assets/scenes/${n}-${o}.jpg`)).catch(() => {});
}

function hideLoading() {
  const l = document.getElementById('loading');
  if (!l) return;
  l.classList.add('done');
  setTimeout(() => l.remove(), 500);
}

function registerServiceWorker() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (!local || new URLSearchParams(location.search).has('sw'))) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw:', e.message));
  }
}

function mount() {
  const root = document.getElementById('app');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  audio.install();
  // Storage full or blocked: say so once, gently; the game carries on.
  onSaveFail(() => toast('This browser isn\'t saving right now, so your meadow won\'t be remembered', 4200));
  watchMotion();
  // Every button taps (a soft sound on press).
  document.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button, a.btn')) audio.play('tap');
  }, true);
  const devHost = isDevHost();
  const game = new Game({
    tufts: params.get('tufts') === 'code' ? 'code' : 'png',
    // Dev only: ?hints=0 skips hint cards, ?bugs=0 opens fields with no bugs.
    hints: !(devHost && params.get('hints') === '0'),
    bugs: !(devHost && params.get('bugs') === '0'),
  });
  onSettings((st) => game.setHover(st.hover));

  const screens = new Screens(root);
  const app = {
    game,
    pendingChallenge: null,
    // Start field n from a screen's button (nav.mjs checks the move).
    play(n, screen, id) {
      game.setPending(n);
      go(screen, id, 'playing');
    },
    // A challenge's Play: its field, as a guest when it isn't unlocked yet.
    playChallenge(ch) {
      game.setPending(ch.f, { ...ch, guest: !isUnlocked(ch.f) });
      go('challenge', 'btn-challenge-play');
    },
    onCleared() {
      game.setHover(false);
    },
  };

  const showFor = (state) => {
    const build = DOM_SCREENS[state];
    if (build) {
      screens.show(state, (el) => build(el, app), { fadeMs: state === 'ending' ? ENDING_FADE_MS : undefined });
    } else {
      screens.hide();
    }
  };

  onChange((next, prev) => {
    const domNext = !!DOM_SCREENS[next], domPrev = !!DOM_SCREENS[prev];
    // A page turns with a whoosh (not pausing, hints or the card in a field).
    if (domNext || domPrev) audio.play('whoosh');
    showFor(next);
  });

  // Keys on the DOM screens: Esc closes a card, or goes back.
  window.addEventListener('keydown', (e) => {
    if (reportOpen()) return;
    if (e.key !== 'Escape') return;
    if (isModalOpen()) { e.preventDefault(); escapeModal(); return; }
    const s = getState();
    if (s === 'garden') { e.preventDefault(); go('garden', 'btn-garden-back'); }
    else if (s === 'settings') { e.preventDefault(); go('settings', 'btn-settings-back'); }
    else if (s === 'map') { e.preventDefault(); go('map', 'btn-map-back'); }
    else if (s === 'challenge') { e.preventDefault(); go('challenge', 'btn-challenge-notnow'); }
  });

  // The bug report (vendor/report.js; shown once the game has a public repo).
  window.gameReport?.setup({
    game: 'Touch Grass', key: 'touchgrass', visibility: 'on',
    state: () => game.reportState(),
    pause: () => game.pause(),
    grab: () => game.grab(),
    releaseAll: () => game.input.release(),
  });

  if (devHost) installDebugHook(game);
  registerServiceWorker();

  // Parse dev-level-skip query params. Guarded by hostname so production
  // deploys never expose this backdoor. It wins over a challenge link.
  const dev = params.get('dev') === '1';
  const levelStr = params.get('level');
  if (dev && devHost && levelStr !== null) {
    const levelNum = Number(levelStr);
    if (Number.isInteger(levelNum) && levelNum >= 1 && levelNum <= LEVEL_COUNT) {
      game.setPending(levelNum);
      hideLoading();
      audio.prefetch();
      setState('playing');
      return;
    }
  }

  // A challenge link: read it, then take it off the address bar.
  const ch = parseChallenge(location.search, LEVEL_COUNT);
  if (hasChallengeParams(location.search)) {
    history.replaceState(history.state, '', location.pathname + stripChallenge(location.search) + location.hash);
  }

  titleReady().then(() => {
    audio.setMusic('title');
    if (ch) {
      app.pendingChallenge = ch;
      setState('challenge');
    } else {
      showFor('title');
    }
    requestAnimationFrame(hideLoading);
    game.preload();
    audio.prefetch();
    setTimeout(warmScreens, 1500);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
