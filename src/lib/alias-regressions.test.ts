import { test,expect } from 'bun:test';
import { addTask,editOccurrence,getOccurrences,mergeData,moveOccurrence,removeOccurrence } from './domain';
import { mergeForSync,resolveConflict } from './merge';
import { emptyData,type Data } from './model';
const draft={title:'Gym',notes:'',time:'08:00',start:'2026-10-05',end:null,weekdays:[0,1,2,3,4,5,6],reminder:null};
function first(data:Data,date:string){const item=getOccurrences(data,date)[0];if(!item)throw new Error('Missing fixture');return item;}
test('Given a concurrent occurrence edit and exclusion, when syncing, then the occurrence is preserved for review',()=>{
  const base=addTask(emptyData(),draft);const item=first(base,'2026-10-05');
  const edited=editOccurrence(base,item,{...draft,title:'Edited occurrence'},'only');const removed=removeOccurrence(base,item,'only');
  const result=mergeForSync(edited,removed,base);expect(first(result,'2026-10-05').title).toBe('Edited occurrence');expect(result.conflicts.filter(row=>!row.resolved)).toHaveLength(1);
  const conflict=result.conflicts[0];if(!conflict)throw new Error('Missing conflict');expect(getOccurrences(resolveConflict(result,conflict.id,true),'2026-10-05')).toHaveLength(0);
});
test('Given a bounded superseding branch, when it ends, then older branches never resume',()=>{
  const base=addTask(emptyData(),draft);const earlier=editOccurrence(base,first(base,'2026-10-07'),{...draft,title:'Earlier',start:'2026-10-07'},'future');
  const later=editOccurrence(base,first(base,'2026-10-14'),{...draft,title:'Later',start:'2026-10-14',end:'2026-10-16'},'future');const newer={...later,tasks:later.tasks.map(task=>({...task,splitAt:task.splitAt+100,updatedAt:task.updatedAt+100}))};
  expect(getOccurrences(mergeData(earlier,newer),'2026-10-17')).toHaveLength(0);
});
test('Given a moved override on an older alias, when future editing the canonical occurrence, then requested fields apply',()=>{
  const base=addTask(emptyData(),draft);const a=editOccurrence(base,first(base,'2026-10-07'),{...draft,title:'Earlier',start:'2026-10-07'},'future');const moved=moveOccurrence(a,first(a,'2026-10-15'),'2026-10-16');
  const b=editOccurrence(base,first(base,'2026-10-14'),{...draft,title:'Later',start:'2026-10-14'},'future');const newer={...b,tasks:b.tasks.map(task=>({...task,splitAt:task.splitAt+100,updatedAt:task.updatedAt+100}))};
  const merged=mergeData(moved,newer);const item=getOccurrences(merged,'2026-10-16').find(row=>row.originalDate==='2026-10-15');if(!item)throw new Error('Missing moved occurrence');
  const edited=editOccurrence(merged,item,{...draft,title:'Requested change',time:'09:00',start:'2026-10-16'},'future');expect(getOccurrences(edited,'2026-10-16').find(row=>row.originalDate==='2026-10-15')?.title).toBe('Requested change');
});
