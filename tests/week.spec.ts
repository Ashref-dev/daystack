import { test,expect } from '@playwright/test';
import { openApp,chooseDate,createRoutine,waitSaved } from './helpers';
test('Given an empty week, when quick adding and reloading, then the one-off remains',async({page})=>{
  await openApp(page);
  await page.getByRole('textbox',{name:'Add a task for Monday'}).fill('Call dentist');await page.getByRole('textbox',{name:'Add a task for Monday'}).press('Enter');
  await page.reload();await expect(page.getByRole('checkbox',{name:'Call dentist, incomplete'})).toBeVisible();
});
test('Given a daily routine, when completing Monday, then Tuesday and next Monday remain fresh',async({page})=>{
  await openApp(page);await createRoutine(page);
  await page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'}).click();
  await page.locator('[data-day="2026-10-06"] .day-header').click();await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
  await page.getByRole('button',{name:'Next week'}).click();await page.locator('[data-day="2026-10-12"] .day-header').click();await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
  await page.getByRole('button',{name:'Today',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, complete'})).toBeChecked();
});
test('Given a MWF routine, when moving Wednesday, then next week is unchanged',async({page})=>{
  await openApp(page);await createRoutine(page,'Gym','custom');await chooseDate(page,'2026-10-07');
  await page.getByRole('button',{name:'Edit Gym',exact:true}).click();await page.getByRole('button',{name:'Move to another day'}).click();await page.getByRole('textbox',{name:'Move to',exact:true}).fill('2026-10-08');await page.getByRole('button',{name:'Move',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Gym, 08:00, incomplete'})).toHaveCount(0);
  await chooseDate(page,'2026-10-08');await expect(page.getByRole('checkbox',{name:'Gym, 08:00, incomplete'})).toBeVisible();
  await chooseDate(page,'2026-10-14');await expect(page.getByRole('checkbox',{name:'Gym, 08:00, incomplete'})).toBeVisible();
});
test('Given a routine, when editing only one occurrence, then tomorrow keeps its title',async({page})=>{
  await openApp(page);await createRoutine(page);
  await page.getByRole('button',{name:'Edit Skincare',exact:true}).click();await page.getByRole('textbox',{name:'What needs to happen?'}).fill('Skincare with mask');await page.getByRole('textbox',{name:'Time optional'}).fill('09:30');await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('checkbox',{name:'Skincare with mask, 09:30, incomplete'})).toBeVisible();await chooseDate(page,'2026-10-06');await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
});
test('Given a routine, when editing future occurrences on Wednesday, then history remains intact',async({page})=>{
  await openApp(page);await createRoutine(page,'Gym','custom');await chooseDate(page,'2026-10-07');
  await page.getByRole('button',{name:'Edit Gym',exact:true}).click();await page.getByRole('radio',{name:'This and future occurrences'}).check();await page.getByRole('textbox',{name:'Time optional'}).fill('09:00');await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('checkbox',{name:'Gym, 09:00, incomplete'})).toBeVisible();await chooseDate(page,'2026-10-05');await expect(page.getByRole('checkbox',{name:'Gym, 08:00, incomplete'})).toBeVisible();await chooseDate(page,'2026-10-09');await expect(page.getByRole('checkbox',{name:'Gym, 09:00, incomplete'})).toBeVisible();
});
test('Given a completed Monday, when deleting future recurrence, then the completion is preserved',async({page})=>{
  await openApp(page);await createRoutine(page);await page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'}).click();await chooseDate(page,'2026-10-07');
  await page.getByRole('button',{name:'Edit Skincare',exact:true}).click();await page.getByRole('radio',{name:'This and future occurrences'}).check();await page.getByRole('button',{name:'Delete task',exact:true}).click();await page.getByRole('button',{name:'Confirm deletion'}).click();
  await expect(page.getByRole('checkbox',{name:/Skincare/})).toHaveCount(0);await chooseDate(page,'2026-10-05');await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, complete'})).toBeChecked();
});
test('Given a routine, when deleting one occurrence, then the next date remains',async({page})=>{
  await openApp(page);await createRoutine(page);await page.getByRole('button',{name:'Edit Skincare',exact:true}).click();await page.getByRole('button',{name:'Delete task',exact:true}).click();await page.getByRole('button',{name:'Confirm deletion'}).click();
  await expect(page.getByRole('checkbox',{name:/Skincare/})).toHaveCount(0);await chooseDate(page,'2026-10-06');await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
});
test('Given tasks, when changing theme and week start, then settings survive restart',async({page})=>{
  await openApp(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'dark',exact:true}).click();await page.getByRole('combobox',{name:'Starts on'}).selectOption('0');await page.getByRole('button',{name:'Close',exact:true}).click();await waitSaved(page);await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('.day-sheet').first()).toHaveAttribute('data-day','2026-10-04');
});
