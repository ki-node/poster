import {
  defaultPosterSettings,
  paletteColors,
  posterFormats,
  renderPoster,
  type PosterAlign,
  type PosterFont,
  type PosterFormat,
  type PosterPalette,
  type PosterSettings,
  type PosterStyle,
} from './poster-renderer';
import { createBrowserPosterActions, type PosterActions } from './browser-actions';

const styles: readonly PosterStyle[] = ['grid', 'orbit', 'signal'];
const palettes: readonly Exclude<PosterPalette, 'custom'>[] = ['acid', 'ink', 'solar'];
const formats: readonly PosterFormat[] = ['portrait', 'square', 'story', 'landscape'];
const fonts: readonly PosterFont[] = ['grotesk', 'serif', 'mono'];
const alignments: readonly PosterAlign[] = ['left', 'center', 'right'];

const isIn = <Value extends string>(
  value: string | null,
  values: readonly Value[],
): value is Value => value !== null && values.includes(value as Value);

const numberValue = (
  data: FormData,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const value = Number(data.get(name));
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
};

const stringValue = (data: FormData, name: string, fallback = '') => {
  const value = data.get(name);
  return typeof value === 'string' ? value : fallback;
};

const randomItem = <Value>(values: readonly Value[]): Value => {
  const index = Math.floor(Math.random() * values.length);
  const value = values[index];
  if (value === undefined) throw new Error('Cannot choose from an empty collection.');
  return value;
};

const copyOptions = [
  ['BREAK THE GRID', 'GENERATIVE EDITION / UNBOUND'],
  ['MOVE DIFFERENT', 'FORM FOLLOWS ENERGY'],
  ['LOUD IDEAS', 'PRINTED BY THE BROWSER'],
  ['NEW FREQUENCY', 'SIGNAL STUDY / LIVE'],
] as const;

/** Owns poster controls, history, shareable state, animation and local PNG export. */
export class PosterStudio {
  private readonly root = document.querySelector<HTMLElement>('[data-studio]');
  private readonly form = this.root?.querySelector<HTMLFormElement>('[data-controls]');
  private readonly canvas = this.root?.querySelector<HTMLCanvasElement>('[data-poster]');
  private readonly miniCanvas = this.root?.querySelector<HTMLCanvasElement>('[data-poster-mini]');
  private readonly miniPreview = this.root?.querySelector<HTMLButtonElement>('[data-mini-preview]');
  private readonly posterFrame = this.root?.querySelector<HTMLElement>('[data-poster-frame]');
  private readonly controls = this.root?.querySelector<HTMLElement>('.studio__controls');
  private readonly seedLabel = this.root?.querySelector<HTMLElement>('[data-seed-label]');
  private readonly formatLabel = this.root?.querySelector<HTMLElement>('[data-format-label]');
  private readonly intensityOutput =
    this.root?.querySelector<HTMLOutputElement>('[data-intensity]');
  private readonly status = this.root?.querySelector<HTMLElement>('[data-status]');
  private readonly undoButton = this.root?.querySelector<HTMLButtonElement>('[data-undo]');
  private readonly redoButton = this.root?.querySelector<HTMLButtonElement>('[data-redo]');
  private readonly pauseButton = this.root?.querySelector<HTMLButtonElement>('[data-pause]');
  private readonly pauseLabel = this.root?.querySelector<HTMLElement>('[data-pause-label]');
  private readonly abortController = new AbortController();
  private readonly motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly observers: IntersectionObserver[] = [];
  private context: CanvasRenderingContext2D | null = null;
  private miniContext: CanvasRenderingContext2D | null = null;
  private frame: number | null = null;
  private lastPaint = 0;
  private startTime = performance.now();
  private paused = false;
  private posterVisible = true;
  private controlsVisible = false;
  private history: PosterSettings[] = [];
  private historyIndex = -1;
  private initialized = false;
  private destroyed = false;

  constructor(private readonly actions: PosterActions = createBrowserPosterActions()) {}

