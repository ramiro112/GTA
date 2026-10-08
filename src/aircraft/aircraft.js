// Luftfahrzeuge: Helikopter (Kollektiv, Zyklik, Heckrotor) und Flugzeuge (Schub, Auftrieb,
// Strömungsabriss, Landeklappen, Fahrwerk). Arcade-Modus mit Stabilisierung + Simulationsmodus.
// Absturz, Landung, Bordwaffen (MG, Raketen). Gleiche Schnittstelle wie Bodenfahrzeuge.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { MeshBuilder } from '../world/meshbuilder.js';
import { WATER_Y } from '../world/terrain.js';
import { clamp, damp } from '../core/mathutil.js';
import { events } from '../core/events.js';

const FC = CONFIG.flight;
const G = () => CONFIG.physics.gravity;
const UP = new THREE.Vector3(0, 1, 0);
let nextId = 20000;

const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2533, emissive: 0x0a1018 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

// ============================================================================ Modelle
function heliModel(def, military) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const color = def.colors[0];
  const mat = new THREE.MeshLambertMaterial({ color });
  const L = def.size[2];
  const s = military ? 1.45 : 1;
  const mb = new MeshBuilder();
  mb.box(-1.0 * s, -0.8 * s, -1.2 * s, 1.0 * s, 1.0 * s, 1.6 * s, 0xffffff, { skipTop: false, skipBottom: false });
  mb.box(-0.3 * s, 0.2 * s, -L * 0.62, 0.3 * s, 0.7 * s, -1.2 * s, 0xffffff, { skipTop: false, skipBottom: false });
  mb.box(-0.08, 0.2 * s, -L * 0.62, 0.08, 1.5 * s, -L * 0.52, 0xffffff, { skipTop: false });
  mb.box(-0.6 * s, 1.0 * s, -0.4, 0.6 * s, 1.35 * s, 0.6, 0xffffff, { skipTop: false });
  if (military) {
    mb.box(-2.6, 0.0, -0.3, 2.6, 0.15, 0.5, 0xffffff, { skipTop: false, skipBottom: false });
    for (const x of [-2.2, 2.2]) mb.box(x - 0.25, -0.35, -0.6, x + 0.25, 0.0, 1.0, 0x333333, { skipTop: false });
  }
  const hull = new THREE.Mesh(mb.build(), mat);
  body.add(hull);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9 * s, 1.1 * s, 0.9 * s), glassMat);
  glass.position.set(0, 0.35 * s, 1.35 * s);
  body.add(glass);
  // Kufen
  for (const x of [-0.9 * s, 0.9 * s]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.2 * s), darkMat);
    skid.position.set(x, -1.25 * s, 0.1);
    body.add(skid);
    for (const z of [-0.6, 0.8]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5 * s, 0.08), darkMat); st.position.set(x * 0.85, -1.0 * s, z * s); body.add(st); }
  }
  // Rotoren
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.45 * s, 0.1);
  const bladeLen = def.size[2] * 0.55;
  for (let i = 0; i < (military ? 4 : 2); i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bladeLen, 0.05, 0.3), darkMat);
    b.rotation.y = (i / (military ? 4 : 2)) * Math.PI;
    rotor.add(b);
  }
  body.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(0.15, 1.0 * s, -L * 0.58);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4 * s, 0.15), darkMat); b.rotation.x = i * Math.PI / 2; tail.add(b); }
  body.add(tail);
  // Positionslichter
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(0, 1.55 * s, -L * 0.55);
  body.add(red);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, body, bodyMat: mat, rotor, tail, beacon: red, baseColor: new THREE.Color(color), bottom: -1.3 * s };
}

