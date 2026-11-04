// Visual QA: one screenshot per section, scrolled into view the way a visitor would see it.
// Usage: node scripts/shoot-sections.mjs <outDir> <prefix> <width>x<height> [--browser=webkit] [--mobile] [--reduced]
import { chromium, webkit, firefox } from '@playwright/test';
const [outDir, prefix, size, ...flags] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const engine = { chromium, webkit, firefox }[(flags.find((f) => f.startsWith('--browser=')) || '--browser=chromium').split('=')[1]];
const browser = await engine.launch();
const mobile = flags.includes('--mobile');
const ctx = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: mobile ? 3 : 1,
  isMobile: mobile && engine !== firefox,
  hasTouch: mobile,
  reducedMotion: flags.includes('--reduced') ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => m.type() !== 'log' && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:4321${flags.find((f) => f.startsWith('--path='))?.slice(7) ?? '/cutout-website/'}`, { waitUntil: 'networkidle' });
const ids = await page.$$eval('main > section[id], main > section[aria-labelledby]', (els) => els.map((e, i) => e.id || `s${i}`));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
for (const id of ids) {
  const el = id.startsWith('s') && !/^s[a-z]/.test(id) ? null : await page.$(`#${id}`);
  if (!el) continue;
  await el.scrollIntoViewIfNeeded();
  await page.evaluate((id) => {
    const e = document.getElementById(id);
    window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 64);
  }, id);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${prefix}-${id}.png` });
}
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/${prefix}-end.png` });
console.log(`sections: ${ids.join(', ')}; horizontal overflow: ${overflow}px`);
if (logs.length) console.log(logs.join('\n'));
await browser.close();
