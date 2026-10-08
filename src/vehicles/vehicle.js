// Bodenfahrzeug mit Raycast-Fahrphysik:
//  - Starrkörper (Position, Orientierung, Geschwindigkeit, Drehgeschwindigkeit, Trägheitstensor)
//  - 4 Räder mit Federung (Feder + Dämpfer), Reifenkräfte längs/quer mit Reibungskreis
//  - Antrieb, Bremse, Handbremse (Hinterachse rutscht → Driften), Lenkung tempoabhängig
//  - Schwerpunkt-Höhe erzeugt Wanken/Nicken; Überschlag möglich
//  - Kollision mit Gebäuden/Objekten (Kreise entlang der Länge), Schaden, Rauch, Feuer, Explosion
//  - Benzin, Lichter, Blinker, Bremslichter, Hupe, Sirene, Alarm, Reifen platzen

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVehicleModel } from './vehicleModel.js';
import { WATER_Y, terrainHeight, groundTerrain } from '../world/terrain.js';
import { clamp, damp } from '../core/mathutil.js';
import { events } from '../core/events.js';
import { disposeTree } from '../core/dispose.js';

const VC = CONFIG.vehicleCommon;
const G = () => CONFIG.physics.gravity;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

let nextId = 1;

export class Vehicle {
  constructor(game, type, { x = 0, z = 0, y = null, heading = 0, color = null } = {}) {
    this.game = game;
    this.id = nextId++;
    this.type = type;
    this.def = CONFIG.vehicles[type];
    const d = this.def;
    this.kind = 'car';
    this.isBike = !!d.bike;
    this.size = d.size;
    this.mass = d.mass;
    this.maxHealth = d.health;
    this.health = d.health;
    this.fuel = VC.fuelCapacity * (0.5 + Math.random() * 0.5);
    this.color = color ?? d.colors[Math.floor(Math.random() * d.colors.length)];
    this.tuning = { engine: 0, tires: 0, armor: 0 };
    // Fahrwerk
    this.restLen = VC.suspensionRest;
    this.hpY = -0.1;
    this.restCompression = 0.12;
    this.comHeight = this.restLen + d.wheelR - this.restCompression - this.hpY;
    this.springK = (d.mass * G() / 4) / this.restCompression;
    this.damperC = VC.damperC * 2 * Math.sqrt(this.springK * d.mass / 4);
    const [W, H, L] = d.size;
    const m = d.mass;
    // Trägheitstensor (Box), etwas erhöht für Stabilität
    this.inertia = new THREE.Vector3(m / 12 * (H * H + L * L) * 1.4, m / 12 * (W * W + L * L) * 1.1, m / 12 * (W * W + H * H) * 1.6);
    this.wheels = [];
    const wp = this.isBike
      ? [[-0.25, d.wheelbase / 2, true], [0.25, d.wheelbase / 2, true], [-0.25, -d.wheelbase / 2, false], [0.25, -d.wheelbase / 2, false]]
      : [[-d.track / 2, d.wheelbase / 2, true], [d.track / 2, d.wheelbase / 2, true], [-d.track / 2, -d.wheelbase / 2, false], [d.track / 2, -d.wheelbase / 2, false]];
    for (const [wx, wz, front] of wp) this.wheels.push({ local: new THREE.Vector3(wx, this.hpY, wz), front, contact: false, compression: this.restCompression, dist: this.restLen + d.wheelR - this.restCompression, spin: 0, burst: false, load: 0, slip: 0 });
    this.driveRear = type === 'sports' || type === 'police' || type === 'motorbike';

    // Zustand
    this.pos = new THREE.Vector3(x, 0, z);
    this.prevPos = new THREE.Vector3();
    this.quat = new THREE.Quaternion().setFromAxisAngle(UP, heading);
    this.prevQuat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.steerAngle = 0;
    this.speed = 0;           // Vorwärtsgeschwindigkeit m/s (negativ = rückwärts)
    this.onGround = false;
    this.wheelsOnGround = 0;
    this.sleeping = false;
    this.driver = null;
    this.passengers = [];
    this.locked = Math.random() < VC.lockedChance;
    this.hasAlarm = Math.random() < VC.alarmChance;
    this.alarmTimer = 0;
    this.stolen = false;
    this.reported = false;
    this.owned = false;
    this.windowBroken = false;
    this.hotwired = false;
    this.destroyed = false;
    this.onFire = false;
    this.burnTimer = 0;
    this.lightsOn = false;
    this.sirenOn = false;
    this.horn = false;
    this.indicator = 0;          // -1 links, 1 rechts, 2 Warnblinker
    this.flipTimer = 0;
    this.airTime = 0;
    this.submerged = 0;
    this.lastImpact = 0;
    this.damageLevel = 0;
    this.isAircraft = false;
    this.isBoat = false;
    this.persistent = false;     // Missions-/Garagenfahrzeug → nicht entfernen
    this.ai = null;              // Verkehrs-/Polizei-KI
    this.renderPos = new THREE.Vector3();

    // Modell
    this.model = buildVehicleModel(type, d, this.color, -this.comHeight);
    this.mesh = this.model.group;
    this.mesh.userData.vehicle = this;
    game.scene.add(this.mesh);

    // Auf den Boden setzen
    // Auf Bodenhöhe (nicht auf Dächern) absetzen, ausser eine Höhe ist vorgegeben (Parkhausdeck)
    const gy = y ?? game.collision.groundHeight(x, z, Math.max(0, terrainHeight(x, z)) + 1.0, 0.5).h;
    this.pos.y = gy + this.comHeight;
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this._syncMesh(1);
  }

