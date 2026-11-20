// ui/screens.mjs -- the full-screen DOM screens (title, map, Bug Garden,
// settings, challenge, ending) in #app, above the field's layer. Screens
// cross-fade (GAME_DESIGN.md "Juice"): the new one fades in over the old,
// and the old is removed once covered, so nothing underneath flashes
// through. Going back to the field fades the screen out over it (the field
// is revealed on purpose). Reduced motion: instant.

import { reducedMotion } from '../prefs.mjs';
import { el } from './dom.mjs';

export const FADE_MS = 300;

export class Screens {
  constructor(root) {
    this.root = root;
    this.current = null;     // { name, el, dispose }
    // Focus moves to a new screen's main button only for keyboard players.
    this.keyboard = false;
    window.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') this.keyboard = true; }, true);
    window.addEventListener('pointerdown', () => { this.keyboard = false; }, true);
  }

  get name() { return this.current ? this.current.name : null; }

  // build(screenEl) fills the screen and returns an optional dispose().
  show(name, build, { fadeMs = FADE_MS } = {}) {
    const s = el('div', `screen scr-${name}`);
    s.dataset.screen = name;
    s.setAttribute('data-testid', `screen-${name}`);
    const old = this.current;
    const ms = reducedMotion() ? 0 : fadeMs;
    s.style.setProperty('--fade', `${ms}ms`);
    if (ms > 0) s.classList.add('entering');
    this.root.append(s);
    const dispose = build(s) || null;
    this.current = { name, el: s, dispose };
    if (old) this._retire(old, ms, false);
    if (ms > 0) {
      // Next frame: fade in.
      requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('entering')));
    }
    this._focusFirst(s);
    return s;
  }

  // Back to the field: the screen fades out over it.
  hide() {
    const old = this.current;
    this.current = null;
    if (old) this._retire(old, reducedMotion() ? 0 : FADE_MS, true);
  }

  _retire(old, ms, fadeOut) {
    old.el.classList.add('leaving');
    old.el.setAttribute('aria-hidden', 'true');
    old.el.inert = true;
    const done = () => {
      if (old.dispose) { try { old.dispose(); } catch (e) { console.error(e); } }
      old.el.remove();
    };
    if (fadeOut && ms > 0) {
      old.el.style.setProperty('--fade', `${ms}ms`);
      requestAnimationFrame(() => old.el.classList.add('fading-out'));
    }
    // Covered (or faded) after ms: remove it. A little extra so the new one
    // is fully opaque first.
    setTimeout(done, ms + 60);
  }

  _focusFirst(s) {
    // Keyboard players land on the main button (Tab / Enter / Space).
    requestAnimationFrame(() => {
      if (!s.isConnected || !this.keyboard) return;
      const f = s.querySelector('[data-autofocus]') || s.querySelector('button.primary');
      // (Focus may still be on the old screen's button, which is going away.)
      if (f && !s.contains(document.activeElement)) f.focus({ preventScroll: true });
    });
  }
}
