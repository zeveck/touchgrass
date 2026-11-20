// ui/ending.mjs -- the ending (GAME_DESIGN.md "Screens", Ending): after
// field 15 the light fades to dusk, fireflies rise, and every friend you've
// met wanders onto the field. "You touched all the grass. Go touch some real
// grass." Then the total score, Share, and back to the map. The golden-hour
// music fades into the dusk ambience.

import { go } from '../nav.mjs';
import { gardenOf, totalScore, readSave } from '../storage.mjs';
import { fmtScore } from '../sim/score.mjs';
import { bugPortrait } from '../render/bugs.mjs';
import { CRAWL_URLS } from '../render/titletoy.mjs';
import { imageNow, loadAll } from '../assets.mjs';
import { reducedMotion } from '../prefs.mjs';
import { audio } from '../audio.mjs';
import { FRIENDS } from './garden.mjs';
import { el, button } from './dom.mjs';
import { share } from './share.mjs';

export const ENDING_FADE_MS = 1600;
const MUSIC_FADE_AFTER_S = 22;

export function renderEnding(root) {
  const s = readSave();
  const g = gardenOf(s);
  const met = FRIENDS.filter((sp) => g[sp]);
  const total = totalScore(s);
  const screen = el('div', 'ending-screen');
  const cv = el('canvas', 'ending-canvas');
  cv.setAttribute('aria-hidden', 'true');
  const words = el('div', 'ending-words');
  words.setAttribute('data-testid', 'card-done');
  words.append(
    el('h1', 'ending-line', 'You touched all the grass.'),
    el('p', 'ending-line2', 'Go touch some real grass.'),
  );
  const tot = el('p', 'ending-total');
  tot.append(el('span', 'ending-total-label', 'Total score'), el('span', 'ending-total-num', fmtScore(total)));
  tot.setAttribute('data-testid', 'ending-total');
  const row = el('div', 'ending-actions');
  const map = button('Back to the map', 'btn-ending-map', () => go('ending', 'btn-ending-map'), { primary: true, icon: 'assets/ui/map.png' });
  map.setAttribute('data-autofocus', '');
  row.append(
    map,
    button('Share', 'btn-ending-share', () => share({ kind: 'ending', total, friends: met.slice(0, 3) }), { icon: 'assets/ui/share.png' }),
  );
  words.append(tot, row);
  screen.append(cv, words);
  root.append(screen);

  // Fireflies and friends.
  const urls = met.map((sp) => (sp === 'ladybug' ? CRAWL_URLS[0] : bugPortrait(sp)));
  loadAll([...urls, ...CRAWL_URLS]).catch(() => {});
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const size = () => {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  };
  size();
  const reduced = reducedMotion();
  const flies = Array.from({ length: reduced ? 14 : 34 }, (_, i) => ({
    x: Math.random(), y: 0.55 + Math.random() * 0.5, vy: 0.012 + Math.random() * 0.02,
    ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.2, delay: reduced ? 0 : i * 0.18,
  }));
  // Each friend walks in from the nearer side to its own spot in the open
  // middle below the words, spaced so none overlap, and arrives within a
  // few seconds.
  const friendSize = () => Math.max(40, Math.min(64, Math.min(W, H) * 0.09));
  const friends = met.map((sp, i) => ({ sp, i, x: 0, y: 0, tx: 0.5, ty: 0.7, hd: 0, delay: 0.9 + i * 0.45, t: 0, arrived: false, placed: false }));
  const place = () => {
    const S = friendSize();
    const wb = words.getBoundingClientRect().bottom;
    const top = Math.min(H - S, wb + S * 0.9), bottom = H - S * 0.7;
    const cy = top + Math.max(0, bottom - top) * 0.4;
    const gap = S * 1.5;
    met.forEach((sp, i) => {
      const f = friends[i];
      const px = W / 2 + (i - (met.length - 1) / 2) * gap;
      const py = cy + (i % 2 ? 0.3 : -0.3) * S * (met.length > 1 ? 1 : 0);
      f.tx = px / W; f.ty = Math.min(bottom, py) / H;
      if (!f.placed) {
        f.placed = true;
        const fromLeft = px < W / 2 || (px === W / 2 && i % 2 === 0);
        f.x = fromLeft ? -S / W : 1 + S / W;
        f.y = f.ty + 0.04;
        f.hd = fromLeft ? 0 : Math.PI;
      }
    });
  };
  place();
  let raf = 0, last = performance.now(), t = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = friendSize();
    for (const f of friends) {
      if (t < f.delay) continue;
      f.t += dt;
      const dx = (f.tx - f.x) * W, dy = (f.ty - f.y) * H;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        f.hd = Math.atan2(dy, dx);
        // Each friend's own pace, but quick enough to arrive in about 3 s.
        const pace = Math.max(f.sp === 'butterfly' ? 120 : f.sp === 'snail' ? 60 : 85, W * 0.5 / 3);
        const v = Math.min(d, pace * dt);
        f.x += (Math.cos(f.hd) * v) / W;
        f.y += (Math.sin(f.hd) * v) / H;
      } else if (!f.arrived) {
        f.arrived = true;
      }
      const moving = d > 3;
      const src = f.sp === 'ladybug' ? CRAWL_URLS[moving ? Math.floor(f.t * 8) % 4 : 0] : bugPortrait(f.sp);
      const img = imageNow(src);
      if (!img) continue;
      const x = f.x * W, y = f.y * H;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(10, 12, 30, 0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 6, S * 0.34, S * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      // Settled friends turn to face the viewer (up).
      ctx.rotate(f.arrived ? 0 : f.hd + Math.PI / 2);
      let sx = 1;
      if (f.sp === 'butterfly' && !reduced) sx = moving ? 0.55 + 0.45 * Math.abs(Math.cos(f.t * 9)) : 0.85 + 0.15 * Math.abs(Math.cos(f.t * 1.4));
      ctx.scale(sx, 1);
      // Dusk light on them.
      ctx.filter = 'brightness(0.86) saturate(0.85)';
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
      ctx.filter = 'none';
      ctx.restore();
    }
    // Fireflies rise and blink.
    for (const f of flies) {
      if (t < f.delay) continue;
      if (!reduced) {
        f.y -= f.vy * dt;
        f.x += Math.sin(t * f.sp + f.ph) * 0.0006;
        if (f.y < 0.05) { f.y = 0.95 + Math.random() * 0.1; f.x = Math.random(); }
      }
      const blink = reduced ? 0.75 : 0.35 + 0.65 * Math.max(0, Math.sin(t * f.sp * 2 + f.ph));
      const x = f.x * W, y = f.y * H;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 18);
      gr.addColorStop(0, `rgba(255, 250, 200, ${blink})`);
      gr.addColorStop(0.2, `rgba(255, 226, 120, ${0.7 * blink})`);
      gr.addColorStop(1, 'rgba(255, 210, 90, 0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  raf = requestAnimationFrame(frame);
  const onResize = () => { size(); place(); };
  window.addEventListener('resize', onResize);
  // The golden music, fading into the dusk crickets.
  const fade = setTimeout(() => audio.fadeMusicOut(10), MUSIC_FADE_AFTER_S * 1000);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(fade);
    window.removeEventListener('resize', onResize);
  };
}
