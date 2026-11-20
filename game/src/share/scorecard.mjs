// share/scorecard.mjs -- the 1200x630 scorecard, drawn in code
// (GAME_DESIGN.md "Screens", Share): the field's painted backdrop, the logo,
// the score, the field and up to three friend sprites, with the link written
// in the UI font (Nunito).

import { loadAll, loadImage } from '../assets.mjs';
import { sceneUrl } from '../assets.mjs';
import { bugPortrait } from '../render/bugs.mjs';

export const CARD_W = 1200, CARD_H = 630;
const INK = '#2b2a26', DEEP = '#2f6b34', CREAM = '#fbf3df';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Shrink a font until the text fits.
function fit(ctx, text, font, size, maxW, min = 12) {
  let s = size;
  ctx.font = font.replace('$', String(s));
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = font.replace('$', String(s));
  }
  return s;
}

// o: { time, kicker, title, score (text), scoreLabel, friends: [species],
//      link (shown text) }
export async function drawScorecard(o) {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const ctx = cv.getContext('2d');
  try {
    await Promise.all([
      document.fonts.load('600 80px Fraunces'),
      document.fonts.load('800 26px Nunito'),
      document.fonts.load('700 22px Nunito'),
    ]);
  } catch { /* draw with what's there */ }
  const friends = (o.friends || []).slice(0, 3);
  const [bg, paper, ...bugs] = await Promise.all([
    loadImage(sceneUrl(o.time || 'morning', false)).catch(() => null),
    loadImage('assets/textures/paper.jpg').catch(() => null),
    ...friends.map((sp) => loadImage(bugPortrait(sp)).catch(() => null)),
  ]);
  // The painted backdrop, covering.
  ctx.fillStyle = '#e9eccf';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (bg) {
    const k = Math.max(CARD_W / bg.width, CARD_H / bg.height);
    const w = bg.width * k, h = bg.height * k;
    ctx.drawImage(bg, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  }
  // The paper panel.
  const px = 70, py = 70, pw = 640, ph = 490;
  ctx.save();
  ctx.shadowColor = 'rgba(43, 42, 38, 0.35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.restore();
  if (paper) {
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 28);
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ctx.createPattern(paper, 'repeat');
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
  }
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Words.
  const cx = px + 48, maxW = pw - 96;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  fit(ctx, 'Touch Grass', '600 $px Fraunces, Georgia, serif', 76, maxW);
  ctx.fillText('Touch Grass', cx, py + 110);
  ctx.fillStyle = DEEP;
  fit(ctx, o.kicker.toUpperCase(), '800 $px Nunito, sans-serif', 26, maxW);
  ctx.fillText(o.kicker.toUpperCase(), cx, py + 170);
  ctx.fillStyle = INK;
  fit(ctx, o.title, '600 $px Fraunces, Georgia, serif', 44, maxW);
  ctx.fillText(o.title, cx, py + 222);
  ctx.fillStyle = '#5a5548';
  fit(ctx, o.scoreLabel, '700 $px Nunito, sans-serif', 26, maxW);
  ctx.fillText(o.scoreLabel, cx, py + 290);
  ctx.fillStyle = INK;
  fit(ctx, o.score, '600 $px Fraunces, Georgia, serif', 112, maxW);
  ctx.fillText(o.score, cx, py + 395);
  // The link, in the UI font.
  ctx.fillStyle = DEEP;
  fit(ctx, o.link, '700 $px Nunito, sans-serif', 24, maxW, 12);
  ctx.fillText(o.link, cx, py + ph - 42);
  // Friends on the right, each on a soft round of light.
  const spots = [[920, 190], [1050, 360], [870, 455]];
  bugs.forEach((img, j) => {
    if (!img) return;
    const [x, y] = spots[j];
    const g = ctx.createRadialGradient(x, y, 10, x, y, 105);
    g.addColorStop(0, 'rgba(251, 243, 223, 0.92)');
    g.addColorStop(1, 'rgba(251, 243, 223, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = 'rgba(43, 42, 38, 0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(img, x - 75, y - 75, 150, 150);
    ctx.restore();
  });
  return cv;
}

export function canvasBlob(cv) {
  return new Promise((resolve) => {
    try { cv.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); }
  });
}

export function preloadScorecard(time) {
  return loadAll([sceneUrl(time, false), 'assets/textures/paper.jpg']).catch(() => {});
}
