// Passanten-System: Gehweg-Graph (Ecken an Kreuzungen, Gehwege, Zebrastreifen), Spawnen und
// Entfernen um den Spieler mit Objekt-Pool, Dichte je Gebiet und Tageszeit, Reaktionen auf
// Schüsse/Explosionen, Zeugen von Verbrechen, Gespräche, Ladenbesitzer (Raub möglich).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { NPC, lookFor } from './npc.js';
import { PedBrain } from './brains.js';
import { districtAt, terrainHeight, WATER_Y } from '../world/terrain.js';
import { events } from '../core/events.js';
import { Random } from '../core/random.js';

const O = CONFIG.world.roadWidth / 2 + 2; // Abstand Gehwegmitte zur Strassenmitte
const DENSITY = { downtown: 1, residential: 0.8, suburb: 0.45, park: 0.7, beach: 0.9, industrial: 0.3, harbor: 0.3, airport: 0.25, military: 0, mountains: 0.05, forest: 0.05, ocean: 0 };

export class PedSystem {
  constructor(game) {
    this.game = game;
    game.peds = this;
    this.peds = [];
    this.pool = [];
    this.keepers = [];
    this.rng = new Random(9);
    this._buildGraph();
    this.spawnTimer = 0;
    this.lastCrimeWitness = -10;
    events.on('weapon:fired', (e) => this._alarmAround(e.pos, 55, 'shot', e.shooter));
    events.on('explosion', (e) => this._alarmAround(e.pos, 75, 'explosion'));
    events.on('character:runOver', (e) => this._alarmAround(e.character.pos, 20, 'car'));
    events.on('crime', (e) => this._witness(e));
  }

  get characters() { return []; } // NPCs werden über Population geführt

