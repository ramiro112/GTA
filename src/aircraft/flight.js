// Flug-System: registriert Luftfahrzeuge beim Fahrzeug-Manager, spawnt abgestellte Maschinen
// (Flughafen, Militär, Dach-Helipads), Bordwaffen, Fluginstrumente, Polizeihubschrauber.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Helicopter, createAircraft } from './aircraft.js';
import { events } from '../core/events.js';
import { t } from '../core/i18n.js';
import { LANDMARKS } from '../world/layout.js';
import { clamp } from '../core/mathutil.js';

export class FlightSystem {
  constructor(game) {
    this.game = game;
    game.flight = this;
    const vm = game.vehicles;
    for (const type of Object.keys(CONFIG.aircraft)) vm.factories[type] = (opts) => createAircraft(game, type, opts);
    // Abgestellte Luftfahrzeuge als feste Parkplätze
    for (const a of game.city.landmarks.parkedAircraft) vm.parkingSpots.push({ x: a.x, z: a.z, heading: a.heading, type: a.type, vehicle: null, cooldown: 0, fixed: true, aircraft: true });
    // Helikopter auf dem Penthouse-Dach
    const ph = LANDMARKS.penthouse;
    vm.parkingSpots.push({ x: ph.x, z: ph.z, y: ph.h, heading: 0, type: 'heliSmall', vehicle: null, cooldown: 0, fixed: true, aircraft: true, owner: 'penthouse' });
    // Polizeihubschrauber bereitstellen
    if (game.police) {
      game.police.spawnHeli = (stars) => this.spawnPoliceHeli(stars);
      game.police.removeHeli = () => this.removePoliceHeli();
    }
    this.instr = null;
  }

  // ------------------------------------------------------------------ Polizeihubschrauber
  spawnPoliceHeli(stars) {
    const g = this.game;
    const p = g.player.pos;
    const a = Math.random() * Math.PI * 2;
    const h = new PoliceHeli(g, stars >= 5 ? 'heliMil' : 'heliSmall', { x: p.x + Math.cos(a) * 160, z: p.z + Math.sin(a) * 160, y: 60 });
    g.vehicles.list.push(h);
    const pilot = g.population.spawn({ kind: stars >= 5 ? 'soldier' : 'cop', x: h.pos.x, z: h.pos.z });
    pilot.vehicle = h; h.driver = pilot; pilot.persistent = true; pilot.despawnable = false;
    pilot.give('rifle', 999);
    events.emit('police:heli', { heli: h });
    g.hud.notify('Polizeihubschrauber im Anflug!');
    return h;
  }

  removePoliceHeli() {
    const g = this.game;
    const h = g.police.heli;
    if (!h) return;
    if (h.driver && !h.driver.isPlayer) { const d = h.driver; h.driver = null; d.vehicle = null; g.population.remove(d); }
    g.vehicles.remove(h);
    g.police.heli = null;
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    const v = pl.vehicle;
    if (v && v.isAircraft && !g.paused && !pl.dead) v.fireWeapons(dt, g.input);
    // Polizeihubschrauber entfernen, wenn keine Fahndung mehr
    const h = g.police && g.police.heli;
    if (h && (g.police.stars < CONFIG.police.helicopterFrom - 1 || h.removed) && (h.pos.distanceTo(pl.pos) > 200 || g.police.stars === 0)) this.removePoliceHeli();
    this._instruments(v);
  }

  _instruments(v) {
    const hud = this.game.hud;
    if (!hud) return;
    const el = hud.el.instruments;
    if (!v || !v.isAircraft) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    hud.el.speedo.classList.add('hidden');
    const alt = v.altitude, spd = v.vel.length() * 3.6, vs = v.vel.y;
    const hdg = ((-v.heading * 180 / Math.PI) + 180 + 360) % 360; // 0 = Norden
    const pitch = v.pitchAngle * 180 / Math.PI, roll = v.rollAngle * 180 / Math.PI;
    const isPlane = v.kind2 === 'plane';
    const thr = isPlane ? v.throttle : (v.sim ? v.collectiveLevel / 1.8 : (v.controls.up ? 1 : v.controls.down ? 0 : 0.5));
    const cells = [
      [t('hud.alt'), `${alt.toFixed(0)} m`], [t('hud.spd'), `${spd.toFixed(0)} km/h`], [t('hud.vs'), `${vs >= 0 ? '+' : ''}${vs.toFixed(1)}`],
      [t('hud.hdg'), `${hdg.toFixed(0).padStart(3, '0')}°`], [t('hud.throttle'), `${Math.round(thr * 100)}%`], [t('hud.fuel'), `${Math.round(v.fuel / v.maxFuel * 100)}%`],
    ];
    if (isPlane) cells.push([t('hud.gear'), v.gearDown ? t('hud.down') : t('hud.up')], [t('hud.flaps'), ['0', '1', '2'][v.flaps]], ['Status', v.stalled ? '<span style="color:#ff3b30">STALL</span>' : 'OK']);
    else cells.push(['Rotor', `${Math.round(v.rotor * 100)}%`], ['Modus', v.sim ? 'SIM' : 'ARCADE'], ['Zustand', `${Math.max(0, Math.round(v.health / v.maxHealth * 100))}%`]);
    const html = `<div class="instr" style="grid-column: span 3"><div id="horizon"><div class="sky" style="transform: rotate(${-roll}deg) translateY(${clamp(pitch, -45, 45) * 1.2}px)"></div><div class="mark"></div></div></div>` +
      cells.map(([l, val]) => `<div class="instr"><div class="l">${l}</div><div class="v">${val}</div></div>`).join('');
    el.innerHTML = html;
  }
}

