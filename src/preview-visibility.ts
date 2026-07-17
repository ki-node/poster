const showMiniBelowRatio = 0.56;
const hideMiniAboveRatio = 0.72;
const twoColumnViewportWidth = 52 * 16;
const minimumStickyViewportHeight = 15 * 16;

interface PreviewVisibilityObserver {
  disconnect(): void;
  observe(target: Element): void;
}

interface PreviewVisibilityOptions {
  posterFrame: HTMLElement;
  controls: HTMLElement;
  miniPreview: HTMLButtonElement;
  layoutRoot?: HTMLElement;
  targetWindow?: Window;
  createIntersectionObserver?: (
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit,
  ) => PreviewVisibilityObserver;
  createResizeObserver?: (callback: ResizeObserverCallback) => PreviewVisibilityObserver;
}

export interface PreviewVisibilityController {
  destroy(): void;
  init(): void;
  refresh(): void;
}

/** Applies hysteresis so the fallback does not flicker near the visibility boundary. */
export const shouldShowMiniPreview = (
  posterRatio: number,
  controlsVisible: boolean,
  miniVisible: boolean,
  stickyPreviewAvailable = false,
) =>
  controlsVisible &&
  !stickyPreviewAvailable &&
  (miniVisible ? posterRatio < hideMiniAboveRatio : posterRatio < showMiniBelowRatio);

export const canKeepLargePreviewSticky = (viewportWidth: number, viewportHeight: number) =>
  viewportWidth >= twoColumnViewportWidth && viewportHeight >= minimumStickyViewportHeight;

const intersectionRatio = (target: HTMLElement, targetWindow: Window) => {
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;

  const viewport = targetWindow.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportRight = viewportLeft + (viewport?.width ?? targetWindow.innerWidth);
  const viewportBottom = viewportTop + (viewport?.height ?? targetWindow.innerHeight);
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, viewportRight) - Math.max(rect.left, viewportLeft),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop),
  );

  return Math.min(1, (visibleWidth * visibleHeight) / (rect.width * rect.height));
};

const numberValue = (value: string) => Number.parseFloat(value) || 0;

export const calculatePosterDisplaySize = (
  availableWidth: number,
  availableHeight: number,
  aspectRatio: number,
  maximumWidth: number,
) => {
  const width = Math.max(1, Math.min(availableWidth, availableHeight * aspectRatio, maximumWidth));
  return { width, height: width / aspectRatio };
};

const fitStickyPoster = (posterFrame: HTMLElement, targetWindow: Window) => {
  const stage = posterFrame.parentElement;
  const canvas = posterFrame.querySelector<HTMLCanvasElement>('canvas');
  if (!stage || !canvas || canvas.width <= 0 || canvas.height <= 0) return;

  const stageStyle = targetWindow.getComputedStyle(stage);
  const rootFontSize = numberValue(
    targetWindow.getComputedStyle(targetWindow.document.documentElement).fontSize,
  );
  const metadata = stage.querySelector<HTMLElement>('.stage-meta');
  const availableWidth =
    stage.clientWidth - numberValue(stageStyle.paddingLeft) - numberValue(stageStyle.paddingRight);
  const availableHeight =
    stage.clientHeight -
    numberValue(stageStyle.paddingTop) -
    numberValue(stageStyle.paddingBottom) -
    (metadata?.offsetHeight ?? 0) -
    numberValue(stageStyle.rowGap);
  const aspectRatio = canvas.width / canvas.height;
  const size = calculatePosterDisplaySize(
    availableWidth,
    availableHeight,
    aspectRatio,
    36 * rootFontSize,
  );

  posterFrame.style.setProperty('--poster-display-width', `${String(size.width)}px`);
  posterFrame.style.setProperty('--poster-display-height', `${String(size.height)}px`);
};

const clearStickyPosterSize = (posterFrame: HTMLElement) => {
  posterFrame.style.removeProperty('--poster-display-width');
  posterFrame.style.removeProperty('--poster-display-height');
};

