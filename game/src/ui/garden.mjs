// ui/garden.mjs -- the Bug Garden (GAME_DESIGN.md "Screens", Bug Garden).
//
// A painted garden plot under a bell jar. Friends you've met wander and idle
// inside the jar (their sprites, with their own code motion; the ladybug uses
// its crawl frames). Unmet friends are soft silhouettes, "Not met yet". Tap a
// friend for its card: name, a one-line note, first met, and friendship
// hearts for the fields you've petted it in (1, 5, 15). Back returns to the
// screen you came from.

import { go } from '../nav.mjs';
import { gardenOf } from '../storage.mjs';
import { SPECIES, SPAWNS } from '../sim/insects.mjs';
import { getLevel } from '../sim/levels.mjs';
import { bugPortrait } from '../render/bugs.mjs';
import { CRAWL_URLS } from '../render/titletoy.mjs';
import { reducedMotion } from '../prefs.mjs';
import { el, button, svg, BACK_SVG, HEART_SVG, fmtDate } from './dom.mjs';
import { openModal, closeModal } from './modal.mjs';

export const FRIENDS = Object.freeze(['ladybug', 'butterfly', 'caterpillar', 'snail']);
export const NOTES = Object.freeze({
  ladybug: 'Counts its spots when it\'s nervous.',
  butterfly: 'Never lands in the same place twice.',
  caterpillar: 'Saving room for a very big lunch.',
  snail: 'Has been on its way here since Tuesday.',
});
// Friendship hearts: petted on 1, 5 and 15 fields.
export const HEART_STEPS = Object.freeze([1, 5, 15]);
export function heartsFor(fields) {
  return HEART_STEPS.filter((k) => fields >= k).length;
}
// Where a friend first lives (for an unmet friend's card).
export function firstFieldOf(sp) {
  for (let n = 1; n <= 15; n++) if (SPAWNS[n] && SPAWNS[n][sp]) return n;
  return null;
}

// The jar's floor in each painting, as fractions of the image: centre and
// radii of the ellipse the friends keep to.
const JAR = {
  land: { iw: 1920, ih: 1072, cx: 0.49, cy: 0.585, rx: 0.13, ry: 0.10 },
  port: { iw: 1072, ih: 1920, cx: 0.50, cy: 0.585, rx: 0.22, ry: 0.075 },
};
// Where each met friend starts, in the ellipse's unit disc. Unmet friends
// stand in a row of silhouettes along the back of the floor, under one
// "Not met yet" tag; the met ones wander the front, clear of them.
const HOME = { ladybug: [-0.62, 0.15], butterfly: [0.2, -0.05], caterpillar: [0.62, 0.3], snail: [-0.15, 0.62] };
const BACK_Y = -0.6;      // the silhouettes' row
const FRONT_MIN_Y = -0.2; // met friends stay in front of it
// px/s at a 64 px sprite.
const SPEED = { ladybug: 16, butterfly: 34, caterpillar: 8, snail: 6 };

