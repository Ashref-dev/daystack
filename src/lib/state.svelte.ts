import { emptyData, type Data } from './model';
import { loadData, persistData,activateOwner } from './database';
import { mergeData } from './domain';

export const app = $state({ data:emptyData(), ready:false, error:'', status:'', online:true, saving:false });
let saveChain:Promise<void>=Promise.resolve();
let channel:BroadcastChannel|null=null;
const journalKey=`folio-journal:${crypto.randomUUID()}`;
let mutation=0;
export async function initialize():Promise<void> {
  try { app.data=await loadData(); app.ready=true; }
  catch(error) { app.error=error instanceof Error?`Your local data couldn’t be opened. ${error.message}`:'Your local data couldn’t be opened.'; }
  channel=new BroadcastChannel('folio-updates');
  channel.onmessage=async()=>{ await saveChain; app.data=await loadData(); };
}
export function commit(data:Data,replace=false):void {
  const sequence=++mutation;
  app.data=data; app.saving=true; app.error='';
  const snapshot=$state.snapshot(data);
  const journal=JSON.stringify(snapshot);
  try { localStorage.setItem(journalKey,journal); }
  catch(error){if(error instanceof Error)app.error='Device storage is full. Export a backup before closing Daystack.';else throw error;}
  saveChain=saveChain.then(async()=>{
    try {
      const durable=await persistData(snapshot,replace);
      if(sequence===mutation)app.data=replace?durable:mergeData($state.snapshot(app.data),durable,true);
      if(localStorage.getItem(journalKey)===journal)localStorage.removeItem(journalKey);
      channel?.postMessage('saved'); window.dispatchEvent(new Event('folio-saved'));
    }
    catch(error) { app.error=error instanceof Error?`Couldn’t save on this device. Export a backup before closing. ${error.message}`:'Couldn’t save. Export a backup before closing.'; }
    finally { if(sequence===mutation)app.saving=false; }
  });
}
export async function saved():Promise<void> { await saveChain; }
export async function activateAccount(ownerId:string):Promise<void>{await saved();mutation++;app.data=await activateOwner(ownerId);channel?.postMessage('saved');}
export function announce(message:string):void { app.status=message; }
