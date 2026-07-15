import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const embeddedUrl = 'http://127.0.0.1:4174/projects/poster/index.html';

const openInOrbitFrame = async (page: Page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <!doctype html>
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <style>
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #01011b; }
        .toolbar { height: 104px; padding: 24px; color: white; font: 700 20px system-ui; }
        iframe { display: block; width: 100%; height: calc(100% - 104px); border: 0; }
      </style>
    </head><body>
      <div class="toolbar">Orbit · Poster</div>
      <iframe
        title="Poster Forge in Orbit"
        sandbox="allow-downloads allow-forms allow-same-origin allow-scripts"
        src="${embeddedUrl}"
      ></iframe>
    </body></html>
  `);

  const frame = page.frameLocator('iframe');
  await expect(frame.locator('html')).toHaveAttribute('data-app-context', 'embedded');
  await expect(frame.getByRole('heading', { level: 2, name: 'Forge controls' })).toBeVisible();

  return frame;
};

test('injects embedded context before scripts and uses only relative local assets', async ({
  request,
}) => {
  const response = await request.get(embeddedUrl);
  const html = await response.text();

  expect(html).toMatch(/<html lang="de" data-app-context="embedded">/u);
  expect(html.indexOf('data-app-context="embedded"')).toBeLessThan(html.indexOf('<script'));

  for (const reference of [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/giu)].map(
    (match) => match[1],
  )) {
    if (!reference || /^(?:[a-z]+:|\/\/|#)/iu.test(reference)) continue;
    expect(reference.startsWith('/')).toBe(false);
    expect(new URL(reference, embeddedUrl).pathname).toMatch(/^\/projects\/poster\//u);
  }
});

test('loads offline at a nested path without extra app chrome or viewport overflow', async ({
  page,
}) => {
  const runtimeRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4174') {
      runtimeRequests.push(url.href);
      await route.continue();
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      await route.abort('internetdisconnected');
    } else {
      await route.continue();
    }
  });

  const frame = await openInOrbitFrame(page);
  await expect(frame.locator('.masthead')).toBeHidden();
  await expect(frame.locator('.intro')).toBeHidden();
  await expect(frame.locator('[data-poster]')).toBeVisible();

  const layout = await frame.locator('html').evaluate(() => {
    const studio = document.querySelector<HTMLElement>('[data-studio]')?.getBoundingClientRect();
    const poster = document
      .querySelector<HTMLElement>('[data-poster-frame]')
      ?.getBoundingClientRect();
    const controls = document
      .querySelector<HTMLElement>('.studio__controls')
      ?.getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      studioTop: studio?.top ?? -1,
      studioHeight: studio?.height ?? 0,
      viewportHeight: window.innerHeight,
      posterWidth: poster?.width ?? 0,
      controlsWidth: controls?.width ?? 0,
      safeTop: getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim(),
    };
  });

  expect(layout.studioTop).toBeCloseTo(0, 0);
  expect(layout.studioHeight).toBeGreaterThanOrEqual(layout.viewportHeight);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.posterWidth).toBeGreaterThan(250);
  expect(layout.controlsWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.safeTop).toBe('0px');
  expect(runtimeRequests.length).toBeGreaterThan(2);
  expect(runtimeRequests.every((url) => url.startsWith('http://127.0.0.1:4174/'))).toBe(true);
});

test('keeps preview, seed, remix, undo and redo usable in the mobile iframe', async ({ page }) => {
  const frame = await openInOrbitFrame(page);
  const seed = frame.locator('[data-seed-label]');
  const initialSeed = await seed.textContent();

  await frame.getByRole('button', { name: 'Remix layout' }).click();
  const remixedSeed = await seed.textContent();
  expect(remixedSeed).not.toBe(initialSeed);

  await frame.getByRole('button', { name: 'Undo' }).click();
  await expect(seed).toHaveText(initialSeed ?? '');
  await frame.getByRole('button', { name: 'Redo' }).click();
  await expect(seed).toHaveText(remixedSeed ?? '');

  await frame.locator('[data-advanced] summary').scrollIntoViewIfNeeded();
  const miniPreview = frame.getByRole('button', {
    name: 'Zur großen Poster-Vorschau springen',
  });
  await expect(miniPreview).toBeVisible();
  await miniPreview.click();
  await expect(frame.locator('[data-poster-frame]')).toBeInViewport();
});

test('keeps details focus and reduced motion behavior intact in embedded WebKit', async ({
  page,
  browserName,
}) => {
  if (browserName !== 'webkit') await page.emulateMedia({ reducedMotion: 'reduce' });
  const frame = await openInOrbitFrame(page);
  const summary = frame.locator('[data-advanced] summary');

  await summary.focus();
  await expect(summary).toBeFocused();
  await summary.press('Enter');
  await expect(frame.locator('[data-advanced]')).toHaveAttribute('open', '');
  await expect(frame.locator('dialog')).toHaveCount(0);

  if (browserName !== 'webkit') {
    const duration = await frame
      .locator('.studio')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration) || 0);
    expect(duration).toBeLessThanOrEqual(0.01);
  }
});

test('destroys on pagehide and starts cleanly when the iframe is reopened', async ({ page }) => {
  const frame = await openInOrbitFrame(page);
  const seed = frame.locator('[data-seed-label]');
  const beforeDestroy = await seed.textContent();

  await frame.locator('html').evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await frame.getByRole('button', { name: 'Remix layout' }).click();
  await expect(seed).toHaveText(beforeDestroy ?? '');

  await page.locator('iframe').evaluate((element, source) => {
    (element as HTMLIFrameElement).src = `${source}?reopen=1`;
  }, embeddedUrl);
  await expect(frame.locator('html')).toHaveAttribute('data-app-context', 'embedded');
  const reopenedSeed = await seed.textContent();
  await frame.getByRole('button', { name: 'Remix layout' }).click();
  await expect(seed).not.toHaveText(reopenedSeed ?? '');
});

test('requires no Orbit bridge and remains accessible with browser fallbacks', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const frame = await openInOrbitFrame(page);

  await expect(frame.locator('html')).toHaveAttribute('data-app-context', 'embedded');
  expect(
    await frame.locator('html').evaluate(() => 'OrbitBridge' in window || 'orbitBridge' in window),
  ).toBe(false);
  await frame.getByRole('button', { name: 'Remix layout' }).click();
  expect(errors).toEqual([]);

  if (browserName === 'webkit') return;

  await page.goto(embeddedUrl);
  await page.locator('[data-advanced]').evaluate((details) => details.setAttribute('open', ''));
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
