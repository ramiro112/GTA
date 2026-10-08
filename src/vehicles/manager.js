// Fahrzeug-System: verwaltet alle Fahrzeuge (Autos, Motorräder, Boote, Luftfahrzeuge),
// Streaming geparkter Autos, Ein-/Aussteigen, Stehlen (Fahrer herausziehen, Scheibe einschlagen,
// Kurzschliessen, Alarm), Fahrersteuerung, Kollisionen Fahrzeug↔Fahrzeug und Fahrzeug↔Figur.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Vehicle } from './vehicle.js';
import { events } from '../core/events.js';
import { t } from '../core/i18n.js';
import { Random } from '../core/random.js';
import { Boat, BOAT_SPOTS } from './boat.js';

const VC = CONFIG.vehicleCommon;
const PARKED_TYPES = ['compact', 'compact', 'sedan', 'sedan', 'sedan', 'suv', 'sports', 'taxi', 'motorbike', 'compact', 'sedan', 'suv'];

export class VehicleManager {
  constructor(game) {
    this.game = game;
    game.vehicles = this;
    this.list = [];
    this.parkingSpots = [];
    this.rng = new Random(321);
    this.enterState = null;   // laufender Einstiegs-/Stehlvorgang
    this.factories = {};      // weitere Fahrzeugarten (Boot, Heli, Flugzeug) registrieren sich hier
    this.factories.speedboat = (opts) => new Boat(game, 'speedboat', opts);
    this._initParking();
    for (const b of BOAT_SPOTS) this.parkingSpots.push({ ...b, type: 'speedboat', vehicle: null, cooldown: 0, fixed: true });
    this.debris = [];
  }

  _initParking() {
    const L = this.game.layout;
    for (const p of L.parking) this.parkingSpots.push({ x: p.x, z: p.z, heading: p.heading, type: null, vehicle: null, cooldown: 0 });
    const lm = this.game.city.landmarks;
    for (const p of lm.parkedVehicles) this.parkingSpots.push({ x: p.x, z: p.z, y: p.y, heading: p.heading, type: p.type === 'random' ? null : p.type, vehicle: null, cooldown: 0, fixed: p.type !== 'random' });
    // Zusätzliche Parkplätze am Strassenrand
    const rng = new Random(77);
    for (const e of this.game.roads.edges) {
      if (e.kind !== 'street' || e.length < 60) continue;
      for (let s = 25; s < e.length - 25; s += 40) {
        if (!rng.chance(0.3)) continue;
        const a = e.points[0], b = e.points[e.points.length - 1];
        const t = s / e.length;
        const dx = (b.x - a.x) / e.length, dz = (b.z - a.z) / e.length;
        const side = rng.chance(0.5) ? 1 : -1;
        const off = CONFIG.world.parkOffset * side;
        this.parkingSpots.push({ x: a.x + (b.x - a.x) * t - dz * off, z: a.z + (b.z - a.z) * t + dx * off, heading: Math.atan2(dx * side, dz * side), type: null, vehicle: null, cooldown: 0 });
      }
    }
  }

  /** Fahrzeug erzeugen (Bodenfahrzeug oder registrierter Typ). */
  spawn(type, opts = {}) {
    let v;
    if (CONFIG.vehicles[type]) v = new Vehicle(this.game, type, opts);
    else if (this.factories[type]) v = this.factories[type](opts);
    else throw new Error('Unbekannter Fahrzeugtyp ' + type);
    this.list.push(v);
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    if (v.driver && v.driver.isPlayer) return; // nie mit Spieler entfernen
    if (v.driver && v.driver.onVehicleRemoved) v.driver.onVehicleRemoved();
    v.remove();
    for (const s of this.parkingSpots) if (s.vehicle === v) s.vehicle = null;
  }

