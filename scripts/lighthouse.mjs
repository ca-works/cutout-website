// Lighthouse (mobile and desktop) against the locally served production build.
// Writes reports/lighthouse/summary.json and per-run HTML reports (HTML is git-ignored).
// Requires `node scripts/serve.mjs` running. Chrome comes from Playwright's Chromium.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { SITE_BASE } from '../site.config.mjs';

const pages = ['', 'docs/'];
await mkdir('reports/lighthouse', { recursive: true });
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const summary = [];
for (const formFactor of ['mobile', 'desktop']) {
  for (const p of pages) {
    const url = `http://127.0.0.1:4321${SITE_BASE}${p}`;
    const config = {
      extends: 'lighthouse:default',
      settings:
        formFactor === 'desktop'
          ? { formFactor, screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttlingMethod: 'simulate', throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } }
          : { formFactor, throttlingMethod: 'simulate' },
    };
    const r = await lighthouse(url, { port: chrome.port, output: 'html', logLevel: 'error' }, config);
    const lhr = r.lhr;
    const a = lhr.audits;
    const row = {
      url: p || '/',
      formFactor,
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
      lcp: a['largest-contentful-paint'].displayValue,
      cls: a['cumulative-layout-shift'].displayValue,
      tbt: a['total-blocking-time'].displayValue,
      fcp: a['first-contentful-paint'].displayValue,
      transfer: a['total-byte-weight'].displayValue,
    };
    summary.push(row);
    await writeFile(`reports/lighthouse/${formFactor}-${(p || 'home').replace('/', '')}.html`, r.report);
    console.log(JSON.stringify(row));
  }
}
await chrome.kill();
await writeFile('reports/lighthouse/summary.json', JSON.stringify({ measured: new Date().toISOString(), note: 'Local production build served by scripts/serve.mjs; Lighthouse simulated throttling.', results: summary }, null, 2) + '\n');
