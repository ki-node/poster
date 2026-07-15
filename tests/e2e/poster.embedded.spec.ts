import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const embeddedUrl = 'http://127.0.0.1:4174/projects/poster/index.html';

const openInOrbitFrame = async (page: Page, { bridge = true } = {}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const bridgeScript = bridge
    ? `<script>
        window.__posterExports = [];
        const sendHostReady = (target) => target?.postMessage({
          channel: 'orbit-project-bridge',
          version: 1,
          projectId: 'poster',
          type: 'host-ready',
          capabilities: ['file-export'],
        }, '*');
        window.addEventListener('message', (event) => {
          const message = event.data;
          if (message?.channel !== 'orbit-project-bridge' || message?.projectId !== 'poster') return;
          if (message.type === 'project-ready') sendHostReady(event.source);
          if (message.type === 'file-export') {
            window.__posterExports.push(message);
            event.source.postMessage({
              channel: 'orbit-project-bridge',
              version: 1,
              projectId: 'poster',
              type: 'file-export-result',
              requestId: message.requestId,
              status: 'shared',
            }, '*');
          }
        });
        window.addEventListener('load', () => {
          sendHostReady(document.querySelector('iframe')?.contentWindow);
        }, { once: true });
      </script>`
    : '';
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
      ${bridgeScript}
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

const posterBitmap = async (frame: ReturnType<Page['frameLocator']>) =>
  frame.locator('[data-poster]').evaluate((canvas) => {
    const main = canvas as HTMLCanvasElement;
    const mini = document.querySelector<HTMLCanvasElement>('[data-poster-mini]');
    const hash = (source: HTMLCanvasElement) => {
      const pixels = source
        .getContext('2d', { willReadFrequently: true })
        ?.getImageData(0, 0, source.width, source.height).data;
      let value = 2_166_136_261;
      for (const byte of pixels ?? []) {
        value ^= byte;
        value = Math.imul(value, 16_777_619);
      }
      return value >>> 0;
    };

    return {
      main: { width: main.width, height: main.height, hash: hash(main) },
      mini: mini ? { width: mini.width, height: mini.height, hash: hash(mini) } : undefined,
    };
  });

const expectCanonicalPreview = async (frame: ReturnType<Page['frameLocator']>) => {
  const bitmap = await posterBitmap(frame);
  expect(bitmap.mini).toEqual(bitmap.main);
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

test('mirrors one canonical poster bitmap for every format, history and animation state', async ({
  page,
}) => {
  const frame = await openInOrbitFrame(page);
  await frame.locator('[data-advanced] summary').click();
  const format = frame.getByLabel('Format');
  const exportScale = frame.getByLabel('Export resolution');

  for (const value of ['portrait', 'square', 'story', 'landscape']) {
    await format.selectOption(value);
    await expectCanonicalPreview(frame);
    await exportScale.selectOption('2');
    await expectCanonicalPreview(frame);
    await exportScale.selectOption('1');
  }

  await frame.getByLabel('Headline').fill('IDENTICAL TYPE WRAP');
  await frame.getByLabel('Type scale').fill('135');
  await expectCanonicalPreview(frame);

  const seedBeforeRemix = await frame.locator('[data-seed-label]').textContent();
  await frame.getByRole('button', { name: 'Remix layout' }).click();
  await expectCanonicalPreview(frame);
  await frame.getByRole('button', { name: 'Undo' }).click();
  await expect(frame.locator('[data-seed-label]')).toHaveText(seedBeforeRemix ?? '');
  await expectCanonicalPreview(frame);
  await frame.getByRole('button', { name: 'Redo' }).click();
  await expectCanonicalPreview(frame);

  await page.waitForTimeout(150);
  await expectCanonicalPreview(frame);
  await frame.getByRole('button', { name: 'Pause animation' }).click();
  await expectCanonicalPreview(frame);
});

test('sends one binary export through Orbit without navigating the iframe', async ({ page }) => {
  const frame = await openInOrbitFrame(page);
  const sourceBefore = await page.locator('iframe').getAttribute('src');
  await frame.getByRole('button', { name: 'Export PNG' }).click();
  await expect(frame.locator('[data-status]')).toContainText('an Orbit übergeben');

  const exports = await page.evaluate(() =>
    (
      window as Window & {
        __posterExports?: Array<{
          type: string;
          mimeType: string;
          size: number;
          data: ArrayBuffer;
        }>;
      }
    ).__posterExports?.map((message) => ({
      type: message.type,
      mimeType: message.mimeType,
      size: message.size,
      byteLength: message.data.byteLength,
    })),
  );
  expect(exports).toHaveLength(1);
  expect(exports?.[0]).toMatchObject({
    type: 'file-export',
    mimeType: 'image/png',
  });
  expect(exports?.[0]?.size).toBeGreaterThan(0);
  expect(exports?.[0]?.byteLength).toBe(exports?.[0]?.size);
  expect(await page.locator('iframe').getAttribute('src')).toBe(sourceBefore);
});

test('keeps seed and configuration clipboard fallbacks independent and repeatable', async ({
  page,
}) => {
  const frame = await openInOrbitFrame(page);
  await frame.locator('html').evaluate(() => {
    const state = { denied: false, writes: [] as string[] };
    Object.assign(window, { __clipboardState: state });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (state.denied) return Promise.reject(new Error('denied'));
          state.writes.push(text);
          return Promise.resolve();
        },
      },
    });
  });
  await frame.locator('[data-advanced] summary').click();
  const clickClearOfPreview = async (button: ReturnType<typeof frame.getByRole>) => {
    await button.evaluate((element) =>
      element.scrollIntoView({ block: 'center', inline: 'nearest' }),
    );
    await button.click();
  };

  await clickClearOfPreview(frame.getByRole('button', { name: 'Copy', exact: true }));
  await expect(frame.locator('[data-status]')).toContainText('Seed');
  await clickClearOfPreview(frame.getByRole('button', { name: 'Copy', exact: true }));
  await clickClearOfPreview(
    frame.getByRole('button', { name: /Copy shareable configuration link/u }),
  );
  await expect(frame.locator('[data-status]')).toContainText('Konfigurationslink');
  expect(
    await frame.locator('html').evaluate(
      () =>
        (
          window as Window & {
            __clipboardState?: { writes: string[] };
          }
        ).__clipboardState?.writes.length,
    ),
  ).toBe(3);

  await frame.locator('html').evaluate(() => {
    const state = (
      window as Window & {
        __clipboardState?: { denied: boolean };
      }
    ).__clipboardState;
    if (state) state.denied = true;
  });
  await clickClearOfPreview(frame.getByRole('button', { name: 'Copy', exact: true }));
  await expect(frame.locator('[data-status]')).toContainText('nicht in die Zwischenablage kopiert');
  await clickClearOfPreview(
    frame.getByRole('button', { name: /Copy shareable configuration link/u }),
  );
  await expect(frame.locator('[data-status]')).toContainText('nicht in die Zwischenablage kopiert');
});

test('keeps details focus and reduced motion behavior intact in embedded WebKit', async ({
  page,
  browserName,
}) => {
  if (browserName !== 'webkit') await page.emulateMedia({ reducedMotion: 'reduce' });
  const frame = await openInOrbitFrame(page, { bridge: false });
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
  const frame = await openInOrbitFrame(page, { bridge: false });
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
  const sourceBefore = await page.locator('iframe').getAttribute('src');
  await frame.getByRole('button', { name: 'Export PNG' }).click();
  await expect(frame.locator('[data-status]')).toContainText('Orbit-Host');
  expect(await page.locator('iframe').getAttribute('src')).toBe(sourceBefore);
  expect(errors).toEqual([]);

  if (browserName === 'webkit') return;

  await page.goto(embeddedUrl);
  await page.locator('[data-advanced]').evaluate((details) => details.setAttribute('open', ''));
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
