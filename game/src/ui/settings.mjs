// ui/settings.mjs -- Settings (GAME_DESIGN.md "Screens", Settings): music and
// sound volume (wired to the audio buses), haptics (where the device can
// vibrate), reduced motion (Auto / Off / On), sweep by hovering (desktop, off
// by default), your name for challenge links, Report a bug (once the game is
// published), the keys, credits, and clear data with an in-game confirm.
// Back returns to the screen you came from. Every change is saved at once.

import { go } from '../nav.mjs';
import { clearSave } from '../storage.mjs';
import {
  getSettings, setSetting, reloadSettings, hapticsSupported, hoverSupported, NAME_MAX, cleanName,
} from '../prefs.mjs';
import { audio } from '../audio.mjs';
import { el, button, svg, BACK_SVG } from './dom.mjs';
import { openModal, closeModal, toast } from './modal.mjs';

function row(label, control, { id, note } = {}) {
  const r = el('div', 'set-row');
  const l = el('label', 'set-label', label);
  if (id) l.htmlFor = id;
  const text = el('div', 'set-text');
  text.append(l);
  if (note) text.append(el('p', 'set-note', note));
  r.append(text, control);
  return r;
}

function slider(id, value, onInput) {
  const s = el('input', 'set-slider');
  s.type = 'range';
  s.id = id;
  s.min = '0';
  s.max = '100';
  s.step = '5';
  s.value = String(Math.round(value * 100));
  s.setAttribute('data-testid', id);
  const out = el('output', 'set-value', `${s.value}%`);
  out.htmlFor = id;
  s.addEventListener('input', () => {
    out.textContent = `${s.value}%`;
    onInput(Number(s.value) / 100);
  });
  const wrap = el('div', 'set-control slider-wrap');
  wrap.append(s, out);
  return wrap;
}

function toggle(id, on, onChange, label) {
  const b = el('button', 'switch');
  b.type = 'button';
  b.setAttribute('role', 'switch');
  b.setAttribute('data-testid', id);
  b.id = id;
  b.setAttribute('aria-label', label);
  const set = (v) => {
    b.setAttribute('aria-checked', v ? 'true' : 'false');
    b.classList.toggle('on', v);
  };
  set(on);
  b.append(el('span', 'switch-knob'));
  b.addEventListener('click', () => {
    const v = b.getAttribute('aria-checked') !== 'true';
    set(v);
    onChange(v);
  });
  const wrap = el('div', 'set-control');
  wrap.append(b);
  return wrap;
}

function segmented(id, options, value, onChange) {
  const g = el('div', 'segmented');
  g.setAttribute('role', 'radiogroup');
  g.setAttribute('data-testid', id);
  const btns = options.map(([v, label]) => {
    const b = el('button', 'seg', label);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.value = v;
    b.setAttribute('data-testid', `${id}-${v}`);
    b.addEventListener('click', () => {
      for (const x of btns) x.setAttribute('aria-checked', x === b ? 'true' : 'false');
      onChange(v);
    });
    b.setAttribute('aria-checked', v === value ? 'true' : 'false');
    g.append(b);
    return b;
  });
  const wrap = el('div', 'set-control');
  wrap.append(g);
  return wrap;
}

