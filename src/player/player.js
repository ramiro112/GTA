// Spielfigur: Bewegung zu Fuss (Gehen, Rennen, Sprinten mit Ausdauer, Springen, Ducken,
// Klettern, Schwimmen, Fallschaden), Gesundheit/Rüstung, Tod.
// Fahrzeug- und Waffenlogik hängen sich über game.vehicles / game.weapons an.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from './character.js';
import { WATER_Y, groundTerrain } from '../world/terrain.js';
import { clamp, angleDiff, damp } from '../core/mathutil.js';
import { events } from '../core/events.js';

const P = CONFIG.player;

export class Player {
  constructor(game) {
    this.game = game;
    this.model = new CharacterModel({ skin: 0xe0ac69, shirt: 0x2d6a4f, pants: 0x22313f, hair: 0x2b1d0e });
    this.model.root.name = 'player';
    game.scene.add(this.model.root);
    this.pos = new THREE.Vector3(0, 0, 0);
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.onGround = true;
    this.health = P.maxHealth;
    this.armor = 0;
    this.stamina = P.maxStamina;
    this.crouch = false;
    this.swimming = false;
    this.sprinting = false;
    this.dead = false;
    this.vehicle = null;       // aktuelles Fahrzeug
    this.seat = 0;
    this.parachute = false;
    this.hasParachute = true;
    this.state = 'idle';
    this.climb = null;         // laufende Kletteranimation
    this.lastSafe = new THREE.Vector3();
    this.stuckTimer = 0;
    this.airTime = 0;
    this.maxFallSpeed = 0;
    this.radius = P.radius;
    this.height = P.height;
    this.invulnerable = 0;
    this.aiming = false;
    this.inCover = null;
    this.isPlayer = true;
    this.hitFlash = 0;
  }

  get position() { return this.pos; }
  get alive() { return !this.dead; }

  teleport(x, y, z, heading = this.heading) {
    if (y === null || y === undefined) y = this.game.collision.groundHeight(x, z, 500, 0).h;
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.lastSafe.copy(this.pos);
    this.maxFallSpeed = 0;
    this.airTime = 0;
  }

  /** Position/Geschwindigkeit an das Fahrzeug koppeln, in dem die Figur sitzt. */
  syncToVehicle() {
    const v = this.vehicle;
    if (!v) return;
    this.pos.copy(v.pos);
    this.vel.copy(v.vel);
    this.heading = v.heading;
  }

  /** Fester Physikschritt zu Fuss. */
  fixedUpdate(dt) {
    // Im Fahrzeug folgt die Spielerposition dem Fahrzeug (früher blieb sie am Einstiegsort stehen:
    // Parkplatz-Streaming, Polizei, Autosave usw. arbeiteten dann mit einer falschen Position).
    // Schutzzeit nach dem Respawn läuft auch im Fahrzeug ab (früher blieb man im Auto unverwundbar)
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.vehicle) { this.prevPos.copy(this.pos); this.syncToVehicle(); return; }
    if (this.dead) return;
    this.prevPos.copy(this.pos);
    const g = this.game;
    const input = g.input;
    const col = g.collision;

    // Klettern läuft als kurze Animation
    if (this.climb) {
      this.climb.t += dt / this.climb.dur;
      const t = Math.min(1, this.climb.t);
      this.pos.lerpVectors(this.climb.from, this.climb.to, t);
      this.pos.y = this.climb.from.y + (this.climb.to.y - this.climb.from.y) * Math.min(1, t * 1.8);
      if (t >= 1) this.climb = null;
      this.state = 'jump';
      return;
    }

