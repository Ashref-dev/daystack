import { test,expect } from 'bun:test';
import { addTask,editOccurrence,getOccurrences,removeOccurrence } from './domain';
import { mergeForSync,resolveConflict,mergeData } from './merge';
import { emptyData } from './model';
const draft={title:'Dentist',notes:'',time:null,start:'2026-10-05',end:null,weekdays:[],reminder:null};
test('Given a concurrently edited and deleted task, when syncing, then content is preserved for review',()=>{
  const base=addTask(emptyData(),draft);const task=base.tasks[0];if(!task)throw new Error('Missing fixture');
  const edited={...base,tasks:[{...task,title:'Dentist with Sam',updatedAt:task.updatedAt+1}]};
  const deleted={...base,tasks:[{...task,deleted:true,updatedAt:task.updatedAt+2}]};
  const result=mergeForSync(edited,deleted,base);expect(result.tasks[0]?.deleted).toBe(false);expect(result.conflicts[0]?.resolved).toBe(false);
});
test('Given an intentional deletion without competing edits, when syncing, then deletion propagates',()=>{
  const base=addTask(emptyData(),draft);const task=base.tasks[0];if(!task)throw new Error('Missing fixture');const removed={...base,tasks:[{...task,deleted:true,updatedAt:task.updatedAt+1}]};
  expect(mergeForSync(base,removed,base).tasks[0]?.deleted).toBe(true);
});
test('Given a conflict, when deletion is explicitly accepted, then a stale cloud copy cannot restore it',()=>{
  const base=addTask(emptyData(),draft);const task=base.tasks[0];if(!task)throw new Error('Missing fixture');
  const result=mergeForSync({...base,tasks:[{...task,title:'Dentist with Sam',updatedAt:task.updatedAt+1}]},{...base,tasks:[{...task,deleted:true,updatedAt:task.updatedAt+2}]},base);
  const resolved=resolveConflict(result,task.id,true);expect(getOccurrences(mergeData(resolved,result),'2026-10-05')).toHaveLength(0);expect(resolved.conflicts[0]?.resolved).toBe(true);
});
test('Given a later routine version, when deleting from earlier history, then all future descendants disappear',()=>{
  const base=addTask(emptyData(),{...draft,weekdays:[0,1,2,3,4,5,6]});const item=getOccurrences(base,'2026-10-07')[0];if(!item)throw new Error('Missing fixture');
  const split=editOccurrence(base,item,{...draft,weekdays:[0,1,2,3,4,5,6],start:'2026-10-07',title:'New routine'},'future');const monday=getOccurrences(split,'2026-10-05')[0];if(!monday)throw new Error('Missing history');
  const removed=removeOccurrence(split,monday,'future');expect(getOccurrences(removed,'2026-10-08')).toHaveLength(0);
});
test('Given a newer journaled preference, when recovering locally, then the setting survives without syncing appearance across devices',()=>{
  const stored=emptyData();const journal={...stored,settings:{...stored.settings,theme:'dark' as const,updatedAt:100}};
  expect(mergeData(stored,journal,true).settings.theme).toBe('dark');expect(mergeData(stored,journal).settings.theme).toBe('system');
});
