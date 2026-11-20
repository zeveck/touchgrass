// ui/cards.mjs -- the simple milestone-1 cards over the field: pause, field
// complete, the "done" card after field 15, and "Something went wrong".
// One card at a time; buttons carry data-testids. Text is always set with
// textContent.

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label, testid, onClick, primary = false) {
  const b = el('button', primary ? 'btn primary' : 'btn', label);
  b.type = 'button';
  b.setAttribute('data-testid', testid);
  b.addEventListener('click', onClick);
  return b;
}

import { bugPortrait } from '../render/bugs.mjs';

// A hint card's picture, built from in-game art: grass tufts, bug sprites,
// move icons, and the ghost hand over a little swatch of grass.
export function hintArt(art) {
  const wrap = el('div', 'hint-art');
  wrap.setAttribute('aria-hidden', 'true');
  for (const a of art) {
    if (a.tuft) {
      const img = el('img', `ha-tuft ha-tuft-${a.tuft}`);
      img.src = `assets/tufts/${a.tuft}.png`;
      img.alt = '';
      wrap.append(img);
    } else if (a.bug) {
      const sp = el('span', `ha-bug${a.angry ? ' angry' : ''}`);
      const img = el('img');
      img.src = bugPortrait(a.bug);
      img.alt = '';
      sp.append(img);
      wrap.append(sp);
    } else if (a.move) {
      const img = el('img', 'ha-move');
      img.src = `assets/ui/${a.move}.png`;
      img.alt = '';
      wrap.append(img);
    } else if (a.hand) {
      const sw = el('span', 'ha-swatch');
      for (let k = 0; k < 6; k++) {
        const t = el('img', 'ha-swatch-tuft');
        t.src = k === 1 || k === 2 ? 'assets/tufts/flat.png' : 'assets/tufts/default.png';
        t.alt = '';
        sw.append(t);
      }
      const hand = el('img', 'ha-hand');
      hand.src = 'assets/ui/hand.png';
      hand.alt = '';
      sw.append(hand);
      wrap.append(sw);
    } else if (a.arrow) {
      wrap.append(el('span', 'ha-arrow'));
    } else if (a.leaf) {
      const leaf = el('span', 'ha-leaf');
      leaf.innerHTML = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="rgba(251,243,223,0.9)" stroke="#e7b84a" stroke-width="4"></circle>' +
        '<path d="M20 11 C27 14 28 22 20 29 C12 22 13 14 20 11 Z M20 13 L20 28" fill="#e7b84a" stroke="#2b2a26" stroke-width="1.4"></path></svg>';
      wrap.append(leaf);
    }
  }
  return wrap;
}

function fmtTime(s) {
  const t = Math.round(s);
  const m = Math.floor(t / 60);
  return m > 0 ? `${m}:${String(t % 60).padStart(2, '0')}` : `${t} s`;
}

export class Cards {
  constructor(parent) {
    this.layer = el('div', 'card-layer');
    this.layer.hidden = true;
    this.layer.setAttribute('data-testid', 'card-layer');
    parent.appendChild(this.layer);
    this.kind = null;
    // Swallow presses on the dimmed backdrop so they never reach the field.
    this.layer.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  _open(kind, card) {
    this.layer.replaceChildren(card);
    this.layer.hidden = false;
    this.layer.dataset.kind = kind;
    this.kind = kind;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('data-testid', `card-${kind}`);
    const first = card.querySelector('button.primary') || card.querySelector('button');
    if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
  }

  close() {
    this.dismissHint = null;
    this.layer.hidden = true;
    this.layer.replaceChildren();
    this.kind = null;
    delete this.layer.dataset.kind;
  }

  showPause({ fieldName, onResume, onRestart, onTitle, onHowTo }) {
    const card = el('div', 'card');
    card.append(el('h2', 'card-title', 'Paused'), el('p', 'card-sub', fieldName));
    const row = el('div', 'card-actions');
    row.append(
      button('Resume', 'btn-resume', onResume, true),
      button('Restart field', 'btn-restart', onRestart),
    );
    if (onHowTo) row.append(button('How to play', 'btn-howto', onHowTo));
    row.append(button('Title', 'btn-pause-title', onTitle));
    card.append(row);
    this._open('pause', card);
  }

  // A hint card: shown when a field opens, before the first stroke. Any
  // press on it (or its backdrop) dismisses it and is swallowed: it never
  // reaches the field. Enter, Space or Esc dismiss it too.
  showHint(hint, onDismiss) {
    const card = el('div', 'card card-hint');
    card.append(hintArt(hint.art), el('h2', 'card-title', hint.title), el('p', 'card-sub hint-text', hint.text));
    const row = el('div', 'card-actions');
    let done = false;
    const dismiss = () => {
      if (done) return;
      done = true;
      this.layer.removeEventListener('pointerdown', onDown, true);
      onDismiss();
    };
    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    };
    row.append(button('Got it', 'btn-hint-ok', dismiss, true));
    card.append(row);
    card.append(el('p', 'card-foot', 'Tap anywhere to play'));
    this._open('hint', card);
    this.layer.addEventListener('pointerdown', onDown, true);
    this.dismissHint = dismiss;
  }

