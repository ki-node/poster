import { describe, expect, it, vi } from 'vitest';

import { mirrorPosterPreview } from './poster-preview';

describe('canonical poster preview', () => {
  it('copies the canonical canvas at identical bitmap dimensions without rerendering', () => {
    const source = { width: 1200, height: 1600 } as HTMLCanvasElement;
    const target = { width: 240, height: 320 } as HTMLCanvasElement;
    const clearRect = vi.fn();
    const drawImage = vi.fn();
    const context = {
      clearRect,
      drawImage,
    } as unknown as CanvasRenderingContext2D;

    mirrorPosterPreview(source, target, context);

    expect(target).toMatchObject({ width: 1200, height: 1600 });
    expect(clearRect).toHaveBeenCalledWith(0, 0, 1200, 1600);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0);
  });

  it('preserves square, story and landscape aspect ratios exactly', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    for (const [width, height] of [
      [1200, 1200],
      [1080, 1920],
      [1600, 1000],
    ]) {
      const source = { width, height } as HTMLCanvasElement;
      const target = { width: 1, height: 1 } as HTMLCanvasElement;
      mirrorPosterPreview(source, target, context);
      expect([target.width, target.height]).toEqual([width, height]);
    }
  });
});
