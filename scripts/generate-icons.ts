/**
 * Folio app icon generator.
 *
 * Provenance: every shape in this file is original vector geometry authored for
 * Folio (seven offset ceramic sheets + embossed orange check). No third-party
 * artwork, fonts, traced images, or generated imagery is used. Rasters are
 * produced locally with sharp (librsvg) from the SVG strings below.
 *
 * Run: bun scripts/generate-icons.ts
 * Outputs (all overwritten):
 *   static/icons/icon-master.svg        vector source, full-bleed 1024 canvas
 *   static/icons/icon-1024.png          master raster, full-bleed, opaque
 *   static/icons/icon-512.png           purpose "any", rounded tile, transparent corners
 *   static/icons/icon-192.png           purpose "any", rounded tile, transparent corners
 *   static/icons/apple-touch-icon.png   180, full-bleed, opaque (iOS applies its own mask)
 *   static/icons/icon-maskable-512.png  purpose "maskable", artwork inside the 80% safe zone
 *   static/favicon.svg                  small-size tuned vector
 *   static/icons/PROVENANCE.md          provenance + regeneration record
 */
// allow: SIZE_OK — Original SVG artwork and provenance are literal asset data, kept with the reproducible sizing pipeline.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = join(ROOT, 'static');
const ICON_DIR = join(STATIC_DIR, 'icons');

/** Palette, derived from DESIGN.md (ink, sheets, orange). */
const C = {
	bgTop: '#34352f',
	bgBottom: '#161714',
	glow: '#e94d20',
	frontTop: '#fdfcfa',
	frontBottom: '#ecebe5',
	frontSlab: '#bdbbb2',
	orangeLight: '#ff8a5c',
	orange: '#e94d20',
	orangeDeep: '#c23b13',
	orangeRim: '#9e2f0e',
	orangeHighlight: '#ffc9b0'
} as const;

/** Receding sheet face tones, index 1 (just behind front) to 6 (furthest back). */
const BACK_TONES = ['#efeee9', '#e2e1db', '#d4d3cc', '#c5c4bc', '#b5b4ab', '#a4a39a'] as const;

const SHEETS = 7;
const CANVAS = 1024;

/** Front sheet geometry in 1024 space. Back sheets step up and inset. */
const FRONT = { x: 196, y: 424, w: 632, h: 376, r: 66 } as const;
const STEP_Y = 36;
const INSET_X = 19;
const SLAB = 14;

type Variant = 'full' | 'rounded' | 'maskable';

interface SheetRect {
	index: number;
	x: number;
	y: number;
	w: number;
	h: number;
	r: number;
}

function sheetRect(index: number): SheetRect {
	return {
		index,
		x: FRONT.x + INSET_X * index,
		y: FRONT.y - STEP_Y * index,
		w: FRONT.w - INSET_X * 2 * index,
		h: FRONT.h,
		r: FRONT.r - index * 3
	};
}

function rect(s: SheetRect, fill: string, dy = 0, extra = ''): string {
	return `<rect x="${s.x}" y="${s.y + dy}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${fill}"${extra}/>`;
}

