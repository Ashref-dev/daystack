import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import webPush from 'web-push';
const { sendNotification, WebPushError } = webPush;
import { dataSchema } from '../../../lib/model';
import type { Data } from '../../../lib/model';
import { database, dueReminders, pushConfiguration, secretMatches, subscriptionRowSchema } from '../../../lib/server/push';

const headers = { 'cache-control': 'no-store' } as const;

export const POST: RequestHandler = async ({ request }) => {
  const configuration = pushConfiguration();
  if (!configuration.success) return json({ error: 'Reminders are not configured' }, { status: 503, headers });
  const config = configuration.data;
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || !secretMatches(authorization.slice(7), config.REMINDERS_CRON_SECRET)) {
    return json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const client = database(config.PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const deadline = now.getTime() + 45000;
  const backups = new Map<string, Data | null>();
  const counts = { subscriptions: 0, delivered: 0, skipped: 0, failed: 0, expired: 0, invalid: 0 };
  let cursor: string | undefined;
  while (true) {
    let query = client.from('folio_push_subscriptions').select('id,user_id,endpoint,keys,timezone').order('id').limit(100);
    if (cursor) query = query.gt('id', cursor);
    const page = await query;
    if (page.error) return json({ error: 'Subscription query failed', ...counts }, { status: 503, headers });
    const rows = z.array(z.unknown()).safeParse(page.data);
    if (!rows.success) return json({ error: 'Invalid subscription response', ...counts }, { status: 503, headers });
    if (!rows.data.length) return json({ ok: true, ...counts }, { headers });
    for (const raw of rows.data) {
      if (Date.now() >= deadline) return json({ error: 'Run budget exhausted; retry required', ...counts }, { status: 503, headers });
      const identity = z.object({ id: z.uuid() }).safeParse(raw);
      if (!identity.success) return json({ error: 'Invalid subscription identity', ...counts }, { status: 503, headers });
      cursor = identity.data.id;
      const parsed = subscriptionRowSchema.safeParse(raw);
      if (!parsed.success) { counts.invalid++; continue; }
      const subscription = parsed.data;
      counts.subscriptions++;
      if (!backups.has(subscription.user_id)) {
        const backup = await client.from('folio_backups').select('payload').eq('user_id', subscription.user_id).maybeSingle();
        if (backup.error) return json({ error: 'Backup query failed', ...counts }, { status: 503, headers });
        const payload = z.object({ payload: dataSchema }).safeParse(backup.data);
        backups.set(subscription.user_id, payload.success ? payload.data.payload : null);
      }
      const data = backups.get(subscription.user_id);
      if (!data) { counts.invalid++; continue; }
      for (const reminder of dueReminders(data, subscription.timezone, now)) {
        if (Date.now() >= deadline) return json({ error: 'Run budget exhausted; retry required', ...counts }, { status: 503, headers });
        const receipt = { subscription_id: subscription.id, reminder_key: reminder.key };
        const claim = await client.from('folio_reminder_receipts').insert(receipt);
        if (claim.error?.code === '23505') { counts.skipped++; continue; }
        if (claim.error) return json({ error: 'Receipt claim failed', ...counts }, { status: 503, headers });
        let delivered = false;
        let expired = false;
        try {
          await sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, JSON.stringify({
            title: 'Folio reminder', body: reminder.occurrence.title,
            tag: reminder.key, url: `/?date=${reminder.occurrence.date}`
          }), {
            vapidDetails: { subject: config.VAPID_SUBJECT, publicKey: config.PUBLIC_VAPID_KEY, privateKey: config.VAPID_PRIVATE_KEY },
            TTL: 300, urgency: 'high', timeout: 5000, topic: reminder.key.slice(0, 32)
          });
          delivered = true;
        } catch (cause) {
          if (cause instanceof WebPushError) expired = cause.statusCode === 404 || cause.statusCode === 410;
          else if (!(cause instanceof Error)) throw cause;
        }
        if (expired) {
          const removed = await client.from('folio_push_subscriptions').delete().eq('id', subscription.id);
          if (removed.error) return json({ error: 'Expired subscription cleanup failed', ...counts }, { status: 503, headers });
          counts.expired++;
          break;
        }
        const updated = await client.from('folio_reminder_receipts').update({
          status: delivered ? 'delivered' : 'failed', delivered_at: delivered ? new Date().toISOString() : null
        }).eq('subscription_id', subscription.id).eq('reminder_key', reminder.key);
        if (updated.error) return json({ error: 'Receipt update failed', ...counts }, { status: 503, headers });
        if (delivered) counts.delivered++; else counts.failed++;
      }
    }
  }
};
