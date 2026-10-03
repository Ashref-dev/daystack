import type { Data,Task } from './model';
import { addDays } from './dates';
import { familyIds,rootId } from './lineage';
import { latestBy } from './records';
function mergeRows<T extends {id:string;updatedAt:number}>(a:T[],b:T[]):T[]{
  return latestBy([...a,...b]);
}
export function mergeData(local:Data,remote:Data,mergeSettings=false):Data{
  if(local.ownerId!==remote.ownerId)return local;
  if(local.resetAt!==remote.resetAt)return local.resetAt>remote.resetAt?local:{...remote,settings:local.settings};
  let tasks=mergeRows(local.tasks,remote.tasks);
  let overrides=mergeRows(local.overrides,remote.overrides);let completions=mergeRows(local.completions,remote.completions);
  const successors=new Map<string,Task[]>();
  for(const task of tasks){if(task.parentId&&!task.deleted){const key=`${task.parentId}:${task.start}`;const group=successors.get(key)??[];successors.set(key,[...group,task]);}}
  for(const candidates of successors.values()){
    const group=candidates.filter(candidate=>!tasks.find(task=>task.id===candidate.id)?.deleted);
    if(group.length<2)continue;
    const winner=group.toSorted((a,b)=>b.splitAt-a.splitAt||b.updatedAt-a.updatedAt||b.id.localeCompare(a.id))[0];if(!winner?.parentId)continue;
    const parentId=winner.parentId;
    const loserIds=new Set(group.filter(task=>task.id!==winner.id).flatMap(task=>[...familyIds(tasks,task.id)].filter(id=>(tasks.find(row=>row.id===id)?.splitAt??0)<=winner.splitAt)));
    tasks=tasks.map(task=>loserIds.has(task.id)?{...task,deleted:true,updatedAt:winner.updatedAt}:task);
    overrides=mergeRows([],overrides.map(row=>{if(!loserIds.has(row.taskId))return row;const target=row.date>=winner.start?winner.id:parentId;return {...row,id:`${target}:${row.date}`,taskId:target};}));
    completions=mergeRows([],completions.map(row=>{if(!loserIds.has(row.taskId))return row;const target=row.date>=winner.start?winner.id:parentId;return {...row,id:`${target}:${row.date}`,taskId:target};}));
  }
  const settings=mergeSettings&&remote.settings.updatedAt>local.settings.updatedAt?remote.settings:local.settings;
  return {...local,settings,tasks,overrides,completions,conflicts:mergeRows(local.conflicts,remote.conflicts)};
}
export function mergeForSync(local:Data,remote:Data,baseline:Data|null):Data{
  if(local.ownerId!==remote.ownerId||local.resetAt!==remote.resetAt)return mergeData(local,remote);
  let protectedLocal=local;let protectedRemote=remote;
  for(const task of local.tasks){
    const incoming=remote.tasks.find(row=>row.id===task.id);if(!incoming)continue;
    const before=baseline?.tasks.find(row=>row.id===task.id);
    if(task.updatedAt<=(before?.updatedAt??-1)||incoming.updatedAt<=(before?.updatedAt??-1))continue;
    const splitHere=local.tasks.some(row=>row.parentId===task.id&&!row.deleted&&row.start===addDays(task.end??task.start,1));
    const splitThere=remote.tasks.some(row=>row.parentId===task.id&&!row.deleted&&row.start===addDays(incoming.end??incoming.start,1));
    const deletedHere=task.deleted||!!(task.end&&(!before?.end||task.end<before.end)&&!splitHere);
    const deletedThere=incoming.deleted||!!(incoming.end&&(!before?.end||incoming.end<before.end)&&!splitThere);
    if(deletedHere===deletedThere)continue;
    const kept=deletedHere?incoming:task;const proposed=deletedHere?task:incoming;
    const stamp=Math.max(task.updatedAt,incoming.updatedAt)+1;
    const conflict={kind:'task' as const,id:task.id,proposed,resolved:false,updatedAt:stamp};
    protectedLocal={...protectedLocal,tasks:protectedLocal.tasks.map(row=>row.id===task.id?{...kept,updatedAt:stamp}:row),conflicts:[...protectedLocal.conflicts.filter(row=>row.id!==task.id),conflict]};
    protectedRemote={...protectedRemote,tasks:protectedRemote.tasks.map(row=>row.id===task.id?{...kept,updatedAt:stamp}:row)};
  }
  const localKey=(row:{taskId:string;date:string})=>`${rootId(local.tasks,row.taskId)}:${row.date}`;
  const remoteKey=(row:{taskId:string;date:string})=>`${rootId(remote.tasks,row.taskId)}:${row.date}`;
  const baselineKey=(row:{taskId:string;date:string})=>`${rootId(baseline?.tasks??[],row.taskId)}:${row.date}`;
  for(const row of latestBy(local.overrides,localKey)){
    const key=localKey(row);const incoming=latestBy(remote.overrides,remoteKey).find(item=>remoteKey(item)===key);if(!incoming||row.excluded===incoming.excluded)continue;
    const before=baseline?.overrides.find(item=>baselineKey(item)===key);
    if(row.updatedAt<=(before?.updatedAt??-1)||incoming.updatedAt<=(before?.updatedAt??-1))continue;
    const kept=row.excluded?incoming:row;const proposed=row.excluded?row:incoming;const stamp=Math.max(row.updatedAt,incoming.updatedAt)+1;
    const conflict={kind:'occurrence' as const,id:key,proposed,resolved:false,updatedAt:stamp};
    protectedLocal={...protectedLocal,overrides:[...protectedLocal.overrides.filter(item=>localKey(item)!==key),{...kept,updatedAt:stamp}],conflicts:[...protectedLocal.conflicts.filter(item=>item.id!==key),conflict]};
    protectedRemote={...protectedRemote,overrides:[...protectedRemote.overrides.filter(item=>remoteKey(item)!==key),{...kept,updatedAt:stamp}]};
  }
  return mergeData(protectedLocal,protectedRemote);
}
export function resolveConflict(data:Data,id:string,remove:boolean):Data{
  const conflict=data.conflicts.find(row=>row.id===id);if(!conflict)return data;
  const stamp=[...data.tasks,...data.overrides,...data.completions].reduce((value,row)=>Math.max(value,row.updatedAt+1),Math.max(Date.now(),conflict.updatedAt)+1);
  const conflicts=data.conflicts.map(row=>row.id===id?{...row,resolved:true,updatedAt:stamp}:row);
  if(!remove)return {...data,conflicts};
  switch(conflict.kind){
    case 'occurrence':return {...data,conflicts,overrides:latestBy([...data.overrides,{...conflict.proposed,updatedAt:stamp}])};
    case 'task':{
      const family=familyIds(data.tasks,rootId(data.tasks,id));const proposal=conflict.proposed;
      const cutoff=proposal.end?addDays(proposal.end,1):null;
      const tasks=data.tasks.map(task=>task.id===id?{...proposal,updatedAt:stamp}:family.has(task.id)&&(proposal.deleted||!!cutoff)?{...task,end:cutoff?addDays(cutoff,-1):task.end,deleted:proposal.deleted||!!(cutoff&&task.start>=cutoff),updatedAt:stamp}:task);
      return {...data,tasks,conflicts};
    }
    default:{const exhaustive:never=conflict;return exhaustive;}
  }
}
