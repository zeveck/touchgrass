// src/main.mjs -- thin bootstrap.
//
// Mounts the title UI and wires up a dev-only `window.__game` object
// populated across phases. Also parses `?dev=1&level=N` and, when running
// on a dev host, hands off to `window.__game.loadLevel` (functional in
// Phase 3; stubbed here).

import { getState, setState, onChange } from './state.mjs';
import { renderTitle } from './ui/title.mjs';

function isDevHost() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^(10|172|192)\./.test(host)) return true;
  return false;
}

function mount() {
  const root = document.getElementById('app');
  if (!root) return;

  // Dev-only window.__game surface (populated across phases).
  window.__game = {
    get state() { return getState(); },
    setState,
    onChange,
    // loadLevel: wired in Phase 3.
  };

  const renderFor = (state) => {
    if (state === 'title') {
      renderTitle(root);
    } else {
      // Other states are empty placeholders in Phase 1; later phases wire
      // them up.
      root.innerHTML = '';
    }
  };

  onChange((next) => {
    renderFor(next);
  });

  // Parse dev-level-skip query params. Guarded by hostname so production
  // deploys never expose this backdoor.
  const params = new URLSearchParams(location.search);
  const dev = params.get('dev') === '1';
  const levelStr = params.get('level');
  if (dev && isDevHost() && levelStr !== null) {
    const levelNum = Number(levelStr);
    if (Number.isFinite(levelNum) && levelNum >= 1 && levelNum <= 15) {
      if (typeof window.__game.loadLevel === 'function') {
        window.__game.loadLevel(levelNum);
        setState('playing');
        return;
      }
      // Phase 1 stub: Phase 3 makes this functional.
      console.info('dev level-skip: waiting for Phase 3 loadLevel');
    }
  }

  renderFor(getState());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
