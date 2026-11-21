// e2e/screens.spec.mjs -- milestone 4 (the whole game) with real input:
// title -> Play -> field, the map, the Bug Garden, settings that survive a
// reload, clear data, the share fallback chain, challenge links (and guest
// play), the ending, the bug report form, and offline play.
//
// Buttons are pressed the way a person does (press, hold ~120 ms, release),
// or with the keyboard (Tab / Enter). page.evaluate is only for setting up a
// save, reading state and the dev level jump.

import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

async function press(page, testid, hold = 120) {
  const loc = page.getByTestId(testid).first();
  await expect(loc).toBeVisible();
  // During a screen cross-fade the outgoing screen's copy of a button can be
  // the one found and then removed: wait for one that stays on the page.
  let b = null;
  await expect.poll(async () => { b = await loc.boundingBox(); return !!b; }).toBe(true);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up();
}

const state = (page) => page.evaluate(() => window.__game?.state);
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('touchgrass.v1') || 'null'));

// A save with fields 1..n-1 finished (n unlocked), set before the page loads.
async function seed(page, data) {
  await page.addInitScript((d) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('touchgrass.v1', JSON.stringify(d));
      sessionStorage.setItem('seeded', '1');
    }
  }, data);
}
function progressTo(n, extra = {}) {
  const fields = {};
  for (let k = 1; k < n; k++) fields[k] = { best: 100 * k + 250, cleared: k % 2 === 1 };
  return { version: 1, settings: {}, progress: { unlocked: n, fields }, allTimeBest: 100 * (n - 1) + 250, headStart: null, ...extra };
}

async function title(page, url = '/') {
  await page.goto(url);
  await expect(page.getByTestId('screen-title')).toBeVisible();
  await expect(page.locator('#loading')).toHaveCount(0);
}

// A challenge link opens straight onto its overlay.
async function challenge(page, url) {
  await page.goto(url);
  await expect(page.getByTestId('screen-challenge')).toBeVisible();
  await expect(page.locator('#loading')).toHaveCount(0);
}

// The report form is closed and its backdrop has gone (it fades for 160 ms,
// catching presses meanwhile).
async function formGone(page) {
  await expect.poll(() => page.locator('#report').evaluate((f) => !f.isOpen && f.shadowRoot.querySelector('.backdrop').style.display === 'none')).toBe(true);
}

test('title: painted, Play goes to field 1 the first time; Tab + Enter work', async ({ page }) => {
  const errors = watchErrors(page);
  await title(page);
  await expect(page.getByRole('heading', { name: 'Touch Grass' })).toBeVisible();
  await expect(page.getByTestId('title-best')).toHaveCount(0);
  await expect(page.getByTestId('btn-start')).toContainText('Field 1: The Back Lawn');
  for (const id of ['btn-map', 'btn-farm', 'btn-settings', 'btn-title-mute']) await expect(page.getByTestId(id)).toBeVisible();
  // Keyboard: Tab reaches Play, Enter presses it.
  await page.keyboard.press('Tab');
  for (let k = 0; k < 8 && !(await page.evaluate(() => document.activeElement?.dataset.testid === 'btn-start')); k++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page)).not.toBe('title');
  expect(await page.evaluate(() => window.__game.info().field)).toBe(1);
  expect(errors).toEqual([]);
});

test('title: with progress, Play goes to the next unfinished field, and shows the best', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, progressTo(4));
  await title(page);
  await expect(page.getByTestId('title-best')).toHaveText('Best field: 550');
  await expect(page.getByTestId('btn-continue')).toContainText('Field 4: Long Meadow');
  await press(page, 'btn-continue');
  await expect.poll(() => page.evaluate(() => window.__game.info().field)).toBe(4);
  expect(errors).toEqual([]);
});

test('title: once every field is done, it shows the total (the ending\'s number), not one field\'s best', async ({ page }) => {
  const errors = watchErrors(page);
  const save = progressTo(16);
  save.progress.unlocked = 15;
  await seed(page, save);
  await title(page);
  // Fields 1-15 at 100k + 250: 12,000 + 3,750.
  await expect(page.getByTestId('title-best')).toHaveText('Total score: 15,750');
  await expect(page.getByTestId('btn-continue')).toContainText('Every field is in bloom');
  expect(errors).toEqual([]);
});

