// Zentrale Interaktionspunkte (Läden, Garage, Tankstelle, Speichern, Aufzug …).
// Systeme registrieren Handler pro Typ; das System zeigt den Hinweis und löst die Aktion aus.

import { t } from './i18n.js';

export class Interactions {
  constructor(game) {
    this.game = game;
    game.interactions = this;
    this.handlers = new Map();
    this.points = [...(game.city.landmarks.interactables || [])];
    this.current = null;
  }

  /** handler: {label(pt) → string, available(pt) → bool, action(pt)} */
  register(type, handler) { this.handlers.set(type, handler); }

  add(point) { this.points.push(point); return point; }
  removePoint(point) { const i = this.points.indexOf(point); if (i >= 0) this.points.splice(i, 1); }

  update() {
    const g = this.game;
    const p = g.player;
    // In Luftfahrzeugen ist E das Seitenruder → keine Interaktionen
    if (p.dead || g.paused || (p.vehicle && p.vehicle.isAircraft)) { this.current = null; g.interactPromptActive = false; return; }
    const pos = p.vehicle ? p.vehicle.pos : p.pos;
    let best = null, bd = Infinity;
    for (const pt of this.points) {
      const h = this.handlers.get(pt.type);
      if (!h) continue;
      const d = Math.hypot(pt.x - pos.x, pt.z - pos.z);
      if (d > (pt.r || 2)) continue;
      if (pt.y !== undefined && Math.abs(pos.y - pt.y) > 3) continue;
      if (pt.y === undefined && pos.y > 4 && !p.vehicle) continue;
      if (h.available && !h.available(pt)) continue;
      if (d < bd) { bd = d; best = pt; }
    }
    this.current = best;
    g.interactPromptActive = !!best;
    if (best) {
      const h = this.handlers.get(best.type);
      g.hud.prompt(t('hud.interact', { key: `<kbd>${g.input.labelFor('interact')}</kbd>`, what: h.label(best) }));
      if (g.input.pressed('interact')) h.action(best);
    }
  }
}
