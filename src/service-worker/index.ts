import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable, assets } from '$app/manifest';
import { resolve } from '$app/paths';

const CACHE=`folio-${version}`;
const root=resolve('/');
const precache=[...immutable.map(asset=>`${root}${asset.path}`),...assets.filter(asset=>!asset.path.includes('1024')&&!asset.path.includes('master')&&!asset.path.includes('PROVENANCE')).map(asset=>`${root}${asset.path}`)];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll([...precache,'/']);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('folio-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const request=event.request;const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode!=='navigate'&&!precache.includes(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(request.mode!=='navigate'){const cached=await cache.match(request);if(cached)return cached;return fetch(request);}
    try{const response=await fetch(request);if(response.ok)await cache.put('/',response.clone());return response;}
    catch(error){const cached=await cache.match('/');if(cached)return cached;throw error;}
  })());
});
self.addEventListener('push',event=>{event.waitUntil((async()=>{
  if(!event.data)return;
  const payload:unknown=event.data.json();
  if(typeof payload!=='object'||payload===null||!('title' in payload)||!('body' in payload)||typeof payload.title!=='string'||typeof payload.body!=='string')return;
  const tag='tag' in payload&&typeof payload.tag==='string'?payload.tag:'folio-reminder';
  const url='url' in payload&&typeof payload.url==='string'&&payload.url.startsWith('/?date=')?payload.url:'/';
  await self.registration.showNotification(payload.title,{body:payload.body,tag,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url}});
})());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
  const data:unknown=event.notification.data;
  const path=typeof data==='object'&&data!==null&&'url' in data&&typeof data.url==='string'&&data.url.startsWith('/?date=')?data.url:'/';
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=windows[0];if(client){await client.navigate(path);await client.focus();}else await self.clients.openWindow(path);
})());});
