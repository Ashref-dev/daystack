import { test, expect } from '@playwright/test';
import { dataSchema } from '../src/lib/model';
import { openApp, createTask, waitSaved, ready } from './helpers';

test('Given an interrupted reset journal, when reopening, then deleted content does not return', async ({ page }) => {
  await openApp(page);
  await createTask(page);
  await waitSaved(page);
  const raw: unknown = await page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('folio');
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction('snapshots').objectStore('snapshots').get('local');
      read.onsuccess = () => { resolve(read.result.data); db.close(); };
    };
  }));
  const snapshot = dataSchema.parse(raw);
  await page.evaluate(data => {
    localStorage.setItem('folio-journal:interrupted-reset', JSON.stringify({ ...data, resetAt: data.resetAt + 1, tasks: [], overrides: [], completions: [], conflicts: [] }));
  }, snapshot);
  await page.reload();
  await ready(page);
  await expect(page.locator('.day.open').getByRole('checkbox')).toHaveCount(0);
});

test('Given a saved routine, when the app restarts, then it lands on today with the routine visible', async ({ page }) => {
  await openApp(page, '2026-10-08T07:00:00');
  await createTask(page, 'Medication', 'Daily');
  await waitSaved(page);
  await page.reload();
  await ready(page);
  await expect(page.locator('[data-day="2026-10-08"]')).toHaveClass(/open/);
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Medication, 08:00' })).toBeVisible();
});

test('Given the appearance toggle, when choosing dark and restarting, then dark persists without system preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  await page.getByRole('group', { name: 'Appearance' }).getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await waitSaved(page);
  await page.reload();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});
