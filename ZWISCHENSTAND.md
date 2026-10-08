# Zwischenstand – PORT AURELIA

**Stand:** 08.10.2026. Beginn 15:57 UTC, dieser Bericht ab ca. 18:00 UTC. Alle Uhrzeiten stehen in `ENTWICKLUNGSLOG.md`.

> **Offen gesagt zur Zeit:** Der Auftrag sah 24 Stunden vor. Gemessen an der Systemuhr hat die
> Arbeit in dieser Sitzung bisher rund **2 bis 2½ Stunden** gedauert. Danach war jeder Meilenstein
> (M0–M12) in einer ersten, lauffähigen und automatisiert getesteten Fassung fertig. Der Stand ist
> deshalb ein **funktionsreicher Prototyp**, kein poliertes Spiel. Viel Feinschliff (Spielgefühl,
> Balancing, Optik) braucht echtes Spielen auf echter Hardware. Das ging hier nicht (siehe Punkt 4).

---

## So probierst du es aus

1. **Doppelklick auf `dist/PortAurelia.html`.** Das Spiel liegt komplett in dieser einen Datei,
   ohne Installation und ohne Internet. Alternativ `npm start` → http://localhost:8080
2. Im Hauptmenü **„Neues Spiel“**, dann **ins Bild klicken** (Maus wird eingefangen).
3. Gleich vor dir liegt der gelbe Missionsmarker **„Heimkehr“**. Hineinlaufen startet die Story.

**Wichtigste Tasten:** WASD bewegen · Maus umsehen · Shift sprinten · Leertaste springen/klettern ·
F ein-/aussteigen (auch stehlen) · Maus R zielen, Maus L schiessen · Tab Waffenrad · E benutzen ·
M Karte · P Handy · O Missionen/Statistik · I Inventar · Esc Pause. Im Auto: Leertaste Handbremse,
N Radio, H Hupe, T Nebenjob. Helikopter: Shift/Strg steigen/sinken, WASD neigen, Q/E drehen.
Vollständige Belegung inkl. Gamepad: **README.md**.

**Schnell alles ansehen:** Handy (P) → **Testmenü** (Geld, alle Waffen, Fahrzeuge/Helikopter/Jet
spawnen, Fahndung, Gott-Modus, alle Missionen freischalten) und **Wetter** (Wetter/Zeit ändern).

### Screenshots
`docs/screenshots/` enthält Bilder aus den automatisierten Tests, eine Übersicht liegt in
`docs/screenshots/uebersicht.png`. Die Bilder stammen aus Headless-Chromium mit Software-Rendering
in niedriger Auflösung. Auf einer echten Grafikkarte sieht es schärfer aus.

| Szene | Datei |
|---|---|
| Innenstadt bei Tag, Hochhäuser, Zebrastreifen, Minimap | `showcase_01_*.png` |
| Nacht mit beleuchteten Fenstern und Laternen | `showcase_*night*.png` |
| Gewitter / Regen | `showcase_*storm*.png` |
| Strand bei Sonnenuntergang | `showcase_*beach*.png` |
| Verfolgungsjagd mit Fahndungsstern, Hubschrauber über der Stadt, Vorort, Hafen, Berge, Flughafen | `showcase_05` bis `showcase_10` |
| Flugzeug mit Instrumenten, Polizeihubschrauber | `flight_01_plane.png`, `flight_02_police_heli.png` |
| Missionsstart mit Zwischensequenz | `carry_01_cinematic.png` |
| Karte, Handy, Laden, Statistik, Inventar | `ui_*.png` |

---

## 1. Was ist fertig und spielbar