function backSheet(s: SheetRect): string {
	const tone = BACK_TONES[s.index - 1] ?? BACK_TONES[5];
	const id = `face${s.index}`;
	return `
	<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${s.y}" x2="0" y2="${s.y + STEP_Y + 8}">
		<stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
		<stop offset="0.16" stop-color="${tone}" stop-opacity="0"/>
	</linearGradient>
	<g filter="url(#lift)">
		${rect(s, tone)}
		${rect(s, `url(#${id})`)}
		${rect(s, 'none', 0, ' stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"')}
	</g>`;
}

const CHECK_PATH = 'M406 614 L480 686 L626 538';

function frontSheet(): string {
	const s = sheetRect(0);
	return `
	<g filter="url(#liftFront)">
		${rect(s, C.frontSlab, SLAB)}
		${rect(s, 'url(#frontFace)')}
		${rect(s, 'url(#glaze)')}
		${rect(s, 'url(#sheen)')}
		${rect(s, 'none', 0, ' stroke="#ffffff" stroke-opacity="0.9" stroke-width="2.5"')}
	</g>
	<g filter="url(#checkShadow)">
		<path d="${CHECK_PATH}" transform="translate(0 5)" fill="none" stroke="${C.orangeRim}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
	</g>
	<path d="${CHECK_PATH}" fill="none" stroke="url(#orangeBody)" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
	<rect x="340" y="470" width="350" height="290" fill="${C.orangeHighlight}" mask="url(#checkRim)" opacity="0.85"/>
	<rect x="340" y="470" width="350" height="290" fill="url(#checkGloss)" mask="url(#checkBody)"/>`;
}

function defs(): string {
	return `
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
			<stop offset="0" stop-color="${C.bgTop}"/>
			<stop offset="1" stop-color="${C.bgBottom}"/>
		</linearGradient>
		<radialGradient id="bgGlow" cx="512" cy="300" r="560" gradientUnits="userSpaceOnUse">
			<stop offset="0" stop-color="${C.glow}" stop-opacity="0.16"/>
			<stop offset="0.55" stop-color="${C.glow}" stop-opacity="0.04"/>
			<stop offset="1" stop-color="${C.glow}" stop-opacity="0"/>
		</radialGradient>
		<radialGradient id="bgVignette" cx="512" cy="512" r="760" gradientUnits="userSpaceOnUse">
			<stop offset="0.6" stop-color="#000000" stop-opacity="0"/>
			<stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
		</radialGradient>
		<filter id="grain" x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>
			<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0"/>
		</filter>
		<filter id="lift" x="-20%" y="-30%" width="140%" height="180%">
			<feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
			<feOffset dy="-3" result="ao"/>
			<feFlood flood-color="#0b0b09" flood-opacity="0.32"/>
			<feComposite in2="ao" operator="in" result="aoShadow"/>
			<feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
			<feOffset dy="10" result="key"/>
			<feFlood flood-color="#000000" flood-opacity="0.28"/>
			<feComposite in2="key" operator="in" result="keyShadow"/>
			<feMerge><feMergeNode in="keyShadow"/><feMergeNode in="aoShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
		</filter>
		<filter id="liftFront" x="-20%" y="-30%" width="140%" height="170%">
			<feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
			<feOffset dy="-3" result="ao"/>
			<feFlood flood-color="#0b0b09" flood-opacity="0.38"/>
			<feComposite in2="ao" operator="in" result="aoShadow"/>
			<feGaussianBlur in="SourceAlpha" stdDeviation="26"/>
			<feOffset dy="30" result="key"/>
			<feFlood flood-color="#000000" flood-opacity="0.5"/>
			<feComposite in2="key" operator="in" result="keyShadow"/>
			<feMerge><feMergeNode in="keyShadow"/><feMergeNode in="aoShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
		</filter>
		<filter id="checkShadow" x="-20%" y="-20%" width="140%" height="150%">
			<feGaussianBlur in="SourceAlpha" stdDeviation="7"/>
			<feOffset dy="10" result="drop"/>
			<feFlood flood-color="${C.orangeRim}" flood-opacity="0.45"/>
			<feComposite in2="drop" operator="in" result="dropShadow"/>
			<feMerge><feMergeNode in="dropShadow"/><feMergeNode in="SourceGraphic"/></feMerge>
		</filter>
		<linearGradient id="frontFace" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="${C.frontTop}"/>
			<stop offset="1" stop-color="${C.frontBottom}"/>
		</linearGradient>
		<linearGradient id="glaze" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
			<stop offset="0.07" stop-color="#ffffff" stop-opacity="0"/>
			<stop offset="0.9" stop-color="#9c9a91" stop-opacity="0"/>
			<stop offset="1" stop-color="#9c9a91" stop-opacity="0.18"/>
		</linearGradient>
		<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.9">
			<stop offset="0.18" stop-color="#ffffff" stop-opacity="0"/>
			<stop offset="0.34" stop-color="#ffffff" stop-opacity="0.55"/>
			<stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
		</linearGradient>
		<linearGradient id="orangeBody" gradientUnits="userSpaceOnUse" x1="0" y1="520" x2="0" y2="720">
			<stop offset="0" stop-color="${C.orangeLight}"/>
			<stop offset="0.5" stop-color="${C.orange}"/>
			<stop offset="1" stop-color="${C.orangeDeep}"/>
		</linearGradient>
		<linearGradient id="checkGloss" gradientUnits="userSpaceOnUse" x1="380" y1="520" x2="560" y2="700">
			<stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/>
			<stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
		</linearGradient>
		<mask id="checkRim" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}">
			<path d="${CHECK_PATH}" fill="none" stroke="#ffffff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="${CHECK_PATH}" transform="translate(0 7)" fill="none" stroke="#000000" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
		</mask>
		<mask id="checkBody" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}">
			<path d="${CHECK_PATH}" fill="none" stroke="#ffffff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
		</mask>
		<clipPath id="tile"><rect width="${CANVAS}" height="${CANVAS}" rx="228"/></clipPath>
	</defs>`;
}

function background(): string {
	return `
	<rect width="${CANVAS}" height="${CANVAS}" fill="url(#bg)"/>
	<rect width="${CANVAS}" height="${CANVAS}" fill="url(#bgGlow)"/>
	<rect width="${CANVAS}" height="${CANVAS}" filter="url(#grain)" opacity="1"/>
	<rect width="${CANVAS}" height="${CANVAS}" fill="url(#bgVignette)"/>`;
}

function artwork(): string {
	const back = Array.from({ length: SHEETS - 1 }, (_, i) => sheetRect(SHEETS - 1 - i))
		.map(backSheet)
		.join('');
	return `${back}${frontSheet()}`;
}

/** Visual centre of the stack, used to scale artwork into the maskable safe zone. */
const STACK_CENTER_Y = (sheetRect(SHEETS - 1).y + FRONT.y + FRONT.h + SLAB) / 2;

function iconSvg(variant: Variant): string {
	const scale = variant === 'maskable' ? 0.78 : 1;
	const offsetY = CANVAS / 2 - STACK_CENTER_Y;
	const art = `<g transform="translate(512 512) scale(${scale}) translate(-512 ${-512 + offsetY})">${artwork()}</g>`;
	const body = `${background()}${art}`;
	const content = variant === 'rounded' ? `<g clip-path="url(#tile)">${body}</g>` : body;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
	<title>Folio</title>
	<desc>Seven offset ceramic sheets with an embossed orange check. Original artwork authored for Folio.</desc>
	${defs().trim()}
	${content.trim()}
</svg>
`;
}