export function renderSettings(root, app) {
  const st = getSettings();
  const screen = el('div', 'settings-screen');
  const bar = el('div', 'screen-bar');
  const back = button('Back', 'btn-settings-back', () => go('settings', 'btn-settings-back'), { cls: 'btn-back' });
  back.prepend(svg(BACK_SVG, 'back-chev'));
  bar.append(back, el('h1', 'screen-title', 'Settings'), el('div', 'bar-right'));

  const panel = el('div', 'settings-panel card');
  const sound = el('section', 'set-group set-sound');
  sound.append(
    row('Music', slider('set-music', st.music, (v) => { setSetting('music', v); audio.setVolumes({ music: v }); }), { id: 'set-music' }),
    row('Sound', slider('set-sound', st.sound, (v) => { setSetting('sound', v); audio.setVolumes({ sound: v }); }), { id: 'set-sound' }),
  );
  panel.append(sound);

  const play = el('section', 'set-group set-play');
  if (hapticsSupported()) {
    play.append(row('Haptics', toggle('set-haptics', st.haptics, (v) => setSetting('haptics', v), 'Haptics'), { note: 'A little buzz on strokes, pets and nips' }));
  }
  play.append(row('Reduced motion', segmented('set-motion', [['auto', 'Auto'], ['off', 'Off'], ['on', 'On']], st.motion, (v) => setSetting('motion', v)),
    { note: 'Auto follows your device' }));
  if (hoverSupported()) {
    play.append(row('Sweep by hovering', toggle('set-hover', st.hover, (v) => {
      setSetting('hover', v);
      if (v) toast('A moving pointer sweeps, and grumpy bugs notice it', 3200);
    }, 'Sweep by hovering'), { note: 'Sweep without holding the button. Rest the pointer to lift it.' }));
  }
  const name = el('input', 'set-name');
  name.type = 'text';
  name.id = 'set-name';
  name.maxLength = NAME_MAX;
  name.autocomplete = 'nickname';
  name.spellcheck = false;
  name.placeholder = 'Optional';
  name.value = st.name;
  name.setAttribute('data-testid', 'set-name');
  name.addEventListener('change', () => { name.value = setSetting('name', cleanName(name.value)); });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
  const nameWrap = el('div', 'set-control');
  nameWrap.append(name);
  play.append(row('Your name', nameWrap, { id: 'set-name', note: 'Shown in challenge links you share' }));
  panel.append(play);

  const more = el('section', 'set-group set-more');
  if (window.gameReport?.shown()) {
    more.append(button('Report a bug', 'btn-settings-report', () => window.gameReport?.open()));
  }
  const keys = el('ul', 'set-keys');
  keys.setAttribute('data-testid', 'set-keys');
  const lines = ['Drag: sweep the grass', '1, 2, 3: arm a move', 'Esc or P: pause', 'M: sound on or off'];
  if (window.gameReport?.shown()) lines.push('Ctrl+Shift+F: report a bug');
  for (const t of lines) keys.append(el('li', '', t));
  if (!(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)) more.append(el('p', 'set-label', 'Keys'), keys);
  const clear = button('Clear data', 'btn-clear-data', () => confirmClear(app), { cls: 'btn-danger' });
  more.append(clear);
  panel.append(more);

  const credits = el('section', 'set-group set-credits');
  credits.setAttribute('data-testid', 'set-credits');
  credits.append(
    el('p', 'credit-main', 'Touch Grass by Rich Conlan, finished with gamegen'),
    el('p', '', 'Art by imagegen2 and nanogen. Sound by ElevenLabs, via audiogen.'),
    el('p', '', 'Fonts: Fraunces and Nunito, under the SIL Open Font License.'),
  );
  panel.append(credits);

  screen.append(bar, panel);
  root.append(screen);
  back.setAttribute('data-autofocus', '');
  return () => closeModal(true);
}

function confirmClear(app) {
  const card = el('div', 'confirm-card');
  card.append(
    el('h2', 'card-title', 'Clear all data?'),
    el('p', 'card-sub', 'Your fields, best scores, Bug Garden friends and settings will be gone for good.'),
  );
  const row2 = el('div', 'card-actions');
  const keep = button('Keep my meadow', 'btn-clear-cancel', () => closeModal(), { primary: true });
  const yes = button('Clear everything', 'btn-clear-confirm', () => {
    closeModal(true);
    clearSave();
    const s = reloadSettings();
    audio.setMuted(false);
    audio.setVolumes({ music: s.music, sound: s.sound });
    if (app && app.onCleared) app.onCleared();
    go('settings', 'btn-clear-confirm');
    toast('Cleared. A fresh meadow.');
  }, { cls: 'btn-danger' });
  row2.append(keep, yes);
  card.append(row2);
  openModal(card, { kind: 'confirm' });
}
