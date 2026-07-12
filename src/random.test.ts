import { describe, expect, it } from 'vitest';
import { createRandom, hashSeed } from './random';

describe('poster randomness', () => {
  it('creates stable hashes and repeatable sequences', () => {
    expect(hashSeed('poster-001')).toBe(hashSeed('poster-001'));
    expect(hashSeed('poster-001')).not.toBe(hashSeed('poster-002'));

    const first = createRandom(42);
    const second = createRandom(42);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it('keeps generated values inside the unit interval', () => {
    const random = createRandom(2026);

    for (let index = 0; index < 100; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
