import { test,expect } from 'bun:test';
import { addTask,editOccurrence,getOccurrences,mergeData,moveOccurrence,toggleComplete,StaleOccurrenceError } from './domain';
import { emptyData,ownerIdSchema,type Data } from './model';
const draft={title:'Gym',notes:'',time:'08:00',start:'2026-10-05',end:null,weekdays:[0,1,2,3,4,5,6],reminder:null};
function first(data:Data,date:string){const item=getOccurrences(data,date)[0];if(!item)throw new Error('Missing fixture');return item;}
test('Given competing future splits, when merging, then the newest successor appears once',()=>{
  const base=addTask(emptyData(),draft);const item=first(base,'2026-10-07');
  const a=editOccurrence(base,item,{...draft,title:'A',start:'2026-10-07'},'future');
  const b=editOccurrence(base,item,{...draft,title:'B',start:'2026-10-07'},'future');
  const newest={...b,tasks:b.tasks.map(task=>({...task,updatedAt:task.updatedAt+100}))};
  const merged=mergeData(a,newest);expect(getOccurrences(merged,'2026-10-08').map(item=>item.title)).toEqual(['B']);
});
test('Given a completed old version, when a newer branch is merged, then dated completion survives',()=>{
  const base=addTask(emptyData(),draft);const a=editOccurrence(base,first(base,'2026-10-07'),{...draft,start:'2026-10-07',title:'A'},'future');
  const completed=toggleComplete(a,first(a,'2026-10-15'));
  const b=editOccurrence(base,first(base,'2026-10-14'),{...draft,start:'2026-10-14',title:'B'},'future');const newer={...b,tasks:b.tasks.map(task=>task.parentId?{...task,splitAt:completed.completions[0]?.updatedAt??task.splitAt}:task)};
  expect(first(mergeData(completed,newer),'2026-10-15').completedAt).toBeNumber();
});
test('Given a newer weekday rule, when resolving an excluded weekday, then an older branch does not leak through',()=>{
  const base=addTask(emptyData(),draft);const a=editOccurrence(base,first(base,'2026-10-07'),{...draft,start:'2026-10-07'},'future');
  const b=editOccurrence(base,first(base,'2026-10-14'),{...draft,start:'2026-10-14',weekdays:[1]},'future');const newer={...b,tasks:b.tasks.map(task=>({...task,splitAt:task.splitAt+100}))};
  expect(getOccurrences(mergeData(a,newer),'2026-10-15')).toHaveLength(0);
});
test('Given a stale editor, when another split supersedes it, then the stale edit is rejected',()=>{
  const base=addTask(emptyData(),draft);const item=first(base,'2026-10-07');const changed=editOccurrence(base,item,{...draft,start:'2026-10-07',title:'Changed'},'future');
  expect(()=>editOccurrence(changed,item,{...draft,start:'2026-10-07',title:'Stale'},'future')).toThrow(StaleOccurrenceError);
});
test('Given a moved occurrence, when future editing it, then its destination identity remains',()=>{
  const base=addTask(emptyData(),draft);const moved=moveOccurrence(base,first(base,'2026-10-05'),'2026-10-08');
  const item=getOccurrences(moved,'2026-10-08').find(item=>item.originalDate==='2026-10-05');if(!item)throw new Error('Missing moved fixture');
  const edited=editOccurrence(moved,item,{...draft,title:'New Gym',start:'2026-10-08'},'future');
  expect(getOccurrences(edited,'2026-10-05')).toHaveLength(0);expect(getOccurrences(edited,'2026-10-08').filter(item=>item.originalDate==='2026-10-05')).toHaveLength(1);
});
test('Given a reset journal, when merging with stale content, then deletion wins',()=>{
  const stale=addTask(emptyData(),draft);const cleared={...emptyData(),resetAt:100};
  expect(mergeData(stale,cleared).tasks).toHaveLength(0);expect(mergeData(cleared,stale).tasks).toHaveLength(0);
});
test('Given different account datasets, when merging, then private tasks never cross owners',()=>{
  const a={...addTask(emptyData(),draft),ownerId:ownerIdSchema.parse(crypto.randomUUID())};const b={...emptyData(),ownerId:ownerIdSchema.parse(crypto.randomUUID())};
  expect(mergeData(b,a).tasks).toHaveLength(0);
});
test('Given a bounded one-off, when moving beyond its old end, then it remains visible',()=>{
  const base=addTask(emptyData(),{...draft,weekdays:[],end:'2026-10-07'});
  const moved=moveOccurrence(base,first(base,'2026-10-05'),'2026-10-08');expect(getOccurrences(moved,'2026-10-08')).toHaveLength(1);
});
test('Given competing splits on different dates, when merging, then earlier historical changes are retained',()=>{
  const base=addTask(emptyData(),draft);
  const earlier=editOccurrence(base,first(base,'2026-10-07'),{...draft,title:'Earlier Gym',start:'2026-10-07'},'future');
  const later=editOccurrence(base,first(base,'2026-10-14'),{...draft,title:'Later Gym',start:'2026-10-14'},'future');
  const newest={...later,tasks:later.tasks.map(task=>({...task,updatedAt:task.updatedAt+100}))};
  const merged=mergeData(earlier,newest);expect(first(merged,'2026-10-09').title).toBe('Earlier Gym');expect(getOccurrences(merged,'2026-10-15').map(row=>row.title)).toEqual(['Later Gym']);
});
