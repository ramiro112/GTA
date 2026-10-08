# Checkliste aller Anforderungen aus Teil 2

Status: **fertig** (umgesetzt und getestet) · **vereinfacht** (funktioniert, aber einfacher als gefordert) · **angefangen** (teilweise) · **fehlt**

„Getestet“ heisst: automatisierter Unit-Test und/oder Browser-Szenario (`tests/scenarios.mjs`) im
Headless-Chromium. Auf echter Hardware mit echter Grafikkarte ist **noch nicht** getestet worden (siehe ZWISCHENSTAND.md).

## 2.1 Spielwelt
| Anforderung | Status | Bemerkung |
|---|---|---|
| Grosse zusammenhängende Stadt ohne Ladebildschirm | fertig | ca. 2 × 2 km, nahtlos, Distanz-Culling pro 200-m-Chunk |
| Innenstadt mit Hochhäusern | fertig | Türme bis ~180 m, Bürofassaden, Dachaufbauten, Helipads |
| Wohnviertel | fertig | Wohnblöcke mit Innenhöfen, Parkplätze |
| Industriegebiet | fertig | Lagerhallen, explosive Tanks, Schornsteine, Container, Fässer |
| Hafen | fertig | Kaimauer, Containerstapel, Lagerhallen, Bootsliegeplätze |
| Strand/Küste | fertig | Sandstrand mit Palmen, Rettungstürmen, Sonnenschirmen, Steg |
| Vorort | fertig | Einfamilienhäuser mit Satteldach, Zäunen, Einfahrten |
| Park | fertig | Flusspark mit Bäumen, Bänken, Brunnen |
| Flughafen | fertig | Startbahn mit Befeuerung, Vorfeld, Terminal, Tower, Hangars, Helipads |
| Militärgelände | fertig | Zaun, Tor, Wachtürme, Kasernen, Hangar, Startbahn, Wachen |
| Berge/Land mit Wald | fertig | Graufels-Berge mit Schnee, Westwald, ~2000 Bäume, Felsen |
| Strassennetz mit Kreuzungen | fertig | Graph mit 139 Knoten/241 Kanten, A*-Suche |
| Autobahn | fertig | Autobahnring, 4 Spuren, Mittellinie |
| Brücken | fertig | 6 Brücken über den Fluss mit Bögen, Geländer, Pfeilern |
| Tunnel | fertig | 200-m-Tunnel durch einen Bergsporn mit Portalen und Beleuchtung |
| Kreisverkehr | fertig | Einbahn-Ring mit Insel, Verkehr fährt gegen den Uhrzeigersinn |
| Bürgersteige | fertig | mit Bordsteinkante, begehbar |
| Zebrastreifen | fertig | an allen Ampelkreuzungen, Passanten queren nur bei Rot für den Querverkehr |
| Ampeln | fertig | 64 Ampelkreuzungen, Phasen (Grün/Gelb/Rot), Verkehr hält an |
| Betretbare Gebäude: Läden, Waffenladen, Garage, Haus | fertig | Innenräume mit Theken, Möbeln, Verkäufern; zusätzlich Restaurant, Frisör, Werkstatt, Autohaus, Bank |
| Kulissengebäude | fertig | ca. 380 prozedurale Gebäude |
| Wasser (Meer, Fluss) mit Schwimmen | fertig | animiertes Wasser, Schwimmen mit Ausdauer |
| Höhenunterschiede, Rampen, Treppen, Dächer | fertig | Heightmap, Parkhaus mit Rampe und Treppe, begehbare Dächer, Stunt-Rampen, Serpentinen-Bergstrasse (max. 19 %) |
| Tag-und-Nacht-Zyklus | fertig | 24 Minuten pro Spieltag, Sonne/Mond/Sterne |
| Strassenlaternen, Fahrzeuglichter, beleuchtete Fenster | fertig | Lichtkegel am Boden, echter Scheinwerfer am Spielerauto, Fahrzeuglichter aller Autos, zufällig beleuchtete Fenster |
| Wetter: klar, bewölkt, Regen, Nebel, Gewitter | fertig | Überblendung, Regenpartikel, nasse Strassen, Blitze mit Donner |
| Minimap + Vollbildkarte mit Markierungen | fertig | rotierende Minimap mit GPS-Route, Vollbildkarte mit Zoom, Legende und Wegpunkt |
| Weltgrenze | fertig | Ozean und unsichtbare Wand bei ±1100 m |
| Streaming oder LOD | vereinfacht | Distanz-Culling pro Chunk, Frustum Culling, adaptive Terrainauflösung, Streaming von Fahrzeugen/NPCs. **Keine** echten LOD-Stufen für Modelle |

