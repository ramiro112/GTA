// Polizei-System: nimmt Verbrechen wahr (eigene Sicht, Zeugenmeldungen), verwaltet die Fahndung,
// schickt Einheiten je nach Stufe: Streife zu Fuss (1), Streifenwagen (1–2), Strassensperren und
// Nagelbänder (3), Hubschrauber (3+), SEK (4), Militär (5). Sichtlinie, Suchgebiet, Festnahme.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WantedLevel } from './wanted.js';
import { CombatBrain } from '../ai/brains.js';
import { events } from '../core/events.js';
import { Random } from '../core/random.js';
import { clamp } from '../core/mathutil.js';

const PC = CONFIG.police;

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    game.police = this;
    this.wanted = new WantedLevel();
    this.rng = new Random(112);
    this.cars = [];        // {v, crew, deployed}
    this.cops = [];        // NPCs der Fahndung
    this.roadblocks = [];  // {cars, cops, spike, pos}
    this.spikes = [];
    this.playerSeen = false;
    this.seeTimer = 0;
    this.spawnTimer = 0;
    this.roadblockTimer = 10;
    this.bustTimer = 0;
    this.hostileToPolice = false;
    this.lastVehicle = null;
    this.changedCarCredit = new Set();
    this.disabled = false;
    events.on('crime', (c) => this.onCrime(c));
    events.on('witness:report', (e) => this.onWitness(e));
    events.on('npc:killed', (e) => this._onKill(e));
    events.on('npc:damaged', (e) => this._onDamage(e));
    events.on('character:runOver', (e) => { if (e.source && e.source.isPlayer && !e.character.isPlayer) this._crimeFromPlayer(e.character.faction === 'police' ? 'assaultCop' : 'hitPed', e.character.pos); });
    events.on('player:respawn', () => this.reset());
  }

  get stars() { return this.wanted.stars; }
  get searching() { return this.wanted.searching && this.stars > 0; }
  get characters() { return []; }

  // ------------------------------------------------------------------ Verbrechen
  _crimeFromPlayer(type, pos) { events.emit('crime', { type, pos: pos.clone() }); }

  _onKill(e) {
    const s = e.info.source;
    if (!s || !s.isPlayer) return;
    const cop = e.npc.faction === 'police' || e.npc.faction === 'military';
    if (cop) this.hostileToPolice = true;
    if (e.npc.gangGroup && !cop) { this._crimeFromPlayer('killPed', e.npc.pos); return; }
    this._crimeFromPlayer(cop ? 'killCop' : 'killPed', e.npc.pos);
  }

  _onDamage(e) {
    const s = e.info.source;
    if (!s || !s.isPlayer || e.npc.dead) return;
    if (e.npc.faction === 'police' || e.npc.faction === 'military') { this.hostileToPolice = true; this._crimeFromPlayer('assaultCop', e.npc.pos); }
  }

  onCrime(c) {
    if (this.disabled || this.game.player.dead) return;
    const m = this.game.missions && this.game.missions.active;
    if (m && m.noPolice) return;
    const pos = c.pos || this.game.player.pos;
    if (c.byGuard) {
      this.wanted.ensureStars(c.zone === 'military' ? 4 : 2, pos);
      if (c.zone === 'military') this.hostileToPolice = true;
      return;
    }
    const direct = c.type === 'assaultCop' || c.type === 'killCop' || this.copSees(pos);
    // Gestohlenes Fahrzeug gilt als gemeldet, wenn Polizei es sieht, der Alarm losging oder der Fahrer herausgezerrt wurde
    if (c.vehicle && (direct || c.type === 'carAlarm' || c.jacked)) c.vehicle.reported = true;
    if (direct) {
      const r = this.wanted.addCrime(c.type, this.game.player.pos);
      if (r.after > r.before) events.emit('wanted:up', { stars: r.after });
    }
  }

  onWitness(e) {
    if (this.disabled || this.game.player.dead) return;
    if (e.crime.vehicle) e.crime.vehicle.reported = true;
    const r = this.wanted.addCrime(e.crime.type, e.crime.pos, 0.75);
    if (r.after > r.before) {
      events.emit('wanted:up', { stars: r.after, witness: true });
      if (this.game.hud) this.game.hud.notify('Ein Zeuge hat die Polizei gerufen!');
    }
    // Zuletzt bekannte Position = Tatort (nicht die aktuelle Spielerposition)
    this.wanted.lastSeen = { x: e.crime.pos.x, z: e.crime.pos.z };
  }

  /** Sieht irgendein Polizist / Soldat diesen Punkt? */
  copSees(pos, range = PC.sightRange) {
    for (const ch of this.game.allCharacters()) {
      if (ch.dead || ch.isPlayer) continue;
      if (ch.faction !== 'police' && ch.faction !== 'military') continue;
      const p = ch.vehicle ? ch.vehicle.pos : ch.pos;
      if (Math.hypot(p.x - pos.x, p.z - pos.z) > range) continue;
      if (ch.vehicle ? true : ch.canSee(pos, range)) return true;
    }
    if (this.heli && !this.heli.destroyed && this.heli.pos.distanceTo(pos) < 170) return true;
    return false;
  }

  // ------------------------------------------------------------------ Schleife
  update(dt) {
    const g = this.game;
    const pl = g.player;
    if (pl.dead) return;
    const ppos = pl.vehicle ? pl.vehicle.pos : pl.pos;
    // Sichtprüfung gedrosselt
    this.seeTimer -= dt;
    if (this.seeTimer <= 0) {
      this.seeTimer = 0.3;
      this.playerSeen = this.stars > 0 && this.copSees(ppos);
      // Gemeldetes gestohlenes Auto erkennen
      const v = pl.vehicle;
      if (v && v.stolen && v.reported && this.stars === 0 && this.copSees(ppos, PC.stolenCarRecognition)) {
        this.wanted.addCrime('stealCar', ppos);
        g.hud.notify('Die Polizei hat das gestohlene Auto erkannt!');
      }
    }
    // Autowechsel ohne Sichtkontakt senkt die Fahndung
    if (pl.vehicle && pl.vehicle !== this.lastVehicle) {
      if (this.stars > 0 && !this.playerSeen && !this.changedCarCredit.has(pl.vehicle)) {
        this.changedCarCredit.add(pl.vehicle);
        this.wanted.reduceOneStar();
        g.hud.notify('Fahrzeug gewechselt – die Polizei sucht nach dem alten Wagen.');
      }
      this.lastVehicle = pl.vehicle;
    }
    const cleared = this.wanted.update(dt, this.playerSeen, ppos);
    if (cleared) { g.hud.notify('Fahndung eingestellt.'); events.emit('wanted:cleared'); this.hostileToPolice = false; }
    g.stats.maxWanted = Math.max(g.stats.maxWanted, this.stars);
    this._manageUnits(dt, ppos);
    this._updateBust(dt);
    this._updateSpikes();
  }

  // ------------------------------------------------------------------ Einheiten
  _manageUnits(dt, ppos) {
    const g = this.game;
    const stars = this.stars;
    // Aufräumen
    this.cops = this.cops.filter((c) => !c.removed);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const u = this.cars[i];
      const d = u.v.pos.distanceTo(ppos);
      if (u.v.removed || (stars === 0 && d > 90) || d > 300) {
        this._removeCar(u);
        this.cars.splice(i, 1);
      }
    }
    for (const c of [...this.cops]) {
      const d = c.pos.distanceTo(ppos);
      if ((stars === 0 && d > 70) || d > 260 || (c.dead && c.deadTime > 25)) { g.population.remove(c); this.cops.splice(this.cops.indexOf(c), 1); }
    }
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      if (stars === 0 || rb.pos.distanceTo(ppos) > 220) { this._removeRoadblock(rb); this.roadblocks.splice(i, 1); }
    }
    if (stars === 0) return;
    // Einheiten nachschicken
    const units = this.cars.length * 2 + this.cops.filter((c) => !c.dead && !c.vehicle).length;
    this.spawnTimer -= dt;
    if (units < PC.maxUnits[stars - 1] && this.spawnTimer <= 0) {
      this.spawnTimer = 4 - stars * 0.4;
      if (stars === 1 && !g.player.vehicle && this.rng.chance(0.5)) this._spawnFootPatrol(ppos);
      else this._spawnCar(ppos, stars);
    }
    // Strassensperren + Nagelbänder
    this.roadblockTimer -= dt;
    if (stars >= PC.roadblockFrom && g.player.vehicle && Math.abs(g.player.vehicle.speed || 0) > 10 && this.roadblockTimer <= 0 && this.roadblocks.length < 2 && !g.player.vehicle.isAircraft) {
      this.roadblockTimer = 22;
      this._spawnRoadblock(stars);
    }
    // Hubschrauber
    if (stars >= PC.helicopterFrom && this.spawnHeli && (!this.heli || this.heli.destroyed || this.heli.removed)) {
      this.heliTimer = (this.heliTimer || 8) - dt;
      if (this.heliTimer <= 0) { this.heliTimer = 30; this.heli = this.spawnHeli(stars); }
    }
    // Abgesetzte Mannschaft bei Ankunft
    for (const u of this.cars) {
      if (u.deployed || !u.v.driver || u.v.driver.dead) continue;
      const d = u.v.pos.distanceTo(ppos);
      const pv = g.player.vehicle;
      if (d < 18 && (!pv || Math.abs(pv.speed || 0) < 4)) this._deploy(u);
    }
  }

  _copKind(stars) { return stars >= PC.militaryFrom ? 'soldier' : stars >= PC.swatFrom ? 'swat' : 'cop'; }

  _makeCop(kind, x, z) {
    const g = this.game;
    const npc = g.population.spawn({ kind, x, z });
    const stars = Math.max(1, this.stars);
    npc.give(kind === 'cop' ? (stars >= 3 && this.rng.chance(0.4) ? 'shotgun' : 'pistol') : kind === 'swat' ? (this.rng.chance(0.5) ? 'smg' : 'rifle') : 'rifle', 999);
    npc.persistent = true;
    npc.despawnable = false;
    npc.brain = this._copBrain(npc);
    this.cops.push(npc);
    return npc;
  }

  _copBrain(npc) {
    const g = this.game;
    const brain = new CombatBrain({
      target: () => (this.stars > 0 && !g.player.dead ? g.player : null),
      accuracy: PC.copAccuracy[Math.max(0, this.stars - 1)],
      range: [6, 26], useCover: true, fleeAt: 0,
      flankAngle: (this.cops.length % 3 - 1) * 0.9,
    });
    // Festnahme-Verhalten bei 1 Stern bzw. wenn der Spieler nicht feindselig ist
    const base = brain.update.bind(brain);
    brain.update = (n, dt) => {
      const pl = g.player;
      const peaceful = this.stars <= 1 && !this.hostileToPolice && !(pl.aiming && pl.inventory.current.def.type !== 'melee');
      if (peaceful && this.stars > 0) {
        n.aiming = false; n.crouch = false;
        const tp = pl.vehicle ? pl.vehicle.pos : pl.pos;
        const d = n.pos.distanceTo(tp);
        if (d > 1.6) n.goTo(tp.x, tp.z, d > 8 ? 5 : 2.5); else n.stop();
        n.lookAt = tp;
        if (d < 12 && (n.speechTimer || 0) <= 0 && this.rng.chance(dt * 0.4)) n.say(this.rng.pick(['Stehen bleiben! Polizei!', 'Hände hoch!', 'Sie sind verhaftet!']), 2);
        return;
      }
      brain.o.accuracy = PC.copAccuracy[Math.max(0, this.stars - 1)];
      base(n, dt);
    };
    return brain;
  }

  _spawnFootPatrol(ppos) {
    const node = this._spawnNode(ppos, 50, 90, false);
    if (!node) return;
    for (let k = 0; k < 2; k++) this._makeCop('cop', node.x + k, node.z + k);
  }

  /** Strassenknoten in passender Entfernung (möglichst nicht im Blickfeld). */
  _spawnNode(ppos, r0, r1, needRoad = true) {
    const g = this.game;
    const camDir = g.camera.getWorldDirection(new THREE.Vector3());
    let best = null;
    for (let tries = 0; tries < 30; tries++) {
      const n = g.roads.nodes[Math.floor(this.rng.next() * g.roads.nodes.length)];
      const d = Math.hypot(n.x - ppos.x, n.z - ppos.z);
      if (d < r0 || d > r1) continue;
      if (needRoad && n.kind === 'mountain') continue;
      const to = new THREE.Vector3(n.x - g.camera.position.x, 0, n.z - g.camera.position.z).normalize();
      if (to.dot(camDir) < 0.3) return n;
      best = best || n;
    }
    return best;
  }

  _spawnCar(ppos, stars) {
    const g = this.game;
    const node = this._spawnNode(ppos, 90, 170);
    if (!node) return;
    const kind = this._copKind(stars);
    const type = kind === 'soldier' ? 'military' : kind === 'swat' ? 'swat' : 'police';
    const v = g.vehicles.spawn(type, { x: node.x, z: node.z, heading: Math.atan2(ppos.x - node.x, ppos.z - node.z), y: 0.03 });
    v.locked = false;
    v.sirenOn = true;
    v.persistent = true;
    v.policeUnit = true;
    const driver = g.population.spawn({ kind, x: node.x, z: node.z });
    driver.give(kind === 'cop' ? 'pistol' : 'rifle', 999);
    driver.vehicle = v; v.driver = driver;
    driver.brain = this._copBrain(driver);
    driver.persistent = true; driver.despawnable = false;
    v.ai = { mode: 'chase', targetFn: () => (this.stars > 0 ? (g.player.vehicle || g.player) : (this.wanted.lastSeen ? { pos: new THREE.Vector3(this.wanted.lastSeen.x, 0, this.wanted.lastSeen.z) } : null)), maxSpeed: 26 + stars * 4 };
    // Bei Suche: zum letzten bekannten Ort fahren
    const baseTarget = v.ai.targetFn;
    v.ai.targetFn = () => {
      if (this.searching && this.wanted.lastSeen) {
        const ls = this.wanted.lastSeen;
        const t = g.elapsed * 0.1 + v.id;
        return { pos: new THREE.Vector3(ls.x + Math.cos(t) * 25, 0, ls.z + Math.sin(t) * 25) };
      }
      return baseTarget();
    };
    if (g.traffic) g.traffic.cars.push(v);
    this.cars.push({ v, crew: [driver], deployed: false, kind });
    events.emit('police:dispatch', { vehicle: v, stars });
  }

  _deploy(u) {
    const v = u.v;
    u.deployed = true;
    const d = v.driver;
    if (d && !d.isPlayer) { v.driver = null; d.onJacked(v, null); d.brain = this._copBrain(d); this.cops.push(d); }
    const n = u.kind === 'cop' ? 1 : 3;
    for (let k = 0; k < n; k++) {
      const door = v.doorPos(k % 2 ? 1 : -1);
      this._makeCop(u.kind, door.x + k * 0.5, door.z);
    }
    v.ai = null;
    v.controls.brake = 1;
  }

  _removeCar(u) {
    const g = this.game;
    const v = u.v;
    if (v.driver && !v.driver.isPlayer) { const d = v.driver; v.driver = null; d.vehicle = null; g.population.remove(d); }
    if (!(g.player.vehicle === v)) { v.persistent = false; g.vehicles.remove(v); }
  }

  // ------------------------------------------------------------------ Strassensperre
  _spawnRoadblock(stars) {
    const g = this.game;
    const pv = g.player.vehicle;
    const f = pv.forward;
    const ahead = pv.pos.clone().addScaledVector(f, 130);
    const ep = g.roads.nearestEdgePoint(ahead.x, ahead.z);
    if (!ep || ep.d > 15 || ep.edge.kind === 'tunnel' || ep.edge.draped) return;
    const e = ep.edge;
    const p = e.points[ep.seg], q = e.points[ep.seg + 1];
    const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
    const ux = dx / l, uz = dz / l;          // Strassenrichtung
    const rx = -uz, rz = ux;                  // quer
    const kind = this._copKind(stars);
    const type = kind === 'soldier' ? 'military' : kind === 'swat' ? 'swat' : 'police';
    const cars = [], cops = [];
    const half = e.width / 2;
    for (const s of [-0.45, 0.45]) {
      const x = ep.x + rx * s * half * 1.2, z = ep.z + rz * s * half * 1.2;
      const v = g.vehicles.spawn(type, { x, z, heading: Math.atan2(rx, rz) + (s < 0 ? 0 : Math.PI), y: 0.03 });
      v.sirenOn = true; v.persistent = true; v.locked = false; v.policeUnit = true;
      cars.push(v);
    }
    // Polizisten hinter den Autos (vom Spieler aus gesehen)
    const toPlayer = new THREE.Vector3(pv.pos.x - ep.x, 0, pv.pos.z - ep.z).normalize();
    for (let k = 0; k < 3; k++) cops.push(this._makeCop(kind, ep.x - toPlayer.x * 5 + rx * (k - 1) * 3, ep.z - toPlayer.z * 5 + rz * (k - 1) * 3));
    // Nagelband 15 m vor der Sperre (zum Spieler hin)
    let spike = null;
    if (stars >= PC.spikeStripFrom) {
      const sx = ep.x + toPlayer.x * 16, sz = ep.z + toPlayer.z * 16;
      spike = this._makeSpike(sx, sz, Math.atan2(rx, rz), e.width * 0.85);
    }
    this.roadblocks.push({ cars, cops, spike, pos: new THREE.Vector3(ep.x, 0, ep.z) });
    events.emit('police:roadblock', { pos: { x: ep.x, z: ep.z } });
  }

  _makeSpike(x, z, rot, len) {
    const g = this.game;
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    grp.add(base);
    for (let i = -len / 2 + 0.2; i < len / 2; i += 0.35) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), new THREE.MeshLambertMaterial({ color: 0xbbbbbb }));
      sp.position.set(i, 0.1, 0);
      grp.add(sp);
    }
    grp.position.set(x, 0.08, z);
    grp.rotation.y = rot;
    g.scene.add(grp);
    const s = { mesh: grp, x, z, rot, len };
    this.spikes.push(s);
    return s;
  }

  _updateSpikes() {
    const v = this.game.player.vehicle;
    if (!v || !v.wheels || !v.wheels.length) return;
    for (const s of this.spikes) {
      // Räder in lokale Nagelband-Koordinaten
      const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      v.wheels.forEach((w, i) => {
        if (!w.world || w.burst) return;
        const dx = w.world.x - s.x, dz = w.world.z - s.z;
        const lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
        if (Math.abs(lx) < s.len / 2 && Math.abs(lz) < 0.6) { v.burstTire(i); events.emit('police:spikes'); }
      });
    }
  }

  _removeRoadblock(rb) {
    const g = this.game;
    for (const v of rb.cars) if (g.player.vehicle !== v) { v.persistent = false; g.vehicles.remove(v); }
    for (const c of rb.cops) if (!c.removed) { g.population.remove(c); const i = this.cops.indexOf(c); if (i >= 0) this.cops.splice(i, 1); }
    if (rb.spike) { g.scene.remove(rb.spike.mesh); this.spikes.splice(this.spikes.indexOf(rb.spike), 1); }
  }

  // ------------------------------------------------------------------ Festnahme
  _updateBust(dt) {
    const g = this.game;
    const pl = g.player;
    if (this.stars === 0) { this.bustTimer = 0; return; }
    const v = pl.vehicle;
    const ppos = v ? v.pos : pl.pos;
    const slow = v ? Math.abs(v.speed || 0) < 1 && !v.isAircraft : (pl.speed || 0) < 2.5 && !pl.swimming;
    let near = false;
    for (const c of this.cops) {
      if (c.dead || c.vehicle) continue;
      if (c.pos.distanceTo(ppos) < PC.bustDistance + (v ? (v.size ? v.size[0] / 2 + 0.8 : 1) : 0)) { near = true; break; }
    }
    if (near && slow && !(pl.aiming && this.hostileToPolice)) this.bustTimer += dt;
    else this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    if (this.bustTimer > 0.3 && g.hud) g.hud.progress('Festnahme …', clamp(this.bustTimer / PC.bustTime, 0, 1));
    else if (this.bustTimer <= 0.3 && this._bustShown) g.hud.progress(null);
    this._bustShown = this.bustTimer > 0.3;
    if (this.bustTimer >= PC.bustTime) {
      this.bustTimer = 0;
      g.hud.progress(null);
      events.emit('player:busted');
    }
  }

  /** Fahndung sofort löschen (Respawn, Umlackieren, Cheat). */
  clear(reason = '') {
    this.wanted.clear();
    this.hostileToPolice = false;
    events.emit('wanted:cleared', { reason });
  }

  reset() {
    this.clear('respawn');
    for (const u of this.cars) this._removeCar(u);
    this.cars = [];
    for (const c of this.cops) if (!c.removed) this.game.population.remove(c);
    this.cops = [];
    for (const rb of this.roadblocks) this._removeRoadblock(rb);
    this.roadblocks = [];
    if (this.heli && this.removeHeli) this.removeHeli();
  }

  mapBlips(out) {
    for (const u of this.cars) out.push({ x: u.v.pos.x, z: u.v.pos.z, color: (this.game.elapsed * 4) % 2 < 1 ? '#3b82f6' : '#ef4444', size: 7 });
    for (const c of this.cops) if (!c.dead) out.push({ x: c.pos.x, z: c.pos.z, color: '#3b82f6', size: 5 });
    if (this.heli && !this.heli.destroyed) out.push({ x: this.heli.pos.x, z: this.heli.pos.z, color: '#3b82f6', size: 8 });
    if (this.searching && this.wanted.lastSeen) out.push({ x: this.wanted.lastSeen.x, z: this.wanted.lastSeen.z, circle: this.wanted.searchRadius, color: 'rgba(59,130,246,0.18)' });
  }
}
