import { test,expect } from '@playwright/test';
import { dataSchema } from '../src/lib/model';
import { openApp,createRoutine,waitSaved } from './helpers';
test('Given an interrupted reset journal, when reopening, then deleted content does not return',async({page})=>{
  await openApp(page);await createRoutine(page);await waitSaved(page);
  const raw:unknown=await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('folio');open.onsuccess=()=>{const db=open.result;const read=db.transaction('snapshots').objectStore('snapshots').get('local');read.onsuccess=()=>{resolve(read.result.data);db.close();};};}));
  const snapshot=dataSchema.parse(raw);
  await page.evaluate(data=>{localStorage.setItem('folio-journal:interrupted-reset',JSON.stringify({...data,resetAt:data.resetAt+1,tasks:[],overrides:[],completions:[],conflicts:[]}));},snapshot);
  await page.reload();await expect(page.locator('.quick-add input')).toBeEnabled();await expect(page.getByRole('checkbox')).toHaveCount(0);
});
test('Given Monday and Sunday preferences, when reopening Settings, then the selected value is visible',async({page})=>{
  await openApp(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('combobox',{name:'Starts on'})).toHaveValue('1');await page.getByRole('combobox',{name:'Starts on'}).selectOption('0');await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('combobox',{name:'Starts on'})).toHaveValue('0');
});
test('Given a small mobile planner, when it opens, then the entire save control is in view',async({page})=>{
  await openApp(page);await page.getByRole('button',{name:'Try an example week'}).click();await page.getByRole('button',{name:'Plan your week',exact:true}).click();const save=page.getByRole('button',{name:'Save routines'});await expect(save).toBeInViewport({ratio:1});
  const bounds=await save.boundingBox();const height=page.viewportSize()?.height??0;expect(bounds&&bounds.y+bounds.height<=height).toBeTruthy();
});
