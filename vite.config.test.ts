import { describe, expect, it } from 'vitest';

import { createViteConfig, resolveBuildProfile } from './vite.config';

const commit = '0123456789abcdef0123456789abcdef01234567';

describe('Vite build profiles', () => {
  it('keeps the public GitHub Pages base and output directory', () => {
    const profile = resolveBuildProfile('production');
    const config = createViteConfig('production', commit);

    expect(profile.context).toBe('web');
    expect(config.base).toBe('/poster/');
    expect(config.build?.outDir).toBe('dist');
  });

  it('uses relocatable paths and an isolated embedded output directory', () => {
    const profile = resolveBuildProfile('embedded');
    const config = createViteConfig('embedded', commit);

    expect(profile.context).toBe('embedded');
    expect(config.base).toBe('./');
    expect(config.build?.outDir).toBe('dist-embedded');
    expect(config.plugins).toHaveLength(2);
  });
});
