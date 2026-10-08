// Nebenaktivitäten: Taxi-Fahrer, Krankenwagen, Feuerwehr, Polizei-Einsätze (Selbstjustiz),
// Strassenrennen, Stunt-Sprünge, Kopfgeldjagd. Start/Ende mit T im passenden Fahrzeug
// bzw. über Interaktionspunkte (Rennen, Kopfgeld-Brett).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makeMarker } from './stages.js';
import { LANDMARKS, STUNT_JUMPS, doorPosition } from '../world/layout.js';
import { events } from '../core/events.js';
import { tr } from '../core/i18n.js';
import { formatMoney } from '../core/mathutil.js';

const A = CONFIG.activities;

export class ActivitySystem {
  constructor(game) {
    this.game = game;
    game.activities = this;
    this.active = null;      // {type, level, ...}
    this.entities = [];
    this.stuntsDone = new Set();
    this.racesDone = new Set();
    this.bountiesDone = 0;
    this.best = {};          // Rekorde je Aktivität (Level)
    this.stunt = null;
    // Feuerwehrauto am Krankenhaus bereitstellen
    game.vehicles.parkingSpots.push({ x: 14, z: -206, heading: Math.PI / 2, type: 'firetruck', vehicle: null, cooldown: 0, fixed: true });
    game.vehicles.parkingSpots.push({ x: 300, z: -330, heading: Math.PI / 2, type: 'police', vehicle: null, cooldown: 0, fixed: true });
    game.vehicles.parkingSpots.push({ x: 300, z: 62, heading: Math.PI / 2, type: 'taxi', vehicle: null, cooldown: 0, fixed: true });
    const I = game.interactions;
    I.add({ id: 'bounty', type: 'bounty', x: 300, z: -338, r: 2.5 });
    I.add({ id: 'race1', type: 'race', x: 210, z: 432, r: 3, race: 0 });
    I.add({ id: 'race2', type: 'race', x: -500, z: -312, r: 3, race: 1 });
    I.register('bounty', { label: () => 'Kopfgeld-Brett: Auftrag annehmen', available: () => !this.active && !game.missions.active && !game.player.vehicle, action: () => this.startBounty() });
    I.register('race', { label: (pt) => `Strassenrennen ${pt.race + 1} starten`, available: () => !this.active && !game.missions.active && !!game.player.vehicle && !game.player.vehicle.isAircraft, action: (pt) => this.startRace(pt.race) });
    events.on('player:died', () => this.stop('Aktivität abgebrochen.'));
    events.on('player:busted', () => this.stop('Aktivität abgebrochen.'));
    events.on('mission:start', () => this.stop());
  }

  get characters() { return []; }

  // ------------------------------------------------------------------ Allgemein
  _track(e) { this.entities.push(e); return e; }

  _clear() {
    const g = this.game;
    for (const e of this.entities) {
      if (e.isMarker) e.remove();
      else if (e.isNPC) { if (!e.removed) g.population.remove(e); }
      else if (e.size) { if (g.player.vehicle !== e) g.vehicles.remove(e); else { e.persistent = false; e.blip = null; } }
    }
    this.entities = [];
    g.missions.clearWaypoint();
  }

  stop(msg = null) {
    if (!this.active) return;
    const g = this.game;
    if (msg) g.hud.notify(msg);
    if (this.active.fire) this.active.fire.t = 0;
    this._clear();
    this.active = null;
    g.hud.timer(null);
    g.hud.objective('');
  }

  _reward(amount, text) {
    this.game.economy.add(amount, text);
    events.emit('activity:reward', { type: this.active && this.active.type, amount });
  }

  _randomNode(minD, maxD, from) {
    const peds = this.game.peds.graph;
    for (let i = 0; i < 60; i++) {
      const n = peds[Math.floor(Math.random() * peds.length)];
      const d = Math.hypot(n.x - from.x, n.z - from.z);
      if (d > minD && d < maxD && !n.roam) return n;
    }
    return peds[0];
  }

