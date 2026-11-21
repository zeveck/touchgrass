// e2e/bugs-moves.spec.mjs -- milestone 3 with real input: a hint card is
// dismissed without sweeping (and never shows again), a ladybug is petted
// with a real tap, an ant warns without biting when the finger moves away
// (its build-up fades, then it calms),
// and each move is armed and fired from the toolbar / keys with real presses.

import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

async function openField(page, n, params = '') {
  await page.goto(`/?dev=1&level=${n}${params}`);
  await expect.poll(() => page.evaluate(() => window.__game?.info().field)).toBe(n);
  await page.evaluate(() => window.__game.ready());
  await page.waitForTimeout(150);
}

// A person's press: down, hold ~120 ms, up.
async function press(page, x, y, hold = 120) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up();
}

async function pressButton(page, testid) {
  const box = await page.getByTestId(testid).boundingBox();
  await press(page, box.x + box.width / 2, box.y + box.height / 2);
}

async function settle(page) {
  await expect.poll(() => page.evaluate(() => window.__game.input.queued)).toBe(0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('hint: the card shows when the field opens, a press dismisses it without sweeping, and it never shows again', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 6);
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('hint');
  const card = page.getByTestId('card-hint');
  await expect(card).toBeVisible();
  await expect(card).toContainText('grumpy ant');
  // Its foot names this device's action: a tap on a phone, a click (or Enter) with a mouse.
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await expect(card.locator('.card-foot')).toHaveText(coarse ? 'Tap anywhere to play' : 'Click anywhere or press Enter to play');
  // The field is paused under it.
  const t0 = await page.evaluate(() => window.__game.info().time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.info().time)).toBe(t0);
  // Press on the dimmed field beside the card (not on a button), and drag:
  // the press is swallowed; nothing is swept.
  const p = await page.evaluate(() => window.__game.cellToPage(2, 2));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 80, p.y + 10, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('playing');
  const info = await page.evaluate(() => window.__game.info());
  expect(info.strokeId).toBe(0);
  expect(info.touched).toBe(0);
  // How to play (pause card) lists it.
  await page.keyboard.press('p');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  await pressButton(page, 'btn-howto');
  await expect(page.getByTestId('howto-list')).toContainText('Grumpy bugs, and the Ring');
  await pressButton(page, 'btn-howto-back');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  // Seen once: not again on a reload.
  await openField(page, 6);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.state)).toBe('playing');
  expect(errors).toEqual([]);
});

test('how to play: with every hint seen it fits without scrolling, and pages with Previous / Next', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => {
    const ids = ['sweep', 'regrow', 'short-ladybug', 'tall', 'flowered', 'ant-ring', 'snail', 'butterfly', 'stiff-line',
      'bee', 'hedge-clear', 'wasp', 'stripes', 'caterpillar', 'finale'];
    localStorage.setItem('touchgrass.v1', JSON.stringify({ version: 1, settings: {}, progress: { unlocked: 15, fields: {} },
      allTimeBest: 0, headStart: null, hints: Object.fromEntries(ids.map((i) => [i, true])) }));
  });
  await openField(page, 15);
  // At the project's own size, then on a phone held sideways (the shortest card space).
  for (const size of [null, { width: 844, height: 390 }]) {
    if (size) { await page.setViewportSize(size); await page.waitForTimeout(300); }
    await page.keyboard.press('p');
    await expect(page.getByTestId('card-pause')).toBeVisible();
    await pressButton(page, 'btn-howto');
    const card = page.getByTestId('card-howto');
    await expect(card).toBeVisible();
    const seen = new Set();
    const fits = () => card.evaluate((c) => { const ul = c.querySelector('.howto-list'); return c.scrollHeight <= c.clientHeight + 1 && ul.scrollHeight <= ul.clientHeight + 1; });
    expect(await fits()).toBe(true);
    const label = await page.getByTestId('howto-page').textContent();
    const pages = (await page.getByTestId('howto-page').isVisible()) ? Number(label.split(' of ')[1]) : 1;
    for (let k = 1; k <= pages; k++) {
      if (pages > 1) await expect(page.getByTestId('howto-page')).toHaveText(`${k} of ${pages}`);
      expect(await fits()).toBe(true);
      for (const t of await page.locator('.howto-text strong').allTextContents()) seen.add(t);
      if (k < pages) await pressButton(page, 'btn-howto-next');
    }
    // Every hint was on some page.
    expect(seen.size).toBe(15);
    if (pages > 1) {
      await expect(page.getByTestId('btn-howto-next')).toBeDisabled();
      await pressButton(page, 'btn-howto-prev');
      await expect(page.getByTestId('howto-page')).toHaveText(`${pages - 1} of ${pages}`);
    }
    await pressButton(page, 'btn-howto-back');
    await expect(page.getByTestId('card-pause')).toBeVisible();
    await page.keyboard.press('p');
    await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('playing');
  }
  expect(errors).toEqual([]);
});