    const move = input.moveAxes();
    const cam = g.camera3p;
    const fwd = new THREE.Vector2(Math.sin(cam.yaw), Math.cos(cam.yaw));
    const right = new THREE.Vector2(-Math.cos(cam.yaw), Math.sin(cam.yaw));
    let wx = fwd.x * move.y + right.x * move.x;
    let wz = fwd.y * move.y + right.y * move.x;
    const mag = Math.min(1, Math.hypot(wx, wz));
    const wl = Math.hypot(wx, wz);
    if (wl > 0.01) { wx /= wl; wz /= wl; }
    // Deckung: nur entlang der Wand bewegen, vom Hindernis weg = Deckung verlassen
    if (this.inCover && wl > 0.01) {
      const c = this.inCover;
      if (wx * c.nx + wz * c.nz > 0.75) { this.inCover = null; this.crouch = false; }
      else { const tx = -c.nz, tz = c.nx; const a = wx * tx + wz * tz; wx = tx * a; wz = tz * a; }
    }
    if (this.inCover && this.inCover.box) {
      const b = this.inCover.box;
      const cx = Math.max(b.minX, Math.min(this.pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(this.pos.z, b.maxZ));
      if (Math.hypot(this.pos.x - cx, this.pos.z - cz) > 1.3) { this.inCover = null; this.crouch = false; }
    }

    // Wasser?
    const terrainH = groundTerrain(this.pos.x, this.pos.z, this.pos.y);
    const deep = terrainH < WATER_Y - 1.3;
    if (deep && this.pos.y < WATER_Y - 0.6) {
      if (!this.swimming) { events.emit('player:swim', { pos: this.pos }); this.parachuteOff(); }
      this.swimming = true;
    } else if (this.swimming && (!deep || this.pos.y > WATER_Y + 0.5)) this.swimming = false;

    const wantSprint = input.down('sprint') && mag > 0.1;
    let speed;
    if (this.swimming) {
      this.crouch = false;
      const canSprint = wantSprint && this.stamina > 1;
      speed = canSprint ? P.swimSprintSpeed : P.swimSpeed;
      this.stamina = clamp(this.stamina - (canSprint ? P.staminaSprintCost : P.staminaSwimCost * 0.3) * dt, 0, P.maxStamina);
      if (this.stamina <= 0) { speed *= 0.6; this.damage(2 * dt, { type: 'drown' }); }
    } else {
      if (input.consume('crouch')) this.crouch = !this.crouch;
      this.sprinting = wantSprint && this.stamina > 1 && !this.crouch && !this.aiming;
      speed = this.crouch ? P.crouchSpeed : this.aiming ? P.walkSpeed * 1.2 : this.sprinting ? P.sprintSpeed : P.runSpeed;
      if (this.sprinting) this.stamina = Math.max(0, this.stamina - P.staminaSprintCost * dt);
      else this.stamina = Math.min(P.maxStamina, this.stamina + P.staminaRegen * dt * (mag < 0.1 ? 1.5 : 1));
      if (this.inCover) speed = P.crouchSpeed;
    }
    // Analoger Stick: langsames Gehen möglich
    const targetVX = wx * speed * mag, targetVZ = wz * speed * mag;
    const accel = this.swimming ? 4 : this.onGround ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, targetVX, accel, dt);
    this.vel.z = damp(this.vel.z, targetVZ, accel, dt);

    // Blickrichtung
    if (this.aiming) this.heading = cam.yaw;
    else if (mag > 0.1) {
      const target = Math.atan2(wx, wz);
      this.heading += angleDiff(this.heading, target) * Math.min(1, dt * 12);
    }

    // Springen / Klettern / Fallschirm (Fallschirm hat eine eigene, frei belegbare Aktion)
    const jumpPressed = input.consume('jump');
    const chutePressed = input.consume('parachute');
    if (jumpPressed || chutePressed) {
      if (this.swimming) this.vel.y = 2;
      else if (this.onGround && jumpPressed) {
        const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
        const probe = col.obstacleTop(this.pos.x + fx * 0.7, this.pos.z + fz * 0.7, 0.3, this.pos.y + 0.3, this.pos.y + P.climbMaxHeight + 0.3);
        if (probe && probe.top - this.pos.y > 0.4 && probe.top - this.pos.y <= P.climbMaxHeight && !probe.obj.ramp) {
          // Über das Hindernis klettern: auf die Oberseite oder dahinter
          const behindX = this.pos.x + fx * 1.6, behindZ = this.pos.z + fz * 1.6;
          const topHere = col.groundHeight(behindX, behindZ, probe.top + 0.1, 0.2).h;
          const to = new THREE.Vector3(behindX, topHere, behindZ);
          const free = col.resolveCircle(to.x, to.z, this.radius, to.y, to.y + this.height, 0.3);
          if (!free.hit || Math.hypot(free.x - to.x, free.z - to.z) < 0.4) {
            this.climb = { from: this.pos.clone(), to: new THREE.Vector3(free.x, topHere, free.z), t: 0, dur: 0.55 };
            this.vel.set(0, 0, 0);
            events.emit('player:climb');
            return;
          }
        }
        this.vel.y = P.jumpSpeed;
        this.onGround = false;
        this.crouch = false;
        events.emit('player:jump');
      } else if (this.hasParachute && !this.parachute && this.airTime > 0.4 && this.pos.y - this.groundBelow() > CONFIG.flight.parachuteDeployHeight) {
        this.parachuteOn();
      }
    }