test('map: finished patches bloom with their best, the next glows, locked ones say so; tap plays', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, progressTo(3));
  await title(page);
  await press(page, 'btn-map');
  await expect.poll(() => state(page)).toBe('map');
  await expect(page.getByTestId('map-token-1')).toHaveClass(/done/);
  await expect(page.getByTestId('map-best-1')).toHaveText('350');
  await expect(page.getByTestId('map-token-1').locator('.token-leaf')).toHaveCount(1);
  await expect(page.getByTestId('map-token-2').locator('.token-leaf')).toHaveCount(0);
  await expect(page.getByTestId('map-token-3')).toHaveClass(/open/);
  await expect(page.getByTestId('map-token-4')).toHaveClass(/locked/);
  // Every patch is on screen, at least 56 px, and nothing scrolls.
  const vp = page.viewportSize();
  for (let n = 1; n <= 15; n++) {
    const b = await page.getByTestId(`map-token-${n}`).boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(56);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  }
  expect(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight)).toBe(true);
  // A locked patch only says so.
  await press(page, 'map-token-4');
  await expect(page.getByTestId('toast')).toHaveText('Field 4 opens once field 3 is done');
  expect(await state(page)).toBe('map');
  // A finished one plays.
  await press(page, 'map-token-2');
  await expect.poll(() => page.evaluate(() => window.__game.info().field)).toBe(2);
  await expect.poll(() => state(page)).toMatch(/playing|hint/);
  expect(errors).toEqual([]);
});

test('garden: opens from the title and the map, friend cards, unmet silhouettes, back returns', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, progressTo(6, { garden: { ladybug: { firstMet: '2026-11-18T10:00:00Z', fields: [3, 4, 5, 6, 7] } } }));
  await title(page);
  await press(page, 'btn-farm');
  await expect.poll(() => state(page)).toBe('garden');
  await expect(page.getByTestId('garden-count')).toHaveText('1 of 4 friends met');
  await expect(page.getByTestId('garden-friend-ladybug')).toHaveClass(/met/);
  await expect(page.getByTestId('garden-friend-snail')).toHaveClass(/unmet/);
  await expect(page.getByTestId('garden-friend-snail')).toHaveAttribute('aria-label', 'Snail: not met yet');
  await expect(page.getByTestId('garden-unmet-tag')).toHaveText('Not met yet');
  await press(page, 'garden-friend-ladybug');
  const card = page.getByTestId('modal-friend');
  await expect(card).toContainText('Ladybug');
  await expect(card).toContainText('Counts its spots when it\'s nervous.');
  await expect(card).toContainText('5 fields');
  await expect(page.getByTestId('friend-hearts')).toHaveAttribute('data-hearts', '2');
  await press(page, 'btn-friend-close');
  await expect(card).toHaveCount(0);
  await press(page, 'garden-friend-snail');
  await expect(page.getByTestId('modal-friend')).toContainText('Not met yet');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('modal-friend')).toHaveCount(0);
  await press(page, 'btn-garden-back');
  await expect.poll(() => state(page)).toBe('title');
  // From the map, back goes to the map.
  await press(page, 'btn-map');
  await expect.poll(() => state(page)).toBe('map');
  await press(page, 'btn-map-garden');
  await expect.poll(() => state(page)).toBe('garden');
  await press(page, 'btn-garden-back');
  await expect.poll(() => state(page)).toBe('map');
  expect(errors).toEqual([]);
});

