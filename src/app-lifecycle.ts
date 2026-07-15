import { PosterStudio } from './poster-studio';

export interface PosterApplication {
  init(): void;
  destroy(): void;
}

interface PosterLifecycleOptions {
  targetWindow?: Window;
  targetDocument?: Document;
  createApp?: () => PosterApplication;
}

export interface PosterLifecycle {
  destroy(): void;
}

/** Owns the single page-level initialization and iframe cleanup boundary. */
export const mountPosterForge = ({
  targetWindow = window,
  targetDocument = document,
  createApp = () => new PosterStudio(),
}: PosterLifecycleOptions = {}): PosterLifecycle => {
  let app: PosterApplication | undefined;
  let destroyed = false;

  const start = () => {
    if (destroyed || app) return;
    app = createApp();
    app.init();
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    targetDocument.removeEventListener('DOMContentLoaded', start);
    targetWindow.removeEventListener('pagehide', destroy);
    app?.destroy();
    app = undefined;
  };

  if (targetDocument.readyState === 'loading') {
    targetDocument.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  targetWindow.addEventListener('pagehide', destroy, { once: true });

  return { destroy };
};
