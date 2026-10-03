import { test, expect } from '@playwright/test';
import { openApp, createTask } from './helpers';

test('Given the composer, when opening and escaping, then focus enters the name and returns to the add button', async ({ page }) => {
  await openApp(page);
  const opener = page.locator('.fab');
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await expect(dialog.getByRole('textbox', { name: 'Task name' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Given a time wheel, when using arrow keys, then the time changes by one step', async ({ page }) => {
  await openApp(page);
  await page.locator('.fab').click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByRole('switch', { name: 'Set a time' }).click();
  const minute = dialog.getByRole('spinbutton', { name: 'Minute' });
  await minute.press('ArrowUp');
  await expect(minute).toHaveAttribute('aria-valuetext', '59');
  await expect(dialog.getByRole('button', { name: /^Time/ })).toContainText('11:59');
});

test('Given a narrow phone, when every populated day opens, then names stay inside their sheets', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await createTask(page, 'A deliberately long routine name that should wrap neatly', 'Daily');
  for (const day of ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-10']) {
    await page.locator(`[data-day="${day}"] .day-head`).click();
    const overflow = await page.locator(`[data-day="${day}"]`).evaluate(element => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});
