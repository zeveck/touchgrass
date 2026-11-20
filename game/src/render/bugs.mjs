// render/bugs.mjs -- draws the bugs over the grass (GAME_DESIGN.md "Bugs",
// "Juice"): top-down sprites rotated to their heading, a soft code shadow
// (never rotated), wings flapping about their hinge (left wing from the art,
// right wing mirrored; bee and wasp wings at 70%), the caterpillar's segment
// ripple, the snail's glide and shell wobble, the ant's jitter, the
// ladybug's crawl wiggle. Angry biters puff up, tint red and show a pulsing
// red ring past the finger. Petting: a hop, floating hearts and "+2%" the
// first time. A bite: a red pop, a squash, sparks and "−3%" flying to the meter. Render-only: reads the
// sim, never changes it.

import { loadAll, imageNow } from '../assets.mjs';
import { SPECIES, bugSizePx, warnRingPx, WARN_MIN_S } from '../sim/insects.mjs';

const S_DIR = 'assets/sprites/';
export const BUG_ART = Object.freeze({
  ladybug: { body: `${S_DIR}ladybug.png` },
  ant: { body: `${S_DIR}ant.png` },
  snail: { body: `${S_DIR}snail.png` },
  caterpillar: { body: `${S_DIR}caterpillar.png` },
  bee: { body: `${S_DIR}bee-body.png`, wing: `${S_DIR}bee-wing.png`, full: `${S_DIR}bee-full.png` },
  butterfly: { body: `${S_DIR}butterfly-body.png`, wing: `${S_DIR}butterfly-wing.png`, full: `${S_DIR}butterfly-full.png` },
  wasp: { body: `${S_DIR}wasp-body.png`, wing: `${S_DIR}wasp-wing.png`, full: `${S_DIR}wasp-full.png` },
});
// The sprite a card or the ribbon shows for a species.
export function bugPortrait(sp) {
  const a = BUG_ART[sp];
  return a.full || a.body;
}

const HINGES_URL = `${S_DIR}wings.json`;
const DEFAULT_HINGES = { bee: [39, 56], butterfly: [57, 69], wasp: [49, 49] };

function tinted(img, rgba) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = rgba;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.closePath();
}

