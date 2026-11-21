// e2e/review.spec.mjs -- the final review's fixes, with real input: anger
// builds over repeated passes (and the 1.5 s warning still comes first), the
// moves show their net price (what the meter really loses), sound stops when
// the page is hidden and comes back on a later gesture, the head start pill
// isn't hidden by a hint card on a phone, a guest can share back, names lose
// bidi marks, Esc leaves How to play, and Settings from pause un-ducks.
//
// page.evaluate is only for setup (a save, a held bug, the meter) and for
// reading state.

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
  const b = await loc.boundingBox();
  await pressAt(page, b.x + b.width / 2, b.y + b.height / 2, hold);
}

const state = (page) => page.evaluate(() => window.__game?.state);
const label = (page, frac, exact = false) => page.evaluate(async ([f, e]) =>
  (await import('/src/sim/moves.mjs')).priceLabel(f, { exact: e }), [frac, exact]);

// Sweep lanes over the top part of the field, then let it grow back part way
// (sped up), so standing grass is half grown and moves cost something.
async function halfGrow(page, rows) {
  for (const r of rows) {
    const a = await page.evaluate((rr) => window.__game.cellToPage(rr, 0), r);
    const b = await page.evaluate((rr) => window.__game.cellToPage(rr, 30), r);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  }
  await page.evaluate(() => { window.__game.timeScale = 4; });
  await expect.poll(() => page.evaluate(() => window.__game.moves().losses.clear), { timeout: 20000 }).toBeGreaterThan(0.012);
  await page.evaluate(() => { window.__game.timeScale = 1; });
}