  // ------------------------------------------------------------------ Graph
  _buildGraph() {
    const roads = this.game.roads;
    const nodes = [];
    const key = (n, sx, sz) => `${n.id}:${sx}:${sz}`;
    const map = new Map();
    const okSpot = (x, z) => terrainHeight(x, z) > WATER_Y + 0.5 && Math.abs(terrainHeight(x, z)) < 2;
    const add = (x, z, extra = {}) => { const nd = { x, z, links: [], ...extra }; nodes.push(nd); return nd; };
    const link = (a, b, extra = {}) => {
      if (!a || !b || a === b) return;
      a.links.push({ to: b, ...extra });
      b.links.push({ to: a, ...extra });
    };
    const isStreet = (n) => n.kind === 'street';
    for (const n of roads.nodes) {
      if (!isStreet(n)) continue;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = n.x + sx * O, z = n.z + sz * O;
        if (okSpot(x, z)) map.set(key(n, sx, sz), add(x, z, { road: n }));
      }
    }
    // Arme je Knoten bestimmen
    const arms = (n) => {
      const a = { e: false, w: false, n: false, s: false };
      for (const eid of n.edges) {
        const e = roads.edges[eid];
        const o = e.a === n.id ? e.points[1] : e.points[e.points.length - 2];
        const dx = o.x - n.x, dz = o.z - n.z;
        if (Math.abs(dx) > Math.abs(dz)) a[dx > 0 ? 'e' : 'w'] = true; else a[dz > 0 ? 's' : 'n'] = true;
      }
      return a;
    };
    for (const n of roads.nodes) {
      if (!isStreet(n)) continue;
      const a = arms(n);
      const c = (sx, sz) => map.get(key(n, sx, sz));
      // Querungen bzw. Ecken
      link(c(1, 1), c(1, -1), a.e ? { cross: true, roadNode: n, crossAxis: 'ew' } : {});
      link(c(-1, 1), c(-1, -1), a.w ? { cross: true, roadNode: n, crossAxis: 'ew' } : {});
      link(c(1, 1), c(-1, 1), a.s ? { cross: true, roadNode: n, crossAxis: 'ns' } : {});
      link(c(1, -1), c(-1, -1), a.n ? { cross: true, roadNode: n, crossAxis: 'ns' } : {});
    }
    for (const e of roads.edges) {
      if (e.kind !== 'street') continue;
      const A = roads.nodes[e.a], B = roads.nodes[e.b];
      if (!isStreet(A) || !isStreet(B)) continue;
      if (Math.abs(A.z - B.z) < 1) {
        const [L, R] = A.x < B.x ? [A, B] : [B, A];
        for (const s of [-1, 1]) link(map.get(key(L, 1, s)), map.get(key(R, -1, s)));
      } else if (Math.abs(A.x - B.x) < 1) {
        const [T, Bo] = A.z < B.z ? [A, B] : [B, A];
        for (const s of [-1, 1]) link(map.get(key(T, s, 1)), map.get(key(Bo, s, -1)));
      }
    }
    // Freie Bereiche: Parks und Strand als lose verbundene Punkte
    const roam = [];
    for (const b of this.game.layout.blocks) {
      if (b.district !== 'park' && b.district !== 'suburb') continue;
      for (let k = 0; k < (b.district === 'park' ? 10 : 3); k++) {
        const x = this.rng.float(b.minX + 6, b.maxX - 6), z = this.rng.float(b.minZ + 6, b.maxZ - 6);
        if (!okSpot(x, z) || this.game.collision.resolveCircle(x, z, 0.5, 0, 1.8).hit) continue;
        roam.push(add(x, z, { roam: true }));
      }
    }
    for (let x = -640; x < 860; x += 22) {
      const z = this.rng.float(530, 585);
      if (okSpot(x, z)) roam.push(add(x, z, { roam: true, beach: true }));
    }
    for (const r of roam) {
      const near = nodes.filter((n) => n !== r && Math.hypot(n.x - r.x, n.z - r.z) < 32).sort((a, b) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z)).slice(0, 3);
      for (const n of near) if (!r.links.some((l) => l.to === n)) link(r, n);
    }
    this.graph = nodes.filter((n) => n.links.length);
    // Spatial-Index (Gitter 50 m)
    this.grid = new Map();
    for (const n of this.graph) {
      const k = `${Math.floor(n.x / 50)},${Math.floor(n.z / 50)}`;
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(n);
    }
  }

  nearestNode(x, z) {
    let best = null, bd = Infinity;
    const cx = Math.floor(x / 50), cz = Math.floor(z / 50);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const n of this.grid.get(`${cx + i},${cz + j}`) || []) {
        const d = (n.x - x) ** 2 + (n.z - z) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best || this.graph[0];
  }

  _nodesInRing(px, pz, r0, r1) {
    const out = [];
    const c0x = Math.floor((px - r1) / 50), c1x = Math.floor((px + r1) / 50);
    const c0z = Math.floor((pz - r1) / 50), c1z = Math.floor((pz + r1) / 50);
    for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
      for (const n of this.grid.get(`${i},${j}`) || []) {
        const d = Math.hypot(n.x - px, n.z - pz);
        if (d > r0 && d < r1) out.push(n);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ Spawnen
  targetCount() {
    const g = this.game;
    const base = CONFIG.ai.pedCount[g.quality.name] || CONFIG.ai.pedCount.medium;
    const d = districtAt(g.player.pos.x, g.player.pos.z).id;
    const dens = DENSITY[d] ?? 0.3;
    const night = 1 - g.tod.night * (1 - CONFIG.ai.nightDensityFactor);
    const rain = 1 - g.weather.state.rain * 0.5;
    return Math.round(base * dens * night * rain * (g.densityMul ?? 1));
  }

  _spawnPed(node) {
    const pop = this.game.population;
    let npc = this.pool.pop();
    const look = lookFor('ped');
    if (npc) {
      npc.reinit({ kind: 'ped', x: node.x, z: node.z, look });
      pop.characters.push(npc);
    } else npc = pop.spawn({ kind: 'ped', x: node.x, z: node.z, look });
    const W = CONFIG.ai.behaviorWeights;
    const r = this.rng.float(0, W.peaceful + W.scared + W.aggressive);
    const type = r < W.peaceful ? 'peaceful' : r < W.peaceful + W.scared ? 'scared' : 'aggressive';
    npc.brain = new PedBrain(this, type);
    npc.brain.node = node;
    npc.brain.target = node.links[0] ? node.links[Math.floor(this.rng.next() * node.links.length)].to : node;
    npc.isPed = true;
    if (type === 'aggressive' && this.rng.chance(0.15)) npc.give('pistol', 24), npc.equip('fist');
    this.peds.push(npc);
    return npc;
  }

  _despawn(npc) {
    const i = this.peds.indexOf(npc);
    if (i >= 0) this.peds.splice(i, 1);
    const pop = this.game.population;
    const k = pop.characters.indexOf(npc);
    if (k >= 0) pop.characters.splice(k, 1);
    npc.model.root.visible = false;
    if (this.pool.length < 40) this.pool.push(npc); else npc.remove();
  }

  update(dt) {
    const g = this.game;
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    // Entfernen
    for (const n of [...this.peds]) {
      if (n.removed) { this.peds.splice(this.peds.indexOf(n), 1); continue; }
      const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
      if (d > CONFIG.ai.despawnRadius || (n.dead && n.deadTime > 30 && d > 40) || (n.dead && n.deadTime > 60)) this._despawn(n);
      else if (n.vehicle === null && n.brain && n.brain.constructor.name === 'PedBrain' && d > 60 && n.brain.state === 'flee' && n.brain.timer < 0) n.brain.state = 'walk';
    }
    // Spawnen (max. 2 pro Frame)
    this.spawnTimer -= dt;
    const want = this.targetCount();
    const alive = this.peds.filter((n) => !n.dead).length;
    if (this.spawnTimer <= 0 && alive < want) {
      this.spawnTimer = 0.15;
      const cands = this._nodesInRing(p.x, p.z, CONFIG.ai.minSpawnDistance, CONFIG.ai.spawnRadius);
      for (let k = 0; k < 2 && cands.length; k++) this._spawnPed(cands[Math.floor(this.rng.next() * cands.length)]);
    }
    this._updateKeepers();
  }

  // ------------------------------------------------------------------ Gespräche
  tryTalk(npc) {
    for (const o of this.peds) {
      if (o === npc || o.dead || !o.brain || o.brain.state !== 'walk') continue;
      if (Math.hypot(o.pos.x - npc.pos.x, o.pos.z - npc.pos.z) < 3.5) {
        const t = 4 + Math.random() * 5;
        npc.brain.startTalk(npc, o, t);
        o.brain.startTalk(o, npc, t);
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ Reaktionen
  _alarmAround(pos, radius, kind, shooter = null) {
    if (!pos) return;
    for (const n of this.peds) {
      if (n.dead || n === shooter || !n.brain || !n.brain.alarm) continue;
      if (n.pos.distanceTo(pos) < radius) n.brain.alarm(n, pos, kind);
    }
    for (const k of this.keepers) if (!k.dead && k.pos.distanceTo(pos) < 20 && k.brain && k.brain.alarm) k.brain.alarm(k, pos, kind);
  }

  /** Zeugen: Passanten in der Nähe mit Sicht melden das Verbrechen. */
  _witness(crime) {
    if (!crime.pos || crime.byPolice) return;
    let reporters = 0;
    const R = CONFIG.ai.witnessRadius;
    for (const n of this.peds) {
      if (n.dead || !n.brain || !n.brain.witness) continue;
      if (n.pos.distanceTo(crime.pos) > R) continue;
      if (!n.canSee(crime.pos, R)) continue;
      if (n.brain.witness(n, crime)) reporters++;
      if (reporters >= 2) break;
    }
    crime.witnessed = reporters > 0;
  }

  // ------------------------------------------------------------------ Ladenbesitzer
  _updateKeepers() {
    const g = this.game;
    const p = g.player.pos;
    for (const spot of g.city.landmarks.keepers) {
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (!spot.npc && d < 90) {
        const npc = g.population.spawn({ kind: 'keeper', x: spot.x, z: spot.z, heading: spot.heading || 0 });
        npc.persistent = true;
        npc.despawnable = false;
        npc.brain = new KeeperBrain(spot);
        npc.spot = spot;
        spot.npc = npc;
        this.keepers.push(npc);
      } else if (spot.npc && (d > 140 || (spot.npc.dead && spot.npc.deadTime > 20 && d > 50))) {
        g.population.remove(spot.npc);
        this.keepers.splice(this.keepers.indexOf(spot.npc), 1);
        spot.npc = null;
      }
    }
  }
}

/** Ladenbesitzer: steht hinter der Theke; wird er mit der Waffe bedroht, gibt er die Kasse heraus. */
class KeeperBrain {
  constructor(spot) { this.spot = spot; this.threat = 0; this.robbed = false; this.state = 'idle'; }
  update(npc, dt) {
    const g = npc.game;
    const pl = g.player;
    npc.stop();
    if (this.state === 'flee') { npc.forcedAnim = 'cower'; return; }
    npc.heading = this.spot.heading || npc.heading;
    const d = pl.pos.distanceTo(npc.pos);
    const w = pl.inventory ? pl.inventory.current : null;
    let aimingAtMe = false;
    if (pl.aiming && w && w.def.type === 'gun' && d < 12) {
      const dir = g.camera.getWorldDirection(new THREE.Vector3());
      const to = npc.pos.clone().add(new THREE.Vector3(0, 1.3, 0)).sub(g.camera.position).normalize();
      aimingAtMe = dir.dot(to) > 0.97;
    }
    if (aimingAtMe && !this.robbed) {
      npc.forcedAnim = 'hands';
      this.threat += dt;
      if (this.threat > 0.3 && this.threat - dt <= 0.3) npc.say('Nicht schiessen! Nehmen Sie das Geld!', 2.5);
      if (this.threat > 2.5) {
        this.robbed = true;
        const cash = Math.round(CONFIG.economy.robberyMin + Math.random() * (CONFIG.economy.robberyMax - CONFIG.economy.robberyMin));
        g.weapons.dropPickup('money', npc.pos.clone().add(new THREE.Vector3(Math.sin(npc.heading) * 1.5, 0, Math.cos(npc.heading) * 1.5)), cash);
        events.emit('crime', { type: 'robbery', pos: npc.pos.clone() });
        events.emit('shop:robbed', { keeper: npc, cash });
        setTimeout(() => { this.robbed = false; }, 300000);
      }
    } else {
      this.threat = Math.max(0, this.threat - dt);
      npc.forcedAnim = this.threat > 0 ? 'hands' : null;
      if (d < 6 && !pl.vehicle) npc.lookAt = pl.pos; else npc.lookAt = null;
    }
  }
  alarm(npc) { this.state = 'flee'; setTimeout(() => { this.state = 'idle'; }, 20000); }
  onDamage(npc) { this.state = 'flee'; }
}
