// ui/toolbar.mjs -- the moves toolbar (GAME_DESIGN.md "Screens", "Moves"):
// bottom strip in portrait, right column in landscape. One 64 px button per
// unlocked move with its icon, its net price (what the meter really loses:
// "free" on full-grown grass, else "−N%"; the Ring's and Line's for an
// average spot, Full Clear's exact) and its key (1 / 2 / 3). A button is
// disabled while the meter can't hold the move's full charge (it's paid, then
// paid back; a tap then plays the soft low click) and pulses while armed.
// Built once per field; values are only written when they change.

import { MOVE_KINDS, MOVE_NAMES, priceLabel } from '../sim/moves.mjs';

const KEY_OF = { ring: '1', line: '2', clear: '3' };

export class Toolbar {
  constructor(parent, { onPress }) {
    const el = document.createElement('div');
    el.className = 'toolbar';
    el.setAttribute('data-testid', 'toolbar');
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'Moves');
    parent.appendChild(el);
    this.el = el;
    this.btns = {};
    for (const k of MOVE_KINDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'move-btn';
      b.dataset.move = k;
      b.setAttribute('data-testid', `btn-move-${k}`);
      b.innerHTML = `<img src="assets/ui/${k}.png" alt=""><span class="move-price"></span><span class="move-key" aria-hidden="true">${KEY_OF[k]}</span>`;
      b.addEventListener('click', () => onPress(k));
      // Never let a press on the toolbar reach the field.
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.appendChild(b);
      this.btns[k] = { el: b, price: b.querySelector('.move-price'), last: {} };
    }
    this.kinds = [];
  }

  // The moves this field has (others are hidden).
  setMoves(kinds) {
    this.kinds = kinds;
    for (const k of MOVE_KINDS) {
      const b = this.btns[k];
      b.el.hidden = !kinds.includes(k);
      b.last = {};
    }
    this.el.hidden = kinds.length === 0;
  }

  layout(L) {
    const r = L.toolbar;
    const s = this.el.style;
    s.left = `${r.x}px`; s.top = `${r.y}px`; s.width = `${r.w}px`; s.height = `${r.h}px`;
    this.el.classList.toggle('portrait', L.portrait);
    this.el.classList.toggle('landscape', !L.portrait);
  }

  // prices: { kind: full charge, share of the line } (the meter must hold
  // it), losses: { kind: net cost, share of the line } (shown), meter: frac,
  // armed: kind or null.
  update(prices, losses, meter, armed) {
    for (const k of this.kinds) {
      const b = this.btns[k];
      const p = prices[k] ?? 0;
      const disabled = meter + 1e-9 < p;
      // Usable: the net price ("free" / "−N%"). Not yet usable: what the meter
      // must hold first, so a greyed-out button never reads "free".
      const need = Math.max(1, Math.round(p * 100));
      const text = disabled ? `needs ${need}%` : priceLabel(losses[k] ?? 0);
      const isArmed = armed === k;
      if (b.last.text !== text) {
        b.price.textContent = text;
        b.last.text = text;
      }
      if (b.last.disabled !== disabled || b.last.armed !== isArmed || b.last.label !== text) {
        b.el.classList.toggle('disabled', disabled);
        b.el.setAttribute('aria-disabled', String(disabled));
        b.el.classList.toggle('armed', isArmed);
        b.el.setAttribute('aria-pressed', String(isArmed));
        const net = priceLabel(losses[k] ?? 0);
        const netWords = net === 'free' ? 'free here' : `takes ${net.slice(1)} off the meter`;
        const how = k === 'clear' ? netWords : `${netWords} on average`;
        const needWords = disabled ? `, needs ${need}% on the meter` : '';
        b.el.setAttribute('aria-label', `${MOVE_NAMES[k]}, ${how}${needWords}${isArmed ? ', armed' : ''} (key ${KEY_OF[k]})`);
        b.last.disabled = disabled; b.last.armed = isArmed; b.last.label = text;
      }
    }
  }

  isDisabled(k) {
    return !!this.btns[k].last.disabled;
  }

  show(on) { this.el.hidden = !on || this.kinds.length === 0; }
}
