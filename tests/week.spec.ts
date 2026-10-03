import { test, expect } from '@playwright/test';
import { openApp, chooseDate, openDay, createTask, editTask } from './helpers';

test('Given an empty week, when adding a one-off and reloading, then it remains only on that day', async ({ page }) => {
  await openApp(page);
  await createTask(page, 'Call dentist', 'Once', false);
  await page.reload();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Call dentist', exact: true })).toBeVisible();
  await openDay(page, '2026-10-06');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Call dentist', exact: true })).toHaveCount(0);
});

test('Given a new task, when opening the composer, then it defaults to every day and says so', async ({ page }) => {
  await openApp(page);
  await page.locator('.fab').click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await expect(dialog.getByRole('button', { name: 'Daily', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.save')).toHaveText('Add to every day');
});

test('Given a daily routine, when completing Monday, then Tuesday and next Monday stay fresh', async ({ page }) => {
  await openApp(page);
  await createTask(page);
  await page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' }).click();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).toBeChecked();
  await openDay(page, '2026-10-06');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Next week' }).click();
  await openDay(page, '2026-10-12');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).not.toBeChecked();
  await page.locator('.week-title').click();
  await expect(page.locator('[data-day="2026-10-05"]')).toHaveClass(/open/);
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).toBeChecked();
});

test('Given weekday and Sunday routines, when browsing the week, then each appears on its days', async ({ page }) => {
  await openApp(page);
  await createTask(page, 'Gym', 'Weekdays');
  await createTask(page, 'Medication', ['Sunday'], false);
  await openDay(page, '2026-10-09');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 11:00' })).toBeVisible();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Medication', exact: true })).toHaveCount(0);
  await openDay(page, '2026-10-11');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 11:00' })).toHaveCount(0);
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Medication', exact: true })).toBeVisible();
});

test('Given a MWF routine, when moving Wednesday to Thursday, then next week is unchanged', async ({ page }) => {
  await openApp(page);
  await createTask(page, 'Gym', ['Monday', 'Wednesday', 'Friday']);
  await chooseDate(page, '2026-10-07');
  const dialog = await editTask(page, 'Gym');
  await dialog.getByRole('button', { name: /^Date/ }).click();
  await dialog.getByRole('spinbutton', { name: 'Date' }).press('ArrowDown');
  await expect(dialog.getByRole('button', { name: /^Date/ })).toContainText('Thu, Oct 8');
  await dialog.locator('.save').click();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 11:00' })).toHaveCount(0);
  await openDay(page, '2026-10-08');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 11:00' })).toBeVisible();
  await chooseDate(page, '2026-10-14');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 11:00' })).toBeVisible();
});

test('Given a routine, when editing only one occurrence, then tomorrow keeps its title', async ({ page }) => {
  await openApp(page);
  await createTask(page);
  const dialog = await editTask(page, 'Skincare');
  await dialog.getByRole('textbox', { name: 'Task name' }).fill('Skincare with mask');
  await dialog.locator('.save').click();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare with mask, 11:00' })).toBeVisible();
  await openDay(page, '2026-10-06');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).toBeVisible();
});

test('Given a routine, when changing upcoming time on Wednesday, then earlier days keep theirs', async ({ page }) => {
  await openApp(page);
  await createTask(page, 'Gym', 'Weekdays');
  await chooseDate(page, '2026-10-07');
  const dialog = await editTask(page, 'Gym');
  await dialog.getByRole('button', { name: 'This & upcoming' }).click();
  await dialog.getByRole('button', { name: /^Time/ }).click();
  await dialog.getByRole('spinbutton', { name: 'Hour' }).press('ArrowDown');
  await expect(dialog.getByRole('button', { name: /^Time/ })).toContainText('12:00');
  await dialog.locator('.save').click();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 12:00' })).toBeVisible();
  await openDay(page, '2026-10-05');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 11:00' })).toBeVisible();
  await openDay(page, '2026-10-09');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Gym, 12:00' })).toBeVisible();
});

test('Given a completed Monday, when deleting upcoming from Wednesday, then Monday is preserved', async ({ page }) => {
  await openApp(page);
  await createTask(page);
  await page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' }).click();
  await chooseDate(page, '2026-10-07');
  const dialog = await editTask(page, 'Skincare');
  await dialog.getByRole('button', { name: 'This & upcoming' }).click();
  await dialog.getByRole('button', { name: 'Delete task' }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: /Skincare/ })).toHaveCount(0);
  await openDay(page, '2026-10-05');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).toBeChecked();
});

test('Given a routine, when deleting one occurrence, then the next day remains', async ({ page }) => {
  await openApp(page);
  await createTask(page);
  const dialog = await editTask(page, 'Skincare');
  await dialog.getByRole('button', { name: 'Delete task' }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.locator('.day.open').getByRole('checkbox', { name: /Skincare/ })).toHaveCount(0);
  await openDay(page, '2026-10-06');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Skincare, 11:00' })).toBeVisible();
});

test('Given a blank name, when saving, then a friendly error is shown', async ({ page }) => {
  await openApp(page);
  await page.locator('.fab').click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByRole('textbox', { name: 'Task name' }).fill('   ');
  await dialog.locator('.save').click();
  await expect(dialog.getByRole('alert')).toHaveText('Give it a name.');
});

test('Given a week, when dragging a task onto Tuesday, then it moves there', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch long-press is exercised manually on devices');
  await openApp(page);
  await createTask(page, 'Errand', 'Once');
  const row = page.getByRole('button', { name: 'Edit Errand', exact: true });
  const box = await row.boundingBox();
  const target = await page.locator('[data-day="2026-10-06"] .day-head').boundingBox();
  if (!box || !target) throw new Error('Missing drag geometry');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('[data-day="2026-10-06"]')).toHaveClass(/open/);
  await expect(page.locator('.day.open').getByRole('checkbox', { name: 'Errand, 11:00' })).toBeVisible();
  await openDay(page, '2026-10-05');
  await expect(page.locator('.day.open').getByRole('checkbox', { name: /Errand/ })).toHaveCount(0);
});
