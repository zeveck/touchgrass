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
    this.layer.hidden = true;
    this.layer.replaceChildren();
    this.kind = null;
    delete this.layer.dataset.kind;
  }

  showPause({ fieldName, onResume, onRestart, onTitle }) {
    const card = el('div', 'card');
    card.append(el('h2', 'card-title', 'Paused'), el('p', 'card-sub', fieldName));
    const row = el('div', 'card-actions');
    row.append(
      button('Resume', 'btn-resume', onResume, true),
      button('Restart field', 'btn-restart', onRestart),
      button('Title', 'btn-pause-title', onTitle),
    );
    card.append(row);
    this._open('pause', card);
  }

  showComplete({ n, name, time, par, whole, headStartEarned, headStartUsed, last, onNext }) {
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
