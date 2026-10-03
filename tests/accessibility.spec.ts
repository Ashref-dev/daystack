import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openApp,createRoutine } from './helpers';
test('Given the app and all sheets, when checking accessibility, then no serious violations exist',async({page})=>{
  await openApp(page);await createRoutine(page);
  const check=async()=>{await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().map(animation=>animation.finished));});const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);};
  await check();await page.getByRole('button',{name:'Open full task composer'}).click();await check();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Edit Skincare',exact:true}).click();await check();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Plan your week',exact:true}).click();await check();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await check();await page.getByRole('button',{name:'dark',exact:true}).click();await check();await page.getByRole('button',{name:'Close',exact:true}).click();await check();
  await page.locator('.week-range').click();await check();
});
