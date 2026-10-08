# PORT AURELIA – Schatten der Bucht

Ein Open-World-Actionspiel im Stil der grossen Stadt-Sandbox-Spiele, komplett im Browser
(JavaScript + Three.js). Stadt, Figuren, Firmen, Story, Grafik, Geräusche und Musik sind
**eigene Erfindungen bzw. werden prozedural erzeugt**. Es gibt keine fremden Marken,
Assets oder Musikstücke.

Du bist **Mika Varga** und kehrst nach Port Aurelia zurück. Onkel Theos Werkstatt wird von der
Bande *Rostschlangen* und ihrem Boss *Viktor Rask* erpresst. Zwölf Story-Missionen führen durch
alle Gebiete der Stadt: Innenstadt, Wohnviertel, Industriegebiet, Hafen, Strand, Vorort, Park,
Flughafen, Militärbasis, Berge und Wald. Dazu kommen Nebenjobs, Rennen, Stunt-Sprünge,
Kopfgelder, Läden, Immobilien und freies Spiel.

> Stand: Zwischenstand für die 24-Stunden-Besprechung. Was fertig ist, was vereinfacht ist und
> was fehlt, steht in **ZWISCHENSTAND.md** und **ANFORDERUNGEN_CHECKLISTE.md**.

---

## Systemvoraussetzungen

| | Minimum | Empfohlen |
|---|---|---|
| Browser | aktueller Chrome, Edge oder Firefox mit WebGL 2 | Chrome/Edge (beste Leistung, Pointer Lock, Gamepad) |
| Grafik | integrierte GPU (Qualität „Niedrig“) | eigene GPU (Qualität „Mittel/Hoch“) |
| Arbeitsspeicher | 4 GB | 8 GB |
| Installation | **keine** (Einzeldatei) | Node.js ≥ 18 nur für `npm start` / Tests / Build |

Safari funktioniert grundsätzlich, wurde aber nicht getestet.

---

## Starten

### Variante A – ein Doppelklick (empfohlen)
Öffne **`dist/PortAurelia.html`** im Browser (Doppelklick). Die Datei enthält das ganze
Spiel inklusive Three.js. Sie braucht weder Internet noch Server noch Installation.

### Variante B – lokaler Server
```bash
npm start          # oder: node start.js
```
Öffnet http://localhost:8080 automatisch (ohne externe Abhängigkeiten). Diese Variante nutzt
direkt die Quelldateien aus `src/`. Ein anderer Port: `node start.js 9000`.

### Neu bauen / testen (nur für Entwicklung)
```bash
npm install        # esbuild + three (nur für Build & Tests nötig)
npm run build      # erzeugt dist/PortAurelia.html neu
npm test           # Unit-Tests (node --test, 29 Tests)
npm run smoke -- basic   # Browser-Szenario (Playwright/Chromium), siehe tests/scenarios.mjs
sh tests/run_all.sh      # alle Unit-Tests + Browser-Szenarien
```
URL-Parameter: `?quality=low|medium|high` erzwingt eine Grafikstufe.

Beim ersten Start erscheint ein Hauptmenü. **Klicke ins Bild**, damit die Maus eingefangen wird
(Pointer Lock). **Esc** öffnet die Pause bzw. gibt die Maus frei.

---

## Tastenbelegung

Alle Tastatur- und Maus-Tasten sind unter **Einstellungen → Tastenbelegung** frei änderbar.
Die Liste zeigt die Standardbelegung.

### Zu Fuss
| Taste | Aktion |
|---|---|
| W A S D / Pfeiltasten | Bewegen |
| Maus | Umsehen |
| Shift (links) | Sprinten (verbraucht Ausdauer) |
| Leertaste | Springen · vor niedrigen Hindernissen: **Klettern** · im freien Fall: **Fallschirm** |
| C | Ducken (an/aus) |
| F | Ins Fahrzeug einsteigen / Auto stehlen / Fahrer herausziehen |
| G | Als Beifahrer mitfahren (Taxi) |
| E | Benutzen (Läden, Garage, Tankstelle, Bett = Speichern, Aufzug …) |
| Maus links | Angriff / Schiessen |
| Maus rechts | Zielen (Schulterkamera; Scharfschützengewehr: Zoom) |
| R | Nachladen |
| Q | Deckung an Wand/Auto (an/aus) |
| Tab (halten) | Waffenrad (Zeitlupe) – mit der Maus wählen, loslassen |
| 1 – 9, Mausrad | Waffe direkt wählen / wechseln |

### Fahrzeug (Auto, Motorrad, Boot)
| Taste | Aktion |
|---|---|
| W / S | Gas / Bremse bzw. rückwärts |
| A / D | Lenken |
| Leertaste | Handbremse (Driften) |
| F | Aussteigen (bei hoher Geschwindigkeit: abspringen) |
| H | Hupe |
| L | Licht |
| K | Sirene (Einsatzfahrzeuge) |
| N | Radiosender wechseln |
| V | Ego-Perspektive / 3. Person |
| B | Nach hinten schauen |
| X | Fahrzeug aufrichten / auf die Strasse zurücksetzen |
| T | Nebenjob starten/beenden (im Taxi, Krankenwagen, Feuerwehr, Streifenwagen) |
| Maus rechts + links | Aus dem Fahrzeug schiessen (Pistole oder Maschinenpistole) |
| Maus links (Feuerwehr) | Wasserwerfer |

### Helikopter
| Taste | Aktion |
|---|---|
| Shift / Strg | Steigen / Sinken (Kollektiv) |
| W / S | Nach vorn / hinten neigen (Zyklik) |
| A / D | Rollen links / rechts |
| Q / E | Gieren (Heckrotor) |
| Maus links / rechts | Maschinengewehr / Raketen (Militärhubschrauber) |
| F | Aussteigen bzw. in der Luft **abspringen**, danach Leertaste = Fallschirm |