## 2.2 Spielfigur und Steuerung
| Anforderung | Status | Bemerkung |
|---|---|---|
| Gehen, Laufen, Rennen mit Ausdauer | fertig | Analogstick ermöglicht langsames Gehen |
| Springen, Ducken | fertig | |
| Klettern über niedrige Hindernisse | fertig | bis 1,6 m, kurze Kletteranimation |
| Schwimmen | fertig | Tauchen fehlt (nicht gefordert) |
| Fallschaden | fertig | ab 11 m/s Aufprallgeschwindigkeit |
| Third-Person-Kamera mit Maus und Kollision | fertig | |
| Zielmodus über der Schulter | fertig | |
| Ego-Perspektive im Fahrzeug | fertig | Taste V |
| Tastatur + Maus, Gamepad | fertig | Gamepad mit festem Standard-Layout (im echten Gerät ungetestet) |
| Frei belegbare Tasten | fertig | gespeichert in den Einstellungen |
| Gesundheit, Rüstung, Ausdauer, Tod, Krankenhaus mit Geldabzug | fertig | $500 Gebühr, Waffen weg |
| Animationen: Stehen, Gehen, Rennen, Springen, Schwimmen, Schiessen, Ein-/Aussteigen | vereinfacht | prozedurale Gliederanimation; Ein-/Aussteigen = zur Tür gehen, Scheibe einschlagen, Sitzpose, aber **keine** Türanimation |

## 2.3 Fahrzeuge am Boden
| Anforderung | Status | Bemerkung |
|---|---|---|
| Kleinwagen, Limousine, Sportwagen, SUV/Pickup, Lastwagen, Bus, Motorrad, Polizei, Krankenwagen, Taxi | fertig | dazu Feuerwehr, SEK-Transporter, Militär-Geländewagen |
| Motorboot | fertig | Auftrieb, Wellen, Spritzwasser, auf Grund laufen |
| Beschleunigen, Bremsen, Handbremse, Lenken, Rückwärts, Driften | fertig | Raycast-Fahrzeug mit Reibungskreis |
| Federung, Gewicht, Schwerpunkt, Überschlagen | fertig | Federung je Rad, Trägheitstensor, Karosserie-Ecken als Kontakte |
| Werte pro Fahrzeug | fertig | `config.js` → `vehicles` |
| Schadensmodell: Schadensstufen, Rauch, Feuer, Explosion | vereinfacht | Schadensstufen über Farbe, Verkippung und Stauchung der Karosserie; **keine** echte Verformung einzelner Teile |
| Reifen können platzen | fertig | durch Schüsse und Nagelbänder |
| Scheinwerfer, Bremslichter, Blinker, Hupe, Sirene | fertig | KI-Autos blinken beim Abbiegen |
| Tank/Benzin, Tankstellen | fertig | 3 Tankstellen, Tanken mit E |
| Fahrer herausziehen (wehrt sich/flieht/zieht Waffe) | fertig | Wahrscheinlichkeiten in `config.js` |
| Parkende Autos aufbrechen + kurzschliessen | fertig | Scheibe einschlagen, Fortschrittsbalken |
| Abgeschlossene Autos → Alarm, Aufmerksamkeit | fertig | Alarm mit Blinkern und Ton, Zeugen melden es |
| Gestohlene Autos als gesucht erkannt | fertig | gemeldete Autos werden von Polizisten in Sichtweite erkannt |
| Garage: speichern, reparieren, umlackieren, tunen (Motor, Reifen, Panzerung) | fertig | eigene Garage (Einlagern) + Theos Werkstatt (Reparatur, 10 Lacke, 3 Tuning-Bereiche); Umlackieren senkt die Fahndung |
| Verschrottung/Verkauf | fertig | Schrottplatz, Preis nach Zustand |
| Beifahrer, Taxi rufen, Schnellreise | fertig | Taxi per Handy oder auf der Strasse mit G, Zielwahl, Schnellreise per Handy |

## 2.4 Luftfahrzeuge
| Anforderung | Status | Bemerkung |
|---|---|---|
| 2 Helikopter, 2 Flugzeuge | fertig | Libelle, Falke (Militär), Möwe (Propeller), Speer (Jet) |
| Flugsteuerung: Schub, Höhe, Neigung, Rollen, Gieren | fertig | |
| Landeklappen/Fahrwerk, Kollektiv/Zyklik | fertig | |
| Arcade + Simulationsmodus | fertig | umschaltbar in den Einstellungen |
| Start/Landung: Flughafen, Landeplätze, Dächer | fertig | Helipads auf Klinik, Polizei, Penthouse, einzelnen Hochhäusern |
| Instrumente: Höhe, Tempo, Neigung, Treibstoff, Kompass | fertig | zusätzlich Steigrate, Schub, Fahrwerk, Klappen, Strömungsabriss, künstlicher Horizont |
| Absturz mit Schaden, Explosion, Tod | fertig | |
| Fallschirm | fertig | |
| Stehlbar mit Wachen | fertig | Flughafen-Sicherheit, Soldaten auf dem Militärgelände (Sperrgebiet = 4 Sterne) |
| Waffen an Militärheli/Jet | fertig | MG und Raketen |
| Flugmissionen | fertig | „Flugstunde“ (12 Ringe + Landung), „Luftrettung“ (Dachlandung) |