test('settings: every change is saved and comes back after a reload', async ({ page, browserName }) => {
  const errors = watchErrors(page);
  await title(page);
  await press(page, 'btn-settings');
  await expect.poll(() => state(page)).toBe('settings');
  await expect(page.getByTestId('set-credits')).toContainText('Touch Grass by Rich Conlan, finished with gamegen');
  await expect(page.getByTestId('set-credits')).toContainText('Fraunces and Nunito');
  // Music to 100% and sound to 40% with the keyboard on the sliders.
  await page.getByTestId('set-music').focus();
  await page.keyboard.press('End');
  await page.getByTestId('set-sound').focus();
  for (let k = 0; k < 8; k++) await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('set-sound')).toHaveValue('40');
  await press(page, 'set-motion-on');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  const hover = page.getByTestId('set-hover');
  const hasHover = await hover.count();
  if (hasHover) await press(page, 'set-hover');
  await press(page, 'set-name');
  await page.keyboard.type('Robin the Gardener');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('set-name')).toHaveValue('Robin the Ga');
  // Typing in the name box doesn't mute (M) or leave the screen.
  expect((await page.evaluate(() => window.__game.audioState())).muted).toBe(false);
  await press(page, 'btn-settings-back');
  await expect.poll(() => state(page)).toBe('title');
  await page.reload();
  await expect(page.getByTestId('screen-title')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await press(page, 'btn-settings');
  await expect(page.getByTestId('set-music')).toHaveValue('100');
  await expect(page.getByTestId('set-sound')).toHaveValue('40');
  await expect(page.getByTestId('set-motion-on')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('set-name')).toHaveValue('Robin the Ga');
  if (hasHover) await expect(page.getByTestId('set-hover')).toHaveAttribute('aria-checked', 'true');
  const st = await save(page);
  expect(st.settings).toMatchObject({ music: 1, sound: 0.4, motion: 'on', name: 'Robin the Ga' });
  expect((await page.evaluate(() => window.__game.audioState())).volume).toEqual({ music: 1, sound: 0.4 });
  // Reduced motion back to Auto follows the system again.
  await press(page, 'set-motion-auto');
  await expect(page.locator('html')).not.toHaveClass(/reduce-motion/);
  void browserName;
  expect(errors).toEqual([]);
});

test('settings: opened from the pause card, back returns to the paused field', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?dev=1&level=2&hints=0&bugs=0');
  await expect.poll(() => state(page)).toBe('playing');
  await press(page, 'btn-pause');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  await press(page, 'btn-pause-settings');
  await expect.poll(() => state(page)).toBe('settings');
  await press(page, 'btn-settings-back');
  await expect.poll(() => state(page)).toBe('paused');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  await press(page, 'btn-pause-map');
  await expect.poll(() => state(page)).toBe('map');
  expect(errors).toEqual([]);
});

test('clear data: asks in the game first; Keep changes nothing; Clear empties the save', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, progressTo(5, { garden: { snail: { firstMet: '2026-11-18T10:00:00Z', fields: [7] } } }));
  await title(page);
  await expect(page.getByTestId('btn-continue')).toBeVisible();
  await press(page, 'btn-settings');
  await press(page, 'btn-clear-data');
  await expect(page.getByTestId('modal-confirm')).toContainText('Clear all data?');
  await press(page, 'btn-clear-cancel');
  await expect(page.getByTestId('modal-confirm')).toHaveCount(0);
  expect((await save(page)).progress.unlocked).toBe(5);
  await press(page, 'btn-clear-data');
  await press(page, 'btn-clear-confirm');
  await expect.poll(() => state(page)).toBe('title');
  await expect(page.getByTestId('btn-start')).toBeVisible();
  await expect(page.getByTestId('title-best')).toHaveCount(0);
  const s = await save(page);
  expect(s === null || (!s.progress && !s.garden) || (s.progress.unlocked === 1 && !s.garden)).toBe(true);
  expect(errors).toEqual([]);
});

// ---- share ---------------------------------------------------------------------

// Win field 1 (dev jump, meter set) and press Share, answering the name card.
async function winAndShare(page) {
  await page.goto('/?dev=1&level=1&hints=0&bugs=0');
  await expect.poll(() => state(page)).toBe('playing');
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await expect(page.getByTestId('complete-score')).toBeVisible();
  await press(page, 'btn-complete-share');
  await expect(page.getByTestId('modal-share-name')).toBeVisible();
  await page.getByTestId('share-name').fill('Sam');
  await press(page, 'btn-share-name-ok');
}

const stubShare = (mode) => {
  window.__shares = [];
  const abort = () => { const e = new Error('cancelled'); e.name = 'AbortError'; return e; };
  const def = (k, v) => Object.defineProperty(Navigator.prototype, k, { value: v, configurable: true, writable: true });
  const getter = (k, v) => Object.defineProperty(Navigator.prototype, k, { get: () => v, configurable: true });
  if (mode === 'file' || mode === 'abort') {
    def('canShare', (d) => !!(d && d.files));
    def('share', async (d) => { window.__shares.push({ files: d.files ? d.files.map((f) => [f.name, f.type, f.size]) : null, url: d.url, text: d.text }); if (mode === 'abort') throw abort(); });
  } else {
    def('share', undefined);
    def('canShare', undefined);
  }
  if (mode === 'clipboard') getter('clipboard', { writeText: async (t) => { window.__shares.push({ clip: t }); } });
  if (mode === 'download') getter('clipboard', undefined);
};