function planeModel(def, jet) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const color = def.colors[0];
  const mat = new THREE.MeshLambertMaterial({ color });
  const mb = new MeshBuilder();
  const L = jet ? 16 : 8, span = jet ? 9 : 11;
  const accent = def.colors[1] || 0x555555;
  // Rumpf
  mb.box(-0.6, -0.5, -L * 0.5, 0.6, 0.6, L * 0.42, color, { skipTop: false, skipBottom: false });
  mb.box(-0.4, -0.35, L * 0.42, 0.4, 0.4, L * 0.5, jet ? color : 0x222222, { skipTop: false, skipBottom: false });
  if (jet) {
    // Deltaflügel
    const y = -0.1;
    mb.quad([-span / 2, y, -L * 0.25], [-0.6, y, L * 0.18], [0.6, y, L * 0.18], [span / 2, y, -L * 0.25], [0, 1, 0], color);
    mb.quad([span / 2, y - 0.05, -L * 0.25], [0.6, y - 0.05, L * 0.18], [-0.6, y - 0.05, L * 0.18], [-span / 2, y - 0.05, -L * 0.25], [0, -1, 0], color);
    for (const x of [-1.2, 1.2]) mb.box(x - 0.05, 0.5, -L * 0.5, x + 0.05, 2.6, -L * 0.3, color);
    mb.box(-1.4, -0.4, -L * 0.1, -0.6, 0.3, L * 0.15, 0x333333);
    mb.box(0.6, -0.4, -L * 0.1, 1.4, 0.3, L * 0.15, 0x333333);
  } else {
    mb.box(-span / 2, 0.35, -0.4, span / 2, 0.5, 1.2, color, { skipTop: false, skipBottom: false });
    for (const x of [-span / 2 + 0.3, span / 2 - 1.4]) mb.box(x, 0.36, -0.45, x + 1.1, 0.52, 1.25, accent);
    mb.box(-1.8, 0.0, -L * 0.5, 1.8, 0.1, -L * 0.36, color, { skipTop: false, skipBottom: false });
    mb.box(-0.05, 0.1, -L * 0.5, 0.05, 1.5, -L * 0.36, accent);
  }
  const hull = new THREE.Mesh(mb.build(), mat);
  body.add(hull);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, jet ? 2.2 : 1.4), glassMat);
  glass.position.set(0, 0.75, jet ? L * 0.2 : 0.6);
  body.add(glass);
  // Propeller
  let prop = null;
  if (!jet) {
    prop = new THREE.Group();
    prop.position.set(0, 0, L * 0.52);
    for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.0, 0.05), darkMat); b.rotation.z = i * Math.PI / 2; prop.add(b); }
    body.add(prop);
  }
  // Fahrwerk (einziehbar)
  const gear = new THREE.Group();
  const gy = -1.1;
  for (const [x, z] of [[-1.4, 0.4], [1.4, 0.4], [0, L * 0.35]]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), darkMat);
    strut.position.set(jet ? x * 0.8 : x, gy + 0.35, jet ? z - 1 : z);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10).rotateZ(Math.PI / 2), darkMat);
    wheel.position.set(jet ? x * 0.8 : x, gy, jet ? z - 1 : z);
    gear.add(strut, wheel);
  }
  body.add(gear);
  const flame = jet ? new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.8 })) : null;
  if (flame) { flame.position.set(0, 0, -L * 0.55); body.add(flame); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, body, bodyMat: mat, prop, gear, flame, baseColor: new THREE.Color(color), bottom: gy - 0.28 };
}

