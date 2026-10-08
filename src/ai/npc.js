// NPC-Figur (Passanten, Polizei, Gangster, SEK, Soldaten, Ladenbesitzer, Missionsfiguren).
// Physik und Animation wie beim Spieler, gesteuert über ein austauschbares "Gehirn" (brain).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel, SKIN, SHIRTS, PANTS, HAIR } from '../player/character.js';
import { WeaponInventory } from '../weapons/weapondata.js';
import { WATER_Y, groundTerrain } from '../world/terrain.js';
import { damp, angleDiff } from '../core/mathutil.js';
import { events } from '../core/events.js';

let nextId = 1;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Aussehen je NPC-Art. */
export function lookFor(kind) {
  switch (kind) {
    case 'cop': return { skin: pick(SKIN), shirt: 0x1f3a6b, pants: 0x14213d, hair: pick(HAIR), hat: 0x14213d };
    case 'swat': return { skin: pick(SKIN), shirt: 0x1a1d22, pants: 0x1a1d22, hair: 0x111111, hat: 0x111111, vest: true };
    case 'soldier': return { skin: pick(SKIN), shirt: 0x4a5a32, pants: 0x3e4a2a, hair: 0x2b1d0e, hat: 0x3e4a2a, vest: true };
    case 'gang_rust': return { skin: pick(SKIN), shirt: 0xd35400, pants: 0x2c2c2c, hair: pick(HAIR), hat: Math.random() < 0.5 ? 0xa04000 : null };
    case 'gang_wolves': return { skin: pick(SKIN), shirt: 0x2e86de, pants: 0x1c2833, hair: pick(HAIR), hat: Math.random() < 0.5 ? 0x1b4f72 : null };
    case 'keeper': return { skin: pick(SKIN), shirt: 0xffffff, pants: 0x34495e, hair: pick(HAIR) };
    case 'medic': return { skin: pick(SKIN), shirt: 0xffffff, pants: 0xffffff, hair: pick(HAIR) };
    case 'firefighter': return { skin: pick(SKIN), shirt: 0xc8141e, pants: 0x222222, hair: pick(HAIR), hat: 0xf1c40f };
    default: return { skin: pick(SKIN), shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIR), scale: 0.92 + Math.random() * 0.14 };
  }
}

export class NPC {
  constructor(game, { kind = 'ped', x = 0, z = 0, y = null, heading = 0, health = null, faction = null, look = null, weapon = null, ammo = null } = {}) {
    this.game = game;
    this.id = nextId++;
    this.kind = kind;
    this.faction = faction || (kind.startsWith('gang') ? kind.replace('gang_', '') : kind === 'cop' || kind === 'swat' ? 'police' : kind === 'soldier' ? 'military' : 'civil');
    this.model = new CharacterModel(look || lookFor(kind));
    game.scene.add(this.model.root);
    this.pos = new THREE.Vector3(x, 0, z);
    this.pos.y = y ?? game.collision.groundHeight(x, z, Math.max(0, groundTerrain(x, z)) + 1, 0.5).h;
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.moveTarget = null;   // {x, z}
    this.moveSpeed = 0;
    this.heading = heading;
    this.lookAt = null;       // Blickziel beim Zielen
    this.onGround = true;
    this.radius = 0.35;
    this.height = 1.8;
    const baseHp = kind === 'cop' ? CONFIG.police.copHealth : kind === 'swat' || kind === 'soldier' ? CONFIG.police.swatHealth : kind.startsWith('gang') ? CONFIG.ai.gangHealth : CONFIG.ai.pedHealth;
    this.maxHealth = this.health = health ?? baseHp;
    this.armor = kind === 'swat' || kind === 'soldier' ? 50 : 0;
    this.dead = false;
    this.deadTime = 0;
    this.state = 'idle';
    this.crouch = false;
    this.aiming = false;
    this.inventory = new WeaponInventory();
    if (weapon) { this.inventory.give(weapon, ammo ?? 999); this.inventory.select(this.inventory.slots.findIndex((s) => s && s.id === weapon)); }
    this.brain = null;
    this.vehicle = null;
    this.seat = 0;
    this.stagger = 0;
    this.fireCooldown = 0;
    this.knock = null;
    this.speech = null;
    this.speechTimer = 0;
    this.lastAttacker = null;
    this.alertness = 0;
    this.isNPC = true;
    this._updateWeaponModel();
  }