## 2.5 Waffen und Kampf
| Anforderung | Status | Bemerkung |
|---|---|---|
| Waffenrad, Hotkeys | fertig | Zeitlupe beim Waffenrad |
| Faust, Messer, Schläger, Pistole, MP, Schrotflinte, Sturmgewehr, Scharfschützengewehr, Granaten, Raketenwerfer | fertig | |
| Munition, Nachladen, Magazin, Rückstoss, Streuung, Reichweite | fertig | |
| Trefferzonen Kopf/Körper/Beine | fertig | Faktoren 2,5 / 1 / 0,6 |
| Fadenkreuz, Zoom, Auto-Aim | fertig | Trefferanzeige |
| Deckung | vereinfacht | Q an Wand/Fahrzeug: geduckt, Bewegung entlang der Wand, Gegner treffen schlechter; **kein** „Blind Fire“ |
| Schiessen aus dem fahrenden Auto | fertig | Pistole und MP |
| Explosionen: Flächenschaden, Druckwelle, Feuer, explodierende Autos und Tanks | fertig | Kettenreaktionen, Brandherde |
| Treffereffekte | fertig | Funken, Einschusslöcher, stilisierte (nicht blutige) Trefferpartikel, Leuchtspur |
| Waffenladen, Munition | fertig | |
| Waffen aufsammeln (Gegner, Boden) | fertig | 15 feste Pickups + Waffen besiegter Gegner |

## 2.6 KI
| Anforderung | Status | Bemerkung |
|---|---|---|
| Fussgänger laufen, beachten Ampeln | fertig | Gehweg-Graph mit 476 Knoten |
| Gespräche (angedeutet) | fertig | stehen sich gegenüber, Sprechblasen |
| Fliehen, Panik, Widerstand | fertig | ducken, fliehen, aggressive Passanten wehren sich |
| Verkehr: Spuren, Ampeln, Kreuzungen, Hindernisse, Ausweichen/Hupen | vereinfacht | Spurhalten, Ampeln, Abstand, Hupen, Zurücksetzen bei Blockade; **kein** Spurwechsel bzw. aktives Überholen |
| Dichte je Gebiet und Tageszeit | fertig | |
| Banden mit Revieren, Gruppen, Taktik, Deckung, Flucht, Verstärkung | fertig | 2 Banden, Warnung → Angriff, Flankieren, Verstärkung im Auto |
| Pathfinding | fertig | A* auf Strassengraph (inkl. Polylinien) und auf Gitter (zu Fuss) |
| Verhalten: friedlich, ängstlich, aggressiv, Wachen | fertig | |

## 2.7 Polizei
| Anforderung | Status | Bemerkung |
|---|---|---|
| 1–5 Sterne | fertig | |
| Streife zu Fuss, Polizeiautos, Strassensperren, Nagelbänder, Helikopter, SEK, Militär | fertig | |
| Sichtlinie, Suchgebiet, Abklingen | fertig | Suchkreis auf der Minimap, blinkende Sterne |
| Auto wechseln senkt Fahndung | fertig | unbeobachteter Wechsel −1 Stern |
| Festnahme/Tod → Verlust, Respawn | fertig | |
| Zeugen melden Verbrechen | fertig | verzögerte Meldung, Zeugen können vorher gestoppt werden |