| Bereich | So probierst du es aus |
|---|---|
| **Offene Welt** mit 11 Gebieten, Autobahnring, 6 Brücken, Tunnel, Kreisverkehr, Ampeln, Zebrastreifen, Serpentinen zum Gipfel, Fluss und Meer, Parkhaus mit Rampe/Treppe/Dach | M öffnet die Karte, ein Klick setzt einen Wegpunkt, dann der lila Route folgen |
| **Spielfigur**: gehen, sprinten mit Ausdauer, springen, ducken, klettern, schwimmen, Fallschaden, Fallschirm | Leertaste vor einer Mauer bzw. einem Zaun; vom Parkhausdach springen |
| **13 Bodenfahrzeuge + Boot** mit Federung, Drift, Überschlag, Schaden, Rauch/Feuer/Explosion, Reifen, Benzin, Lichtern, Sirene | F an einem Auto: abgeschlossene Autos werden aufgebrochen (Alarm), fahrende Autos geentert (der Fahrer flieht, wehrt sich oder zieht eine Waffe) |
| **Garage, Werkstatt, Schrottplatz, Tankstelle** | eigene Garage neben deinem Haus; Theos Werkstatt (Reparatur, Lack, Tuning); Schrott-Hannes im Industriegebiet |
| **2 Helikopter + 2 Flugzeuge**, Arcade/Sim, Instrumente, Fallschirm, Bordwaffen | Flughafen im Nordwesten, Militärbasis im Nordosten (Sperrgebiet!), oder per Handy-Testmenü |
| **10 Waffen**, Trefferzonen, Deckung, Drive-by, Explosionen, Waffenladen, Aufsammeln, Gegenstände werfen | Eisenhand Waffen (Innenstadt); Tab = Waffenrad; E an einem Mülleimer = aufheben |
| **KI**: Passanten (Ampeln, Gespräche, Panik, Zeugen), Verkehr, 2 Banden mit Revieren, Wachen, Ladenbesitzer | ins Industriegebiet (Rostschlangen) oder an den Hafen (Kaiwölfe) gehen; in einem Laden die Waffe auf den Verkäufer richten |
| **Polizei 1–5 Sterne** mit Streifen, Sperren, Nagelbändern, Hubschrauber, SEK, Militär, Suchgebiet, Festnahme | vor einem Polizisten schiessen; Testmenü „Fahndung +1“ |
| **12 Story-Missionen** mit allen geforderten Typen, Checkpoints, Neustart (Enter), Autosave | Marker auf der Karte; mit dem Testmenü alle freischalten |
| **Nebenjobs**: Taxi, Rettungsdienst, Feuerwehr, Polizei, 2 Rennen, 4 Stunt-Sprünge, Kopfgeld | im passenden Fahrzeug T drücken; Kopfgeld-Brett an der Polizeiwache |
| **Wirtschaft**: Läden, Restaurant, Frisör, Kleidung, Autohändler, 3 Immobilien, Inventar | Kartensymbole |
| **UI**: HUD, Menüs, Einstellungen (Grafik, Ton, Tasten, Sprache), Karte, Handy, Tutorial | Esc → Einstellungen |
| **Tag/Nacht, 5 Wetterarten**, prozedurales 3D-Audio, **Radio mit 4 Sendern** | Handy → Wetter; im Auto N drücken |
| **Speichern/Laden** (3 Slots + Autosave) | am Bett im eigenen Haus (E) |

**Automatisierte Tests:** 29 Unit-Tests (Kern, Welt, Strassennetz, Kollision, Fahndung, Waffen,
Pathfinding, Tageszeit/Wetter, Missions-Engine, Speichern) und 14 Browser-Szenarien. Darunter ist
ein Durchspiel-Test, der **alle 12 Missionen abschliesst**, und ein Stresstest für Verkehr und Passanten.
Alles ist grün (`sh tests/run_all.sh`).

## 2. Was ist angefangen oder vereinfacht

