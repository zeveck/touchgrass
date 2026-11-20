// ui/dom.mjs -- small DOM helpers shared by the screens. Text always goes in
// with textContent; buttons carry data-testids.

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

// A button. icon: an image under assets/ui/ (drawn beside or instead of the
// label); label stays for screen readers when the button is icon-only.
export function button(label, testid, onClick, { primary = false, icon = null, iconOnly = false, cls = '' } = {}) {
  const b = el('button', `btn${primary ? ' primary' : ''}${iconOnly ? ' icon' : ''}${cls ? ` ${cls}` : ''}`);
  b.type = 'button';
  if (testid) b.setAttribute('data-testid', testid);
  if (icon) {
    const img = el('img', 'btn-icon');
    img.src = icon;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    b.append(img);
  }
  if (iconOnly) b.setAttribute('aria-label', label);
  else b.append(el('span', 'btn-label', label));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// An inline SVG (fixed markup written here, never from data).
export function svg(markup, cls) {
  const s = el('span', cls);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = markup;
  return s;
}

export const BACK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const LEAF_SVG = '<svg viewBox="0 0 40 40"><path d="M20 6 C31 11 32 24 20 35 C8 24 9 11 20 6 Z" fill="#e7b84a" stroke="#2b2a26" stroke-width="2.4"/><path d="M20 10 L20 32" stroke="#2b2a26" stroke-width="1.8" fill="none"/></svg>';
export const HEART_SVG = '<svg viewBox="0 0 24 24"><path d="M12 21 C5 15.5 2 12 2 8.2 C2 5.3 4.3 3 7.1 3 C9 3 10.8 4 12 5.7 C13.2 4 15 3 16.9 3 C19.7 3 22 5.3 22 8.2 C22 12 19 15.5 12 21 Z"/></svg>';

// A painted scene filling its screen (cover), by orientation: an <img>, so
// the copy loaded during the loading screen is the one shown (no second
// fetch, no blank frame). Returns { el, dispose }.
export function sceneBackdrop(name) {
  const img = el('img', 'scene-bg');
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  const pick = () => {
    const src = `assets/scenes/${name}-${innerHeight > innerWidth ? '9x16' : '16x9'}.jpg`;
    if (!img.src.endsWith(src)) img.src = src;
  };
  pick();
  addEventListener('resize', pick);
  return { el: img, dispose: () => removeEventListener('resize', pick) };
}

// The safe-area insets in CSS px.
export { readSafeInsets as safeInsets } from '../render/canvas.mjs';

// Format a saved ISO date for a card ("20 Nov 2026").
export function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
