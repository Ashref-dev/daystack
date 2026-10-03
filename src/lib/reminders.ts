import ky from 'ky';
import { PUBLIC_VAPID_KEY } from '$app/env/public';
import { cloudClient } from './cloud';
import { getOccurrences } from './domain';
import { addDays, localDate, parseDate } from './dates';
import type { Data } from './model';
export const backgroundPushConfigured=!!PUBLIC_VAPID_KEY;
export async function enablePush():Promise<void> {
  const client=await cloudClient();const session=await client?.auth.getSession();
  const token=session?.data.session?.access_token;
  if(!token)throw new ReminderError('Sign in to enable background reminders.');
  if(!PUBLIC_VAPID_KEY)throw new ReminderError('Background reminders aren’t configured on this installation.');
  if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new ReminderError('Install Folio on your Home Screen to enable push on iPhone.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new ReminderError('Allow notifications in browser settings to receive reminders.');
  const registration=await navigator.serviceWorker.ready;
  const key=Uint8Array.from(atob(PUBLIC_VAPID_KEY.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
  const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await ky.post('/api/push',{json:{subscription:subscription.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},headers:{Authorization:`Bearer ${token}`},retry:0,timeout:15000});
}
export async function disablePush():Promise<void> {
  if(!('serviceWorker' in navigator))return;
  const registration=await navigator.serviceWorker.ready;const subscription=await registration.pushManager.getSubscription();if(!subscription)return;
  const client=await cloudClient();const session=await client?.auth.getSession();const token=session?.data.session?.access_token;
  if(token)await ky.delete('/api/push',{json:{endpoint:subscription.endpoint},headers:{Authorization:`Bearer ${token}`},retry:0,timeout:15000});
  await subscription.unsubscribe();
}
export class ReminderError extends Error { constructor(message:string){super(message);this.name='ReminderError';} }
export async function checkReminders(data:Data):Promise<void> {
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  if(backgroundPushConfigured){const registration=await navigator.serviceWorker?.getRegistration();if(await registration?.pushManager.getSubscription())return;}
  const now=Date.now();const today=localDate();
  const occurrences=[...getOccurrences(data,today),...getOccurrences(data,addDays(today,1))];
  for(const item of occurrences){
    if(!item.time||item.completedAt||item.task.reminder===null)continue;
    const scheduled=parseDate(item.date);const [hour,minute]=item.time.split(':').map(Number);
    scheduled.setHours(hour??0,minute??0,0,0);const due=scheduled.getTime()-item.task.reminder*60000;
    const key=`folio-reminder:${item.key}:${item.time}:${item.task.reminder}`;
    if(now<due||now-due>60000||localStorage.getItem(key))continue;
    const registration=await navigator.serviceWorker?.getRegistration();
    if(registration)await registration.showNotification('Folio reminder',{body:item.title,tag:key,icon:'/icons/icon-192.png',data:{url:`/?date=${item.date}`}});
    else new Notification('Folio reminder',{body:item.title,tag:key,icon:'/icons/icon-192.png'});
    localStorage.setItem(key,String(now));
  }
}