test('pet: a real tap on a ladybug pets it (+2% once), saves it to the Bug Garden and shows New friend', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await openField(page, 3, '&hints=0');
  const bugs = await page.evaluate(() => window.__game.bugs());
  const lb = bugs.find((b) => b.sp === 'ladybug');
  expect(lb).toBeTruthy();
  // Setup: keep it still so the tap lands on it.
  await page.evaluate((id) => window.__game.holdBug(id), lb.id);
  const at = (await page.evaluate(() => window.__game.bugs())).find((b) => b.id === lb.id).page;
  if (isMobile) await page.touchscreen.tap(at.x, at.y);
  else await press(page, at.x, at.y, 100);
  await expect.poll(() => page.evaluate(() => window.__game.info().petted)).toBe(1);
  const info = await page.evaluate(() => window.__game.info());
  expect(info.meter).toBeCloseTo(0.02, 4);
  expect(info.petScore).toBe(25);
  expect(info.strokeId).toBe(0);          // a pet is not a sweep
  await expect(page.getByTestId('ribbon')).toHaveClass(/show/);
  await expect(page.getByTestId('ribbon')).toContainText('Ladybug');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('touchgrass.v1')));
  expect(save.garden.ladybug.fields).toEqual([3]);
  // A second tap: it hops again, but no more energy.
  if (isMobile) await page.touchscreen.tap(at.x, at.y);
  else await press(page, at.x, at.y, 100);
  await expect.poll(() => page.evaluate(() => window.__game.bugs().find((b) => b.sp === 'ladybug').pets)).toBe(2);
  expect((await page.evaluate(() => window.__game.info())).meter).toBeCloseTo(0.02, 4);
  expect(errors).toEqual([]);
});

test('ant: sweeping close warns it (red ring); moving away calms it with no bite', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 6, '&hints=0');
  await page.evaluate(() => {
    const g = window.__game;
    g.clearBugs();
    const id = g.spawn('ant', 10, 5);
    g.holdBug(id, 60);
    g.setMeter(0.5);
  });
  const ant = (await page.evaluate(() => window.__game.bugs()))[0];
  const c = ant.page;
  // Sweep small circles right beside it for ~0.8 s.
  await page.mouse.move(c.x + 25, c.y);
  await page.mouse.down();
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < 800) {
    k++;
    await page.mouse.move(c.x + 25 * Math.cos(k * 0.5), c.y + 25 * Math.sin(k * 0.5));
    await page.waitForTimeout(16);
  }
  await expect.poll(() => page.evaluate(() => window.__game.bugs()[0].state)).toBe('angry');
  const meterAtWarning = await page.evaluate(() => window.__game.info().meter);
  // Keep sweeping, moving well away (out along the field). The build-up
  // fades (it doesn't reset at once): the warning's arc winds back down until
  // the ant calms.
  const far = await page.evaluate(() => window.__game.cellToPage(18, 3));
  await page.mouse.move(far.x, far.y, { steps: 6 });
  const levels = [];
  const t1 = Date.now();
  while (Date.now() - t1 < 9000) {
    k++;
    await page.mouse.move(far.x + 40 * Math.cos(k * 0.3), far.y + 10 * Math.sin(k * 0.3));
    await page.waitForTimeout(16);
    const b = await page.evaluate(() => window.__game.bugs()[0]);
    if (b.state !== 'angry') break;
    levels.push(b.angerT);
  }
  await page.mouse.up();
  expect(levels.length).toBeGreaterThan(3);
  for (let j = 1; j < levels.length; j++) expect(levels[j]).toBeLessThanOrEqual(levels[j - 1] + 1e-9);
  await settle(page);
  const after = await page.evaluate(() => ({ b: window.__game.bugs()[0], i: window.__game.info() }));
  expect(after.b.state).not.toBe('angry');
  expect(after.i.bites).toBe(0);
  expect(after.i.meter).toBeGreaterThanOrEqual(meterAtWarning);
  expect(errors).toEqual([]);
});

