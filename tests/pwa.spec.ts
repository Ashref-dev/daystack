import { test, expect } from '@playwright/test';
import { openApp, createTask, ready } from './helpers';
import { isolatedServer } from './outage';

test('Given a cached shell, when offline changes and a restart occur, then data survives', async ({ page }) => {
  const server = await isolatedServer();
  try {
    await openApp(page, '2026-10-05T10:00:00', server.url);
    await createTask(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await ready(page);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await server.stop();
    await createTask(page, 'Offline errand', 'Once', false);
    await page.locator('.day.open').getByRole('checkbox', { name: 'Offline errand', exact: true }).click();
    await page.reload();
    await ready(page);
    await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Offline errand', exact: true })).toBeChecked();
    await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).not.toBeChecked();
  } finally { await server.stop(); }
});

test('Given Monday before midnight, when local midnight passes, then Tuesday opens fresh without reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T23:59:50') });
  await page.goto('/');
  await ready(page);
  await createTask(page, 'Skincare', 'Daily', false);
  await page.locator('.day.open').getByRole('checkbox', { name: 'Skincare', exact: true }).click();
  await page.clock.fastForward(15000);
  await expect(page.locator('[data-day="2026-10-06"]')).toHaveClass(/open/);
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare', exact: true })).not.toBeChecked();
});
