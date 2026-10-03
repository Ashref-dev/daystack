import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openApp, createTask, editTask } from './helpers';

async function check(page: Page) {
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().map(animation => animation.finished)); });
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
}

test('Given the stack and both composer modes, when checking accessibility, then no violations exist', async ({ page }) => {
  await openApp(page);
  await createTask(page);
  await check(page);
  await page.locator('.fab').click();
  const composer = page.getByRole('dialog', { name: 'New task' });
  await composer.getByRole('switch', { name: 'Set a time' }).click();
  await check(page);
  await composer.getByRole('button', { name: 'Close' }).click();
  await expect(composer).toHaveCount(0);
  const editor = await editTask(page, 'Skincare');
  await editor.getByRole('button', { name: 'This & upcoming' }).click();
  await check(page);
});
