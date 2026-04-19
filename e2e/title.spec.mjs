// e2e/title.spec.mjs -- Playwright e2e smoke for the title screen.

import { test, expect } from '@playwright/test';

test('title screen: heading, Start button, click transitions to playing', async ({ page }) => {
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');

  const heading = page.getByRole('heading', { name: /touch grass/i });
  await expect(heading).toBeVisible();

  const start = page.getByTestId('btn-start');
  await expect(start).toBeVisible();
  await expect(start).toBeEnabled();
  await start.click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__game?.state);
  }).toBe('playing');

  expect(consoleErrors, `unexpected console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