    // Schwerkraft
    if (this.swimming) {
      const target = WATER_Y - 1.2;
      this.vel.y = damp(this.vel.y, (target - this.pos.y) * 3, 4, dt);
    } else if (this.parachute) {
      this.vel.y = Math.max(this.vel.y - CONFIG.physics.gravity * dt, -CONFIG.flight.parachuteFallSpeed);
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const ps = CONFIG.flight.parachuteSteerSpeed;
      this.vel.x = damp(this.vel.x, fx * ps * (0.5 + Math.max(0, move.y) * 0.8), 1.5, dt);
      this.vel.z = damp(this.vel.z, fz * ps * (0.5 + Math.max(0, move.y) * 0.8), 1.5, dt);
      this.heading += -move.x * dt * 1.2;
    } else this.vel.y -= CONFIG.physics.gravity * dt;

    // Integration
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    // Wände
    const stepUp = this.onGround ? P.stepUp : 0.15;
    const r = col.resolveCircle(this.pos.x, this.pos.z, this.radius, this.pos.y, this.pos.y + (this.crouch ? 1.2 : this.height), stepUp);
    if (r.hit) {
      this.pos.x = r.x; this.pos.z = r.z;
      // Geschwindigkeit in Wandrichtung entfernen
      const vn = this.vel.x * r.nx + this.vel.z * r.nz;
      if (vn < 0) { this.vel.x -= vn * r.nx; this.vel.z -= vn * r.nz; }
    }
    // Dynamische Hindernisse (Fahrzeuge)
    if (g.vehicles) g.vehicles.pushCharacter(this);

