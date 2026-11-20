// e2e/sweep.spec.mjs -- milestone 1: sweeping with real pointer input, and
// winning a field.
//
// - A real mouse drag (both projects) sweeps every cell along its path.
// - A real touch drag: Chromium with touch emulation, driven through CDP
//   Input.dispatchTouchEvent (real browser touch events, so touch-action and
//   pointercancel behave as on a phone). Playwright's WebKit can only tap,
//   not drag, by touch, so the iPhone 12 (WebKit) project checks a real touch
//   tap (press sweeps at once with the touch brush) and a real mouse drag.
// - A field can be won (solver at a raised timeScale), the complete card's
//   Next field button (real click) opens the next field.

import { test, expect, devices } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

async function openField(page, n) {
  await page.goto(`/?dev=1&level=${n}`);
  await expect.poll(() => page.evaluate(() => window.__game?.info().screen)).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.__game.info().field)).toBe(n);
  // Let the first frames render.
  await page.waitForTimeout(150);
}

// Cells whose centres lie within the brush radius of the straight path
// from cell A's centre to cell B's centre.
async function cellsAlongPath(page, a, b, pointerType) {
  return page.evaluate(({ a, b, pointerType }) => {
    const g = window.__game;
    const L = g.layout;
    const R = g.world.brushRadiusPx(pointerType) / L.cell;
    const x0 = a[1] + 0.5, y0 = a[0] + 0.5, x1 = b[1] + 0.5, y1 = b[0] + 0.5;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    const out = [];
    const grid = g.grid;
    for (let r = 0; r < grid.H; r++) {
      for (let c = 0; c < grid.W; c++) {
        const i = r * grid.W + c;
        if (!grid.valid[i]) continue;
        const cx = c + 0.5, cy = r + 0.5;
        let u = ((cx - x0) * dx + (cy - y0) * dy) / L2;
        u = Math.max(0, Math.min(1, u));
        const ex = x0 + u * dx - cx, ey = y0 + u * dy - cy;
        // Strictly inside (a 3% margin keeps rounding of pointer samples out).
        if (ex * ex + ey * ey < (R * 0.97) ** 2) out.push(i);
      }
    }
    return out;
  }, { a, b, pointerType });
}

// Wait until the game has consumed every queued pointer event (WebKit's
// headless frames can be slow, so a fixed wait isn't enough).
async function settle(page) {
  await expect.poll(() => page.evaluate(() => window.__game.input.queued)).toBe(0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function sweptState(page, cells) {
  return page.evaluate((cells) => {
    const g = window.__game.grid;
    return cells.map((i) => ({ i, touched: g.touched[i], h: g.h[i], gold: g.gold[i] }));
  }, cells);
}

test('sweep: a real mouse drag sweeps every cell along its whole path', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 15);
  const a = [6, 3], b = [30, 32];
  const pa = await page.evaluate(([r, c]) => window.__game.cellToPage(r, c), a);
  const pb = await page.evaluate(([r, c]) => window.__game.cellToPage(r, c), b);
  const before = await page.evaluate(() => window.__game.info());
  expect(before.touched).toBe(0);

  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  // A brisk drag in few, large steps: the capsule stamping must not skip cells.
  await page.mouse.move(pb.x, pb.y, { steps: 6 });
  await page.mouse.up();
  await settle(page);

  const cells = await cellsAlongPath(page, a, b, 'mouse');
  expect(cells.length).toBeGreaterThan(40);
  const st = await sweptState(page, cells);
  const missed = st.filter((s) => !s.touched);
  expect(missed, `cells missed along the path: ${JSON.stringify(missed.slice(0, 5))}`).toEqual([]);
  // Standing grass along the path was flattened (or loosened, if stiff) and turned gold.
  const flat = st.filter((s) => s.h < 0.4);
  expect(flat.length).toBeGreaterThan(cells.length * 0.7);
  const info = await page.evaluate(() => window.__game.info());
  expect(info.energy).toBeGreaterThan(0);
  expect(info.strokeId).toBe(1);
  const stats = await page.evaluate(() => window.__game.input);
  expect(stats.cancel).toBe(0);
  expect(errors).toEqual([]);
});

