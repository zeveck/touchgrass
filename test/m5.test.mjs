// test/m5.test.mjs -- milestone 5 (polish): the field fitted to its shape's
// real bounds, the landscape-phone HUD column, the hint card's foot per
// input, the Bug Garden keeping friends apart, and the bigger biters.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeLayout, HUD_COL_SMALL_PX, HUD_COL_SMALL_MAX_PX, HUD_COL_PX } from '../game/src/sim/layout.mjs';
import { LEVELS, getLevel, shapeBounds } from '../game/src/sim/levels.mjs';
import { hintFoot, forInput, HINTS, CHECKLIST } from '../game/src/hints.mjs';
import { separate, APART } from '../game/src/ui/garden.mjs';
import { bugSizePx, petRadiusPx } from '../game/src/sim/insects.mjs';

test('layout: shapeBounds is each field\'s polygon box (field 14 stops two rows short)', () => {
  for (const l of LEVELS) {
    const b = shapeBounds(l);
    assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= l.w && b.y1 <= l.h, `field ${l.n}`);
  }
  assert.deepEqual(shapeBounds(getLevel(14)), { x0: 0, y0: 0, x1: 35, y1: 33 });
  assert.deepEqual(shapeBounds(getLevel(9)), { x0: 0, y0: 0, x1: 27, y1: 27 });
});

test('layout: the shape (not its grid) is fitted and centred', () => {
  const s = getLevel(14), b = shapeBounds(s);
  for (const [vw, vh] of [[1280, 800], [844, 390], [390, 844]]) {
    const grid = computeLayout(vw, vh, s.w, s.h);
    const fit = computeLayout(vw, vh, s.w, s.h, {}, b);
    assert.ok(fit.cell >= grid.cell - 1e-9, `${vw}x${vh}: cells no smaller`);
    // The shape's box sits inside the area, centred both ways.
    const x0 = fit.field.x + b.x0 * fit.cell, x1 = fit.field.x + b.x1 * fit.cell;
    const y0 = fit.field.y + b.y0 * fit.cell, y1 = fit.field.y + b.y1 * fit.cell;
    assert.ok(x0 >= fit.area.x - 1e-6 && x1 <= fit.area.x + fit.area.w + 1e-6, `${vw}x${vh} x`);
    assert.ok(y0 >= fit.area.y - 1e-6 && y1 <= fit.area.y + fit.area.h + 1e-6, `${vw}x${vh} y`);
    assert.ok(Math.abs((x0 + x1) / 2 - (fit.area.x + fit.area.w / 2)) < 1e-6, `${vw}x${vh} centred x`);
    assert.ok(Math.abs((y0 + y1) / 2 - (fit.area.y + fit.area.h / 2)) < 1e-6, `${vw}x${vh} centred y`);
  }
  // Height-bound on desktop: field 14's cells grow by 35/33.
  const d0 = computeLayout(1280, 800, s.w, s.h), d1 = computeLayout(1280, 800, s.w, s.h, {}, b);
  assert.ok(Math.abs(d1.cell / d0.cell - 35 / 33) < 1e-9);
  // A full-grid shape lays out exactly as before.
  const s9 = getLevel(9);
  assert.deepEqual(computeLayout(390, 844, 27, 27, {}, shapeBounds(s9)).field, computeLayout(390, 844, 27, 27).field);
});

test('layout: a phone on its side gives the HUD column the width the field can\'t use', () => {
  const l = computeLayout(844, 390, 12, 12);
  assert.equal(l.hud.w, HUD_COL_SMALL_MAX_PX);
  // The field is as big as before (it's height-bound).
  assert.ok(Math.abs(l.cell - (390 - 24) / 12) < 1e-9);
  // A narrow landscape phone keeps the field's size and a smaller column.
  const se = computeLayout(568, 320, 12, 12);
  assert.ok(se.hud.w >= HUD_COL_SMALL_PX && se.hud.w < HUD_COL_SMALL_MAX_PX);
  assert.ok(Math.abs(se.cell - (320 - 24) / 12) < 1e-9, 'field still height-bound');
  // Desktop is unchanged.
  assert.equal(computeLayout(1280, 800, 12, 12).hud.w, HUD_COL_PX);
  // Every field at 844x390 stays at least as big as with the old 150 px column.
  for (const f of LEVELS) {
    const now = computeLayout(844, 390, f.w, f.h, {}, shapeBounds(f));
    const areaW = 844 - 150 - 84 - 2 * 12, areaH = 390 - 24;
    const b = shapeBounds(f);
    const old = Math.min(areaW / (b.x1 - b.x0), areaH / (b.y1 - b.y0));
    assert.ok(now.cell >= old - 1e-9, `field ${f.n}`);
  }
});

test('hints: the card\'s foot names the right action for the input', () => {
  assert.equal(hintFoot('touch'), 'Tap anywhere to play');
  assert.match(hintFoot('mouse'), /^Click anywhere/);
  assert.doesNotMatch(hintFoot('mouse'), /Tap/);
});

test('hints: with a mouse, no hint or checklist line says tap or finger', () => {
  for (const t of [...HINTS.map((h) => h.text), ...Object.values(CHECKLIST)]) {
    assert.doesNotMatch(forInput(t, 'mouse'), /\b[Tt]ap\b|finger/, t);
    assert.equal(forInput(t, 'touch'), t);
  }
  assert.equal(forInput('Tap it to say hello.', 'mouse'), 'Click it to say hello.');
});

test('garden: friends that bump into each other are pushed apart', () => {
  const box = { cx: 0, cy: 0, rx: 200, ry: 80, size: 60 };
  const mk = (sp, x, y) => ({ sp, met: true, held: false, x, y, hd: 0, tgt: 0 });
  const list = [mk('ladybug', 0, 0.1), mk('snail', 0.02, 0.12), mk('caterpillar', 0.03, 0.1), mk('butterfly', 0.5, 0.3)];
  const unmet = { sp: 'x', met: false, held: false, x: 0, y: 0.1 };
  for (let k = 0; k < 120; k++) separate([...list, unmet], box, 1 / 60);
  const met = list;
  for (let a = 0; a < met.length; a++) {
    for (let b = a + 1; b < met.length; b++) {
      const d = Math.hypot((met[a].x - met[b].x) * box.rx, (met[a].y - met[b].y) * box.ry);
      assert.ok(d >= APART * box.size - 0.5, `${met[a].sp} / ${met[b].sp}: ${d.toFixed(1)} px apart`);
    }
  }
  // Unmet silhouettes aren't moved; friends stay in the jar.
  assert.deepEqual([unmet.x, unmet.y], [0, 0.1]);
  for (const f of met) assert.ok(Math.hypot(f.x, f.y) <= 0.9 + 1e-9);
});

test('bugs: biters are drawn bigger than the friends, and the pet area follows the drawn size', () => {
  for (const cell of [10, 17, 21, 36]) {
    assert.ok(bugSizePx(cell, 'ant') > bugSizePx(cell, 'ladybug'));
    assert.ok(bugSizePx(cell, 'bee') > bugSizePx(cell, 'ladybug'));
    assert.ok(petRadiusPx(cell, 'ladybug') >= bugSizePx(cell, 'ladybug') / 2 + 6 - 1e-9);
  }
  // Desktop field 6 (36 px cells): the ant is about 86 px, past the old 64 px cap.
  assert.ok(bugSizePx(35.8, 'ant') > 80);
  // A phone's smallest cells still give a readable 36 px bug.
  assert.equal(bugSizePx(10), 36);
});
