// ui/hud.mjs -- the slim gameplay HUD (DOM, above the canvases).
//
// Portrait: a strip across the top. Landscape: a column on the left.
// Holds the field name, the energy meter (fill + line), the whole-field leaf
// badge (ring + %, "N left" from 90%) and the pause button. An ARIA live
// region announces 25/50/75/100%, "Whole field touched" and "Field N complete".
// Elements are built once and only updated when their value changes, so
// buttons never get replaced under the pointer.

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

export class Hud {
  constructor(parent, { onPause }) {
    const el = document.createElement('div');
    el.className = 'hud';
    el.setAttribute('data-testid', 'hud');
    el.innerHTML = `
      <div class="hud-main">
        <div class="hud-name" data-testid="hud-field-name"></div>
        <div class="hud-meter" data-testid="hud-meter" role="meter" aria-label="Energy" aria-valuemin="0" aria-valuemax="100">
          <div class="hud-meter-fill"></div>
          <div class="hud-meter-line" title="The line: fill the meter to here"></div>
          <span class="hud-meter-pct"></span>
        </div>
      </div>
      <div class="hud-leaf" data-testid="hud-whole" title="Whole field touched">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle class="leaf-track" cx="20" cy="20" r="${RING_R}"></circle>
          <circle class="leaf-ring" cx="20" cy="20" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"></circle>
          <path class="leaf-shape" d="M20 11 C27 14 28 22 20 29 C12 22 13 14 20 11 Z M20 13 L20 28"></path>
        </svg>
        <span class="hud-leaf-text"></span>
      </div>
      <button type="button" class="btn icon hud-pause" data-testid="btn-pause" aria-label="Pause">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"></rect><rect x="14" y="5" width="4" height="14" rx="1.5"></rect></svg>
      </button>`;
    const live = document.createElement('div');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'false');
    live.setAttribute('data-testid', 'hud-live');
    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.setAttribute('data-testid', 'hud-toast');
    parent.appendChild(el);
    parent.appendChild(toast);
    parent.appendChild(live);
    this.el = el;
    this.toast = toast;
    this.live = live;
    this.nameEl = el.querySelector('.hud-name');
    this.meterEl = el.querySelector('.hud-meter');
    this.fillEl = el.querySelector('.hud-meter-fill');
    this.pctEl = el.querySelector('.hud-meter-pct');
    this.ringEl = el.querySelector('.leaf-ring');
    this.leafEl = el.querySelector('.hud-leaf');
    this.leafText = el.querySelector('.hud-leaf-text');
    el.querySelector('.hud-pause').addEventListener('click', () => onPause());
    this.last = {};
    this.milestone = 0;
    this.wholeAnnounced = false;
    this.pulseT = 0;
    this.toastTimer = null;
  }

  // New field: reset announcements.
  setField(spec, n) {
    this.nameEl.textContent = `${n}. ${spec.name}`;
    this.milestone = 0;
    this.wholeAnnounced = false;
    this.last = {};
    this.el.dataset.time = spec.time;
  }

  layout(L) {
    const r = L.hud;
    const s = this.el.style;
    s.left = `${r.x}px`; s.top = `${r.y}px`; s.width = `${r.w}px`; s.height = `${r.h}px`;
    this.el.classList.toggle('portrait', L.portrait);
    this.el.classList.toggle('landscape', !L.portrait);
    const t = this.toast.style;
    t.left = `${L.field.x + L.field.w / 2}px`;
    t.top = `${L.field.y + 8}px`;
  }

  // Where gold motes fly to (CSS px): the meter's fill edge.
  moteTarget(frac) {
    const b = this.meterEl.getBoundingClientRect();
    const f = Math.max(0.03, Math.min(1, frac));
    return { x: b.left + b.width * f, y: b.top + b.height / 2 };
  }

  pulse() { this.pulseT = 1; }

  announce(text) {
    this.live.textContent = text;
  }

  showToast(text, ms = 2600) {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  update(frac, whole, left, dt) {
    const pct = Math.min(100, Math.floor(frac * 100));
    if (pct !== this.last.pct) {
      this.fillEl.style.transform = `scaleX(${Math.min(1, frac)})`;
      this.pctEl.textContent = `${pct}%`;
      this.meterEl.setAttribute('aria-valuenow', String(pct));
      this.last.pct = pct;
      const m = Math.floor(Math.min(frac, 1) * 4);
      if (m > this.milestone) {
        this.milestone = m;
        this.announce(`Energy ${m * 25}%`);
      }
    }
    const wp = Math.floor(whole * 100);
    const wkey = `${wp}:${left}`;
    if (wkey !== this.last.whole) {
      this.ringEl.setAttribute('stroke-dashoffset', String(RING_C * (1 - whole)));
      this.leafText.textContent = whole >= 1 ? 'All!' : (whole >= 0.9 ? `${left} left` : `${wp}%`);
      this.leafEl.classList.toggle('done', whole >= 1);
      this.last.whole = wkey;
      if (whole >= 1 && !this.wholeAnnounced) {
        this.wholeAnnounced = true;
        this.announce('Whole field touched');
      }
    }
    if (this.pulseT > 0) {
      this.pulseT = Math.max(0, this.pulseT - dt * 5);
      this.meterEl.style.setProperty('--pulse', this.pulseT.toFixed(2));
    }
  }

  show(on) { this.el.hidden = !on; }
}