/** Owns the invariant that controls never remain without a useful live poster preview. */
export const createPreviewVisibilityController = ({
  posterFrame,
  controls,
  miniPreview,
  layoutRoot,
  targetWindow = window,
  createIntersectionObserver = (callback, options) => new IntersectionObserver(callback, options),
  createResizeObserver = (callback) => new ResizeObserver(callback),
}: PreviewVisibilityOptions): PreviewVisibilityController => {
  let initialized = false;
  let destroyed = false;
  let posterRatio = 1;
  let controlsVisible = false;
  let miniVisible = false;
  let stickyPreviewAvailable = false;
  let scheduledFrame: number | undefined;
  const observers: PreviewVisibilityObserver[] = [];
  const abortController = new AbortController();

  const update = () => {
    if (destroyed) return;
    miniVisible = shouldShowMiniPreview(
      posterRatio,
      controlsVisible,
      miniVisible,
      stickyPreviewAvailable,
    );
    miniPreview.hidden = !miniVisible;
  };

  const measure = () => {
    scheduledFrame = undefined;
    if (destroyed) return;
    const viewport = targetWindow.visualViewport;
    const supportsSticky = 'position' in targetWindow.document.documentElement.style;
    stickyPreviewAvailable =
      supportsSticky &&
      canKeepLargePreviewSticky(
        viewport?.width ?? targetWindow.innerWidth,
        viewport?.height ?? targetWindow.innerHeight,
      );
    layoutRoot?.classList.toggle('studio--sticky-preview', stickyPreviewAvailable);
    if (stickyPreviewAvailable) fitStickyPoster(posterFrame, targetWindow);
    else clearStickyPosterSize(posterFrame);
    posterRatio = intersectionRatio(posterFrame, targetWindow);
    controlsVisible = intersectionRatio(controls, targetWindow) > 0;
    update();
  };

  const scheduleMeasure = () => {
    if (destroyed || scheduledFrame !== undefined) return;
    scheduledFrame = targetWindow.requestAnimationFrame(measure);
  };

  const init = () => {
    if (initialized || destroyed) return;
    initialized = true;

    const posterObserver = createIntersectionObserver(
      ([entry]) => {
        if (!entry || destroyed) return;
        posterRatio = entry.intersectionRatio;
        update();
      },
      { threshold: [0, showMiniBelowRatio, hideMiniAboveRatio, 1] },
    );
    const controlsObserver = createIntersectionObserver(
      ([entry]) => {
        if (!entry || destroyed) return;
        controlsVisible = entry.isIntersecting && entry.intersectionRatio > 0;
        update();
      },
      { threshold: [0, 0.01] },
    );
    const resizeObserver = createResizeObserver(scheduleMeasure);

    posterObserver.observe(posterFrame);
    controlsObserver.observe(controls);
    resizeObserver.observe(posterFrame);
    const posterCanvas = posterFrame.querySelector('canvas');
    if (posterCanvas) resizeObserver.observe(posterCanvas);
    resizeObserver.observe(controls);
    observers.push(posterObserver, controlsObserver, resizeObserver);

    const signal = abortController.signal;
    targetWindow.addEventListener('resize', scheduleMeasure, { signal });
    targetWindow.addEventListener('pageshow', scheduleMeasure, { signal });
    targetWindow.visualViewport?.addEventListener('resize', scheduleMeasure, { signal });
    targetWindow.visualViewport?.addEventListener('scroll', scheduleMeasure, { signal });
    measure();
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    abortController.abort();
    observers.forEach((observer) => observer.disconnect());
    if (scheduledFrame !== undefined) targetWindow.cancelAnimationFrame(scheduledFrame);
    miniVisible = false;
    miniPreview.hidden = true;
    layoutRoot?.classList.remove('studio--sticky-preview');
    clearStickyPosterSize(posterFrame);
  };

  return { init, destroy, refresh: scheduleMeasure };
};
