// ui/map.mjs -- the meadow map (GAME_DESIGN.md "Screens", Meadow map).
//
// The painting by orientation (9:16 portrait, 16:9 landscape and desktop);
// the path and the 15 patch tokens are drawn in code from maplayout.mjs.
// A locked patch is bare and greyed, an unlocked one glows softly, and a
// finished one shows its bloom (with a code ring, since the bloom art is
// green on green), its best score, and a small gold leaf if it was cleared.
// Tap a patch to play it. Nothing scrolls.

import { go } from '../nav.mjs';
import { readSave, nextUnfinished } from '../storage.mjs';
import { LEVELS } from '../sim/levels.mjs';
import { fmtScore } from '../sim/score.mjs';
import { mapLayout, pathThrough } from './maplayout.mjs';
import { el, button, svg, BACK_SVG, LEAF_SVG, safeInsets } from './dom.mjs';
import { toast, hideToast } from './modal.mjs';

const NS = 'http://www.w3.org/2000/svg';

export function renderMap(root, app) {
  const s = readSave();
  const screen = el('div', 'map-screen');
  const bar = el('div', 'screen-bar');
  const back = button('Title', 'btn-map-back', () => go('map', 'btn-map-back'), { cls: 'btn-back' });
  back.prepend(svg(BACK_SVG, 'back-chev'));
  const h = el('h1', 'screen-title', 'The Meadow');
  const right = el('div', 'bar-right');
  right.append(
    button('Bug Garden', 'btn-map-garden', () => go('map', 'btn-map-garden'), { icon: 'assets/ui/garden.png', iconOnly: true }),
    button('Settings', 'btn-map-settings', () => go('map', 'btn-map-settings'), { icon: 'assets/ui/settings.png', iconOnly: true }),
  );
  bar.append(back, h, right);

  const path = document.createElementNS(NS, 'svg');
  path.setAttribute('class', 'map-path');
  path.setAttribute('aria-hidden', 'true');
  const tokens = el('div', 'map-tokens');
  tokens.setAttribute('role', 'list');
  tokens.setAttribute('aria-label', 'Fields');
  screen.append(path, tokens, bar);
  root.append(screen);

  const next = nextUnfinished(s);
  const btns = [];
  for (const spec of LEVELS) {
    const n = spec.n;
    const done = s.progress.fields[n] || null;
    const open = n <= s.progress.unlocked;
    const b = el('button', `map-token ${done ? 'done' : open ? 'open' : 'locked'}${n === next ? ' next' : ''}`);
    b.type = 'button';
    b.setAttribute('data-testid', `map-token-${n}`);
    b.setAttribute('role', 'listitem');
    b.dataset.n = String(n);
    b.dataset.time = spec.time;
    const img = el('img', 'token-art');
    img.src = done ? 'assets/ui/patch-bloom.png' : 'assets/ui/patch-bare.png';
    img.alt = '';
    const num = el('span', 'token-num', String(n));
    b.append(img, num);
    let label = `Field ${n}, ${spec.name}`;
    if (done) {
      const best = el('span', 'token-best', fmtScore(done.best));
      best.setAttribute('data-testid', `map-best-${n}`);
      b.append(best);
      label += `, best ${fmtScore(done.best)}`;
      if (done.cleared) {
        b.append(svg(LEAF_SVG, 'token-leaf'));
        label += ', every blade touched';
      }
    } else if (!open) {
      label += ', locked';
      b.setAttribute('aria-disabled', 'true');
    }
    b.setAttribute('aria-label', label);
    b.title = `${n}. ${spec.name}`;
    b.addEventListener('click', () => {
      if (!open) {
        toast(`Field ${n} opens once field ${n - 1} is done`);
        b.classList.remove('nudge');
        void b.offsetWidth;
        b.classList.add('nudge');
        return;
      }
      app.play(n, 'map', 'map-token');
    });
    tokens.append(b);
    btns.push(b);
  }
  (btns[(next || 1) - 1]).setAttribute('data-autofocus', '');

  const lay = () => {
    const w = window.innerWidth, hh = window.innerHeight;
    const L = mapLayout(w, hh, safeInsets());
    screen.classList.toggle('portrait', L.portrait);
    screen.style.setProperty('--tok', `${L.size}px`);
    path.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    path.setAttribute('width', String(w));
    path.setAttribute('height', String(hh));
    const d = pathThrough(L.tokens);
    // The walked part (up to the furthest open patch) is golden.
    const reach = Math.min(LEVELS.length, s.progress.unlocked);
    const walked = pathThrough(L.tokens.slice(0, reach));
    const sw = Math.max(14, L.size * 0.32);
    path.innerHTML = '';
    const mk = (cls, dd, width) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', dd);
      p.setAttribute('class', cls);
      p.setAttribute('stroke-width', String(width));
      path.append(p);
    };
    mk('path-edge', d, sw + 6);
    mk('path-sand', d, sw);
    if (reach > 1) mk('path-walked', walked, Math.max(4, sw * 0.28));
    for (const t of L.tokens) {
      const b = btns[t.n - 1];
      b.style.left = `${t.x - L.size / 2}px`;
      b.style.top = `${t.y - L.size / 2}px`;
    }
  };
  lay();
  window.addEventListener('resize', lay);
  return () => {
    window.removeEventListener('resize', lay);
    // "Field N opens once..." belongs to the map: it doesn't follow you out.
    hideToast();
  };
}
