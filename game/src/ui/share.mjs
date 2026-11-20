// ui/share.mjs -- the Share button's flow (GAME_DESIGN.md "Screens", Share).
// The first time, a small card asks "Your name, for challenge links
// (optional)", up to 12 characters, saved. Then the 1200x630 scorecard is
// drawn and goes out by Web Share (with the picture, then text and link),
// the clipboard, or a download card.

import { getSettings, setSetting, NAME_MAX, cleanName } from '../prefs.mjs';
import { challengeUrl } from '../share/link.mjs';
import { runShare } from '../share/flow.mjs';
import { drawScorecard, canvasBlob } from '../share/scorecard.mjs';
import { getLevel } from '../sim/levels.mjs';
import { fmtScore } from '../sim/score.mjs';
import { el, button } from './dom.mjs';
import { openModal, closeModal, toast } from './modal.mjs';

export function gameBase() {
  return location.origin + location.pathname;
}

// Ask for the name once. Resolves when answered or skipped.
function askName() {
  return new Promise((resolve) => {
    const card = el('div', 'name-card');
    card.append(el('h2', 'card-title', 'Your name, for challenge links'), el('p', 'card-sub', 'Optional. Friends see it when you challenge them.'));
    const input = el('input', 'set-name');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.placeholder = 'Your name';
    input.autocomplete = 'nickname';
    input.spellcheck = false;
    input.value = getSettings().name;
    input.setAttribute('data-testid', 'share-name');
    input.setAttribute('aria-label', 'Your name, for challenge links (optional)');
    input.setAttribute('data-autofocus', '');
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      setSetting('askedName', true);
      if (save) setSetting('name', cleanName(input.value));
      closeModal(true);
      resolve();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } });
    const row = el('div', 'card-actions');
    row.append(
      button('Continue', 'btn-share-name-ok', () => finish(true), { primary: true }),
      button('Skip', 'btn-share-name-skip', () => finish(false)),
    );
    card.append(input, row);
    openModal(card, { kind: 'share-name', onClose: () => finish(false) });
  });
}

function showDownload(card) {
  const box = el('div', 'download-card');
  // Two halves (side by side on a short screen): the picture, and the rest.
  const pic = el('div', 'dl-pic'), side = el('div', 'dl-side');
  const url = card.blob ? URL.createObjectURL(card.blob) : null;
  if (url) {
    const img = el('img', 'download-preview');
    img.src = url;
    img.alt = 'Your Touch Grass scorecard';
    pic.append(img);
  }
  side.append(el('p', 'card-sub', 'Save the picture, and send the link to a friend.'));
  const link = el('input', 'download-link');
  link.type = 'text';
  link.readOnly = true;
  link.value = card.url;
  link.setAttribute('aria-label', 'Challenge link');
  link.setAttribute('data-testid', 'share-link');
  link.addEventListener('focus', () => link.select());
  side.append(link);
  const row = el('div', 'card-actions');
  if (url) {
    const a = el('a', 'btn primary', 'Save picture');
    a.href = url;
    a.download = 'touch-grass-score.png';
    a.setAttribute('data-testid', 'btn-share-download');
    row.append(a);
  }
  row.append(button('Close', 'btn-share-close', () => closeModal()));
  side.append(row);
  box.append(el('h2', 'card-title', 'Share your score'), pic, side);
  openModal(box, { kind: 'share-download', onClose: () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); } });
}

let busy = false;

// what: { kind: 'field', n, score, friends } or { kind: 'ending', total, friends }
// Returns the flow's result ('file' | 'link' | 'copied' | 'download' | 'aborted').
export async function share(what) {
  if (busy) return 'busy';
  busy = true;
  try {
    if (!getSettings().askedName) await askName();
    const name = getSettings().name;
    let o;
    if (what.kind === 'field') {
      const spec = getLevel(what.n);
      const url = challengeUrl(gameBase(), { f: what.n, s: what.score, n: name });
      o = {
        time: spec.time, kicker: `Field ${what.n}`, title: spec.name, scoreLabel: name ? `${name} scored` : 'Score',
        score: fmtScore(what.score), friends: what.friends, url,
        text: `I scored ${fmtScore(what.score)} on ${spec.name} in Touch Grass. Can you beat it?`,
      };
    } else {
      const url = gameBase();
      o = {
        time: 'golden', kicker: 'All fifteen fields', title: 'I touched all the grass', scoreLabel: name ? `${name}'s total` : 'Total score',
        score: fmtScore(what.total), friends: what.friends, url,
        text: `I touched all the grass in Touch Grass: ${fmtScore(what.total)} points. Go touch some grass.`,
      };
    }
    o.link = o.url.replace(/^https?:\/\//, '');
    let blob = null;
    try { blob = await canvasBlob(await drawScorecard(o)); } catch (e) { console.warn('scorecard:', e.message); }
    return await runShare({ blob, title: 'Touch Grass', text: o.text, url: o.url }, {
      nav: navigator, File: typeof File === 'function' ? File : null, toast, showDownload,
    });
  } finally {
    busy = false;
  }
}

// Dev: the scorecard as a data URL (for checking it by eye).
export async function scorecardDataUrl(what) {
  const spec = getLevel(what.n || 15);
  const cv = await drawScorecard({
    time: spec.time, kicker: `Field ${spec.n}`, title: spec.name, scoreLabel: 'Score', score: fmtScore(what.score || 0),
    friends: what.friends || [], link: challengeUrl(gameBase(), { f: spec.n, s: what.score || 0, n: getSettings().name }).replace(/^https?:\/\//, ''),
  });
  return cv.toDataURL('image/png');
}
