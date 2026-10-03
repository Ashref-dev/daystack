# Background reminders

Folio can send encrypted Web Push from its server while the app is closed. This is
optional infrastructure, **not** an in-browser timer and **not** an automatic
scheduler. No credentials, database migration, or deployed scheduler are included.
Local-only users cannot receive server reminders: delivery reads their latest
synced `folio_backups.payload`, not unsynced browser data.

## Deployment checklist

1. Apply `supabase/schema.sql` using the Supabase SQL editor or a trusted migration
   connection. Enable Supabase Auth and configure the app's sign-in redirect URLs.
   The schema creates backups, subscriptions, and delivery receipts; backup and
   subscription RLS restrict authenticated users to `auth.uid() = user_id`.
   Anonymous access is revoked. Receipts have no client policy or client grants;
   only the server's service role can claim or update them.
2. For an existing database, review other policies before applying: PostgreSQL
   permissive policies combine with OR. This migration replaces only its own named
   policies and does not remove unrelated policies or migrate incompatible tables.
3. Generate a VAPID pair once with `bunx web-push generate-vapid-keys`. Store the
   private key in server secret storage, never in source, browser code, or logs.
   Keep the pair stable; rotating it requires browsers to resubscribe.
4. Declare the following in Kit 3 `src/env.ts`, then supply values in the server
   deployment environment. Explicit optional validators keep features disabled when
   values are absent (`default` is not an installed Kit 3 `EnvVarConfig` option):

   ```ts
   PUBLIC_VAPID_KEY: { public: true, schema: (value) => value ?? '' },
   SUPABASE_SERVICE_ROLE_KEY: { schema: (value) => value ?? '' },
   VAPID_PRIVATE_KEY: { schema: (value) => value ?? '' },
   VAPID_SUBJECT: { schema: (value) => value ?? '' },
   REMINDERS_CRON_SECRET: { schema: (value) => value ?? '' },
   ```

   Existing `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` need the same
   optional `schema` validator for local-only builds, and must be set for cloud use.
   Use the generated public/private VAPID pair, a real contact such as
   `mailto:operator@example.com` for `VAPID_SUBJECT`, and a high-entropy cron secret
   of 32–512 characters (for example `openssl rand -hex 32`). Length alone does not
   establish entropy. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must stay private.
   In the installed Kit 3 release, private values come from `$app/env/private`,
   not legacy `$env` modules or the internal `$app/env/server` runtime-state module.
   Only the public VAPID key belongs in browser subscribe calls.
5. Deploy a server-capable Node/Bun adapter, not a static-only site. Supply outbound
   HTTPS access to Supabase and the push providers. Use HTTPS for the browser;
   Web Push requires service workers and notification permission. On iOS/iPadOS,
   users must install the web app on the Home Screen before enabling push.
6. Integrate the browser controls and service-worker handlers described below.
7. Configure an external scheduler to POST every minute. Monitor its responses.
   Configure reverse-proxy request/body/time limits and per-user/IP rate limiting
   for subscription writes; authentication is not abuse prevention.

## Browser API contract

All subscription requests use `Authorization: Bearer <Supabase access_token>` and
`Content-Type: application/json`. The route verifies the token by calling
`supabase.auth.getUser(token)`, then writes with that user's JWT so RLS also applies.
It never trusts a client-supplied user ID. JSON bodies are capped at 8 KiB.

**POST `/api/push`** saves or refreshes a device subscription:

```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/<browser-issued-token>",
    "expirationTime": null,
    "keys": { "p256dh": "<browser-public-key>", "auth": "<browser-auth-secret>" }
  },
  "timezone": "Europe/Paris"
}
```

