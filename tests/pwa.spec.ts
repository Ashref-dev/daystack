import { test,expect } from '@playwright/test';
import { openApp,createRoutine,waitSaved } from './helpers';
import { isolatedServer } from './outage';
test('Given a cached shell, when offline mutations and restart occur, then data survives',async({page})=>{
  const server=await isolatedServer();
  try{
    await openApp(page,'2026-10-05T10:00:00',server.url);await createRoutine(page);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect(page.locator('.quick-add input')).toBeEnabled();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await server.stop();
    await page.getByRole('textbox',{name:'Add a task for Monday'}).fill('Offline errand');await page.getByRole('textbox',{name:'Add a task for Monday'}).press('Enter');await page.getByRole('checkbox',{name:'Offline errand, incomplete'}).click();await page.reload();
    await expect(page.getByRole('checkbox',{name:'Offline errand, complete'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
  }finally{await server.stop();}
});
test('Given Monday before midnight, when local midnight passes, then Tuesday becomes today without reload',async({page})=>{
  await page.clock.install({time:new Date('2026-10-05T23:59:58')});await page.clock.pauseAt(new Date('2026-10-05T23:59:59'));await page.goto('/');await expect(page.locator('.quick-add input')).toBeEnabled();await createRoutine(page);
  await page.clock.fastForward(2000);
  await expect(page.locator('.day-sheet.active')).toHaveAttribute('data-day','2026-10-06');await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
});
test('Given bulk paste, when saving routines, then times are chronological and recurrence is fresh',async({page})=>{
  await openApp(page);await page.getByRole('button',{name:'Plan your week',exact:true}).click();await page.getByRole('button',{name:'Paste a list'}).click();await page.getByRole('textbox',{name:'One routine per line'}).fill('21:00 Read\n07:30 Medication\n12:00 Lunch');await page.getByRole('button',{name:'Add pasted routines'}).click();await page.getByRole('button',{name:'Save routines'}).click();
  await expect(page.locator('.task-title')).toHaveText(['Medication','Lunch','Read']);await page.getByRole('button',{name:'Next week'}).click();await expect(page.getByRole('checkbox',{name:'Medication, 07:30, incomplete'})).toBeVisible();
});
test('Given backup import, when the file is invalid, then existing data remains',async({page})=>{
  await openApp(page);await createRoutine(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('input[type="file"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"tasks":"invalid"}')});await expect(page.getByRole('status')).toContainText('isn’t a valid Folio backup');await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toBeVisible();
});
test('Given a week, when drag-moving a task to Tuesday, then it leaves Monday',async({page})=>{
  await openApp(page);await createRoutine(page);const handle=page.getByRole('button',{name:'Drag Skincare to move or reorder'});await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();const target=await page.locator('[data-day="2026-10-06"] .day-header').boundingBox();if(!box||!target)throw new Error('Missing drag geometry');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12});await page.mouse.up();
  await expect(page.locator('.day-sheet.active')).toHaveAttribute('data-day','2026-10-06');await expect(page.getByRole('checkbox',{name:'Skincare, 08:00, incomplete'})).toHaveCount(2);await page.locator('[data-day="2026-10-05"] .day-header').click();await expect(page.getByRole('checkbox',{name:/Skincare/})).toHaveCount(0);
});
test('Given data, when confirming deletion, then the empty week persists',async({page})=>{
  await openApp(page);await createRoutine(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Delete all task data'}).click();await page.getByRole('textbox',{name:'Confirm deletion'}).fill('DELETE');await page.getByRole('button',{name:'Permanently delete task data'}).click();await waitSaved(page);await page.reload();await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('button',{name:'Try an example week'})).toBeVisible();
});