- **LOD:** nur Distanz-Culling pro Chunk und Frustum Culling, keine eigenen LOD-Modelle.
- **Animationen:** prozedural aus Gliedern. Beim Einsteigen gibt es Gehen + Scheibe einschlagen + Sitzpose, aber keine Türanimation.
- **Fahrzeugschaden:** Schadensstufen über Farbe, Verkippung und Stauchung der Karosserie, keine Verformung einzelner Teile.
- **Ragdoll:** Umfallen mit Impuls, keine Gelenkphysik.
- **Zwischensequenzen:** Dialogboxen mit Untertiteln (optional Sprachausgabe) und eine kurze Kamerafahrt mit Kinobalken beim Missionsstart. Keine inszenierten Szenen.
- **Englisch:** Menüs, HUD, Tutorial und alle Missionsdialoge. **Missionsziele, Ladeneinträge und viele Meldungen sind nur deutsch.**
- **Verkehr:** hält die Spur, beachtet Ampeln und Abstand, hupt und setzt zurück. Kein Spurwechsel und kein Überholen.
- **Deckung:** ducken und an der Wand entlang bewegen, Gegner treffen schlechter. Kein Blind Fire.
- **Gamepad:** Standard-Layout eingebaut, aber **nicht mit einem echten Controller getestet**.

## 3. Was fehlt noch (nach Mind Map)

Kein Ast der Mind Map ist komplett offen. Bewusst nicht umgesetzt bzw. für die Planung offen:
- **Technik/Performance:** Messung auf echter Hardware (FPS, Speicher) steht aus. LOD-Modelle und Instancing pro Region für schwache GPUs fehlen.
- **Spielfigur:** Tauchen (nicht gefordert), Türanimationen, Ragdoll mit Gelenken.
- **Fahrzeuge:** Verformung einzelner Teile, abfallende Teile (Stossstange, Tür).
- **KI:** Spurwechsel, Überholen, Ausweichen um Hindernisse herum.
- **Missionen:** inszenierte Zwischensequenzen, Sprachaufnahmen. Die Story ist kurz (12 Missionen à ca. 3–10 Minuten).
- **UI:** vollständige Übersetzung ins Englische, eigene Gamepad-Belegung im Menü.
- **Audio:** Sprecher für Passanten, Polizeifunk mit Sprache.

## 4. Probleme, Fehler und Hürden

| Problem | Lösung / Status |
|---|---|
| **Keine GPU im Container.** Headless-Chromium rendert per Software mit 1–5 FPS, echtes Spielgefühl ist so nicht testbar. | Test-Hook `game.simulate(s)` spult die Physik ohne Rendern vor. Logik-Tests laufen dadurch schnell und reproduzierbar. **Offen:** echte FPS-Messung. CPU-Logik liegt bei nur ~2–3 ms pro Frame, ~400 Draw Calls und ~410k Dreiecke, für eine normale GPU sollte das reichen. |
| KI-Auto wurde an einer Tunnelwand auf 1348 m geschleudert | behoben: Kontaktfilter, Routenstart an der richtigen Strassenkante, Tunnelkorridor inkl. Wände |
| Mission „Der Spitzel“ war nicht schaffbar | behoben und per Durchspiel-Test abgesichert |
| Bergstrasse an Stellen ~45 ° steil | behoben (eigenes Höhenprofil, max. 19 %) |
| Lenkung und Flugsteuerung hatten falsche Vorzeichen (Koordinatensystem x = Ost, z = Süd) | behoben, Werte per Test geprüft |
| Auftrieb der Flugzeuge erst 30× zu klein, dann viel zu gross | behoben (Kalibrierung + Richtungsstabilität) |
| Einmal-Tasten konnten im festen Physiktakt doppelt oder gar nicht wirken | behoben (gepufferte Tastendrücke) |
| Flughafen-Wachen töteten den Spieler ohne Vorwarnung in ~1,5 s (beim Erstellen der Screenshots entdeckt) | behoben: 4 s Warnung mit Sprechblase, danach Angriff, Trefferquote gesenkt |
| Qualität „Hoch“ läuft im Container mit 0,1–0,5 FPS, der Test meldet einen Screenshot-Timeout | kein Spielfehler, aber auf echter Hardware ungeprüft |
| Uhrzeiten im Log anfangs geschätzt statt gemessen | korrigiert, seitdem Systemuhr |
| Offen: Feinabstimmung von Fahrgefühl, Flugmodell, Schwierigkeit, Kamera | braucht echtes Spielen (siehe Vorschläge) |

