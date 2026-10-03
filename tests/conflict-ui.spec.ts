import { test,expect } from '@playwright/test';
import { addTask,editOccurrence,removeOccurrence,getOccurrences } from '../src/lib/domain';
import { mergeForSync } from '../src/lib/merge';
import { emptyData } from '../src/lib/model';
import { openApp } from './helpers';
function conflictFixture(){
  const draft={title:'Skincare',notes:'',time:'08:00',start:'2026-10-05',end:null,weekdays:[0,1,2,3,4,5,6],reminder:null};
  const base=addTask(emptyData(),draft);const item=getOccurrences(base,'2026-10-05')[0];if(!item)throw new Error('Missing fixture');
  return mergeForSync(editOccurrence(base,item,{...draft,title:'Skincare with mask'},'only'),removeOccurrence(base,item,'only'),base);
}
for(const action of ['Keep task','Apply deletion']as const){test(`Given an imported conflict, when choosing ${action}, then the review is resolved through Settings`,async({page})=>{
  await openApp(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('input[type="file"]').setInputFiles({name:'conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conflictFixture()))});
  await expect(page.getByText('A task changed while another device removed it.')).toBeVisible();await page.getByRole('button',{name:action,exact:true}).click();await expect(page.getByText('A task changed while another device removed it.')).toHaveCount(0);await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Skincare with mask, 08:00, incomplete'})).toHaveCount(action==='Keep task'?1:0);
});}