// ============================================================================ Basisklasse
class Aircraft {
  constructor(game, type, { x = 0, z = 0, y = null, heading = 0 } = {}) {
    this.game = game;
    this.id = nextId++;
    this.type = type;
    this.def = CONFIG.aircraft[type];
    this.kind = 'aircraft';
    this.isAircraft = true;
    this.size = this.def.size;
    this.mass = this.def.mass;
    this.maxHealth = this.health = this.def.health;
    this.fuel = this.def.fuel;
    this.maxFuel = this.def.fuel;
    this.pos = new THREE.Vector3(x, 0, z);
    this.prevPos = new THREE.Vector3();
    this.quat = new THREE.Quaternion().setFromAxisAngle(UP, heading);
    this.prevQuat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, pitch: 0, roll: 0, yaw: 0, collective: 0 };
    this.driver = null;
    this.passengers = [];
    this.locked = false;
    this.destroyed = false;
    this.onFire = false;
    this.wheels = [];
    this.tuning = { engine: 0, tires: 0, armor: 0 };
    this.damageLevel = 0;
    this.onGround = true;
    this.sleeping = false;
    this.renderPos = new THREE.Vector3();
    this.mgCooldown = 0;
    this.missileCooldown = 0;
    this.comHeight = 1.3;
  }

  get heading() { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat); return Math.atan2(f.x, f.z); }
  get forward() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat); }
  get up() { return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat); }
  get right() { return new THREE.Vector3(-1, 0, 0).applyQuaternion(this.quat); }
  get speed() { return this.vel.dot(this.forward); }
  get speedKmh() { return this.vel.length() * 3.6; }
  get altitude() { return this.pos.y - Math.max(WATER_Y, this.game.collision.groundHeight(this.pos.x, this.pos.z, this.pos.y - 0.5, 0).h); }
  get pitchAngle() { const f = this.forward; return Math.asin(clamp(f.y, -1, 1)); }
  get rollAngle() { const r = this.right; return Math.asin(clamp(-r.y, -1, 1)); }
  get sim() { return this.game.settings.flightMode === 'sim'; }
  wake() { this.sleeping = false; }

  _place(y) {
    const gy = y ?? this.game.collision.groundHeight(this.pos.x, this.pos.z, 300, 0).h;
    this.pos.y = gy - this.model.bottom;
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.updateVisual(0, 1);
  }

  /** Spielersteuerung (pro Physikschritt). */
  playerInput(inp) {
    const c = this.controls;
    const m = inp.moveAxes();
    c.pitch = m.y;        // W = Nase runter / vorwärts kippen
    c.roll = m.x;         // D = nach rechts rollen
    c.yaw = (inp.down('yawRight') ? 1 : 0) - (inp.down('yawLeft') ? 1 : 0);
    c.up = inp.down('throttleUp');
    c.down = inp.down('throttleDown');
    c.brake = inp.down('handbrake') ? 1 : 0;
    if (inp.pad) { c.up = c.up || inp.padTriggers[1] > 0.3; c.down = c.down || inp.padTriggers[0] > 0.3; }
  }

  /** Bordwaffen (pro Frame vom Flugsystem aufgerufen). */
  fireWeapons(dt, inp) {
    if (!this.def.weapons || this.destroyed) return;
    const g = this.game;
    this.mgCooldown -= dt; this.missileCooldown -= dt;
    const f = this.forward;
    if (inp.down('attack') && this.mgCooldown <= 0) {
      const def = CONFIG.weapons.mg;
      this.mgCooldown = 1 / def.rate;
      const muzzle = this.pos.clone().addScaledVector(f, this.size[2] * 0.5).addScaledVector(this.up, -0.6);
      // Zielrichtung: Kamerablick, wenn ungefähr nach vorn, sonst Flugrichtung
      const camDir = g.camera.getWorldDirection(new THREE.Vector3());
      const dir = camDir.dot(f) > 0.8 ? camDir : f.clone();
      const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * def.spread, (Math.random() - 0.5) * def.spread, (Math.random() - 0.5) * def.spread)).normalize();
      g.weapons.fireRay(this.driver, muzzle, d, def, muzzle);
      if (g.fx) g.fx.muzzle(muzzle);
      events.emit('weapon:fired', { shooter: this.driver, pos: muzzle, weapon: 'mg' });
      if (this.driver && this.driver.isPlayer) g.weapons._crime(muzzle);
    }
    if ((inp.pressed('fireSecondary') || inp.pressed('aim')) && this.missileCooldown <= 0) {
      const def = CONFIG.weapons.missile;
      this.missileCooldown = 1 / def.rate;
      for (const side of [-1, 1]) {
        const p = this.pos.clone().addScaledVector(this.right, side * 2).addScaledVector(this.up, -0.5).addScaledVector(f, 1);
        g.weapons.spawnProjectile('missile', p, f.clone().multiplyScalar(def.speed).add(this.vel), this.driver);
      }
      events.emit('weapon:missile', { aircraft: this });
      if (this.driver && this.driver.isPlayer) g.weapons._crime(this.pos);
    }
  }

  _integrate(force, torqueLocal, dt, angDamp = 2) {
    this.vel.addScaledVector(force, dt / this.mass);
    // Drehung (lokale Winkelgeschwindigkeit, vereinfachte Trägheit)
    const inv = this.quat.clone().invert();
    const aw = this.angVel.clone().applyQuaternion(inv);
    aw.x += torqueLocal.x * dt; aw.y += torqueLocal.y * dt; aw.z += torqueLocal.z * dt;
    aw.multiplyScalar(Math.max(0, 1 - angDamp * dt));
    this.angVel.copy(aw.applyQuaternion(this.quat));
    this.pos.addScaledVector(this.vel, dt);
    const ang = this.angVel.length() * dt;
    if (ang > 1e-7) this.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(this.angVel.clone().normalize(), ang)).normalize();
  }

  /** Boden/Wasser/Gebäude-Kontakt. Liefert Aufprallgeschwindigkeit. */
  _contacts(dt, gearDown = true) {
    const g = this.game;
    const col = g.collision;
    const bottomY = this.pos.y + this.model.bottom;
    const gh = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.5, Math.max(0.5, -this.model.bottom + 0.3)).h;
    let impact = 0;
    this.onGround = false;
    if (bottomY <= gh + 0.02) {
      impact = -this.vel.y;
      this.pos.y = gh - this.model.bottom;
      if (this.vel.y < 0) this.vel.y = 0;
      this.onGround = true;
      const up = this.up;
      const tilt = Math.acos(clamp(up.y, -1, 1));
      const hspeed = Math.hypot(this.vel.x, this.vel.z);
      if (impact > FC.safeLandingVSpeed || tilt > 0.7 || (!gearDown && hspeed > 8) || (this.kind2 === 'heli' && hspeed > 25)) {
        this.damage((impact + (tilt > 0.7 ? 20 : 0) + (!gearDown ? hspeed : 0)) * 25, { type: 'crash' });
      }
      // Aufrichten auf dem Boden (Flugzeuge beim Startlauf nicht – sie müssen rotieren können)
      if (this.kind2 === 'heli' || Math.abs(this.speed) < this.def.stallSpeed * 0.8) {
        const level = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
        this.quat.slerp(level, Math.min(1, dt * (tilt < 0.5 ? 6 : 1)));
      }
      this.angVel.multiplyScalar(0.8);
    }
    // Gebäude (Rumpf + Rotorkreis)
    const r = this.kind2 === 'heli' ? this.size[2] * 0.42 : Math.max(this.size[0], this.size[2]) * 0.35;
    const res = col.resolveCircle(this.pos.x, this.pos.z, r, this.pos.y + this.model.bottom + 0.4, this.pos.y + 1.5, 0.3);
    if (res.hit && !(res.obj && res.obj.kind === 'worldWall')) {
      const vn = this.vel.x * res.nx + this.vel.z * res.nz;
      this.pos.x = res.x; this.pos.z = res.z;
      if (vn < 0) {
        this.vel.x -= 1.3 * vn * res.nx; this.vel.z -= 1.3 * vn * res.nz;
        if (-vn > FC.crashSpeed * 0.5) this.damage(-vn * 40, { type: 'crash' });
        else if (-vn > 3) this.damage(-vn * 8, { type: 'crash' });
      }
    } else if (res.hit) { this.pos.x = res.x; this.pos.z = res.z; this.vel.x *= -0.3; this.vel.z *= -0.3; }
    // Wasser
    if (this.pos.y + this.model.bottom < WATER_Y) {
      this.vel.multiplyScalar(0.9);
      this.vel.y = Math.max(this.vel.y, -1);
      this.damage(60 * dt, { type: 'water' });
      this.submerged = 1;
    } else this.submerged = 0;
    return impact;
  }

  damage(amount, info = {}) {
    if (this.destroyed) return;
    this.health -= amount * (1 - this.tuning.armor * 0.2);
    this.damageLevel = clamp(1 - this.health / this.maxHealth, 0, 1);
    if (info.source) this.lastAttacker = info.source;
    if (this.health < this.maxHealth * 0.25) this.onFire = true;
    if (this.health <= 0) this.explode(info.source || this.lastAttacker);
    this.model.bodyMat.color.copy(this.model.baseColor).lerp(new THREE.Color(0x222222), this.damageLevel * 0.5);
  }

  explode(source) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroyedAt = this.game.elapsed;
    this.health = -1;
    this.model.bodyMat.color.setHex(0x1a1a1a);
    events.emit('vehicle:exploded', { vehicle: this, source });
    events.emit('aircraft:crash', { aircraft: this });
    if (this.game.combat) this.game.combat.explosion(this.pos.clone(), 12, 300, source, { vehicle: this });
    if (this.driver && this.game.vehicles) this.game.vehicles.killOccupants(this, source);
  }

  repair() { this.health = this.maxHealth; this.damageLevel = 0; this.onFire = false; this.model.bodyMat.color.copy(this.model.baseColor); }
  setColor(hex) { this.model.baseColor.setHex(hex); this.model.bodyMat.color.setHex(hex); }
  _applyDamageVisual() {}
  resetUpright() { this.quat.setFromAxisAngle(UP, this.heading); this.angVel.set(0, 0, 0); this.vel.set(0, 0, 0); }
  onImpact() {}
  burstTire() {}

  _status(dt) {
    const fx = this.game.fx;
    if (this.onFire && !this.destroyed) {
      this.health -= dt * 6;
      if (fx) fx.fire(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 1.2);
      if (fx && Math.random() < 0.5) fx.smokePuff(this.pos, { dark: 0.9, size: 1 });
      if (this.health <= 0) this.explode(this.lastAttacker);
    }
    if (this.destroyed && fx && Math.random() < 0.2) fx.smokePuff(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), { dark: 0.9, size: 1.5, life: 3 });
  }

  updateVisual(dt, alpha) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
    this.mesh.position.copy(this.renderPos);
    this.mesh.quaternion.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }

  seatLocal() { return new THREE.Vector3(0.35, this.model.bottom + 0.55, this.kind2 === 'heli' ? 1.2 : (this.type === 'jet' ? 3.2 : 0.6)); }

  placeOccupant(ch, root) {
    const p = this.seatLocal().applyQuaternion(this.mesh.quaternion).add(this.mesh.position);
    root.position.copy(p);
    root.quaternion.copy(this.mesh.quaternion);
    root.scale.setScalar(0.9);
  }

  driverEyePos() { return this.seatLocal().add(new THREE.Vector3(0, 1.3, 0.3)).applyQuaternion(this.mesh.quaternion).add(this.mesh.position); }

  doorPos(side = -1) {
    const p = new THREE.Vector3(side * (this.kind2 === 'heli' ? 2.2 : (this.type === 'jet' ? 2.5 : 2)), this.model.bottom, this.kind2 === 'heli' ? 0.5 : -1).applyQuaternion(this.quat).add(this.pos);
    return p;
  }

  /** Aussteigen bzw. Abspringen (Fallschirm). */
  exitAircraft(pl) {
    const g = this.game;
    const alt = this.altitude;
    if (this.onGround || alt < 3) { g.vehicles.exitVehicle(pl, true); return; }
    // Abspringen
    this.driver = null;
    pl.vehicle = null;
    const p = this.pos.clone().addScaledVector(this.right, 3).add(new THREE.Vector3(0, -1.5, 0));
    pl.teleport(p.x, p.y, p.z, this.heading);
    pl.vel.copy(this.vel).multiplyScalar(0.7);
    pl.onGround = false;
    pl.hasParachute = true;
    pl.airTime = 0.5;
    this.controls.up = false; this.controls.down = false;
    g.hud.help(`Fallschirm öffnen: <kbd>${g.input.labelFor('parachute')}</kbd>`, 5);
    events.emit('player:bailout', { aircraft: this });
  }

  remove() { this.game.scene.remove(this.mesh); this.removed = true; }
}

