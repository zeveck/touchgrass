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
import { fmtScore, fmtTime } from '../sim/score.mjs';
import { hintFoot, forInput, howtoArt } from '../hints.mjs';

// A hint card's picture, built from in-game art: grass tufts, bug sprites,
// move icons, and the ghost hand over a little swatch of grass.
export function hintArt(art) {
  const wrap = el('div', 'hint-art');
  wrap.setAttribute('aria-hidden', 'true');
  for (const a of art) {
    if (a.tuft) {
      const img = el('img', `ha-tuft ha-tuft-${a.tuft}${a.gold ? ' ha-gold' : ''}${a.young ? ' ha-young' : ''}`);
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
        // Swept tufts stand and glow gold (never a flattened mat).
        t.src = 'assets/tufts/default.png';
        if (k === 1 || k === 2) t.classList.add('ha-gold');
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
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
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
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
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
    // On a short screen the buttons under Resume sit two to a row: an odd one
    // out at the end spans the row instead of sitting alone in a corner.
    const rest = row.querySelectorAll('button:not(.primary)');
    if (rest.length % 2) rest[rest.length - 1].classList.add('span-row');
    card.append(row);
    this._open('pause', card);
  }

  // A hint card: shown when a field opens, before the first stroke. Any
  // press on it (or its backdrop) dismisses it and is swallowed: it never
  // reaches the field. Enter or Space dismiss it too. input: 'touch' or
  // 'mouse', so the foot names the right action. pause: { at(x, y), go() }:
  // a press on the HUD's Pause button (under the dimmed backdrop) opens the
  // pause card instead of only dismissing the hint.
  showHint(hint, onDismiss, input = 'touch', pause = null) {
    const card = el('div', 'card card-hint');
    card.append(hintArt(hint.art), el('h2', 'card-title', hint.title), el('p', 'card-sub hint-text', forInput(hint.text, input)));
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
      if (pause && pause.at(e.clientX, e.clientY)) {
        if (done) return;
        done = true;
        this.layer.removeEventListener('pointerdown', onDown, true);
        pause.go();
        return;
      }
      dismiss();
    };
    row.append(button('Got it', 'btn-hint-ok', dismiss, true));
    card.append(row);
    card.append(el('p', 'card-foot', hintFoot(input)));
    this._open('hint', card);
    this.layer.addEventListener('pointerdown', onDown, true);
    this.dismissHint = dismiss;
  }

  // "How to play": every hint seen so far. As many as fit on the screen
  // show at once (two columns on a wide screen); the rest page with
  // Previous / Next, so the card never scrolls.
  showHowTo(list, onBack, input = 'touch') {
    const card = el('div', 'card card-howto');
    card.append(el('h2', 'card-title', 'How to play'));
    const ul = el('ul', 'howto-list');
    ul.setAttribute('data-testid', 'howto-list');
    const items = list.map((h) => {
      const li = el('li', 'howto-item');
      li.setAttribute('data-hint', h.id);
      li.append(hintArt(howtoArt(h.art)));
      const txt = el('div', 'howto-text');
      // The general line, not the card's words about the field it opened on.
      txt.append(el('strong', '', h.howtoTitle || h.title), el('span', '', forInput(h.howto || h.text, input)));
      li.append(txt);
      return li;
    });
    card.append(ul);
    const pager = el('div', 'howto-pager');
    const prev = button('Previous', 'btn-howto-prev', () => turn(-1));
    const next = button('Next', 'btn-howto-next', () => turn(1));
    const label = el('span', 'howto-page');
    label.setAttribute('data-testid', 'howto-page');
    label.setAttribute('aria-live', 'polite');
    pager.append(prev, label, next);
    card.append(pager);
    const row = el('div', 'card-actions');
    row.append(button('Back', 'btn-howto-back', onBack, true));
    card.append(row);
    let per = items.length, page = 0;
    const pages = () => Math.max(1, Math.ceil(items.length / per));
    const show = () => {
      const shown = items.slice(page * per, (page + 1) * per);
      ul.replaceChildren(...shown);
      // A page of one (the last page, say) is one column, not half a card.
      ul.classList.toggle('single', shown.length === 1);
      const many = pages() > 1;
      pager.hidden = !many;
      label.textContent = `${page + 1} of ${pages()}`;
      prev.disabled = page === 0;
      next.disabled = page >= pages() - 1;
    };
    const turn = (d) => {
      page = Math.max(0, Math.min(pages() - 1, page + d));
      show();
      // Keep the focus on a button that can still be pressed.
      const b = d > 0 ? (next.disabled ? prev : next) : (prev.disabled ? next : prev);
      b.focus({ preventScroll: true });
    };
    // Fit: the most items per page with no page scrolling (every page is
    // tried: a later page's entries can be longer than the first's).
    const fit = () => {
      const first = page * per;
      const over = () => card.scrollHeight > card.clientHeight + 1 || ul.scrollHeight > ul.clientHeight + 1;
      const allFit = () => {
        for (page = 0; page < pages(); page++) {
          show();
          if (over()) return false;
        }
        return true;
      };
      // The first page narrows it quickly; then every page is checked.
      per = items.length;
      page = 0;
      show();
      while (per > 1 && over()) { per--; show(); }
      while (per > 1 && !allFit()) per--;
      page = Math.min(pages() - 1, Math.floor(first / per));
      show();
    };
    this._open('howto', card);
    fit();
    const onResize = () => { if (this.kind === 'howto') fit(); };
    window.addEventListener('resize', onResize);
    this._cleanup = () => window.removeEventListener('resize', onResize);
  }

  // The field-complete card: score, best, time vs par (m:ss), friends met,
  // the head start if earned; Next field, Map, Share. A challenge adds how you did
  // against their score; a guest challenge has Try again, Map and Share.
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
    if (friends > 0) stat('Friends', petted >= friends ? (friends === 1 ? 'Met' : friends === 2 ? 'Both met' : `All ${friends} met`) : `${petted} of ${friends} met`, 'complete-friends');
    if (headStartUsed) stat('Started with', 'Head start +15%');
    right.append(dl);
    if (headStartEarned && !o.guest) {
      const hs = el('p', 'card-headstart', 'Head start: the next field starts +15% full');
      hs.setAttribute('data-testid', 'complete-headstart');
      right.append(hs);
    }
    const row = el('div', 'card-actions');
    if (o.guest) {
      // A guest can send a challenge back (the same scorecard flow).
      row.append(button('Try again', 'btn-try-again', o.onTryAgain, true));
      const pair = el('div', 'card-pair');
      pair.append(button('Map', 'btn-complete-map', o.onMap), button('Share', 'btn-complete-share', o.onShare));
      row.append(pair);
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
  // plays. Dismissed with its button (or Enter / Space); Pause works as on a
  // hint card.
  showChecklist(items, fieldName, onDismiss, input = 'touch', pause = null) {
    const card = el('div', 'card card-checklist');
    card.append(el('p', 'card-kicker', 'Guest challenge'), el('h2', 'card-title', `Before ${fieldName}`));
    const ul = el('ul', 'checklist');
    ul.setAttribute('data-testid', 'checklist');
    for (const t of items) ul.append(el('li', '', forInput(t, input)));
    card.append(ul);
    const row = el('div', 'card-actions');
    let done = false;
    const dismiss = () => { if (!done) { done = true; onDismiss(); } };
    row.append(button('Let\'s go', 'btn-checklist-ok', dismiss, true));
    card.append(row);
    this._open('checklist', card);
    this.dismissHint = dismiss;
    if (pause) {
      const onDown = (e) => {
        if (done || !pause.at(e.clientX, e.clientY)) return;
        e.preventDefault();
        e.stopPropagation();
        done = true;
        pause.go();
      };
      this.layer.addEventListener('pointerdown', onDown, true);
      this._cleanup = () => this.layer.removeEventListener('pointerdown', onDown, true);
    }
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
