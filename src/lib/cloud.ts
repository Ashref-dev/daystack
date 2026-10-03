import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$app/env/public';
import { dataSchema,ownerIdSchema, type Data } from './model';
import { mergeForSync } from './merge';
import { markSynced, revision,syncBaseline,storeBaseline } from './database';
let client:SupabaseClient|null=null;
let loading:Promise<SupabaseClient>|null=null;
export async function cloudClient():Promise<SupabaseClient|null> {
  if(!PUBLIC_SUPABASE_URL||!PUBLIC_SUPABASE_ANON_KEY) return null;
  loading??=import('@supabase/supabase-js').then(({createClient})=>createClient(PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_ANON_KEY));
  client??=await loading;return client;
}
export async function syncData(local:Data):Promise<Data> {
  const supabase=await cloudClient(); if(!supabase) return local;
  const {data:{session}}=await supabase.auth.getSession();if(!session)return local;
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError) throw authError; if(!user) return local;
  if(local.ownerId!==user.id)throw new AccountOwnershipError();
  const currentRevision=await revision();
  const {data:remote,error}=await supabase.from('folio_backups').select('payload,revision').eq('user_id',user.id).maybeSingle();
  if(error) throw error;
  const baseline=await syncBaseline(user.id);
  const merged=remote?mergeForSync(local,{...dataSchema.parse(remote.payload),ownerId:ownerIdSchema.parse(user.id)},baseline):local;
  const nextRevision=(remote?.revision??0)+1;
  if(remote) {
    const {data:updated,error:updateError}=await supabase.from('folio_backups').update({payload:merged,revision:nextRevision,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('revision',remote.revision).select('revision');
    if(updateError) throw updateError;
    if(!updated?.length) throw new SyncConflictError();
  } else {
    const {error:insertError}=await supabase.from('folio_backups').insert({user_id:user.id,payload:merged,revision:nextRevision});
    if(insertError) throw insertError;
  }
  await storeBaseline(merged);await markSynced(currentRevision,user.id); return merged;
}
export class SyncConflictError extends Error { constructor(){super('Another device saved at the same time. Your changes are safe. Sync again to merge.');} }
export class AccountOwnershipError extends Error{constructor(){super('This local week belongs to another account. Keep your accounts separate before syncing.');}}