test('bugs: one pass warns; sweeping back and forth past a bee builds to a bite, after 1.5 s of warning with the arc full', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 10, '&hints=0');
  const info = await page.evaluate(() => {
    const g = window.__game;
    g.clearBugs();
    const id = g.spawn('bee', 14, 14);
    g.holdBug(id, 120);
    g.setMeter(0.5);
    const c = g.layout.cell;
    // Record every frame: game time, the bee's state and warning level, bites.
    window.__rec = [];
    const f = () => {
      const b = g.bugs()[0];
      const i = g.info();
      window.__rec.push({ t: i.time, s: b ? b.state : null, w: b ? b.warn : 0, bites: i.bites });
      requestAnimationFrame(f);
    };
    f();
    return { c, ra: Math.max(1.5 * c, 40), page: g.bugs()[0].page };
  });
  const { page: p, ra } = info;
  const L = 3 * ra;
  // Real strokes straight through the bee and back, ~350 px/s.
  await page.mouse.move(p.x - L, p.y);
  await page.mouse.down();
  let x = p.x - L, dir = 1, passes = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    x += dir * 6;
    if (x > p.x + L || x < p.x - L) { dir = -dir; passes++; }
    await page.mouse.move(x, p.y);
    await page.waitForTimeout(16);
    if (passes % 2 === 0 && (await page.evaluate(() => window.__game.info().bites)) > 0) break;
  }
  await page.mouse.up();
  const rec = await page.evaluate(() => window.__rec);
  const biteAt = rec.findIndex((r) => r.bites > 0);
  expect(biteAt, 'sweeping back and forth near a bee bites').toBeGreaterThan(0);
  const start = rec.findIndex((r) => r.s === 'angry');
  // The warning showed without a break from its start to the bite.
  for (let k = start; k < biteAt; k++) expect(rec[k].s).toBe('angry');
  expect(rec[biteAt].t - rec[start].t).toBeGreaterThanOrEqual(1.5 - 1e-6);
  // The arc showed (all but) full on the frame before the bite (a frame can
  // hold a few sim steps; test/insects.test.mjs checks it's exactly full on
  // the step before), and it had faded between passes (the build-up came
  // from several passes, not one).
  expect(rec[biteAt - 1].w).toBeGreaterThanOrEqual(0.85);
  const before = rec.slice(start, biteAt);
  const dips = before.filter((r, k) => k > 0 && r.w < before[k - 1].w - 1e-6).length;
  expect(dips).toBeGreaterThan(0);
  expect(passes).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('moves: the buttons show the net price ("free" on full-grown grass) and it is what the meter really loses', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 11, '&hints=0&bugs=0');
  const price = (k) => page.getByTestId(`btn-move-${k}`).locator('.move-price');
  // A fresh field is full-grown: every move is free (net) once the meter can hold it.
  await page.evaluate(() => window.__game.setMeter(0.5));
  for (const k of ['ring', 'line', 'clear']) await expect(price(k)).toHaveText('free');
  // Back to an empty meter, so sweeping the half-grown rows can't win the field.
  await page.evaluate(() => window.__game.setMeter(0));
  await halfGrow(page, [2, 4, 6, 8, 10, 12, 14]);
  await page.evaluate(() => window.__game.setMeter(0.9));
  // The buttons follow the grass: the shown text is the label of the live net cost.
  await expect.poll(async () => {
    const m = await page.evaluate(() => window.__game.moves().losses);
    return (await price('clear').textContent()) === await label(page, m.clear);
  }).toBe(true);
  const shown = await price('clear').textContent();
  expect(shown).toMatch(/^−\d+%$/);

  // The Ring, aimed at the half-grown part: the preview's exact net is the meter's change.
  await press(page, 'btn-move-ring');
  await expect.poll(() => page.evaluate(() => window.__game.armed)).toBe('ring');
  const a = await page.evaluate(() => window.__game.cellToPage(8, 15));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const pv = await page.evaluate(() => window.__game.moves().preview);
  const m0 = await page.evaluate(() => window.__game.info().meter);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.moves().fired.ring)).toBe(1);
  const m1 = await page.evaluate(() => window.__game.info().meter);
  expect(pv.lossFrac).toBeGreaterThan(0);
  expect(Math.abs((m0 - m1) - pv.lossFrac)).toBeLessThan(0.002);
  expect(pv.label).toBe(await label(page, pv.lossFrac, true));

  // Full Clear: its net price (exact, on the button and the armed preview) is
  // the meter's change. Grass crossing the standing height moves it quickly,
  // so the sim runs slowly while it's measured.
  await page.evaluate(() => { window.__game.setMeter(0.9); window.__game.timeScale = 0.1; });
  await press(page, 'btn-move-clear');
  await expect.poll(() => page.evaluate(() => window.__game.moves().preview?.kind)).toBe('clear');
  const cp = await page.evaluate(() => window.__game.moves());
  expect(await price('clear').textContent()).toBe(await label(page, cp.losses.clear));
  expect(cp.preview.label).toBe(`Full Clear ${await label(page, cp.preview.lossFrac, true)}: tap the field`);
  const c0 = await page.evaluate(() => window.__game.info().meter);
  const f = await page.evaluate(() => window.__game.cellToPage(20, 8));
  await pressAt(page, f.x, f.y, 90);
  await expect.poll(() => page.evaluate(() => window.__game.moves().fired.clear)).toBe(1);
  const c1 = await page.evaluate(() => window.__game.info().meter);
  await page.evaluate(() => { window.__game.timeScale = 1; });
  expect(Math.abs((c0 - c1) - cp.preview.lossFrac)).toBeLessThan(0.002);
  expect(Math.abs((c0 - c1) - cp.losses.clear)).toBeLessThan(0.005);
  // The full charge was far bigger than what was lost: the old "34%" misled.
  expect(cp.prices.clear).toBeGreaterThan((c0 - c1) + 0.1);
  expect(errors).toEqual([]);
});