Use `subscription.toJSON()` from
`registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
Send `Intl.DateTimeFormat().resolvedOptions().timeZone`; repeat the POST after sign-in
and when the device timezone changes. The server cannot learn travel/timezone changes
while the app stays closed. Each account can register multiple devices.

**DELETE `/api/push`**, body `{ "endpoint": "<same endpoint>" }`, removes that
account's registration. It is idempotent and remains available without VAPID config.
Call it **before** Supabase sign-out, then `subscription.unsubscribe()` locally.
Remove the old account's registration before switching accounts on a shared browser;
otherwise it can continue receiving that account's reminders. Removing one device
does not remove other devices. An expired token must be refreshed before retrying.

Successful requests return `{ "ok": true }`; missing/invalid auth returns 401,
invalid input 400, oversized body 413, unsupported content type 415, and unavailable
configuration/storage 503. Responses are non-cacheable. POST does not send a test push.

Allowed endpoint hosts are `fcm.googleapis.com`,
`updates.push.services.mozilla.com`, `web.push.apple.com`, and subdomains of
`notify.windows.com`, with HTTPS on the default/443 port and no URL credentials.
Arbitrary destinations are deliberately rejected to prevent SSRF, including when
the cron reads directly-written database rows. A new provider needs an explicit,
reviewed allowlist update. Never add a wildcard or arbitrary user-configured URL.

The service worker must handle a JSON push payload:

```json
{ "title": "Folio reminder", "body": "Task title", "tag": "<receipt hash>", "url": "/?date=2026-10-04" }
```

Call `event.waitUntil(registration.showNotification(...))` on push; use `tag` for
notification replacement, store `url` in notification data, and handle
`notificationclick` by focusing/opening a **same-origin** URL. Do not fetch task data
from the push provider. Task notes are never sent. Titles are sent encrypted to the
push service but are visible on the device's notification screen; explain that
privacy trade-off before enabling reminders. Neither endpoint logs task content,
subscription keys, provider error bodies, or secrets.

## Scheduler

Run once per minute against your deployed origin, with the secret in the header,
never in the URL. Example command for a scheduler with protected environment values:

```sh
curl --fail-with-body --silent --show-error --max-time 90 \
  -X POST "$FOLIO_ORIGIN/api/reminders" \
  -H "Authorization: Bearer $REMINDERS_CRON_SECRET"
```

Use a scheduler capable of custom authorization headers (a VPS cron job, managed
HTTP scheduler, or Supabase scheduled function). A plain unauthenticated scheduled
GET will not work. Do not expose the secret in a public workflow or shell tracing.
No database extension or hosted scheduler is enabled by this schema.

The cron uses a SHA-256 digest plus `timingSafeEqual` for secret comparison. Missing
configuration returns 503; a wrong secret returns 401. It takes server time, not a
client-supplied date. Responses contain only aggregate counters: `subscriptions`,
`delivered`, `skipped`, `failed`, `expired`, `invalid`. Alert on `failed > 0`,
`invalid > 0`, and any non-2xx. A 200 with failed deliveries is not an all-clear.

Delivery uses the shared `getOccurrences` domain logic, including moved/excluded
occurrences, overrides, deletions, and completions. A task must have a time and a
non-null reminder; null means disabled, and zero means at the task time. Default
reminders must already have been copied into tasks by the composer. Dates/times are
floating in each subscription's stored IANA timezone. The current minute and four
preceding minutes are checked, including reminders crossing midnight. Spring-forward
nonexistent local times do not fire; fall-back repeated times use the same receipt
and fire at most once. Changing the lead/time/date produces a new reminder key.

Subscriptions are read in UUID-keyset pages of 100, and backups are cached per run.
Each run has a 45-second processing budget; upstream requests have bounded timeouts
but can extend wall time past that budget. On budget exhaustion, the route returns
503 with counters; schedule an immediate retry. Already-claimed reminders are
skipped. For large installations, replace the synchronous sweep with sharded jobs
or a durable queue; repeated short-budget sweeps are not a scalable scheduler.

## Delivery guarantees and maintenance

The receipt primary key is `(subscription_id, reminder_key)`. An atomic insert claims
the reminder **before** contacting the push service, so overlapping/repeated cron
requests do not submit the same reminder twice for that subscription. Claims are
retained on errors, timeouts, or server crashes. This is **at-most-once submission**,
not exactly-once delivery: a crash after claiming can lose a reminder, and a provider
acceptance only proves submission, not that a notification was shown. The `delivered`
counter/status means provider-accepted. Failed/ambiguous attempts are intentionally
not automatically retried. Inspect counts and receipt status without logging payloads.

Push messages have TTL 300 seconds, high urgency, and a 5-second provider timeout.
404/410 responses delete the expired subscription. Other failures retain the
subscription and a failed receipt. The next occurrence can still be sent. Scheduler
downtime beyond the five-minute lookback loses old reminders instead of delivering
a stale backlog. Unsynced changes and concurrent edits can race with a delivery;
this is not a transactional task execution service.

Do not purge recent claims or reset failed receipts while cron is active: doing so
can create duplicate notifications. Keep receipts at least for the lifetime of the
associated occurrences, or accept that recreating/moving an old occurrence after
purging can send it again. Deleting a subscription cascades its receipts, so explicit
unsubscription/re-subscription during a due window can also allow a fresh submission.
There is no automatic retention job. Configure database backups and monitoring.

Before production, verify with a staging Supabase project: cross-user backup and
subscription RLS, anonymous denial, invalid tokens/secrets, same-minute overlapping
cron calls, midnight/DST reminders, completed/moved occurrences, expired devices,
and a real service-worker notification with the app closed. Local strict checks do
not prove provider delivery or deployment configuration.
