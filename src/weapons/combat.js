// Kampf-Grundlagen: Explosionen (Flächenschaden, Druckwelle, Kettenreaktion, Feuer),
// explodierende Tanks/Fässer/Zapfsäulen, Brandherde. Schusswaffen nutzen das über weapons.js.

import * as THREE from 'three';
import { events } from '../core/events.js';

export class Combat {
  constructor(game) {
    this.game = game;
    game.combat = this;
    this.fires = [];       // {pos, r, t}
    this.pending = [];     // verzögerte Kettenexplosionen
  }

  /**
   * Explosion an pos.
   * @param {THREE.Vector3} pos
   * @param {number} radius
   * @param {number} damage Maximalschaden im Zentrum
   * @param {any} source Verursacher (Spieler/NPC)
   */
  explosion(pos, radius, damage, source = null, opts = {}) {
    const g = this.game;
    if (g.fx) g.fx.explosion(pos, radius / 8);
    const camD = g.camera.position.distanceTo(pos);
    g.camera3p.addShake(Math.max(0, 1.2 - camD / (radius * 6)));
    events.emit('explosion', { pos: pos.clone(), radius, source });
    if (source && source.isPlayer) events.emit('crime', { type: 'explosion', pos: pos.clone() });
    // Fahrzeuge
    for (const v of g.vehicles.list) {
      if (v === opts.vehicle) continue;
      const d = v.pos.distanceTo(pos);
      if (d > radius * 1.3) continue;
      const k = Math.max(0, 1 - d / (radius * 1.3));
      const dir = v.pos.clone().sub(pos).setY(0).normalize();
      v.wake();
      v.vel.addScaledVector(dir, k * 14 * Math.min(1, 2500 / v.mass));
      v.vel.y += k * 9 * Math.min(1, 2500 / v.mass);
      v.angVel.add(new THREE.Vector3((Math.random() - 0.5) * 4 * k, (Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 4 * k));
      v.lastAttacker = source;
      v.damage(damage * k * 4, { type: 'explosion', source });
    }
    // Figuren
    for (const ch of g.allCharacters()) {
      if (ch.dead || (ch.vehicle && !ch.vehicle.isBike)) continue;
      const d = ch.pos.distanceTo(pos);
      if (d > radius) continue;
      const k = 1 - d / radius;
      const dir = ch.pos.clone().sub(pos).setY(0).normalize();
      if (ch.knockback) ch.knockback(dir.multiplyScalar(10 * k).setY(5 * k));
      else if (ch.vel) { ch.vel.addScaledVector(dir, 10 * k); ch.vel.y += 5 * k; ch.onGround = false; }
      ch.damage(damage * k, { type: 'explosion', source, dir });
    }
    // Requisiten
    const list = g.collision.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, []);
    for (const box of list) {
      if (!box.prop || box.prop.broken) continue;
      const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
      const d = Math.hypot(cx - pos.x, cz - pos.z);
      if (d > radius) continue;
      if (box.explosive) { this.pending.push({ t: 0.15 + Math.random() * 0.35, box }); continue; }
      if (box.destructible) {
        const rec = g.city.breakProp(box.prop);
        if (rec && g.debris) g.debris.spawn(rec, new THREE.Vector3(cx - pos.x, 0, cz - pos.z).normalize().multiplyScalar(8).setY(7));
      }
    }
    // Zapfsäulen usw. (explosiv, aber ohne Requisit-Datensatz)
    for (const box of list) if (box.explosive && !box.prop && !box.exploded) {
      const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
      if (Math.hypot(cx - pos.x, cz - pos.z) < radius) this.pending.push({ t: 0.3 + Math.random() * 0.4, box });
    }
    // Brandherd
    if (opts.fire !== false) this.fires.push({ pos: pos.clone(), r: Math.min(4, radius * 0.4), t: 8 + Math.random() * 4, source });
  }

  /** Explosives Requisit (Tank, Fass, Zapfsäule) zur Explosion bringen. */
  explodeProp(box, source = null) {
    if (box.exploded) return;
    box.exploded = true;
    const pos = new THREE.Vector3((box.minX + box.maxX) / 2, box.minY + 1, (box.minZ + box.maxZ) / 2);
    const big = box.propType === 'tank';
    if (box.prop && !big) this.game.city.breakProp(box.prop);
    if (big && box.prop) this._scorchTank(box.prop);
    this.explosion(pos, big ? 16 : 8, big ? 350 : 160, source || this.lastShooter);
    events.emit('prop:exploded', { box, pos });
    // Wiederherstellen nach einiger Zeit
    setTimeout(() => { box.exploded = false; }, 120000);
  }

  _scorchTank(rec) {
    const im = rec.meshes[0];
    if (!im) return;
    if (!im.instanceColor) {
      const white = new THREE.Color(1, 1, 1);
      for (let i = 0; i < im.count; i++) im.setColorAt(i, white);
    }
    im.setColorAt(rec.index, new THREE.Color(0.15, 0.15, 0.15));
    im.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const g = this.game;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); this.explodeProp(p.box, p.source); }
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      if (f.t <= 0) { this.fires.splice(i, 1); continue; }
      if (g.fx && Math.random() < 0.8) g.fx.fire(f.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * f.r, 0.2, (Math.random() - 0.5) * f.r)), 1.3);
      if (g.fx && Math.random() < 0.2) g.fx.smokePuff(f.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), { dark: 0.8, size: 1.2 });
      for (const ch of g.allCharacters()) {
        if (ch.dead || ch.vehicle) continue;
        if (ch.pos.distanceTo(f.pos) < f.r) ch.damage(25 * dt, { type: 'fire', source: f.source });
      }
    }
  }

  /** Aktive Brände (für Feuerwehr-Nebenmission). */
  get activeFires() { return this.fires; }

  startFire(pos, duration = 60, r = 3) {
    const f = { pos: pos.clone(), r, t: duration, source: null, mission: true };
    this.fires.push(f);
    return f;
  }
}
