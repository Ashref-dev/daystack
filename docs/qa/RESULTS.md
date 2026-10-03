# Folio verification

## Implemented and exercised

- Latest installed Svelte 5.57.1 and SvelteKit 3.0.0, with Bun 1.4.2.
- Strict Svelte/TypeScript checking: zero errors and warnings. The service worker has its own Web Worker TypeScript configuration.
- 57 domain, boundary and configuration tests: recurrence, dated completion, floating dates, moves, aliases, historical/future splits, concurrent branches, destructive conflict review, account separation, reset generations, malformed import rejection, preference recovery and public-key safety.
- 52 passing production-browser checks across Chromium and iPhone-sized WebKit: real CRUD, recurrence freshness, bulk paste, overrides, movement, pointer drag, history, themes, midnight rollover, actual server-outage offline reload, interrupted reset journal replay, all-sheet accessibility and conflict recovery.
- Final browser checks also cover dialog focus restoration, populated weekday geometry, untimed edits with default reminders, and moved bounded occurrences. Counts are recorded in the final pre-commit review.
- Independent functional review passed the identified regression scope after reproduced failures were fixed.

## Visual evidence

Screenshots in `screenshots/` cover empty and populated weeks plus composer, editor, planner, settings and date picker at 375, 768 and 1280px, including dark mobile states. The first review identified clipped sheet actions, a blank week-start selector, low-contrast checkbox outlines, mismatched field labels and clipped Sunday pills. These were fixed together.

The interface is a real Svelte component tree with shared tokens and primitives, not an image mockup. User-pinned Archivo/Inter typography and the neutral/orange palette were preserved. The Impeccable detector’s sole warning was Inter, which the user explicitly requested.

## Performance

`lighthouse-summary.json` records three real-Chrome runs per mobile/desktop preset against the production server. Reports are generated through the Lighthouse API attached to a Playwright-launched Chrome CDP endpoint, not a Lighthouse CLI browser. Initial medians were 100 Performance, 100 Accessibility, 100 Best Practices and 100 SEO for both presets; final measurements are in the same report paths.

## Limitations, not simulated success

- No Supabase project credentials or public deployment origin were supplied. Live email links, cross-device provider synchronization and background push delivery require configuration and real-provider acceptance tests.
- Real iPhone/Android Home Screen installation, OS status bars, keyboard behavior and background notifications were not physically certified. WebKit tests and visual-viewport handling are useful evidence, not a replacement for those checks.
- The external skill’s no-excuse checker requires TypeScript 7’s unstable API. The app uses TypeScript 6.0.3 because SvelteKit 3 relies on the JS compiler API, which TypeScript 7 no longer exposes. Framework and separate worker type checks remain the applicable compiler gates; no type-suppression comments were introduced.
- Docker packaging is supplied, but no deployment or production TLS/provider delivery is claimed.