    // Boden
    const gh = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.05, this.onGround ? P.stepUp : 0.3);
    const wasOnGround = this.onGround;
    if (this.swimming) {
      this.onGround = false;
      if (gh.h > this.pos.y - 0.2) { this.pos.y = gh.h; this.swimming = false; }
    } else if (this.pos.y <= gh.h + 0.02 || (wasOnGround && this.vel.y <= 0 && this.pos.y - gh.h < 0.45)) {
      if (!wasOnGround) this._land();
      this.pos.y = gh.h;
      this.vel.y = Math.max(0, this.vel.y);
      this.onGround = true;
      this.groundObj = gh.hit;
    } else {
      this.onGround = false;
    }
    if (!this.onGround && !this.swimming) {
      this.airTime += dt;
      this.maxFallSpeed = Math.max(this.maxFallSpeed, -this.vel.y);
    } else {
      this.airTime = 0;
    }
    if (this.onGround && !this.climb) {
      this.lastSafe.copy(this.pos);
      if (this.parachute) this.parachuteOff();
    }

    // Rettung: durch den Boden gefallen / ausserhalb der Welt
    const th = groundTerrain(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y < th - 2.5 && !this.swimming && th > WATER_Y - 1.3) {
      this.pos.y = col.groundHeight(this.pos.x, this.pos.z, th + 2, 0).h + 0.1; // nicht auf ein Dach/den Tunnelberg setzen
      this.vel.y = 0;
    }
    if (this.pos.y < -60) this.teleport(this.lastSafe.x, null, this.lastSafe.z);

    // Steckengeblieben? (Eingabe, aber keine Bewegung über längere Zeit)
    const moved = Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z);
    if (mag > 0.5 && moved < 0.002 && this.onGround) this.stuckTimer += dt; else this.stuckTimer = 0;
    if (this.stuckTimer > 4) { this.pos.x += Math.sin(this.heading) * -1.5; this.pos.z += Math.cos(this.heading) * -1.5; this.stuckTimer = 0; }

    // Animationszustand
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.swimming) this.state = 'swim';
    else if (this.parachute) this.state = 'chute';
    else if (!this.onGround && this.airTime > 0.15) this.state = this.vel.y > 0 ? 'jump' : 'fall';
    else if (hs > 6.5) this.state = 'sprint';
    else if (hs > 3) this.state = 'run';
    else if (hs > 0.3) this.state = 'walk';
    else this.state = 'idle';
    this.speed = hs;
  }

  groundBelow() {
    return this.game.collision.groundHeight(this.pos.x, this.pos.z, this.pos.y, 0).h;
  }

  _land() {
    const v = this.maxFallSpeed;
    this.maxFallSpeed = 0;
    if (v > P.fallDamageMinSpeed && !this.parachute) {
      const dmg = (v - P.fallDamageMinSpeed) * P.fallDamagePerMs;
      this.damage(dmg, { type: 'fall' });
      events.emit('player:land', { hard: true, speed: v });
    } else events.emit('player:land', { hard: false, speed: v });
  }

  parachuteOn() {
    this.parachute = true;
    this.model.setChute(true);
    this.vel.y = Math.max(this.vel.y, -8);
    events.emit('player:parachute');
  }

  parachuteOff() {
    if (!this.parachute) return;
    this.parachute = false;
    this.model.setChute(false);
  }

  /**
   * Schaden nehmen. Rüstung absorbiert 2/3 bis sie aufgebraucht ist.
   * @param {number} amount
   * @param {{type?:string, source?:any, zone?:string, dir?:THREE.Vector3}} info
   */
  damage(amount, info = {}) {
    if (this.dead || this.invulnerable > 0 || this.game.godMode) return;
    if (this.armor > 0 && info.type !== 'fall' && info.type !== 'drown') {
      const absorbed = Math.min(this.armor, amount * 0.66);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.hitFlash = 1;
    if (info.source && info.source.isPlayer !== true) events.emit('player:hurt', { amount, info });
    if (this.health <= 0) this.die(info);
  }

  heal(amount) { this.health = Math.min(P.maxHealth, this.health + amount); }

  die(info = {}) {
    if (this.dead) return;
    this.health = 0;
    this.dead = true;
    this.state = 'dead';
    this.parachuteOff();
    events.emit('player:died', info);
  }

  revive() {
    this.dead = false;
    this.health = P.maxHealth;
    this.stamina = P.maxStamina;
    this.state = 'idle';
    this.invulnerable = 3;
    this.swimming = false;
    this.crouch = false;
  }

  /** Visuelles Update pro Frame (Interpolation + Animation). */
  update(dt, alpha) {
    const m = this.model;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    if (this.vehicle) {
      // Position übernimmt das Fahrzeug (Sitz)
      // In der Ego-/Cockpit-Ansicht die eigene Figur ausblenden (sonst steckt die Kamera im Kopf)
      m.root.visible = this.vehicle.showDriver !== false && this.game.camera3p.mode !== 'first';
      this.vehicle.placeOccupant(this, m.root);
      m.animate(dt, { state: this.vehicle.isBike ? 'sit' : 'sit', speed: 0, aim: this.aiming && this.vehicle.isBike });
      return;
    }
    m.root.visible = true;
    m.root.scale.setScalar(1);
    m.root.position.lerpVectors(this.prevPos, this.pos, alpha);
    m.root.rotation.set(0, this.heading, 0);
    const wpn = this.game.weapons ? this.game.weapons.current(this) : null;
    m.animate(dt, {
      state: this.dead ? 'dead' : this.state,
      speed: this.speed || 0,
      aim: this.aiming && wpn && wpn.def.type !== 'melee',
      aimPitch: this.game.camera3p.pitch,
      crouch: this.crouch || !!this.inCover,
      twoHanded: wpn && ['rifle', 'smg', 'shotgun', 'sniper', 'rocket'].includes(wpn.id),
      recoil: this.game.weapons ? this.game.weapons.recoilAnim : 0,
      melee: this.game.weapons ? this.game.weapons.meleeAnim : 0,
    });
  }
}