  // "How to play": every hint seen so far.
  showHowTo(list, onBack) {
    const card = el('div', 'card card-howto');
    card.append(el('h2', 'card-title', 'How to play'));
    const ul = el('ul', 'howto-list');
    ul.setAttribute('data-testid', 'howto-list');
    for (const h of list) {
      const li = el('li', 'howto-item');
      li.append(hintArt(h.art.slice(0, 2)));
      const txt = el('div', 'howto-text');
      txt.append(el('strong', '', h.title), el('span', '', h.text));
      li.append(txt);
      ul.append(li);
    }
    card.append(ul);
    const row = el('div', 'card-actions');
    row.append(button('Back', 'btn-howto-back', onBack, true));
    card.append(row);
    this._open('howto', card);
  }

  showComplete({ n, name, time, par, whole, headStartEarned, headStartUsed, last, onNext, petted = 0, friends = 0 }) {
    const card = el('div', 'card card-complete');
    card.append(el('p', 'card-kicker', `Field ${n}`), el('h2', 'card-title', name), el('p', 'card-sub', 'Field complete'));
    const dl = el('dl', 'card-stats');
    const stat = (k, v, id) => {
      const dt = el('dt', '', k);
      const dd = el('dd', '', v);
      if (id) dd.setAttribute('data-testid', id);
      dl.append(dt, dd);
    };
    stat('Time', `${fmtTime(time)} (par ${fmtTime(par)})`, 'complete-time');
    stat('Whole field', whole >= 1 ? 'Every blade touched' : `${Math.floor(whole * 100)}% touched`, 'complete-whole');
    if (friends > 0) stat('Friends', petted >= friends ? `All ${friends} petted` : `${petted} of ${friends} petted`, 'complete-friends');
    if (headStartUsed) stat('Started with', 'Head start +15%');
    card.append(dl);
    if (headStartEarned) {
      const hs = el('p', 'card-headstart', 'Head start: the next field starts +15% full');
      hs.setAttribute('data-testid', 'complete-headstart');
      card.append(hs);
    }
    const row = el('div', 'card-actions');
    row.append(button(last ? 'Finish' : 'Next field', 'btn-next-field', onNext, true));
    card.append(row);
    this._open('complete', card);
  }

  showDone({ onTitle, onReplay }) {
    const card = el('div', 'card card-done');
    card.append(
      el('h2', 'card-title', 'You touched all the grass.'),
      el('p', 'card-sub', 'Go touch some real grass.'),
    );
    const row = el('div', 'card-actions');
    row.append(
      button('Back to title', 'btn-ending-title', onTitle, true),
      button('Play field 1 again', 'btn-ending-replay', onReplay),
    );
    card.append(row);
    this._open('done', card);
  }

  showError({ onRestart }) {
    const card = el('div', 'card card-error');
    card.append(el('h2', 'card-title', 'Something went wrong'),
      el('p', 'card-sub', 'The meadow hiccupped. You can restart this field.'));
    const row = el('div', 'card-actions');
    row.append(button('Restart field', 'btn-error-restart', onRestart, true));
    card.append(row);
    this._open('error', card);
  }
}
