// e2e/polish-review.spec.mjs -- the polish review's fixes, with real input:
// How to play says each lesson generally and shows the move icons (with small
// pictures on a phone held sideways), times read m:ss, Pause works while a
// hint card is up, an armed move doesn't time out while the mouse aims and
// says so when it does, and the share card has a Copy button.
//
// page.evaluate is only for setup (a save, the meter) and for reading state.

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

async function pressAt(page, x, y, hold = 120) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up();
}

async function press(page, testid, hold = 120) {
  const loc = page.getByTestId(testid).first();
  await expect(loc).toBeVisible();
  // A cross-fading screen's copy of the button may be found, then removed:
  // wait for one that stays on the page.
  let b = null;
  await expect.poll(async () => { b = await loc.boundingBox(); return !!b; }).toBe(true);
  await pressAt(page, b.x + b.width / 2, b.y + b.height / 2, hold);
}

const state = (page) => page.evaluate(() => window.__game?.state);
const ALL_HINTS = ['sweep', 'regrow', 'short-ladybug', 'tall', 'flowered', 'ant-ring', 'snail', 'butterfly', 'stiff-line',
  'bee', 'hedge-clear', 'wasp', 'stripes', 'caterpillar', 'finale'];

async function seedHints(page, ids) {
  await page.goto('/');
  await page.evaluate((list) => {
    localStorage.setItem('touchgrass.v1', JSON.stringify({ version: 1, settings: {}, progress: { unlocked: 15, fields: {} },
      allTimeBest: 0, headStart: null, hints: Object.fromEntries(list.map((i) => [i, true])) }));
  }, ids);
}

test('how to play: general lines (never the field\'s card words), the move icons, and small pictures on a short screen', async ({ page }) => {
  // Two screen sizes, every page of the card at each: a long walk.
  test.setTimeout(60000);
  const errors = watchErrors(page);
  await seedHints(page, ALL_HINTS);
  await openField(page, 15);
  const fieldOnly = ['stripe in the middle', 'Two ladybugs live here', 'Every kind of grass grows here',
    'sit in the corner', 'The last field', 'Sweep both fields'];
  for (const size of [null, { width: 844, height: 390 }]) {
    if (size) { await page.setViewportSize(size); await page.waitForTimeout(300); }
    await page.keyboard.press('p');
    await expect(page.getByTestId('card-pause')).toBeVisible();
    await press(page, 'btn-howto');
    await expect(page.getByTestId('card-howto')).toBeVisible();
    const pager = page.getByTestId('howto-page');
    const pages = (await pager.isVisible()) ? Number((await pager.textContent()).split(' of ')[1]) : 1;
    if (size) expect(pages).toBeLessThanOrEqual(4);
    const items = {};
    for (let k = 1; k <= pages; k++) {
      const rows = await page.locator('.howto-item').evaluateAll((lis) => lis.map((li) => {
        const art = li.querySelector('.hint-art');
        const r = art.getBoundingClientRect();
        return { id: li.dataset.hint, text: li.textContent, moves: [...li.querySelectorAll('.ha-move')].map((m) => m.getAttribute('src')),
          artH: r.height, artW: r.width, artShown: getComputedStyle(art).display !== 'none' };
      }));
      for (const r of rows) items[r.id] = r;
      // A page of one is one column (no half-empty card).
      if (rows.length === 1) {
        const cols = await page.getByTestId('howto-list').evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(' ').length);
        expect(cols).toBe(1);
      }
      if (k < pages) await press(page, 'btn-howto-next');
    }
    expect(Object.keys(items).sort()).toEqual([...ALL_HINTS].sort());
    for (const r of Object.values(items)) {
      for (const t of fieldOnly) expect(r.text, r.id).not.toContain(t);
      expect(r.artShown, `${r.id} has a picture`).toBe(true);
      if (size) expect(r.artH, `${r.id} picture is small`).toBeLessThanOrEqual(64);
    }
    expect(items['ant-ring'].moves).toEqual(['assets/ui/ring.png']);
    expect(items['stiff-line'].moves).toEqual(['assets/ui/line.png']);
    expect(items['hedge-clear'].moves).toEqual(['assets/ui/clear.png']);
    // Back and the pager stay on screen.
    for (const id of ['btn-howto-back', 'btn-howto-next']) {
      const b = await page.getByTestId(id).boundingBox();
      const vp = page.viewportSize();
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    }
    await press(page, 'btn-howto-back');
    await expect(page.getByTestId('card-pause')).toBeVisible();
    await page.keyboard.press('p');
    await expect.poll(() => state(page)).toBe('playing');
  }
  expect(errors).toEqual([]);
});