test('sweep: a real touch drag (Chromium touch emulation) sweeps the whole path, no pointercancel', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'touch drags need CDP (Chromium); WebKit is covered by the tap test');
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const errors = watchErrors(page);
  try {
    await openField(page, 15);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const a = [4, 8], b = [31, 26];
    const pa = await page.evaluate(([r, c]) => window.__game.cellToPage(r, c), a);
    const pb = await page.evaluate(([r, c]) => window.__game.cellToPage(r, c), b);
    const cdp = await context.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: pa.x, y: pa.y, id: 1 }]);
    const N = 14;
    for (let k = 1; k <= N; k++) {
      const x = pa.x + (pb.x - pa.x) * k / N, y = pa.y + (pb.y - pa.y) * k / N;
      await touch('touchMove', [{ x, y, id: 1 }]);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', []);
    await settle(page);

    const cells = await cellsAlongPath(page, a, b, 'touch');
    expect(cells.length).toBeGreaterThan(40);
    const st = await sweptState(page, cells);
    const missed = st.filter((s) => !s.touched);
    expect(missed, `cells missed: ${JSON.stringify(missed.slice(0, 5))}`).toEqual([]);
    const stats = await page.evaluate(() => window.__game.input);
    expect(stats.cancel, 'no pointercancel fired (touch-action: none works)').toBe(0);
    expect(stats.down).toBe(1);
    // The page never scrolled or zoomed.
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('sweep: a real touch tap sweeps at once with the touch brush (WebKit on iPhone 12, Chromium)', async ({ browser, browserName }) => {
  const dev = browserName === 'webkit' ? devices['iPhone 12'] : devices['Pixel 7'];
  const context = await browser.newContext({ ...dev });
  const page = await context.newPage();
  const errors = watchErrors(page);
  try {
    await openField(page, 15);
    const p = await page.evaluate(() => window.__game.cellToPage(18, 18));
    await page.touchscreen.tap(p.x, p.y);
    await settle(page);
    const info = await page.evaluate(() => window.__game.info());
    expect(info.strokeId).toBe(1);
    // A touch brush on field 15 at phone size is 18 px: about 1.8 cells, so
    // a single press touches a small disc of cells (more than a mouse would).
    const cells = await page.evaluate(() => {
      const g = window.__game;
      return { touched: g.grid.touchedCount, r: g.world.brushRadiusPx('touch'), cell: g.layout.cell };
    });
    expect(cells.r).toBeGreaterThanOrEqual(18);
    expect(cells.touched).toBeGreaterThanOrEqual(5);
    const stats = await page.evaluate(() => window.__game.input);
    expect(stats.cancel).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('field: can be won; the complete card leads to the next field', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 1);
  await page.evaluate(() => { window.__game.timeScale = 8; });
  const summary = await page.evaluate(() => window.__game.solve('fast'));
  expect(summary.won).toBe(true);
  expect(summary.wonAt).toBeGreaterThan(10);
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('level-won');
  await page.evaluate(() => { window.__game.timeScale = 1; });
  const next = page.getByTestId('btn-next-field');
  await expect(next).toBeVisible();
  await expect(page.getByTestId('card-complete')).toContainText('The Back Lawn');
  // A person's click: press, hold ~120 ms, release.
  const box = await next.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.info().field)).toBe(2);
  expect(await page.evaluate(() => window.__game.state)).toBe('playing');
  // The solver touched every cell, so field 2 starts with the head start.
  expect(summary.headStartEarned).toBe(true);
  const f2 = await page.evaluate(() => window.__game.info());
  expect(f2.headStart).toBe(true);
  expect(f2.meter).toBeCloseTo(0.15, 3);
  expect(errors).toEqual([]);
});

test('title: Start goes into field 1; Esc pauses; Resume and Restart work', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByTestId('btn-start').click();
  await expect.poll(() => page.evaluate(() => window.__game.info().field)).toBe(1);
  await expect(page.getByTestId('hud-field-name')).toHaveText('1. The Back Lawn');
  // Sweep a little, then pause with Escape.
  const p = await page.evaluate(() => window.__game.cellToPage(5, 1));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 300, p.y, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('paused');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  // Paused: the sim doesn't advance.
  const t0 = await page.evaluate(() => window.__game.info().time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.info().time)).toBe(t0);
  await page.getByTestId('btn-resume').click();
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('playing');
  expect((await page.evaluate(() => window.__game.info())).touched).toBeGreaterThan(0);
  // Pause button, then Restart field.
  await page.getByTestId('btn-pause').click();
  await expect(page.getByTestId('card-pause')).toBeVisible();
  await page.getByTestId('btn-restart').click();
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('playing');
  const after = await page.evaluate(() => window.__game.info());
  expect(after.field).toBe(1);
  expect(after.touched).toBe(0);
  expect(errors).toEqual([]);
});

test('field 15: Finish leads to the done card, and back to the title', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 15);
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('level-won');
  const finish = page.getByTestId('btn-next-field');
  await expect(finish).toHaveText('Finish');
  await finish.click();
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('ending');
  await expect(page.getByTestId('card-done')).toContainText('You touched all the grass.');
  await page.getByTestId('btn-ending-title').click();
  await expect.poll(() => page.evaluate(() => window.__game.state)).toBe('title');
  await expect(page.getByRole('heading', { name: /touch grass/i })).toBeVisible();
  expect(errors).toEqual([]);
});
