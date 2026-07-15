# Embedded-Build für Orbit

## Zweck und Abgrenzung

Poster Forge bleibt ein eigenständiges Webprojekt. `npm run build` erzeugt weiterhin ausschließlich
die öffentliche GitHub-Pages-Version für `/poster/`. `npm run build:embedded` ergänzt daneben einen
relocatable Offline-Build in `dist-embedded/`, der später durch einen bewusst festgeschriebenen
Commit in Orbit übernommen werden kann.

Dieser Pull Request ändert weder `ki-node/ki-node.github.io` noch die Orbit-App und implementiert
noch keine Host-Bridge.

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

## Lifecycle

`mountPosterForge()` besitzt die einmalige Initialisierung pro Dokument. `DOMContentLoaded` und
`pagehide` werden an einer Stelle verwaltet. `PosterStudio.init()` und `destroy()` sind idempotent;
der zugehörige `AbortController` entfernt Listener, Observer werden getrennt und ein laufender
Animation Frame wird beendet. Ein neu geöffnetes iframe erzeugt anschließend genau eine frische
Instanz, ohne Handler aus einem entfernten Dokument weiterzuführen.

## Browser-Aktionen und spätere Bridge

PNG-Download und Zwischenablage liegen hinter der kleinen `PosterActions`-Schnittstelle. In diesem
Stand implementiert sie ausschließlich sichere Browser-Fallbacks. Fehlt Clipboard-Zugriff oder ein
Host vollständig, entsteht kein Laufzeitfehler; Poster Forge bleibt als normale Website nutzbar.

Für eine spätere, optionale und versionierte Orbit-Nachrichtenbrücke kommen zentral infrage:

- PNG-Dateiexport an den nativen Dateidialog beziehungsweise das Teilen-Menü,
- Schreiben von Seed oder Konfigurationslink in die native Zwischenablage,
- Teilen von PNG und/oder Konfigurationslink,
- kontrolliertes Öffnen späterer externer HTTPS-Links.

Eine solche Bridge muss Projektkennung, Protokollversion, Nachrichtentyp, Quelle und Payload strikt
validieren. Sie darf nur zusätzliche Fähigkeiten anbieten; bei fehlendem Host müssen die heutigen
Web-Fallbacks erhalten bleiben. Binärdaten brauchen vor der Implementierung ein bewusstes,
größenbegrenztes Transfermodell. Deshalb wird in diesem PR kein Orbit-spezifisches `postMessage`-
Schema vorweggenommen.

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
- Entwurf und Sicherheitsreview einer versionierten Host-Bridge für Export, Clipboard, Share und
  externe Links.
