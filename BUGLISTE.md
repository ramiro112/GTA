# Bugliste

Stand: 08.10.2026. Status: ✅ behoben · ⚠️ teilweise · ❌ offen.
Belege: automatisierter Bug-Check `node tests/smoke.mjs bugcheck` (harte Prüfungen, schlägt bei Fehlern fehl)
und Unit-Tests `npm test` (u. a. `tests/unit/robustness.test.mjs`). Ältere, schon früher behobene Fehler
stehen in `BEKANNTE_FEHLER.md` und im `ENTWICKLUNGSLOG.md`.

## Teil 1: Bug-Check

| # | Bereich | Gefundener Bug | Ursache | Lösung | Status |
|---|---|---|---|---|---|
| 1 | Fahrzeuge / alle Systeme | Während der Fahrt blieb die **Spielerposition am Einstiegsort** stehen (Test: Spieler bei z = 80, Auto bei z = 94 bzw. 87 m Abstand). Parkplatz-Streaming, Polizei-Suche, Pickups, Autosave usw. rechneten mit der falschen Position. | `Player.fixedUpdate` brach im Fahrzeug sofort ab, nichts koppelte `player.pos` an das Fahrzeug. | `Player.syncToVehicle()`: Position, Tempo und Richtung folgen dem Fahrzeug, vor und nach dem Fahrzeug-Physikschritt. | ✅ |
| 2 | Tod / Respawn | Nach dem **Tod im Fahrzeug** sass der Spieler nach dem Respawn weiter im Auto (Kamera und Steuerung am Unfallort, im Test 0 m von der Klinik, aber `vehicle` gesetzt). | Der Respawn setzte nur die Position. `pl.vehicle` blieb gesetzt, das Fahrzeug behielt den Spieler als Fahrer. | Beim Respawn wird zuerst ausgestiegen (`exitVehicle(force)`). | ✅ |
| 3 | Tod / Fahrzeuge | Ein **toter Fahrer lenkte weiter**: Tasten wirkten noch aufs Auto, ein Helikopter mit totem Piloten schwebte im Arcade-Modus weiter. | `_driveInput` und `playerInput` prüften nicht auf `dead`. Luftfahrzeuge galten als „gesteuert“, solange ein Fahrer drin sass. | Toter Fahrer = neutrale Steuerung (Auto rollt aus). Luftfahrzeuge sind nur mit lebendem Pilot gesteuert (sonst Absturz). Bordwaffen gesperrt. | ✅ |
| 4 | Polizei | Nach Tod im Fahrzeug blieb die **Fahndung** bestehen (2 Sterne nach Respawn). | Folge von Bug 2: Der Spieler sass weiter im gemeldeten Fahrzeug. | Mit Bug 2 behoben (Test: 0 Sterne nach Respawn). | ✅ |
| 5 | Waffen | **Raketenwerfer lud nie automatisch nach** (Magazin 0, Reserve 2, kein Schuss). | Automatisches Nachladen war nur für `type === 'gun'` vorgesehen. | Auch Projektilwaffen laden bei leerem Magazin automatisch nach. Unit-Test ergänzt. | ✅ |
| 6 | Speicher / Bildrate | **Speicherleck**: Beim Pendeln durch die Stadt wuchs die Zahl der GPU-Geometrien je Runde um ~80 (263 → 344 → 418 → 501). Die Bildrate wäre nach längerer Spielzeit gesunken. | Entfernte Fahrzeuge (Parkplatz- und Verkehrs-Streaming, Boote, Luftfahrzeuge) gaben Geometrie und Material nie frei. Projektile, Pickups, Waffenmodelle (jeder Waffenwechsel!), Missionsmarker und Nagelbänder erzeugten bei jeder Benutzung neue Geometrien. | Neues Modul `src/core/dispose.js` (`disposeTree`, `markShared`). Fahrzeuge, Marker und Nagelbänder werden beim Entfernen freigegeben. Waffenmodelle, Projektile und Pickups teilen gecachte Geometrien und Materialien. Ergebnis: 270 → 263 → 253 → 256 (stabil). | ✅ |
| 7 | Speichern | **Autosave im Fahrzeug** (z. B. nach einer Mission) speicherte eine veraltete Position. | Wie Bug 1, dazu die Fahrzeughöhe statt Bodenhöhe. | Im Fahrzeug wird die Fahrzeugposition auf Bodenhöhe gespeichert. | ✅ |
| 8 | Speichern | **Laden stürzte ab** bei einer unbekannten Waffen-ID (z. B. Spielstand einer anderen Version). Waffen landeten bei geänderter Slot-Belegung im falschen Slot, `NaN`/Text in Munition, Position oder Gesundheit zerstörte den Zustand. | `weaponDef()` warf bei unbekannter ID, die Slots wurden blind übernommen. `normalizeState` prüfte nur das Geld. | `WeaponInventory.fromJSON` überspringt Unbekanntes, sortiert nach Konfigurations-Slot und begrenzt Munition. `normalizeState` ersetzt ungültige Werte (Position, Richtung, Gesundheit, Weste, Listen, Uhrzeit). Unit-Tests ergänzt. | ✅ |
| 9 | Gamepad | **Doppelbelegungen**: B löste *Ducken und Nachladen* gleichzeitig aus, LB *Waffe zurück und Deckung*, RB *Waffe vor und Hupe* (im Auto). Im Luftfahrzeug war RT gleichzeitig *Steigen/Schub und Bord-MG*, LT *Sinken und Raketen*. | Feste Gamepad-Tabelle ohne Prüfung nach Situation (zu Fuss / Auto / Luft). | Neue Belegung (README): B Nachladen, R3 Ducken, LB Waffenrad, RB Deckung/Hupe/Gieren, Bord-MG B, Raketen X. Neuer Unit-Test prüft pro Situation, dass keine Taste zwei Aktionen auslöst. | ✅ |
| 10 | Tasten | Die **Fallschirm-Taste** (Aktion `parachute`, in Hilfe und Belegung angezeigt) tat nichts. Nur die Sprungtaste öffnete den Schirm, eine Neubelegung blieb wirkungslos. | Der Code fragte nur `jump` ab. | Fallschirm reagiert auf die eigene Aktion (und weiterhin auf Springen). | ✅ |
| 11 | Luftfahrzeuge / Tasten | Im Luftfahrzeug wechselten **Zifferntasten/Mausrad die Handwaffe**, LB öffnete am Gamepad das Waffenrad statt zu gieren. | Waffenwechsel war nicht an die Situation gebunden. | Im Luftfahrzeug sind Waffenwechsel und Waffenrad gesperrt (Bordwaffen). | ✅ |
| 12 | Fahrzeuge / Boden | Fahrzeuge hatten **keine Rettung beim Durchfallen** des Bodens (Spieler und Passanten hatten eine). | Fehlte. | Fahrzeug unter Geländehöhe −3 m → zurück auf den Boden (nicht auf Wasser). | ✅ |
| 13 | Spieler / Boden | Die Spieler-Rettung beim Durchfallen setzte die Figur u. U. **auf ein Dach oder auf den Berg über dem Tunnel**. | Bodenabfrage ab Geländehöhe +50 m. | Abfrage ab Geländehöhe +2 m. | ✅ |
| 14 | Luftfahrzeuge / Boden | Bei schnellem Sinkflug (bis ~2,5 m pro Physikschritt) konnte ein Luftfahrzeug **durch ein Dach in das Gebäude fallen**. | Die Bodenabfrage startete nur 0,5 m über der aktuellen (schon zu tiefen) Position. | Abfrage ab der höheren von alter und neuer Position. | ✅ |
| 15 | Gamepad | Im Auto ist LT gleichzeitig **Bremse und Zielen** (Drive-by). Wer bremst, zielt mit Pistole/MP mit. Geschossen wird erst mit RT, und RT ist auch Gas. | Gas und Bremse liegen am Gamepad auf den Triggern, Zielen ebenfalls. | **Offen.** Eine saubere Lösung braucht eine eigene Drive-by-Taste, und dafür sind alle Gamepad-Tasten im Auto belegt. Tastatur und Maus sind nicht betroffen. Ohne echten Controller nicht abstimmbar. | ❌ |
| 16 | Test | **Kein Test auf echter Hardware/GPU**: Bildrate, Ruckeln der Kamera und Gamepad-Verhalten sind im Container (Software-Rendering, kein Controller) nicht prüfbar. | Umgebung. | Logik ist per Test abgesichert (CPU ~2–3 ms pro Frame). **Offen**, braucht einen Testlauf auf einem echten Rechner. | ❌ |

