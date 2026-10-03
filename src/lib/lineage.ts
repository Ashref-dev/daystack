import type { Task } from './model';
export function familyIds(tasks:Task[],id:string):Set<string>{
  const ids=new Set([id]);let changed=true;
  while(changed){changed=false;for(const task of tasks)if(task.parentId&&ids.has(task.parentId)&&!ids.has(task.id)){ids.add(task.id);changed=true;}}
  return ids;
}
export function rootId(tasks:Task[],id:string):string{
  let current=id;const visited=new Set<string>();
  while(!visited.has(current)){visited.add(current);const parent=tasks.find(task=>task.id===current)?.parentId;if(!parent)return current;current=parent;}
  return [...visited].sort()[0]??id;
}
export function currentVersion(tasks:Task[],id:string,date:string):Task|undefined{
  const root=rootId(tasks,id);
  return tasks.filter(task=>task.start<=date&&rootId(tasks,task.id)===root).toSorted((a,b)=>b.splitAt-a.splitAt||b.updatedAt-a.updatedAt||Number(a.deleted)-Number(b.deleted)||b.id.localeCompare(a.id))[0];
}