  // ------------------------------------------------------------------ Schleife
  update(dt) {
    const g = this.game;
    const pl = g.player;
    const v = pl.vehicle;
    this._stunts(dt);
    // Start/Ende mit T
    if (g.input.pressed('activity')) {
      if (this.active) this.stop('Job beendet.');
      else if (!g.missions.active && v) {
        if (v.def && v.def.taxi) this.startTaxi();
        else if (v.type === 'ambulance') this.startAmbulance();
        else if (v.type === 'firetruck') this.startFire();
        else if (v.def && v.def.emergency === 'police') this.startVigilante();
      }
    }
    if (!this.active && v && !g.missions.active && !this._hinted) {
      const job = v.def && v.def.taxi ? 'Taxi-Job' : v.type === 'ambulance' ? 'Rettungsdienst' : v.type === 'firetruck' ? 'Feuerwehr-Einsatz' : v.def && v.def.emergency === 'police' ? 'Polizei-Einsatz' : null;
      if (job) { g.hud.help(`<kbd>${g.input.labelFor('activity')}</kbd> ${job} starten`, 5); this._hinted = v; }
    }
    if (!v) this._hinted = null;
    const a = this.active;
    if (!a) return;
    if (a.timer !== undefined && a.timer !== null) {
      a.timer -= dt;
      g.hud.timer(Math.max(0, a.timer));
      if (a.timer <= 0) { this.stop(a.timeoutMsg || 'Die Zeit ist abgelaufen.'); return; }
    }
    switch (a.type) {
      case 'taxi': this._taxi(dt); break;
      case 'ambulance': this._ambulance(dt); break;
      case 'fire': this._fire(dt); break;
      case 'vigilante': this._vigilante(dt); break;
      case 'race': this._race(dt); break;
      case 'bounty': this._bounty(dt); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ Taxi
  startTaxi() {
    this.active = { type: 'taxi', level: 0, phase: 'pickup', vehicle: this.game.player.vehicle, earned: 0 };
    this.game.hud.notify('Taxi-Job gestartet');
    this._nextFare();
  }

  _nextFare() {
    const g = this.game, a = this.active;
    this._clear();
    const p = g.player.vehicle.pos;
    const n = this._randomNode(50, 160, p);
    const ped = g.population.spawn({ kind: 'ped', x: n.x, z: n.z });
    ped.persistent = true; ped.despawnable = false;
    ped.forcedAnim = 'hands';
    a.fare = this._track(ped);
    a.fareMarker = this._track(makeMarker(g, { x: n.x, z: n.z }, { radius: 3, color: 0x5ac8fa }));
    a.phase = 'pickup';
    a.timer = 60;
    g.missions.setWaypoint(n);
    g.hud.objective('<b>▶</b> Hol den Fahrgast ab (blaue Markierung).');
  }

  _taxi(dt) {
    const g = this.game, a = this.active, v = g.player.vehicle;
    if (v !== a.vehicle) { this.stop(`Taxi-Job beendet. Verdienst: ${formatMoney(a.earned)}`); return; }
    if (a.phase === 'pickup') {
      const f = a.fare;
      if (f.dead) { this._nextFare(); return; }
      if (v.pos.distanceTo(f.pos) < 9 && Math.abs(v.speed) < 1) {
        f.forcedAnim = null;
        f.goTo(v.pos.x, v.pos.z, 2);
        if (v.pos.distanceTo(f.pos) < 3.5) {
          f.vehicle = v; f.seat = 3; f.model.root.visible = true;
          a.fareMarker.remove();
          const lms = Object.values(LANDMARKS).filter((l) => l.h > 0 && Math.hypot(l.x - v.pos.x, l.z - v.pos.z) > 250);
          const lm = lms[Math.floor(Math.random() * lms.length)] || LANDMARKS.hospital;
          const d = doorPosition(lm, 6);
          a.dest = d; a.destName = tr(lm.name);
          a.destMarker = this._track(makeMarker(g, d, { radius: 5, color: 0xffd23f }));
          a.startDist = Math.hypot(d.x - v.pos.x, d.z - v.pos.z);
          a.timer = a.startDist / 11 + 25;
          a.phase = 'drive';
          g.missions.setWaypoint(d);
          f.say(`Zu ${a.destName}, bitte. Und ein bisschen flott!`, 3);
          g.hud.objective(`<b>▶</b> Fahr den Fahrgast zu: ${a.destName}`);
        }
      }
    } else if (a.phase === 'drive') {
      if (Math.hypot(a.dest.x - v.pos.x, a.dest.z - v.pos.z) < 6 && Math.abs(v.speed) < 1.5) {
        const fare = Math.round(A.taxiBaseFare + a.startDist * A.taxiPerMeter + Math.max(0, a.timer) * 4);
        a.earned += fare;
        a.level++;
        this._reward(fare, `Taxi-Fahrt ${a.level}`);
        const f = a.fare;
        f.vehicle = null; f.pos.copy(v.doorPos(1)); f.prevPos.copy(f.pos);
        this.best.taxi = Math.max(this.best.taxi || 0, a.level);
        this._nextFare();
      }
    }
  }

  // ------------------------------------------------------------------ Krankenwagen
  startAmbulance() {
    this.active = { type: 'ambulance', level: 0, vehicle: this.game.player.vehicle, phase: 'pickup' };
    this.game.hud.notify('Rettungsdienst gestartet');
    this._nextPatient();
  }

  _nextPatient() {
    const g = this.game, a = this.active;
    this._clear();
    const n = this._randomNode(80, 220, g.player.vehicle.pos);
    const ped = g.population.spawn({ kind: 'ped', x: n.x, z: n.z });
    ped.persistent = true; ped.despawnable = false; ped.forcedAnim = 'cower';
    a.patient = this._track(ped);
    a.marker = this._track(makeMarker(g, n, { radius: 3, color: 0xff3b30 }));
    a.phase = 'pickup';
    a.timer = 50 + Math.hypot(n.x - g.player.pos.x, n.z - g.player.pos.z) / 8;
    g.missions.setWaypoint(n);
    g.hud.objective(`<b>▶</b> Patient ${a.level + 1}: Fahr zum Verletzten!`);
  }

  _ambulance() {
    const g = this.game, a = this.active, v = g.player.vehicle;
    if (v !== a.vehicle) { this.stop('Rettungsdienst beendet.'); return; }
    const H = { x: -30, z: -205 };
    if (a.phase === 'pickup' && v.pos.distanceTo(a.patient.pos) < 8 && Math.abs(v.speed) < 1) {
      a.patient.vehicle = v; a.patient.seat = 2; a.patient.model.root.visible = false;
      a.marker.remove();
      a.phase = 'hospital';
      a.timer += 20;
      a.marker = this._track(makeMarker(g, H, { radius: 5, color: 0x4cd964 }));
      g.missions.setWaypoint(H);
      g.hud.objective('<b>▶</b> Bring den Patienten zur St.-Aurelia-Klinik!');
    } else if (a.phase === 'hospital' && Math.hypot(v.pos.x - H.x, v.pos.z - H.z) < 6 && Math.abs(v.speed) < 1.5) {
      a.level++;
      this._reward(A.ambulanceReward * a.level, `Patient ${a.level} gerettet`);
      this.best.ambulance = Math.max(this.best.ambulance || 0, a.level);
      if (a.level >= 10) g.player.health = 150, g.hud.notify('Rettungsdienst Stufe 10: maximale Gesundheit erhöht!');
      this._nextPatient();
    }
  }

  // ------------------------------------------------------------------ Feuerwehr
  startFire() {
    this.active = { type: 'fire', level: 0, vehicle: this.game.player.vehicle };
    this.game.hud.notify('Feuerwehr-Einsatz gestartet');
    this._nextFire();
  }

  _nextFire() {
    const g = this.game, a = this.active;
    this._clear();
    const n = this._randomNode(100, 250, g.player.vehicle.pos);
    const car = g.vehicles.spawn('sedan', { x: n.x + 2, z: n.z + 2 });
    car.persistent = true;
    car.onFire = true; car.burnTimer = 9999; car.health = car.maxHealth * 0.15;
    a.car = this._track(car);
    a.fire = g.combat.startFire(new THREE.Vector3(n.x + 2, 0.2, n.z + 2), 999, 3);
    a.fireHp = 6;
    a.timer = 70 + Math.hypot(n.x - g.player.pos.x, n.z - g.player.pos.z) / 9;
    g.missions.setWaypoint(n);
    g.hud.objective(`<b>▶</b> Brand ${a.level + 1}: Lösche das brennende Auto (Maus links halten, Wasserwerfer).`);
  }

  _fire(dt) {
    const g = this.game, a = this.active, v = g.player.vehicle;
    if (v !== a.vehicle) { this.stop('Feuerwehr-Einsatz beendet.'); return; }
    const d = v.pos.distanceTo(a.car.pos);
    if (g.input.down('attack')) {
      // Wasserwerfer: Partikel in Fahrtrichtung
      const f = v.forward;
      const nozzle = v.pos.clone().add(new THREE.Vector3(0, 3, 0)).addScaledVector(f, 3);
      if (g.fx) for (let i = 0; i < 3; i++) g.fx.splash(nozzle.clone().addScaledVector(f, 2 + Math.random() * 10), 1);
      const to = a.car.pos.clone().sub(v.pos).normalize();
      if (d < 22 && to.dot(f) > 0.8) {
        a.fireHp -= dt;
        g.hud.progress('Löschen …', 1 - a.fireHp / 6);
      }
    }
    if (a.fireHp <= 0) {
      g.hud.progress(null);
      a.car.onFire = false; a.fire.t = 0;
      a.level++;
      this._reward(A.fireReward * a.level, `Brand ${a.level} gelöscht`);
      this.best.fire = Math.max(this.best.fire || 0, a.level);
      this._nextFire();
    }
  }

  // ------------------------------------------------------------------ Polizei-Einsätze
  startVigilante() {
    this.active = { type: 'vigilante', level: 0, vehicle: this.game.player.vehicle };
    this.game.hud.notify('Polizei-Einsatz gestartet');
    this._nextCriminal();
  }

  _nextCriminal() {
    const g = this.game, a = this.active;
    this._clear();
    const p = g.player.vehicle.pos;
    const node = g.roads.nodes.filter((n) => n.kind === 'street' && Math.hypot(n.x - p.x, n.z - p.z) > 120 && Math.hypot(n.x - p.x, n.z - p.z) < 250)[0] || g.roads.nodes[0];
    const v = g.vehicles.spawn('sedan', { x: node.x, z: node.z, color: 0x333333 });
    v.persistent = true;
    const crim = g.gangs.spawnMember(Math.random() < 0.5 ? 'rust' : 'wolves', node.x, node.z, null, { persistent: true, weapon: 'pistol' });
    crim.vehicle = v; v.driver = crim;
    const flee = g.roads.nodes[Math.floor(Math.random() * g.roads.nodes.length)];
    v.ai = { mode: 'direct', goal: new THREE.Vector3(flee.x, 0, flee.z), maxSpeed: 20 + a.level * 2, arriveDist: 15 };
    g.traffic.cars.push(v);
    v.blip = { color: '#ff3b30', size: 8 };
    a.car = this._track(v); a.crim = this._track(crim);
    a.timer = 120;
    g.hud.objective(`<b>▶</b> Einsatz ${a.level + 1}: Stoppe den flüchtigen Verdächtigen!`);
  }

  _vigilante() {
    const g = this.game, a = this.active;
    if (g.player.vehicle !== a.vehicle && !g.player.vehicle) { /* zu Fuss weiterjagen erlaubt */ }
    if (a.car.ai && a.car.ai.arrived) { const f = g.roads.nodes[Math.floor(Math.random() * g.roads.nodes.length)]; a.car.ai.goal = new THREE.Vector3(f.x, 0, f.z); a.car.ai.arrived = false; }
    if (a.crim.dead || a.car.destroyed) {
      a.level++;
      this._reward(A.vigilanteReward * a.level, `Einsatz ${a.level} erledigt`);
      this.best.vigilante = Math.max(this.best.vigilante || 0, a.level);
      if (g.player.vehicle) this._nextCriminal(); else this.stop('Polizei-Einsatz beendet.');
    }
  }

  // ------------------------------------------------------------------ Strassenrennen
  startRace(i) {
    const g = this.game;
    const tracks = [
      [{ x: 270, z: 420 }, { x: 390, z: 300 }, { x: 510, z: 180 }, { x: 390, z: 60 }, { x: 150, z: 60 }, { x: 30, z: 180 }, { x: 30, z: 420 }, { x: 210, z: 420 }],
      [{ x: -440, z: -300 }, { x: -320, z: -180 }, { x: -320, z: 60 }, { x: -440, z: 180 }, { x: -560, z: 60 }, { x: -560, z: -180 }, { x: -500, z: -300 }],
    ];
    const pts = tracks[i];
    const v = g.player.vehicle;
    const racers = [];
    for (let k = 0; k < 2; k++) {
      const rv = g.vehicles.spawn(k ? 'sports' : 'sedan', { x: v.pos.x + (k + 1) * 4, z: v.pos.z + 4, heading: v.heading, color: [0xff7f11, 0x6a1b9a][k] });
      rv.persistent = true;
      const d = g.population.spawn({ kind: 'ped', x: rv.pos.x, z: rv.pos.z });
      d.vehicle = rv; rv.driver = d;
      rv.racer = { cp: 0 };
      rv.ai = { mode: 'direct', maxSpeed: 28 + k * 4, arriveDist: 0, targetFn: () => { const p = pts[rv.racer.cp]; return p ? { pos: new THREE.Vector3(p.x, 0, p.z) } : null; } };
      g.traffic.cars.push(rv);
      this._track(rv); this._track(d);
      racers.push(rv);
    }
    this.active = { type: 'race', i, pts, cp: 0, racers, time: 0, timer: 240, marker: null };
    this._raceMarker();
  }

  _raceMarker() {
    const a = this.active;
    if (a.marker) a.marker.remove();
    const p = a.pts[a.cp];
    a.marker = this._track(makeMarker(this.game, p, { radius: 8, color: a.cp === a.pts.length - 1 ? 0x4cd964 : 0xffd23f, height: 5 }));
    this.game.missions.setWaypoint(p);
  }

  _race(dt) {
    const g = this.game, a = this.active;
    a.time += dt;
    const v = g.player.vehicle;
    const p = a.pts[a.cp];
    if (v && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 11) {
      a.cp++;
      if (a.cp >= a.pts.length) {
        const first = this.racesDone.has(a.i) ? 0.3 : 1;
        this.racesDone.add(a.i);
        const key = 'race' + a.i;
        if (!this.best[key] || a.time < this.best[key]) this.best[key] = a.time;
        g.hud.center('SIEG!', 'passed', `Zeit ${a.time.toFixed(1)} s`, 4);
        this._reward(Math.round(A.raceReward * first), 'Rennsieg');
        this.stop();
        return;
      }
      this._raceMarker();
    }
    let place = 1;
    for (const r of a.racers) {
      const rp = a.pts[r.racer.cp];
      if (rp && Math.hypot(r.pos.x - rp.x, r.pos.z - rp.z) < 14) r.racer.cp++;
      if (r.racer.cp >= a.pts.length) { g.hud.center('VERLOREN', 'failed', 'Ein Gegner war schneller.', 3); this.stop(); return; }
      if (r.racer.cp > a.cp) place++;
    }
    g.hud.objective(`<b>▶</b> Rennen: Platz ${place}/3 · Checkpoint ${a.cp + 1}/${a.pts.length} · ${a.time.toFixed(1)} s`);
  }

  // ------------------------------------------------------------------ Kopfgeld
  startBounty() {
    const g = this.game;
    const n = this._randomNode(200, 450, g.player.pos);
    const gang = Math.random() < 0.5 ? 'rust' : 'wolves';
    const target = g.gangs.spawnMember(gang, n.x, n.z, null, { persistent: true, weapon: 'smg', health: 220 });
    target.model.setShirt(0x8b0000);
    target.brain.o.target = () => (target.pos.distanceTo(g.player.pos) < 35 ? g.player : null);
    this.active = { type: 'bounty', target, timer: 300, guards: [] };
    this._track(target);
    for (let k = 0; k < 2; k++) {
      const gd = g.gangs.spawnMember(gang, n.x + (k ? 3 : -3), n.z + 2, null, { persistent: true, weapon: 'pistol' });
      gd.brain.o.target = () => (gd.pos.distanceTo(g.player.pos) < 30 ? g.player : null);
      this._track(gd);
    }
    g.missions.setWaypoint(n);
    g.hud.notify('Kopfgeld: Ein gesuchter Bandenboss versteckt sich in der Stadt.');
    g.hud.objective('<b>▶</b> Finde und erledige das Kopfgeld-Ziel (roter Punkt).');
  }

  _bounty() {
    const a = this.active;
    if (a.target.dead) {
      this.bountiesDone++;
      this._reward(A.bountyReward, 'Kopfgeld');
      this.game.hud.center('KOPFGELD KASSIERT', 'passed', formatMoney(A.bountyReward), 3);
      this.stop();
    }
  }

  // ------------------------------------------------------------------ Stunt-Sprünge
  _stunts(dt) {
    const g = this.game;
    const v = g.player.vehicle;
    if (!v || v.isAircraft || v.isBoat) { this.stunt = null; return; }
    if (!this.stunt) {
      for (const j of STUNT_JUMPS) {
        const ex = j.axis === 'x' ? j.x + j.dir * j.len : j.x;
        const ez = j.axis === 'z' ? j.z + j.dir * j.len : j.z;
        if (Math.hypot(v.pos.x - ex, v.pos.z - ez) < 4 && Math.abs(v.speed) > 12) { this.stunt = { j, start: v.pos.clone(), t: 0, maxH: v.pos.y }; break; }
      }
      return;
    }
    const s = this.stunt;
    s.t += dt;
    s.maxH = Math.max(s.maxH, v.pos.y);
    if (v.onGround && s.t > 0.3) {
      const dist = Math.hypot(v.pos.x - s.start.x, v.pos.z - s.start.z);
      const upright = v.up.y > 0.6;
      if (s.t > 0.9 && dist > 18) {
        const first = !this.stuntsDone.has(s.j.id);
        this.stuntsDone.add(s.j.id);
        g.stats.stunts++;
        const reward = Math.round((first ? A.stuntJumpReward : 100) + dist * 5 + (upright ? 0 : -100));
        g.hud.center('STUNT-SPRUNG!', 'passed', `${dist.toFixed(0)} m weit · ${s.t.toFixed(1)} s in der Luft${upright ? '' : ' · Landung vermasselt'}`, 3);
        this.game.economy.add(Math.max(50, reward), 'Stunt-Bonus');
        events.emit('stunt:jump', { id: s.j.id, dist });
      }
      this.stunt = null;
    } else if (s.t < 0.6 && v.onGround) { /* noch auf der Rampe */ }
    if (s && s.t > 8) this.stunt = null;
  }

  mapBlips(out) {
    for (const j of STUNT_JUMPS) if (!this.stuntsDone.has(j.id)) out.push({ x: j.x, z: j.z, icon: 'stunt', size: 7, label: 'Stunt-Sprung' });
    out.push({ x: 210, z: 432, icon: 'race', size: 7, label: 'Strassenrennen 1' }, { x: -500, z: -312, icon: 'race', size: 7, label: 'Strassenrennen 2' }, { x: 300, z: -338, icon: 'target', size: 7, label: 'Kopfgeld-Brett' });
    const a = this.active;
    if (!a) return;
    if (a.type === 'bounty' && !a.target.dead) out.push({ x: a.target.pos.x, z: a.target.pos.z, color: '#ff3b30', size: 9, edge: true });
    if (a.type === 'taxi' && a.phase === 'pickup') out.push({ x: a.fare.pos.x, z: a.fare.pos.z, color: '#5ac8fa', size: 8, edge: true });
    if (a.type === 'race') for (const r of a.racers) out.push({ x: r.pos.x, z: r.pos.z, color: '#ff9500', size: 6 });
  }
}