// ============================================================================ Helikopter
export class Helicopter extends Aircraft {
  constructor(game, type, opts) {
    super(game, type, opts);
    this.kind2 = 'heli';
    this.military = type === 'heliMil';
    this.model = heliModel(this.def, this.military);
    this.mesh = this.model.group;
    game.scene.add(this.mesh);
    this.rotor = 0;           // Rotordrehzahl 0..1
    this.collectiveLevel = 0; // Simulationsmodus
    this._place(opts && opts.y);
  }

  fixedUpdate(dt) {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const c = this.controls;
    const d = this.def;
    const piloted = !!this.driver && !this.destroyed && this.fuel > 0;
    this.rotor = clamp(this.rotor + (piloted ? dt / FC.rotorSpinUp : -dt / 6), 0, 1);
    const m = this.mass;
    const force = new THREE.Vector3(0, -G() * m, 0);
    const up = this.up;
    // Auftrieb
    let lift;
    if (this.sim) {
      this.collectiveLevel = clamp(this.collectiveLevel + ((c.up ? 1 : 0) - (c.down ? 1 : 0)) * dt * 0.7, 0, 1.8);
      lift = m * G() * this.collectiveLevel * d.lift * 0.6;
    } else {
      const coll = (c.up ? 1 : 0) - (c.down ? 1 : 0);
      // Arcade: neutral = Höhe halten (Neigung wird ausgeglichen)
      lift = m * G() * (1 + coll * 0.85) / Math.max(0.55, up.y);
      if (this.onGround && coll <= 0) lift = m * G() * 0.5;
      // Sinken/Steigen dämpfen
      force.y -= this.vel.y * m * (coll === 0 ? 1.2 : 0.3);
    }
    force.addScaledVector(up, lift * this.rotor * this.rotor);
    // Luftwiderstand
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    force.addScaledVector(hv, -m * 0.25);
    force.y -= this.vel.y * m * 0.3;
    // Drehmomente: Zyklik (Nicken/Rollen), Heckrotor (Gieren)
    const torque = new THREE.Vector3();
    const inv = this.quat.clone().invert();
    const aw = this.angVel.clone().applyQuaternion(inv);
    if (this.rotor > 0.3) {
      if (this.sim) {
        torque.x = c.pitch * 1.6 - aw.x * 0.5;
        torque.z = c.roll * 1.6 - aw.z * 0.5;   // +z-Drehung = rechts rollen
      } else {
        // Ziel-Lage, automatisch zurück in die Waagrechte
        const tPitch = c.pitch * d.tilt, tRoll = c.roll * d.tilt;
        const curPitch = this.pitchAngle; // positiv = Nase hoch
        const curRoll = this.rollAngle;   // positiv = rechts
        torque.x = ((-tPitch) - curPitch) * -6 - aw.x * 3.5;
        torque.z = (tRoll - curRoll) * 6 - aw.z * 3.5;
      }
      torque.y = -c.yaw * d.yawRate * 3 - aw.y * 3 + (this.sim ? 0 : -c.roll * 0.6);
    }
    this._integrate(force, torque, dt, this.onGround ? 4 : 0.5);
    const impact = this._contacts(dt, true);
    void impact;
    if (this.onGround && this.rotor < 0.5) { this.vel.x *= 0.9; this.vel.z *= 0.9; }
    if (piloted) this.fuel = Math.max(0, this.fuel - dt * 0.15 * (0.5 + this.rotor));
    if (hv.length() > d.maxSpeed) { const k = d.maxSpeed / hv.length(); this.vel.x *= k; this.vel.z *= k; }
    this._status(dt);
  }

