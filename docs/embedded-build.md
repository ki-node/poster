# Embedded-Build für Orbit

## Zweck und Abgrenzung

Poster Forge bleibt ein eigenständiges Webprojekt. `npm run build` erzeugt weiterhin ausschließlich
die öffentliche GitHub-Pages-Version für `/poster/`. `npm run build:embedded` ergänzt daneben einen
relocatable Offline-Build in `dist-embedded/`, der später durch einen bewusst festgeschriebenen
Commit in Orbit übernommen werden kann.

Die Orbit-App wird in einem getrennten Pull Request auf den daraus entstehenden vollständigen
Feature-Commit gepinnt.

## Kontext und Darstellung

Die Vite-Konfiguration löst zentral genau zwei Profile auf:

- `web`: Basis `/poster/`, Ausgabe `dist/`, vollständige öffentliche Masthead-/Intro-Darstellung.
- `embedded`: Basis `./`, Ausgabe `dist-embedded/`, Kontext für iframe und lokale App-Bundles.

Ein Vite-HTML-Plugin injiziert `data-app-context="web|embedded"` vor allen Anwendungsskripten.
Kritische Embedded-Regeln stehen damit vor dem ersten Paint fest. Komponenten müssen den
Buildmodus nicht selbst prüfen.

Im Embedded-Profil entfallen Masthead und öffentliches Intro, weil Orbit später bereits die äußere
Projekt-Toolbar bereitstellt. Posterfläche, Bedienelemente, mobile Mini-Vorschau und Footer bleiben
Teil des Projekts. Die obere Safe Area wird im iframe nicht doppelt angewandt; linke, rechte und
untere Safe Areas bleiben insbesondere für Landscape und den unteren Abschluss erhalten. Das
Dokument bleibt der einzige Scroll-Container innerhalb des iframe.

Poster Forge besitzt derzeit keine modalen Dialoge. Erweiterte Einstellungen verwenden das native
`details`-Element; die mobile Mini-Vorschau ist das einzige fixe Overlay. Fokuszustände,
Tastaturbedienung und `prefers-reduced-motion` gelten in beiden Profilen unverändert.

Die Mini-Vorschau berechnet keine zweite Komposition. Nach jedem kanonischen Renderdurchlauf wird
das Haupt-Canvas bei identischen Bitmap-Abmessungen per `drawImage` gespiegelt und ausschließlich
über CSS proportional verkleinert. Typografie, Zeilenumbrüche, Grain und Systemgeometrie bleiben
damit in allen Formaten pixelgleich; das Seitenverhältnis wird nicht gestreckt.

## Lifecycle

`mountPosterForge()` besitzt die einmalige Initialisierung pro Dokument. `DOMContentLoaded` und
`pagehide` werden an einer Stelle verwaltet. `PosterStudio.init()` und `destroy()` sind idempotent;
der zugehörige `AbortController` entfernt Listener, Observer werden getrennt und ein laufender
Animation Frame wird beendet. Ein neu geöffnetes iframe erzeugt anschließend genau eine frische
Instanz, ohne Handler aus einem entfernten Dokument weiterzuführen.

## Browser-Aktionen und Export-Bridge

PNG-Export und Zwischenablage liegen hinter der kleinen `PosterActions`-Schnittstelle. Im
Web-Kontext bleibt der bestehende Blob-/Anchor-Download unverändert. Der Embedded-Kontext navigiert
nie zu einer Blob-URL: Er verwendet ausschließlich die optionale, versionierte Export-Bridge oder
zeigt bei fehlendem Host eine verständliche Statusmeldung. Clipboard bleibt davon getrennt beim
kontrollierten Browser-Fallback.

Das Nachrichtenprotokoll verwendet den Kanal `orbit-project-bridge`, Version `1`, Projektkennung
`poster` und die Typen `project-ready`, `host-ready`, `file-export` sowie `file-export-result`.
`file-export` enthält genau einen nutzerinitiierten PNG-Export mit Request-ID, vorgeschlagenem
Dateinamen, MIME-Typ `image/png`, erwarteter Bytezahl und einem strukturiert klonbaren
`ArrayBuffer`.
Data-URLs und Base64 werden zwischen iframe und Host nicht verwendet. Antworten werden nur vom
Parent-Fenster und mit exakt passendem Schema akzeptiert. Beim `pagehide` werden Listener, Timeouts
und ausstehende Requests vollständig bereinigt.

## Offline-Garantie und Provenienz

Der Embedded-Build enthält sämtliche aktiven Assets lokal, verwendet keine absoluten
`/poster/`-Pfade und kann unter einem beliebigen relativen Unterpfad abgelegt werden. Das Quality
Gate prüft HTML- und CSS-Referenzen rekursiv, verhindert Pfadfluchten und Symlinks, blockiert aktive
Netzwerkressourcen und lädt den echten Build in Chromium und WebKit ohne externes Netzwerk.

`dist-embedded/ki-node-project.json` enthält ausschließlich deterministische Werte:

- `projectId`: `poster`
- `repository`: `ki-node/poster`
- vollständiger Quell-Commit
- `buildCommand`: `npm run build:embedded`
- `buildContext`: `embedded`
- `formatVersion`: `1`

Zeitstempel oder lokale Pfade sind ausdrücklich ausgeschlossen. Ein Reproduzierbarkeitstest baut
denselben sauberen Commit erneut und vergleicht Pfade sowie SHA-256-Inhaltswerte aller Dateien.

## Noch außerhalb dieses Pull Requests

- Festschreiben des finalen Poster-Commits in Orbits Projekt-Lockdatei.
- Kopieren und Offline-Validieren des Artefakts im Orbit-Repository.
- Physischer Test im echten Orbit-iframe auf dem iPhone.
- Gegebenenfalls spätere, getrennte Bridge-Erweiterungen für Clipboard, Share von Links und externe
  Links.
