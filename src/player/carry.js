// Gegenstände aufheben und werfen: kleine Requisiten (Mülleimer, Fässer, Schilder, Briefkästen,
// Bänke) mit E aufheben, mit Maus links werfen. Getroffene Figuren werden umgestossen,
// Fahrzeuge bekommen Dellen.

import * as THREE from 'three';
import { propMesh } from '../world/props.js';
import { events } from '../core/events.js';

const CARRYABLE = new Set(['trash', 'mailbox', 'sign', 'barrel', 'bench', 'hydrant', 'umbrella']);

export class CarrySystem {
  constructor(game) {
    this.game = game;
    game.carry = this;
    this.held = null;     // {type, mesh}
    this.flying = [];
  }

  /** Nächstes aufhebbares Requisit vor dem Spieler. */
  _nearest() {
    const pl = this.game.player;
    const list = this.game.collision.query(pl.pos.x - 2, pl.pos.z - 2, pl.pos.x + 2, pl.pos.z + 2, []);
    let best = null, bd = 1.8;
    for (const b of list) {
      if (!b.prop || b.prop.broken || !CARRYABLE.has(b.prop.type)) continue;
      const d = Math.hypot(b.prop.x - pl.pos.x, b.prop.z - pl.pos.z);
      if (d < bd) { bd = d; best = b.prop; }
    }
    return best;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    this._updateFlying(dt);
    if (g.paused) return;
    if (pl.dead || pl.vehicle) { if (this.held) this._drop(); return; }
    if (this.held) {
      g.hud.prompt(`<kbd>Maus L</kbd> Werfen · <kbd>${g.input.labelFor('interact')}</kbd> Ablegen`);
      if (g.input.pressed('attack')) this._throw();
      else if (g.input.pressed('interact')) this._drop();
      return;
    }
    if (g.interactPromptActive || g.vehicles.nearestEnterable(pl.pos)) return;
    const p = this._nearest();
    if (p) {
      g.hud.prompt(`<kbd>${g.input.labelFor('interact')}</kbd> Aufheben`);
      if (g.input.pressed('interact')) this._pickup(p);
    }
  }

  _pickup(rec) {
    const g = this.game;
    g.city.breakProp(rec);
    const mesh = propMesh(rec.type);
    mesh.scale.setScalar(0.7);
    mesh.position.set(0, -0.2, 0.35);
    g.player.model.hand.add(mesh);
    g.player.model.setWeapon(null);
    this.held = { type: rec.type, mesh, rec };
    // Waffe "wegstecken": Faust auswählen
    g.player.inventory.select(0);
    g.weapons.fireTimer = 0.4;
    events.emit('carry:pickup', { type: rec.type });
  }

  _drop() {
    const g = this.game;
    if (!this.held) return;
    g.player.model.hand.remove(this.held.mesh);
    const p = g.player.pos;
    g.debris.spawn({ ...this.held.rec, x: p.x + Math.sin(g.player.heading), y: p.y, z: p.z + Math.cos(g.player.heading), lenScale: 1 }, new THREE.Vector3(0, 1, 0));
    this.held = null;
    g.weapons._equipModel();
  }

  _throw() {
    const g = this.game, pl = g.player;
    const h = this.held;
    pl.model.hand.remove(h.mesh);
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    dir.y = Math.max(dir.y, -0.1) + 0.12;
    dir.normalize();
    const mesh = propMesh(h.type);
    mesh.scale.setScalar(0.7);
    const pos = pl.pos.clone().add(new THREE.Vector3(Math.sin(pl.heading) * 0.8, 1.6, Math.cos(pl.heading) * 0.8));
    mesh.position.copy(pos);
    g.scene.add(mesh);
    this.flying.push({ mesh, pos, vel: dir.multiplyScalar(15), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), t: 0, hit: false, rec: h.rec });
    this.held = null;
    pl.meleeAnim = 1;
    g.weapons.meleeAnim = 1;
    g.weapons.fireTimer = 0.4;
    g.weapons._equipModel();
    events.emit('carry:throw');
  }

  _updateFlying(dt) {
    const g = this.game;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      f.vel.y -= 15 * dt;
      f.pos.addScaledVector(f.vel, dt);
      f.mesh.position.copy(f.pos);
      f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt;
      if (!f.hit) {
        for (const ch of g.allCharacters()) {
          if (ch.isPlayer || ch.dead || ch.vehicle) continue;
          const hd = Math.hypot(ch.pos.x - f.pos.x, ch.pos.z - f.pos.z);
          if (hd < 1.0 && f.pos.y > ch.pos.y - 0.2 && f.pos.y < ch.pos.y + 2.1) {
            f.hit = true;
            ch.damage(25, { type: 'melee', source: g.player, dir: f.vel.clone().normalize() });
            if (ch.knockback) ch.knockback(f.vel.clone().multiplyScalar(0.4).setY(3));
            g.hud.hit(ch.dead);
            events.emit('crime', { type: 'assault', pos: ch.pos.clone() });
            f.vel.multiplyScalar(-0.2);
            break;
          }
        }
        for (const v of g.vehicles.list) {
          if (f.hit || !v.size) continue;
          if (v.pos.distanceTo(f.pos) < Math.max(v.size[0], v.size[2]) / 2) { f.hit = true; v.damage(30, { type: 'melee', source: g.player }); f.vel.multiplyScalar(-0.2); if (g.fx) g.fx.sparks(f.pos, 6); }
        }
      }
      const gh = g.collision.groundHeight(f.pos.x, f.pos.z, f.pos.y + 0.5, 0.5).h;
      if (f.pos.y < gh + 0.2 || f.t > 6) {
        g.scene.remove(f.mesh);
        this.flying.splice(i, 1);
        if (g.debris) g.debris.spawn({ ...f.rec, x: f.pos.x, y: gh, z: f.pos.z, lenScale: 1, scale: f.rec.scale * 0.9 }, f.vel.clone().multiplyScalar(0.3).setY(1.5));
        if (g.fx) g.fx.dust(new THREE.Vector3(f.pos.x, gh + 0.2, f.pos.z), 5);
      }
    }
  }
}
