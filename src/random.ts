/** Converts an arbitrary string into a stable unsigned 32-bit seed. */
export const hashSeed = (value: string): number => {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

/** Returns a deterministic pseudo-random generator for reproducible compositions. */
export const createRandom = (initialSeed: number) => {
  let seed = initialSeed >>> 0;

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