## Teil 2: Bugs, die beim Testen der Luftfahrzeuge auftraten
Belege: `node tests/smoke.mjs aircraft` (50+ Prüfungen für alle vier Luftfahrzeuge).

| # | Bereich | Gefundener Bug | Ursache | Lösung | Status |
|---|---|---|---|---|---|
| 17 | Helikopter | **Schweben ungenau**: Nach dem Loslassen von Steigen stieg der Heli noch ~12 m weiter. | Nur schwache Dämpfung der Steiggeschwindigkeit. | Arcade-Steuerung über eine Ziel-Steig-/Sinkrate (`climbSpeed`/`descentSpeed` in der Config). Ohne Eingabe wird die Höhe gehalten (Test: ±3 m). | ✅ |
| 18 | Helikopter | **Landen war kaum möglich**: Sinken erreichte ~22 m/s, eine Dachlandung kostete 51 % Zustand. | Sinkrate war nur durch Luftwiderstand begrenzt. | Sinkrate begrenzt, dazu eine Landehilfe: unter 10 m bremst sie auf 2 m/s (`landingSinkSpeed`). Test: Dachlandung mit 100 % Zustand. | ✅ |
| 19 | HUD | **Höhe** zeigte am Boden 1,3 m statt 0 m. | Gemessen wurde vom Rumpfmittelpunkt aus statt von Kufen bzw. Rädern. | Höhe über Grund ab der Unterkante. | ✅ |
| 20 | Düsenjet | **Jets konnten nicht starten**: Sie standen nach Westen gerichtet 80 m vor dem Zaun und prallten beim Startlauf ab (−17 km/h). | Falsche Abstellposition und -richtung. | Jets stehen am Westende der Militärpiste, Nase nach Osten (420 m Startstrecke). | ✅ |
| 21 | Polizei | **Luftfahrzeug-Diebstahl blieb ohne Fahndung**, wenn kein Polizist zusah (Test: 0★). | Ein Diebstahl zählte nur mit Sichtkontakt der Polizei. | Die Flugsicherung meldet Diebstähle sofort. Frei nutzbare Maschinen der Flugschule sind kein Diebstahl. | ✅ |
| 22 | Polizei | **Fahndung sank beim Diebstahl selbst** um einen Stern (Test: 2★ → 1★). Betraf auch Autos mit Alarmanlage. | Die Regel „Fahrzeugwechsel ohne Sichtkontakt senkt die Fahndung“ griff auch beim gerade als gestohlen gemeldeten Fahrzeug. | Gemeldete Fahrzeuge sind ausgenommen. | ✅ |
| 23 | Spieler | **Unverwundbar im Fahrzeug**: Wer nach einem Respawn innerhalb von 3 s einstieg, blieb bis zum Aussteigen unverwundbar (Absturz ohne Tod). | Die Schutzzeit lief nur im Physikschritt zu Fuss ab. | Die Schutzzeit läuft immer ab. | ✅ |
| 24 | Flugzeuge | **Kein Schaden beim Flug in einen Hang** und beim Aufsetzen mit sehr hohem Tempo. | Nur die senkrechte Sinkrate zählte, die Hangneigung nicht. | Aufprall senkrecht zur Bodenfläche (Hangnormale) und Höchsttempo beim Aufsetzen (`safeLandingSpeed`). | ✅ |
| 25 | Flugzeuge | **Landen war mit Tastatur sehr schwer** (Test-Regler: Aufsetzen mit −7,8 m/s, 25 % Schaden). | Im Arcade-Modus gab es keine Hilfe beim Abfangen. | Arcade-Landehilfe: mit ausgefahrenem Fahrwerk und nicht steil nach unten zeigender Nase wird die Sinkrate kurz über dem Boden begrenzt. Test: −2,7 m/s, 100 %. | ✅ |
| 26 | Luftraum | Am **Kartenrand** prallten Luftfahrzeuge an der unsichtbaren Wand ab, verloren alle Fahrt, stürzten ins Meer und warfen den Piloten aus. | Weltgrenze als harte Wand. | Weicher Luftraum-Rand: 200 m vor der Grenze wendet die Maschine automatisch (Wenderadius ≤ 70 m), Hinweis im HUD. | ✅ |
| 27 | Absprung | Beim **Absprung aus dem Jet** starb der Spieler sofort. | Er wurde 3 m neben dem Rumpf abgesetzt, also innerhalb der 10 m Spannweite, und die Maschine erfasste ihn. | Absetzen ausserhalb der Spannweite, 1,5 s keine Kollision mit der eigenen Maschine. | ✅ |
| 28 | Helikopter | Ein **Hubschrauber ohne Piloten** hielt dank der Arcade-Höhenhaltung ewig die Höhe. | Die Höhenhaltung galt auch ohne Piloten. | Ohne (lebenden) Piloten sackt er ab und stürzt ab. | ✅ |
| 29 | Flugzeuge | Der **Propeller drehte ohne Pilot**, ein Flugzeug im Leerlauf mit Pilot war **stumm**. | Feste Leerlaufdrehzahl, Ton erst ab Schub > 2 %. | Leerlauf nur mit Pilot, Motorton im Leerlauf. | ✅ |
| 30 | HUD | Die **Fluginstrumente verdeckten Geld und Fahndung** oben rechts. | 3-spaltiges Raster wuchs nach oben. | Kompaktes 4-spaltiges Raster unten rechts. | ✅ |