  // ------------------------------------------------------------------ Streaming geparkter Autos
  _streamParking(dt) {
    const p = this.game.player.pos;
    for (const s of this.parkingSpots) {
      // Luftfahrzeuge schon aus grösserer Entfernung zeigen (sichtbar von Weitem)
      const near = s.aircraft ? 380 : 150, far = s.aircraft ? 450 : 210;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (s.cooldown > 0) s.cooldown -= dt;
      if (!s.vehicle && d < near && d > 40 && s.cooldown <= 0) {
        const type = s.type || PARKED_TYPES[this.rng.int(0, PARKED_TYPES.length - 1)];
        const v = this.spawn(type, { x: s.x, z: s.z, heading: s.heading, y: s.y });
        v.parkedSpot = s;
        v.spawnPos = v.pos.clone();
        if (s.fixed) v.locked = false;
        // Frei nutzbare Maschinen (Flugschule) bzw. Heli auf dem eigenen Penthouse: kein Diebstahl
        if (s.free || (s.owner && this.game.economy.ownedProperties.has(s.owner))) v.freeUse = true;
        s.vehicle = v;
      } else if (s.vehicle && d > far) {
        const v = s.vehicle;
        const moved = v.spawnPos ? v.pos.distanceTo(v.spawnPos) > 3 : true;
        if (v.driver || v.persistent || v.owned) { s.vehicle = null; continue; }
        if (!moved) { this.remove(v); s.vehicle = null; }
        else { s.vehicle = null; s.cooldown = 60; }
      }
    }
    // Herrenlose, weit entfernte Fahrzeuge aufräumen
    for (const v of [...this.list]) {
      if (v.persistent || v.owned || v.driver || v.parkedSpot?.vehicle === v || v.ai) continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      if (d > 260 || (v.destroyed && d > 80 && this.game.elapsed - v.destroyedAt > 30)) this.remove(v);
    }
  }

  // ------------------------------------------------------------------ Schleifen
  fixedUpdate(dt) {
    const pl = this.game.player;
    if (pl.vehicle && !this.game.paused && !this.enterState) {
      // Toter Fahrer steuert nicht mehr: Fahrzeug rollt aus
      if (pl.dead) { const c = pl.vehicle.controls; c.throttle = 0; c.brake = 0; c.steer = 0; c.up = false; c.down = false; c.pitch = 0; c.roll = 0; c.yaw = 0; }
      else this._driveInput(pl.vehicle);
    }
    for (const v of this.list) v.fixedUpdate(dt);
    this._vehicleCollisions();
    if (pl.vehicle) pl.syncToVehicle();
  }

  update(dt) {
    const g = this.game;
    this._streamParking(dt);
    this._enterLogic(dt);
    const night = g.tod.night;
    for (const v of this.list) v.updateVisual(dt, 1, night);
    // Echter Scheinwerfer-Lichtkegel nur für das Spielerfahrzeug (Performance)
    if (!this.headlight) {
      this.headlight = new THREE.SpotLight(0xfff2d0, 0, 70, 0.55, 0.45, 1.2);
      g.scene.add(this.headlight); g.scene.add(this.headlight.target);
    }
    const pv = g.player.vehicle;
    const hl = this.headlight;
    if (pv && !pv.destroyed && (night > 0.35 || pv.lightsOn || g.weather.state.fog > 0.6) && !pv.isBoat) {
      const f = pv.forward;
      hl.position.copy(pv.renderPos || pv.pos).addScaledVector(f, (pv.size ? pv.size[2] / 2 : 2) + 0.3).add(new THREE.Vector3(0, 0.3, 0));
      hl.target.position.copy(hl.position).addScaledVector(f, 20).add(new THREE.Vector3(0, -2.5, 0));
      hl.intensity = 220;
    } else hl.intensity = 0;
    // Spieler im Fahrzeug: Hupe, Licht, Sirene, Kamera, Reset, Aussteigen
    const pl = g.player;
    const v = pl.vehicle;
    if (v && !this.enterState && !pl.dead) {
      const inp = g.input;
      v.horn = inp.down('horn');
      if (inp.pressed('lights')) v.lightsOn = !v.lightsOn;
      if (inp.pressed('siren') && v.def && v.def.siren) { v.sirenOn = !v.sirenOn; events.emit('vehicle:siren', { vehicle: v, on: v.sirenOn }); }
      if (inp.pressed('camera')) g.camera3p.toggleMode();
      if (inp.pressed('resetVehicle') && !v.isAircraft) {
        if (v.flipTimer > 0.5 || (v.speedKmh < 5 && (v.up.y < 0.6 || this._stuckTimer > 2))) v.resetUpright(true);
        else if (v.speedKmh < 3) v.resetUpright(true);
      }
      if (inp.pressed('enterVehicle')) this.exitVehicle(pl);
      if (v.flipTimer > 1.5) g.hud.prompt(`<kbd>${inp.labelFor('resetVehicle')}</kbd> Fahrzeug aufrichten`);
      // Statistik
      if (!v.isAircraft) g.stats.distanceCar += Math.abs(v.speed) * dt;
      if (v.submerged > 0.8 && !v.isBoat) this.exitVehicle(pl, true);
    }
    for (const v of this.list) {
      // Wracks im Wasser versenken
      if (v.submerged > 0.9 && !v.isBoat && !v.driver) v.health -= dt * 50;
    }
  }

