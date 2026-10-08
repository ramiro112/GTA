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
npm test           # Unit-Tests (node --test, 37 Tests)
npm run smoke -- basic   # Browser-Szenario (Playwright/Chromium), siehe tests/scenarios.mjs
npm run smoke -- bugcheck   # harter Bug-Check (Fahren, Waffen, Respawn, Speichern, Speicherlecks, Menüs)
npm run smoke -- aircraft   # alle vier Luftfahrzeuge: starten, fliegen, landen, Absturz, Fallschirm
npm run smoke -- startkit   # Startwaffen, Startgeld, HUD/Waffenrad, Speichern/Laden, alter Spielstand
npm run final      # Abschluss-Durchlauf mit dist/PortAurelia.html (file://, echte Tasten): Start → Auto → Heli → Flugzeug → Speichern → Neustart → Laden
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
| V | Ego-Perspektive / 3. Person (im Luftfahrzeug: Cockpit) |
| B | Nach hinten schauen |
| X | Fahrzeug aufrichten / auf die Strasse zurücksetzen |
| T | Nebenjob starten/beenden (im Taxi, Krankenwagen, Feuerwehr, Streifenwagen) |
| Maus rechts + links | Aus dem Fahrzeug schiessen (Pistole oder Maschinenpistole) |
| Maus links (Feuerwehr) | Wasserwerfer |

### Helikopter (Arcade-Modus)
| Taste | Aktion |
|---|---|
| Shift / Strg | Steigen / Sinken. Ohne Taste **schwebt** der Heli auf der Höhe, kurz über dem Boden bremst die **Landehilfe** das Sinken ab |
| W / S | Vorwärts / rückwärts (Neigen) |
| A / D | Seitwärts links / rechts |
| Q / E | Drehen links / rechts (Heckrotor) |
| V | Cockpit-Ansicht ↔ Verfolgerkamera (im Cockpit mit der Maus umschauen) |
| Maus links / rechts | Maschinengewehr / Raketen (nur Militärhubschrauber) |
| F | Aussteigen (am Boden) bzw. in der Luft **abspringen**, danach Leertaste = Fallschirm |

### Flugzeug
| Taste | Aktion |
|---|---|
| Shift / Strg | Schub erhöhen / verringern |
| W / S | Nase runter / Nase hoch (Neigen) |
| A / D | Rollen (Querlage = Kurve) |
| Q / E | Gieren / Seitenruder (am Boden: lenken) |
| G | Fahrwerk ein/aus |
| J | Landeklappen (0 → 1 → 2) |
| Leertaste | Radbremse am Boden |
| V | Cockpit-Ansicht ↔ Verfolgerkamera |
| Maus links / rechts | Maschinengewehr / Raketen (nur Jet) |
| F | Aussteigen bzw. abspringen (Fallschirm mit Leertaste) |

**Start:** Schub voll (Shift halten), ab ~100 km/h (Jet ~200 km/h) mit S die Nase hochziehen, danach G für das Fahrwerk.
**Landung:** Fahrwerk raus (G), Schub zurück (Strg), flach anfliegen. Mit ausgefahrenem Fahrwerk begrenzt die
Arcade-Landehilfe kurz über dem Boden die Sinkrate. Nach dem Aufsetzen Leertaste zum Bremsen.

In den Einstellungen lässt sich das Flugmodell zwischen **Arcade** (stabilisiert, hält die Höhe, Landehilfen)
und **Simulation** umschalten. Die Instrumente unten rechts zeigen Höhe, Tempo, Steigrate, Kompass,
Nick/Roll (künstlicher Horizont), Schub, Tank und Zustand, beim Flugzeug zusätzlich Fahrwerk, Klappen und
Strömungsabriss. Auf Landeplätzen (Heliport, Strandpiste, Flughafen, Militärbasis, Dach-Helipads) wird im Stand
**aufgetankt**. 200 m vor dem Kartenrand wendet jede Maschine automatisch Richtung Stadt.

### Luftfahrzeuge – wo sie stehen
| Fahrzeug | Standort | Nutzung |
|---|---|---|
| Helikopter „Libelle“ (klein) | **Heliport Flusspark**, ~200 m westlich vom Start (Karte: 🚁) | frei, keine Fahndung |
| Propellerflugzeug „Möwe“ | **Strandpiste** am Sonnenstrand, ~460 m südlich vom Start (Karte: 🛩), Startrichtung Osten | frei, keine Fahndung |
| Helikopter „Libelle“ | Penthouse-Dach (Himmelsturm) und 2 × Flughafen-Helipads | Penthouse: frei, wenn gekauft, sonst Diebstahl. Flughafen: Diebstahl |
| Propellerflugzeug „Möwe“ | 2 × Flughafen-Vorfeld (Nordwesten) | Diebstahl (Wachen, Fahndung) |
| Militärhubschrauber „Falke“ | 2 × Militärbasis Fort Kessel (Nordosten), Helipads | Diebstahl, Sperrgebiet (Wachen warnen 4 s, dann Feuer) |
| Düsenjet „Speer“ | 2 × Militärbasis, Westende der Piste, Nase nach Osten | Diebstahl, Sperrgebiet |

