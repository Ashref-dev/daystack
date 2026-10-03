import Dexie, { type Table } from 'dexie';
import { dataSchema, emptyData,ownerIdSchema, type Data } from './model';
import { mergeData } from './domain';
type Snapshot = { id: string; data: Data; revision: number; syncedRevision: number };
class FolioDatabase extends Dexie {
  snapshots: Table<Snapshot,string>;
  constructor() { super('folio'); this.version(1).stores({snapshots:'id'}); this.snapshots=this.table('snapshots'); }
}
const db = new FolioDatabase();
export async function loadData(): Promise<Data> {
  const saved=await db.snapshots.get('local');let data=saved?dataSchema.parse(saved.data):emptyData();
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);if(!key?.startsWith('folio-journal:'))continue;
    const journal=localStorage.getItem(key);if(journal)data=mergeData(data,dataSchema.parse(JSON.parse(journal)),true);
  }
  return data;
}
export async function persistData(data: Data,replace=false): Promise<Data> {
  return db.transaction('rw',db.snapshots,async()=>{
    const previous=await db.snapshots.get('local');
    const stored=previous?dataSchema.parse(previous.data):null;
    if(stored&&stored.ownerId!==data.ownerId)return stored;
    if(stored&&stored.resetAt>data.resetAt)return stored;
    const merged=stored&&!replace?mergeData(data,stored,true):data;
    if(replace&&data.resetAt>(stored?.resetAt??0)&&data.ownerId)await db.snapshots.bulkDelete([`archive:${data.ownerId}`,`baseline:${data.ownerId}`]);
    await db.snapshots.put({id:'local',data:merged,revision:(previous?.revision??0)+1,syncedRevision:previous?.syncedRevision??0});
    return merged;
  });
}
export async function pendingSync(): Promise<boolean> { const row=await db.snapshots.get('local'); return !!row && row.revision>row.syncedRevision; }
export async function markSynced(revision:number,ownerId:string): Promise<void> {const current=await db.snapshots.get('local');if(current?.data.ownerId===ownerId)await db.snapshots.update('local',{syncedRevision:Math.min(revision,current.revision)});}
export async function revision(): Promise<number> { return (await db.snapshots.get('local'))?.revision??0; }
export async function activateOwner(ownerId:string):Promise<Data>{
  const owner=ownerIdSchema.parse(ownerId);
  return db.transaction('rw',db.snapshots,async()=>{
    const previous=await db.snapshots.get('local');const stored=previous?dataSchema.parse(previous.data):null;
    if(stored?.ownerId===ownerId)return stored;
    if(previous&&stored?.ownerId)await db.snapshots.put({...previous,data:stored,id:`archive:${stored.ownerId}`});
    const archived=await db.snapshots.get(`archive:${ownerId}`);
    const data=archived?dataSchema.parse(archived.data):(stored&&!stored.ownerId?{...stored,ownerId:owner}:{...emptyData(),ownerId:owner});
    await db.snapshots.put({id:'local',data,revision:0,syncedRevision:0});return data;
  });
}
export async function syncBaseline(ownerId:string):Promise<Data|null>{const row=await db.snapshots.get(`baseline:${ownerId}`);return row?dataSchema.parse(row.data):null;}
export async function storeBaseline(data:Data):Promise<void>{await db.snapshots.put({id:`baseline:${data.ownerId}`,data,revision:0,syncedRevision:0});}