test('moves: a hint card over the next field shows that field\'s prices, never the last field\'s', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 14, '&hints=0&bugs=0');
  await halfGrow(page, [3, 5, 7, 9, 11, 13]);
  const old = await page.getByTestId('btn-move-clear').locator('.move-price').textContent();
  expect(old).not.toBe('free');
  // Hints back on for field 15, then win 14 and go on with the real button.
  await page.evaluate(() => { window.__game._game.hintsOn = true; window.__game.setMeter(1); });
  await expect.poll(() => state(page)).toBe('level-won');
  await press(page, 'btn-next-field');
  await expect.poll(() => state(page)).toBe('hint');
  expect(await page.evaluate(() => window.__game.info().field)).toBe(15);
  // Field 15's own prices: the net price where the meter can hold the move,
  // else what it needs first (never field 14's leftover).
  const mv = await page.evaluate(() => ({ ...window.__game.moves(), meter: window.__game.info().meter }));
  for (const k of ['ring', 'line', 'clear']) {
    const want = mv.meter + 1e-9 < mv.prices[k]
      ? `needs ${Math.max(1, Math.round(mv.prices[k] * 100))}%`
      : await label(page, mv.losses[k]);
    await expect(page.getByTestId(`btn-move-${k}`).locator('.move-price')).toHaveText(want);
  }
  // Fresh, full-grown field 15: Full Clear's net price is free (field 14's
  // half-grown "−N%" didn't carry over).
  expect(mv.losses.clear).toBeLessThan(0.005);
  expect(await label(page, mv.losses.clear)).toBe('free');
  expect(errors).toEqual([]);
});

test('audio: hidden page suspends the sound (and pauses the field); it resumes when shown, and on a later gesture after an interruption', async ({ page }) => {
  const errors = watchErrors(page);
  await openField(page, 3, '&hints=0');
  const a = await page.evaluate(() => window.__game.cellToPage(4, 4));
  await pressAt(page, a.x, a.y);
  await expect.poll(() => page.evaluate(() => window.__game.audioState().context)).toBe('running');
  const setHidden = (h) => page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  await setHidden(true);
  await expect.poll(() => page.evaluate(() => window.__game.audioState().context)).toBe('suspended');
  expect(await state(page)).toBe('paused');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.audioState().context)).toBe('suspended');
  await setHidden(false);
  await expect.poll(() => page.evaluate(() => window.__game.audioState().context)).toBe('running');
  // An interruption (a call, Siri) on a device that only lets a gesture
  // start sound again: emulate that policy, then interrupt.
  // resume() only works inside a real (trusted) gesture's handler.
  await page.evaluate(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const orig = AC.prototype.resume;
    AC.prototype.resume = function resume() {
      const ev = window.event;
      const gesture = !!ev && ev.isTrusted && ['pointerup', 'touchend', 'click', 'keydown'].includes(ev.type);
      return gesture ? orig.call(this) : Promise.reject(new DOMException('needs a gesture', 'NotAllowedError'));
    };
  });
  expect(await page.evaluate(() => window.__game.audioInterrupt())).toBe('suspended');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__game.audioState().context)).toBe('suspended');
  // A real press on the pause card's Resume button: sound is back.
  await press(page, 'btn-resume');
  await expect.poll(() => page.evaluate(() => window.__game.audioState().context)).toBe('running');
  expect(await state(page)).toBe('playing');
  expect(errors).toEqual([]);
});

test.describe('phone portrait 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('head start: the pill shows once the hint card closes, fully in view; the card leaves field 2\'s mown stripe visible', async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('touchgrass.v1', JSON.stringify({
          version: 1, settings: {}, progress: { unlocked: 2, fields: { 1: { best: 400, cleared: true } } }, allTimeBest: 400, headStart: { field: 2 },
        }));
        sessionStorage.setItem('seeded', '1');
      }
    });
    await openField(page, 2);
    await expect.poll(() => state(page)).toBe('hint');
    expect(await page.evaluate(() => window.__game.info().headStart)).toBe(true);
    await expect(page.getByTestId('hud-toast')).not.toHaveClass(/show/);
    // The stripe: the rows that start mown.
    const stripe = await page.evaluate(() => {
      const g = window.__game.grid;
      const rows = [];
      for (let r = 0; r < g.H; r++) if (g.h[r * g.W + 6] < 0.3) rows.push(r);
      const top = window.__game.cellToPage(rows[0], 6).y - window.__game.layout.cell / 2;
      const bottom = window.__game.cellToPage(rows.at(-1), 6).y + window.__game.layout.cell / 2;
      return { rows, top, bottom };
    });
    expect(stripe.rows.length).toBeGreaterThan(0);
    const card = await page.getByTestId('card-hint').boundingBox();
    expect(card.y, 'the card sits below the mown stripe').toBeGreaterThan(stripe.bottom);
    expect(card.y + card.height).toBeLessThanOrEqual(844);
    await press(page, 'btn-hint-ok');
    await expect.poll(() => state(page)).toBe('playing');
    const toast = page.getByTestId('hud-toast');
    await expect(toast).toHaveClass(/show/);
    await expect(toast).toHaveText('Head start: +15%');
    await page.waitForTimeout(300);
    const b = await toast.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    expect(b.y + b.height).toBeLessThanOrEqual(844);
    // Nothing covers it: no card is open, and it's clear of the HUD panel.
    await expect(page.getByTestId('card-layer')).toBeHidden();
    expect(await toast.evaluate((t) => getComputedStyle(t).opacity)).toBe('1');
    const hud = await page.getByTestId('hud').boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(hud.y + hud.height);
    expect(errors).toEqual([]);
  });
});

