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

### Geprüft ohne Befund
Laden ohne Konsolenfehler **und ohne Warnungen**. Laufen und Springen. Kamera an Hauswänden (nicht in der Wand).
Ein- und Aussteigen per Tastenablauf, Fahren. 25 s Vollgas mit Lenkwechseln (kein Abheben, nicht umgekippt).
Waffenwechsel per Ziffer, Munitionsverbrauch, Nachladen, kein Hängenbleiben bei leerer Waffe.
Waffenrad schliesst bei Pause. Respawn zu Fuss (HP 100, Fahndung 0).
Speichern/Laden im Browser (Geld, Waffe, Position, Gesundheit, Weste, Missionen).
Wechsel Spiel ↔ Karte, Pause, Inventar, Handy und Waffenladen (Spiel läuft danach mit aktiver Eingabe).
Alle Tastatur-Aktionen sind belegt und werden im Code benutzt.
Missionen: der Durchspiel-Test schliesst alle 12 Missionen ab. Stresstest Verkehr und Passanten: 0 % feststeckend.
