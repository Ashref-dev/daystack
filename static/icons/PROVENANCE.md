# Folio icon provenance

- Artwork: original vector geometry authored for Folio in `scripts/generate-icons.ts`.
  Seven offset ceramic sheets (front sheet lifted, six receding sheets) with an embossed orange check.
- No text, logos, fonts, traced images, stock assets, or AI-generated imagery. No Weekstack or other third-party assets.
- Palette derived from DESIGN.md: ink background, neutral sheet tones, orange #e94d20 completion accent.
- Rasterized locally with sharp 0.35.5 (librsvg 2.63.2); smaller sizes are Lanczos downsamples of the 1024 render.
- Regenerate: `bun scripts/generate-icons.ts` (overwrites every file listed below).

| File | Size | Purpose |
|---|---|---|
| icon-master.svg | vector, 1024 canvas | source of truth |
| icon-1024.png | 1024x1024 | master raster, opaque full-bleed |
| icon-512.png | 512x512 | manifest `any`, rounded tile |
| icon-192.png | 192x192 | manifest `any`, rounded tile |
| apple-touch-icon.png | 180x180 | iOS home screen, opaque full-bleed |
| icon-maskable-512.png | 512x512 | manifest `maskable`, artwork within 80% safe zone |
| ../favicon.svg | vector, 64 grid | browser tab, tuned for 16-32px |
