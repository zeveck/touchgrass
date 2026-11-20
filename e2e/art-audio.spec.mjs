// e2e/art-audio.spec.mjs -- milestone 2: painted art loads, audio unlocks on
// the first press, the rustle follows a real stroke, mute (M key and the HUD
// button) works and persists, and the meter's flower opens petals.

import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  // A load the browser cancels because the page is navigating away (reload)
  // isn't a failure of the game; any other failed request is.
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText || '';
    if (/cancel|abort/i.test(why)) return;
    errors.push(`request failed: ${r.url()} (${why})`);
  });
  return errors;
}

// Milestone 1/2 checks of sweeping, art and sound alone: no hint cards and
// no bugs (dev-only ?hints=0&bugs=0; bugs and hints have e2e/bugs-moves.spec.mjs).
async function openField(page, n) {
  await page.goto(`/?dev=1&level=${n}&hints=0&bugs=0`);
  await expect.poll(() => page.evaluate(() => window.__game?.info().field)).toBe(n);
  await page.evaluate(() => window.__game.ready());
}

test('art: painted tufts, scene and soil load for a field; no failed requests', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 6);
  const st = await page.evaluate(() => window.__game.stats());
  expect(st.atlas.source).toBe('png');
  const art = await page.evaluate(() => {
    const a = window.__game._game.art;
    return { scene: !!a.scene && a.scene.src, soil: !!a.soil, flowers: a.flowers.filter(Boolean).length };
  });
  expect(art.scene).toMatch(/afternoon-(16x9|9x16)\.jpg$/);
  expect(art.soil).toBe(true);
  expect(art.flowers).toBe(3);
  // Fonts are bundled and used.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 20px Fraunces'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px Nunito'))).toBe(true);
  expect(errors).toEqual([]);
});

test('audio: unlocks on the first press; the rustle follows a real stroke and fades after', async ({ page, browserName }) => {
  const errors = watchErrors(page);
  await openField(page, 1);
  expect((await page.evaluate(() => window.__game.audioState())).context).toBe('none');
  const a = await page.evaluate(() => window.__game.cellToPage(3, 1));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.__game.audioState().context)).toBe('running');
  // Keep moving until the rustle is audible (its loop decodes on unlock).
  let st = null;
  for (let k = 0; k < 60; k++) {
    await page.mouse.move(a.x + (k % 20) * 25, a.y + Math.floor(k / 20) * 40, { steps: 2 });
    await page.waitForTimeout(30);
    st = await page.evaluate(() => window.__game.audioState());
    if (st.rustle > 0.05 && k > 10) break;
  }
  expect(st.rustle).toBeGreaterThan(0.05);
  expect(st.rustleRate).toBeGreaterThanOrEqual(0.8);
  expect(st.rustleRate).toBeLessThanOrEqual(1.2);
  expect(st.music).toBe('morning');
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.audioState().rustle), { timeout: 5000 }).toBeLessThan(0.01);
  expect(errors, browserName).toEqual([]);
});

test('audio: M and the speaker button mute, and mute persists across a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 1);
  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => window.__game.audioState().muted)).toBe(true);
  await expect(page.getByTestId('btn-mute')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('btn-mute').click();
  await expect.poll(() => page.evaluate(() => window.__game.audioState().muted)).toBe(false);
  await page.getByTestId('btn-mute').click();
  await expect.poll(() => page.evaluate(() => window.__game.audioState().muted)).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__game?.audioState().muted)).toBe(true);
  await expect(page.getByTestId('btn-mute')).toHaveAttribute('aria-pressed', 'true');
  // A saved setting alone doesn't turn Start into Continue.
  await page.goto('/');
  await expect(page.getByTestId('btn-start')).toBeVisible();
  expect(errors).toEqual([]);
});

test('hud: the meter flower opens a petal at each quarter; paused ducks the music', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 2);
  const flower = page.getByTestId('hud-flower');
  await expect(flower).toHaveAttribute('data-open', '0');
  await page.evaluate(() => window.__game.setMeter(0.3));
  await expect(flower).toHaveAttribute('data-open', '1');
  await page.evaluate(() => window.__game.setMeter(0.8));
  await expect(flower).toHaveAttribute('data-open', '3');
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('paused');
  expect((await page.evaluate(() => window.__game.audioState())).ducked).toBe(true);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__game.audioState().ducked)).toBe(false);
  expect(errors).toEqual([]);
});
