import { describe, expect, it, vi } from 'vitest';

import { mountPosterForge } from './app-lifecycle';

class LifecycleDocument extends EventTarget {
  constructor(readonly readyState: DocumentReadyState) {
    super();
  }
}

const createHarness = (readyState: DocumentReadyState) => {
  const targetWindow = new EventTarget();
  const targetDocument = new LifecycleDocument(readyState);
  const app = { init: vi.fn(), destroy: vi.fn() };
  const createApp = vi.fn(() => app);
  const lifecycle = mountPosterForge({
    targetWindow: targetWindow as unknown as Window,
    targetDocument: targetDocument as unknown as Document,
    createApp,
  });

  return { targetWindow, targetDocument, app, createApp, lifecycle };
};

describe('Poster Forge lifecycle', () => {
  it('starts only once after the DOM becomes ready and cleans up once on pagehide', () => {
    const { targetWindow, targetDocument, app, createApp } = createHarness('loading');

    targetDocument.dispatchEvent(new Event('DOMContentLoaded'));
    targetDocument.dispatchEvent(new Event('DOMContentLoaded'));
    expect(createApp).toHaveBeenCalledOnce();
    expect(app.init).toHaveBeenCalledOnce();

    targetWindow.dispatchEvent(new Event('pagehide'));
    targetWindow.dispatchEvent(new Event('pagehide'));
    expect(app.destroy).toHaveBeenCalledOnce();
  });

  it('prevents late initialization after explicit cleanup', () => {
    const { targetDocument, app, lifecycle } = createHarness('loading');

    lifecycle.destroy();
    targetDocument.dispatchEvent(new Event('DOMContentLoaded'));

    expect(app.init).not.toHaveBeenCalled();
    expect(app.destroy).not.toHaveBeenCalled();
  });

  it('allows a fresh iframe document to create a fresh single instance', () => {
    const first = createHarness('complete');
    first.lifecycle.destroy();
    const second = createHarness('complete');

    expect(first.app.init).toHaveBeenCalledOnce();
    expect(first.app.destroy).toHaveBeenCalledOnce();
    expect(second.app.init).toHaveBeenCalledOnce();
    expect(second.app.destroy).not.toHaveBeenCalled();
  });
});