  get alive() { return !this.dead; }

  _updateWeaponModel() {
    const w = this.inventory.current;
    if (this.game.weapons && this.game.weapons.makeModel) this.model.setWeapon(w.id !== 'fist' ? this.game.weapons.makeModel(w.id) : null);
  }

  equip(id) {
    const i = this.inventory.slots.findIndex((s) => s && s.id === id);
    if (i >= 0) { this.inventory.select(i); this._updateWeaponModel(); }
  }

  give(id, ammo = 999) { this.inventory.give(id, ammo); this.equip(id); }

  /** Geh zu (x,z) mit Geschwindigkeit speed. */
  goTo(x, z, speed) { this.moveTarget = { x, z }; this.moveSpeed = speed; }
  stop() { this.moveTarget = null; this.moveSpeed = 0; }

  fixedUpdate(dt) {
    if (this.vehicle) return;
    this.prevPos.copy(this.pos);
    const col = this.game.collision;
    if (this.dead) {
      // Liegend weiterrutschen nach Treffer/Explosion
      this.vel.y -= CONFIG.physics.gravity * dt;
      this.vel.x *= 1 - Math.min(1, dt * 3); this.vel.z *= 1 - Math.min(1, dt * 3);
      this.pos.addScaledVector(this.vel, dt);
      const gh = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3, 0.5).h;
      if (this.pos.y < gh) { this.pos.y = gh; this.vel.y = 0; }
      const r = col.resolveCircle(this.pos.x, this.pos.z, 0.3, this.pos.y, this.pos.y + 0.6, 0.4);
      if (r.hit) { this.pos.x = r.x; this.pos.z = r.z; }
      return;
    }
    if (this.stagger > 0) this.stagger -= dt;
    let tvx = 0, tvz = 0;
    if (this.moveTarget && this.stagger <= 0) {
      const dx = this.moveTarget.x - this.pos.x, dz = this.moveTarget.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        tvx = (dx / d) * this.moveSpeed; tvz = (dz / d) * this.moveSpeed;
        if (!this.aiming) this.heading += angleDiff(this.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      } else this.moveTarget = null;
    }
    if (this.lookAt) this.heading += angleDiff(this.heading, Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.z - this.pos.z)) * Math.min(1, dt * 10);
    const k = this.onGround ? 10 : 1;
    if (this.knock && this.knock > 0) this.knock -= dt;
    else {
      this.vel.x = damp(this.vel.x, tvx, k, dt);
      this.vel.z = damp(this.vel.z, tvz, k, dt);
    }
    // Wasser: an der Oberfläche treiben
    const th = groundTerrain(this.pos.x, this.pos.z, this.pos.y);
    const swimming = th < WATER_Y - 1.3 && this.pos.y < WATER_Y - 0.6;
    if (swimming) { this.vel.y = damp(this.vel.y, (WATER_Y - 1.2 - this.pos.y) * 3, 4, dt); this.swimming = true; }
    else { this.vel.y -= CONFIG.physics.gravity * dt; this.swimming = false; }
    this.pos.addScaledVector(this.vel, dt);
    const r = col.resolveCircle(this.pos.x, this.pos.z, this.radius, this.pos.y, this.pos.y + this.height, 0.45);
    if (r.hit) {
      this.pos.x = r.x; this.pos.z = r.z;
      this.blocked = (this.blocked || 0) + dt;
    } else this.blocked = 0;
    if (this.game.vehicles) this.game.vehicles.pushCharacter(this);
    const gh = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.05, this.onGround ? 0.45 : 0.3).h;
    if (!swimming && (this.pos.y <= gh + 0.02 || (this.onGround && this.vel.y <= 0 && this.pos.y - gh < 0.45))) {
      if (!this.onGround && this.vel.y < -14) this.damage((-this.vel.y - 14) * 8, { type: 'fall' });
      this.pos.y = gh; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
    } else this.onGround = false;
    if (this.pos.y < -40) this.pos.y = col.groundHeight(this.pos.x, this.pos.z, 200, 0).h;
  }

  update(dt) {
    if (this.speechTimer > 0) this.speechTimer -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (!this.dead && this.brain && !this.vehicle) this.brain.update(this, dt);
    if (!this.dead && this.vehicle && this.brain && this.brain.updateDriving) this.brain.updateDriving(this, dt);
    if (this.dead) this.deadTime += dt;
    // Animation
    const m = this.model;
    if (this.vehicle) {
      this.vehicle.placeOccupant(this, m.root);
      m.animate(dt, { state: 'sit', speed: 0 });
      return;
    }
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.heading, 0);
    m.root.scale.setScalar(this.model.look.scale || 1);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let st = this.forcedAnim || (this.swimming ? 'swim' : !this.onGround ? 'fall' : hs > 6 ? 'sprint' : hs > 2.8 ? 'run' : hs > 0.3 ? 'walk' : 'idle');
    if (this.dead) st = 'dead';
    const w = this.inventory.current;
    m.animate(dt, { state: st, speed: hs, aim: this.aiming && w.def.type !== 'melee', crouch: this.crouch, twoHanded: ['rifle', 'smg', 'shotgun', 'sniper', 'rocket'].includes(w.id), melee: this.meleeAnim || 0 });
    if (this.meleeAnim > 0) this.meleeAnim = Math.max(0, this.meleeAnim - dt * 3);
  }

  say(text, seconds = 2.5) {
    this.speech = text;
    this.speechTimer = seconds;
    events.emit('npc:say', { npc: this, text });
  }

  knockback(v) {
    this.vel.copy(v);
    this.onGround = false;
    this.knock = 0.5;
  }

  damage(amount, info = {}) {
    if (this.dead || this.invulnerable) return;
    if (this.armor > 0 && info.type !== 'fall') {
      const a = Math.min(this.armor, amount * 0.6);
      this.armor -= a; amount -= a;
    }
    this.health -= amount;
    if (info.source) this.lastAttacker = info.source;
    this.stagger = 0.15;
    if (this.game.fx && info.point) this.game.fx.hit(info.point, 5);
    events.emit('npc:damaged', { npc: this, amount, info });
    if (this.brain && this.brain.onDamage) this.brain.onDamage(this, amount, info);
    if (this.health <= 0) this.die(info);
  }

  die(info = {}) {
    if (this.dead) return;
    this.dead = true;
    this.health = 0;
    this.aiming = false;
    this.deadTime = 0;
    if (info.dir) { this.vel.x += info.dir.x * 3; this.vel.z += info.dir.z * 3; }
    if (this.vehicle) {
      const v = this.vehicle;
      if (v.driver === this) v.driver = null;
      this.vehicle = null;
      const d = v.doorPos ? v.doorPos(-1) : v.pos;
      this.pos.copy(d);
    }
    this.model.root.rotation.set(0, this.heading, 0);
    events.emit('npc:killed', { npc: this, info });
    // Waffe fallen lassen
    const w = this.inventory.current;
    if (w.id !== 'fist' && this.game.weapons && this.dropWeapons !== false) this.game.weapons.dropPickup(w.id, this.pos.clone(), Math.max(w.mag + Math.min(w.ammo, 60), (w.def.mag || 1) * 2));
    if (this.brain && this.brain.onDeath) this.brain.onDeath(this, info);
  }

  /** Wird aus dem Auto gezogen. */
  onJacked(vehicle, by) {
    this.vehicle = null;
    const d = vehicle.doorPos(-1);
    this.pos.copy(d);
    this.pos.y = this.game.collision.groundHeight(d.x, d.z, d.y + 2, 2).h;
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    if (this.brain && this.brain.onJacked) this.brain.onJacked(this, vehicle, by);
  }

  /** Sichtlinie zu einem Punkt (Kopfhöhe). */
  canSee(p, maxD = 80) {
    const ox = this.pos.x, oy = this.pos.y + 1.6, oz = this.pos.z;
    const dx = p.x - ox, dy = (p.y + 1.4) - oy, dz = p.z - oz;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxD) return false;
    if (d < 1) return true;
    const hit = this.game.collision.raycast(ox, oy, oz, dx / d, dy / d, dz / d, d, { includeTerrain: true });
    return !hit || hit.t > d - 0.5;
  }

  remove() {
    this.game.scene.remove(this.model.root);
    this.removed = true;
    if (this.vehicle && this.vehicle.driver === this) this.vehicle.driver = null;
  }
}
