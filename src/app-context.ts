export const appContexts = ['web', 'embedded'] as const;

export type AppContext = (typeof appContexts)[number];

interface AppContextRoot {
  dataset: DOMStringMap;
}

/** Resolves the single build-time distinction exposed to Poster Forge. */
export const resolveAppContext = (mode: string): AppContext =>
  mode === 'embedded' ? 'embedded' : 'web';

/** Reads the context that Vite injected into HTML before the first paint. */
export const readAppContext = (root: AppContextRoot = document.documentElement): AppContext =>
  root.dataset.appContext === 'embedded' ? 'embedded' : 'web';