  updateVisual(dt, alpha) {
    super.updateVisual(dt, alpha);
    this.model.rotor.rotation.y += dt * this.rotor * 40;
    this.model.tail.rotation.x += dt * this.rotor * 60;
    this.model.beacon.visible = Math.sin(this.game.elapsed * 6) > 0;
  }
}

// ============================================================================ Flugzeug
export class Plane extends Aircraft {
  constructor(game, type, opts) {
    super(game, type, opts);
    this.kind2 = 'plane';
    this.jet = type === 'jet';
    this.model = planeModel(this.def, this.jet);
    this.mesh = this.model.group;
    game.scene.add(this.mesh);
    this.throttle = 0;
    this.gearDown = true;
    this.flaps = 0;      // 0, 1, 2
    this.stalled = false;
    this._place(opts && opts.y);
  }

  playerInput(inp) {
    super.playerInput(inp);
    if (inp.consume('gear') && (!this.onGround || !this.gearDown)) this.gearDown = !this.gearDown;
    if (inp.consume('flaps')) this.flaps = (this.flaps + 1) % 3;
  }

  fixedUpdate(dt) {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const c = this.controls;
    const d = this.def;
    const m = this.mass;
    const piloted = !!this.driver && !this.destroyed && this.fuel > 0;
    if (piloted) this.throttle = clamp(this.throttle + ((c.up ? 1 : 0) - (c.down ? 1 : 0)) * dt * 0.6, 0, 1);
    else this.throttle = Math.max(0, this.throttle - dt * 0.5);
    const f = this.forward, up = this.up, right = this.right;
    const v = this.vel.length();
    const vF = this.vel.dot(f);
    const force = new THREE.Vector3(0, -G() * m, 0);
    // Schub
    force.addScaledVector(f, this.throttle * d.thrust);
    // Anstellwinkel
    const vUp = this.vel.dot(up);
    const aoa = Math.atan2(-vUp, Math.max(1, vF));
    const flapK = 1 + this.flaps * 0.22;
    let cl = clamp(0.2 + aoa * 5, -1, 1.5) * flapK;
    this.stalled = vF < d.stallSpeed * (1 - this.flaps * 0.12) && !this.onGround;
    if (this.stalled) cl *= 0.35;
    // Auftrieb kalibriert auf das Gewicht bei Referenzgeschwindigkeit vRef
    const vRef = d.stallSpeed * 1.25 * (1 - this.flaps * 0.08);
    const speedK = (vF * Math.abs(vF)) / (vRef * vRef);
    let liftMag;
    if (this.sim) liftMag = m * G() * d.liftK * clamp(speedK * (cl / 0.5), -1, 2.5);
    else liftMag = m * G() * d.liftK * clamp(speedK, 0, 1) * (this.stalled ? 0.4 : 1) / Math.max(0.35, Math.abs(up.y)); // Arcade: hält die Höhe auch in Kurven
    this.lastLift = liftMag;
    force.addScaledVector(up, liftMag);
    // Widerstand
    const cd = 0.02 + (this.gearDown ? 0.02 : 0) + this.flaps * 0.015 + Math.abs(aoa) * 0.05;
    force.addScaledVector(this.vel, -cd * v * m * (this.jet ? 0.012 : 0.02));
    // Seitliches Rutschen abbauen (Seitenflosse)
    const side = this.vel.dot(right);
    force.addScaledVector(right, -side * m * (this.sim ? 0.8 : 2.0));
    // Steuerflächen: Wirkung wächst mit Fahrt
    const eff = clamp(vF / (d.stallSpeed * 1.2), 0, 1.3);
    const inv = this.quat.clone().invert();
    const aw = this.angVel.clone().applyQuaternion(inv);
    const torque = new THREE.Vector3();
    torque.x = c.pitch * d.pitchRate * 3 * eff - aw.x * 3;           // W = Nase runter
    torque.z = c.roll * d.rollRate * 2 * eff - aw.z * 3;             // D = rechts rollen (+z)
    torque.y = -c.yaw * d.yawRate * 2 * eff - aw.y * 2;
    if (!this.sim && !this.onGround) {
      // Arcade: Querlage erzeugt Kurve, Lage stabilisiert sich ohne Eingabe
      torque.y += this.rollAngle * -1.2 * eff;
      if (Math.abs(c.roll) < 0.1) torque.z -= this.rollAngle * FC.arcadeAutoLevel * 2;
      // maximale Querlage ~60°
      if (Math.abs(this.rollAngle) > 0.87) torque.z -= Math.sign(this.rollAngle) * 9;
      if (Math.abs(c.pitch) < 0.1) torque.x += this.pitchAngle * 0.4; // Nase hoch → nach unten drücken
    }
    if (this.stalled) torque.x += 0.8; // Nase fällt
    // Bodenrollen: Lenkung über Seitenruder/Querruder, Bremsen
    if (this.onGround) {
      torque.y += -(c.yaw + c.roll) * 1.2 * clamp(Math.abs(vF) / 5, 0.2, 1) - aw.y * 2;
      const fr = c.brake ? 0.9 : 0.04;
      force.addScaledVector(f, -vF * m * fr * 0.5);
      if (!this.gearDown) force.addScaledVector(this.vel, -m * 1.5);
    }
    this._integrate(force, torque, dt, 0.8);
    // Richtungsstabilität: Flugbahn dreht sich zur Nase (Arcade stärker)
    if (!this.onGround && vF > d.stallSpeed * 0.7) {
      const sp = this.vel.length();
      const k = (this.sim ? 0.7 : 2.2) * dt;
      this.vel.lerp(this.forward.multiplyScalar(sp), Math.min(1, k));
    }
    if (v > d.maxSpeed) this.vel.multiplyScalar(d.maxSpeed / v);
    this._contacts(dt, this.gearDown);
    if (this.onGround && this.gearDown) {
      // Nicht durch den Boden kippen: Nase leicht über Horizont
      const lvl = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
      if (vF < d.stallSpeed * 0.9) this.quat.slerp(lvl, Math.min(1, dt * 3));
    }
    if (piloted) this.fuel = Math.max(0, this.fuel - dt * this.throttle * (this.jet ? 0.6 : 0.25));
    this._status(dt);
  }

  updateVisual(dt, alpha) {
    super.updateVisual(dt, alpha);
    if (this.model.prop) this.model.prop.rotation.z += dt * (5 + this.throttle * 60);
    this.model.gear.visible = this.gearDown;
    if (this.model.flame) { this.model.flame.visible = this.throttle > 0.05; this.model.flame.scale.setScalar(0.4 + this.throttle); }
  }
}

export function createAircraft(game, type, opts) {
  return CONFIG.aircraft[type].kind === 'heli' ? new Helicopter(game, type, opts) : new Plane(game, type, opts);
}

export { damp };
