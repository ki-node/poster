import { createRandom, hashSeed } from './random';

export type PosterStyle = 'grid' | 'orbit' | 'signal';
export type PosterPalette = 'acid' | 'ink' | 'solar';

export interface PosterSettings {
  title: string;
  subtitle: string;
  style: PosterStyle;
  palette: PosterPalette;
  intensity: number;
  seed: string;
}

interface Colors {
  background: string;
  foreground: string;
  accent: string;
  soft: string;
}

const palettes: Record<PosterPalette, Colors> = {
  acid: {
    background: '#d6ff00',
    foreground: '#111111',
    accent: '#ff2f82',
    soft: '#f4ff9b',
  },
  ink: {
    background: '#efe8dc',
    foreground: '#1526ff',
    accent: '#141414',
    soft: '#b9c0ff',
  },
  solar: {
    background: '#ff4f00',
    foreground: '#160b30',
    accent: '#ffe600',
    soft: '#ff9e5c',
  },
};

const width = 1200;
const height = 1600;
const margin = 78;

const normalizeCopy = (value: string, fallback: string) => value.trim() || fallback;

const setDisplayFont = (context: CanvasRenderingContext2D, size: number) => {
  context.font = `900 ${String(size)}px Arial, Helvetica, sans-serif`;
  context.textBaseline = 'top';
};

const drawFrameCopy = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  colors: Colors,
) => {
  context.fillStyle = colors.foreground;
  context.font = '700 25px Arial, Helvetica, sans-serif';
  context.textBaseline = 'top';
  context.fillText(normalizeCopy(settings.subtitle, 'GENERATIVE EDITION'), margin, margin);

  context.textAlign = 'right';
  context.fillText(`SEED ${settings.seed}`, width - margin, margin);
  context.textAlign = 'left';

  context.save();
  context.translate(width - 54, height - margin);
  context.rotate(-Math.PI / 2);
  context.font = '700 20px Arial, Helvetica, sans-serif';
  context.fillText('POSTER FORGE / BROWSER NATIVE', 0, 0);
  context.restore();
};

const titleLines = (title: string) => {
  const copy = normalizeCopy(title, 'MAKE NOISE').toUpperCase();
  const words = copy.split(/\s+/).filter(Boolean);

  if (words.length <= 1) return [copy];
  if (words.length === 2) return words;

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')];
};

const drawTitle = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  colors: Colors,
  y: number,
  maximumWidth = width - margin * 2,
) => {
  const lines = titleLines(settings.title);
  let size = lines.length === 1 ? 210 : 170;

  setDisplayFont(context, size);
  while (
    Math.max(...lines.map((line) => context.measureText(line).width)) > maximumWidth &&
    size > 84
  ) {
    size -= 4;
    setDisplayFont(context, size);
  }

  context.fillStyle = colors.foreground;
  lines.forEach((line, index) => context.fillText(line, margin, y + index * size * 0.82));
};

const drawGrid = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  colors: Colors,
  random: () => number,
  phase: number,
) => {
  const density = Math.round(7 + settings.intensity / 12);
  const cell = (width - margin * 2) / density;

  context.strokeStyle = colors.foreground;
  context.lineWidth = 3;
  context.globalAlpha = 0.24;

  for (let index = 0; index <= density; index += 1) {
    const coordinate = margin + index * cell;
    context.beginPath();
    context.moveTo(coordinate, 190);
    context.lineTo(coordinate, height - margin);
    context.stroke();
  }

  context.globalAlpha = 1;
  for (let index = 0; index < 10; index += 1) {
    const x = margin + Math.floor(random() * density) * cell;
    const y = 250 + Math.floor(random() * (density + 2)) * cell;
    const size = cell * (random() > 0.55 ? 2 : 1);
    context.fillStyle = index % 3 === 0 ? colors.accent : colors.foreground;
    context.save();
    context.translate(x + size / 2, y + size / 2);
    context.rotate((random() - 0.5) * phase * 0.08);
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
  }

  context.fillStyle = colors.background;
  context.fillRect(0, 970, width, 360);
  drawTitle(context, settings, colors, 990);
};

const drawOrbit = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  colors: Colors,
  random: () => number,
  phase: number,
) => {
  const centerX = width * 0.53;
  const centerY = height * 0.48;
  const ringCount = Math.round(5 + settings.intensity / 18);

  context.lineCap = 'round';
  for (let index = ringCount; index > 0; index -= 1) {
    const radius = 85 + index * 72;
    context.beginPath();
    context.strokeStyle = index % 3 === 0 ? colors.accent : colors.foreground;
    context.lineWidth = index % 2 === 0 ? 18 : 4;
    context.globalAlpha = 0.34 + index / ringCount / 2;
    const offset = random() * Math.PI * 2 + phase * (0.05 + index * 0.008);
    context.arc(centerX, centerY, radius, offset, offset + Math.PI * (0.8 + random()));
    context.stroke();
  }

  context.globalAlpha = 1;
  context.fillStyle = colors.accent;
  context.beginPath();
  context.arc(centerX, centerY, 112, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colors.foreground;
  context.beginPath();
  context.arc(
    centerX + Math.cos(phase * 0.2) * 320,
    centerY + Math.sin(phase * 0.2) * 320,
    32,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = colors.background;
  context.fillRect(0, 1130, width, 330);
  drawTitle(context, settings, colors, 1150);
};

const drawSignal = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  colors: Colors,
  random: () => number,
  phase: number,
) => {
  const lines = Math.round(18 + settings.intensity / 3);
  const spacing = 1040 / lines;

  context.lineWidth = 8;
  for (let index = 0; index < lines; index += 1) {
    const y = 220 + index * spacing;
    const amplitude = 24 + random() * settings.intensity * 1.8;
    const frequency = 1.5 + random() * 4;
    context.beginPath();
    context.strokeStyle = index % 6 === 0 ? colors.accent : colors.foreground;
    context.globalAlpha = index % 6 === 0 ? 1 : 0.55;

    for (let x = margin; x <= width - margin; x += 14) {
      const wave = Math.sin((x / width) * Math.PI * frequency + phase * 0.12 + index) * amplitude;
      const coordinateY = y + wave;
      if (x === margin) context.moveTo(x, coordinateY);
      else context.lineTo(x, coordinateY);
    }
    context.stroke();
  }

  context.globalAlpha = 1;
  context.save();
  context.translate(width - margin - 6, 310);
  context.rotate(Math.PI / 2);
  drawTitle(context, settings, colors, 0, 1120);
  context.restore();
};

/** Paints one deterministic poster composition onto a 1200 × 1600 canvas. */
export const renderPoster = (
  context: CanvasRenderingContext2D,
  settings: PosterSettings,
  phase = 0,
) => {
  const colors = palettes[settings.palette];
  const random = createRandom(hashSeed(`${settings.seed}:${settings.style}`));

  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = colors.soft;
  context.globalAlpha = 0.22;
  context.fillRect(34, 34, width - 68, height - 68);
  context.globalAlpha = 1;

  if (settings.style === 'grid') drawGrid(context, settings, colors, random, phase);
  if (settings.style === 'orbit') drawOrbit(context, settings, colors, random, phase);
  if (settings.style === 'signal') drawSignal(context, settings, colors, random, phase);

  drawFrameCopy(context, settings, colors);

  context.strokeStyle = colors.foreground;
  context.lineWidth = 4;
  context.strokeRect(34, 34, width - 68, height - 68);
};
