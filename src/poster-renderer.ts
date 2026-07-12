import { createRandom, hashSeed } from './random';

export type PosterStyle = 'grid' | 'orbit' | 'signal';
export type PosterPalette = 'acid' | 'ink' | 'solar' | 'custom';
export type PosterFormat = 'portrait' | 'square' | 'story' | 'landscape';
export type PosterFont = 'grotesk' | 'serif' | 'mono';
export type PosterAlign = 'left' | 'center' | 'right';

export interface PosterColors {
  background: string;
  foreground: string;
  accent: string;
}

export interface PosterSettings {
  title: string;
  subtitle: string;
  style: PosterStyle;
  palette: PosterPalette;
  colors: PosterColors;
  format: PosterFormat;
  font: PosterFont;
  align: PosterAlign;
  intensity: number;
  titleScale: number;
  lineHeight: number;
  grain: number;
  motionSpeed: number;
  gridDensity: number;
  gridBlocks: number;
  gridRotation: number;
  orbitRings: number;
  orbitX: number;
  orbitY: number;
  signalLines: number;
  signalAmplitude: number;
  signalFrequency: number;
  seed: string;
}

export const paletteColors: Record<Exclude<PosterPalette, 'custom'>, PosterColors> = {
  acid: { background: '#d6ff00', foreground: '#111111', accent: '#ff2f82' },
  ink: { background: '#efe8dc', foreground: '#1526ff', accent: '#141414' },
  solar: { background: '#ff4f00', foreground: '#160b30', accent: '#ffe600' },
};

export const posterFormats: Record<PosterFormat, { width: number; height: number }> = {
  portrait: { width: 1200, height: 1600 },
  square: { width: 1200, height: 1200 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1600, height: 1000 },
};

export const defaultPosterSettings: PosterSettings = {
  title: 'MAKE NOISE',
  subtitle: 'GENERATIVE EDITION / 001',
  style: 'grid',
  palette: 'acid',
  colors: { ...paletteColors.acid },
  format: 'portrait',
  font: 'grotesk',
  align: 'left',
  intensity: 72,
  titleScale: 100,
  lineHeight: 82,
  grain: 18,
  motionSpeed: 100,
  gridDensity: 12,
  gridBlocks: 10,
  gridRotation: 8,
  orbitRings: 8,
  orbitX: 53,
  orbitY: 48,
  signalLines: 34,
  signalAmplitude: 72,
  signalFrequency: 4,
  seed: '000000',
};

const normalizeCopy = (value: string, fallback: string) => value.trim() || fallback;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const fontFamilies: Record<PosterFont, string> = {
  grotesk: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'Courier New, Courier, monospace',
};

const titleLines = (title: string, landscape: boolean) => {
  const copy = normalizeCopy(title, 'MAKE NOISE').toUpperCase();
  const words = copy.split(/\s+/).filter(Boolean);

  if (words.length <= 1 || landscape) return [copy];
  if (words.length === 2) return words;

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')];
};

const setDisplayFont = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  size: number,
) => {
  const weight = settings.font === 'serif' ? 700 : 900;
  context.font = `${String(weight)} ${String(size)}px ${fontFamilies[settings.font]}`;
  context.textBaseline = 'top';
};

const alignmentX = (settings: PosterSettings, width: number, margin: number) => {
  if (settings.align === 'center') return width / 2;
  if (settings.align === 'right') return width - margin;
  return margin;
};

const drawFrameCopy = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  width: number,
  height: number,
  margin: number,
) => {
  const unit = width / 1200;
  context.fillStyle = settings.colors.foreground;
  context.font = `700 ${String(Math.max(16, 25 * unit))}px Arial, Helvetica, sans-serif`;
  context.textBaseline = 'top';
  context.textAlign = 'left';
  context.fillText(normalizeCopy(settings.subtitle, 'GENERATIVE EDITION'), margin, margin);

  context.textAlign = 'right';
  context.fillText(`SEED ${settings.seed}`, width - margin, margin);
  context.textAlign = 'left';

  if (height > width) {
    context.save();
    context.translate(width - margin * 0.55, height - margin);
    context.rotate(-Math.PI / 2);
    context.font = `700 ${String(Math.max(13, 19 * unit))}px Arial, Helvetica, sans-serif`;
    context.fillText('POSTER FORGE / BROWSER NATIVE', 0, 0);
    context.restore();
  }
};