Weitere Punkte: `BEKANNTE_FEHLER.md`.

## 5. Entscheidungen und warum

- **Technik: Browser + Three.js + eigene Physik** (Vergleich in TECH_ENTSCHEIDUNG.md). Gründe: Start per Doppelklick, keine Installation, in dieser Umgebung voll testbar (Playwright), schnelle Iteration ohne Editor.
- **Alles prozedural** (Texturen, Modelle, Sound, Musik): keine Lizenzfragen, keine Downloads, Einzeldatei nur ~1,1 MB.
- **Stilisierte Low-Poly-Optik:** in der verfügbaren Zeit stimmig. Detailreichere Modelle wären der grösste Optik-Hebel.
- **Datengetrieben:** alle Spielwerte stehen in `src/config.js`, die Story liegt als Stufen-Skripte in `src/missions/story.js`. Balancing geht damit ohne Umbau.
- **Systeme lose gekoppelt** über einen Event-Bus (Verbrechen → Polizei/Zeugen/Audio, Missionen → Autosave). So bleibt das Projekt erweiterbar.
- **Speichern nur am Bett**, wie gefordert. Autosave zusätzlich an Missions-Checkpoints, damit nichts verloren geht.
- **Testmenü im Handy:** zum Ausprobieren für dich. Für eine „echte“ Version sollte es ausblendbar sein.
- **Jugendfreundlich:** Treffer erzeugen stilisierte dunkelrote Wölkchen statt Blut.

## 6. Vorschlag für die nächsten Schritte (priorisiert)

| # | Schritt | Schätzung |
|---|---|---|
| 1 | **Test auf deinem Rechner** (verschiedene GPUs), FPS-Messung, Qualitätsstufen nachjustieren, Draw Calls senken (Instancing pro Region, LOD für Bäume/Gebäude) | 3–5 h |
| 2 | **Spielgefühl-Pass:** Fahrphysik (Grip, Gewicht), Kamera, Flugsteuerung, Waffen-Feedback nach deinem Feedback | 4–6 h |
| 3 | **Balancing:** Schwierigkeit der Missionen, Polizei-Aggressivität, Preise und Belohnungen | 2–3 h |
| 4 | **Optik:** detailliertere Fahrzeug- und Figurenmodelle, Fahrzeugverformung, Fenster/Reflexionen, Strassendetails | 6–10 h |
| 5 | **Vollständige englische Übersetzung** und Gamepad-Belegung im Menü | 2–3 h |
| 6 | **Mehr Inhalt:** weitere Missionen, Nebenfiguren, inszenierte Zwischensequenzen, Radiomoderation | offen (pro Mission 1–2 h) |
| 7 | **KI-Verfeinerung:** Spurwechsel, Überholen, intelligentere Polizeitaktik | 3–4 h |

## 7. Fragen an dich

1. **Optik:** Sollen wir bei der stilisierten Low-Poly-Optik bleiben und sie verfeinern, oder Richtung realistischer gehen (deutlich mehr Aufwand)?
2. **Schwerpunkt:** Eher mehr **Story/Missionen** oder mehr **Sandbox** (Aktivitäten, Chaos, Fahrzeuge)?
3. **Spielgefühl:** Fahren und Fliegen eher **arcadig** (GTA-ähnlich) oder **simulationsnäher**?
4. **Zielplattform:** Reicht der Browser, oder soll es später eine Desktop-App (z. B. Electron/Tauri) geben?
5. **Gewaltgrad:** Ist die stilisierte, unblutige Darstellung so gewünscht?
6. **Testmenü:** Soll es in einer Release-Version bleiben (z. B. als „Cheats“) oder entfernt werden?
7. **Sprache:** Ist Englisch als Zweitsprache vollständig nötig, oder reicht Deutsch fürs Erste?