test('share: Web Share with the scorecard picture', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(stubShare, 'file');
  await winAndShare(page);
  await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1);
  const [s] = await page.evaluate(() => window.__shares);
  expect(s.files[0][0]).toBe('touch-grass-score.png');
  expect(s.files[0][1]).toBe('image/png');
  expect(s.files[0][2]).toBeGreaterThan(20000);
  expect(s.url).toMatch(/\?f=1&s=\d+&n=Sam$/);
  expect(s.text).toMatch(/^I scored [\d,]+ on The Back Lawn in Touch Grass/);
  await expect(page.getByTestId('modal-share-download')).toHaveCount(0);
  expect((await save(page)).settings.name).toBe('Sam');
  expect(errors).toEqual([]);
});

test('share: a cancelled share stops there (no copy, no download)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(stubShare, 'abort');
  await winAndShare(page);
  await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__shares.length)).toBe(1);
  await expect(page.getByTestId('modal-share-download')).toHaveCount(0);
  await expect(page.getByTestId('toast')).not.toHaveClass(/show/);
  // The name was asked once: a second share goes straight out.
  await press(page, 'btn-complete-share');
  await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(2);
  await expect(page.getByTestId('modal-share-name')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('share: no Web Share: the link is copied, with a toast', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(stubShare, 'clipboard');
  await winAndShare(page);
  await expect(page.getByTestId('toast')).toHaveText('Link copied');
  const [s] = await page.evaluate(() => window.__shares);
  expect(s.clip).toMatch(/^I scored .* http:\/\/localhost:\d+\/\?f=1&s=\d+&n=Sam$/);
  expect(errors).toEqual([]);
});

test('share: no Web Share and no clipboard: a download card with the picture and the link', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(stubShare, 'download');
  await winAndShare(page);
  const card = page.getByTestId('modal-share-download');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('share-link')).toHaveValue(/\?f=1&s=\d+&n=Sam$/);
  await expect(page.getByTestId('btn-share-download')).toHaveAttribute('download', 'touch-grass-score.png');
  const img = await card.locator('img').evaluate((i) => (i.complete ? [i.naturalWidth, i.naturalHeight] : null));
  expect(img).toEqual([1200, 630]);
  await press(page, 'btn-share-close');
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

// ---- challenge links ------------------------------------------------------------

test('challenge: a locked field is a guest challenge: checklist, play, compare, Try again and Map', async ({ page }) => {
  const errors = watchErrors(page);
  await challenge(page, '/?f=15&s=1240&n=Sam');
  await expect.poll(() => state(page)).toBe('challenge');
  await expect(page.getByTestId('challenge-line')).toHaveText('Sam scored 1,240 on Sunset Meadow. Beat them?');
  expect(await page.evaluate(() => location.search)).toBe('');
  await press(page, 'btn-challenge-play');
  await expect(page.getByTestId('card-checklist')).toBeVisible();
  await expect(page.getByTestId('checklist')).toContainText('Stiff grass needs two strokes.');
  await press(page, 'btn-checklist-ok');
  await expect.poll(() => state(page)).toBe('playing');
  expect(await page.evaluate(() => window.__game.info())).toMatchObject({ field: 15, guest: true, headStart: false });
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await expect(page.getByTestId('complete-compare')).toContainText('Sam');
  await expect(page.getByTestId('btn-try-again')).toBeVisible();
  await expect(page.getByTestId('btn-next-field')).toHaveCount(0);
  await expect(page.getByTestId('complete-best')).toHaveCount(0);
  // Nothing saved: no unlock, no best, no head start.
  const s = await save(page);
  expect(s === null || !s.progress || (s.progress.unlocked === 1 && Object.keys(s.progress.fields).length === 0)).toBe(true);
  expect(s === null || !s.headStart).toBe(true);
  await press(page, 'btn-try-again');
  await expect.poll(() => state(page)).toBe('playing');
  expect(await page.evaluate(() => window.__game.info())).toMatchObject({ field: 15, guest: true, touched: 0 });
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await press(page, 'btn-complete-map');
  await expect.poll(() => state(page)).toBe('map');
  await expect(page.getByTestId('map-token-15')).toHaveClass(/locked/);
  expect(errors).toEqual([]);
});