const drawTitle = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  width: number,
  y: number,
  margin: number,
  maximumWidth = width - margin * 2,
) => {
  const landscape = width > context.canvas.height;
  const lines = titleLines(settings.title, landscape);
  let size = (lines.length === 1 ? width * 0.175 : width * 0.14) * (settings.titleScale / 100);
  const minimumSize = width * 0.052;

  setDisplayFont(context, settings, size);
  while (
    Math.max(...lines.map((line) => context.measureText(line).width)) > maximumWidth &&
    size > minimumSize
  ) {
    size -= width * 0.004;
    setDisplayFont(context, settings, size);
  }

  context.fillStyle = settings.colors.foreground;
  context.textAlign = settings.align;
  const x = alignmentX(settings, width, margin);
  const lineStep = size * (settings.lineHeight / 100);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineStep));
  context.textAlign = 'left';
};

const drawGrid = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  random: () => number,
  phase: number,
) => {
  const { width, height } = context.canvas;
  const margin = width * 0.065;
  const density = clamp(Math.round(settings.gridDensity), 4, 24);
  const cell = (width - margin * 2) / density;
  const titleTop = height * (width > height ? 0.59 : 0.62);
  const gridBottom = Math.max(height * 0.52, titleTop - cell * 0.3);
  const columns = density;
  const rows = Math.ceil((gridBottom - height * 0.13) / cell);

  context.strokeStyle = settings.colors.foreground;
  context.lineWidth = Math.max(2, width * 0.0025);
  context.globalAlpha = 0.12 + settings.intensity / 550;

  for (let index = 0; index <= columns; index += 1) {
    const coordinate = margin + index * cell;
    context.beginPath();
    context.moveTo(coordinate, height * 0.13);
    context.lineTo(coordinate, gridBottom);
    context.stroke();
  }

  for (let index = 0; index <= rows; index += 1) {
    const coordinate = height * 0.13 + index * cell;
    context.beginPath();
    context.moveTo(margin, coordinate);
    context.lineTo(width - margin, coordinate);
    context.stroke();
  }

  context.globalAlpha = 1;
  const blockCount = clamp(Math.round(settings.gridBlocks), 1, 30);
  for (let index = 0; index < blockCount; index += 1) {
    const x = margin + Math.floor(random() * columns) * cell;
    const y = height * 0.16 + Math.floor(random() * Math.max(1, rows - 1)) * cell;
    const size = cell * (random() > 0.62 ? 1.85 : 0.9);
    context.fillStyle = index % 3 === 0 ? settings.colors.accent : settings.colors.foreground;
    context.save();
    context.translate(x + size / 2, y + size / 2);
    const rotation = ((random() - 0.5) * settings.gridRotation * Math.PI) / 180;
    context.rotate(rotation + Math.sin(phase * 0.4 + index) * 0.025);
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
  }

  context.fillStyle = settings.colors.background;
  context.fillRect(0, titleTop - height * 0.015, width, height * 0.28);
  drawTitle(context, settings, width, titleTop, margin);
};

