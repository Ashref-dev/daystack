# Folio

Your week, one day at a time. A mobile-first, local-first weekly checklist built with Svelte 5.57.1, SvelteKit 3 and Bun. The working name Daystack became **Folio**.

## Run

```sh
bun install --frozen-lockfile
bun run dev
```

Production:

```sh
bun run build
PORT=5173 HOST=0.0.0.0 bun run start
```

Open `http://localhost:5173`. Localhost supports service workers. Testing from a phone requires HTTPS, not a plain LAN HTTP address.

## What works without configuration

- Today-first seven-day stack, indefinite past/future weeks, date picker, swipe navigation.
- Quick-add, timed tasks, one-offs, daily/weekdays/weekends/custom weekly routines, optional end dates.
- Dated completion, per-instance edits/deletion, future series splitting, moving, pointer/touch dragging, manual ordering for equal times.
- Bulk planner with paste, weekday toggles, duplicates, ordering and future-safe edits.
- IndexedDB persistence plus a synchronous crash/reload recovery journal. Offline shell and fonts are cached after the first successful online load.
- Light/dark/system, Monday/Sunday week start, completion visibility, import/export and confirmed data deletion.
- Manifest, original icons, standalone install, iPhone installation guidance.
- Foreground reminders with explicit notification permission. No first-launch permission prompt.

The initial week is empty. “Try an example week” is optional and clearly user-selected. Example routines begin today, never fabricate past history.

## Cloud sync (optional, real)

1. Create a Supabase project and apply `supabase/schema.sql` in its SQL editor.
2. Configure email magic-link auth. Add your production origin and localhost testing origin to the redirect allowlist.
3. Copy `.env.example` to `.env` and set **only** the project URL and publishable/anon key in `PUBLIC_SUPABASE_*`.
4. Restart the server. Settings exposes email sign-in, sync status and sign-out.

Cloud synchronization merges dated records by edit timestamp, uses optimistic revision checks to prevent simultaneous backup overwrites, retries after connectivity returns and retains local content on errors. A persistent IndexedDB revision records unsynchronized edits. Guest registration merges rather than replaces local tasks. Appearance preferences are device-local.

Series successors retain lineage so concurrent future edits reconcile to one routine rather than duplicate it. Destructive edit/delete conflicts preserve content and expose a review action in Settings. Durable reset generations stop interrupted deletion, stale tabs, in-flight sync or older device snapshots from resurrecting deleted tasks. Account ownership blocks automatic cross-account uploads; explicitly opening another account archives the previous local week and keeps datasets separate.

Task data is private under authenticated row-level security. No telemetry, ads or third-party fonts. Service-role and VAPID private keys must never use a public environment prefix.

## Background reminders

See `docs/REMINDERS.md` for VAPID keys, push subscriptions, server secrets and the authenticated cron scheduler. The implementation is included, but background notifications are not claimed to work until that deployment is configured. All reminder text is sent only to the user’s registered push service.

## Checks

```sh
bun run check
bun run test
bun run build
bunx playwright install chromium webkit
bun run test:e2e
```

E2E checks run against a production server. The offline test stops its own isolated server and reloads the cached app, including WebKit; this avoids Playwright WebKit’s offline-emulation navigation error. It does not skip offline behavior.

## Architecture

`src/lib/domain.ts` generates only the requested date’s occurrences. Tasks with weekday rules are templates; completions and overrides are keyed by `taskId:originalDate`. Moving a recurring instance retains its original identity. Future edits close the prior date range and create a new template; historical completions remain intact. No weekly reset job or infinite future rows.

Dates are explicit local `YYYY-MM-DD` values; times are floating `HH:MM`. Midnight timers, focus and visibility events update today without a reload. Supabase stores an account’s normalized local dataset as a versioned JSONB backup; the browser remains the source of instant interaction.

## Installation and release gates

Use HTTPS in production. iPhone: Safari → Share → Add to Home Screen. Android: browser → Install app. Verify real installed mode, status bars, keyboard behavior and background push on physical devices before a public release. Browser emulation is not physical-device certification.

No cloud project, deployment origin or real-device access was supplied. The local app works independently; live magic-link delivery, cross-device synchronization and push delivery require configuration and real-provider acceptance tests.

Design tokens and component rules are in `DESIGN.md`. Icon sources and provenance are in `scripts/generate-icons.ts` and `static/icons/PROVENANCE.md`.
