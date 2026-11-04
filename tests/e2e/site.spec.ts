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
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
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
    // Reveal everything that would normally be shown on scroll.
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
    await expect(page.locator('#download')).toContainText('Coming soon');
  } else {
    for (const h of hrefs) expect(h.startsWith(`https://github.com/${APP_REPO}/releases/download/`)).toBe(true);
  }
});

test('the source-code claim matches the repository state', async ({ page }) => {
  await page.goto('');
  const free = page.locator('#free');
  if (release.repo.public) {
    await expect(free).toContainText('open source', { ignoreCase: true });
  } else {
    await expect(free).toContainText('being prepared for publication');
    await expect(free.getByRole('link', { name: /source code on github/i })).toHaveCount(0);
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
    await page.waitForTimeout(300);
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
    await page.getByRole('tab', { name: 'Fine detail' }).click();
    await expect(page.locator('#cmp-panel-fine')).toBeVisible();
    await expect(page.locator('#cmp-panel-fur')).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#cmp-panel-white')).toBeVisible();
    await page.getByRole('radio', { name: 'Black' }).click();
    await expect(page.locator('[data-compare]')).toHaveAttribute('data-bg', 'black');
  });
});

test.describe('hero', () => {
  test('with reduced motion it is static, shows the finished cutout and can show the original', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('');
    const toggle = page.getByRole('button', { name: 'Show original' });
    await expect(toggle).toBeVisible();
    await expect(page.locator('[data-hero]')).not.toHaveClass(/is-live/);
    await toggle.click();
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-show', 'original');
    await expect(page.getByRole('button', { name: 'Show cutout' })).toHaveAttribute('aria-pressed', 'true');
    const trackHeight = await page.locator('[data-hero-track]').evaluate((e) => e.getBoundingClientRect().height);
    expect(trackHeight).toBeLessThan(page.viewportSize()!.height * 1.5);
  });

  test('the primary call to action is visible in the first viewport', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('[data-primary-cta]')).toBeInViewport();
  });

  test('the scroll-driven scene runs and reaches its final step', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'headless Firefox has no WebGL 2 on some CI hosts; lite mode is covered below');
    await page.goto('');
    const hero = page.locator('[data-hero]');
    await expect(hero).toHaveClass(/is-(live|lite)/);
    const track = page.locator('[data-hero-track]');
    const end = await track.evaluate((e) => e.getBoundingClientRect().bottom + scrollY - innerHeight);
    await page.evaluate((y) => window.scrollTo(0, y), end - 2);
    await expect(page.locator('[data-step="2"]')).toHaveClass(/is-done|is-active/);
  });

  test('without WebGL it falls back to the simple dissolve', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test override
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        return type === 'webgl2' ? null : orig.call(this, type, ...(rest as []));
      };
    });
    await page.goto('');
    await expect(page.locator('[data-hero]')).toHaveClass(/is-lite/);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content, navigation and the finished cutout are all there', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('h1')).toContainText('Keep the subject');
    await expect(page.locator('[data-stage-static]')).toBeVisible();
    await expect(page.locator('#download')).toBeVisible();
    // All three comparison samples are shown, stacked.
    await expect(page.locator('[data-panel]')).toHaveCount(3);
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
    await sheet.getByRole('link', { name: 'Features' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#features$/);
  });
});