### Flugzeug
| Taste | Aktion |
|---|---|
| Shift / Strg | Schub erhöhen / verringern |
| W / S | Nase runter / Nase hoch |
| A / D | Rollen |
| Q / E | Seitenruder (am Boden: lenken) |
| G | Fahrwerk ein/aus |
| J | Landeklappen (0 → 1 → 2) |
| Leertaste | Radbremse am Boden |
| Maus links / rechts | Maschinengewehr / Raketen (Jet) |

In den Einstellungen lässt sich das Flugmodell zwischen **Arcade** (stabilisiert, hält die Höhe)
und **Simulation** umschalten.

### Menüs und Sonstiges
| Taste | Aktion |
|---|---|
| Esc | Pause / Menü schliessen |
| M | Vollbildkarte (Klick = Wegpunkt mit GPS-Route, Rechtsklick = löschen, Mausrad = Zoom, Ziehen = verschieben) |
| P | Handy (Kontakte, Missionen, Taxi rufen, Schnellreise, Wetter, Testmenü) |
| I | Inventar (Waffen, Medikits, Westen, Snacks benutzen) |
| O | Missionen & Statistik (Fortschritt in %) |
| Enter / Leertaste | Dialog weiter · nach Fehlschlag: **vom Checkpoint neu starten** (Enter) |
| F3 | FPS-/Debug-Anzeige |

### Gamepad (Standard-Layout, Xbox-Bezeichnungen, feste Belegung)
| Taste | Aktion |
|---|---|
| Linker Stick | Bewegen / Lenken / Nicken+Rollen |
| Rechter Stick | Kamera |
| RT | Schiessen / Gas |
| LT | Zielen / Bremse / Raketen |
| A | Springen / Handbremse / Fallschirm |
| B | Ducken / Nachladen |
| X | Benutzen |
| Y | Ein-/Aussteigen |
| LB / RB | Waffe zurück/vor · Deckung · Hupe · Gieren |
| L3 / R3 | Sprinten / Kamera umschalten |
| D-Pad ↑ ↓ ← → | Handy · Waffenrad · Radio · Licht/Fahrwerk |
| Start / Back | Pause / Karte |

---

## Spielinhalte im Überblick
- **Welt:** etwa 2 × 2 km mit 11 Gebieten, Autobahnring, 6 Brücken, Tunnel, Kreisverkehr, Ampeln mit Zebrastreifen, Serpentinen-Bergstrasse, Fluss und Meer, Parkhaus (Rampe, Treppe, begehbares Dach), betretbare Gebäude (Haus, Garage, Waffenladen, Kleidung, Restaurant, Frisör, Werkstatt, Autohaus, Bank), Flughafen und Militärbasis.
- **Fahrzeuge:** 13 Bodenfahrzeuge, Motorboot, 2 Helikopter, 2 Flugzeuge. Raycast-Fahrphysik, Schaden, Feuer, Explosion, Reifen, Benzin, Sirenen.
- **Kampf:** 10 Waffen, Trefferzonen, Deckung, Drive-by, Explosionen mit Kettenreaktion.
- **KI:** Passanten, Verkehr, 2 Banden mit Revieren, Wachen, Polizei mit 5 Fahndungsstufen.
- **Missionen:** 12 Story-Missionen (alle geforderten Typen) plus Taxi, Rettungsdienst, Feuerwehr, Polizei-Einsätze, 2 Rennen, 4 Stunt-Sprünge und Kopfgeldjagd.
- **Wirtschaft:** Läden, Tuning, Schrottplatz, Immobilien, Inventar.
- **Technik:** Tag/Nacht, 5 Wetterarten, prozedurales 3D-Audio mit Radio, Speichern/Laden (3 Slots + Autosave), Deutsch/Englisch.

## Projektstruktur
```
index.html, start.js, build.mjs     Start, Server, Einzeldatei-Build
src/config.js                       ALLE Spielwerte (Tempo, Schaden, Preise, KI, Polizei …)
src/core/                           Spielschleife (fester Zeitschritt), Eingabe, Event-Bus, Pool, i18n …
src/world/                          Terrain, Strassengraph, Stadtgenerator, Kollision, Rendering, Himmel/Wetter
src/player/                         Spielfigur, Kamera, Tod/Festnahme
src/vehicles/  src/aircraft/        Fahr- und Flugphysik, Garage, Dienste
src/weapons/                        Waffen, Explosionen
src/ai/                             NPCs, Passanten, Verkehr, Banden, Pathfinding
src/police/                         Fahndung, Polizei-Einsätze
src/missions/                       Missions-Engine, Story, Nebenaktivitäten
src/economy/  src/save/             Läden, Inventar, Spielstände
src/ui/  src/audio/  src/fx/        Oberfläche, Ton/Radio, Partikel
tests/                              Unit-Tests (node --test) + Browser-Szenarien (Playwright)
docs/screenshots/                   Screenshots aus den automatisierten Tests
```

## Dokumente
- `MINDMAP.md`: Planung mit Abhak-Status
- `TECH_ENTSCHEIDUNG.md`: warum Browser + Three.js
- `ENTWICKLUNGSLOG.md`: Protokoll mit Uhrzeiten, Problemen und Lösungen
- `BEKANNTE_FEHLER.md`: offene Fehler und Einschränkungen
- `ANFORDERUNGEN_CHECKLISTE.md`: jede Anforderung aus Teil 2 mit Status
- `ZWISCHENSTAND.md`: Bericht für die Besprechung
- `LIZENZEN.md`: Quellen und Lizenzen

## Lizenz
Eigener Code: MIT. Three.js: MIT (siehe `vendor/THREE_LICENSE.txt`).
