import { taskIdSchema,type Data,type Draft,type Occurrence,type Override,type Task } from './model';
import { addDays, weekday } from './dates';
import { familyIds,rootId,currentVersion } from './lineage';
import { latestBy } from './records';
function editedAt(data:Data):number{return [...data.tasks,...data.overrides,...data.completions].reduce((stamp,row)=>Math.max(stamp,row.updatedAt+1),Date.now());}
function editableTask(data:Data,occurrence:Occurrence):Task{
  const current=data.tasks.find(task=>task.id===occurrence.task.id);
  if(!current||!occursOn(current,occurrence.originalDate)||currentVersion(data.tasks,current.id,occurrence.originalDate)?.id!==current.id)throw new StaleOccurrenceError();
  return current;
}

export function occursOn(task: Task, date: string): boolean {
  return !task.deleted && date >= task.start && (!task.end || date <= task.end) &&
    (task.weekdays.length ? task.weekdays.includes(weekday(date)) : date === task.start);
}
export function getOccurrences(data: Data, date: string): Occurrence[] {
  const result: Occurrence[] = [];
  const roots=new Map(data.tasks.map(task=>[task.id,rootId(data.tasks,task.id)]));
  for (const task of data.tasks) {
    const root=roots.get(task.id);
    const moved=data.overrides.filter(row=>roots.get(row.taskId)===root && row.movedTo===date && !row.excluded);
    const sourceDates=new Set(moved.map(row=>row.date));
    if(occursOn(task,date)) sourceDates.add(date);
    for(const originalDate of sourceDates) {
      if(!occursOn(task,originalDate)) continue;
      if(currentVersion(data.tasks,task.id,originalDate)?.id!==task.id)continue;
      const key=`${task.id}:${originalDate}`;
      const override=data.overrides.filter(row=>roots.get(row.taskId)===root&&row.date===originalDate).toSorted((a,b)=>b.updatedAt-a.updatedAt||b.id.localeCompare(a.id))[0];
      const completion=data.completions.filter(row=>roots.get(row.taskId)===root&&row.date===originalDate).toSorted((a,b)=>b.updatedAt-a.updatedAt||b.id.localeCompare(a.id))[0];
      if(override?.excluded || (override?.movedTo && override.movedTo!==date)) continue;
      result.push({key,task,originalDate,date,title:override?.title??task.title,notes:override?.notes??task.notes,
        time:override ? override.time : task.time,order:override?.order??task.order,
        completedAt:completion?.completedAt??null,overridden:!!override});
    }
  }
  return result.sort((a,b)=>(a.time??'99:99').localeCompare(b.time??'99:99') || a.order-b.order || a.title.localeCompare(b.title));
}
export function addTask(data: Data, draft: Draft): Data {
  const task: Task={...draft,end:draft.weekdays.length?draft.end:null,ruleEnd:draft.weekdays.length?draft.end:null,id:taskIdSchema.parse(crypto.randomUUID()),parentId:null,splitAt:0,updatedAt:editedAt(data),deleted:false,order:data.tasks.length};
  return {...data,tasks:[...data.tasks,task]};
}
export function toggleComplete(data: Data, occurrence: Occurrence): Data {
  const now=editedAt(data);
  const completion={id:occurrence.key,taskId:occurrence.task.id,date:occurrence.originalDate,completedAt:occurrence.completedAt?null:now,updatedAt:now};
  return {...data,completions:[...data.completions.filter(row=>row.id!==occurrence.key),completion]};
}
function makeOverride(occurrence: Occurrence): Override {
  return {id:occurrence.key,taskId:occurrence.task.id,date:occurrence.originalDate,title:occurrence.title,notes:occurrence.notes,
    time:occurrence.time,movedTo:occurrence.date===occurrence.originalDate?null:occurrence.date,excluded:false,order:occurrence.order,updatedAt:Date.now()};
}
export function setOverride(data: Data, override: Override): Data { return {...data,overrides:[...data.overrides.filter(row=>row.id!==override.id),{...override,updatedAt:editedAt(data)}]}; }
export function moveOccurrence(data: Data, occurrence: Occurrence, target: string): Data {
  const current=editableTask(data,occurrence);
  const stamp=editedAt(data);
  if(!current.weekdays.length) {
    const originalDate=current.start;
    return {...data,tasks:data.tasks.map(task=>task.id===occurrence.task.id?{...task,start:target,end:null,ruleEnd:null,updatedAt:stamp}:task),
      completions:data.completions.map(row=>row.taskId===occurrence.task.id&&row.date===originalDate?{...row,date:target,id:`${row.taskId}:${target}`,updatedAt:stamp}:row),
      overrides:data.overrides.map(row=>row.taskId===occurrence.task.id?{...row,date:target,id:`${row.taskId}:${target}`,movedTo:null,updatedAt:stamp}:row)};
  }
  return setOverride(data,{...makeOverride(occurrence),movedTo:target===occurrence.originalDate?null:target});
}
export function editOccurrence(data: Data, occurrence: Occurrence, draft: Draft, scope:'only'|'future'): Data {
  const current=editableTask(data,occurrence);
  if(!current.weekdays.length) {
    const moved=moveOccurrence(data,occurrence,draft.start);
    const stamp=editedAt(moved);
    return {...moved,tasks:moved.tasks.map(task=>task.id===occurrence.task.id?{...task,...draft,end:draft.weekdays.length?draft.end:null,ruleEnd:draft.weekdays.length?draft.end:null,updatedAt:stamp}:task),overrides:moved.overrides.map(row=>row.taskId===occurrence.task.id?{...row,title:draft.title,notes:draft.notes,time:draft.time,updatedAt:stamp}:row)};
  }
  if(scope==='only') return setOverride(data,{...makeOverride(occurrence),title:draft.title,notes:draft.notes,time:draft.time,movedTo:draft.start===occurrence.originalDate?null:draft.start});
  const newId=taskIdSchema.parse(crypto.randomUUID()); const from=occurrence.originalDate; const now=editedAt(data);
  const family=familyIds(data.tasks,rootId(data.tasks,current.id));
  const logicalKey=(row:{taskId:string;date:string})=>`${rootId(data.tasks,row.taskId)}:${row.date}`;
  return {...data,tasks:[...data.tasks.map(task=>family.has(task.id)?{...task,end:task.end&&task.end<from?task.end:addDays(from,-1),deleted:task.start>=from&&task.id!==current.id,updatedAt:now}:task),
    {...current,...draft,end:draft.weekdays.length?draft.end:null,ruleEnd:draft.weekdays.length?draft.end:null,id:newId,parentId:current.id,splitAt:now,start:from,updatedAt:now}],
    overrides:latestBy(data.overrides,logicalKey).map(row=>family.has(row.taskId) && row.date>=from?{...row,taskId:newId,id:`${newId}:${row.date}`,updatedAt:now,...(row.date===occurrence.originalDate?{title:draft.title,notes:draft.notes,time:draft.time,movedTo:occurrence.date===occurrence.originalDate?null:occurrence.date}:{} )}:row),
    completions:latestBy(data.completions,logicalKey).map(row=>family.has(row.taskId) && row.date>=from?{...row,taskId:newId,id:`${newId}:${row.date}`,updatedAt:now}:row)};
}
export function removeOccurrence(data: Data, occurrence: Occurrence, scope:'only'|'future'): Data {
  const current=editableTask(data,occurrence);
  if(!current.weekdays.length) return {...data,tasks:data.tasks.map(task=>task.id===occurrence.task.id?{...task,deleted:true,updatedAt:editedAt(data)}:task)};
  if(scope==='only') return setOverride(data,{...makeOverride(occurrence),excluded:true});
  const family=familyIds(data.tasks,rootId(data.tasks,occurrence.task.id));
  const stamp=editedAt(data);
  return {...data,tasks:data.tasks.map(task=>family.has(task.id)?{...task,end:task.end&&task.end<occurrence.originalDate?task.end:addDays(occurrence.originalDate,-1),deleted:task.start>=occurrence.originalDate,updatedAt:stamp}:task)};
}
export function reorderOccurrence(data: Data, occurrence: Occurrence, order: number): Data { return setOverride(data,{...makeOverride(occurrence),order}); }
export function exampleWeek(data: Data, start: string): Data {
  const daily=[0,1,2,3,4,5,6];
  return [{title:'Medication',time:'07:30',weekdays:daily},{title:'Skincare',time:'08:00',weekdays:daily},
    {title:'Gym',time:'08:00',weekdays:[1,3,5]},{title:'Lunch',time:'12:00',weekdays:daily},
    {title:'Read a few pages',time:'21:30',weekdays:daily},{title:'Plan next week',time:'18:00',weekdays:[0]}]
    .reduce((result,row)=>addTask(result,{...row,start,end:null,notes:'',reminder:null}),data);
}
export { mergeData } from './merge';
export class StaleOccurrenceError extends Error{constructor(){super('This routine changed in another tab or device. Close this sheet and reopen the task to edit its current version.');this.name='StaleOccurrenceError';}}