/** KI-Polizeihubschrauber: kreist über dem Spieler, Suchscheinwerfer, Schütze ab 4 Sternen. */
class PoliceHeli extends Helicopter {
  constructor(game, type, opts) {
    super(game, type, opts);
    this.setColor(type === 'heliMil' ? 0x3b4a2f : 0x1f3a6b);
    this.rotor = 1;
    this.pos.y = opts.y;
    this.prevPos.copy(this.pos);
    this.policeHeli = true;
    this.persistent = true;
    this.orbit = Math.random() * 6;
    this.fireT = 0;
    const spot = new THREE.SpotLight(0xffffff, 0, 120, 0.22, 0.5, 1);
    spot.position.set(0, -1, 1);
    this.mesh.add(spot);
    this.mesh.add(spot.target);
    this.spot = spot;
  }

  fixedUpdate(dt) {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const g = this.game;
    if (this.destroyed || !this.driver || this.driver.dead) {
      // Absturz
      this.vel.y -= CONFIG.physics.gravity * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * 3));
      const gh = g.collision.groundHeight(this.pos.x, this.pos.z, this.pos.y, 1).h;
      if (this.pos.y + this.model.bottom < gh) { this.pos.y = gh - this.model.bottom; this.vel.set(0, 0, 0); if (!this.destroyed) this.explode(this.lastAttacker); }
      this._status(dt);
      return;
    }
    const pl = g.player;
    const tp = pl.vehicle ? pl.vehicle.pos : pl.pos;
    this.orbit += dt * 0.25;
    const pol = g.police;
    const target = pol && pol.searching && pol.wanted.lastSeen ? new THREE.Vector3(pol.wanted.lastSeen.x, 0, pol.wanted.lastSeen.z) : tp;
    const ground = Math.max(0, g.collision.groundHeight(target.x, target.z, 400, 0).h);
    const want = new THREE.Vector3(target.x + Math.cos(this.orbit) * 30, Math.max(ground, tp.y) + 38, target.z + Math.sin(this.orbit) * 30);
    const to = want.sub(this.pos);
    const desiredVel = to.multiplyScalar(0.6).clampLength(0, 45);
    const acc = desiredVel.sub(this.vel).clampLength(0, 12);
    this.vel.addScaledVector(acc, dt);
    this.pos.addScaledVector(this.vel, dt);
    // Ausrichtung: zum Spieler blicken, in Flugrichtung neigen
    const yaw = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
    const e = new THREE.Euler(clamp(acc.dot(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))) * 0.04, -0.3, 0.3), yaw, 0, 'YXZ');
    this.quat.slerp(new THREE.Quaternion().setFromEuler(e), Math.min(1, dt * 2));
    // Suchscheinwerfer
    const night = g.tod.night;
    this.spot.intensity = night > 0.3 ? 400 * night : 0;
    this.spot.target.position.copy(this.mesh.worldToLocal(tp.clone()));
    // Schütze ab 4 Sternen
    this.fireT -= dt;
    if (pol && pol.stars >= 4 && this.fireT <= 0 && !pl.dead && this.pos.distanceTo(tp) < 90) {
      this.fireT = 0.25;
      const muzzle = this.pos.clone().add(new THREE.Vector3(0, -1.5, 0));
      const aim = tp.clone().add(new THREE.Vector3(0, 1, 0)).sub(muzzle).normalize();
      const miss = Math.random() > CONFIG.police.copAccuracy[pol.stars - 1] * 0.6;
      if (miss) aim.add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15)).normalize();
      g.weapons.fireRay(this.driver, muzzle, aim, CONFIG.weapons.mg, muzzle);
      events.emit('weapon:fired', { shooter: this.driver, pos: muzzle, weapon: 'mg' });
    }
    this._status(dt);
  }

  playerInput() {}
}
