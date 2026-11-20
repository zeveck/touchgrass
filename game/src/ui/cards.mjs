// ui/cards.mjs -- the cards over the field: pause, hint, How to play, field
// complete, a guest challenge's checklist, and "Something went wrong".
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
import { fmtScore } from '../sim/score.mjs';

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

  // The pause card: Resume, Restart field, How to play, Settings, Map,
  // Title, and Report a bug once the game is published.
  showPause({ fieldName, onResume, onRestart, onTitle, onHowTo, onSettings, onMap, onReport }) {
    const card = el('div', 'card card-pause');
    card.append(el('h2', 'card-title', 'Paused'), el('p', 'card-sub', fieldName));
    const row = el('div', 'card-actions');
    row.append(
      button('Resume', 'btn-resume', onResume, true),
      button('Restart field', 'btn-restart', onRestart),
    );
    if (onHowTo) row.append(button('How to play', 'btn-howto', onHowTo));
    const pair = el('div', 'card-pair');
    if (onSettings) pair.append(button('Settings', 'btn-pause-settings', onSettings));
    if (onMap) pair.append(button('Map', 'btn-pause-map', onMap));
    if (pair.childNodes.length) row.append(pair);
    row.append(button('Title', 'btn-pause-title', onTitle));
    if (onReport) row.append(button('Report a bug', 'btn-pause-report', onReport));
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

  // The field-complete card: score, best, time vs par, friends petted, the
  // head start if earned; Next field, Map, Share. A challenge adds how you did
  // against their score; a guest challenge has Try again and Map instead.
  showComplete(o) {
    const { n, name, time, par, whole, headStartEarned, headStartUsed, last, petted = 0, friends = 0 } = o;
    const card = el('div', 'card card-complete');
    // Two halves (side by side on a short screen): the result, and the details.
    const left = el('div', 'cc-left'), right = el('div', 'cc-right');
    left.append(el('p', 'card-kicker', o.guest ? `Field ${n}, as a guest` : `Field ${n}`), el('h2', 'card-title', name));
    const sc = el('div', 'card-score');
    sc.append(el('span', 'card-score-label', 'Score'));
    const num = el('span', 'card-score-num', fmtScore(o.score));
    num.setAttribute('data-testid', 'complete-score');
    sc.append(num);
    if (o.isBest && o.prevBest !== null && o.prevBest !== undefined && !o.guest) {
      const nb = el('span', 'card-newbest', 'New best!');
      nb.setAttribute('data-testid', 'complete-newbest');
      sc.append(nb);
    }
    left.append(sc);
    if (o.challenge) {
      const beat = o.score > o.challenge.s;
      const tie = o.score === o.challenge.s;
      const cmp = el('p', `card-compare${beat ? ' won' : ''}`,
        beat ? `You beat ${o.challenge.n}'s ${fmtScore(o.challenge.s)}!`
          : tie ? `A tie with ${o.challenge.n}: ${fmtScore(o.challenge.s)}`
            : `${o.challenge.n} scored ${fmtScore(o.challenge.s)}. So close.`);
      cmp.setAttribute('data-testid', 'complete-compare');
      left.append(cmp);
    }
    const dl = el('dl', 'card-stats');
    const stat = (k, v, id) => {
      const dt = el('dt', '', k);
      const dd = el('dd', '', v);
      if (id) dd.setAttribute('data-testid', id);
      dl.append(dt, dd);
    };
    if (!o.guest) stat('Best', fmtScore(o.best), 'complete-best');
    stat('Time', `${fmtTime(time)} (par ${fmtTime(par)})`, 'complete-time');
    stat('Whole field', whole >= 1 ? 'Every blade touched' : `${Math.floor(whole * 100)}% touched`, 'complete-whole');
    if (friends > 0) stat('Friends', petted >= friends ? `All ${friends} petted` : `${petted} of ${friends} petted`, 'complete-friends');
    if (headStartUsed) stat('Started with', 'Head start +15%');
    right.append(dl);
    if (headStartEarned && !o.guest) {
      const hs = el('p', 'card-headstart', 'Head start: the next field starts +15% full');
      hs.setAttribute('data-testid', 'complete-headstart');
      right.append(hs);
    }
    const row = el('div', 'card-actions');
    if (o.guest) {
      row.append(button('Try again', 'btn-try-again', o.onTryAgain, true));
      row.append(button('Map', 'btn-complete-map', o.onMap));
    } else {
      row.append(button(last ? 'Finish' : 'Next field', 'btn-next-field', o.onNext, true));
      const pair = el('div', 'card-pair');
      pair.append(button('Map', 'btn-complete-map', o.onMap), button('Share', 'btn-complete-share', o.onShare));
      row.append(pair);
    }
    right.append(row);
    card.append(left, right);
    this._open('complete', card);
  }

  // A guest challenge's checklist: everything new up to that field, before it
  // plays. Dismissed like a hint card.
  showChecklist(items, fieldName, onDismiss) {
    const card = el('div', 'card card-checklist');
    card.append(el('p', 'card-kicker', 'Guest challenge'), el('h2', 'card-title', `Before ${fieldName}`));
    const ul = el('ul', 'checklist');
    ul.setAttribute('data-testid', 'checklist');
    for (const t of items) ul.append(el('li', '', t));
    card.append(ul);
    const row = el('div', 'card-actions');
    let done = false;
    const dismiss = () => { if (!done) { done = true; onDismiss(); } };
    row.append(button('Let\'s go', 'btn-checklist-ok', dismiss, true));
    card.append(row);
    this._open('checklist', card);
    this.dismissHint = dismiss;
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