test('field complete: the time and par read m:ss', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 2, '&hints=0&bugs=0');
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await expect(page.getByTestId('complete-time')).toHaveText(/^\d+:\d\d \(par \d+:\d\d\)$/);
  expect(errors).toEqual([]);
});

test('pause during a hint card: the Pause button opens the pause card at once; so do Esc and P', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openField(page, 6);
  await expect.poll(() => state(page)).toBe('hint');
  await press(page, 'btn-pause');
  await expect.poll(() => state(page)).toBe('paused');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  // The hint counts as seen; Resume plays the field.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('touchgrass.v1')).hints['ant-ring'])).toBe(true);
  await press(page, 'btn-resume');
  await expect.poll(() => state(page)).toBe('playing');
  // Keys: Esc and P on a hint card pause too.
  for (const [n, key] of [[7, 'Escape'], [8, 'p']]) {
    await openField(page, n);
    await expect.poll(() => state(page)).toBe('hint');
    await page.keyboard.press(key);
    await expect.poll(() => state(page)).toBe('paused');
    await expect(page.getByTestId('card-pause')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('arming: the Ring stays armed while the mouse aims over the field, and says so when it times out', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover aiming is a mouse thing');
  const errors = watchErrors(page);
  await openField(page, 6, '&hints=0&bugs=0');
  await page.evaluate(() => window.__game.setMeter(0.8));
  const c = await page.evaluate(() => window.__game.cellToPage(8, 8));
  // Armed with key 1, then the pointer hovers over the field for over 5 s.
  await page.mouse.move(c.x, c.y);
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('ring');
  for (let k = 0; k < 13; k++) {
    await page.mouse.move(c.x + (k % 2 ? 20 : -20), c.y + 6 * (k % 3), { steps: 3 });
    await page.waitForTimeout(500);
  }
  expect(await page.evaluate(() => window.__game.armed)).toBe('ring');
  // The press fires the Ring (not a sweep).
  await page.mouse.down();
  await page.mouse.move(c.x + 10, c.y + 10, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.moves().fired.ring)).toBe(1);
  // Away from the field (over the HUD), it times out after 5 s, with a toast.
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('ring');
  const hud = await page.getByTestId('hud-field-name').boundingBox();
  await page.mouse.move(hud.x + 10, hud.y + hud.height / 2, { steps: 4 });
  await expect.poll(() => page.evaluate(() => window.__game.armed), { timeout: 9000 }).toBe(null);
  await expect(page.getByTestId('hud-toast')).toHaveText('Ring put away');
  await expect(page.getByTestId('hud-toast')).toHaveClass(/show/);
  expect(errors).toEqual([]);
});

test('share card: a Copy button copies the challenge link, with a toast', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'the desktop share card');
  const errors = watchErrors(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // No Web Share and no clipboard fallback in the share flow itself: the download card.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true, writable: true });
    window.__shareCopies = [];
    const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
    // The share flow's own automatic copy is refused (so the card shows); the
    // Copy button's, from a click, goes through.
    let first = true;
    navigator.clipboard.writeText = (t) => {
      if (first) { first = false; return Promise.reject(new Error('denied')); }
      window.__shareCopies.push(t);
      return orig(t);
    };
  });
  await page.goto('/?dev=1&level=1&hints=0&bugs=0');
  await expect.poll(() => state(page)).toBe('playing');
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await press(page, 'btn-complete-share');
  await expect(page.getByTestId('modal-share-name')).toBeVisible();
  await expect(page.getByTestId('modal-share-name').locator('.card-title')).toHaveText('Add your name?');
  await page.getByTestId('share-name').fill('Sam');
  await press(page, 'btn-share-name-ok');
  await expect(page.getByTestId('modal-share-download')).toBeVisible();
  const link = await page.getByTestId('share-link').inputValue();
  await press(page, 'btn-share-copy');
  await expect(page.getByTestId('toast')).toHaveText('Copied');
  expect(await page.evaluate(() => window.__shareCopies)).toEqual([link]);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  expect(errors).toEqual([]);
});
