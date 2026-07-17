# Poster Forge

Ein mobile-first Designinstrument für generative Poster. Drei visuelle Systeme, flexible Paletten und reproduzierbare Seeds erzeugen vollständig lokal im Browser individuelle Kompositionen.

Poster Forge bietet:

- Grid-, Orbit- und Signal-Systeme mit eigenen Feinreglern
- frei editierbare Farben, Typografie, Ausrichtung, Körnung und Bewegung
- vier Ausgabeformate und hochauflösenden PNG-Export
- manuell nutzbare Seeds sowie teilbare Konfigurationslinks
- Remix, vollständige Zufallskompositionen, Sperren, Undo und Redo
- eine responsive, bei ausreichender Höhe sticky Hauptvorschau
- eine adaptive, pixelgleiche Mini-Vorschau, sobald die Hauptvorschau nicht ausreichend sichtbar ist

## Entwicklung

```bash
npm ci
npm run dev
```

## Builds

Der bestehende Pages-Build bleibt der öffentliche Produktionsbuild:

```bash
npm run build
```

Er verwendet weiterhin die Vite-Basis `/poster/`, schreibt nach `dist/` und wird unverändert vom
GitHub-Pages-Workflow veröffentlicht.

Für eine spätere versionsfixierte Offline-Einbettung in Orbit steht zusätzlich ein separater Build
zur Verfügung:

```bash
npm run build:embedded
```

Dieser Build verwendet relative Assetpfade (`base: './'`), schreibt nach `dist-embedded/` und kann
unverändert unter beliebigen lokalen Unterpfaden wie `projects/poster/index.html` liegen. Alle
aktiven Skripte, Styles und Bilder sind lokal; es bestehen keine Laufzeitabhängigkeiten zu GitHub
Pages, externen Fonts, APIs, Analysewerkzeugen oder CDNs.

Der Embedded-Build darf nur aus einem sauberen, vollständig eingecheckten Quellstand entstehen.
`dist-embedded/ki-node-project.json` dokumentiert reproduzierbar Projektkennung, Repository,
vollständigen Commit-SHA, Build-Befehl, Kontext und Formatversion. Die generierten Ausgaben werden
nicht eingecheckt und niemals manuell gepatcht.

Der Anwendungskontext `web` beziehungsweise `embedded` wird von Vite bereits im erzeugten
`<html>`-Element gesetzt, bevor das erste Anwendungsskript und der erste sichtbare Paint laufen.
Das Embedded-Profil entfernt nur die öffentliche Intro-/Masthead-Chrome und berücksichtigt die
iframe-, Viewport- und Safe-Area-Grenzen. Gestaltung und Verhalten des Pages-Profils bleiben
unverändert. Weitere Details stehen unter
[`docs/embedded-build.md`](docs/embedded-build.md).

Im öffentlichen Web-Kontext bleibt der PNG-Download ein normaler Browser-Download. Im
Embedded-Kontext wird ein PNG optional als strukturiert klonbarer `ArrayBuffer` über die
versionierte Orbit-Bridge an den
Host übergeben. Fehlt der Host, wird der iframe nicht zur Blob-Datei navigiert; stattdessen erscheint
eine kontrollierte Statusmeldung. Clipboard verwendet weiterhin den unabhängigen Browser-Fallback.

## Qualität

```bash
npm run check
npm run test:e2e
npm run test:reproducible
```

Das Quality Gate prüft Formatierung, ESLint, Stylelint, striktes TypeScript, Unit-Tests, Produktionsbuild, gzip-Budgets, mobile und Desktop-Browser, iPhone/WebKit, kompakten 320-Pixel-Reflow und axe WCAG A/AA.

Die Browsermatrix deckt außerdem niedrige Landscape-Viewports bis `844 × 390` ab. Während der
Arbeit in den Studio-Controls bleibt dort entweder die passend skalierte Hauptvorschau oder die
kanonisch gespiegelte Mini-Vorschau sichtbar; ein Tap auf die Miniatur springt zurück zum Poster.

Zusätzlich validiert es beide Build-Kontexte, relative und lokal auflösbare Embedded-Assets,
Offline-Nutzung unter einem verschachtelten Pfad, deterministische Provenienz, wiederholbaren
Lifecycle und bytegleich reproduzierbare Embedded-Ausgaben.

## Datenschutz

Poster Forge besitzt kein Backend, kein Tracking und keine externen API-Aufrufe. Texte und generierte Grafiken bleiben ausschließlich im Browser.
