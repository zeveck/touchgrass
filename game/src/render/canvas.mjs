// render/canvas.mjs -- the two full-window canvases (static + live), DPR
// capped at 2, safe-area insets, and the layout for the current field.
//
// static: surroundings, soil clipped to the field's shape, the field edge.
//         Redrawn only on resize or a new field.
// live:   grass, then particles, every frame.

import { computeLayout } from '../sim/layout.mjs';

export function createCanvases(parent) {
  const bg = document.createElement('canvas');
  bg.className = 'game-canvas game-canvas-static';
  bg.setAttribute('aria-hidden', 'true');
  const live = document.createElement('canvas');
  live.className = 'game-canvas game-canvas-live';
  live.setAttribute('data-testid', 'field-canvas');
  live.setAttribute('aria-label', 'Meadow field: drag to sweep the grass');
  live.setAttribute('role', 'img');
  parent.appendChild(bg);
  parent.appendChild(live);
  return { bg, live, bgCtx: bg.getContext('2d'), liveCtx: live.getContext('2d') };
}

let probe = null;
export function readSafeInsets() {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

export function currentDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

// Size both canvases to the window and compute the layout for a W x H field.
export function resizeCanvases(cv, fieldW, fieldH) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const dpr = currentDpr();
  for (const c of [cv.bg, cv.live]) {
    const w = Math.round(vw * dpr), h = Math.round(vh * dpr);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    c.style.width = `${vw}px`;
    c.style.height = `${vh}px`;
  }
  const layout = computeLayout(vw, vh, fieldW, fieldH, readSafeInsets());
  layout.dpr = dpr;
  return layout;
}
