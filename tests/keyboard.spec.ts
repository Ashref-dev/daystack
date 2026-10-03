import { test,expect } from '@playwright/test';
import { openApp } from './helpers';
test('Given a composer, when opening and escaping, then focus enters the field and returns to the opener',async({page})=>{
  await openApp(page);const opener=page.getByRole('button',{name:'Open full task composer'});await opener.click();await expect(page.getByRole('textbox',{name:'What needs to happen?'})).toBeFocused();await expect(page.getByRole('dialog',{name:'A little intention.'})).toBeVisible();await page.keyboard.press('Escape');await expect(opener).toBeFocused();
});
test('Given a narrow viewport, when every populated day expands, then headers remain within their sheets',async({page})=>{
  await openApp(page);await page.setViewportSize({width:375,height:844});await page.getByRole('button',{name:'Try an example week'}).click();
  for(let index=0;index<7;index++){await page.locator('.day-header').nth(index).click();const result=await page.locator('.day-sheet.active').evaluate(element=>{const rect=element.getBoundingClientRect();const heading=element.querySelector('h2')?.getBoundingClientRect();const meta=element.querySelector('.day-meta')?.getBoundingClientRect();return {headingInside:!!heading&&heading.right<=rect.right,metaInside:!!meta&&meta.right<=rect.right,pageFits:document.documentElement.scrollWidth<=innerWidth};});expect(result).toEqual({headingInside:true,metaInside:true,pageFits:true});}
});