## 2.8 Missionen und Story
| Anforderung | Status | Bemerkung |
|---|---|---|
| Hauptstory ≥ 10 Missionen mit Figuren | fertig | 12 Missionen, Protagonist Mika, 4 Auftraggeber, Gegenspieler Viktor Rask |
| Verfolgungsjagd | fertig | „Der Spitzel“ |
| Auto stehlen und abliefern | fertig | „Ersatzteile“ |
| Schiessereien/Bandenkämpfe | fertig | „Schutzgeld“ (3 Wellen) |
| Lieferung mit Zeitlimit | fertig | „Eilzustellung“ |
| Hubschrauber-Mission | fertig | „Luftrettung“ |
| Flugzeug-Mission | fertig | „Flugstunde“ |
| Raubüberfall mit Planung, Ausführung, Flucht | fertig | „Der Plan“ + „Der grosse Coup“ |
| Schleichmission | fertig | „Unsichtbar“ (Sichtkegel, Entdeckungsanzeige) |
| Rennen mit Checkpoints | fertig | „Strassenkönig“ gegen 3 KI-Fahrer |
| Bosskampf | fertig | „Abrechnung“ (2 Phasen) |
| Auftraggeber, Kartenmarker, Zwischenziele, Zeitlimit, Fehlschlag, Checkpoint-Neustart | fertig | |
| Zwischensequenzen/Dialoge mit Untertiteln | vereinfacht | Dialogboxen mit Untertiteln, optional Sprachausgabe; als Zwischensequenz nur eine kurze Kamerafahrt mit Kinobalken |
| Nebenmissionen: Taxi, Krankenwagen, Feuerwehr, Polizei, Rennen, Stunts, Sprünge, Kopfgeld | fertig | |
| Belohnungen: Geld, Waffen, Fahrzeuge, Freischaltungen | fertig | |
| Missionsstatistik und Fortschritt | fertig | Taste O |

## 2.9 Wirtschaft
| Anforderung | Status | Bemerkung |
|---|---|---|
| Geld durch Missionen, Raub, Autoverkauf, Aktivitäten | fertig | Ladenbesitzer lassen sich mit vorgehaltener Waffe ausrauben |
| Waffenladen, Kleidung, Autohändler, Tankstelle, Restaurant, Frisör, Tuning | fertig | |
| Immobilien kaufen, speichern, Fahrzeuge parken | fertig | 3 Immobilien; Kauf bringt Speicherpunkt + 2 Garagenplätze |
| Inventar | fertig | Waffen, Munition, Medikits, Westen, Snacks |
| Preise in Konfigurationsdatei | fertig | |

## 2.10 Benutzeroberfläche
| Anforderung | Status | Bemerkung |
|---|---|---|
| HUD komplett | fertig | |
| Hauptmenü, Pause, Einstellungen (Grafik, Ton, Steuerung, Sprache), Karte, Missionen, Statistik, Inventar | fertig | |
| Handy-Menü | fertig | |
| Tutorial | fertig | 6 Tipps beim ersten Start |
| Ladebildschirm | fertig | |
| Sprache DE/EN | vereinfacht | Menüs, HUD, Tutorial und alle Missionsdialoge zweisprachig; **Missionsziele, Laden-Einträge und viele Meldungen nur auf Deutsch** |

## 2.11 Grafik
| Anforderung | Status | Bemerkung |
|---|---|---|
| Beleuchtung, Schatten, Himmel, Wolken, Wasser, Nebel | fertig | |
| Partikel: Rauch, Feuer, Funken, Explosionen, Regen, Staub | fertig | |
| Stilisierte Low-Poly-Optik | fertig | |
| LOD, Frustum Culling, Qualitätsstufen | vereinfacht | Qualitätsstufen und Culling fertig, LOD nur über Distanz-Culling (siehe 2.1) |

## 2.12 Audio
| Anforderung | Status | Bemerkung |
|---|---|---|
| Motoren je Fahrzeug, Schüsse, Explosionen, Schritte, Umgebung, Regen, Verkehr, Sirenen, Rotor | fertig | alles synthetisch |
| Musik und Radio mit mehreren Sendern | fertig | 4 generative Sender |
| 3D-Audio, Lautstärkeregler | fertig | |
| Freie Quellen benannt | fertig | LIZENZEN.md |

## 2.13 Speichern/Laden
| Anforderung | Status | Bemerkung |
|---|---|---|
| Mehrere Spielstände, Autosave an Checkpoints, manuelles Speichern in Unterkünften | fertig | |
| Gespeicherte Daten (Position, Geld, Waffen, Munition, Garage, Missionen, Fahndung, Zeit, Einstellungen) | fertig | Unit-Test für Rundreise |

## 2.14 Physik und Weltinteraktion
| Anforderung | Status | Bemerkung |
|---|---|---|
| Kollisionen | fertig | |
| Zerstörbare Objekte (Laternen, Zäune, Briefkästen, Schilder) | fertig | auch Hydranten (Wasserfontäne), Mülleimer, Bänke; Wiederaufbau nach 90 s |
| Ragdoll | vereinfacht | Umfallen mit Impuls und Wegrutschen, **keine** Gelenkphysik |
| Fussgänger anfahren → Fahndung | fertig | |
| Objekte aufheben, werfen, umstossen | fertig | Mülleimer, Fässer, Schilder, Briefkästen, Bänke usw. mit E aufheben und mit Maus links werfen |
