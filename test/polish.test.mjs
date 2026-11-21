// test/polish.test.mjs -- the polish review's fixes that can be checked
// without a browser: How to play's general lines and pictures, one time
// format, and the layout's room for the tufts above the field.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HINTS, howtoArt, forInput, CHECKLIST } from '../game/src/hints.mjs';
import { fmtTime } from '../game/src/sim/score.mjs';
import { computeLayout, TOP_PAD_SHARE } from '../game/src/sim/layout.mjs';
import { getLevel, shapeBounds } from '../game/src/sim/levels.mjs';

// Words that only make sense on the field the hint opened on.
const FIELD_ONLY = [
  /stripe in the middle/i, /two ladybugs/i, /every kind of grass grows here/i, /sit in the corner/i,
  /the last field/i, /both fields/i, /\bhere\b/i, /\bthe ladybug\b/i, /\bit\b.*\bsay hello\b/i,
];

test('how to play: every hint has a general line, free of field-specific words', () => {
  for (const h of HINTS) {
    assert.equal(typeof h.howto, 'string', `${h.id} has a howto line`);
    assert.ok(h.howto.length > 10, h.id);
    for (const re of FIELD_ONLY) assert.ok(!re.test(h.howto), `${h.id}: "${h.howto}" matches ${re}`);
  }
  // The cards that named their field get a general title in How to play.
  for (const id of ['hedge-clear', 'caterpillar', 'finale']) {
    const h = HINTS.find((x) => x.id === id);
    assert.ok(h.howtoTitle && h.howtoTitle !== h.title, `${id} has a general title`);
  }
  // The guest checklist's lines say the same lessons (its wording is reused).
  assert.equal(HINTS.find((h) => h.id === 'regrow').howto, CHECKLIST.regrow);
  assert.equal(HINTS.find((h) => h.id === 'bee').howto, CHECKLIST.bee);
  // The mouse wording still applies.
  assert.match(forInput(HINTS.find((h) => h.id === 'snail').howto, 'mouse'), /Click one to say hello/);
  assert.match(forInput(HINTS.find((h) => h.id === 'stiff-line').howto, 'mouse'), /let go/);
});

test('how to play: a hint that brings a move always shows its icon; two pictures (three with an arrow)', () => {
  for (const h of HINTS) {
    const art = howtoArt(h.art);
    for (const a of h.art) if (a.move) assert.ok(art.includes(a), `${h.id} keeps the ${a.move} icon`);
    const n = h.art.some((a) => a.arrow) ? 3 : 2;
    assert.ok(art.length <= n && art.length >= Math.min(n, h.art.length), `${h.id}: ${art.length} pictures`);
    // In the card's order.
    assert.deepEqual(art, h.art.filter((a) => art.includes(a)));
  }
  assert.deepEqual(howtoArt(HINTS.find((h) => h.id === 'stiff-line').art).map((a) => a.tuft || a.move), ['stiff', 'line']);
  assert.deepEqual(howtoArt(HINTS.find((h) => h.id === 'hedge-clear').art).map((a) => a.tuft || a.move), ['tall', 'clear']);
});

test('times: always m:ss', () => {
  assert.equal(fmtTime(43), '0:43');
  assert.equal(fmtTime(30), '0:30');
  assert.equal(fmtTime(5.4), '0:05');
  assert.equal(fmtTime(59.6), '1:00');
  assert.equal(fmtTime(75), '1:15');
  assert.equal(fmtTime(0), '0:00');
  assert.equal(fmtTime(125.2), '2:05');
});

test('layout: on a wide screen more of the padding sits above the field (room for tufts), cells unchanged', () => {
  for (const n of [1, 11, 15]) {
    const s = getLevel(n), b = shapeBounds(s);
    const d = computeLayout(1280, 800, s.w, s.h, {}, b);
    const top = d.field.y + b.y0 * d.cell;
    const bottom = 800 - (d.field.y + b.y1 * d.cell);
    assert.ok(top > bottom, `field ${n}: ${top.toFixed(1)} above, ${bottom.toFixed(1)} below`);
    // Tall tufts spill up to about a cell: the top row keeps room for most of it.
    assert.ok(top >= 24 * TOP_PAD_SHARE - 1e-6, `field ${n}: ${top.toFixed(1)} px above`);
    // The area is only moved, not shrunk: the cell size (and so the pacing) is the same.
    assert.equal(d.area.h, 800 - 2 * 24);
  }
});
