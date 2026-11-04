// Visual QA helper: screenshots of the built site at given scroll positions and viewports.
// Usage: node scripts/shoot.mjs <outDir> <name> <width>x<height> <path> [scrollY ...] [--browser=webkit] [--reduced] [--full]
import { chromium, webkit, firefox } from '@playwright/test';
const [outDir, name, size, path, ...rest] = process.argv.slice(2);
const flags = rest.filter((a) => a.startsWith('--'));
const ys = rest.filter((a) => !a.startsWith('--')).map(Number);
const [w, h] = size.split('x').map(Number);
const engine = { chromium, webkit, firefox }[(flags.find((f) => f.startsWith('--browser=')) || '--browser=chromium').split('=')[1]];
const browser = await engine.launch(engine === chromium ? { args: ['--use-angle=metal', '--enable-gpu'] } : {});
const ctx = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: flags.includes('--dpr1') ? 1 : 2,
  reducedMotion: flags.includes('--reduced') ? 'reduce' : 'no-preference',
  javaScriptEnabled: !flags.includes('--nojs'),
  isMobile: flags.includes('--mobile'),
  hasTouch: flags.includes('--mobile'),
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:4321${path}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const list = ys.length ? ys : [0];
for (const y of list) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/${name}-${y}.png`, fullPage: flags.includes('--full') });
}
if (logs.length) console.log(logs.join('\n'));
await browser.close();
