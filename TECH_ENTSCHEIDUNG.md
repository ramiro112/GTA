# Technologie-Entscheidung

## Anforderungen an die Technik

1. **Lauffähigkeit ohne grosse Installation.** Der Auftraggeber soll das Spiel mit einem Befehl oder einem Klick starten können.
2. **3D-Unterstützung**: Licht, Schatten, Nebel, Partikel, grosse Welt.
3. **Physik**: Fahrzeuge, Flugzeuge, Projektile und Kollisionen.
4. **Entwicklungsgeschwindigkeit**: 24 Stunden, ein Entwickler, alles per Code (kein Editor mit GUI verfügbar).
5. **Performance**: mindestens 30 FPS, besser 60.
6. **Testbarkeit in dieser Umgebung**: Linux-Container ohne Bildschirm, mit Node.js 22, Python 3.13 und vorinstalliertem Chromium samt Playwright. Kein Unity, kein Unreal, kein Godot vorinstalliert, keine GPU.

## Verglichene Optionen

| Kriterium (1–5) | **Browser: JS + Three.js** | Browser: TS + Babylon.js | Python + Ursina/Panda3D | Godot 4 (GDScript) | Unity (C#) | Unreal (C++) |
|---|---|---|---|---|---|---|
| Start ohne Installation | **5** – Doppelklick auf HTML-Datei oder `npm start` | 5 | 2 – Python + pip-Pakete nötig | 3 – exportierte Binärdatei nötig, Export-Templates im Container fehlen | 2 – Build pro Plattform, Editor-Lizenz | 1 – riesige Builds |
| 3D-Unterstützung | 4 | 5 | 3 | 5 | 5 | 5 |
| Physik | 3 – eigene Physik nötig (oder cannon/rapier) | 4 – Havok-Plugin | 3 – Bullet über Panda3D | 4 | 5 | 5 |
| Entwicklungsgeschwindigkeit ohne GUI-Editor | **5** – reiner Code, sofort im Browser sichtbar | 4 – TS-Toolchain nötig | 4 | 3 – Szenen werden meist im Editor gebaut | 2 – ohne Editor sehr mühsam | 1 |
| Performance | 4 – WebGL2, Instancing, Merging | 4 | 3 – Python-Logik langsam bei viel KI | 5 | 5 | 5 |
| Testbarkeit hier | **5** – Headless Chromium + Playwright vorhanden, Logik mit `node --test` | 4 | 3 – kein Bildschirm, Offscreen-Rendering fummelig | 2 – Godot nicht installiert, headless nur ohne Rendering | 1 – nicht installierbar ohne Lizenz/GUI | 1 |
| **Summe** | **26** | 26 | 18 | 22 | 20 | 18 |

Babylon.js und Three.js liegen gleichauf. Den Ausschlag gibt die Projektgrösse: Three.js ist als **eine einzige Datei** (~1,3 MB) lokal einbindbar und lässt sich mit esbuild in eine einzige HTML-Datei bündeln. Ich kenne die API sehr gut, das spart Zeit. Babylon bringt mehr mit (Havok-Physik), ist aber deutlich grösser und hätte mehr Abhängigkeiten.

## Entscheidung: **JavaScript (ES-Module) + Three.js r169, eigene Spielphysik**

### Begründung
- **Ein Klick zum Starten:** `dist/PortAurelia.html` ist eine einzige Datei mit allem darin (Code, Three.js, prozedurale Inhalte). Doppelklick genügt, keine Installation, kein Internet. Alternativ startet `npm start` (bzw. `node start.js`) einen kleinen Webserver ohne externe Abhängigkeiten.
- **Keine externen Assets:** Texturen, Modelle (Low-Poly aus Primitiven), Geräusche und Musik erzeugt der Code selbst. Damit gibt es keine Lizenzprobleme und keine Downloads.
- **Eigene Physik statt cannon.js/rapier:** Ein GTA-artiges Spiel braucht keine allgemeine Starrkörperphysik, sondern spezialisierte Modelle:
  - Raycast-Fahrzeug mit Federung, Reifengrip, Schwerpunkt und Überschlag
  - Arcade- und Sim-Flugmodell für Helikopter und Flugzeuge
  - Charakter-Controller mit AABB-Kollision und Höhenabfrage
  - Kollisionen über einen Spatial Hash aus achsparallelen Boxen (Gebäude, Objekte) plus Heightmap-Terrain

  Das ist schneller, stabiler und besser steuerbar als eine generische Engine. WASM wird nicht gebraucht, und Fehler lassen sich leichter suchen.
- **Testbarkeit:** Reine Logik-Module (Waffenwerte, Fahndung, Missionen, Speichern, Pathfinding, Wirtschaft) hängen nicht von Three.js oder vom DOM ab. Sie werden mit `node --test` ohne Abhängigkeiten getestet. Das ganze Spiel läuft headless in Chromium (SwiftShader-WebGL) mit Playwright: Start, Screenshots, Konsolenfehler, FPS.
- **Stilisierte Low-Poly-Optik** mit prozedural erzeugten Fenster-Texturen (Canvas). Sie sieht in der verfügbaren Zeit stimmig aus.

### Nachteile (bewusst in Kauf genommen)
- Keine fertigen Animationen oder Modelle. Figuren bestehen aus Box-Gliedern mit prozeduraler Animation.
- Eigene Physik bedeutet eigene Fehler. Ausgleich: Rettungsfunktionen (Fahrzeug zurücksetzen, Stuck-Reset) und Tests.
- Ein Browser hat weniger Leistungsspielraum als native Engines. Ausgleich: Chunks, Merging, Pooling, Qualitätsstufen.

## Projektstruktur (Architektur)

```
index.html            Einstieg (Import-Map → vendor/three.module.js)
start.js              Webserver ohne Abhängigkeiten (npm start)
build.mjs             esbuild-Bündel → dist/PortAurelia.html (Einzeldatei)
vendor/               Three.js (MIT)
src/
  main.js             Bootstrap, Ladebildschirm
  config.js           ALLE Spielwerte (Tempo, Schaden, Preise, KI-Dichte …)
  core/               Game-Loop (fester Zeitschritt), Eingabe, Event-Bus, Pools, Mathe, Zufall, i18n
  world/              Stadtgenerator, Terrain, Strassengraph, Gebäude, Wasser, Kollision, Himmel/Wetter
  player/             Spielfigur, Kamera, Charaktermodell + Animation
  vehicles/           Fahrzeugphysik, Fahrzeugtypen, Schaden, Stehlen, Garage
  aircraft/           Helikopter- und Flugzeugphysik, Fallschirm
  weapons/            Waffendaten, Waffensystem, Projektile, Explosionen
  ai/                 Passanten, Verkehr, Banden, Pathfinding
  police/             Fahndungssystem, Polizei-Spawner
  missions/           Missions-Engine, Story-Missionen, Nebenaktivitäten
  economy/            Inventar, Geschäfte, Immobilien
  ui/                 HUD, Menüs, Karte, Handy, Einstellungen
  audio/              Web-Audio-Synthese, Radio
  save/               Spielstände
  fx/                 Partikel, Treffereffekte
tests/                node --test Unit-Tests + Playwright-Smoke-Test
```

Grundprinzipien: fester Physik-Zeitschritt (1/60 s), Render-Interpolation über einen Akkumulator, **Eingabe als Aktionen** (frei belegbar), **Event-Bus** zur Entkopplung (z. B. `crime`, `vehicle:exploded`, `mission:complete`), **Objekt-Pools** für Projektile, Partikel, Passanten und Autos, **config.js** als einzige Quelle für Spielwerte.
