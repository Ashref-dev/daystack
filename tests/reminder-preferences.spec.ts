import { test,expect } from '@playwright/test';
import { openApp } from './helpers';
test('Given an untimed routine, when default reminders change, then editing only that occurrence remains possible',async({page})=>{
  await openApp(page);await page.getByRole('button',{name:'Open full task composer'}).click();await page.getByRole('textbox',{name:'What needs to happen?'}).fill('A quiet routine');await page.getByRole('combobox',{name:'Repeat',exact:true}).selectOption('daily');await page.getByRole('button',{name:'Add task',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('combobox',{name:'Default reminder'}).selectOption('0');await expect(page.getByRole('combobox',{name:'Default reminder'})).toHaveValue('0');await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Edit A quiet routine'}).click();await page.getByRole('textbox',{name:'What needs to happen?'}).fill('A quiet moment');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('checkbox',{name:'A quiet moment, incomplete'})).toBeVisible();
});