## Teil 3: Startausrüstung
Beim Einbau keine neuen Fehler gefunden. Geprüft per `npm run smoke -- startkit` und 2 Unit-Tests:
- Startwaffen und Munition laut Config
- HUD je Waffe (Zifferntasten) und Waffenrad (5 Waffen mit Munition)
- Speichern/Laden der Startausrüstung
- Alter Spielstand (1500 $, nur Pistole) bleibt unverändert
- Neues Spiel nach dem Laden setzt alles wieder auf die Startwerte

Gefunden und verbessert: Die Fahrwerksanzeige „EIN/AUS“ war missverständlich, sie zeigt jetzt „Eingef./Ausgef.“

## Abschluss-Durchlauf (21:32)
`npm run final` startet die gebaute Einzeldatei `dist/PortAurelia.html` per `file://` neu und spielt mit echten
Tastatur- und Mausereignissen durch: neues Spiel (6000 $, 5 Waffen, HUD, Waffenrad, Pistolenschuss) → Auto
(einsteigen, 109 m fahren, aussteigen) → Helikopter am Heliport (steigen, vorwärts, drehen, Cockpit, landen mit
100 % Zustand, aussteigen) → Flugzeug an der Strandpiste (Start, 207 km/h, Fahrwerk ein, Absprung, Fallschirm,
Landung) → Speichern am Bett → **Seite neu laden** → Laden: Geld, Gesundheit, Position und Waffen identisch.
Ergebnis: **19/19 Prüfungen bestanden, keine Konsolenfehler und keine Warnungen.**

