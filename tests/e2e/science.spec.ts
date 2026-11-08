import { test, expect, type Page } from '@playwright/test';

// The Science page: every demonstration is exercised, and its numbers are checked against the
// formulas the page states. (Generic checks — no console errors, no CSP violations, no horizontal
// overflow, axe WCAG 2.2 AA — run for this page in site.spec.ts.)

const PATH = 'science/';

async function reach(page: Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(selector).first()).toHaveClass(/is-live/, { timeout: 10_000 });
}

test('the page is in the navigation and the footer', async ({ page, isMobile }) => {
  await page.goto('');
  if (!isMobile) await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Science' })).toHaveAttribute('href', /\/science\/$/);
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'The Science Behind CutOut' })).toHaveAttribute('href', /\/science\/$/);
  await page.goto(PATH);
  await expect(page.locator('h1')).toContainText('The Science Behind CutOut');
});

test('loads nothing from other origins', async ({ page, baseURL }) => {
  const origins = new Set<string>();
  page.on('request', (r) => origins.add(new URL(r.url()).origin));
  await page.goto(PATH);
  for (let y = 0; y < 30_000; y += 900) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(40);
  }
  await page.waitForLoadState('networkidle');
  expect([...origins]).toEqual([new URL(baseURL!).origin]);
});

test('equations are MathML, rendered at build time, and never overflow on desktop', async ({ page, isMobile }) => {
  await page.goto(PATH);
  expect(await page.locator('math').count()).toBeGreaterThan(40);
  // No style attributes in the served HTML (the CSP forbids them; scripts may still set styles via the CSSOM).
  const html = await (await page.request.get(PATH)).text();
  expect(html).not.toMatch(/\sstyle="/);
  test.skip(isMobile, 'phones may scroll a long equation inside its own box');
  const wide = await page.locator('.eq__math').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent!.slice(0, 40)));
  expect(wide).toEqual([]);
});

test.describe('opening scene', () => {
  test('scrolling walks through the six stages', async ({ page }) => {
    await page.goto(PATH);
    const scene = page.locator('[data-op]');
    for (const [f, step] of [[0, 0], [0.4, 2], [1, 5]] as const) {
      await scene.evaluate((el, f) => scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.getBoundingClientRect().height - innerHeight) * f), f);
      await expect(page.locator(`[data-op-step="${step}"]`)).toHaveAttribute('aria-current', 'step');
    }
    expect(Number(await page.locator('[data-op-layer="4"]').evaluate((e) => getComputedStyle(e).opacity))).toBeGreaterThan(0.99);
  });

  test('with reduced motion, the stage buttons switch the picture directly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PATH);
    await page.getByRole('button', { name: /Stage 03/ }).click();
    await expect(page.locator('[data-op-step="2"]')).toHaveAttribute('aria-current', 'step');
    expect(Number(await page.locator('[data-op-layer="2"]').evaluate((e) => getComputedStyle(e).opacity))).toBe(1);
    expect(await page.locator('[data-op]').evaluate((e) => e.getBoundingClientRect().height)).toBeLessThan(page.viewportSize()!.height * 2);
  });
});

test('pixel microscope: arrow keys move the pixel; switching red off zeroes R', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="pixels"]');
  const x = page.locator('[data-px-x]');
  const before = await x.textContent();
  await page.locator('[data-px-canvas]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(x).not.toHaveText(before!);
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Red', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-px-r]')).toHaveText('0');
});

test('alpha lab: the shown C equals αF + (1 − α)B, and opacity 0 shows only B', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="alpha"]');
  const read = async () => {
    const a = Number(await page.locator('[data-al-a]').textContent());
    const v = async (k: string) => Number(await page.locator(`[data-al-v="${k}"]`).textContent());
    return { a, f: [await v('f0'), await v('f1'), await v('f2')], b: [await v('b0'), await v('b1'), await v('b2')], c: [await v('c0'), await v('c1'), await v('c2')] };
  };
  const r = await read();
  expect(r.a).toBeGreaterThan(0.05);
  expect(r.a).toBeLessThan(0.95);
  // α is shown to 2 decimals; allow for that rounding.
  for (let k = 0; k < 3; k++) expect(Math.abs(r.c[k] - (r.a * r.f[k] + (1 - r.a) * r.b[k]))).toBeLessThanOrEqual(Math.abs(r.f[k] - r.b[k]) * 0.006 + 1);
  await page.locator('[data-al-op]').fill('0');
  await expect(page.locator('[data-al-note]')).toContainText('Fully transparent');
  const z = await read();
  expect(z.c).toEqual(z.b);
  await page.getByRole('radio', { name: 'Binary mask' }).click();
  await expect(page.getByRole('radio', { name: 'Binary mask' })).toHaveAttribute('aria-checked', 'true');
});