export function renderGarden(root) {
  const g = gardenOf();
  const screen = el('div', 'garden-screen');
  const bar = el('div', 'screen-bar');
  const back = button('Back', 'btn-garden-back', () => go('garden', 'btn-garden-back'), { cls: 'btn-back' });
  back.prepend(svg(BACK_SVG, 'back-chev'));
  const met = FRIENDS.filter((sp) => g[sp]);
  const title = el('div', 'bar-heading');
  title.append(el('h1', 'screen-title', 'Bug Garden'));
  const count = el('p', 'screen-sub', met.length ? `${met.length} of ${FRIENDS.length} friends met` : 'Pet a friendly bug in a field to meet it');
  count.setAttribute('data-testid', 'garden-count');
  title.append(count);
  bar.append(back, title, el('div', 'bar-right'));
  const jar = el('div', 'garden-jar');
  screen.append(jar, bar);
  root.append(screen);

  const unmetList = FRIENDS.filter((sp) => !g[sp]);
  const bugs = FRIENDS.map((sp) => {
    const isMet = !!g[sp];
    const k = unmetList.indexOf(sp);
    const span = Math.min(0.62, 0.21 * (unmetList.length - 1));
    const home = isMet ? HOME[sp] : [unmetList.length > 1 ? -span + (2 * span * k) / (unmetList.length - 1) : 0, BACK_Y];
    const b = el('button', `garden-friend ${isMet ? 'met' : 'unmet'}`);
    b.type = 'button';
    b.dataset.sp = sp;
    b.setAttribute('data-testid', `garden-friend-${sp}`);
    b.setAttribute('aria-label', isMet ? SPECIES[sp].name : `${SPECIES[sp].name}: not met yet`);
    const img = el('img', 'friend-art');
    img.src = sp === 'ladybug' && isMet ? CRAWL_URLS[0] : bugPortrait(sp);
    img.alt = '';
    img.draggable = false;
    b.append(img);
    b.addEventListener('click', () => showFriend(sp, g[sp] || null));
    const f = { sp, met: isMet, el: b, img, x: home[0], y: home[1], hd: Math.random() * 6.28, tgt: 0, rest: 0.5 + Math.random() * 2, t: Math.random() * 10, held: false, frame: 0 };
    f.tgt = f.hd;
    b.addEventListener('pointerenter', () => { f.held = true; });
    b.addEventListener('pointerleave', () => { f.held = false; });
    b.addEventListener('focus', () => { f.held = true; });
    b.addEventListener('blur', () => { f.held = false; });
    jar.append(b);
    return f;
  });
  // One tag over the row of silhouettes.
  const tag = el('span', 'friend-tag', 'Not met yet');
  tag.setAttribute('data-testid', 'garden-unmet-tag');
  tag.hidden = !unmetList.length;
  jar.append(tag);
  const first = bugs.find((f) => f.met) || bugs[0];
  first.el.setAttribute('data-autofocus', '');

  let box = null;
  const lay = () => {
    const W = window.innerWidth, H = window.innerHeight;
    const J = W >= H ? JAR.land : JAR.port;
    const k = Math.max(W / J.iw, H / J.ih);
    const ox = (W - J.iw * k) / 2, oy = (H - J.ih * k) / 2;
    const size = Math.round(Math.max(40, Math.min(72, J.rx * J.iw * k * 0.36)));
    box = { cx: ox + J.cx * J.iw * k, cy: oy + J.cy * J.ih * k, rx: J.rx * J.iw * k, ry: J.ry * J.ih * k, size };
    screen.style.setProperty('--friend', `${size}px`);
    tag.style.transform = `translate(-50%, 0) translate(${box.cx.toFixed(1)}px, ${(box.cy + BACK_Y * box.ry - size / 2 - 26).toFixed(1)}px)`;
  };
  lay();

  let raf = 0, last = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const reduced = reducedMotion();
    for (const f of bugs) step(f, dt, reduced, box);
  };
  raf = requestAnimationFrame(frame);
  window.addEventListener('resize', lay);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', lay);
    closeModal(true);
  };
}

