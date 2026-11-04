// Visual QA: screenshots of every section (and the middle/end of each scroll scene).
// Usage: node scripts/shoot-page.mjs <outDir> <prefix> <w>x<h> [--browser=webkit] [--mobile]
import { chromium, webkit } from '@playwright/test';
const [outDir, prefix, size, ...flags] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const engine = flags.includes('--browser=webkit') ? webkit : chromium;
const mobile = flags.includes('--mobile');
const browser = await engine.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:4321/cutout-website/', { waitUntil: 'load' });
await page.waitForTimeout(800);
const plan = await page.$$eval('main > section', (els) =>
  els.map((e, i) => ({ i, scene: e.hasAttribute('data-scene'), top: e.getBoundingClientRect().top + scrollY, height: e.getBoundingClientRect().height })),
);
let n = 0;
for (const s of plan) {
  const stops = s.scene ? [0.05, 0.5, 0.95].map((f) => s.top + (s.height - h) * f) : [s.top - 40];
  for (const y of stops) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/${prefix}-${String(n++).padStart(2, '0')}.png`, timeout: 20000 });
  }
}
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/${prefix}-${String(n++).padStart(2, '0')}.png` });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`${n} shots; overflow ${overflow}px; errors: ${errors.join(' | ') || 'none'}`);
await browser.close();