### Zusammenfassung
- 30 Fehler gefunden, **28 behoben**, 2 offen (Nr. 15 Gamepad-Drive-by, Nr. 16 kein Test auf echter Hardware).
- Testabdeckung: 37 Unit-Tests und 16 Browser-Szenarien (`sh tests/run_all.sh`), dazu der Abschluss-Durchlauf. Alles grün.

### Geprüft ohne Befund
Laden ohne Konsolenfehler **und ohne Warnungen**. Laufen und Springen. Kamera an Hauswänden (nicht in der Wand).
Ein- und Aussteigen per Tastenablauf, Fahren. 25 s Vollgas mit Lenkwechseln (kein Abheben, nicht umgekippt).
Waffenwechsel per Ziffer, Munitionsverbrauch, Nachladen, kein Hängenbleiben bei leerer Waffe.
Waffenrad schliesst bei Pause. Respawn zu Fuss (HP 100, Fahndung 0).
Speichern/Laden im Browser (Geld, Waffe, Position, Gesundheit, Weste, Missionen).
Wechsel Spiel ↔ Karte, Pause, Inventar, Handy und Waffenladen (Spiel läuft danach mit aktiver Eingabe).
Alle Tastatur-Aktionen sind belegt und werden im Code benutzt.
Missionen: der Durchspiel-Test schliesst alle 12 Missionen ab. Stresstest Verkehr und Passanten: 0 % feststeckend.