const drawOrbit = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  random: () => number,
  phase: number,
) => {
  const { width, height } = context.canvas;
  const margin = width * 0.065;
  const centerX = width * (settings.orbitX / 100);
  const centerY = height * (settings.orbitY / 100);
  const ringCount = clamp(Math.round(settings.orbitRings), 2, 18);
  const radiusStep = Math.min(width, height) * 0.055;
  const intensityScale = 0.65 + settings.intensity / 180;

  context.lineCap = 'round';
  for (let index = ringCount; index > 0; index -= 1) {
    const radius = (Math.min(width, height) * 0.055 + index * radiusStep) * intensityScale;
    context.beginPath();
    context.strokeStyle = index % 3 === 0 ? settings.colors.accent : settings.colors.foreground;
    context.lineWidth = Math.max(3, index % 2 === 0 ? width * 0.015 : width * 0.0035);
    context.globalAlpha = 0.3 + index / ringCount / 2;
    const offset = random() * Math.PI * 2 + phase * (0.05 + index * 0.008);
    context.arc(centerX, centerY, radius, offset, offset + Math.PI * (0.8 + random()));
    context.stroke();
  }

  context.globalAlpha = 1;
  context.fillStyle = settings.colors.accent;
  context.beginPath();
  context.arc(centerX, centerY, Math.min(width, height) * 0.075, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = settings.colors.foreground;
  context.beginPath();
  const satelliteRadius = Math.min(width, height) * 0.26;
  context.arc(
    centerX + Math.cos(phase * 0.2) * satelliteRadius,
    centerY + Math.sin(phase * 0.2) * satelliteRadius,
    Math.min(width, height) * 0.022,
    0,
    Math.PI * 2,
  );
  context.fill();

  const titleTop = height * (width > height ? 0.67 : 0.73);
  context.fillStyle = settings.colors.background;
  context.fillRect(0, titleTop - height * 0.015, width, height * 0.24);
  drawTitle(context, settings, width, titleTop, margin);
};

const drawSignal = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  random: () => number,
  phase: number,
) => {
  const { width, height } = context.canvas;
  const margin = width * 0.065;
  const lineCount = clamp(Math.round(settings.signalLines), 8, 80);
  const signalTop = height * 0.14;
  const signalBottom = height * (width > height ? 0.58 : 0.78);
  const spacing = (signalBottom - signalTop) / lineCount;
  const amplitudeBase = (width * settings.signalAmplitude) / 1200;

  context.lineWidth = Math.max(3, width * 0.0065);
  for (let index = 0; index < lineCount; index += 1) {
    const y = signalTop + index * spacing;
    const amplitude = amplitudeBase * (0.45 + random()) * (0.7 + settings.intensity / 150);
    const frequency = settings.signalFrequency * (0.6 + random() * 0.8);
    context.beginPath();
    context.strokeStyle = index % 6 === 0 ? settings.colors.accent : settings.colors.foreground;
    context.globalAlpha = index % 6 === 0 ? 1 : 0.52;

    for (let x = margin; x <= width - margin; x += Math.max(8, width * 0.012)) {
      const wave = Math.sin((x / width) * Math.PI * frequency + phase * 0.12 + index) * amplitude;
      const coordinateY = y + wave;
      if (x === margin) context.moveTo(x, coordinateY);
      else context.lineTo(x, coordinateY);
    }
    context.stroke();
  }

  context.globalAlpha = 1;
  const titleTop = height * (width > height ? 0.64 : 0.79);
  context.fillStyle = settings.colors.background;
  context.fillRect(0, titleTop - height * 0.025, width, height * 0.24);
  drawTitle(context, settings, width, titleTop, margin);
};

const drawGrain = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  random: () => number,
) => {
  if (settings.grain <= 0) return;

  const { width, height } = context.canvas;
  const count = Math.round(settings.grain * 11);
  context.fillStyle = settings.colors.foreground;
  context.globalAlpha = 0.025 + settings.grain / 1200;

  for (let index = 0; index < count; index += 1) {
    const size = 1 + random() * Math.max(1, width * 0.003);
    context.fillRect(random() * width, random() * height, size, size);
  }

  context.globalAlpha = 1;
};

/** Paints one deterministic poster composition at the canvas' current output dimensions. */
export const renderPoster = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  phase = 0,
) => {
  const { width, height } = context.canvas;
  const margin = width * 0.065;
  const random = createRandom(hashSeed(`${settings.seed}:${settings.style}`));

  context.clearRect(0, 0, width, height);
  context.fillStyle = settings.colors.background;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.14;
  context.fillStyle = settings.colors.accent;
  context.fillRect(width * 0.028, height * 0.022, width * 0.944, height * 0.956);
  context.globalAlpha = 1;

  if (settings.style === 'grid') drawGrid(context, settings, random, phase);
  if (settings.style === 'orbit') drawOrbit(context, settings, random, phase);
  if (settings.style === 'signal') drawSignal(context, settings, random, phase);

  drawFrameCopy(context, settings, width, height, margin);
  drawGrain(context, settings, random);

  context.strokeStyle = settings.colors.foreground;
  context.lineWidth = Math.max(3, width * 0.0033);
  context.strokeRect(width * 0.028, height * 0.022, width * 0.944, height * 0.956);
};