test('challenge: a guest\'s result has Share, which sends a challenge back by the same scorecard flow', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.__shares = [];
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => ({ writeText: async (t) => { window.__shares.push(t); } }), configurable: true });
  });
  await page.goto('/?f=12&s=100&n=Sam');
  await expect(page.getByTestId('screen-challenge')).toBeVisible();
  // "Five-Stone Lawn" is kept on one line.
  await expect(page.getByTestId('challenge-line').locator('.keep-name')).toHaveText('Five-Stone Lawn');
  await press(page, 'btn-challenge-play');
  await press(page, 'btn-checklist-ok');
  await expect.poll(() => state(page)).toBe('playing');
  expect(await page.evaluate(() => window.__game.info().guest)).toBe(true);
  await page.evaluate(() => window.__game.setMeter(1));
  await expect.poll(() => state(page)).toBe('level-won');
  await expect(page.getByTestId('btn-try-again')).toBeVisible();
  await press(page, 'btn-complete-share');
  await expect(page.getByTestId('modal-share-name')).toBeVisible();
  await page.getByTestId('share-name').fill('Robin');
  await press(page, 'btn-share-name-ok');
  await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1);
  expect(await page.evaluate(() => window.__shares[0])).toMatch(/Five-Stone Lawn.*\?f=12&s=\d+&n=Robin$/);
  expect(errors).toEqual([]);
});

test('settings: a name typed with bidi marks is saved without them', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('screen-title')).toBeVisible();
  await press(page, 'btn-settings');
  await expect.poll(() => state(page)).toBe('settings');
  const input = page.getByTestId('set-name');
  await input.click();
  await page.keyboard.type('Sam‮evil​');
  await page.keyboard.press('Tab');
  await expect(input).toHaveValue('Samevil');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('touchgrass.v1')).settings.name)).toBe('Samevil');
  expect(errors).toEqual([]);
});

test('pause: Esc leaves How to play back to the pause card; Settings from pause un-ducks the music, and back ducks it', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  // With the field's hint seen (pressed away), so How to play has something to show.
  await openField(page, 6);
  await expect.poll(() => state(page)).toBe('hint');
  await press(page, 'btn-hint-ok');
  await expect.poll(() => state(page)).toBe('playing');
  await press(page, 'btn-pause');
  await expect.poll(() => state(page)).toBe('paused');
  expect((await page.evaluate(() => window.__game.audioState())).ducked).toBe(true);
  await press(page, 'btn-howto');
  await expect(page.getByTestId('card-howto')).toBeVisible();
  if (!isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('card-pause')).toBeVisible();
    expect(await state(page)).toBe('paused');
  } else {
    await press(page, 'btn-howto-back');
    await expect(page.getByTestId('card-pause')).toBeVisible();
  }
  await press(page, 'btn-pause-settings');
  await expect.poll(() => state(page)).toBe('settings');
  await expect.poll(() => page.evaluate(() => window.__game.audioState().ducked)).toBe(false);
  await press(page, 'btn-settings-back');
  await expect.poll(() => state(page)).toBe('paused');
  await expect.poll(() => page.evaluate(() => window.__game.audioState().ducked)).toBe(true);
  expect(errors).toEqual([]);
});