  get heading() {
    const f = _v1.set(0, 0, 1).applyQuaternion(this.quat);
    return Math.atan2(f.x, f.z);
  }

  get forward() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat); }
  get up() { return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat); }
  get right() { return new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat); }
  get occupied() { return !!this.driver; }
  get speedKmh() { return Math.abs(this.speed) * 3.6; }

  wake() { this.sleeping = false; this.sleepTimer = 0; }

  /** Physik-Schritt. */
  fixedUpdate(dt) {
    if (this.sleeping) return;
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const sub = 2;
    for (let i = 0; i < sub; i++) this._step(dt / sub);
    // Rettung: durch den Boden gefallen (z. B. bei sehr hohem Tempo an Geländekanten) → zurück auf den Boden
    const th = groundTerrain(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y < th - 3 && th > WATER_Y - 1.3) {
      this.pos.y = this.game.collision.groundHeight(this.pos.x, this.pos.z, th + 2, 0).h + this.comHeight + 0.2;
      this.vel.y = Math.max(0, this.vel.y);
      this.prevPos.copy(this.pos);
    }
    // Schlafen, wenn ruhig und ohne Fahrer
    if (!this.driver && this.vel.lengthSq() < 0.01 && this.angVel.lengthSq() < 0.01 && this.wheelsOnGround >= 3 && !this.onFire) {
      this.sleepTimer = (this.sleepTimer || 0) + dt;
      if (this.sleepTimer > 1) { this.sleeping = true; this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0); }
    } else this.sleepTimer = 0;
    this._statusEffects(dt);
  }

  _step(dt) {
    const d = this.def;
    const col = this.game.collision;
    const m = this.mass;
    const force = _v1.set(0, -G() * m, 0);
    const torque = _v2.set(0, 0, 0);
    const up = _v3.set(0, 1, 0).applyQuaternion(this.quat);
    const fwd = _v4.set(0, 0, 1).applyQuaternion(this.quat);
    const right = new THREE.Vector3().crossVectors(up, fwd).negate(); // rechts = lokal -x (x Ost, z Süd)
    const c = this.controls;
    const dead = this.destroyed || this.health <= 0;
    const engineOk = !dead && this.fuel > 0 && this.submerged < 0.6 && (this.driver || this.ai);

    // Vorwärtsgeschwindigkeit
    this.speed = this.vel.dot(fwd);
    const absSpeed = Math.abs(this.speed);

    // Lenkung (tempoabhängig)
    const steerMax = d.steer / (1 + absSpeed / 22);
    // steer +1 = rechts; Drehung um +y mit positivem Winkel lenkt nach links → Vorzeichen umkehren
    this.steerAngle = damp(this.steerAngle, -(c.steer || 0) * steerMax, 8, dt);

    // Antrieb
    const engineMul = 1 + this.tuning.engine * 0.15;
    const topSpeed = d.maxSpeed * (1 + this.tuning.engine * 0.06);
    let drive = 0;
    let brake = 0;
    if (engineOk) {
      if (c.throttle > 0) {
        if (this.speed < -0.5) brake = c.throttle;
        else drive = c.throttle * d.power * engineMul * Math.max(0, 1 - (this.speed / topSpeed) ** 2);
      }
      if (c.brake > 0) {
        if (this.speed > 0.5) brake = Math.max(brake, c.brake);
        else drive = -c.brake * d.power * 0.6 * Math.max(0, 1 - (-this.speed / d.reverseSpeed) ** 2);
      }
    } else if (c.brake > 0 || c.throttle > 0) brake = Math.max(c.brake, 0.3);
    if (!this.driver && !this.ai) brake = Math.max(brake, 0.5);

    const gripBase = d.grip * (1 + this.tuning.tires * 0.08);
    const nDriven = this.isBike ? 2 : this.driveRear ? 2 : 4;
    this.wheelsOnGround = 0;
    let skid = 0;
    const L = this.restLen + d.wheelR;
    for (const w of this.wheels) {
      // Aufhängungspunkt in Weltkoordinaten
      const hp = w.world || (w.world = new THREE.Vector3());
      hp.copy(w.local).applyQuaternion(this.quat).add(this.pos);
      w.contact = false;
      if (up.y > 0.25) {
        const gq = col.groundHeight(hp.x, hp.z, hp.y + 0.1, 0.35);
        let gh = gq.h;
        if (w.burst) gh -= 0.12;
        const dist = (hp.y - gh) / up.y;
        // Boden deutlich über dem Rad = Wand/Hang, kein Radkontakt (verhindert Katapulte)
        if (dist < L && dist > -1.2) {
          w.contact = true;
          this.wheelsOnGround++;
          const compression = Math.min(L - dist, this.restLen + 0.1);
          // Geschwindigkeit am Rad
          const r = _q; void r;
          const rel = new THREE.Vector3().subVectors(hp, this.pos);
          const pv = new THREE.Vector3().crossVectors(this.angVel, rel).add(this.vel);
          const compVel = -pv.dot(up);
          let fs = this.springK * compression + this.damperC * compVel;
          if (compression > this.restLen) fs += (compression - this.restLen) * this.springK * 6; // Anschlag
          fs = Math.max(0, fs);
          w.load = fs;
          w.dist = dist;
          const fSusp = up.clone().multiplyScalar(fs);
          force.add(fSusp);
          torque.add(new THREE.Vector3().crossVectors(rel, fSusp));

          // Reifenrichtung
          let wf = fwd, wr = right;
          if (w.front && this.steerAngle !== 0) {
            _q.setFromAxisAngle(up, this.steerAngle);
            wf = fwd.clone().applyQuaternion(_q);
            wr = right.clone().applyQuaternion(_q);
          }
          const vLong = pv.dot(wf);
          const vLat = pv.dot(wr);
          let mu = gripBase / 9;
          if (!w.front && c.handbrake) mu *= VC.handbrakeGripFactor;
          if (w.burst) mu *= 0.45;
          if (this.game.weather && this.game.weather.wetness > 0.3) mu *= 1 - this.game.weather.wetness * 0.18;
          const maxF = mu * fs;
          // Seitenkraft: Schlupf ausgleichen, begrenzt durch Reibung
          let fLat = -vLat * gripBase * fs * 0.06;
          const slideRatio = Math.abs(fLat) / (maxF + 1e-6);
          if (slideRatio > 1) { fLat *= (maxF * VC.driftGripFactor + maxF * (1 - VC.driftGripFactor) / slideRatio) / Math.abs(fLat); skid = Math.max(skid, Math.min(1, slideRatio - 1)); }
          // Längskraft
          let fLong = 0;
          const driven = this.isBike ? !w.front : this.driveRear ? !w.front : true;
          if (driven) fLong += drive / nDriven;
          if (brake > 0) {
            const bf = d.brake / 4 * brake;
            fLong -= clamp(vLong * m * 2, -bf, bf);
          }
          if (!w.front && c.handbrake) fLong -= clamp(vLong * m, -d.brake / 3, d.brake / 3);
          fLong -= vLong * VC.rollingDrag * m * 0.25;
          // Reibungskreis
          const tot = Math.hypot(fLat, fLong);
          if (tot > maxF && tot > 0) { const k = maxF / tot; fLat *= k; fLong *= k; if (Math.abs(fLong) > 0.5 * maxF) skid = Math.max(skid, 0.4); }
          const fTire = wf.clone().multiplyScalar(fLong).addScaledVector(wr, fLat);
          // Angriffspunkt etwas angehoben (weniger Kipp-Moment, stabiler)
          const applyAt = rel.clone().addScaledVector(up, -(dist - d.wheelR) * 0.2 - this.hpY);
          force.add(fTire);
          torque.add(new THREE.Vector3().crossVectors(applyAt, fTire));
          w.spin += (vLong / d.wheelR) * dt;
          w.slip = slideRatio;
        }
      }
      if (!w.contact) w.dist = Math.min(L, (w.dist || L) + dt * 3);
    }
    this.onGround = this.wheelsOnGround > 0;
    this.skid = skid;

    // Karosserie-Ecken gegen Boden (wenn auf dem Dach/Seite oder bei harter Landung)
    const [W, H, Ln] = d.size;
    const corners = this._corners || (this._corners = [[-1, -1, -1], [1, -1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, -1], [1, 1, -1], [-1, 1, 1], [1, 1, 1]].map(([a, b, cc]) => new THREE.Vector3(a * W / 2, b > 0 ? H - this.comHeight : -this.comHeight + d.wheelR * 0.8, cc * Ln / 2)));
    for (const cl of corners) {
      const p = cl.clone().applyQuaternion(this.quat).add(this.pos);
      const gh = col.groundHeight(p.x, p.z, p.y + 0.3, 0.3).h;
      if (p.y < gh && gh - p.y < 1.5) {
        const pen = Math.min(0.5, gh - p.y);
        const rel = p.clone().sub(this.pos);
        const pv = new THREE.Vector3().crossVectors(this.angVel, rel).add(this.vel);
        const fn = Math.max(0, pen * m * 60 - pv.y * m * 4);
        const fr = new THREE.Vector3(-pv.x, 0, -pv.z).multiplyScalar(m * 1.2);
        const f = new THREE.Vector3(0, fn, 0).add(fr);
        force.add(f);
        torque.add(new THREE.Vector3().crossVectors(rel, f));
        if (pv.length() > 3) skid = Math.max(skid, 0.5);
      }
    }

    // Luftwiderstand
    const sp = this.vel.length();
    force.addScaledVector(this.vel, -VC.airDrag * sp * (d.size[0] * d.size[1]) * 0.5);

    // Motorrad: aufrecht halten und in die Kurve legen
    if (this.isBike && !dead) {
      const lean = -this.steerAngle * clamp(absSpeed / 12, 0, 1) * 0.9;
      const targetUp = new THREE.Vector3(0, 1, 0).applyAxisAngle(fwd, lean);
      const corr = new THREE.Vector3().crossVectors(up, targetUp);
      torque.addScaledVector(corr, m * 60);
      torque.addScaledVector(fwd, -this.angVel.dot(fwd) * m * 6);
    }
    // Wasser: Auftrieb, Bremsen
    const waterDepth = WATER_Y - (this.pos.y - this.comHeight);
    if (waterDepth > 0) {
      this.submerged = clamp(waterDepth / d.size[1], 0, 1);
      force.y += m * G() * 0.75 * this.submerged;
      force.addScaledVector(this.vel, -m * 1.5 * this.submerged);
      this.angVel.multiplyScalar(1 - dt * 2);
    } else this.submerged = 0;

    // Integration
    this.vel.addScaledVector(force, dt / m);
    // Drehung: Drehmoment in lokale Achsen
    const inv = this.quat.clone().invert();
    const tl = torque.applyQuaternion(inv);
    const aw = this.angVel.clone().applyQuaternion(inv);
    aw.x += (tl.x / this.inertia.x) * dt;
    aw.y += (tl.y / this.inertia.y) * dt;
    aw.z += (tl.z / this.inertia.z) * dt;
    this.angVel.copy(aw.applyQuaternion(this.quat));
    // Dämpfung
    const angDamp = this.onGround ? 1.2 : 0.15;
    this.angVel.multiplyScalar(Math.max(0, 1 - angDamp * dt));
    if (this.angVel.length() > 12) this.angVel.setLength(12);
    this.pos.addScaledVector(this.vel, dt);
    const av = this.angVel;
    const angle = av.length() * dt;
    if (angle > 1e-7) {
      _q.setFromAxisAngle(av.clone().normalize(), angle);
      this.quat.premultiply(_q).normalize();
    }

    // Kollision mit Gebäuden / Objekten
    this._collideStatic(dt);
    // Stillstand-Haftung: kleine Drift bei Stillstand verhindern
    if (this.wheelsOnGround >= 3 && sp < 0.15 && (brake > 0 || !this.driver) && Math.abs(c.throttle) < 0.01) {
      this.vel.x *= 0.8; this.vel.z *= 0.8;
    }
  }

  /** Kollision der Karosserie (Kreise entlang der Länge) mit statischen Boxen. */
  _collideStatic(dt) {
    const d = this.def;
    const [W, H, L] = d.size;
    const r = W / 2;
    const n = Math.max(2, Math.round(L / W));
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat);
    const bottom = this.pos.y - this.comHeight + 0.45;
    const top = this.pos.y + H - this.comHeight;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (L - W);
      const cx = this.pos.x + fwd.x * t, cz = this.pos.z + fwd.z * t;
      const res = this.game.collision.resolveCircle(cx, cz, r, bottom, top, 0.4);
      if (!res.hit) continue;
      const obj = res.obj;
      // Zerstörbare Requisiten umfahren
      if (obj && obj.destructible && obj.prop) {
        const impact = Math.abs(this.vel.x * res.nx + this.vel.z * res.nz);
        if (impact > 1.5 || this.mass > 2500) {
          this.game.vehicles.onPropHit(this, obj, impact);
          this.vel.multiplyScalar(obj.prop.type === 'lamp' ? 0.85 : 0.95);
          continue;
        }
      }
      const px = res.x - cx, pz = res.z - cz;
      this.pos.x += px; this.pos.z += pz;
      const vn = this.vel.x * res.nx + this.vel.z * res.nz;
      if (vn < 0) {
        const restitution = 0.25;
        this.vel.x -= (1 + restitution) * vn * res.nx;
        this.vel.z -= (1 + restitution) * vn * res.nz;
        this.vel.x *= 0.92; this.vel.z *= 0.92;
        // Drehimpuls durch seitlichen Aufprall
        const lever = t;
        const cross = fwd.x * res.nz - fwd.z * res.nx;
        this.angVel.y += -cross * lever * (-vn) * 0.04;
        this.onImpact(-vn, obj);
      }
    }
  }

  /** Aufprall → Schaden, Effekte. */
  onImpact(speed, obj = null, other = null) {
    if (speed < 3) return;
    const now = this.game.elapsed;
    if (now - this.lastImpact < 0.15) return;
    this.lastImpact = now;
    const armor = 1 - this.tuning.armor * 0.2 - (this.def.armored ? 0.3 : 0);
    const dmg = Math.pow(speed - 3, 1.45) * 6 * VC.collisionDamageFactor * armor;
    this.damage(dmg, { type: 'collision', other });
    events.emit('vehicle:impact', { vehicle: this, speed, obj, other });
    if (this.game.fx) this.game.fx.sparks(this.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), Math.min(20, Math.floor(speed)));
    if (obj && obj.explosive && speed > 14 && this.game.combat) this.game.combat.explodeProp(obj);
    // Insassen: Schaden bei sehr harten Unfällen
    if (speed > 22 && this.driver && this.driver.damage && !this.isBike) this.driver.damage((speed - 22) * 2, { type: 'crash' });
    if (this.isBike && speed > 12 && this.driver && this.game.vehicles) this.game.vehicles.ejectFromBike(this, speed);
  }

  /** Schaden am Fahrzeug. */
  damage(amount, info = {}) {
    if (this.destroyed) return;
    this.wake();
    this.health -= amount;
    this.damageLevel = clamp(1 - this.health / this.maxHealth, 0, 1);
    if (info.source && info.source.isPlayer && this.game.vehicles) this.game.vehicles.onPlayerDamaged(this, info);
    if (this.health <= this.maxHealth * VC.fireAtHealthPct && !this.onFire) {
      this.onFire = true;
      this.burnTimer = VC.burnTime;
      events.emit('vehicle:fire', { vehicle: this });
    }
    if (this.health <= -this.maxHealth * 0.4) this.explode(info.source);
    this._applyDamageVisual();
  }

  burstTire(i) {
    const w = this.wheels[i];
    if (!w || w.burst) return;
    w.burst = true;
    events.emit('vehicle:tire', { vehicle: this });
  }

  repair() {
    this.health = this.maxHealth;
    this.damageLevel = 0;
    this.onFire = false;
    for (const w of this.wheels) w.burst = false;
    this.windowBroken = false;
    this._applyDamageVisual();
  }

  setColor(hex) {
    this.color = hex;
    this.model.baseColor.setHex(hex);
    this._applyDamageVisual();
  }

  _applyDamageVisual() {
    const c = this.model.baseColor.clone();
    const dl = this.destroyed ? 1 : this.damageLevel;
    c.lerp(new THREE.Color(0x1a1a1a), this.destroyed ? 0.85 : dl * 0.45);
    this.model.bodyMat.color.copy(c);
    // Verformung: leichtes Verkippen des Aufbaus
    const b = this.model.body;
    b.rotation.z = dl > 0.5 ? (this.id % 2 ? 0.04 : -0.04) * dl : 0;
    b.rotation.x = dl > 0.7 ? 0.03 : 0;
    b.scale.set(1 - dl * 0.04, 1 - dl * 0.08, 1 - dl * 0.05);
  }

  explode(source = null) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.onFire = false;
    this.health = Math.min(this.health, -1);
    this.sirenOn = false;
    this.lightsOn = false;
    this._applyDamageVisual();
    this.vel.y += 6;
    this.angVel.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
    this.wake();
    this.destroyedAt = this.game.elapsed;
    events.emit('vehicle:exploded', { vehicle: this, source });
    if (this.game.combat) this.game.combat.explosion(this.pos.clone(), VC.explosionRadius, VC.explosionDamage, source, { vehicle: this });
    // Insassen
    if (this.driver && this.game.vehicles) this.game.vehicles.killOccupants(this, source);
  }

  _statusEffects(dt) {
    const fx = this.game.fx;
    if (this.onFire && !this.destroyed) {
      this.burnTimer -= dt;
      this.health -= dt * 8;
      if (fx && Math.random() < 0.7) fx.fire(this._hoodPos(), 1.2);
      if (this.burnTimer <= 0) this.explode(this.lastAttacker);
    }
    if (fx && !this.destroyed && this.damageLevel > 1 - VC.smokeAtHealthPct && Math.random() < this.damageLevel * 0.5) fx.smokePuff(this._hoodPos(), { dark: this.damageLevel, life: 2 });
    if (fx && this.destroyed && Math.random() < 0.15) fx.smokePuff(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), { dark: 0.9, life: 3, size: 1.2 });
    // Benzin
    if (this.driver && this.controls.throttle > 0) this.fuel = Math.max(0, this.fuel - this.def.fuelUse * this.controls.throttle * dt * 0.08);
    // Alarm
    if (this.alarmTimer > 0) this.alarmTimer -= dt;
    // Überschlag erkennen
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
    if (up.y < 0.3 && this.vel.length() < 2.5) this.flipTimer += dt; else this.flipTimer = 0;
    if (!this.onGround) this.airTime += dt; else this.airTime = 0;
  }

  _hoodPos() {
    return new THREE.Vector3(0, this.def.size[1] * 0.5 - this.comHeight + 0.3, this.def.size[2] * 0.33).applyQuaternion(this.quat).add(this.pos);
  }

  /** Aufrichten (Rettung bei Überschlag). */
  resetUpright(toRoad = false) {
    let x = this.pos.x, z = this.pos.z, h = this.heading;
    if (toRoad && this.game.roads) {
      const np = this.game.roads.nearestEdgePoint(x, z);
      if (np) {
        x = np.x; z = np.z;
        const e = np.edge; const p = e.points[np.seg], q = e.points[np.seg + 1];
        const hh = Math.atan2(q.x - p.x, q.z - p.z);
        h = Math.abs(((hh - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < Math.PI / 2 ? hh : hh + Math.PI;
      }
    }
    const gy = this.game.collision.groundHeight(x, z, this.pos.y + 3, 3).h;
    this.pos.set(x, gy + this.comHeight + 0.4, z);
    this.quat.setFromAxisAngle(UP, h);
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.flipTimer = 0;
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.wake();
  }

  /** Visuelles Update (Interpolation, Räder, Lichter). */
  updateVisual(dt, alpha, night) {
    this._syncMesh(alpha);
    const d = this.def;
    for (let i = 0; i < this.model.wheels.length; i++) {
      const mw = this.model.wheels[i];
      const w = this.isBike ? this.wheels[i === 0 ? 0 : 2] : this.wheels[i];
      const off = (w.dist || this.restLen) - d.wheelR;
      mw.steer.position.y = this.hpY - off;
      mw.steer.rotation.y = w.front ? this.steerAngle : 0;
      mw.spin.rotation.x = w.spin;
      mw.steer.scale.y = w.burst ? 0.75 : 1;
    }
    const L = this.model.lights;
    const t = this.game.elapsed;
    const headOn = this.lightsOn || (night > 0.4 && (this.driver || this.ai) && !this.destroyed);
    this.model.headMat.emissiveIntensity = headOn ? 2.2 : 0.15;
    const braking = this.controls.brake > 0.1 && this.speed > 0.5;
    this.model.tailMat.emissiveIntensity = this.destroyed ? 0 : braking ? 2.6 : headOn ? 0.9 : 0.15;
    if (this.model.indMat) {
      const blink = Math.sin(t * 9) > 0;
      const alarm = this.alarmTimer > 0;
      this.model.indMat[0].emissiveIntensity = (alarm || this.indicator === -1 || this.indicator === 2) && blink ? 2 : 0;
      this.model.indMat[1].emissiveIntensity = (alarm || this.indicator === 1 || this.indicator === 2) && blink ? 2 : 0;
    }
    if (L.siren.length) {
      const on = this.sirenOn && !this.destroyed;
      const ph = Math.sin(t * 12) > 0;
      L.siren[0].material.emissiveIntensity = on ? (ph ? 3 : 0.1) : 0.1;
      L.siren[1].material.emissiveIntensity = on ? (ph ? 0.1 : 3) : 0.1;
    }
  }

  _syncMesh(alpha) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
    this.mesh.position.copy(this.renderPos);
    this.mesh.quaternion.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }

  /** Sitzposition für Insassen. */
  seatLocal(seat = 0) {
    const d = this.def;
    if (this.isBike) return new THREE.Vector3(0, -this.comHeight + d.wheelR + 0.35, seat === 0 ? -0.2 : -0.75);
    const side = seat % 2 === 0 ? -1 : 1;
    const row = Math.floor(seat / 2);
    const big = d.size[1] > 2.5;
    return new THREE.Vector3(side * d.size[0] * 0.22, -this.comHeight + (big ? 1.0 : -0.05), d.size[2] * (0.08 - row * 0.28) + (big ? d.size[2] * 0.3 : 0));
  }

  placeOccupant(ch, root) {
    const seat = ch.seat || 0;
    const p = this.seatLocal(seat).applyQuaternion(this.mesh.quaternion).add(this.mesh.position);
    root.position.copy(p);
    root.quaternion.copy(this.mesh.quaternion);
    root.rotation.setFromQuaternion(this.mesh.quaternion);
    // In niedrigen PKW etwas kleiner darstellen, damit der Kopf nicht durchs Dach ragt
    const low = !this.isBike && this.def && this.def.size[1] < 1.7;
    root.scale.setScalar(low ? 0.82 : 1);
  }

  driverEyePos() {
    const p = this.seatLocal(0);
    p.y += 1.25;
    p.z += 0.1;
    return p.applyQuaternion(this.mesh.quaternion).add(this.mesh.position);
  }

  /** Position neben der Fahrertür (Weltkoordinaten). side -1 = links. */
  doorPos(side = -1) {
    const d = this.def;
    const p = new THREE.Vector3(side * (d.size[0] / 2 + 0.9), -this.comHeight, d.size[2] * 0.1).applyQuaternion(this.quat).add(this.pos);
    return p;
  }

  remove() {
    if (this.removed) return;
    this.game.scene.remove(this.mesh);
    disposeTree(this.mesh);
    this.removed = true;
  }
}
