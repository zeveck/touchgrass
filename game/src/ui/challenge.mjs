// ui/challenge.mjs -- a challenge link's overlay (GAME_DESIGN.md "Screens",
// Challenge links): "Sam scored 1,240 on Sunset Meadow. Beat them?" with Play
// and Not now, over the title painting. A field not unlocked yet is played as
// a guest challenge. The name and score are only ever set with textContent.

import { go } from '../nav.mjs';
import { getLevel } from '../sim/levels.mjs';
import { isUnlocked } from '../storage.mjs';
import { challengeLine } from '../share/link.mjs';
import { el, button, sceneBackdrop } from './dom.mjs';

export function renderChallenge(root, app, ch) {
  const spec = getLevel(ch.f);
  const guest = !isUnlocked(ch.f);
  const screen = el('div', 'challenge-screen title-screen');
  const top = el('div', 'title-top');
  top.append(el('h1', 'title-logo', 'Touch Grass'));
  const card = el('div', 'card challenge-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('data-testid', 'card-challenge');
  card.append(el('p', 'card-kicker', 'A challenge'));
  const line = el('h2', 'card-title challenge-line', challengeLine(ch, spec.name));
  line.setAttribute('data-testid', 'challenge-line');
  card.append(line);
  card.append(el('p', 'card-sub', guest
    ? `You haven't reached field ${ch.f} yet. Play it as a guest: your map stays as it is.`
    : `Field ${ch.f}: ${spec.name}.`));
  const row = el('div', 'card-actions');
  const play = button('Play', 'btn-challenge-play', () => app.playChallenge(ch), { primary: true });
  play.setAttribute('data-autofocus', '');
  row.append(play, button('Not now', 'btn-challenge-notnow', () => go('challenge', 'btn-challenge-notnow')));
  card.append(row);
  const bg = sceneBackdrop('title');
  screen.append(bg.el, top, card);
  root.append(screen);
  return bg.dispose;
}