test('architecture: choosing a block shows its explanation; Technical switches depth', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="model"]');
  await page.locator('[data-arch-node="e4"]').click();
  await expect(page.locator('[data-arch-node="e4"]')).toHaveAttribute('aria-pressed', 'true');
  const detail = page.locator('[data-arch-for="e4"]');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.ad__plain')).toBeVisible();
  await page.getByRole('radio', { name: 'Technical' }).click();
  await expect(detail.locator('.ad__tech')).toBeVisible();
  await expect(detail.locator('.ad__plain')).toBeHidden();
});

test('edge lab: tabs switch samples; the synthetic scenes offer ground truth', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="edges"]');
  await expect(page.locator('#edge-panel-fur')).toBeVisible();
  await expect(page.locator('#edge-panel-fur').getByRole('radio', { name: 'Truth' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Strands' }).click();
  await expect(page.locator('#edge-panel-strands')).toBeVisible();
  await page.locator('#edge-panel-strands').getByRole('radio', { name: 'Error' }).click();
  await expect(page.locator('#edge-panel-strands').getByRole('radio', { name: 'Error' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('tab', { name: 'Strands' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#edge-panel-glass')).toBeVisible();
});

test('transform: a 90° rotation gives the rotation matrix; layers restack', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="transform"]');
  await page.locator('[data-xf="r"]').fill('90');
  await expect(page.locator('mn[data-xf-m="a"]')).toHaveText('0.000');
  await expect(page.locator('mn[data-xf-m="b"]')).toHaveText('1.000');
  await expect(page.locator('mn[data-xf-m="c"]')).toHaveText('-1.000');
  await page.getByRole('button', { name: 'Move Puppy up' }).click();
  await expect(page.locator('[data-xf-order] li').first()).toHaveAttribute('data-xf-item', 'puppy');
  const last = await page.locator('[data-xf-layers] > g').last().getAttribute('data-xf-layer');
  expect(last).toBe('puppy');
});

test('brush: a stroke lowers the mask, Reset restores it', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="brush"]');
  const alphaSum = () =>
    page.locator('[data-br-canvas]').evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 3; i < d.length; i += 4) s += d[i];
      return s;
    });
  const before = await alphaSum();
  await page.getByRole('button', { name: 'Erase a sample stroke' }).click();
  const after = await alphaSum();
  expect(after).toBeLessThan(before);
  await page.getByRole('button', { name: 'Reset' }).click();
  expect(await alphaSum()).toBe(before);
});

test('magic wand: a larger tolerance never selects less', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="wand"]');
  const pct = async () => Number((await page.locator('[data-wd-note]').textContent())!.match(/Selected ([\d.]+) %/)![1]);
  await page.locator('[data-wd="tol"]').fill('4');
  const small = await pct();
  await page.locator('[data-wd="tol"]').fill('40');
  expect(await pct()).toBeGreaterThanOrEqual(small);
});

test('refine edges: Shift moves the curve', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="refine"]');
  const d0 = await page.locator('[data-rf-path="out"]').getAttribute('d');
  await page.locator('[data-rf-in="shift"]').fill('6');
  await expect(page.locator('[data-rf-path="out"]')).not.toHaveAttribute('d', d0!);
});

test('floating point: 65504 is FP16’s largest value; 70000 overflows', async ({ page }) => {
  await page.goto(PATH);
  await reach(page, '[data-sci="float"]');
  const input = page.locator('[data-fp-in]');
  await input.fill('65504');
  await expect(page.locator('[data-fp-val="16"]')).toContainText('exact');
  await input.fill('70000');
  await expect(page.locator('[data-fp-val="16"]')).toContainText('overflow');
  await input.fill('0.1');
  await expect(page.locator('[data-fp-val="16"]')).toContainText('0.099976');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every stage, explanation and sample is readable', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.locator('h1')).toContainText('The invisible boundary');
    for (const d of await page.locator('.op__d').all()) await expect(d).toBeVisible();
    for (const l of await page.locator('.op__layer:not(.op__band)').all()) await expect(l).toBeVisible();
    await expect(page.locator('.ad')).toHaveCount(9);
    for (const d of await page.locator('.ad').all()) await expect(d).toBeVisible();
    for (const p of await page.locator('[data-edge-panel]').all()) await expect(p).toBeVisible();
    for (const img of await page.locator('.lab__fallback').all()) await expect(img).toBeVisible();
    expect((await page.locator('[data-rf-path="refined"]').getAttribute('d'))!.length).toBeGreaterThan(100);
    expect(await page.locator('math').count()).toBeGreaterThan(40);
  });
});
