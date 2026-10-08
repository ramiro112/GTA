// Verkehrs-KI: Fahrzeuge folgen Spuren im Strassengraph (rechts fahren), biegen an Kreuzungen
// ab (Bezier-Kurve), beachten Ampeln, halten Abstand, hupen, weichen aus, fliehen bei Gefahr.
// Gleicher Fahr-Controller wird von Polizei/Taxi/Missionen genutzt (Modus 'goto' / 'chase').

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { lightState, axisOf, offsetPolyline, laneOffsetFor } from '../world/roads.js';
import { districtAt } from '../world/terrain.js';
import { clamp, angleDiff } from '../core/mathutil.js';
import { events } from '../core/events.js';
import { Random } from '../core/random.js';
import { PedBrain } from './brains.js';

const DENSITY = { downtown: 1, residential: 0.8, suburb: 0.5, park: 0.6, beach: 0.6, industrial: 0.6, harbor: 0.5, airport: 0.4, military: 0.1, mountains: 0.3, forest: 0.3, ocean: 0.3 };
const TYPES = [['compact', 3], ['sedan', 4], ['suv', 2], ['taxi', 1.5], ['sports', 0.8], ['truck', 0.8], ['bus', 0.5], ['motorbike', 0.8], ['ambulance', 0.15], ['police', 0.4]];

export class TrafficSystem {
  constructor(game) {
    this.game = game;
    game.traffic = this;
    this.cars = [];
    this.rng = new Random(44);
    this.spawnTimer = 0;
    this.totalW = TYPES.reduce((a, [, w]) => a + w, 0);
    events.on('weapon:fired', (e) => this._panic(e.pos, 60));
    events.on('explosion', (e) => this._panic(e.pos, 90));
    events.on('vehicle:collide', (e) => this._onCollide(e));
  }

  // ------------------------------------------------------------------ Route
  /** Initialisiert eine KI-Route für Fahrzeug v auf Kante edge. */
  initRoute(v, edge, forward, t = 0.5, mode = 'cruise') {
    const ai = v.ai || (v.ai = {});
    Object.assign(ai, { mode, edge, forward, lane: edge.lanes > 1 ? (this.rng.chance(0.5) ? 0 : 1) : 0, points: [], blocked: 0, honk: 0, panic: 0, reverse: 0, goal: null });
    const pts = this._lanePts(edge, forward, ai.lane, true);
    // ab Position t beginnen
    const startIdx = Math.max(0, Math.min(pts.length - 1, Math.floor(t * pts.length)));
    ai.points = pts.slice(startIdx);
    ai.endNode = this.game.roads.nodes[forward ? edge.b : edge.a];
    return ai;
  }

  _lanePts(edge, forward, lane, trimStart = true) {
    const raw = forward ? edge.points : [...edge.points].reverse();
    const off = edge.oneWay ? 0 : laneOffsetFor(edge, lane);
    const pts = offsetPolyline(densify(raw, 8), off);
    // Kreuzungsbereich kürzen
    const nodeW = (n) => Math.max(...n.edges.map((id) => this.game.roads.edges[id].width)) / 2 + 2;
    const g = this.game.roads;
    const startNode = g.nodes[forward ? edge.a : edge.b], endNode = g.nodes[forward ? edge.b : edge.a];
    const cut0 = trimStart ? Math.min(edge.length * 0.3, nodeW(startNode)) : 0, cut1 = Math.min(edge.length * 0.3, nodeW(endNode));
    const out = trimPts(pts, cut0, cut1);
    const axis = axisOf(raw[raw.length - 1].x - raw[raw.length - 2].x, raw[raw.length - 1].z - raw[raw.length - 2].z);
    out.forEach((p) => { p.speed = edge.speed; p.edge = edge; });
    out[out.length - 1].stop = { node: endNode, axis };
    return out;
  }

