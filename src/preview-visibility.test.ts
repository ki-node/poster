import { describe, expect, it, vi } from 'vitest';

import {
  canKeepLargePreviewSticky,
  createPreviewVisibilityController,
  shouldShowMiniPreview,
} from './preview-visibility';

describe('preview visibility invariant', () => {
  it('uses hysteresis and only shows the fallback while controls are visible', () => {
    expect(shouldShowMiniPreview(0.4, false, false)).toBe(false);
    expect(shouldShowMiniPreview(0.55, true, false)).toBe(true);
    expect(shouldShowMiniPreview(0.65, true, true)).toBe(true);
    expect(shouldShowMiniPreview(0.72, true, true)).toBe(false);
  });

  it('requires both sufficient width and usable visual viewport height for sticky mode', () => {
    expect(canKeepLargePreviewSticky(1024, 768)).toBe(true);
    expect(canKeepLargePreviewSticky(844, 390)).toBe(false);
    expect(canKeepLargePreviewSticky(800, 900)).toBe(false);
  });

  it('initializes once, reacts to observer state and fully disconnects', () => {
    const callbacks: IntersectionObserverCallback[] = [];
    const disconnect = vi.fn();
    const observe = vi.fn();
    const targetWindow = new EventTarget() as Window;
    Object.assign(targetWindow, {
      innerWidth: 844,
      innerHeight: 390,
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
      cancelAnimationFrame: vi.fn(),
    });
    const rect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 390,
      width: 400,
      height: 390,
      toJSON: () => undefined,
    };
    const posterFrame = { getBoundingClientRect: () => rect } as HTMLElement;
    const controls = { getBoundingClientRect: () => rect } as HTMLElement;
    const miniPreview = { hidden: true } as HTMLButtonElement;
    const controller = createPreviewVisibilityController({
      posterFrame,
      controls,
      miniPreview,
      targetWindow,
      createIntersectionObserver: (callback) => {
        callbacks.push(callback);
        return { observe, disconnect };
      },
      createResizeObserver: () => ({ observe, disconnect }),
    });

    controller.init();
    controller.init();
    expect(observe).toHaveBeenCalledTimes(4);

    callbacks[1]?.(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    callbacks[0]?.(
      [{ isIntersecting: true, intersectionRatio: 0.4 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(miniPreview.hidden).toBe(false);

    controller.destroy();
    controller.destroy();
    expect(disconnect).toHaveBeenCalledTimes(3);
    expect(miniPreview.hidden).toBe(true);

    callbacks[0]?.(
      [{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(miniPreview.hidden).toBe(true);
  });
});
