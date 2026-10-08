# Bekannte Fehler und offene Punkte

Stand: 08.10.2026, Zwischenstand. Schweregrad: 🔴 hoch · 🟠 mittel · 🟢 niedrig

## Offen
| # | Bereich | Beschreibung | Schwere |
|---|---|---|---|
| 1 | Test/Performance | **Auf echter Hardware nicht getestet.** Der Container hat keine GPU, Headless-Chromium rendert per Software mit 1–5 FPS. Echte FPS-Werte fehlen. Gemessen: ~2–3 ms Spiellogik pro Frame, ~400 Draw Calls, ~410k Dreiecke. Auf schwachen integrierten GPUs ist „Niedrig“ ratsam. | 🟠 |
| 2 | Gamepad | Belegung eingebaut, aber ohne echten Controller getestet. Belegung im Menü nicht änderbar. | 🟠 |
| 3 | Sprache | Englisch nur für Menüs, HUD, Tutorial und Missionsdialoge. Missionsziele, Ladeneinträge und viele Meldungen bleiben deutsch. | 🟠 |
| 4 | Spielgefühl | Fahrphysik, Flugmodell, Kamera, Waffen-Rückstoss und Polizei-Aggressivität sind nur grob abgestimmt (Werte in `config.js`). | 🟠 |
| 5 | KI-Verkehr | Kein Spurwechsel, kein Überholen. Blockierte Autos setzen zurück und werden notfalls ausserhalb der Sicht entfernt. | 🟢 |
| 6 | KI-Verfolgung | Polizei- und Missionsautos fahren auf der Strassenmitte (nicht auf der eigenen Spur) und können in engen Kurven kurz an Wände stossen. | 🟢 |
| 7 | Welt | Am Tunnelportal ist der Einschnitt ins Terrain wegen des 8-m-Rasters kantig. Die Portalwand verdeckt das grösstenteils. | 🟢 |
| 8 | Welt | Requisiten und Gehwege liegen in Parks und Vororten 12 cm über dem Terrain (Bordsteinhöhe). | 🟢 |
| 9 | Figuren | Ragdoll vereinfacht (Umkippen). Tote NPCs können beim Umkippen leicht in Wände ragen. | 🟢 |
| 10 | Fahrzeuge | Insassen werden in niedrigen PKW auf 82 % verkleinert, damit der Kopf nicht durchs Dach ragt. | 🟢 |
| 11 | Missionen | „Luftrettung“: Rami „steigt ein“ durch Annäherung an den Hubschrauber, ohne Einstiegsanimation. | 🟢 |
| 12 | Audio | Motor- und Rotorklänge sind synthetisch und eher „retro“. Die Sprachausgabe hängt von den Systemstimmen des Browsers ab. | 🟢 |
| 13 | Speichern | Spielstände liegen im `localStorage` des Browsers. Wird `dist/PortAurelia.html` an einen anderen Ort kopiert, sind die Spielstände in Chrome dort nicht sichtbar (eigener Ursprung pro Datei). | 🟢 |
| 15 | Test | Qualitätsstufe „Hoch“ läuft im Container mit 0,1–0,5 FPS (Software-Rendering). Der automatische Test meldet dort nur einen Screenshot-Timeout, keinen Spielfehler. Ob „Hoch“ auf echter Hardware flüssig läuft, ist ungeprüft. | 🟠 |
| 14 | Pointer Lock | Esc gibt die Maus frei und öffnet die Pause. Zum Weiterspielen ins Bild klicken (Browser-Vorgabe). | 🟢 |

## Behoben (Auswahl, Details im ENTWICKLUNGSLOG)
- KI-Fahrzeuge wurden an Tunnelwänden in die Luft geschleudert.
- Mission „Der Spitzel“ war nicht schaffbar.
- Bergstrasse war stellenweise ~45 ° steil, der Autopilot kippte in Haarnadeln.
- Lenk- und Flug-Drehmomente hatten falsche Vorzeichen.
- Auftrieb der Flugzeuge war falsch kalibriert.
- Einmal-Tasten wirkten im Physiktakt doppelt oder gar nicht.
- Fahrzeuge spawnten auf Dächern.
- Kamera schaute nach dem Pointer-Lock senkrecht nach oben.
- Fahrerkopf ragte durchs Autodach.