test('challenge: an unlocked field plays normally and saves; Not now and bad links', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, progressTo(3));
  await challenge(page, '/?f=2&s=50&n=Al');
  await expect(page.getByTestId('challenge-line')).toHaveText('Al scored 50 on Dew Patch. Beat them?');
  await press(page, 'btn-challenge-play');
  await expect.poll(() => state(page)).toMatch(/playing|hint/);
  expect(await page.evaluate(() => window.__game.info())).toMatchObject({ field: 2, guest: false });
  if (await state(page) === 'hint') await press(page, 'btn-hint-ok');
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await expect(page.getByTestId('complete-compare')).toContainText('You beat Al');
  await expect(page.getByTestId('btn-next-field')).toBeVisible();
  expect((await save(page)).progress.fields['2'].best).toBeGreaterThan(200);
  // Bad links are ignored; the parameters still go.
  for (const q of ['?f=99&s=5&n=x', '?f=0', '?f=abc&s=1', '?f=3.5']) {
    await page.goto(`/${q}`);
    await expect(page.getByTestId('screen-title')).toBeVisible();
    expect(await state(page)).toBe('title');
    expect(await page.evaluate(() => location.search)).toBe('');
  }
  // Not now goes to the title; a script-like name is only text.
  await page.goto('/?f=1&s=99999999&n=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  await expect(page.getByTestId('challenge-line')).toHaveText('<img src=x o scored 999,999 on The Back Lawn. Beat them?');
  expect(await page.locator('.challenge-line img').count()).toBe(0);
  await press(page, 'btn-challenge-notnow');
  await expect.poll(() => state(page)).toBe('title');
  expect(errors).toEqual([]);
});

test('challenge: the dev level jump wins over a challenge link on a dev host', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?dev=1&level=4&f=9&s=10&hints=0');
  await expect.poll(() => state(page)).toBe('playing');
  expect(await page.evaluate(() => window.__game.info().field)).toBe(4);
  expect(errors).toEqual([]);
});

// ---- the ending ------------------------------------------------------------------

test('ending: win field 15 (dev jump + solver), Finish, the dusk ending, back to the map', async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchErrors(page);
  await seed(page, progressTo(15, { garden: { ladybug: { firstMet: '2026-11-18T10:00:00Z', fields: [3] }, butterfly: { firstMet: '2026-11-19T10:00:00Z', fields: [8] } } }));
  await page.goto('/?dev=1&level=15');
  await expect.poll(() => page.evaluate(() => window.__game?.info().field)).toBe(15);
  await page.evaluate(() => window.__game.ready());
  await page.evaluate(() => { window.__game.timeScale = 8; });
  const summary = await page.evaluate(() => window.__game.solve('fast'));
  expect(summary.won).toBe(true);
  await page.evaluate(() => { window.__game.timeScale = 1; });
  await expect.poll(() => state(page)).toBe('level-won');
  await expect(page.getByTestId('btn-next-field')).toHaveText('Finish');
  await press(page, 'btn-next-field');
  await expect.poll(() => state(page)).toBe('ending');
  await expect(page.getByTestId('card-done')).toContainText('You touched all the grass.');
  await expect(page.getByTestId('card-done')).toContainText('Go touch some real grass.');
  const total = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('touchgrass.v1')).progress.fields).reduce((t, f) => t + f.best, 0));
  await expect(page.getByTestId('ending-total')).toContainText(total.toLocaleString('en-US'));
  await expect(page.getByTestId('btn-ending-share')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__game.audioState().ambience)).toBe('dusk');
  await press(page, 'btn-ending-map');
  await expect.poll(() => state(page)).toBe('map');
  for (let n = 1; n <= 15; n++) await expect(page.getByTestId(`map-token-${n}`)).toHaveClass(/done/);
  // Play now opens the map.
  await press(page, 'btn-map-back');
  await expect(page.getByTestId('btn-continue')).toContainText('Every field is in bloom');
  await press(page, 'btn-continue');
  await expect.poll(() => state(page)).toBe('map');
  expect(errors).toEqual([]);
});

// ---- the bug report (gamegen feedback.md "Play-testing it") ---------------------

