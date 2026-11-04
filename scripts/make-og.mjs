// Renders public/og.png (1200 × 630) — the link preview for iMessage, LinkedIn, Slack, etc. —
// from the official icon, the real CutOut cutout and the site typeface. Run: node scripts/make-og.mjs
import { chromium } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const abs = (p) => new URL(`../${p}`, import.meta.url).pathname;
const font = abs('node_modules/@fontsource-variable/mona-sans/files/mona-sans-latin-wght-normal.woff2');
const icon = abs('design/brand/icon-512.png');
const cutout = abs('src/assets/generated/hero/subject-1024.webp');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Mona; src: url("file://${font}") format("woff2"); font-weight: 200 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #f3f3f0; font-family: Mona, sans-serif; color: #0d1020; overflow: hidden; position: relative; }
.left { position: absolute; left: 76px; top: 76px; width: 630px; }
.brand { display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 680; letter-spacing: -0.035em; }
.brand img { width: 76px; height: 76px; filter: drop-shadow(0 6px 10px rgb(13 16 32 / .25)); }
h1 { margin-top: 70px; font-size: 62px; line-height: 1.02; letter-spacing: -0.05em; font-weight: 660; white-space: nowrap; }
h1 span { display: inline-block; background-image: linear-gradient(90deg, #5847f0 0 55%, transparent 55%); background-size: 12px 3px; background-repeat: repeat-x; background-position: 0 100%; padding-bottom: 6px; }
p { margin-top: 30px; font-size: 26px; color: #4a4e60; letter-spacing: -0.01em; }
.stage { position: absolute; right: 64px; top: 95px; width: 430px; height: 430px; border-radius: 20px; overflow: hidden;
  background-color: #fff; background-image: conic-gradient(#e4e5ea 25%, transparent 0 50%, #e4e5ea 0 75%, transparent 0); background-size: 26px 26px;
  box-shadow: 0 4px 10px rgb(13 16 32 / .08), 0 40px 80px -24px rgb(13 16 32 / .32); transform: perspective(1400px) rotateX(5deg); }
.stage img { width: 100%; height: 100%; filter: drop-shadow(14px 18px 16px rgb(13 16 32 / .3)); }
</style></head><body>
<div class="left">
  <div class="brand"><img src="file://${icon}" alt="">CutOut</div>
  <h1>Keep the subject.<br><span>Lose the background.</span></h1>
  <p>Free background removal and image editing for Mac.<br>Your images never leave it.</p>
</div>
<div class="stage"><img src="file://${cutout}" alt=""></div>
</body></html>`;

const dir = await mkdtemp(join(tmpdir(), 'og-'));
const file = join(dir, 'og.html');
await writeFile(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`file://${file}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const png = await page.screenshot({ type: 'png' });
await browser.close();
await rm(dir, { recursive: true });
await sharp(png).png({ compressionLevel: 9, palette: false }).toFile('public/og.png');
console.log('public/og.png written');
