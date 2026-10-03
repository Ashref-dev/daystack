import { expect, type Page } from '@playwright/test';

export const fab = (page: Page) => page.locator('.fab');

export async function ready(page: Page) { await expect(fab(page)).toBeEnabled(); }

export async function openApp(page: Page, date = '2026-10-05T10:00:00', url = '/') {
  await page.clock.install({ time: new Date(date) });
  await page.goto(url);
  await ready(page);
}

/** Opens the week containing `date` with that day expanded (the app honours ?date=). */
export async function chooseDate(page: Page, date: string) {
  await page.goto(`/?date=${date}`);
  await ready(page);
  await expect(page.locator(`[data-day="${date}"]`)).toHaveClass(/open/);
}

export async function openDay(page: Page, date: string) {
  await page.locator(`[data-day="${date}"] .day-head`).click();
  await expect(page.locator(`[data-day="${date}"]`)).toHaveClass(/open/);
}

type Repeat = 'Once' | 'Daily' | 'Weekdays' | 'Weekends' | readonly string[];

/** Creates a task from the floating button. Time defaults to the next full hour (11:00 at the 10:00 test clock). */
export async function createTask(page: Page, title = 'Skincare', repeat: Repeat = 'Daily', timed = true) {
  await fab(page).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByRole('textbox', { name: 'Task name' }).fill(title);
  if (typeof repeat === 'string') await dialog.getByRole('button', { name: repeat, exact: true }).click();
  else {
    await dialog.getByRole('button', { name: 'Once', exact: true }).click();
    for (const day of repeat) await dialog.getByRole('button', { name: day, exact: true }).click();
  }
  if (timed) await dialog.getByRole('switch', { name: 'Set a time' }).click();
  await dialog.locator('.save').click();
  await expect(dialog).toHaveCount(0);
}

export async function editTask(page: Page, title: string) {
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
  return page.getByRole('dialog', { name: 'Edit task' });
}

export async function waitSaved(page: Page) {
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('folio-journal:')))).toBe(false);
}
