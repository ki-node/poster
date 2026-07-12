# Poster Forge

Ein mobile-first Designinstrument für generative Poster. Drei visuelle Systeme, flexible Paletten und reproduzierbare Seeds erzeugen vollständig lokal im Browser individuelle Kompositionen.

Poster Forge bietet:

- Grid-, Orbit- und Signal-Systeme mit eigenen Feinreglern
- frei editierbare Farben, Typografie, Ausrichtung, Körnung und Bewegung
- vier Ausgabeformate und hochauflösenden PNG-Export
- manuell nutzbare Seeds sowie teilbare Konfigurationslinks
- Remix, vollständige Zufallskompositionen, Sperren, Undo und Redo
- eine mobile Mini-Vorschau, solange die große Posterfläche außerhalb des Viewports liegt

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
