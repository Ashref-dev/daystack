import { test,expect } from 'bun:test';
import { dataSchema,emptyData } from './model';
import { addTask } from './domain';
const draft={title:'Routine',notes:'',time:null,start:'2026-10-05',end:null,weekdays:[1],reminder:null};
test('Given duplicate task identities in a backup, when parsing, then import is rejected',()=>{
  const data=addTask(emptyData(),draft);expect(dataSchema.safeParse({...data,tasks:[...data.tasks,...data.tasks]}).success).toBe(false);
});
test('Given a completion pointing to an absent task, when parsing, then import is rejected',()=>{
  const data=emptyData();const taskId=crypto.randomUUID();expect(dataSchema.safeParse({...data,completions:[{id:`${taskId}:2026-10-05`,taskId,date:'2026-10-05',completedAt:100,updatedAt:100}]}).success).toBe(false);
});
test('Given a valid backup, when parsing, then dated data roundtrips intact',()=>{
  const data=addTask(emptyData(),draft);expect(dataSchema.parse(JSON.parse(JSON.stringify(data)))).toEqual(data);
});
