// Motorboot: Auftrieb auf dem Wasserspiegel mit Wellen, Schub, Ruder, Krängung in Kurven,
// Bug hebt sich beim Gasgeben, auf Grund laufen. Gleiche Schnittstelle wie Vehicle.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildBoatModel } from './vehicleModel.js';
import { WATER_Y, terrainHeight } from '../world/terrain.js';
import { damp, clamp } from '../core/mathutil.js';
import { events } from '../core/events.js';

const UP = new THREE.Vector3(0, 1, 0);
let nextId = 10000;

export class Boat {
  constructor(game, type, { x = 0, z = 0, heading = 0, color = null } = {}) {
    this.game = game;
    this.id = nextId++;
    this.type = type;
    this.def = CONFIG.boat[type];
    this.kind = 'boat';
    this.isBoat = true;
    this.isAircraft = false;
    this.size = this.def.size;
    this.mass = this.def.mass;
    this.maxHealth = this.health = this.def.health;
    this.color = color ?? this.def.colors[0];
    this.fuel = CONFIG.vehicleCommon.fuelCapacity;
    this.tuning = { engine: 0, tires: 0, armor: 0 };
    this.comHeight = 0.6;
    this.pos = new THREE.Vector3(x, WATER_Y + 0.3, z);
    this.prevPos = this.pos.clone();
    this.yaw = heading;
    this.quat = new THREE.Quaternion().setFromAxisAngle(UP, heading);
    this.prevQuat = this.quat.clone();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.speed = 0;
    this.pitch = 0; this.roll = 0;
    this.driver = null;
    this.passengers = [];
    this.locked = false;
    this.destroyed = false;
    this.onFire = false;
    this.wheels = [];
    this.damageLevel = 0;
    this.renderPos = new THREE.Vector3();
    this.model = buildBoatModel(this.def, this.color);
    this.mesh = this.model.group;
    game.scene.add(this.mesh);
    this.sleeping = false;
    this.flipTimer = 0;
    this.up = new THREE.Vector3(0, 1, 0);
  }

  get heading() { return this.yaw; }
  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get speedKmh() { return Math.abs(this.speed) * 3.6; }
  wake() { this.sleeping = false; }

  fixedUpdate(dt) {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const d = this.def;
    const c = this.controls;
    const f = this.forward;
    const t = this.game.elapsed;
    const depth = WATER_Y - terrainHeight(this.pos.x, this.pos.z);
    const grounded = depth < 0.7;
    this.speed = this.vel.dot(f);
    const alive = !this.destroyed && this.driver;
    let thrust = 0;
    if (alive && this.fuel > 0) {
      if (c.throttle > 0) thrust = c.throttle * d.power * Math.max(0, 1 - (this.speed / d.maxSpeed) ** 2);
      if (c.brake > 0) thrust -= c.brake * d.power * 0.5 * (this.speed > -6 ? 1 : 0);
      if (c.throttle > 0) this.fuel = Math.max(0, this.fuel - dt * 0.05);
    }
    // Schub + Wasserwiderstand (seitlich stark, längs schwach)
    const side = new THREE.Vector3(-f.z, 0, f.x);
    const vLong = this.vel.dot(f), vSide = this.vel.dot(side);
    const acc = new THREE.Vector3();
    acc.addScaledVector(f, thrust / this.mass - vLong * Math.abs(vLong) * 0.012 - vLong * 0.15);
    acc.addScaledVector(side, -vSide * 2.5);
    if (grounded) acc.addScaledVector(this.vel, -6);
    this.vel.x += acc.x * dt; this.vel.z += acc.z * dt;
    // Ruder (wirkt nur mit Fahrt)
    const steerEff = clamp(Math.abs(vLong) / 6, 0, 1) * Math.sign(vLong || 1);
    this.yawRate = damp(this.yawRate || 0, -(c.steer || 0) * d.turn * steerEff, 4, dt);
    this.yaw += this.yawRate * dt;
    // Schwimmen auf Wellen
    const wave = Math.sin(t * 1.3 + this.pos.x * 0.15) * 0.15 + Math.sin(t * 0.9 + this.pos.z * 0.2) * 0.12;
    const targetY = Math.max(WATER_Y + 0.25 + wave + Math.min(0.4, Math.abs(vLong) * 0.012), terrainHeight(this.pos.x, this.pos.z) + 0.6);
    this.vel.y += ((targetY - this.pos.y) * 12 - this.vel.y * 4) * dt;
    if (this.destroyed) this.vel.y -= 2 * dt; // Wrack sinkt
    this.pos.addScaledVector(this.vel, dt);
    this.pitch = damp(this.pitch, -clamp(vLong / d.maxSpeed, -0.2, 1) * 0.12 + wave * 0.1, 3, dt);
    this.roll = damp(this.roll, this.yawRate * 0.12 * clamp(Math.abs(vLong) / 10, 0, 1), 3, dt);
    const e = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
    this.quat.setFromEuler(e);
    // Kollision mit Stegen, Kaimauern (Boxen)
    const r = this.size[0] / 2;
    for (const k of [-0.3, 0.3]) {
      const cx = this.pos.x + f.x * this.size[2] * k, cz = this.pos.z + f.z * this.size[2] * k;
      const res = this.game.collision.resolveCircle(cx, cz, r, this.pos.y - 0.5, this.pos.y + 1.5, 0);
      if (res.hit) {
        this.pos.x += res.x - cx; this.pos.z += res.z - cz;
        const vn = this.vel.x * res.nx + this.vel.z * res.nz;
        if (vn < 0) { this.vel.x -= 1.4 * vn * res.nx; this.vel.z -= 1.4 * vn * res.nz; this.onImpact(-vn); }
      }
    }
    // Spritzwasser
    if (this.game.fx && Math.abs(vLong) > 6 && Math.random() < 0.5) {
      const back = this.pos.clone().addScaledVector(f, -this.size[2] / 2);
      back.y = WATER_Y + 0.2;
      this.game.fx.splash(back, 2);
    }
    if (this.onFire) { this.health -= dt * 10; if (this.health < -200) this.explode(); if (this.game.fx) this.game.fx.fire(this.pos.clone().add(new THREE.Vector3(0, 1, 0))); }
  }