test('report: hidden until a repo is set', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?dev=1&level=2&hints=0&bugs=0');
  await expect.poll(() => state(page)).toBe('playing');
  await press(page, 'btn-pause');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  await expect(page.getByTestId('btn-pause-report')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+F');
  expect(await page.evaluate(() => document.getElementById('report').isOpen)).toBe(false);
  await press(page, 'btn-pause-settings');
  await expect(page.getByTestId('btn-settings-report')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('report: the pause button opens the form; game keys stay out of it; submit opens GitHub; the shortcut works', async ({ page, browserName }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (u) => (window.__opened.push(u), {});
    addEventListener('DOMContentLoaded', () => document.getElementById('report')?.setAttribute('repo', 'test/test'));
  });
  await page.goto('/?dev=1&level=2&hints=0&bugs=0');
  await expect.poll(() => state(page)).toBe('playing');
  await page.evaluate(() => window.__game.ready());
  await press(page, 'btn-pause');
  await press(page, 'btn-pause-report');
  const fb = page.locator('#report');
  await expect.poll(() => fb.evaluate((f) => f.isOpen)).toBe(true);
  await expect(page.locator('#ghf-title')).toBeVisible();
  // Type a title with the game's keys in it: the game doesn't unpause or mute.
  await page.locator('#ghf-title').click();
  await page.keyboard.type('Grass p m 1 stuck');
  await page.keyboard.press('p');
  await page.keyboard.press('m');
  expect(await state(page)).toBe('paused');
  expect((await page.evaluate(() => window.__game.audioState())).muted).toBe(false);
  await expect(page.locator('#ghf-title')).toHaveValue('Grass p m 1 stuckpm');
  // Submit: GitHub's new-issue page with the game's details.
  await page.locator('.submit-btn').click();
  await expect.poll(() => page.evaluate(() => window.__opened.length)).toBe(1);
  const url = await page.evaluate(() => window.__opened[0]);
  expect(url.startsWith('https://github.com/test/test/issues/new?')).toBe(true);
  const desc = new URL(url).searchParams.get('description') || new URL(url).searchParams.get('body') || '';
  expect(desc).toContain('Touch Grass');
  expect(desc).toMatch(/"screen":"paused"/);
  expect(desc).toMatch(/"field":2/);
  // Escape closes it and leaves the game paused.
  await page.keyboard.press('Escape');
  await formGone(page);
  expect(await state(page)).toBe('paused');
  await expect(page.getByTestId('card-pause')).toBeVisible();
  // The shortcut, mid-field: the form opens over the paused game.
  await press(page, 'btn-resume');
  await expect.poll(() => state(page)).toBe('playing');
  await page.keyboard.press('Control+Shift+F');
  await expect.poll(() => fb.evaluate((f) => f.isOpen)).toBe(true);
  expect(await state(page)).toBe('paused');
  await page.keyboard.press('Escape');
  await formGone(page);
  await expect(page.getByTestId('card-pause')).toBeVisible();
  // Settings shows the button and the shortcut line.
  await press(page, 'btn-pause-settings');
  await expect(page.getByTestId('btn-settings-report')).toBeVisible();
  if (browserName === 'chromium') await expect(page.getByTestId('set-keys')).toContainText('Ctrl+Shift+F: report a bug');
  await press(page, 'btn-settings-back');
  // A stuck loop: the shortcut still opens it.
  await press(page, 'btn-resume');
  await page.evaluate(() => { const raf = requestAnimationFrame; window.requestAnimationFrame = () => 0; setTimeout(() => { window.requestAnimationFrame = raf; }, 150); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+Shift+F');
  await expect.poll(() => fb.evaluate((f) => f.isOpen)).toBe(true);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('report: never opens by accident while a field is solved', async ({ page }) => {
  test.setTimeout(60000);
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.open = () => ({});
    addEventListener('DOMContentLoaded', () => document.getElementById('report')?.setAttribute('repo', 'test/test'));
  });
  for (const n of [1, 6, 11]) {
    await page.goto(`/?dev=1&level=${n}&hints=0`);
    await expect.poll(() => page.evaluate(() => window.__game?.info().field)).toBe(n);
    await page.evaluate(() => { const fb = document.getElementById('report'), o = fb.open.bind(fb); window.__reports = 0; fb.open = () => (window.__reports++, o()); });
    await page.evaluate(() => { window.__game.timeScale = 8; });
    expect((await page.evaluate(() => window.__game.solve('average'))).won).toBe(true);
    expect(await page.evaluate(() => window.__reports)).toBe(0);
  }
  expect(errors).toEqual([]);
});

// ---- offline ----------------------------------------------------------------------

test('offline: after the service worker installs, the game reloads and plays offline', async ({ page, context, browserName }) => {
  // WebKit installs the worker and it takes control, but Playwright's WebKit
  // can't reload with setOffline ('internal error'), so offline is checked here
  // in Chromium.
  test.skip(browserName !== 'chromium', 'Playwright WebKit cannot reload while emulating offline');
  test.setTimeout(120000);
  const errors = watchErrors(page);
  await page.goto('/?sw=1');
  await expect(page.getByTestId('screen-title')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('screen-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Touch Grass' })).toBeVisible();
  await press(page, 'btn-start');
  await expect.poll(() => page.evaluate(() => window.__game.info().field)).toBe(1);
  await page.evaluate(() => window.__game.ready());
  // The field's art came from the cache.
  expect(await page.evaluate(() => [...document.images].every((i) => !i.src || i.complete))).toBe(true);
  await context.setOffline(false);
  await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
  expect(errors).toEqual([]);
});

// ---- sweep by hovering (Settings, desktop) ---------------------------------------

test('hover-sweep: a moving mouse with no button sweeps; a parked one lifts and angers nothing', async ({ page, browserName }) => {
  // The setting is for a mouse or trackpad (WebKit's iPhone has neither).
  test.skip(browserName !== 'chromium', 'hover-sweep is a desktop setting');
  const errors = watchErrors(page);
  await seed(page, { version: 1, settings: { hover: true } });
  await page.goto('/?dev=1&level=6&hints=0');
  await expect.poll(() => state(page)).toBe('playing');
  await page.evaluate(() => window.__game.ready());
  // Off the ant: sweep a row with the button up.
  await page.evaluate(() => window.__game.clearBugs());
  const a = await page.evaluate(() => window.__game.cellToPage(3, 0));
  const b = await page.evaluate(() => window.__game.cellToPage(3, 11));
  await page.mouse.move(a.x - 40, a.y);
  await page.mouse.move(b.x, b.y, { steps: 20 });
  const info = await page.evaluate(() => window.__game.info());
  expect(info.touched).toBeGreaterThan(10);
  expect(info.sweeping).toBe(true);
  // Parked for 0.5 s: no longer sweeping (the stroke lifts).
  await page.waitForTimeout(600);
  expect((await page.evaluate(() => window.__game.info())).sweeping).toBe(false);
  // Parked next to an ant: a parked pointer never builds its anger. (The
  // move there sweeps past it, which may warn it a little; parked, that
  // build-up only fades, and it calms with no bite.)
  const id = await page.evaluate(() => window.__game.spawn('ant', 10, 4));
  await page.evaluate((i) => window.__game.holdBug(i, 30), id);
  const ant = (await page.evaluate(() => window.__game.bugs()))[0];
  await page.mouse.move(ant.page.x + 30, ant.page.y, { steps: 6 });
  await page.waitForTimeout(500);
  let lastAnger = Infinity;
  await expect.poll(async () => {
    const b = (await page.evaluate(() => window.__game.bugs()))[0];
    expect(b.angerT).toBeLessThanOrEqual(lastAnger + 1e-9);
    lastAnger = b.angerT;
    return b.state;
  }, { timeout: 10000 }).not.toBe('angry');
  expect((await page.evaluate(() => window.__game.info())).bites).toBe(0);
  // A click still pets a friend.
  const lb = await page.evaluate(() => window.__game.spawn('ladybug', 14, 4));
  await page.evaluate((i) => window.__game.holdBug(i, 30), lb);
  let bug = (await page.evaluate(() => window.__game.bugs())).find((x) => x.sp === 'ladybug');
  await page.mouse.move(bug.page.x, bug.page.y, { steps: 4 });
  await page.waitForTimeout(500);
  // (A hover stroke nudges a friend aside: click where it is now.)
  bug = (await page.evaluate(() => window.__game.bugs())).find((x) => x.sp === 'ladybug');
  await page.mouse.move(bug.page.x, bug.page.y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.bugs().find((x) => x.sp === 'ladybug').petted)).toBe(true);
  // Turned off, a moving mouse sweeps nothing.
  await press(page, 'btn-pause');
  await press(page, 'btn-pause-settings');
  await press(page, 'set-hover');
  await press(page, 'btn-settings-back');
  await press(page, 'btn-restart');
  await expect.poll(() => state(page)).toBe('playing');
  await page.mouse.move(a.x - 40, a.y);
  await page.mouse.move(b.x, b.y, { steps: 20 });
  expect((await page.evaluate(() => window.__game.info())).touched).toBe(0);
  expect(errors).toEqual([]);
});
