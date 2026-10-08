// Bevölkerung: verwaltet alle NPCs (Passanten, Gangster, Polizei …), ihre Physik und Gehirne.
// Spawnt und entfernt Passanten um den Spieler (Pooling-Prinzip, siehe peds.js).

import { NPC } from './npc.js';

export class Population {
  constructor(game) {
    this.game = game;
    game.population = this;
    this.characters = [];
  }

  spawn(opts) {
    const n = new NPC(this.game, opts);
    this.characters.push(n);
    return n;
  }

  remove(n) {
    const i = this.characters.indexOf(n);
    if (i >= 0) this.characters.splice(i, 1);
    n.remove();
  }

  fixedUpdate(dt) {
    for (const c of this.characters) c.fixedUpdate(dt);
  }

  update(dt) {
    const p = this.game.player.pos;
    for (let i = this.characters.length - 1; i >= 0; i--) {
      const c = this.characters[i];
      // Ferne/lange tote Figuren aufräumen
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      c.distToPlayer = d;
      if ((c.dead && c.deadTime > 40) || (c.despawnable !== false && !c.persistent && d > 230 && !c.vehicle)) { this.remove(c); continue; }
      // Weit entfernte NPCs seltener denken lassen (Performance)
      if (d > 120 && (this.game.loop ? (this.game.loop._fpsFrames + c.id) % 3 !== 0 : false)) { c.model.root.position.copy(c.pos); continue; }
      c.update(dt);
    }
  }
}
