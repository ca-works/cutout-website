import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import release from '../../src/data/release.json' with { type: 'json' };
import { APP_REPO } from '../../site.config.mjs';

const PAGES = ['', 'docs/', 'privacy/', 'this-page-does-not-exist/'];

/** Collects console errors, page errors and CSP violations for a page. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // The 404 page's own document response is expected to be logged as a failed load.
    if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return problems;
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Scrolls to a fraction (0–1) of a scroll scene's track. */
async function scrollScene(page: Page, selector: string, fraction: number) {
  await page.evaluate(
    ([sel, f]) => {
      const el = document.querySelector(sel as string)!;
      const top = el.getBoundingClientRect().top + scrollY;
      window.scrollTo(0, top + (el.getBoundingClientRect().height - innerHeight) * (f as number));
    },
    [selector, fraction],
  );
  await page.waitForTimeout(700);
}

for (const path of PAGES) {
  test(`"/${path}" loads cleanly: no errors, no CSP violations, no horizontal overflow`, async ({ page }) => {
    const problems = watch(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(path.startsWith('this-page') ? 404 : 200);
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`"/${path}" has no detectable WCAG 2.2 A/AA violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await scrollThrough(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('every page has one h1, a title, a description and a canonical URL', async ({ page }) => {
  for (const path of PAGES.slice(0, 3)) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle(/CutOut/);
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(/^https:\/\//);
  }
});

test('downloads only ever point at verified GitHub release assets', async ({ page }) => {
  await page.goto('');
  const hrefs = await page.locator('a[href*="/releases/download/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  if (release.status !== 'available') {
    expect(hrefs).toEqual([]);
    await expect(page.locator('#get')).toContainText('Coming soon');
  } else {
    for (const h of hrefs) expect(h.startsWith(`https://github.com/${APP_REPO}/releases/download/`)).toBe(true);
  }
});

test('the source-code claim matches the repository state', async ({ page }) => {
  await page.goto('');
  const get = page.locator('#get');
  if (release.repo.public) {
    await expect(get.getByRole('link', { name: /source code/i })).toHaveAttribute('href', `https://github.com/${APP_REPO}`);
  } else {
    await expect(get).toContainText('Source code: with the first release');
    // Exactly the app repository (not, say, ca-works/cutout-website).
    const appLinks = await page
      .locator('a[href^="https://github.com/"]')
      .evaluateAll((as, repo) => as.map((a) => (a as HTMLAnchorElement).href).filter((h) => h === `https://github.com/${repo}` || h.startsWith(`https://github.com/${repo}/`)), APP_REPO);
    expect(appLinks).toEqual([]);
  }
});

test.describe('before/after comparison', () => {
  test('keyboard: arrows, Shift+arrows, Home and End move the handle', async ({ page }) => {
    await page.goto('#compare');
    const handle = page.locator('#cmp-panel-fur [role="slider"]');
    await handle.focus();
    await expect(handle).toHaveAttribute('aria-valuenow', '50');
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '52');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '42');
    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '0');
    await expect(handle).toHaveAttribute('aria-valuetext', 'Cutout only');
    await page.keyboard.press('End');
    await expect(handle).toHaveAttribute('aria-valuenow', '100');
  });

  test('pointer: dragging across the picture moves the split', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse drag');
    await page.goto('');
    const frame = page.locator('#cmp-panel-fur [data-frame]');
    await frame.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(1200);
    const box = (await frame.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.up();
    const v = Number(await page.locator('#cmp-panel-fur [role="slider"]').getAttribute('aria-valuenow'));
    expect(v).toBeGreaterThanOrEqual(17);
    expect(v).toBeLessThanOrEqual(23);
  });

  test('tabs switch samples; radios switch the backdrop', async ({ page }) => {
    await page.goto('#compare');
    await expect(page.locator('#cmp-panel-fur')).toBeVisible();
    await page.getByRole('tab', { name: 'Threads' }).click();
    await expect(page.locator('#cmp-panel-threads')).toBeVisible();
    await expect(page.locator('#cmp-panel-fur')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#cmp-panel-gaps')).toBeVisible();
    await page.getByRole('radio', { name: 'Black' }).click();
    await expect(page.locator('[data-compare]')).toHaveAttribute('data-bg', 'black');
  });
});

test.describe('hero', () => {
  test('the wordmark sits above the photo, fully visible and not overlapping it', async ({ page }) => {
    await page.goto('');
    const word = (await page.locator('.hero__word').boundingBox())!;
    const stage = (await page.locator('[data-stage]').boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(word.y + word.height).toBeLessThanOrEqual(stage.y + 1);
    expect(word.y).toBeGreaterThanOrEqual(0);
    expect(word.x).toBeGreaterThanOrEqual(0);
    expect(word.x + word.width).toBeLessThanOrEqual(vw);
    // The cutout still sits in front of the photo inside the frame.
    const z = await page.evaluate(() => ['.hero__poster', '.hero__subject'].map((s) => { const el = document.querySelector(s)!; return [...el.parentElement!.children].indexOf(el); }));
    expect(z[0]).toBeLessThan(z[1]);
  });

  test('the primary call to action is visible in the first viewport', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('[data-primary-cta]')).toBeInViewport({ ratio: 1 });
  });

  test('with reduced motion it is static and "Remove background" works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('');
    const toggle = page.getByRole('button', { name: 'Remove background' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-bg', 'off');
    await expect(page.getByRole('button', { name: 'Show original' })).toHaveAttribute('aria-pressed', 'true');
    const height = await page.locator('[data-hero]').evaluate((e) => e.getBoundingClientRect().height);
    expect(height).toBeLessThan(page.viewportSize()!.height * 1.6);
  });

  test('scrolling through the hero cuts, lifts and peels', async ({ page }) => {
    await page.goto('');
    await scrollScene(page, '[data-hero]', 0.98);
    const v = await page.locator('[data-hero]').evaluate((e) => ['--cut', '--lift', '--peel'].map((n) => Number(getComputedStyle(e).getPropertyValue(n))));
    for (const x of v) expect(x).toBeGreaterThan(0.95);
    await expect(page.locator('[data-hero]')).toHaveClass(/is-(live|lite)/);
  });

  test('without WebGL it falls back to the simple version', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test override: pretend WebGL 2 does not exist
      delete window.WebGL2RenderingContext;
    });
    await page.goto('');
    await expect(page.locator('[data-hero]')).toHaveClass(/is-lite/);
  });
});

test('the key sequence steps through paste, remove and copy', async ({ page }) => {
  await page.goto('');
  const keys = page.locator('[data-keys]');
  await scrollScene(page, '[data-keys]', 0.1);
  await expect(keys).toHaveAttribute('data-step', '0');
  await scrollScene(page, '[data-keys]', 0.5);
  await expect(keys).toHaveAttribute('data-step', '1');
  await scrollScene(page, '[data-keys]', 0.95);
  await expect(keys).toHaveAttribute('data-step', '2');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content, the depth composition and all samples are there', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('h1')).toContainText('Keep the subject');
    await expect(page.locator('[data-poster]')).toBeVisible();
    await expect(page.locator('[data-subject]')).toBeVisible();
    await expect(page.locator('#get')).toBeVisible();
    await expect(page.locator('[data-panel]')).toHaveCount(4);
    for (const p of await page.locator('[data-panel]').all()) await expect(p).toBeVisible();
  });
});

test.describe('phone navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('the menu opens, lists the sections and closes after choosing one', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Menu' }).click();
    const sheet = page.locator('#nav-menu');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: 'Privacy' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#privacy$/);
  });
});
