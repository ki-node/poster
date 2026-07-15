import { describe, expect, it } from 'vitest';

import { readAppContext, resolveAppContext } from './app-context';

const rootWithContext = (appContext?: string) =>
  ({ dataset: { appContext } }) as unknown as HTMLElement;

describe('application context', () => {
  it('uses the web context for normal Vite modes', () => {
    expect(resolveAppContext('production')).toBe('web');
    expect(resolveAppContext('development')).toBe('web');
  });

  it('uses embedded only for the explicit embedded build mode', () => {
    expect(resolveAppContext('embedded')).toBe('embedded');
    expect(readAppContext(rootWithContext('embedded'))).toBe('embedded');
  });

  it('falls back safely when no host or injected context exists', () => {
    expect(readAppContext(rootWithContext())).toBe('web');
    expect(readAppContext(rootWithContext('unknown'))).toBe('web');
  });
});
