# Poster Forge

Ein mobile-first Designinstrument für generative Poster. Drei visuelle Systeme, drei Paletten und reproduzierbare Seeds erzeugen vollständig lokal im Browser individuelle Kompositionen. Das Ergebnis lässt sich direkt als PNG exportieren.

## Entwicklung

```bash
npm ci
npm run dev
```

## Qualität

```bash
npm run check
npm run test:e2e
```

Das Quality Gate prüft Formatierung, ESLint, Stylelint, striktes TypeScript, Unit-Tests, Produktionsbuild, gzip-Budgets, mobile und Desktop-Browser, iPhone/WebKit, kompakten 320-Pixel-Reflow und axe WCAG A/AA.

## Datenschutz

Poster Forge besitzt kein Backend, kein Tracking und keine externen API-Aufrufe. Texte und generierte Grafiken bleiben ausschließlich im Browser.