  // ------------------------------------------------------------------ Fahren
  _driveInput(v) {
    const inp = this.game.input;
    if (v.isAircraft) { if (v.playerInput) v.playerInput(inp); return; }
    const pad = inp.hasGamepad;
    const move = inp.moveAxes();
    let throttle = Math.max(0, move.y), brake = Math.max(0, -move.y);
    if (pad) { throttle = Math.max(throttle, inp.padTriggers[1]); brake = Math.max(brake, inp.padTriggers[0]); }
    // Beim Zielen aus dem Auto (Drive-by) bleiben W/S Gas/Bremse
    v.controls.throttle = throttle;
    v.controls.brake = brake;
    v.controls.steer = move.x;
    v.controls.handbrake = inp.down('handbrake');
    if (throttle > 0 || brake > 0 || move.x) v.wake();
  }

  // ------------------------------------------------------------------ Einsteigen / Stehlen
  /** Nächstes Fahrzeug in Reichweite der Spielfigur. */
  nearestEnterable(pos, maxD = CONFIG.player.enterVehicleDistance) {
    let best = null, bd = maxD;
    for (const v of this.list) {
      if (v.destroyed || (v.driver && v.driver.isPlayer)) continue;
      const half = v.size ? Math.max(v.size[0], v.size[2]) / 2 : 2;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) - half * 0.7;
      if (Math.abs(v.pos.y - pos.y) > 4) continue;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  _enterLogic(dt) {
    const g = this.game;
    const pl = g.player;
    const inp = g.input;
    const st = this.enterState;
    if (pl.dead) { this.enterState = null; g.hud.progress(null); return; }
    if (st) {
      // Abbruch durch Bewegung
      const m = inp.moveAxes();
      const abortMove = st.phase === 'walk' && st.t > 0.15 && Math.abs(m.x) + Math.abs(m.y) > 0.5;
      if (abortMove || st.vehicle.destroyed || (st.phase !== 'hotwire' && st.vehicle.driver && st.vehicle.driver.isPlayer)) {
        if (st.phase === 'hotwire' && pl.vehicle) this.exitVehicle(pl, true);
        this.enterState = null; g.hud.progress(null); return;
      }
      st.t += dt;
      // Zur Tür gehen
      const door = st.vehicle.doorPos(-1);
      if (st.phase !== 'hotwire') {
        pl.pos.x += (door.x - pl.pos.x) * Math.min(1, dt * 8);
        pl.pos.z += (door.z - pl.pos.z) * Math.min(1, dt * 8);
        pl.heading = Math.atan2(st.vehicle.pos.x - pl.pos.x, st.vehicle.pos.z - pl.pos.z);
        pl.state = st.phase === 'break' || st.phase === 'jack' ? 'punch' : 'walk';
      }
      if (st.phase === 'walk' && st.t > 0.35) this._nextPhase(st);
      else if (st.phase === 'jack' && st.t > 1.0) { this._jackDriver(st.vehicle); st.t = 0; this._seatPlayer(st.vehicle); }
      else if (st.phase === 'break' && st.t > 0.7) {
        st.vehicle.windowBroken = true;
        events.emit('vehicle:windowSmash', { vehicle: st.vehicle });
        if (g.fx) g.fx.sparks(st.vehicle.doorPos(-1).add(new THREE.Vector3(0, 1.2, 0)), 10, 0xcfe8ff);
        if (st.vehicle.hasAlarm) {
          st.vehicle.alarmTimer = VC.alarmDuration;
          g.hud.notify(t('hud.alarm'));
          events.emit('crime', { type: 'carAlarm', pos: st.vehicle.pos.clone(), vehicle: st.vehicle });
        } else g.hud.notify(t('hud.locked'));
        st.phase = 'hotwire'; st.t = 0;
      } else if (st.phase === 'hotwire') {
        pl.vehicle = st.vehicle; // sitzt schon drin
        st.vehicle.driver = pl;
        pl.seat = 0;
        const dur = st.vehicle.locked ? VC.stealHotwireTime : VC.stealHotwireTime * 0.5;
        g.hud.progress(t('hud.hotwire'), Math.min(1, st.t / dur));
        st.vehicle.controls.throttle = 0;
        if (st.t >= dur) {
          st.vehicle.hotwired = true;
          g.hud.progress(null);
          this.enterState = null;
          this._seatPlayer(st.vehicle);
        }
      }
      return;
    }
    if (pl.vehicle) { g.hud.prompt(null); return; }
    // Hinweis + Start
    const v = this.nearestEnterable(pl.pos);
    if (v && !g.interactPromptActive) {
      const k = inp.labelFor('enterVehicle');
      const msg = v.driver && !v.driver.isPlayer ? t('hud.jack', { key: `<kbd>${k}</kbd>` }) : (!v.owned && !v.hotwired && v.kind !== 'aircraft' && v.locked && !v.windowBroken) ? t('hud.steal', { key: `<kbd>${k}</kbd>` }) : t('hud.enter', { key: `<kbd>${k}</kbd>` });
      const pass = v.driver && !v.driver.isPlayer && (v.def && v.def.taxi) ? ` · <kbd>${inp.labelFor('passenger')}</kbd> Mitfahren` : '';
      g.hud.prompt(msg + pass);
      if (inp.pressed('enterVehicle')) this.beginEnter(v);
      else if (pass && inp.pressed('passenger') && g.taxi) g.taxi.enterAsPassenger(v);
    } else if (!g.interactPromptActive) g.hud.prompt(null);
  }

  beginEnter(v) {
    this.enterState = { vehicle: v, t: 0, phase: 'walk' };
    v.wake();
  }

  _nextPhase(st) {
    const v = st.vehicle;
    st.t = 0;
    if (v.driver && !v.driver.isPlayer) { st.phase = 'jack'; return; }
    if (v.owned || v.hotwired || v.kind === 'aircraft' || v.isBoat || v.missionVehicle) { this._seatPlayer(v); this.enterState = null; return; }
    if (v.locked && !v.windowBroken) { st.phase = 'break'; return; }
    st.phase = 'hotwire';
  }

  _jackDriver(v) {
    const d = v.driver;
    v.driver = null;
    if (d && d.onJacked) d.onJacked(v, this.game.player);
    events.emit('crime', { type: 'stealCar', pos: v.pos.clone(), vehicle: v, jacked: true });
    if (v.def && v.def.emergency === 'police') events.emit('crime', { type: 'assaultCop', pos: v.pos.clone() });
    v.hotwired = true;
  }

  _seatPlayer(v) {
    const pl = this.game.player;
    this.enterState = null;
    this.game.hud.progress(null);
    pl.vehicle = v;
    pl.seat = 0;
    pl.parachuteOff();
    pl.crouch = false;
    pl.swimming = false;
    v.driver = pl;
    v.ai = null;
    v.wake();
    if (!v.owned && !v.missionVehicle && !v.freeUse && !v.stolenCounted) {
      v.stolen = true;
      v.stolenCounted = true;
      this.game.stats.carsStolen++;
      events.emit('vehicle:stolen', { vehicle: v });
      if (!v.jackedReported) events.emit('crime', { type: v.kind === 'aircraft' ? 'stealAircraft' : 'stealCar', pos: v.pos.clone(), vehicle: v, quiet: !v.windowBroken });
    }
    events.emit('vehicle:enter', { vehicle: v });
    if (v.parkedSpot) { v.parkedSpot.vehicle = null; v.parkedSpot.cooldown = 120; v.parkedSpot = null; }
  }

  /** Aussteigen (oder Abspringen bei hoher Geschwindigkeit). */
  exitVehicle(pl, force = false) {
    const v = pl.vehicle;
    if (!v) return;
    if (v.isAircraft && v.exitAircraft && !force) { v.exitAircraft(pl); return; }
    v.driver = null;
    pl.vehicle = null;
    v.controls.throttle = 0; v.controls.brake = 0; v.controls.handbrake = !v.isAircraft;
    v.sirenOn = v.sirenOn && v.def && v.def.emergency ? v.sirenOn : false;
    const fast = Math.abs(v.speed || 0) > 6;
    let exit = v.doorPos(-1);
    const col = this.game.collision;
    let ok = !col.resolveCircle(exit.x, exit.z, 0.4, exit.y + 0.3, exit.y + 1.8).hit;
    if (!ok) { exit = v.doorPos(1); ok = !col.resolveCircle(exit.x, exit.z, 0.4, exit.y + 0.3, exit.y + 1.8).hit; }
    if (!ok && !v.isBoat) exit = v.pos.clone().add(new THREE.Vector3(0, (v.size ? v.size[1] : 2) + 0.2, 0));
    pl.teleport(exit.x, Math.max(exit.y, col.groundHeight(exit.x, exit.z, exit.y + 1.5, 1.5).h), exit.z, v.heading);
    if (fast) {
      pl.vel.copy(v.vel).multiplyScalar(0.6);
      pl.vel.y = 3;
      pl.onGround = false;
      pl.damage(Math.min(30, Math.abs(v.speed) * 0.8), { type: 'fall' });
    }
    if (this.game.camera3p.mode === 'first') this.game.camera3p.mode = 'third';
    events.emit('vehicle:exit', { vehicle: v });
  }

  /** Motorradfahrer fliegt bei hartem Aufprall vom Bike. */
  ejectFromBike(v, speed) {
    const d = v.driver;
    if (!d) return;
    if (d.isPlayer) {
      this.exitVehicle(d, true);
      d.vel.copy(v.vel).multiplyScalar(0.8);
      d.vel.y = 4;
      d.damage(speed * 1.2, { type: 'crash' });
    } else if (d.onJacked) {
      v.driver = null;
      d.onJacked(v, null);
    }
  }

  killOccupants(v, source) {
    const d = v.driver;
    if (!d) return;
    if (d.isPlayer) { this.exitVehicle(d, true); d.damage(500, { type: 'explosion', source }); }
    else if (d.die) { v.driver = null; d.die({ type: 'explosion', source }); }
  }

  onPlayerDamaged(v, info) {
    v.lastAttacker = info.source;
  }

  // ------------------------------------------------------------------ Kollisionen
  _vehicleCollisions() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.size) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.size) continue;
        if (a.sleeping && b.sleeping) continue;
        const ra = Math.max(a.size[0], a.size[2]) / 2, rb = Math.max(b.size[0], b.size[2]) / 2;
        const dx0 = b.pos.x - a.pos.x, dz0 = b.pos.z - a.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > (ra + rb) ** 2) continue;
        if (Math.abs(a.pos.y - b.pos.y) > Math.max(a.size[1], b.size[1])) continue;
        this._collidePair(a, b);
      }
    }
  }

  _circles(v) {
    const [W, , Ln] = v.size;
    const n = Math.max(2, Math.round(Ln / W));
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(v.quat);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * (Ln - W);
      out.push({ x: v.pos.x + f.x * t, z: v.pos.z + f.z * t, r: W / 2 });
    }
    return out;
  }

  _collidePair(a, b) {
    const ca = this._circles(a), cb = this._circles(b);
    for (const p of ca) {
      for (const q of cb) {
        const dx = q.x - p.x, dz = q.z - p.z;
        const d = Math.hypot(dx, dz);
        const minD = p.r + q.r;
        if (d >= minD || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d;
        const pen = minD - d;
        const ma = a.mass, mb = b.mass;
        const wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa;
        b.pos.x += nx * pen * wb; b.pos.z += nz * pen * wb;
        const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rv < 0) {
          const e = 0.3;
          const jimp = -(1 + e) * rv / (1 / ma + 1 / mb);
          a.vel.x -= (jimp / ma) * nx; a.vel.z -= (jimp / ma) * nz;
          b.vel.x += (jimp / mb) * nx; b.vel.z += (jimp / mb) * nz;
          a.wake(); b.wake();
          const sp = -rv;
          a.onImpact(sp * Math.min(1.5, mb / ma), null, b);
          b.onImpact(sp * Math.min(1.5, ma / mb), null, a);
          events.emit('vehicle:collide', { a, b, speed: sp });
        }
        return;
      }
    }
  }

  /** Spielfigur/Fussgänger aus Fahrzeugen herausdrücken; Anfahren erkennen. */
  pushCharacter(ch) {
    for (const v of this.list) {
      if (!v.size || v.driver === ch) continue;
      if (ch.ignoreVehicle === v && this.game.elapsed < ch.ignoreVehicleUntil) continue; // gerade abgesprungen
      const dx = ch.pos.x - v.pos.x, dz = ch.pos.z - v.pos.z;
      const big = Math.max(v.size[0], v.size[2]) / 2 + 1;
      if (dx * dx + dz * dz > big * big) continue;
      const vBottom = v.pos.y - (v.comHeight || 1);
      const vTop = vBottom + v.size[1];
      if (ch.pos.y > vTop - 0.3 || ch.pos.y + 1.7 < vBottom) {
        // auf dem Dach stehen
        if (ch.pos.y > vTop - 0.6 && ch.pos.y < vTop + 0.5 && this._insideOBB(v, ch.pos.x, ch.pos.z, 0)) { ch.pos.y = Math.max(ch.pos.y, vTop); ch.vel.y = Math.max(0, ch.vel.y); ch.onGround = true; }
        continue;
      }
      // In lokale Koordinaten
      const inv = v.quat.clone().invert();
      const lp = new THREE.Vector3(dx, 0, dz).applyQuaternion(inv);
      const hx = v.size[0] / 2 + ch.radius, hz = v.size[2] / 2 + ch.radius;
      if (Math.abs(lp.x) >= hx || Math.abs(lp.z) >= hz) continue;
      const px = hx - Math.abs(lp.x), pz = hz - Math.abs(lp.z);
      if (px < pz) lp.x = Math.sign(lp.x || 1) * hx; else lp.z = Math.sign(lp.z || 1) * hz;
      const wp = lp.applyQuaternion(v.quat);
      const relSpeed = Math.hypot(v.vel.x - (ch.vel ? ch.vel.x : 0), v.vel.z - (ch.vel ? ch.vel.z : 0));
      ch.pos.x = v.pos.x + wp.x;
      ch.pos.z = v.pos.z + wp.z;
      if (relSpeed > 4 && v.vel.length() > 3) this.hitCharacter(v, ch, relSpeed);
    }
  }

  _insideOBB(v, x, z, pad) {
    const inv = v.quat.clone().invert();
    const lp = new THREE.Vector3(x - v.pos.x, 0, z - v.pos.z).applyQuaternion(inv);
    return Math.abs(lp.x) < v.size[0] / 2 + pad && Math.abs(lp.z) < v.size[2] / 2 + pad;
  }

  /** Fahrzeug fährt Figur an. */
  hitCharacter(v, ch, speed) {
    if (ch.hitCooldown && this.game.elapsed - ch.hitCooldown < 0.8) return;
    ch.hitCooldown = this.game.elapsed;
    const dmg = speed * speed * 0.35;
    const dir = v.vel.clone().setY(0).normalize();
    if (ch.knockback) ch.knockback(dir.clone().multiplyScalar(speed * 0.7).setY(Math.min(6, speed * 0.4)));
    else if (ch.vel) { ch.vel.copy(dir.multiplyScalar(speed * 0.6)); ch.vel.y = Math.min(6, speed * 0.3); ch.onGround = false; }
    const source = v.driver || null;
    if (ch.damage) ch.damage(dmg, { type: 'vehicle', source, vehicle: v });
    v.vel.multiplyScalar(0.94);
    events.emit('character:runOver', { vehicle: v, character: ch, speed, source });
  }

  /** Zerstörbares Requisit umgefahren. */
  onPropHit(v, box, impact) {
    const rec = this.game.city.breakProp(box.prop);
    if (!rec) return;
    events.emit('prop:broken', { prop: rec, vehicle: v });
    if (this.game.debris) this.game.debris.spawn(rec, v.vel.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 3 + impact * 0.2, 0)));
    if (rec.type === 'hydrant' && this.game.fx) this.game.fx.splash(new THREE.Vector3(rec.x, 0.5, rec.z), 30);
    if (box.explosive && this.game.combat) this.game.combat.explodeProp(box);
  }

  /** Blips für Minimap: eigenes Fahrzeug, Missionsfahrzeuge. */
  mapBlips(out) {
    for (const v of this.list) {
      if (v.owned && !(v.driver && v.driver.isPlayer)) out.push({ x: v.pos.x, z: v.pos.z, color: '#4cd964', size: 6 });
      if (v.blip) out.push({ x: v.pos.x, z: v.pos.z, ...v.blip, edge: true });
    }
  }
}