  onImpact(speed) {
    if (speed > 4) this.damage((speed - 4) * 15, { type: 'collision' });
  }

  damage(amount, info = {}) {
    if (this.destroyed) return;
    this.health -= amount;
    this.damageLevel = clamp(1 - this.health / this.maxHealth, 0, 1);
    if (this.health < this.maxHealth * 0.2) this.onFire = true;
    if (this.health < -this.maxHealth * 0.3) this.explode(info.source);
  }

  explode(source) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroyedAt = this.game.elapsed;
    this.model.group.traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.25); } });
    if (this.game.combat) this.game.combat.explosion(this.pos.clone(), 8, 200, source, { vehicle: this, fire: false });
    events.emit('vehicle:exploded', { vehicle: this, source });
    if (this.driver && this.game.vehicles) this.game.vehicles.killOccupants(this, source);
  }

  repair() { this.health = this.maxHealth; this.onFire = false; this.damageLevel = 0; }
  setColor() {}
  _applyDamageVisual() {}
  resetUpright() { this.vel.set(0, 0, 0); }

  updateVisual(dt, alpha) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
    this.mesh.position.copy(this.renderPos);
    this.mesh.quaternion.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }

  seatLocal() { return new THREE.Vector3(0, 0.1, -0.6); }

  placeOccupant(ch, root) {
    const p = this.seatLocal().applyQuaternion(this.mesh.quaternion).add(this.mesh.position);
    root.position.copy(p);
    root.quaternion.copy(this.mesh.quaternion);
    root.scale.setScalar(1);
  }

  driverEyePos() { return this.seatLocal().add(new THREE.Vector3(0, 1.6, 0)).applyQuaternion(this.mesh.quaternion).add(this.mesh.position); }

  doorPos(side = -1) {
    const f = this.forward;
    return new THREE.Vector3(this.pos.x - f.z * side * 2.2, this.pos.y, this.pos.z + f.x * side * 2.2);
  }

  remove() { this.game.scene.remove(this.mesh); this.removed = true; }
}

/** Liegeplätze der Boote. */
export const BOAT_SPOTS = [
  { x: 930, z: 140, heading: Math.PI / 2 },
  { x: 930, z: 300, heading: Math.PI / 2 },
  { x: 300, z: 705, heading: 0 },
  { x: -212, z: 300, heading: Math.PI },
  { x: -210, z: -420, heading: 0 },
];
