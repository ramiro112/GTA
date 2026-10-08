# Bekannte Fehler und offene Punkte

Stand: wird laufend gepflegt. Schweregrad: 🔴 hoch · 🟠 mittel · 🟢 niedrig

| # | Bereich | Beschreibung | Schwere | Status |
|---|---|---|---|---|
| 1 | Test-Umgebung | Im Container (ohne GPU) läuft das Spiel per Software-Rendering mit nur 1–2 FPS. Echte FPS-Messungen auf einem normalen PC stehen noch aus. Die automatisierten Tests spulen deshalb die Simulation vor. | 🟠 | offen (Umgebung) |
| 2 | Welt | Am Tunnelportal ist der Einschnitt ins Terrain wegen des 8-m-Rasters kantig. Die Portalwand verdeckt das grösstenteils. | 🟢 | offen |
| 3 | Welt | Gehwege, Requisiten und Fussgänger liegen in Parks/Vororten 12 cm über dem Terrain (Bordsteinhöhe). | 🟢 | offen |
