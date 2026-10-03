import { z } from 'zod';

export const dateSchema = z.iso.date();
export const taskIdSchema=z.uuid().brand<'TaskId'>();
export const ownerIdSchema=z.uuid().brand<'OwnerId'>();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();
export const taskSchema = z.object({
  id: taskIdSchema, title: z.string().trim().min(1,'Give this task a name.').max(200,'Keep the name under 200 characters.'), notes: z.string().max(4000),
  time: timeSchema, start: dateSchema, end: dateSchema.nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)),
  reminder: z.number().int().min(0).max(60).nullable(), order: z.number(),
  updatedAt: z.number(), deleted: z.boolean(), parentId:taskIdSchema.nullable().default(null),splitAt:z.number().default(0),ruleEnd:dateSchema.nullable().optional()
}).transform(task=>({...task,ruleEnd:task.ruleEnd===undefined?task.end:task.ruleEnd}));
export const overrideSchema = z.object({
  id: z.string(), taskId: taskIdSchema, date: dateSchema,
  title: z.string().trim().min(1).max(200), notes: z.string().max(4000), time: timeSchema,
  movedTo: dateSchema.nullable(), excluded: z.boolean(), order: z.number(), updatedAt: z.number()
});
export const completionSchema = z.object({ id: z.string(), taskId: taskIdSchema, date: dateSchema, completedAt: z.number().nullable(), updatedAt: z.number() });
export const conflictSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('task').default('task'),id:z.uuid(),proposed:taskSchema,resolved:z.boolean(),updatedAt:z.number()}),
  z.object({kind:z.literal('occurrence'),id:z.string(),proposed:overrideSchema,resolved:z.boolean(),updatedAt:z.number()})
]);
export const settingsSchema = z.object({ theme: z.enum(['system','light','dark']), weekStart: z.union([z.literal(0),z.literal(1)]), showCompleted: z.boolean(), hidePastCompleted: z.boolean(), defaultReminder: z.number().nullable(), installDismissed: z.boolean(),updatedAt:z.number().default(0) });
export const dataSchema = z.object({ version: z.literal(1), ownerId:ownerIdSchema.nullable().default(null), resetAt:z.number().default(0), conflicts:z.array(conflictSchema).default([]), tasks: z.array(taskSchema), overrides: z.array(overrideSchema), completions: z.array(completionSchema), settings: settingsSchema }).superRefine((data,context)=>{
  const tasks=new Map(data.tasks.map(task=>[task.id,task]));
  if(tasks.size!==data.tasks.length)context.addIssue({code:'custom',message:'Duplicate task identities',path:['tasks']});
  for(const [name,rows]of [['overrides',data.overrides],['completions',data.completions]] as const){
    if(new Set(rows.map(row=>row.id)).size!==rows.length)context.addIssue({code:'custom',message:'Duplicate occurrence identities',path:[name]});
    for(const row of rows)if(!tasks.has(row.taskId)||row.id!==`${row.taskId}:${row.date}`)context.addIssue({code:'custom',message:'Invalid occurrence reference',path:[name]});
  }
  for(const task of data.tasks){
    const seen=new Set<string>();let current:Task|undefined=task;
    while(current?.parentId){if(seen.has(current.id)||!tasks.has(current.parentId)){context.addIssue({code:'custom',message:'Invalid recurrence lineage',path:['tasks']});break;}seen.add(current.id);current=tasks.get(current.parentId);}
  }
});
export type Task = z.infer<typeof taskSchema>;
export type Override = z.infer<typeof overrideSchema>;
export type Completion = z.infer<typeof completionSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Data = z.infer<typeof dataSchema>;
export type Occurrence = Readonly<{ key: string; task: Task; originalDate: string; date: string; title: string; notes: string; time: string | null; order: number; completedAt: number | null; overridden: boolean }>;
export type Draft = Readonly<{ title: string; notes: string; time: string | null; start: string; end: string | null; weekdays: number[]; reminder: number | null }>;
export const defaultSettings: Settings = { theme:'system', weekStart:1, showCompleted:true, hidePastCompleted:false, defaultReminder:null, installDismissed:false,updatedAt:0 };
export function emptyData(): Data { return { version:1, ownerId:null, resetAt:0, conflicts:[], tasks:[], overrides:[], completions:[], settings:{...defaultSettings} }; }