function step(f, dt, reduced, box) {
  f.t += dt;
  const sp = f.sp;
  let moving = false;
  if (f.met && !f.held) {
    if (f.rest > 0) {
      f.rest -= dt;
    } else {
      moving = true;
      if (Math.random() < 0.7 * dt) f.tgt = f.hd + (Math.random() - 0.5) * 1.8;
      if (Math.random() < (sp === 'butterfly' ? 0.35 : 0.18) * dt) f.rest = 1 + Math.random() * 3;
      // Turn back inside the jar, and in front of the silhouettes.
      if (f.x * f.x + f.y * f.y > 0.72) f.tgt = Math.atan2(-f.y, -f.x);
      if (f.y < FRONT_MIN_Y) f.tgt = Math.PI / 2 + (f.x > 0 ? 0.4 : -0.4);
      let d = f.tgt - f.hd;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      f.hd += Math.max(-2.5 * dt, Math.min(2.5 * dt, d));
      const v = SPEED[sp] * (reduced ? 0.5 : 1) * (box.size / 64);
      f.x += (Math.cos(f.hd) * v * dt) / box.rx;
      f.y += (Math.sin(f.hd) * v * dt) / box.ry;
      const r = Math.hypot(f.x, f.y);
      if (r > 0.9) { f.x *= 0.9 / r; f.y *= 0.9 / r; }
      f.y = Math.max(FRONT_MIN_Y - 0.08, f.y);
    }
  }
  const x = box.cx + f.x * box.rx, y = box.cy + f.y * box.ry;
  let rot = f.met ? f.hd + Math.PI / 2 : 0;
  let sx = 1, sy = 1, lift = 0;
  if (f.met && !reduced) {
    if (sp === 'butterfly') {
      // Wings open and close; it bobs above the floor while flying.
      sx = moving ? 0.55 + 0.45 * Math.abs(Math.cos(f.t * 9)) : 0.85 + 0.15 * Math.abs(Math.cos(f.t * 1.5));
      lift = moving ? 10 + 4 * Math.sin(f.t * 3) : 0;
    } else if (sp === 'caterpillar') {
      sy = 1 + (moving ? 0.06 * Math.sin(f.t * 6) : 0);
    } else if (sp === 'snail') {
      rot += 0.05 * Math.sin(f.t * 1.2);
    }
  }
  if (sp === 'ladybug' && f.met && moving) {
    f.frame = Math.floor(f.t * 8) % 4;
    const src = CRAWL_URLS[f.frame];
    if (!f.img.src.endsWith(src)) f.img.src = src;
  }
  f.el.style.transform = `translate(${(x - box.size / 2).toFixed(1)}px, ${(y - box.size / 2 - lift).toFixed(1)}px)`;
  f.img.style.transform = `rotate(${rot.toFixed(3)}rad) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  f.el.style.zIndex = String(Math.round((f.met ? 3000 : 1000) + y));
}

function showFriend(sp, entry) {
  const name = SPECIES[sp].name;
  const card = el('div', 'friend-card');
  const pic = el('div', `friend-pic${entry ? '' : ' unmet'}`);
  const img = el('img');
  img.src = bugPortrait(sp);
  img.alt = '';
  pic.append(img);
  card.append(pic, el('h2', 'card-title', name));
  if (entry) {
    const fields = Array.isArray(entry.fields) ? entry.fields.length : 0;
    card.append(el('p', 'card-sub friend-note', NOTES[sp]));
    const hearts = el('div', 'hearts');
    hearts.setAttribute('data-testid', 'friend-hearts');
    const n = heartsFor(fields);
    hearts.dataset.hearts = String(n);
    hearts.setAttribute('aria-label', `Friendship: ${n} of 3 hearts`);
    for (let k = 0; k < 3; k++) hearts.append(svg(HEART_SVG, `heart${k < n ? ' on' : ''}`));
    card.append(hearts);
    const dl = el('dl', 'card-stats');
    dl.append(el('dt', '', 'First met'), el('dd', '', fmtDate(entry.firstMet)));
    dl.append(el('dt', '', 'Petted on'), el('dd', '', fields === 1 ? '1 field' : `${fields} fields`));
    card.append(dl);
  } else {
    card.append(el('p', 'card-sub', 'Not met yet'));
    const f = firstFieldOf(sp);
    if (f) card.append(el('p', 'friend-note', `One lives in ${getLevel(f).name} (field\u00a0${f}). Tap it there to say hello.`));
  }
  const row = el('div', 'card-actions');
  row.append(button('Close', 'btn-friend-close', () => closeModal(), { primary: true }));
  card.append(row);
  openModal(card, { kind: 'friend' });
}
