import { defineEnvVars } from '@sveltejs/kit/env';
import { publicSupabaseUrl,publicSupabaseKey,publicVapidKey } from '#lib/public-config.ts';
export const variables=defineEnvVars({
  PUBLIC_SUPABASE_URL:{public:true,schema:publicSupabaseUrl},
  PUBLIC_SUPABASE_ANON_KEY:{public:true,schema:publicSupabaseKey},
  PUBLIC_VAPID_KEY:{public:true,schema:publicVapidKey},
  SUPABASE_SERVICE_ROLE_KEY:{schema:(value)=>value??''},
  VAPID_PRIVATE_KEY:{schema:(value)=>value??''},
  VAPID_SUBJECT:{schema:(value)=>value??''},
  REMINDERS_CRON_SECRET:{schema:(value)=>value??''}
});
