import { app, commit, saved,activateAccount } from './state.svelte';
import { cloudClient, syncData } from './cloud';
import { mergeData } from './domain';
export const syncState=$state({busy:false,email:'',userId:'',accountMismatch:false,message:'',lastSync:''});
export async function syncNow():Promise<void> {
  if(!app.online||syncState.busy)return;const client=await cloudClient();if(!client)return;
  const {data:{session}}=await client.auth.getSession();syncState.email=session?.user.email??'';syncState.userId=session?.user.id??'';if(!session)return;
  if(app.data.ownerId&&app.data.ownerId!==session.user.id){syncState.accountMismatch=true;syncState.message='This device has another account’s private week. Keep the accounts separate before syncing.';return;}
  syncState.accountMismatch=false;
  syncState.busy=true;syncState.message='';
  try {
    await saved();if(!app.data.ownerId)await activateAccount(session.user.id);const local=$state.snapshot(app.data);const merged=await syncData(local);
    const result=mergeData($state.snapshot(app.data),merged);
    if(JSON.stringify(result)!==JSON.stringify(app.data)){commit(result);await saved();}
    syncState.lastSync=new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});syncState.message='Synced securely';
  }catch(error){syncState.message=error instanceof Error?`Saved locally. ${error.message}`:'Saved locally. Sync will try again when connected.';}
  finally{syncState.busy=false;}
}
