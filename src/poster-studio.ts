import {
  renderPoster,
  type PosterPalette,
  type PosterSettings,
  type PosterStyle,
} from './poster-renderer';

const isPosterStyle = (value: FormDataEntryValue | null): value is PosterStyle =>
  value === 'grid' || value === 'orbit' || value === 'signal';

const isPosterPalette = (value: FormDataEntryValue | null): value is PosterPalette =>
  value === 'acid' || value === 'ink' || value === 'solar';

/** Owns the poster form, deterministic rendering, animation and local PNG export. */
export class PosterStudio {
  private readonly root = document.querySelector<HTMLElement>('[data-studio]');
  private readonly form = this.root?.querySelector<HTMLFormElement>('[data-controls]');
  private readonly canvas = this.root?.querySelector<HTMLCanvasElement>('[data-poster]');
  private readonly seedLabel = this.root?.querySelector<HTMLElement>('[data-seed-label]');
  private readonly intensityOutput =
    this.root?.querySelector<HTMLOutputElement>('[data-intensity]');
  private readonly status = this.root?.querySelector<HTMLElement>('[data-status]');
  private readonly abortController = new AbortController();
  private readonly motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private context: CanvasRenderingContext2D | null = null;
  private seed = '000000';
  private frame: number | null = null;
  private lastPaint = 0;
  private startTime = performance.now();

  init() {
    if (!this.root || !this.form || !this.canvas) return;

    this.context = this.canvas.getContext('2d');
    if (!this.context) return;

    this.seed = this.createSeed();
    const signal = this.abortController.signal;

    this.form.addEventListener('input', this.handleInput, { signal });
    this.root.querySelector('[data-remix]')?.addEventListener('click', this.remix, { signal });
    this.root
      .querySelector('[data-download]')
      ?.addEventListener('click', this.download, { signal });
    this.motionPreference.addEventListener('change', this.handleMotionChange, { signal });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { signal });

    this.paint();
    this.updateAnimation();
  }

  destroy() {
    this.abortController.abort();
    this.stopAnimation();
  }

  private readonly handleInput = () => {
    this.paint();
  };

  private readonly handleMotionChange = () => {
    this.updateAnimation();
    this.paint();
  };

  private readonly handleVisibilityChange = () => {
    this.updateAnimation();
  };

  private readonly remix = () => {
    this.seed = this.createSeed();
    this.startTime = performance.now();
    this.paint();
    this.status?.replaceChildren(`Neue Komposition mit Seed ${this.seed} erstellt.`);
  };

  private readonly download = () => {
    if (!this.canvas) return;

    const settings = this.getSettings();
    if (this.context) renderPoster(this.context, settings);

    this.canvas.toBlob((blob) => {
      if (!blob) {
        this.status?.replaceChildren('Der PNG-Export konnte nicht erstellt werden.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `poster-forge-${this.seed}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      this.status?.replaceChildren(`Poster ${this.seed} als PNG exportiert.`);
      this.updateAnimation();
    }, 'image/png');
  };

  private readonly animate = (timestamp: number) => {
    if (timestamp - this.lastPaint >= 100) {
      this.paint((timestamp - this.startTime) / 1000);
      this.lastPaint = timestamp;
    }

    this.frame = window.requestAnimationFrame(this.animate);
  };

  private paint(phase = 0) {
    if (!this.context) return;

    const settings = this.getSettings();
    renderPoster(this.context, settings, phase);
    this.seedLabel?.replaceChildren(`SEED ${this.seed}`);
    this.intensityOutput?.replaceChildren(String(settings.intensity));
  }

  private getSettings(): PosterSettings {
    const data = new FormData(this.form ?? undefined);
    const style = data.get('style');
    const palette = data.get('palette');
    const intensity = Number(data.get('intensity'));
    const title = data.get('title');
    const subtitle = data.get('subtitle');

    return {
      title: typeof title === 'string' ? title : '',
      subtitle: typeof subtitle === 'string' ? subtitle : '',
      style: isPosterStyle(style) ? style : 'grid',
      palette: isPosterPalette(palette) ? palette : 'acid',
      intensity: Number.isFinite(intensity) ? intensity : 72,
      seed: this.seed,
    };
  }

  private createSeed() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String((values[0] ?? 0) % 1_000_000).padStart(6, '0');
  }

  private updateAnimation() {
    const shouldAnimate = !this.motionPreference.matches && document.visibilityState !== 'hidden';

    if (shouldAnimate && this.frame === null) {
      this.frame = window.requestAnimationFrame(this.animate);
    } else if (!shouldAnimate) {
      this.stopAnimation();
    }
  }

  private stopAnimation() {
    if (this.frame === null) return;
    window.cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
