// Renders public/og.png (1200 × 630) — the link preview for iMessage, LinkedIn, Slack, etc. —
// the real app on black, with the original photo beside its cut-out.
// Run after `npm run assets`: node scripts/make-og.mjs
import { chromium } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const abs = (p) => new URL(`../${p}`, import.meta.url).pathname;
const font = abs('node_modules/@fontsource-variable/mona-sans/files/mona-sans-latin-standard-normal.woff2');
const icon = abs('design/brand/icon-512.png');
const shot = abs('src/assets/screens/app-tools.png'); // genuine app screenshot (self-test output)
const original = abs('src/assets/generated/samples/golden.jpg'); // the real input photo for that cut-out
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Mona; src: url("file://${font}") format("woff2"); font-weight: 200 900; font-stretch: 75% 125%; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #050507; font-family: Mona, sans-serif; color: #f5f5f7; overflow: hidden; position: relative; }
.glow { position: absolute; inset: 0; background: radial-gradient(45% 70% at 72% 50%, rgb(88 71 240 / .24), transparent 70%); }
.brand { position: absolute; left: 64px; top: 56px; display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 720; font-stretch: 110%; letter-spacing: -0.035em; }
.brand img { width: 58px; height: 58px; }
h1 { position: absolute; left: 64px; top: 176px; font-size: 64px; font-weight: 800; font-stretch: 108%; letter-spacing: -0.05em; line-height: .98; }
h1 span { display: block; color: #8f86ff; }
.sub { position: absolute; left: 64px; top: 408px; width: 500px; font-size: 29px; font-weight: 520; letter-spacing: -0.015em; line-height: 1.28; color: #c8c8d2; }
.win { position: absolute; left: 676px; top: 96px; width: 660px; border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px rgb(255 255 255 / .14), 0 40px 90px -20px rgb(0 0 0 / .9); }
.win img { display: block; width: 100%; }
.orig { position: absolute; left: 616px; top: 404px; width: 180px; padding: 7px; border-radius: 16px; background: #1c1c21; box-shadow: 0 0 0 1px rgb(255 255 255 / .16), 0 24px 50px -10px rgb(0 0 0 / .85); }
.orig img { display: block; width: 100%; border-radius: 10px; }
.orig b { display: block; margin: 8px 4px 2px; font-size: 17px; font-weight: 640; color: #c8c8d2; letter-spacing: .02em; }
</style></head><body>
<div class="glow"></div>
<div class="brand"><img src="file://${icon}" alt="">CutOut</div>
<h1>Remove the<br>background.<span>Keep the magic.</span></h1>
<div class="sub">Free and offline.<br>For Mac and Windows.</div>
<div class="win"><img src="file://${shot}" alt=""></div>
<div class="orig"><img src="file://${original}" alt=""><b>Original</b></div>
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