  init() {
    if (this.initialized || this.destroyed) return;
    if (!this.root || !this.form || !this.canvas) return;

    this.context = this.canvas.getContext('2d');
    this.miniContext = this.miniCanvas?.getContext('2d') ?? null;
    if (!this.context) return;
    this.initialized = true;

    const signal = this.abortController.signal;
    const urlSettings = this.readUrlSettings();
    const initialSettings = urlSettings ?? {
      ...defaultPosterSettings,
      colors: { ...defaultPosterSettings.colors },
      seed: this.createSeed(),
    };

    this.applySettings(initialSettings, Boolean(urlSettings));
    this.commitHistory(initialSettings, false);

    this.form.addEventListener('input', this.handleInput, { signal });
    this.form.addEventListener('change', this.handleChange, { signal });
    this.root.querySelector('[data-remix]')?.addEventListener('click', this.remix, { signal });
    this.root
      .querySelector('[data-randomize]')
      ?.addEventListener('click', this.randomizeAll, { signal });
    this.root
      .querySelector('[data-download]')
      ?.addEventListener('click', this.download, { signal });
    this.root.querySelector('[data-reset]')?.addEventListener('click', this.reset, { signal });
    this.root
      .querySelector('[data-copy-seed]')
      ?.addEventListener('click', () => void this.copySeed(), { signal });
    this.root
      .querySelector('[data-copy-link]')
      ?.addEventListener('click', () => void this.copyLink(), { signal });
    this.undoButton?.addEventListener('click', this.undo, { signal });
    this.redoButton?.addEventListener('click', this.redo, { signal });
    this.pauseButton?.addEventListener('click', this.togglePause, { signal });
    this.miniPreview?.addEventListener('click', this.showLargePoster, { signal });
    this.motionPreference.addEventListener('change', this.handleMotionChange, { signal });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { signal });

