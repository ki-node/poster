/** Mirrors the canonical poster bitmap without recalculating typography or geometry. */
export const mirrorPosterPreview = (
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  targetContext: CanvasRenderingContext2D,
) => {
  if (target.width !== source.width || target.height !== source.height) {
    target.width = source.width;
    target.height = source.height;
  }

  targetContext.clearRect(0, 0, target.width, target.height);
  targetContext.drawImage(source, 0, 0);
};
