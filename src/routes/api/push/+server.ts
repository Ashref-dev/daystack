import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { database, endpointSchema, requestBody, subscriptionConfiguration, subscriptionSchema, timezoneSchema, userConfiguration } from '../../../lib/server/push';

const headers = { 'cache-control': 'no-store' } as const;
const registerSchema = z.object({ subscription: subscriptionSchema, timezone: timezoneSchema }).strict();
const removeSchema = z.object({ endpoint: endpointSchema }).strict();

async function authenticated(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [^\s]{1,8192}$/i.test(authorization)) return json({ error: 'Sign in required' }, { status: 401, headers });
  const configuration = userConfiguration();
  if (!configuration.success) return json({ error: 'Cloud sync is not configured' }, { status: 503, headers });
  const token = authorization.slice(7);
  const client = database(configuration.data.PUBLIC_SUPABASE_URL, configuration.data.PUBLIC_SUPABASE_ANON_KEY, token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Invalid or expired access token' }, { status: 401, headers });
  return { client, userId: data.user.id };
}

export const POST: RequestHandler = async ({ request }) => {
  const auth = await authenticated(request);
  if (auth instanceof Response) return auth;
  if (!subscriptionConfiguration().success) return json({ error: 'Push is not configured' }, { status: 503, headers });
  const input = registerSchema.safeParse(await requestBody(request));
  if (!input.success) return json({ error: 'Invalid subscription or timezone' }, { status: 400, headers });
  const { subscription, timezone } = input.data;
  const { error } = await auth.client.from('folio_push_subscriptions').upsert({
    user_id: auth.userId, endpoint: subscription.endpoint, keys: subscription.keys,
    timezone, updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,endpoint' });
  if (error) return json({ error: 'Could not save subscription' }, { status: 503, headers });
  return json({ ok: true }, { headers });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const auth = await authenticated(request);
  if (auth instanceof Response) return auth;
  const input = removeSchema.safeParse(await requestBody(request));
  if (!input.success) return json({ error: 'Invalid endpoint' }, { status: 400, headers });
  const { error } = await auth.client.from('folio_push_subscriptions').delete()
    .eq('user_id', auth.userId).eq('endpoint', input.data.endpoint);
  if (error) return json({ error: 'Could not remove subscription' }, { status: 503, headers });
  return json({ ok: true }, { headers });
};