    this.initializePreviewObservers();
    this.paint();
    this.updateAnimation();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abortController.abort();
    this.observers.forEach((observer) => observer.disconnect());
    this.stopAnimation();
    if (this.miniPreview) this.miniPreview.hidden = true;
  }

  private readonly handleInput = (event: Event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.name === 'palette' && target.checked) {
      this.applyPalette(target.value);
    }

    if (target instanceof HTMLInputElement && target.type === 'color') {
      this.clearPaletteSelection();
    }

    this.refreshInterface();
    this.paint();
    this.syncUrl(this.getSettings());
  };

  private readonly handleChange = () => {
    this.commitHistory(this.getSettings());
  };

  private readonly handleMotionChange = () => {
    this.updateAnimation();
    this.paint();
  };

  private readonly handleVisibilityChange = () => {
    this.updateAnimation();
  };

  private readonly remix = () => {
    this.setNamedValue('seed', this.createSeed());
    this.startTime = performance.now();
    const settings = this.getSettings();
    this.refreshInterface();
    this.paint();
    this.commitHistory(settings);
    this.status?.replaceChildren(`Layout mit Seed ${settings.seed} neu gemischt.`);
  };

  private readonly randomizeAll = () => {
    const settings = this.getSettings();
    const data = new FormData(this.form ?? undefined);

    if (!data.has('lockCopy')) {
      const copy = randomItem(copyOptions);
      settings.title = copy[0];
      settings.subtitle = copy[1];
    }
    if (!data.has('lockSystem')) settings.style = randomItem(styles);
    if (!data.has('lockPalette')) {
      settings.palette = randomItem(palettes);
      settings.colors = { ...paletteColors[settings.palette] };
    }
    if (!data.has('lockTuning')) {
      settings.intensity = this.randomBetween(35, 100);
      settings.font = randomItem(fonts);
      settings.align = randomItem(alignments);
      settings.titleScale = this.randomBetween(75, 135);
      settings.lineHeight = this.randomBetween(70, 105);
      settings.gridDensity = this.randomBetween(7, 18);
      settings.gridBlocks = this.randomBetween(5, 20);
      settings.gridRotation = this.randomBetween(0, 40);
      settings.orbitRings = this.randomBetween(4, 13);
      settings.orbitX = this.randomBetween(30, 70);
      settings.orbitY = this.randomBetween(30, 65);
      settings.signalLines = this.randomBetween(16, 58);
      settings.signalAmplitude = this.randomBetween(30, 110);
      settings.signalFrequency = this.randomBetween(2, 8);
    }

    settings.seed = this.createSeed();
    this.startTime = performance.now();
    this.applySettings(settings);
    this.commitHistory(settings);
    this.status?.replaceChildren(
      'Neue Gesamtkomposition erstellt. Gesperrte Werte blieben erhalten.',
    );
  };

  private readonly reset = () => {
    const settings: PosterSettings = {
      ...defaultPosterSettings,
      colors: { ...defaultPosterSettings.colors },
      seed: this.createSeed(),
    };
    this.paused = false;
    this.applySettings(settings);
    this.commitHistory(settings);
    this.updatePauseButton();
    this.updateAnimation();
    this.status?.replaceChildren('Alle Einstellungen wurden zurückgesetzt.');
  };

  private readonly undo = () => {
    if (this.historyIndex <= 0) return;
    this.historyIndex -= 1;
    const settings = this.history[this.historyIndex];
    if (settings) this.applySettings(settings);
    this.updateHistoryButtons();
    this.status?.replaceChildren('Vorherige Version wiederhergestellt.');
  };

  private readonly redo = () => {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex += 1;
    const settings = this.history[this.historyIndex];
    if (settings) this.applySettings(settings);
    this.updateHistoryButtons();
    this.status?.replaceChildren('Nächste Version wiederhergestellt.');
  };

  private readonly togglePause = () => {
    this.paused = !this.paused;
    this.updatePauseButton();
    this.updateAnimation();
    this.paint();
  };

  private readonly showLargePoster = () => {
    this.posterFrame?.scrollIntoView({
      behavior: this.motionPreference.matches ? 'auto' : 'smooth',
    });
  };

  private readonly download = () => {
    const settings = this.getSettings();
    const data = new FormData(this.form ?? undefined);
    const exportScale = data.get('exportScale') === '2' ? 2 : 1;
    const format = posterFormats[settings.format];
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = format.width * exportScale;
    exportCanvas.height = format.height * exportScale;
    const exportContext = exportCanvas.getContext('2d');

    if (!exportContext) return;
    renderPoster(exportContext, settings);

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        this.status?.replaceChildren('Der PNG-Export konnte nicht erstellt werden.');
        return;
      }

      const downloaded = this.actions.downloadFile(
        blob,
        `poster-forge-${settings.seed}-${settings.format}.png`,
      );
      if (!downloaded) {
        this.status?.replaceChildren('Der PNG-Export konnte nicht gespeichert werden.');
        return;
      }
      this.status?.replaceChildren(
        `Poster als ${String(exportCanvas.width)} × ${String(exportCanvas.height)} PNG exportiert.`,
      );
    }, 'image/png');
  };

  private readonly animate = (timestamp: number) => {
    if (timestamp - this.lastPaint >= 100) {
      const speed = this.getSettings().motionSpeed / 100;
      this.paint(((timestamp - this.startTime) / 1000) * speed);
      this.lastPaint = timestamp;
    }

    this.frame = window.requestAnimationFrame(this.animate);
  };

  private paint(phase = 0) {
    if (!this.context || !this.canvas) return;

    const settings = this.getSettings();
    const format = posterFormats[settings.format];
    if (this.canvas.width !== format.width || this.canvas.height !== format.height) {
      this.canvas.width = format.width;
      this.canvas.height = format.height;
    }
    renderPoster(this.context, settings, phase);

    if (this.miniCanvas && this.miniContext) {
      const miniWidth = 240;
      const miniHeight = Math.round((format.height / format.width) * miniWidth);
      if (this.miniCanvas.width !== miniWidth || this.miniCanvas.height !== miniHeight) {
        this.miniCanvas.width = miniWidth;
        this.miniCanvas.height = miniHeight;
      }
      renderPoster(this.miniContext, settings, phase);
    }

    this.seedLabel?.replaceChildren(`SEED ${settings.seed}`);
    this.formatLabel?.replaceChildren(`${String(format.width)} × ${String(format.height)} PX`);
    this.intensityOutput?.replaceChildren(String(settings.intensity));
  }

  private getSettings(): PosterSettings {
    const data = new FormData(this.form ?? undefined);
    const style = stringValue(data, 'style');
    const palette = stringValue(data, 'palette');
    const format = stringValue(data, 'format');
    const font = stringValue(data, 'font');
    const align = stringValue(data, 'align');

    return {
      title: stringValue(data, 'title'),
      subtitle: stringValue(data, 'subtitle'),
      style: isIn(style, styles) ? style : defaultPosterSettings.style,
      palette: isIn(palette, palettes) ? palette : 'custom',
      colors: {
        background: stringValue(data, 'background', defaultPosterSettings.colors.background),
        foreground: stringValue(data, 'foreground', defaultPosterSettings.colors.foreground),
        accent: stringValue(data, 'accent', defaultPosterSettings.colors.accent),
      },
      format: isIn(format, formats) ? format : defaultPosterSettings.format,
      font: isIn(font, fonts) ? font : defaultPosterSettings.font,
      align: isIn(align, alignments) ? align : defaultPosterSettings.align,
      intensity: numberValue(data, 'intensity', defaultPosterSettings.intensity, 20, 100),
      titleScale: numberValue(data, 'titleScale', defaultPosterSettings.titleScale, 65, 145),
      lineHeight: numberValue(data, 'lineHeight', defaultPosterSettings.lineHeight, 65, 115),
      grain: numberValue(data, 'grain', defaultPosterSettings.grain, 0, 60),
      motionSpeed: numberValue(data, 'motionSpeed', defaultPosterSettings.motionSpeed, 25, 200),
      gridDensity: numberValue(data, 'gridDensity', defaultPosterSettings.gridDensity, 6, 20),
      gridBlocks: numberValue(data, 'gridBlocks', defaultPosterSettings.gridBlocks, 3, 22),
      gridRotation: numberValue(data, 'gridRotation', defaultPosterSettings.gridRotation, 0, 45),
      orbitRings: numberValue(data, 'orbitRings', defaultPosterSettings.orbitRings, 3, 14),
      orbitX: numberValue(data, 'orbitX', defaultPosterSettings.orbitX, 20, 80),
      orbitY: numberValue(data, 'orbitY', defaultPosterSettings.orbitY, 20, 72),
      signalLines: numberValue(data, 'signalLines', defaultPosterSettings.signalLines, 12, 64),
      signalAmplitude: numberValue(
        data,
        'signalAmplitude',
        defaultPosterSettings.signalAmplitude,
        15,
        120,
      ),
      signalFrequency: numberValue(
        data,
        'signalFrequency',
        defaultPosterSettings.signalFrequency,
        1,
        9,
      ),
      seed: stringValue(data, 'seed', defaultPosterSettings.seed),
    };
  }

  private applySettings(settings: PosterSettings, syncUrl = true) {
    this.setNamedValue('title', settings.title);
    this.setNamedValue('subtitle', settings.subtitle);
    this.setRadioValue('style', settings.style);
    this.setRadioValue('palette', settings.palette === 'custom' ? undefined : settings.palette);
    this.setNamedValue('background', settings.colors.background);
    this.setNamedValue('foreground', settings.colors.foreground);
    this.setNamedValue('accent', settings.colors.accent);
    this.setNamedValue('format', settings.format);
    this.setNamedValue('font', settings.font);
    this.setNamedValue('align', settings.align);
    this.setNamedValue('intensity', settings.intensity);
    this.setNamedValue('titleScale', settings.titleScale);
    this.setNamedValue('lineHeight', settings.lineHeight);
    this.setNamedValue('grain', settings.grain);
    this.setNamedValue('motionSpeed', settings.motionSpeed);
    this.setNamedValue('gridDensity', settings.gridDensity);
    this.setNamedValue('gridBlocks', settings.gridBlocks);
    this.setNamedValue('gridRotation', settings.gridRotation);
    this.setNamedValue('orbitRings', settings.orbitRings);
    this.setNamedValue('orbitX', settings.orbitX);
    this.setNamedValue('orbitY', settings.orbitY);
    this.setNamedValue('signalLines', settings.signalLines);
    this.setNamedValue('signalAmplitude', settings.signalAmplitude);
    this.setNamedValue('signalFrequency', settings.signalFrequency);
    this.setNamedValue('seed', settings.seed);
    this.refreshInterface();
    this.paint();
    if (syncUrl) this.syncUrl(settings);
  }

  private refreshInterface() {
    const settings = this.getSettings();
    this.root?.querySelectorAll<HTMLElement>('[data-system-controls]').forEach((section) => {
      section.hidden = section.dataset.systemControls !== settings.style;
    });
    this.root?.querySelectorAll<HTMLOutputElement>('[data-output]').forEach((output) => {
      const key = output.dataset.output as keyof PosterSettings | undefined;
      const value = key ? settings[key] : undefined;
      if (typeof value === 'number') output.replaceChildren(String(value));
    });
    this.intensityOutput?.replaceChildren(String(settings.intensity));
  }

  private applyPalette(value: string) {
    if (!isIn(value, palettes)) return;
    const colors = paletteColors[value];
    this.setNamedValue('background', colors.background);
    this.setNamedValue('foreground', colors.foreground);
    this.setNamedValue('accent', colors.accent);
  }

  private clearPaletteSelection() {
    this.root?.querySelectorAll<HTMLInputElement>('input[name="palette"]').forEach((input) => {
      input.checked = false;
    });
  }

  private setNamedValue(name: string, value: string | number) {
    const control = this.form?.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = String(value);
    }
  }

  private setRadioValue(name: string, value: string | undefined) {
    this.root?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((input) => {
      input.checked = input.value === value;
    });
  }

  private commitHistory(settings: PosterSettings, syncUrl = true) {
    const snapshot = structuredClone(settings);
    const current = this.history[this.historyIndex];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snapshot);
    if (this.history.length > 40) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.updateHistoryButtons();
    if (syncUrl) this.syncUrl(snapshot);
  }

  private updateHistoryButtons() {
    if (this.undoButton) this.undoButton.disabled = this.historyIndex <= 0;
    if (this.redoButton) this.redoButton.disabled = this.historyIndex >= this.history.length - 1;
  }

  private updatePauseButton() {
    this.pauseButton?.setAttribute('aria-pressed', String(this.paused));
    this.pauseLabel?.replaceChildren(this.paused ? 'Resume animation' : 'Pause animation');
  }

  private initializePreviewObservers() {
    if (!this.posterFrame || !this.controls || !this.miniPreview) return;

    const posterObserver = new IntersectionObserver(
      ([entry]) => {
        this.posterVisible = entry?.isIntersecting ?? true;
        this.updateMiniPreview();
      },
      { threshold: 0.12 },
    );
    const controlsObserver = new IntersectionObserver(
      ([entry]) => {
        this.controlsVisible = entry?.isIntersecting ?? false;
        this.updateMiniPreview();
      },
      { threshold: 0.01 },
    );

    posterObserver.observe(this.posterFrame);
    controlsObserver.observe(this.controls);
    this.observers.push(posterObserver, controlsObserver);
  }

  private updateMiniPreview() {
    if (this.miniPreview) {
      this.miniPreview.hidden = this.posterVisible || !this.controlsVisible;
    }
  }

  private syncUrl(settings: PosterSettings) {
    const params = new URLSearchParams();
    const entries: Array<[string, string | number]> = [
      ['title', settings.title],
      ['sub', settings.subtitle],
      ['style', settings.style],
      ['palette', settings.palette],
      ['bg', settings.colors.background.slice(1)],
      ['fg', settings.colors.foreground.slice(1)],
      ['accent', settings.colors.accent.slice(1)],
      ['format', settings.format],
      ['font', settings.font],
      ['align', settings.align],
      ['intensity', settings.intensity],
      ['scale', settings.titleScale],
      ['leading', settings.lineHeight],
      ['grain', settings.grain],
      ['motion', settings.motionSpeed],
      ['gd', settings.gridDensity],
      ['gb', settings.gridBlocks],
      ['gr', settings.gridRotation],
      ['rings', settings.orbitRings],
      ['ox', settings.orbitX],
      ['oy', settings.orbitY],
      ['lines', settings.signalLines],
      ['amp', settings.signalAmplitude],
      ['freq', settings.signalFrequency],
      ['seed', settings.seed],
    ];
    entries.forEach(([key, value]) => params.set(key, String(value)));
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  private readUrlSettings(): PosterSettings | null {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('seed')) return null;

    const style = params.get('style');
    const palette = params.get('palette');
    const format = params.get('format');
    const font = params.get('font');
    const align = params.get('align');
    const readNumber = (key: string, fallback: number, minimum: number, maximum: number) => {
      const value = Number(params.get(key));
      return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
    };
    const color = (key: string, fallback: string) => {
      const value = params.get(key);
      return value && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : fallback;
    };

    return {
      ...defaultPosterSettings,
      title: params.get('title') ?? defaultPosterSettings.title,
      subtitle: params.get('sub') ?? defaultPosterSettings.subtitle,
      style: isIn(style, styles) ? style : defaultPosterSettings.style,
      palette: isIn(palette, [...palettes, 'custom'] as const)
        ? palette
        : defaultPosterSettings.palette,
      colors: {
        background: color('bg', defaultPosterSettings.colors.background),
        foreground: color('fg', defaultPosterSettings.colors.foreground),
        accent: color('accent', defaultPosterSettings.colors.accent),
      },
      format: isIn(format, formats) ? format : defaultPosterSettings.format,
      font: isIn(font, fonts) ? font : defaultPosterSettings.font,
      align: isIn(align, alignments) ? align : defaultPosterSettings.align,
      intensity: readNumber('intensity', defaultPosterSettings.intensity, 20, 100),
      titleScale: readNumber('scale', defaultPosterSettings.titleScale, 65, 145),
      lineHeight: readNumber('leading', defaultPosterSettings.lineHeight, 65, 115),
      grain: readNumber('grain', defaultPosterSettings.grain, 0, 60),
      motionSpeed: readNumber('motion', defaultPosterSettings.motionSpeed, 25, 200),
      gridDensity: readNumber('gd', defaultPosterSettings.gridDensity, 6, 20),
      gridBlocks: readNumber('gb', defaultPosterSettings.gridBlocks, 3, 22),
      gridRotation: readNumber('gr', defaultPosterSettings.gridRotation, 0, 45),
      orbitRings: readNumber('rings', defaultPosterSettings.orbitRings, 3, 14),
      orbitX: readNumber('ox', defaultPosterSettings.orbitX, 20, 80),
      orbitY: readNumber('oy', defaultPosterSettings.orbitY, 20, 72),
      signalLines: readNumber('lines', defaultPosterSettings.signalLines, 12, 64),
      signalAmplitude: readNumber('amp', defaultPosterSettings.signalAmplitude, 15, 120),
      signalFrequency: readNumber('freq', defaultPosterSettings.signalFrequency, 1, 9),
      seed: params.get('seed') ?? defaultPosterSettings.seed,
    };
  }

  private async copySeed() {
    const seed = this.getSettings().seed;
    const copied = await this.actions.copyText(seed);
    this.status?.replaceChildren(
      copied ? `Seed ${seed} kopiert.` : 'Seed konnte nicht in die Zwischenablage kopiert werden.',
    );
  }

  private async copyLink() {
    this.syncUrl(this.getSettings());
    const copied = await this.actions.copyText(window.location.href);
    this.status?.replaceChildren(
      copied
        ? 'Teilbarer Konfigurationslink kopiert.'
        : 'Link konnte nicht in die Zwischenablage kopiert werden.',
    );
  }

  private createSeed() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String((values[0] ?? 0) % 1_000_000).padStart(6, '0');
  }

  private randomBetween(minimum: number, maximum: number) {
    return Math.round(minimum + Math.random() * (maximum - minimum));
  }

  private updateAnimation() {
    const shouldAnimate =
      !this.paused && !this.motionPreference.matches && document.visibilityState !== 'hidden';

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