Einsteigen wie beim Auto mit **F**. Zerstörte oder abgestellte Maschinen erscheinen nach 2 Minuten wieder
an ihrem Platz, sobald man sich nähert. Alle Flugwerte (Tempo, Schub, Wendigkeit, Lebenspunkte, Tank,
Steig- und Sinkrate, Landehilfe) stehen kommentiert in `src/config.js` unter `aircraft` und `flight`.

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
Je Situation (zu Fuss / Auto / Luftfahrzeug) löst jede Taste nur eine Aktion aus (per Unit-Test geprüft).

| Taste | Zu Fuss | Auto / Boot | Luftfahrzeug |
|---|---|---|---|
| Linker Stick | Bewegen | Lenken | Neigen + Rollen |
| Rechter Stick | Kamera | Kamera | Kamera / im Cockpit umschauen |
| RT | Schiessen | Gas | Steigen bzw. Schub + |
| LT | Zielen | Bremse / rückwärts | Sinken bzw. Schub − |
| A | Springen, im Fall: Fallschirm | Handbremse | Radbremse |
| B | Nachladen | Nachladen (Drive-by) | Bord-MG |
| X | Benutzen | – | Raketen |
| Y | Einsteigen | Aussteigen | Aussteigen / Absprung |
| LB | Waffenrad (halten) | Waffenrad (halten) | Gieren links |
| RB | Deckung | Hupe | Gieren rechts |
| L3 / R3 | Sprinten / Ducken | – / Zurückschauen | – / Zurückschauen |
| D-Pad ↑ / ↓ | Handy / – | Handy / Radio | Handy / Landeklappen |
| D-Pad ← / → | – | Kamera / Licht | Cockpit / Fahrwerk |
| Start / Back | Pause / Karte | Pause / Karte | Pause / Karte |

---

## Startausrüstung (neues Spiel)
| | Wert |
|---|---|
| Geld | **6.000 $** (vorher 1.500 $). Reicht z. B. für Sturmgewehr (4.500 $) + Weste (500 $), aber nicht für Scharfschützengewehr, Raketenwerfer, Autos oder Immobilien |
| Waffen | Faust, **Baseballschläger**, **Pistole** (72 Schuss = 6 Magazine), **Maschinenpistole** (90 = 3 Magazine), **Schrotflinte** (18 = 3 Ladungen) |
| In der Hand | Faust (Waffen über das Waffenrad Tab bzw. LB oder die Tasten 2–5 wählen) |
| Weitere Waffen | Messer, Sturmgewehr, Scharfschützengewehr, Granaten, Raketenwerfer im Waffenladen „Eisenhand“ oder als Pickup/Missionsbelohnung |

Die Startwerte stehen in `src/config.js` (`player.startMoney`, `player.startWeapons`, `player.startWeapon`) und
gelten nur für **neue** Spiele. Bestehende Spielstände behalten Geld und Waffen. Bei Tod oder Festnahme gehen
die Waffen wie bisher verloren (die Faust bleibt).

## Spielinhalte im Überblick
- **Welt:** etwa 2 × 2 km mit 11 Gebieten, Autobahnring, 6 Brücken, Tunnel, Kreisverkehr, Ampeln mit Zebrastreifen, Serpentinen-Bergstrasse, Fluss und Meer, Parkhaus (Rampe, Treppe, begehbares Dach), betretbare Gebäude (Haus, Garage, Waffenladen, Kleidung, Restaurant, Frisör, Werkstatt, Autohaus, Bank), Flughafen und Militärbasis.
- **Fahrzeuge:** 13 Bodenfahrzeuge, Motorboot, 2 Helikopter, 2 Flugzeuge (Heliport und Strandpiste nahe am Start). Raycast-Fahrphysik, Schaden, Feuer, Explosion, Reifen, Benzin, Sirenen. Flug: Arcade/Simulation, Cockpit, Instrumente, Landehilfen, Auftanken, Fallschirm.
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
- `BUGLISTE.md`: Bug-Check mit Ursache, Lösung und Status je Fehler
- `ANFORDERUNGEN_CHECKLISTE.md`: jede Anforderung aus Teil 2 mit Status
- `ZWISCHENSTAND.md`: Bericht für die Besprechung
- `LIZENZEN.md`: Quellen und Lizenzen

## Lizenz
Eigener Code: MIT. Three.js: MIT (siehe `vendor/THREE_LICENSE.txt`).
