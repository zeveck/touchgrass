// input/pointer.mjs -- robust pointer input for the field canvas.
//
// - Pointer Events with setPointerCapture; the FIRST pointer wins and extra
//   fingers are ignored until it's released.
// - pointercancel, lostpointercapture and window blur are treated exactly like
//   a release.
// - Coalesced events are used where available so fast swipes keep every sample.
// - contextmenu is prevented on the field (no iOS long-press menu).
// Events are queued with their timestamps and drained by the fixed-step update
// (the sim stamps a brush capsule between consecutive samples).
//
// queue entries: { kind: 'down' | 'move' | 'up', x, y, t (s), type, cancel? }
// x, y are CSS px relative to the element's top-left.

export class PointerInput {
  constructor(el) {
    this.el = el;
    this.activeId = null;
    this.activeType = null;
    this.queue = [];
    this.enabled = true;
    this.stats = { down: 0, up: 0, cancel: 0, lost: 0, blur: 0, ignored: 0 };
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onLost = this._onLost.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onContext = (e) => e.preventDefault();
  }

  attach() {
    const el = this.el;
    el.addEventListener('pointerdown', this._onDown, { passive: false });
    el.addEventListener('pointermove', this._onMove, { passive: false });
    el.addEventListener('pointerup', this._onUp, { passive: false });
    el.addEventListener('pointercancel', this._onCancel);
    el.addEventListener('lostpointercapture', this._onLost);
    el.addEventListener('contextmenu', this._onContext);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    const el = this.el;
    el.removeEventListener('pointerdown', this._onDown);
    el.removeEventListener('pointermove', this._onMove);
    el.removeEventListener('pointerup', this._onUp);
    el.removeEventListener('pointercancel', this._onCancel);
    el.removeEventListener('lostpointercapture', this._onLost);
    el.removeEventListener('contextmenu', this._onContext);
    window.removeEventListener('blur', this._onBlur);
  }

  _pos(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onDown(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.activeId !== null) { this.stats.ignored++; return; }   // first pointer wins
    e.preventDefault();
    this.activeId = e.pointerId;
    this.activeType = e.pointerType || 'mouse';
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not capturable: fine */ }
    const p = this._pos(e);
    this.stats.down++;
    this.queue.push({ kind: 'down', x: p.x, y: p.y, t: e.timeStamp / 1000, type: this.activeType });
  }

  _onMove(e) {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    const evs = list && list.length ? list : [e];
    for (const ce of evs) {
      const p = this._pos(ce);
      this.queue.push({ kind: 'move', x: p.x, y: p.y, t: (ce.timeStamp || e.timeStamp) / 1000, type: this.activeType });
    }
  }

  _end(e, why) {
    if (this.activeId === null) return;
    if (e && e.pointerId !== undefined && e.pointerId !== this.activeId) return;
    if (e && e.type === 'pointerup') {
      const p = this._pos(e);
      this.queue.push({ kind: 'move', x: p.x, y: p.y, t: e.timeStamp / 1000, type: this.activeType });
    }
    const id = this.activeId;
    this.activeId = null;
    this.stats[why]++;
    try { if (this.el.hasPointerCapture && this.el.hasPointerCapture(id)) this.el.releasePointerCapture(id); } catch { /* ignore */ }
    // cancel: not a real release (pointercancel, lost capture, blur, or the
    // game letting go): an armed Ring or Line is cancelled, not fired.
    this.queue.push({ kind: 'up', x: 0, y: 0, t: (e && e.timeStamp ? e.timeStamp : performance.now()) / 1000,
      type: this.activeType, cancel: why !== 'up' });
  }

  _onUp(e) { this._end(e, 'up'); }
  _onCancel(e) { this._end(e, 'cancel'); }
  _onLost(e) { this._end(e, 'lost'); }
  _onBlur() { this._end(null, 'blur'); }

  // Treat the active pointer as released (pause, card shown, field change).
  release() { this._end(null, 'blur'); }

  drain() {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  get down() { return this.activeId !== null; }
}
