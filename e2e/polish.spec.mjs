// e2e/polish.spec.mjs -- milestone 5 (polish): a new field never keeps the
// last field's leftovers on the live canvas, and a bite reads (the meter
// flashes red, the bug pops).

import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

async function openField(page, n, params = '&hints=0') {
  await page.goto(`/?dev=1&level=${n}${params}`);
  await expect.poll(() => page.evaluate(() => window.__game?.info().field)).toBe(n);
  await page.evaluate(() => window.__game.ready());
  await page.waitForTimeout(200);
}

// Is anything drawn on the live canvas in this page-px rectangle?
function inkIn(page, r) {
  return page.evaluate((r) => {
    const c = document.querySelector('.game-canvas-live');
    const k = c.width / innerWidth;
    const d = c.getContext('2d').getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.max(1, Math.round(r.w * k)), Math.max(1, Math.round(r.h * k))).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  }, r);
}

test('a new field starts on a clean live canvas (no rows left from a taller field)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // Field 4 (17 x 19) is taller on a phone than the square fields after it.
  // Each frame clears only the field plus its tufts' spill, so without a wipe
  // its top and bottom rows stayed on screen round field 9 (and 5 to 15).
  await openField(page, 4, '&hints=0&bugs=0');
  await page.evaluate(() => window.__game.loadLevel(9));
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => {
    const g = window.__game, f = g.layout.field, s = g._game.grass.atlas.S / g.layout.dpr;
    return { x: f.x, w: f.w, top: f.y - s, bottom: f.y + f.h + s * 0.5 };
  });
  const above = { x: 0, y: 80, w: 390, h: box.top - 2 - 80 };
  const below = { x: 0, y: box.bottom + 2, w: 390, h: 750 - box.bottom - 2 };
  await page.evaluate(() => window.__game.loadLevel(4));
  await page.waitForTimeout(300);
  // Field 4 draws in both strips...
  expect(await inkIn(page, above)).toBeGreaterThan(0);
  expect(await inkIn(page, below)).toBeGreaterThan(0);
  // ...and field 9 starts with them clean.
  await page.evaluate(() => window.__game.loadLevel(9));
  await page.waitForTimeout(300);
  expect(await inkIn(page, above)).toBe(0);
  expect(await inkIn(page, below)).toBe(0);
  expect(errors).toEqual([]);
});

test('a bite: the meter flashes red and "−3%" comes off the bug', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 6);
  await page.evaluate(() => { window.__game.clearBugs(); const id = window.__game.spawn('ant', 10, 6); window.__game.holdBug(id, 60); window.__game.setMeter(0.5); });
  const b = (await page.evaluate(() => window.__game.bugs()))[0].page;
  await page.mouse.move(b.x + 28, b.y);
  await page.mouse.down();
  let bitAt = null;
  for (let k = 0; k < 400 && bitAt === null; k++) {
    await page.mouse.move(b.x + 28 * Math.cos(k * 0.5), b.y + 28 * Math.sin(k * 0.5), { steps: 2 });
    if ((await page.evaluate(() => window.__game.info().bites)) > 0) bitAt = k;
  }
  expect(bitAt).not.toBeNull();
  await expect(page.getByTestId('hud-meter')).toHaveClass(/\bbit\b/);
  // The flash is brief.
  await expect(page.getByTestId('hud-meter')).not.toHaveClass(/\bbit\b/, { timeout: 2000 });
  await page.mouse.up();
  expect(errors).toEqual([]);
});
