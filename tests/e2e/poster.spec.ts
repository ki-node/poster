import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Make some');
});

test('remixes a deterministic poster and switches design systems', async ({ page }) => {
  const seed = page.locator('[data-seed-label]');
  const initialSeed = await seed.textContent();

  await page.getByRole('button', { name: 'Remix poster' }).click();
  await expect(seed).not.toHaveText(initialSeed ?? '');
  await expect(page.locator('[data-status]')).toContainText('Neue Komposition');

  await page.getByLabel('Orbit').check();
  await expect(page.getByLabel('Orbit')).toBeChecked();

  await page.getByLabel('Headline').fill('BRAVE NEW TYPE');
  await expect(page.getByLabel('Headline')).toHaveValue('BRAVE NEW TYPE');
});

test('exports the current composition as a PNG', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^poster-forge-\d{6}\.png$/);
});

test('reflows at 320 CSS pixels without clipping controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  for (const control of [
    page.getByLabel('Headline'),
    page.getByLabel('Grid'),
    page.getByRole('button', { name: 'Remix poster' }),
    page.getByRole('button', { name: 'Export PNG' }),
  ]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(321);
  }
});

test('has no automatically detectable WCAG A/AA violations', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'axe-core is validated in mobile and desktop Chromium.');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('honours reduced motion and forced colors', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Media emulation is validated in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.reload();

  const animationDurationMs = await page.locator('.intro').evaluate((element) => {
    const duration = getComputedStyle(element, '::before').animationDuration;
    return duration.endsWith('ms')
      ? Number.parseFloat(duration)
      : Number.parseFloat(duration) * 1000;
  });

  expect(animationDurationMs).toBeLessThanOrEqual(0.01);
  await page.getByRole('button', { name: 'Remix poster' }).focus();
  await expect(page.getByRole('button', { name: 'Remix poster' })).toBeFocused();
});