test('moves: Ring, Line and Full Clear arm from the toolbar or keys and fire with real input; the meter never rises', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await openField(page, 11, '&hints=0&bugs=0');
  await page.evaluate(() => window.__game.setMeter(0.8));
  await expect(page.getByTestId('btn-move-ring')).toBeVisible();
  await expect(page.getByTestId('btn-move-line')).toBeVisible();
  await expect(page.getByTestId('btn-move-clear')).toBeVisible();
  const meter = () => page.evaluate(() => window.__game.info().meter);
  const fired = () => page.evaluate(() => window.__game.moves().fired);

  // Ring: the button arms it; press, drag to aim, release to fire.
  await pressButton(page, 'btn-move-ring');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('ring');
  await expect(page.getByTestId('btn-move-ring')).toHaveClass(/armed/);
  let m0 = await meter();
  const a = await page.evaluate(() => window.__game.cellToPage(5, 5));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(fired).toEqual({ ring: 1, line: 0, clear: 0 });
  expect(await page.evaluate(() => window.__game.armed)).toBe(null);
  expect(await meter()).toBeLessThanOrEqual(m0 + 1e-9);

  // Line: drag across the field (released past its edge).
  if (isMobile) await pressButton(page, 'btn-move-line'); else await page.keyboard.press('2');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('line');
  m0 = await meter();
  const l0 = await page.evaluate(() => window.__game.cellToPage(10, 1));
  const l1 = await page.evaluate(() => window.__game.cellToPage(10, 30));
  await page.mouse.move(l0.x, l0.y);
  await page.mouse.down();
  await page.mouse.move(l1.x + 60, l1.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(fired).toEqual({ ring: 1, line: 1, clear: 0 });
  expect(await meter()).toBeLessThanOrEqual(m0 + 1e-9);
  expect(await page.evaluate(() => window.__game.grid.h[10 * 31 + 29])).toBe(0);

  // Esc (or the button again) cancels an armed move: nothing fires.
  await pressButton(page, 'btn-move-ring');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('ring');
  if (isMobile) await pressButton(page, 'btn-move-ring'); else await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe(null);
  expect(await page.evaluate(() => window.__game.state)).toBe('playing');

  // Full Clear: tap the field; every blade is touched.
  await pressButton(page, 'btn-move-clear');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('clear');
  m0 = await meter();
  const f = await page.evaluate(() => window.__game.cellToPage(20, 8));
  await press(page, f.x, f.y, 90);
  await expect.poll(fired).toEqual({ ring: 1, line: 1, clear: 1 });
  expect(await meter()).toBeLessThanOrEqual(m0 + 1e-9);
  expect((await page.evaluate(() => window.__game.info())).whole).toBe(1);

  // Disabled when the meter is below the price: a press doesn't arm it, and
  // plays the soft low click.
  await page.evaluate(() => window.__game.setMeter(0));
  await expect(page.getByTestId('btn-move-ring')).toHaveClass(/disabled/);
  await pressButton(page, 'btn-move-ring');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__game.armed)).toBe(null);
  expect((await page.evaluate(() => window.__game.audioState().played)).at(-1)).toBe('click@0.70');
  expect(errors).toEqual([]);
});
