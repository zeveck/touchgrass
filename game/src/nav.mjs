// src/nav.mjs -- every button on every screen and where it leads
// (GAME_DESIGN.md "Screens", State machine). The screens press their buttons
// through go(), which only follows a target listed here, so the table is the
// wiring, and a unit test walks it: no dead buttons, every screen has a way
// out, and every listed move is an allowed transition.
//
// Targets: a state name, 'previous' (return to the screen it came from), or
// null (the button acts in place: a toggle, a card, share).

import { setState, getState, getPrevious, canTransition } from './state.mjs';

const T = (...to) => Object.freeze(to);

export const NAV = Object.freeze({
  title: {
    'btn-start': T('playing'),
    'btn-continue': T('playing', 'map'),        // the map once every field is done
    'btn-map': T('map'),
    'btn-farm': T('garden'),                    // the Bug Garden (the testid is the original's)
    'btn-settings': T('settings'),
    'btn-title-mute': T(null),
  },
  map: {
    'btn-map-back': T('title'),
    'btn-map-garden': T('garden'),
    'btn-map-settings': T('settings'),
    'map-token': T('playing', null),             // a locked patch only says so
  },
  garden: {
    'btn-garden-back': T('previous'),
    'garden-friend': T(null),
    'btn-friend-close': T(null),
  },
  settings: {
    'btn-settings-back': T('previous'),
    'btn-clear-data': T(null),
    'btn-clear-confirm': T('title'),
    'btn-clear-cancel': T(null),
    'btn-settings-report': T(null),
    'set-motion': T(null),
  },
  playing: {
    'btn-pause': T('paused'),
    'btn-mute': T(null),
    'btn-move': T(null),
  },
  paused: {
    'btn-resume': T('playing'),
    'btn-restart': T('playing'),
    'btn-howto': T(null),
    'btn-howto-back': T(null),
    'btn-pause-settings': T('settings'),
    'btn-pause-map': T('map'),
    'btn-pause-title': T('title'),
    'btn-pause-report': T(null),
  },
  hint: {
    'btn-hint-ok': T('playing'),
    'btn-checklist-ok': T('playing'),
  },
  'level-won': {
    'btn-next-field': T('playing', 'ending'),   // Finish after field 15
    'btn-try-again': T('playing'),              // a guest challenge
    'btn-complete-map': T('map'),
    'btn-complete-share': T(null),
  },
  ending: {
    'btn-ending-map': T('map'),
    'btn-ending-share': T(null),
  },
  challenge: {
    'btn-challenge-play': T('playing'),
    'btn-challenge-notnow': T('title'),
  },
});

// Screens that return to where they came from, and where they can be opened.
export const RETURNS = Object.freeze({
  garden: T('title', 'map'),
  settings: T('title', 'map', 'paused'),
});

// Press a button: go where the table says. `to` picks one of several listed
// targets (for example Play: a field, or the map once all are done).
export function go(screen, id, to) {
  const list = (NAV[screen] && NAV[screen][id]) || null;
  if (!list) throw new Error(`nav: no button ${id} on ${screen}`);
  let target = to === undefined ? list[0] : to;
  if (!list.includes(target)) throw new Error(`nav: ${id} on ${screen} can't go to ${target}`);
  if (target === null) return null;
  if (target === 'previous') {
    const prev = getPrevious();
    target = prev && canTransition(getState(), prev) ? prev : 'title';
  }
  setState(target);
  return target;
}
