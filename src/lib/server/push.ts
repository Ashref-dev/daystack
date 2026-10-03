import * as privateEnv from '$app/env/private';
import * as publicEnv from '$app/env/public';
import { createHash, ECDH, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import ky from 'ky';
import { z } from 'zod';
import { getOccurrences } from '../domain';
import type { Data, Occurrence } from '../model';

const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const publicKey = base64url.refine(value => {
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== 65 || bytes[0] !== 4) return false;
  try { ECDH.convertKey(bytes, 'prime256v1'); return true; }
  catch (cause) { if (cause instanceof Error) return false; throw cause; }
}, 'Invalid P-256 public key');

export const endpointSchema = z.url().max(2048).refine(value => {
  const url = new URL(value);
  const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
  return url.protocol === 'https:' && (!url.port || url.port === '443') &&
    !url.username && !url.password && !url.hash &&
    (allowed.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com'));
}, 'Unsupported push service');
export const timezoneSchema = z.string().min(1).max(100).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch (cause) { if (cause instanceof RangeError) return false; throw cause; }
}, 'Invalid IANA timezone');
export const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  expirationTime: z.number().nonnegative().nullable().optional(),
  keys: z.object({ p256dh: publicKey, auth: base64url.refine(value => Buffer.from(value, 'base64url').length === 16) }).strict()
}).strict();
export const subscriptionRowSchema = z.object({
  id: z.uuid(), user_id: z.uuid(), endpoint: endpointSchema,
  keys: subscriptionSchema.shape.keys, timezone: timezoneSchema
});
const supabaseSchema = z.object({ PUBLIC_SUPABASE_URL: z.url(), PUBLIC_SUPABASE_ANON_KEY: z.string().min(1) });
const vapidSchema = z.object({
  PUBLIC_VAPID_KEY: publicKey,
  VAPID_PRIVATE_KEY: base64url.refine(value => Buffer.from(value, 'base64url').length === 32),
  VAPID_SUBJECT: z.url().refine(value => value.startsWith('mailto:') || value.startsWith('https:'))
});
export function pushConfiguration() {
  return supabaseSchema.extend(vapidSchema.shape).extend({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), REMINDERS_CRON_SECRET: z.string().min(32).max(512)
  }).safeParse({ ...publicEnv, ...privateEnv });
}
export function userConfiguration() { return supabaseSchema.safeParse(publicEnv); }
export function subscriptionConfiguration() { return vapidSchema.safeParse({ ...publicEnv, ...privateEnv }); }
export function database(url: string, key: string, token?: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: Object.assign(
        (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
          ky(input, { ...init, timeout: 10000, retry: 0, throwHttpErrors: false }),
        { preconnect: globalThis.fetch.preconnect }
      )
    }
  });
}
export function secretMatches(candidate: string, secret: string): boolean {
  if (secret.length < 32 || secret.length > 512 || candidate.length > 512) return false;
  return timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(secret).digest());
}
export async function requestBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') error(415, 'JSON required');
  if (!request.body) error(400, 'Request body required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); error(413, 'Request body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (cause) { if (cause instanceof SyntaxError) error(400, 'Invalid JSON'); throw cause; }
}

export type DueReminder = Readonly<{ key: string; occurrence: Occurrence }>;
export function dueReminders(data: Data, timezone: string, now: Date): readonly DueReminder[] {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const due = new Map<string, DueReminder>();
  const leads = new Set(data.tasks.flatMap(task => task.reminder === null ? [] : [task.reminder]));
  for (let minute = 0; minute < 5; minute++) {
    for (const lead of leads) {
      const target = new Date(Math.floor(now.getTime() / 60000) * 60000 + (lead - minute) * 60000);
      const parts = new Map(formatter.formatToParts(target).map(part => [part.type, part.value]));
      const date = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
      const time = `${parts.get('hour')}:${parts.get('minute')}`;
      for (const occurrence of getOccurrences(data, date)) {
        if (occurrence.completedAt !== null || occurrence.task.reminder !== lead || occurrence.time !== time) continue;
        const key = createHash('sha256').update(`${occurrence.key}|${date}|${time}|${lead}`).digest('hex');
        due.set(key, { key, occurrence });
      }
    }
  }
  return [...due.values()];
}
