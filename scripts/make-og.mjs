// Renders public/og.png (1200 × 630) — the link preview for iMessage, LinkedIn, Slack, etc. —
// in the site's own style: black stage, giant wordmark, CutOut's real mug cutout in front.
// Run after `npm run assets`: node scripts/make-og.mjs
import { chromium } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const abs = (p) => new URL(`../${p}`, import.meta.url).pathname;
const font = abs('node_modules/@fontsource-variable/mona-sans/files/mona-sans-latin-standard-normal.woff2');
const icon = abs('design/brand/icon-512.png');
const cutout = abs('src/assets/generated/hero/subject-960.webp');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Mona; src: url("file://${font}") format("woff2"); font-weight: 200 900; font-stretch: 75% 125%; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #050507; font-family: Mona, sans-serif; color: #f5f5f7; overflow: hidden; position: relative; }
.glow { position: absolute; inset: 0; background: radial-gradient(50% 60% at 50% 55%, rgb(88 71 240 / .22), transparent 70%); }
.word { position: absolute; left: 0; right: 0; top: 70px; text-align: center; font-size: 300px; font-weight: 800; font-stretch: 125%; letter-spacing: -0.065em; line-height: .8; }
.part { position: absolute; left: 50%; top: 150px; width: 470px; transform: translateX(-50%); filter: drop-shadow(18px 28px 30px rgb(0 0 0 / .8)); }
.brand { position: absolute; left: 48px; bottom: 40px; display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 720; font-stretch: 110%; letter-spacing: -0.035em; }
.brand img { width: 52px; height: 52px; }
.tag { position: absolute; right: 48px; bottom: 44px; font-size: 26px; font-weight: 620; letter-spacing: -0.02em; color: #c8c8d2; text-align: right; line-height: 1.15; }
</style></head><body>
<div class="glow"></div>
<div class="word">CutOut</div>
<img class="part" src="file://${cutout}" alt="">
<div class="brand"><img src="file://${icon}" alt="">CutOut for Mac</div>
<div class="tag">Keep the subject.<br>Lose the background.</div>
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
await sharp(png).png({ compressionLevel: 9 }).toFile('public/og.png');
console.log('public/og.png written');