export class BugRenderer {
  constructor() {
    this.hinges = { ...DEFAULT_HINGES };
    this.tint = new Map();     // url -> red-tinted canvas
    this.fxBug = new Map();    // bug id -> { hop, squash, flash }
    this.floats = [];          // hearts, "+2%" labels, bite sparks
    this.t = 0;
    const urls = [];
    for (const a of Object.values(BUG_ART)) for (const u of Object.values(a)) urls.push(u);
    this.ready = Promise.all([
      loadAll(urls),
      fetch(HINGES_URL).then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (j) for (const [k, v] of Object.entries(j)) if (v && v.hinge) this.hinges[k] = v.hinge;
      }).catch(() => {}),
    ]).then(() => {
      for (const sp of ['bee', 'wasp', 'ant']) {
        const img = imageNow(BUG_ART[sp].body);
        if (img) this.tint.set(sp, tinted(img, 'rgba(225, 45, 30, 0.5)'));
      }
      return true;
    }).catch((e) => { console.warn('bugs:', e.message); return false; });
  }

  clear() {
    this.fxBug.clear();
    this.floats.length = 0;
  }

  _fx(b) {
    let f = this.fxBug.get(b.id);
    if (!f) { f = { hop: 0, squash: 0, puff: 0 }; this.fxBug.set(b.id, f); }
    return f;
  }

  // A sim event about a bug: ['pet', bug, first] | ['bite', bug] | ...
  // x, y: the bug's centre in CSS px (page). target: where the meter is
  // (CSS px), for the bite's "−3%" to fly to.
  onEvent(kind, b, extra, x, y, sizePx, reduced, target = null) {
    const f = this._fx(b);
    if (kind === 'pet') {
      f.hop = 1;
      if (!reduced) {
        const n = 3 + (extra ? 1 : 0);
        for (let k = 0; k < n; k++) {
          this.floats.push({
            kind: 'heart', x: x + (Math.random() - 0.5) * sizePx * 0.6, y: y - sizePx * 0.3,
            vx: (Math.random() - 0.5) * 24, vy: -38 - Math.random() * 26, t: -k * 0.08, life: 1.1,
            s: 7 + Math.random() * 4,
          });
        }
      }
      if (extra) this.floats.push({ kind: 'text', text: '+2%', x, y: y - sizePx * 0.55, vx: 0, vy: -34, t: 0, life: 1.4 });
    } else if (kind === 'bite') {
      // A bite reads at a glance: a red pop at the bug, a squash, sparks,
      // and "−3%" flying off to the meter. With reduced motion: the red
      // flash and the label, held in place, no squash or sparks.
      f.squash = reduced ? 0 : 1;
      this.floats.push({ kind: 'pop', x, y, t: 0, life: reduced ? 0.6 : 0.5, r: sizePx * 0.5, still: reduced });
      if (!reduced) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.2;
          this.floats.push({ kind: 'spark', x, y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, t: 0, life: 0.35, s: 3.5, red: true });
        }
      }
      const y0 = y - sizePx * 0.6;
      if (target && !reduced) {
        this.floats.push({ kind: 'fly', text: '−3%', x, y: y0, tx: target.x, ty: target.y, t: 0, life: 1.1 });
      } else {
        this.floats.push({ kind: 'text', text: '−3%', x, y: y0, vx: 0, vy: reduced ? 0 : -28, t: 0, life: 1.3, red: true, big: true });
      }
    } else if (kind === 'angry') {
      f.puff = 0;
    }
  }

  // Draw every bug, back to front. Returns the CSS-px box drawn (or null).
  draw(ctx, world, layout, dpr, dt, { reduced = false, paused = false } = {}) {
    if (!paused) this.t += dt;
    const bugs = world.bugs.list;
    const cell = layout.cell;
    const fx0 = layout.field.x, fy0 = layout.field.y;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y, r) => {
      if (x - r < x0) x0 = x - r;
      if (y - r < y0) y0 = y - r;
      if (x + r > x1) x1 = x + r;
      if (y + r > y1) y1 = y + r;
    };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const order = bugs.slice().sort((a, b) => a.y - b.y);
    const ringR = warnRingPx(cell);
    // Warning rings under every bug, so a ring never hides another bug.
    for (const b of order) {
      if (b.state !== 'angry') continue;
      const x = fx0 + (b.x + b.slideX) * cell, y = fy0 + (b.y + b.slideY) * cell;
      const u = Math.min(1, b.angerT / WARN_MIN_S);
      const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(this.t * Math.PI * 2 * (2 + 2 * u));
      const r = ringR * (1 + (reduced ? 0 : 0.05 * pulse));
      ctx.fillStyle = `rgba(230, 60, 40, ${0.08 + 0.1 * u})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = `rgba(200, 40, 30, ${0.55 + 0.35 * pulse})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // The warning winds round as it nears a bite.
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255, 235, 220, 0.85)';
      ctx.beginPath(); ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.stroke();
      grow(x, y, r + 10);
    }
    for (const b of order) {
      const sp = SPECIES[b.sp];
      const art = BUG_ART[b.sp];
      const S = bugSizePx(cell, b.sp);
      const body = imageNow(art.body);
      const x = fx0 + (b.x + b.slideX) * cell, y = fy0 + (b.y + b.slideY) * cell;
      const f = this._fx(b);
      if (!paused) {
        f.hop = Math.max(0, f.hop - dt / 0.45);
        f.squash = Math.max(0, f.squash - dt / 0.3);
        f.puff += ((b.state === 'angry' ? 1 : 0) - f.puff) * Math.min(1, dt * 10);
      }
      const flying = b.sp === 'bee' || b.sp === 'wasp' || (b.sp === 'butterfly' && b.state !== 'idle');
      const tt = this.t + b.id * 1.37;
      const hop = reduced ? 0 : Math.sin(Math.PI * (1 - f.hop)) * (f.hop > 0 ? 1 : 0) * S * 0.35;
      const hover = flying && !reduced ? (2 + Math.sin(tt * 3.1) * 1.5) : 0;
      const long = sp.long || 1;
      // Shadow: one soft ellipse, never rotated; smaller and offset when flying.
      const sh = flying ? 0.75 : 1;
      ctx.fillStyle = `rgba(43, 42, 38, ${flying ? 0.18 : 0.28})`;
      ctx.beginPath();
      ctx.ellipse(x + S * 0.06 + (flying ? 4 : 0), y + S * 0.14 + (flying ? 6 : 0),
        S * 0.38 * sh * (long > 1 ? 1.15 : 1), S * 0.24 * sh * (long > 1 ? 1.1 : 1), 0, 0, Math.PI * 2);
      ctx.fill();
      if (!body) { grow(x, y, S); continue; }
      // Pose: heading (sprites face up), per-species motion.
      let rot = b.hd + Math.PI / 2;
      let sx = 1, sy = 1, jx = 0, jy = 0;
      const mv = b.moving;
      if (!reduced) {
        if (b.sp === 'ant') {
          rot += mv * 0.09 * Math.sin(tt * 23) * Math.sin(tt * 7.3);
          jx = mv * 0.6 * Math.sin(tt * 31); jy = mv * 0.6 * Math.cos(tt * 27);
        } else if (b.sp === 'ladybug') {
          rot += mv * 0.06 * Math.sin(tt * 9);
          sy = 1 + mv * 0.025 * Math.sin(tt * 18);
        } else if (b.sp === 'snail') {
          rot += 0.035 * Math.sin(tt * 1.6);
          sx = 1 + 0.02 * Math.sin(tt * 1.6 + 1);
        } else if (b.sp === 'bee' || b.sp === 'wasp') {
          rot += 0.05 * Math.sin(tt * 4.3);
        }
      }
      const puff = 1 + 0.14 * f.puff * (reduced ? 1 : 0.85 + 0.15 * Math.sin(tt * 14));
      sx *= puff * (1 + 0.25 * f.squash); sy *= puff * (1 - 0.25 * f.squash);
      ctx.save();
      ctx.translate(x + jx, y + jy - hop - hover);
      ctx.rotate(rot);
      ctx.scale(sx, sy);
      const angryTint = b.state === 'angry' || f.puff > 0.3 ? this.tint.get(b.sp) : null;
      const bodyImg = angryTint || body;
      if (b.sp === 'caterpillar') {
        this._caterpillar(ctx, bodyImg, S, long, tt, mv, reduced);
      } else if (art.wing) {
        const wing = imageNow(art.wing);
        const under = b.sp === 'butterfly';
        if (wing && under) this._wings(ctx, b, wing, S, tt, reduced);
        ctx.drawImage(bodyImg, -S / 2, -S / 2, S, S);
        if (wing && !under) this._wings(ctx, b, wing, S, tt, reduced);
      } else {
        ctx.drawImage(bodyImg, -S / 2, -S / 2, S, S);
      }
      ctx.restore();
      grow(x, y - hop - hover, S * long * 0.75 + 4);
    }
    // Hearts, "+2%", bite sparks.
    const L = this.floats;
    let w = 0;
    for (let j = 0; j < L.length; j++) {
      const p = L[j];
      if (!paused) p.t += dt;
      if (p.t >= p.life) continue;
      L[w++] = p;
      if (p.t < 0) continue;
      const u = p.t / p.life;
      const px = p.x + p.vx * p.t, py = p.y + p.vy * p.t;
      const a = u < 0.7 ? 1 : (1 - u) / 0.3;
      if (p.kind === 'heart') {
        const s = p.s * (0.6 + 0.4 * Math.min(1, u * 4));
        ctx.globalAlpha = a;
        heartPath(ctx, px + Math.sin(p.t * 6) * 3, py, s);
        ctx.fillStyle = '#e8657e';
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#2b2a26';
        ctx.stroke();
        grow(px, py, s + 4);
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.red ? '#e0563f' : '#f2c14e';
        ctx.beginPath(); ctx.arc(px, py, p.s * (1 - u), 0, Math.PI * 2); ctx.fill();
        grow(px, py, p.s + 2);
      } else if (p.kind === 'pop') {
        // A red flash at the bug and a ring bursting out from it.
        const e = p.still ? 1 : 1 - (1 - u) * (1 - u);
        const fade = 1 - u;
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(232, 60, 40, ${0.42 * fade})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.still ? 1.1 : 0.7 + 0.5 * e), 0, Math.PI * 2); ctx.fill();
        if (!p.still) {
          const rr = p.r * (0.8 + 1.0 * e);
          ctx.lineWidth = 5 * fade + 1;
          ctx.strokeStyle = `rgba(200, 36, 26, ${0.9 * fade})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 2;
          ctx.strokeStyle = `rgba(255, 240, 225, ${0.8 * fade})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, rr + 4, 0, Math.PI * 2); ctx.stroke();
        }
        grow(p.x, p.y, p.r * 1.9 + 8);
      } else if (p.kind === 'fly') {
        // "−3%" pops up over the bug, then flies off to the meter.
        const hold = 0.3;
        let fx = p.x, fy = p.y - 10 * Math.min(1, p.t / 0.15);
        if (p.t > hold) {
          const k = Math.min(1, (p.t - hold) / (p.life - hold));
          const e = k * k;
          const mx = (p.x + p.tx) / 2, my = Math.min(p.y, p.ty) - 40;
          fx = (1 - e) * (1 - e) * p.x + 2 * (1 - e) * e * mx + e * e * p.tx;
          fy = (1 - e) * (1 - e) * (p.y - 10) + 2 * (1 - e) * e * my + e * e * p.ty;
        }
        const pop = p.t < 0.15 ? 0.6 + 0.4 * (p.t / 0.15) * 1.25 : 1;
        ctx.globalAlpha = u < 0.75 ? 1 : (1 - u) / 0.25;
        ctx.font = `800 ${Math.round(19 * pop)}px Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(251, 243, 223, 0.95)';
        ctx.strokeText(p.text, fx, fy);
        ctx.fillStyle = '#b8322a';
        ctx.fillText(p.text, fx, fy);
        grow(fx, fy, 34);
      } else {
        ctx.globalAlpha = a;
        ctx.font = p.big ? '800 19px Nunito, sans-serif' : '800 15px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(251, 243, 223, 0.95)';
        ctx.strokeText(p.text, px, py);
        ctx.fillStyle = p.red ? '#b8322a' : '#8a5a00';
        ctx.fillText(p.text, px, py);
        grow(px, py, 34);
      }
      ctx.globalAlpha = 1;
    }
    L.length = w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }

  // Both wings about their hinges: the left from the art, the right mirrored.
  _wings(ctx, b, wing, S, tt, reduced) {
    const k = S / 128;
    const [hx, hy] = this.hinges[b.sp] || [40, 56];
    let f;
    if (b.sp === 'butterfly') {
      // Slow, full flaps in flight; settled, a lazy open and close.
      const settled = b.state === 'idle';
      f = reduced ? 1 : settled ? 0.75 + 0.25 * Math.sin(tt * 1.6) : 0.4 + 0.6 * Math.abs(Math.cos(tt * 7.5));
    } else {
      // Quick buzzing flaps (kept under the frame rate so they don't strobe).
      f = reduced ? 1 : 0.45 + 0.55 * Math.abs(Math.cos(tt * (b.sp === 'wasp' ? 26 : 22)));
    }
    ctx.globalAlpha = b.sp === 'butterfly' ? 1 : 0.7;
    for (const side of [1, -1]) {
      ctx.save();
      ctx.scale(side, 1);
      // About the hinge, in sprite space centred on the sprite.
      const px = (hx - 64) * k, py = (hy - 64) * k;
      ctx.translate(px, py);
      ctx.scale(f, 1);
      ctx.translate(-px, -py);
      ctx.drawImage(wing, -S / 2, -S / 2, S, S);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // The caterpillar's segment ripple: horizontal slices of the sprite, each
  // shifted sideways by a wave that runs down its body as it crawls.
  _caterpillar(ctx, img, S, long, tt, mv, reduced) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const H = S * long, Wd = H * (iw / ih);
    const n = 10;
    const sh = ih / n, dh = H / n;
    for (let k = 0; k < n; k++) {
      const off = reduced ? 0 : Math.sin(tt * 5 - k * 0.7) * S * 0.045 * (0.4 + 0.6 * mv);
      const squeeze = reduced ? 1 : 1 + 0.06 * Math.sin(tt * 5 - k * 0.7 + 1.2) * mv;
      ctx.drawImage(img, 0, k * sh, iw, sh + 0.5, -Wd / 2 + off, -H / 2 + k * dh, Wd, dh * squeeze + 0.6);
    }
  }
}
