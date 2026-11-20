// ui/modal.mjs -- the one modal card above every screen (share, the name
// question, the download fallback, clear-data confirm, a friend's card) and
// a toast line. One modal at a time; Esc or the backdrop closes it (unless
// it says otherwise); focus goes to its first button and back afterwards.

import { el } from './dom.mjs';

let layer = null;
let open = null;     // { card, onClose, back, kind }
let toastEl = null;
let toastTimer = null;

function ensure() {
  if (layer) return;
  layer = el('div', 'modal-layer');
  layer.hidden = true;
  layer.setAttribute('data-testid', 'modal-layer');
  // Presses on the backdrop close (when allowed) and never reach a screen.
  layer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === layer && open && open.dismissable) closeModal();
  });
  document.body.append(layer);
  toastEl = el('div', 'toast');
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.setAttribute('data-testid', 'toast');
  document.body.append(toastEl);
}

export function isModalOpen() { return !!open; }
export function modalKind() { return open ? open.kind : null; }

// card: an element (the .card). kind: its name (data-testid modal-<kind>).
export function openModal(card, { kind = 'card', onClose = null, dismissable = true } = {}) {
  ensure();
  if (open) closeModal(true);
  const back = document.activeElement;
  card.classList.add('card', 'modal-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('data-testid', `modal-${kind}`);
  layer.replaceChildren(card);
  layer.hidden = false;
  // A card on the field underneath (the complete card under the name prompt)
  // is hidden while the modal is up, so the two never show stacked.
  document.documentElement.classList.add('modal-open');
  layer.dataset.kind = kind;
  open = { card, onClose, back, kind, dismissable };
  const first = card.querySelector('[data-autofocus]') || card.querySelector('button.primary') || card.querySelector('button, input');
  if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
  return () => { if (open && open.card === card) closeModal(); };
}

// quiet: replaced by another modal (no onClose, no focus return).
export function closeModal(quiet = false) {
  if (!open) return;
  const o = open;
  open = null;
  layer.hidden = true;
  document.documentElement.classList.remove('modal-open');
  layer.replaceChildren();
  delete layer.dataset.kind;
  if (quiet) return;
  if (o.back && o.back.isConnected && typeof o.back.focus === 'function') o.back.focus({ preventScroll: true });
  if (o.onClose) o.onClose();
}

// Esc closes the open modal. Returns true if it did.
export function escapeModal() {
  if (!open) return false;
  if (open.dismissable) closeModal();
  return true;
}

// Hide the toast now (a screen it belonged to has closed).
export function hideToast() {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.classList.remove('show');
}

export function toast(text, ms = 2200) {
  ensure();
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
