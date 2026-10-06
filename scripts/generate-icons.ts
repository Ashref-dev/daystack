/**
 * Daystack icon generator.
 *
 * Provenance: original vector geometry authored for Daystack (an orange tick tile
 * with a ghost outline tile behind it, matching the Open Graph image). No third-party
 * artwork, fonts, traced images or generated imagery. Rasters come from sharp (librsvg).
 *
 * Run: bun scripts/generate-icons.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = join(ROOT, 'static');
const ICON_DIR = join(STATIC_DIR, 'icons');

const C = {
  paperTop: '#fbfaf7',
  paperBottom: '#ebeae4',
  ghost: '#cdcbc2',
  orangeTop: '#f4603a',
  orangeBottom: '#de4318',
  rim: '#b8360f',
  shadow: '#b8360f'
} as const;

const TICK = 'm5 12 4 4L19 6';

const defs = `<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.paperTop}"/><stop offset="1" stop-color="${C.paperBottom}"/></linearGradient>
  <linearGradient id="orange" x1="0" y1="0" x2="0.45" y2="1"><stop offset="0" stop-color="${C.orangeTop}"/><stop offset="1" stop-color="${C.orangeBottom}"/></linearGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="34"/></filter>
</defs>`;

/** Tilted orange tile with its ghost outline, centred for a 1024 canvas. */
function artwork(): string {
  const cx = 456;
  const cy = 490;
  const size = 580;
  const x = cx - size / 2;
  const y = cy - size / 2;
  const scale = 372 / 24;
  return `
  <g transform="rotate(8 738 635)"><rect x="${738 - 121}" y="${635 - 121}" width="242" height="242" rx="68" fill="none" stroke="${C.ghost}" stroke-width="16"/></g>
  <g transform="rotate(-6 ${cx} ${cy})">
    <rect x="${x + 20}" y="${y + 70}" width="${size - 40}" height="${size - 40}" rx="140" fill="${C.shadow}" opacity="0.45" filter="url(#soft)"/>
    <rect x="${x}" y="${y + 14}" width="${size}" height="${size}" rx="152" fill="${C.rim}"/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="152" fill="url(#orange)"/>
    <path d="${TICK}" transform="translate(${cx - 186} ${cy - 186}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

type Variant = 'full' | 'rounded' | 'maskable';

function appIcon(variant: Variant): string {
  const factor = variant === 'maskable' ? 0.78 : 1.1;
  const art = `<g transform="translate(512 512) scale(${factor}) translate(-512 -512)">${artwork()}</g>`;
  const clip = variant === 'rounded' ? '<clipPath id="r"><rect width="1024" height="1024" rx="228"/></clipPath>' : '';
  const open = variant === 'rounded' ? '<g clip-path="url(#r)">' : '<g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${defs}${clip}
  ${open}<rect width="1024" height="1024" fill="url(#paper)"/>${art}</g>
</svg>`;
}

/** Flat tile tuned for 16 to 64px: no tilt, heavier tick. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Daystack</title>
  <defs><linearGradient id="o" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${C.orangeTop}"/><stop offset="1" stop-color="${C.orangeBottom}"/></linearGradient></defs>
  <rect x="2" y="3.5" width="60" height="60" rx="16" fill="${C.rim}"/>
  <rect x="2" y="1.5" width="60" height="60" rx="16" fill="url(#o)"/>
  <path d="${TICK}" transform="translate(32 31.5) scale(1.9) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

function ico(images: readonly { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(image => image.data)]);
}

await mkdir(ICON_DIR, { recursive: true });
const full = appIcon('full');
const small = await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(favicon, size) })));
const [s16, s32] = small;
if (!s16 || !s32) throw new Error('Missing favicon rasters');

await Promise.all([
  writeFile(join(ICON_DIR, 'icon-master.svg'), full),
  writeFile(join(ICON_DIR, 'icon-1024.png'), await png(full, 1024)),
  writeFile(join(ICON_DIR, 'icon-512.png'), await png(appIcon('rounded'), 512)),
  writeFile(join(ICON_DIR, 'icon-192.png'), await png(appIcon('rounded'), 192)),
  writeFile(join(ICON_DIR, 'apple-touch-icon.png'), await png(full, 180)),
  writeFile(join(ICON_DIR, 'icon-maskable-512.png'), await png(appIcon('maskable'), 512)),
  writeFile(join(ICON_DIR, 'favicon-16.png'), s16.data),
  writeFile(join(ICON_DIR, 'favicon-32.png'), s32.data),
  writeFile(join(STATIC_DIR, 'favicon.svg'), favicon),
  writeFile(join(STATIC_DIR, 'favicon.ico'), ico(small))
]);
console.log('icons written');
