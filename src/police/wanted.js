// Fahndungslogik (rein, testbar): Verbrechen → Punkte → Sterne (1–5), Sichtkontakt, Suchgebiet,
// Abklingen ausser Sicht, Mindeststufen (Missionen/Sperrgebiete).

import { CONFIG, starsFromHeat } from '../config.js';

const PC = CONFIG.police;

export class WantedLevel {
  constructor() {
    this.heat = 0;
    this.lastSeen = null;      // {x, z}
    this.unseen = 0;           // Sekunden ohne Sichtkontakt
    this.searching = false;
    this.minStars = 0;         // z. B. Mission erzwingt Fahndung
    this.maxStars = 5;
    this.history = [];
  }

  get stars() {
    return Math.min(this.maxStars, Math.max(this.minStars, this.heat > 0 ? starsFromHeat(this.heat) : 0));
  }

  /**
   * Verbrechen eintragen.
   * @param {string} type Schlüssel aus CONFIG.police.crimePoints
   * @param {{x:number,z:number}} pos
   * @param {number} factor Gewichtung (z. B. 0.7 für Zeugenmeldung)
   */
  addCrime(type, pos, factor = 1) {
    const pts = (PC.crimePoints[type] || 20) * factor;
    const before = this.stars;
    // Schwere Verbrechen bei bestehender Fahndung zählen stärker
    this.heat += pts * (before > 0 ? 1.15 : 1);
    if (pos) this.lastSeen = { x: pos.x, z: pos.z };
    this.unseen = 0;
    this.searching = false;
    this.history.push({ type, pts });
    if (this.history.length > 50) this.history.shift();
    return { before, after: this.stars };
  }

  /** Mindestens n Sterne setzen (Sperrgebiet, Mission). */
  ensureStars(n, pos) {
    const t = PC.starThresholds[n - 1];
    if (this.heat < t) this.heat = t + 1;
    if (pos) this.lastSeen = { x: pos.x, z: pos.z };
    this.unseen = 0;
  }

  get searchRadius() { return this.stars ? PC.searchRadius[this.stars - 1] : 0; }
  get loseTime() { return this.stars ? PC.loseSightTime[this.stars - 1] : 0; }

  /**
   * Pro Frame aufrufen.
   * @param {number} dt
   * @param {boolean} seen Spieler wird gerade von Polizei gesehen
   * @param {{x:number,z:number}} pos Spielerposition
   * @returns {boolean} true, wenn die Fahndung in diesem Schritt erloschen ist
   */
  update(dt, seen, pos) {
    if (this.stars === 0) { this.searching = false; return false; }
    if (seen) {
      this.lastSeen = { x: pos.x, z: pos.z };
      this.unseen = 0;
      this.searching = false;
      return false;
    }
    this.searching = true;
    // Im Suchgebiet läuft die Zeit langsamer ab
    const inArea = this.lastSeen && Math.hypot(pos.x - this.lastSeen.x, pos.z - this.lastSeen.z) < this.searchRadius;
    this.unseen += dt * (inArea ? 0.5 : 1);
    if (this.unseen >= this.loseTime && this.minStars === 0) {
      this.clear();
      return true;
    }
    return false;
  }

  /** Fahndung um eine Stufe senken (z. B. Autowechsel unbeobachtet). */
  reduceOneStar() {
    const s = this.stars;
    if (s <= 1) { if (this.minStars === 0) this.clear(); return; }
    this.heat = PC.starThresholds[s - 2] + 1;
  }

  clear() {
    this.heat = 0;
    this.unseen = 0;
    this.searching = false;
    this.lastSeen = null;
  }

  toJSON() { return { heat: this.heat, lastSeen: this.lastSeen }; }
  static fromJSON(d) { const w = new WantedLevel(); if (d) { w.heat = d.heat || 0; w.lastSeen = d.lastSeen || null; } return w; }
}