  /** Nächste Kante wählen und Kurve + Spur anhängen. */
  _extend(v) {
    const ai = v.ai;
    const g = this.game.roads;
    const node = ai.endNode;
    const all = g.neighbors(node.id);
    // Keine Wende; Bergstrasse nur selten und nie mit Bus/Lastwagen
    let opts = all.filter((n) => n.edge !== ai.edge && !(n.edge.kind === 'mountain' && (v.type === 'bus' || v.type === 'truck' || this.rng.next() < 0.8)));
    if (!opts.length) opts = all.filter((n) => n.edge !== ai.edge);
    if (!opts.length) opts = all;
    if (!opts.length) return false;
    let next;
    if (ai.mode === 'goto' && ai.route && ai.route.length) next = ai.route.shift();
    else next = opts[Math.floor(this.rng.next() * opts.length)];
    const nextPts = this._lanePts(next.edge, next.forward, next.edge.lanes > 1 ? ai.lane : 0);
    const last = ai.points[ai.points.length - 1] || { x: v.pos.x, z: v.pos.z };
    const first = nextPts[0];
    // Bezier-Kurve durch die Kreuzung
    const ctrl = { x: node.x + (last.x - node.x) * 0.15 + (first.x - node.x) * 0.15, z: node.z + (last.z - node.z) * 0.15 + (first.z - node.z) * 0.15 };
    const prev = ai.points[ai.points.length - 2] || last;
    const signedTurn = angleDiff(Math.atan2(last.x - prev.x, last.z - prev.z), Math.atan2(nextPts[1] ? nextPts[1].x - first.x : 0, nextPts[1] ? nextPts[1].z - first.z : 1));
    const turnAngle = Math.abs(signedTurn);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const x = (1 - t) * (1 - t) * last.x + 2 * (1 - t) * t * ctrl.x + t * t * first.x;
      const z = (1 - t) * (1 - t) * last.z + 2 * (1 - t) * t * ctrl.z + t * t * first.z;
      ai.points.push({ x, z, speed: turnAngle > 0.5 ? 6 : 10, turn: true });
    }
    ai.points.push(...nextPts);
    ai.edge = next.edge;
    ai.forward = next.forward;
    ai.endNode = g.nodes[next.forward ? next.edge.b : next.edge.a];
    // Blinker: abnehmender Kurswinkel = Rechtskurve
    ai.indicatorFor = turnAngle > 0.5 ? (signedTurn < 0 ? 1 : -1) : 0;
    return true;
  }

  // ------------------------------------------------------------------ Fahren
  /** Steuert ein KI-Fahrzeug einen Physikschritt lang. */
  drive(v, dt) {
    const ai = v.ai;
    if (!ai) return;
    const c = v.controls;
    if (!v.driver || v.driver.dead || v.destroyed) { c.throttle = 0; c.brake = 1; c.steer = 0; return; }
    if (ai.mode === 'chase' || ai.mode === 'direct') { this._driveDirect(v, dt); return; }
    while (ai.points.length < 14) if (!this._extend(v)) break;
    // Erreichte Punkte entfernen
    const fwd = v.forward;
    while (ai.points.length > 2) {
      const p = ai.points[0];
      const dx = p.x - v.pos.x, dz = p.z - v.pos.z;
      if (dx * dx + dz * dz < 9 || dx * fwd.x + dz * fwd.z < 0) {
        if (p.stop && ai.waitingAt === p) ai.waitingAt = null;
        ai.points.shift();
      } else break;
    }
    const speed = v.speed;
    // Vorausschaupunkt
    const L = 4.5 + Math.abs(speed) * 0.35;
    let target = ai.points[ai.points.length - 1], acc = 0, px = v.pos.x, pz = v.pos.z;
    for (const p of ai.points) {
      acc += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z;
      if (acc >= L) { target = p; break; }
    }
    const desired = Math.atan2(target.x - v.pos.x, target.z - v.pos.z);
    const diff = angleDiff(v.heading, desired);
    let steer = clamp(-diff * 2.4, -1, 1);
    // Zielgeschwindigkeit
    let vt = (ai.points[0] && ai.points[0].speed) || CONFIG.ai.trafficSpeed;
    if (ai.panic > 0) { ai.panic -= dt; vt *= 1.5; }
    let turning = false;
    for (let i = 0; i < Math.min(8, ai.points.length); i++) if (ai.points[i].turn) { vt = Math.min(vt, ai.points[i].speed + i * 1.2); turning = true; break; }
    v.indicator = turning ? ai.indicatorFor || 0 : 0;
    if (Math.abs(diff) > 0.6) vt = Math.min(vt, 5);
    // Ampeln / Haltelinien
    const stopInfo = this._nextStop(v, ai);
    if (stopInfo && ai.panic <= 0) {
      const { p, dist } = stopInfo;
      const n = p.stop.node;
      if (n.light) {
        const st = lightState(n, p.stop.axis, this.game.elapsed);
        if (st === 'red' || (st === 'yellow' && dist > 8)) vt = Math.min(vt, Math.max(0, (dist - 1.5) * 0.55));
      } else if (n.kind === 'roundabout' || n.edges.length > 2) {
        if (dist < 12) vt = Math.min(vt, 7);
      }
    }
    // Hindernisse vor dem Fahrzeug
    const obst = this._obstacleAhead(v, Math.max(10, Math.abs(speed) * 1.6 + 8));
    if (obst) {
      vt = Math.min(vt, Math.max(0, (obst.along - (v.size[2] / 2 + 3.5)) * 0.6));
      if (obst.human && Math.abs(speed) < 1) { ai.honk += dt; if (ai.honk > 1.5) { v.horn = true; if (ai.honk > 2.2) { ai.honk = 0; v.horn = false; } } }
    } else { v.horn = false; ai.honk = 0; }
    // Feststecken erkennen → zurücksetzen
    if (vt > 3 && Math.abs(speed) < 0.6) ai.blocked += dt; else ai.blocked = Math.max(0, ai.blocked - dt);
    if (ai.reverse > 0) {
      ai.reverse -= dt;
      c.throttle = 0; c.brake = 0.7; c.steer = -steer; c.handbrake = false;
      return;
    }
    if (ai.blocked > 5 && !obst) { ai.reverse = 1.6; ai.blocked = 0; }
    // Regler
    const err = vt - speed;
    c.throttle = clamp(err * 0.35, 0, 1);
    c.brake = speed > 0.3 ? clamp(-err * 0.5, 0, 1) : 0;
    if (vt < 0.3 && speed < 0.6) { c.brake = 0; c.throttle = 0; v.vel.x *= 0.9; v.vel.z *= 0.9; }
    c.steer = steer;
    c.handbrake = false;
    v.wake();
  }

  _nextStop(v, ai) {
    let acc = 0, px = v.pos.x, pz = v.pos.z;
    for (const p of ai.points) {
      acc += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z;
      if (acc > 40) return null;
      if (p.stop) return { p, dist: acc };
    }
    return null;
  }

  /** Fahrzeuge/Personen vor dem Auto in der eigenen Spur. */
  _obstacleAhead(v, range) {
    const f = v.forward;
    const r = { x: -f.z, z: f.x };
    let best = null;
    const check = (pos, half, human, ent) => {
      const dx = pos.x - v.pos.x, dz = pos.z - v.pos.z;
      const along = dx * f.x + dz * f.z;
      if (along <= 0 || along > range + half) return;
      const lat = Math.abs(dx * r.x + dz * r.z);
      if (lat > 1.6 + half * 0.5) return;
      if (!best || along < best.along) best = { along: along - half * 0.5, human, ent };
    };
    for (const o of this.game.vehicles.list) {
      if (o === v || !o.size) continue;
      if (Math.abs(o.pos.x - v.pos.x) > range + 8 || Math.abs(o.pos.z - v.pos.z) > range + 8) continue;
      check(o.pos, o.size[2] / 2, false, o);
    }
    const pl = this.game.player;
    if (!pl.vehicle && !pl.dead) check(pl.pos, 0.5, true, pl);
    if (this.game.peds) for (const p of this.game.peds.peds) {
      if (p.dead || Math.abs(p.pos.x - v.pos.x) > range || Math.abs(p.pos.z - v.pos.z) > range) continue;
      check(p.pos, 0.4, true, p);
    }
    return best;
  }

  /** Direktes Ansteuern eines Ziels (Verfolgung, Missionen), mit Strassen-A* bei grosser Distanz. */
  _driveDirect(v, dt) {
    const ai = v.ai;
    const c = v.controls;
    const tgt = ai.targetFn ? ai.targetFn() : ai.goal;
    if (!tgt) { c.throttle = 0; c.brake = 1; return; }
    const tp = tgt.pos || tgt;
    const d = Math.hypot(tp.x - v.pos.x, tp.z - v.pos.z);
    // Wegpunkte über das Strassennetz, wenn weit weg
    ai.replan = (ai.replan || 0) - dt;
    if (d > 60 && ai.replan <= 0) {
      ai.replan = 3;
      const g = this.game.roads;
      const a = g.nearestNode(v.pos.x, v.pos.z), b = g.nearestNode(tp.x, tp.z);
      const path = g.findPath(a.id, b.id);
      ai.wps = path ? [{ x: a.x, z: a.z }, ...path.map((s) => ({ x: s.node.x, z: s.node.z }))] : null;
      // Startknoten überspringen, wenn er hinter uns liegt
      if (ai.wps && ai.wps.length > 1) {
        const f = v.forward;
        const p0 = ai.wps[0];
        if ((p0.x - v.pos.x) * f.x + (p0.z - v.pos.z) * f.z < 0) ai.wps.shift();
      }
    }
    let aim = tp;
    if (d > 60 && ai.wps && ai.wps.length) {
      while (ai.wps.length > 1 && Math.hypot(ai.wps[0].x - v.pos.x, ai.wps[0].z - v.pos.z) < 12) ai.wps.shift();
      aim = ai.wps[0];
    }
    const desired = Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z);
    const diff = angleDiff(v.heading, desired);
    const speed = v.speed;
    let vt = ai.maxSpeed || 30;
    if (Math.abs(diff) > 0.8) vt = Math.min(vt, 9);
    if (ai.mode === 'chase') {
      if (d < 12) vt = Math.min(vt, Math.max(0, (d - 6) * 1.2));
    } else if (d < (ai.arriveDist || 8)) { vt = 0; ai.arrived = true; }
    const obst = this._obstacleAhead(v, Math.max(8, Math.abs(speed) * 1.2 + 6));
    if (obst && !(ai.mode === 'chase' && obst.ent === this.game.player.vehicle)) vt = Math.min(vt, Math.max(2, (obst.along - 6) * 0.8));
    if (Math.abs(diff) > 2.2 && speed < 4) {
      // Ziel hinter uns: zurücksetzen und wenden
      c.throttle = 0; c.brake = 0.8; c.steer = diff > 0 ? 1 : -1;
      return;
    }
    if (vt > 3 && Math.abs(speed) < 0.6) ai.blocked = (ai.blocked || 0) + dt; else ai.blocked = 0;
    if (ai.blocked > 3) { ai.reverse = 1.5; ai.blocked = 0; }
    if (ai.reverse > 0) { ai.reverse -= dt; c.throttle = 0; c.brake = 0.8; c.steer = clamp(diff * 2, -1, 1); return; }
    const err = vt - speed;
    c.throttle = clamp(err * 0.4, 0, 1);
    c.brake = speed > 0.5 ? clamp(-err * 0.5, 0, 1) : 0;
    c.steer = clamp(-diff * 2.6, -1, 1);
    c.handbrake = Math.abs(diff) > 1.2 && speed > 12;
    v.wake();
  }

  // ------------------------------------------------------------------ Reaktionen
  _panic(pos, r) {
    for (const v of this.cars) if (v.ai && v.pos.distanceTo(pos) < r) v.ai.panic = 12;
  }

  _onCollide(e) {
    for (const v of [e.a, e.b]) {
      if (!v.ai || v.ai.mode !== 'cruise' || !v.driver || v.driver.isPlayer) continue;
      const other = v === e.a ? e.b : e.a;
      if (other.driver && other.driver.isPlayer && e.speed > 4) {
        v.horn = true;
        setTimeout(() => { v.horn = false; }, 1200);
        // Wütender Fahrer steigt aus
        const npc = v.driver;
        if (npc.brain && npc.brain.type === 'aggressive' && Math.random() < 0.6) this.driverExit(v, 'fight');
        else if (e.speed > 10) v.ai.panic = 10;
      }
    }
  }

  /** Fahrer steigt aus (fliehen oder kämpfen). */
  driverExit(v, reaction = 'flee') {
    const npc = v.driver;
    if (!npc || npc.isPlayer) return;
    v.driver = null;
    v.ai = null;
    v.controls.throttle = 0; v.controls.brake = 1;
    npc.onJacked(v, reaction === 'fight' ? this.game.player : null);
    if (reaction === 'fight' && npc.brain && npc.brain.onJacked) npc.brain.onJacked(npc, v, this.game.player);
  }

  // ------------------------------------------------------------------ Spawnen
  targetCount() {
    const g = this.game;
    const base = CONFIG.ai.trafficCount[g.quality.name] || CONFIG.ai.trafficCount.medium;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const dens = DENSITY[districtAt(p.x, p.z).id] ?? 0.4;
    const night = 1 - g.tod.night * (1 - CONFIG.ai.nightDensityFactor);
    return Math.round(base * dens * night * (g.densityMul ?? 1));
  }

  _pickType() {
    let r = this.rng.float(0, this.totalW);
    for (const [t, w] of TYPES) { r -= w; if (r <= 0) return t; }
    return 'sedan';
  }

  /** Spawnt ein KI-Fahrzeug mit Fahrer auf einer Kante. */
  spawnOn(edge, forward, t, type = null, mode = 'cruise') {
    const g = this.game;
    type = type || this._pickType();
    if (type === 'bus' && edge.kind !== 'street') type = 'sedan';
    const pts = this._lanePts(edge, forward, 0);
    const i = Math.max(0, Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))));
    const p = pts[i], q = pts[i + 1] || pts[i];
    const heading = Math.atan2(q.x - p.x, q.z - p.z);
    for (const o of g.vehicles.list) if (Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 14) return null;
    const v = g.vehicles.spawn(type, { x: p.x, z: p.z, heading, y: edge.draped ? null : 0.03 });
    v.locked = false;
    const kind = type === 'police' ? 'cop' : type === 'ambulance' ? 'medic' : 'ped';
    const npc = g.population.spawn({ kind, x: p.x, z: p.z });
    npc.vehicle = v;
    npc.seat = 0;
    v.driver = npc;
    npc.brain = new PedBrain(g.peds, this.rng.chance(0.2) ? 'aggressive' : this.rng.chance(0.3) ? 'scared' : 'peaceful');
    if (kind === 'cop') { npc.give('pistol', 60); npc.equip('fist'); }
    this.initRoute(v, edge, forward, t, mode);
    this.cars.push(v);
    v.trafficCar = true;
    return v;
  }

  fixedUpdate(dt) {
    for (const v of this.cars) if (v.ai && !(v.driver && v.driver.isPlayer)) this.drive(v, dt);
  }

  update(dt) {
    const g = this.game;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const camDir = g.camera.getWorldDirection(new THREE.Vector3());
    // Entfernen
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const v = this.cars[i];
      if (v.removed) { this.cars.splice(i, 1); continue; }
      if (v.driver && v.driver.isPlayer) { this.cars.splice(i, 1); v.trafficCar = false; continue; }
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      const toV = new THREE.Vector3(v.pos.x - g.camera.position.x, 0, v.pos.z - g.camera.position.z).normalize();
      const visible = toV.dot(camDir) > 0.4 && d < 150;
      if ((d > CONFIG.ai.despawnRadius && !visible) || (v.destroyed && d > 60 && !visible) || (v.ai && v.ai.blocked > 25 && !visible) || (!v.driver && !v.persistent && d > 120 && !visible)) {
        this.cars.splice(i, 1);
        const drv = v.driver;
        if (drv && !drv.isPlayer) { drv.vehicle = null; g.population.remove(drv); }
        if (!v.persistent && !v.owned) g.vehicles.remove(v);
        continue;
      }
      // Fahrer flieht aus brennendem/zerstörtem Auto
      if (v.driver && !v.driver.isPlayer && (v.onFire || v.health < v.maxHealth * 0.25) && v.ai) this.driverExit(v, 'flee');
    }
    // Spawnen
    this.spawnTimer -= dt;
    const want = this.targetCount();
    const active = this.cars.filter((v) => v.ai && v.driver).length;
    if (this.spawnTimer <= 0 && active < want) {
      this.spawnTimer = 0.25;
      const edges = g.roads.edges.filter((e) => e.kind !== 'roundabout');
      for (let tries = 0; tries < 12; tries++) {
        const e = edges[Math.floor(this.rng.next() * edges.length)];
        const t = this.rng.float(0.15, 0.85);
        const idx = Math.floor(t * (e.points.length - 1));
        const a = e.points[idx], b = e.points[Math.min(e.points.length - 1, idx + 1)];
        const x = a.x + (b.x - a.x) * 0.5, z = a.z + (b.z - a.z) * 0.5;
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < 70 || d > 175) continue;
        const toS = new THREE.Vector3(x - g.camera.position.x, 0, z - g.camera.position.z).normalize();
        if (toS.dot(camDir) > 0.5 && d < 120) continue; // nicht direkt vor der Kamera erscheinen
        this.spawnOn(e, this.rng.chance(0.5), t);
        break;
      }
    }
  }
}

function densify(pts, step) {
  const out = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const l = Math.hypot(q.x - p.x, q.z - p.z);
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++) out.push({ x: p.x + (q.x - p.x) * (k / n), z: p.z + (q.z - p.z) * (k / n) });
  }
  return out;
}

function trimPts(pts, cut0, cut1) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const total = len[len.length - 1];
  const out = pts.filter((p, i) => len[i] >= cut0 && len[i] <= total - cut1);
  return out.length >= 2 ? out : [pts[0], pts[pts.length - 1]];
}
