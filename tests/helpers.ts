import { expect,type Page } from '@playwright/test';
export async function openApp(page:Page,date='2026-10-05T10:00:00',url='/'){
  await page.clock.install({time:new Date(date)});await page.goto(url);await expect(page.locator('.quick-add input')).toBeEnabled();
}
export async function chooseDate(page:Page,date:string){
  await page.locator('.week-range').click();await page.getByRole('textbox',{name:'Go to date'}).fill(date);await page.getByRole('button',{name:'Open week'}).click();
}
export async function createRoutine(page:Page,title='Skincare',repeat='daily'){
  await page.getByRole('button',{name:'Open full task composer'}).click();await page.getByRole('textbox',{name:'What needs to happen?'}).fill(title);
  await page.getByRole('textbox',{name:'Time optional'}).fill('08:00');await page.getByRole('combobox',{name:'Repeat',exact:true}).selectOption(repeat);
  if(repeat==='custom'){await page.getByRole('button',{name:'Wed',exact:true}).click();await page.getByRole('button',{name:'Fri',exact:true}).click();}
  await page.getByRole('button',{name:'Add task',exact:true}).click();
}
export async function waitSaved(page:Page){await expect(page.locator('.app-footer')).not.toContainText('Saving…');}