/** Favicon: same composition, re-drawn on a 64 grid so seven sheets stay legible at 16-32px. */
function faviconSvg(): string {
	const back: string[] = [];
	const tones = ['#ecebe6', '#dddcd6', '#cdccc5', '#bdbcb4', '#adaca3', '#9d9c93'];
	for (let i = SHEETS - 1; i >= 1; i--) {
		const x = 7 + i * 1.6;
		const y = 29 - i * 3;
		const w = 50 - i * 3.2;
		back.push(
			`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="26" rx="4.5" fill="${tones[i - 1]}" stroke="#1b1c19" stroke-opacity="0.35" stroke-width="0.6"/>`
		);
	}
	const check = 'M20.5 42 L28.5 49.5 L43.5 35';
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<title>Folio</title>
	<defs>
		<linearGradient id="b" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${C.bgTop}"/><stop offset="1" stop-color="${C.bgBottom}"/></linearGradient>
		<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.frontTop}"/><stop offset="1" stop-color="${C.frontBottom}"/></linearGradient>
		<linearGradient id="o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.orangeLight}"/><stop offset="1" stop-color="${C.orangeDeep}"/></linearGradient>
	</defs>
	<rect width="64" height="64" rx="14" fill="url(#b)"/>
	${back.join('\n\t')}
	<rect x="7" y="30" width="50" height="27" rx="5.5" fill="${C.frontSlab}"/>
	<rect x="7" y="29" width="50" height="27" rx="5.5" fill="url(#f)" stroke="#1b1c19" stroke-opacity="0.35" stroke-width="0.6"/>
	<path d="${check}" fill="none" stroke="${C.orangeRim}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 1)"/>
	<path d="${check}" fill="none" stroke="url(#o)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

