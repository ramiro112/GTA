# Quellen und Lizenzen

## Verwendete Bibliotheken
| Bibliothek | Version | Lizenz | Verwendung |
|---|---|---|---|
| [three.js](https://threejs.org) | r169 (0.169.0) | MIT, © 2010–2024 three.js authors (siehe `vendor/THREE_LICENSE.txt`) | 3D-Rendering (lokal in `vendor/` bzw. in `dist/PortAurelia.html` eingebettet) |
| [esbuild](https://esbuild.github.io) | 0.24.0 | MIT | nur zum Bauen der Einzeldatei (Entwicklungsabhängigkeit, nicht im Spiel enthalten) |
| Playwright / Chromium | vorinstalliert | Apache-2.0 / BSD | nur für automatisierte Tests |

## Inhalte (Grafik, Ton, Musik, Text)
Alle Inhalte sind **selbst erstellt** und werden zur Laufzeit **prozedural erzeugt**:

- **Texturen:** Fassaden mit Fensterraster und Nachtbeleuchtung, Asphalt, Gehwegplatten, Wasser-Normalen, Helipad, Schilder (Canvas 2D, `src/world/textures.js`)
- **Modelle:** Gebäude, Fahrzeuge, Luftfahrzeuge, Figuren und Requisiten aus Grundformen (Boxen, Zylinder, Kegel) im Code (`src/world/meshbuilder.js`, `src/vehicles/vehicleModel.js`, `src/aircraft/aircraft.js`, `src/player/character.js`, `src/world/props.js`)
- **Himmel, Wolken, Partikel:** eigene Shader (`src/world/environment.js`, `src/fx/particles.js`)
- **Geräusche:** Web-Audio-Synthese aus Oszillatoren und Rauschen (`src/audio/audio.js`)
- **Musik / Radio:** generative Kompositionen per Step-Sequencer, keine Samples (`src/audio/radio.js`)
- **Sprachausgabe (optional):** Web Speech API des Browsers (Systemstimmen). Es werden keine Audiodateien mitgeliefert.
- **Stadt, Figuren, Firmen, Story, Dialoge:** eigene Erfindungen. Namen wie „Port Aurelia“, „Rostschlangen“, „Kaiwölfe“, „Eisenhand Waffen“ oder „Velox GT“ sind erfunden. Bezüge zu realen Marken oder zu anderen Spielen sind nicht beabsichtigt.

Es werden **keine** Assets, Marken, Logos, Namen, Karten, Figuren oder Musik aus GTA oder anderen Spielen verwendet.
