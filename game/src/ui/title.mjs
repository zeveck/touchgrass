// src/ui/title.mjs -- the title screen (GAME_DESIGN.md "Screens", Title).
//
// The painted title scene (by orientation), the "Touch Grass" logo in
// Fraunces, "Best field: N" once there's a score ("Total score: N" once
// every field is done), and the buttons: Play (the next
// unfinished field; field 1 the first time; the map once all are done), Map,
// Bug Garden, a settings cog and a speaker. Grass along the bottom edge bends
// as the pointer passes (a toy before you start) and the ladybug wanders.
// The primary button keeps the original testids: `btn-start` with no
// progress, `btn-continue` after; the Bug Garden keeps `btn-farm`.

import { go } from '../nav.mjs';
import { readSave, hasProgress, nextUnfinished, totalScore, allDone } from '../storage.mjs';
import { getLevel } from '../sim/levels.mjs';
import { fmtScore } from '../sim/score.mjs';
import { reducedMotion } from '../prefs.mjs';
import { audio } from '../audio.mjs';
import { TitleToy } from '../render/titletoy.mjs';
import { el, button, sceneBackdrop } from './dom.mjs';

export function muteButton(testid) {
  const b = el('button', 'btn icon mute-btn');
  b.type = 'button';
  b.setAttribute('data-testid', testid);
  b.innerHTML = '<img src="assets/ui/sound-on.png" alt="" class="icon-on"><img src="assets/ui/sound-off.png" alt="" class="icon-off">';
  const sync = (st) => {
    b.classList.toggle('muted', st.muted);
    b.setAttribute('aria-pressed', st.muted ? 'true' : 'false');
    b.setAttribute('aria-label', st.muted ? 'Sound off' : 'Sound on');
  };
  sync(audio.state());
  const off = audio.onChange(sync);
  b.addEventListener('click', () => audio.toggleMute());
  return { el: b, dispose: off };
}

// Build the title into a screen element. app.play(n, screen, id, to) starts a
// field.
export function renderTitle(root, app) {
  const s = readSave();
  const screen = el('div', 'title-screen');

  const corner = el('div', 'title-corner');
  const mute = muteButton('btn-title-mute');
  const cog = button('Settings', 'btn-settings', () => go('title', 'btn-settings'), { icon: 'assets/ui/settings.png', iconOnly: true });
  corner.append(mute.el, cog);

  const top = el('div', 'title-top');
  const heading = el('h1', 'title-logo', 'Touch Grass');
  top.append(heading);
  // Before every field is done: the best single field ("Best field"). Once
  // all are done: the total, the same number the ending shows.
  if (s.allTimeBest > 0) {
    const best = el('p', 'best', allDone(s) ? `Total score: ${fmtScore(totalScore(s))}` : `Best field: ${fmtScore(s.allTimeBest)}`);
    best.setAttribute('data-testid', 'title-best');
    top.append(best);
  }

  const actions = el('div', 'title-actions');
  const progress = hasProgress(s);
  const next = nextUnfinished(s);
  const id = progress ? 'btn-continue' : 'btn-start';
  const play = button('Play', id, () => {
    if (next === null) go('title', id, 'map');
    else app.play(next, 'title', id);
  }, { primary: true, cls: 'btn-play' });
  play.setAttribute('data-autofocus', '');
  const sub = el('span', 'btn-sub', next === null ? 'Every field is in bloom' : `Field ${next}: ${getLevel(next).name}`);
  play.append(sub);
  play.setAttribute('aria-label', next === null ? 'Play: open the map' : `Play field ${next}, ${getLevel(next).name}`);
  const row = el('div', 'title-row');
  row.append(
    button('Map', 'btn-map', () => go('title', 'btn-map'), { icon: 'assets/ui/map.png' }),
    button('Bug Garden', 'btn-farm', () => go('title', 'btn-farm'), { icon: 'assets/ui/garden.png' }),
  );
  actions.append(play, row);

  const cv = el('canvas', 'title-toy');
  cv.setAttribute('aria-hidden', 'true');
  const bg = sceneBackdrop('title');
  screen.append(bg.el, cv, top, actions, corner);
  root.append(screen);

  const toy = new TitleToy(cv, { reduced: reducedMotion });
  const onMove = (e) => toy.pointer(e.clientX, e.clientY);
  const onLeave = () => toy.leave();
  const onResize = () => toy.resize();
  screen.addEventListener('pointermove', onMove);
  screen.addEventListener('pointerdown', onMove);
  screen.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => toy.start());
  return () => {
    toy.stop();
    mute.dispose();
    bg.dispose();
    window.removeEventListener('resize', onResize);
  };
}
