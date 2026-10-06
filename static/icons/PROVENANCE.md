# Daystack icon provenance

- Artwork: original vector geometry authored in `scripts/generate-icons.ts`: an orange check tile with a ghost outline tile behind it, matching `static/og.png`.
- No logos, fonts, traced images, stock assets, or AI-generated imagery.
- Palette from DESIGN.md: paper cream, orange completion accent.
- Rasterized locally with sharp (librsvg). Regenerate with `bun scripts/generate-icons.ts` (overwrites every file below plus `static/favicon.svg` and `static/favicon.ico`).
- `static/og.png` (1200x630) is the light "Done today. Fresh tomorrow." share image, set in Instrument Serif and Instrument Sans.

| File | Size | Purpose |
|---|---|---|
| icon-master.svg | vector, 1024 canvas | source of truth |
| icon-1024.png | 1024x1024 | master raster, opaque full-bleed |
| icon-512.png, icon-192.png | 512, 192 | manifest `any`, rounded tile |
| apple-touch-icon.png | 180x180 | iOS home screen, opaque full-bleed |
| icon-maskable-512.png | 512x512 | manifest `maskable`, artwork within the safe zone |
| favicon-16.png, favicon-32.png | 16, 32 | raster tab icons |
| ../favicon.svg, ../favicon.ico | vector / 16-48 | browser tab, flat tile tuned for small sizes |
