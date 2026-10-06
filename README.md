# Daystack

Build your ideal repeating routine once — skincare every day, gym five days a week, medication on Sundays — then open the app, land on today and check things off. Repeats come back fresh the next day. Mobile-first and local-first, built with Svelte 5, SvelteKit 3 and Bun. The app is called **Daystack**.

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

- Today-first seven-day stack that opens on today; past/future weeks via arrows or swipe.
- One floating add button. New tasks default to **every day**; pick any days, Weekdays, Weekends or Once. iOS-style wheel pickers for time and dates; optional end date and note.
- Completion is per date: repeating tasks are never checked off permanently.
- Edit or delete just this day or this and upcoming days (history preserved); change the date to move one occurrence; long-press (touch) or drag (mouse) to move between days or reorder.
- IndexedDB persistence plus a crash/reload recovery journal. Offline shell and fonts are cached after the first online load.
- System light/dark theme, manifest, original icons, standalone install.

Sync, backup import/export and reminder modules remain in `src/lib` but currently have no UI.

## Cloud sync (optional, real)

1. Create a Supabase project and apply `supabase/schema.sql` in its SQL editor.
2. Configure email magic-link auth. Add your production origin and localhost testing origin to the redirect allowlist.
3. Copy `.env.example` to `.env` and set **only** the project URL and publishable/anon key in `PUBLIC_SUPABASE_*`.
4. Restart the server. (The sign-in UI was removed in the distill pass; sync code remains for a future surface.)

Cloud synchronization merges dated records by edit timestamp, uses optimistic revision checks to prevent simultaneous backup overwrites, retries after connectivity returns and retains local content on errors. A persistent IndexedDB revision records unsynchronized edits. Guest registration merges rather than replaces local tasks. Appearance preferences are device-local.

Series successors retain lineage so concurrent future edits reconcile to one routine rather than duplicate it. Destructive edit/delete conflicts preserve content for later review. Durable reset generations stop interrupted deletion, stale tabs, in-flight sync or older device snapshots from resurrecting deleted tasks. Account ownership blocks automatic cross-account uploads; explicitly opening another account archives the previous local week and keeps datasets separate.

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