const PROVENANCE = `# Folio icon provenance

- Artwork: original vector geometry authored for Folio in \`scripts/generate-icons.ts\`.
  Seven offset ceramic sheets (front sheet lifted, six receding sheets) with an embossed orange check.
- No text, logos, fonts, traced images, stock assets, or AI-generated imagery. No Weekstack or other third-party assets.
- Palette derived from DESIGN.md: ink background, neutral sheet tones, orange #e94d20 completion accent.
- Rasterized locally with sharp ${sharp.versions.sharp} (librsvg ${sharp.versions.rsvg ?? 'n/a'}); smaller sizes are Lanczos downsamples of the 1024 render.
- Regenerate: \`bun scripts/generate-icons.ts\` (overwrites every file listed below).

| File | Size | Purpose |
|---|---|---|
| icon-master.svg | vector, 1024 canvas | source of truth |
| icon-1024.png | 1024x1024 | master raster, opaque full-bleed |
| icon-512.png | 512x512 | manifest \`any\`, rounded tile |
| icon-192.png | 192x192 | manifest \`any\`, rounded tile |
| apple-touch-icon.png | 180x180 | iOS home screen, opaque full-bleed |
| icon-maskable-512.png | 512x512 | manifest \`maskable\`, artwork within 80% safe zone |
| ../favicon.svg | vector, 64 grid | browser tab, tuned for 16-32px |
`;

async function render(svg: string, size: number, opaque: boolean): Promise<Buffer> {
	let img = sharp(Buffer.from(svg), { density: 144 }).resize(size, size, { kernel: 'lanczos3' });
	if (opaque) img = img.flatten({ background: C.bgBottom });
	return img.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function main(): Promise<void> {
	await mkdir(ICON_DIR, { recursive: true });
	const full = iconSvg('full');
	const rounded = iconSvg('rounded');
	const maskable = iconSvg('maskable');

	const outputs: Array<[string, Promise<Buffer> | string]> = [
		[join(ICON_DIR, 'icon-master.svg'), full],
		[join(ICON_DIR, 'icon-1024.png'), render(full, 1024, true)],
		[join(ICON_DIR, 'icon-512.png'), render(rounded, 512, false)],
		[join(ICON_DIR, 'icon-192.png'), render(rounded, 192, false)],
		[join(ICON_DIR, 'apple-touch-icon.png'), render(full, 180, true)],
		[join(ICON_DIR, 'icon-maskable-512.png'), render(maskable, 512, true)],
		[join(STATIC_DIR, 'favicon.svg'), faviconSvg()],
		[join(ICON_DIR, 'favicon-16.png'), render(faviconSvg(), 16, false)],
		[join(ICON_DIR, 'favicon-32.png'), render(faviconSvg(), 32, false)],
		[join(ICON_DIR, 'PROVENANCE.md'), PROVENANCE]
	];

	for (const [path, data] of outputs) {
		await writeFile(path, await data);
		console.log(`wrote ${path.slice(ROOT.length + 1)}`);
	}
}

await main();
