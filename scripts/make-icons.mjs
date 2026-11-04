// Favicons and touch icons from the official icon in design/brand/ (resized, never redrawn).
import sharp from 'sharp';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('src/assets/generated/brand', { recursive: true });
await copyFile('design/brand/icon-16.png', 'public/favicon-16.png');
await copyFile('design/brand/icon-32.png', 'public/favicon-32.png');
await sharp('design/brand/icon-512.png').resize(192, 192, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile('public/icon-192.png');
await copyFile('design/brand/icon-512.png', 'public/icon-512.png');
// Apple touch icons must be opaque; iOS applies its own rounded mask. The macOS icon grid puts the
// rounded square at 100–924 px of 1024, so crop to it and fill the corners with the icon's navy.
await sharp('design/brand/CutOut-1024.png')
  .extract({ left: 100, top: 100, width: 824, height: 824 })
  .flatten({ background: '#0c1222' })
  .resize(180, 180, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile('public/apple-touch-icon.png');
// Source for the in-page icon (Astro makes AVIF/WebP at the sizes used).
await copyFile('design/brand/icon-512.png', 'src/assets/generated/brand/icon.png');
console.log('icons written');
