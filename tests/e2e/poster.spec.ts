import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Make some');
});

test('remixes a deterministic poster and switches design systems', async ({ page }) => {
  const seed = page.locator('[data-seed-label]');
  const initialSeed = await seed.textContent();

  await page.getByRole('button', { name: 'Remix layout' }).click();
  await expect(seed).not.toHaveText(initialSeed ?? '');
  await expect(page.locator('[data-status]')).toContainText('Neue Komposition');

  await page.getByLabel('Orbit').check();
  await expect(page.getByLabel('Orbit')).toBeChecked();

  await page.getByLabel('Headline').fill('BRAVE NEW TYPE');
  await expect(page.getByLabel('Headline')).toHaveValue('BRAVE NEW TYPE');
});

test('accepts a reusable seed and restores the complete state from the URL', async ({ page }) => {
  await page.locator('[data-advanced] summary').click();
  await page.getByLabel('Seed').fill('MY-SEED-42');
  await page.getByLabel('Format').selectOption('square');
  await page.getByLabel('Typeface').selectOption('serif');
  await page.getByLabel('Alignment').selectOption('center');

  await expect(page).toHaveURL(/seed=MY-SEED-42/);
  await page.reload();

  await expect(page.getByLabel('Seed')).toHaveValue('MY-SEED-42');
  await expect(page.getByLabel('Format')).toHaveValue('square');
  await expect(page.getByLabel('Typeface')).toHaveValue('serif');
  await expect(page.getByLabel('Alignment')).toHaveValue('center');
  await expect(page.locator('[data-poster]')).toHaveAttribute('width', '1200');
  await expect(page.locator('[data-poster]')).toHaveAttribute('height', '1200');
});

test('supports undo and redo across generated layouts', async ({ page }) => {
  const seed = page.locator('[data-seed-label]');
  const initialSeed = await seed.textContent();

  await page.getByRole('button', { name: 'Remix layout' }).click();
  const remixedSeed = await seed.textContent();
  expect(remixedSeed).not.toBe(initialSeed);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(seed).toHaveText(initialSeed ?? '');

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(seed).toHaveText(remixedSeed ?? '');
});

test('reveals system-specific tuning and respects surprise locks', async ({ page }) => {
  await page.locator('[data-advanced] summary').click();
  const headline = page.getByLabel('Headline');
  const initialHeadline = await headline.inputValue();

  await expect(page.locator('[data-system-controls="grid"]')).toBeVisible();
  await page.getByLabel('Orbit').check();
  await expect(page.locator('[data-system-controls="grid"]')).toBeHidden();
  await expect(page.locator('[data-system-controls="orbit"]')).toBeVisible();

  await page.getByRole('button', { name: 'Surprise me' }).click();
  await expect(headline).toHaveValue(initialHeadline);

  await page.locator('input[name="lockCopy"]').uncheck();
  await page.getByRole('button', { name: 'Surprise me' }).click();
  await expect(headline).not.toHaveValue(initialHeadline);

  const pause = page.getByRole('button', { name: 'Pause animation' });
  await pause.click();
  await expect(page.locator('[data-pause]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
});

test('exports the current composition as a PNG', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^poster-forge-\d{6}-portrait\.png$/);
});

test('keeps a tappable live preview visible beside mobile controls', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The floating mini poster is a mobile aid.');

  await page.getByRole('heading', { name: 'Forge controls' }).scrollIntoViewIfNeeded();
  const miniPreview = page.getByRole('button', { name: 'Zur großen Poster-Vorschau springen' });

  await expect(miniPreview).toBeVisible();
  await miniPreview.click();
  await expect(page.locator('[data-poster-frame]')).toBeInViewport();
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
    page.getByRole('button', { name: 'Remix layout' }),
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

  await page.locator('[data-advanced]').evaluate((details) => details.setAttribute('open', ''));

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
  await page.getByRole('button', { name: 'Remix layout' }).focus();
  await expect(page.getByRole('button', { name: 'Remix layout' })).toBeFocused();
});
