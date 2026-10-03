export class PublicConfigurationError extends Error{
  constructor(readonly field:'url'|'key'|'vapid'){super('Invalid public cloud configuration. Use an HTTPS project URL and only publishable/anon and public VAPID keys. Never put secret keys in public variables.');this.name='PublicConfigurationError';}
}
export function publicSupabaseUrl(value:string|undefined):string{
  if(!value)return '';
  let url:URL;try{url=new URL(value);}catch(cause){if(cause instanceof TypeError)throw new PublicConfigurationError('url');throw cause;}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(local&&url.protocol==='http:')))throw new PublicConfigurationError('url');
  return value;
}
export function publicSupabaseKey(value:string|undefined):string{
  if(!value)return '';
  if(/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value))return value;
  if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))throw new PublicConfigurationError('key');
  const payload=value.split('.')[1];if(!payload)throw new PublicConfigurationError('key');
  let claims:unknown;
  try{claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));}
  catch(cause){if(cause instanceof SyntaxError||cause instanceof DOMException)throw new PublicConfigurationError('key');throw cause;}
  if(typeof claims!=='object'||claims===null||!('role'in claims)||claims.role!=='anon')throw new PublicConfigurationError('key');
  return value;
}
export function publicVapidKey(value:string|undefined):string{
  if(!value)return '';
  let bytes:string;
  try{bytes=atob(value.replace(/-/g,'+').replace(/_/g,'/'));}
  catch(cause){if(cause instanceof DOMException)throw new PublicConfigurationError('vapid');throw cause;}
  if(bytes.length!==65||bytes.charCodeAt(0)!==4)throw new PublicConfigurationError('vapid');
  return value;
}
