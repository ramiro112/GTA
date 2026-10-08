// Banden mit Revieren (Rostschlangen im Industriegebiet, Kaiwölfe am Hafen):
// Gruppen an Treffpunkten, Warnung bei Revierverletzung, Gruppenangriff mit Flankieren und
// Deckung, Rückzug, Verstärkung (per Auto). Ausserdem Wachen (Militär, Flughafen).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { GANG_TURFS, MILITARY, AIRPORT } from '../world/layout.js';
import { CombatBrain, guardBrain } from './brains.js';
import { events } from '../core/events.js';
import { Random } from '../core/random.js';

const WEAPONS = {
  rust: [['bat', 0.35], ['pistol', 0.5], ['smg', 0.15]],
  wolves: [['pistol', 0.45], ['smg', 0.4], ['shotgun', 0.15]],
};
const WARN = ['Das ist unser Revier! Verschwinde!', 'Hey! Hier hast du nichts verloren!', 'Noch ein Schritt und es knallt!'];
const ATTACK = ['Schnappt ihn euch!', 'Jetzt reicht es!', 'Los, Jungs!'];

export class GangSystem {
  constructor(game) {
    this.game = game;
    game.gangs = this;
    this.rng = new Random(77);
    this.groups = [];
    this.spots = game.layout.gangSpots.map((s) => ({ ...s, group: null, cooldown: 0 }));
    this.guards = [];
    this.guardSpots = [
      ...MILITARY.guardSpots.map((s) => ({ ...s, kind: 'soldier', zone: 'military', npc: null })),
      { x: AIRPORT.hangars[0].x + 22, z: AIRPORT.hangars[0].z + 18, kind: 'cop', zone: 'airport', npc: null },
      { x: AIRPORT.helipads[0].x - 10, z: AIRPORT.helipads[0].z + 12, kind: 'cop', zone: 'airport', npc: null },
    ];
    this.hostile = { rust: 0, wolves: 0 };  // Feindseligkeit (steigt, wenn der Spieler Mitglieder angreift)
    events.on('npc:damaged', (e) => {
      const n = e.npc;
      if (n.gangGroup && e.info.source && e.info.source.isPlayer) this.provoke(n.gangGroup, 'attacked');
    });
    events.on('npc:killed', (e) => {
      const n = e.npc;
      if (n.gangGroup && e.info.source && e.info.source.isPlayer) {
        this.hostile[n.faction] = Math.min(10, (this.hostile[n.faction] || 0) + 1);
        events.emit('gang:killed', { gang: n.faction, npc: n });
      }
    });
  }

  get characters() { return []; }

  turfAt(x, z) {
    for (const t of GANG_TURFS) if (x >= t.minX && x <= t.maxX && z >= t.minZ && z <= t.maxZ) return t;
    return null;
  }

  _weaponFor(gang) {
    let r = this.rng.next();
    for (const [w, p] of WEAPONS[gang]) { r -= p; if (r <= 0) return w; }
    return 'pistol';
  }

  /** Bandenmitglied erzeugen (auch für Missionen). */
  spawnMember(gang, x, z, group = null, opts = {}) {
    const g = this.game;
    const npc = g.population.spawn({ kind: 'gang_' + gang, x, z, heading: this.rng.float(0, 6.28) });
    npc.give(opts.weapon || this._weaponFor(gang), 999);
    npc.gangGroup = group;
    npc.persistent = !!opts.persistent;
    npc.brain = new CombatBrain({
      target: () => (group ? (group.provoked ? (group.target || g.player) : null) : g.player),
      accuracy: CONFIG.ai.gangAccuracy * (opts.accuracyMul || 1),
      range: npc.inventory.current.def.type === 'melee' ? [1, 2] : [7, 22],
      useCover: true,
      fleeAt: opts.boss ? 0 : 0.22,
      flankAngle: group ? [0, 0.9, -0.9, 1.6, -1.6, 2.2][group.members.length % 6] : 0,
      onAlert: (n, t, fleeing) => { if (group) this.provoke(group, fleeing ? 'reinforce' : 'seen'); },
      idleAnim: this.rng.chance(0.5) ? 'talk' : null,
      home: { x, z },
      leash: opts.leash || 140,
    });
    if (opts.health) npc.health = npc.maxHealth = opts.health;
    if (group) group.members.push(npc);
    return npc;
  }

  _spawnGroup(spot) {
    const group = { gang: spot.gang, spot, members: [], provoked: false, warned: 0, reinforcements: 0, target: null };
    const n = 3 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawnMember(spot.gang, spot.x + Math.cos(a) * 2.5, spot.z + Math.sin(a) * 2.5, group);
    }
    // Ins Gespräch vertieft: einander ansehen
    for (const m of group.members) m.heading = Math.atan2(spot.x - m.pos.x, spot.z - m.pos.z);
    this.groups.push(group);
    spot.group = group;
    return group;
  }

  /** Gruppe wird feindselig. */
  provoke(group, why) {
    if (!group.provoked) {
      group.provoked = true;
      const speaker = group.members.find((m) => !m.dead);
      if (speaker) speaker.say(ATTACK[this.rng.int(0, ATTACK.length - 1)], 2);
      events.emit('gang:attack', { gang: group.gang, why });
    }
    if (why === 'reinforce' || (why === 'attacked' && group.members.filter((m) => m.dead).length >= 2)) this._reinforce(group);
  }

  _reinforce(group) {
    if (group.reinforcements >= 2 || this.game.missions?.active?.noReinforcements) return;
    group.reinforcements++;
    const g = this.game;
    const p = g.player.pos;
    // Verstärkung im Auto von der nächsten Strasse ~70 m entfernt
    const roads = g.roads;
    let best = null;
    for (const n of roads.nodes) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d > 55 && d < 110 && (!best || Math.abs(d - 75) < Math.abs(best.d - 75))) best = { n, d };
    }
    if (!best) return;
    const v = g.vehicles.spawn(group.gang === 'rust' ? 'suv' : 'sedan', { x: best.n.x, z: best.n.z, heading: Math.atan2(p.x - best.n.x, p.z - best.n.z), color: group.gang === 'rust' ? 0xd35400 : 0x2e86de });
    v.locked = false;
    const driver = this.spawnMember(group.gang, best.n.x, best.n.z, group);
    driver.vehicle = v; v.driver = driver;
    v.ai = { mode: 'direct', targetFn: () => g.player, maxSpeed: 22, arriveDist: 14 };
    v.gangCar = { group, arrived: false };
    if (g.traffic) g.traffic.cars.push(v);
    driver.say('Wir kommen!', 2);
    events.emit('gang:reinforcements', { gang: group.gang });
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    const p = pl.vehicle ? pl.vehicle.pos : pl.pos;
    // Gruppen an Treffpunkten
    for (const s of this.spots) {
      if (s.cooldown > 0) s.cooldown -= dt;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (!s.group && d < 130 && d > 50 && s.cooldown <= 0) this._spawnGroup(s);
    }
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const grp = this.groups[i];
      const alive = grp.members.filter((m) => !m.dead && !m.removed);
      const sd = Math.hypot(grp.spot.x - p.x, grp.spot.z - p.z);
      if (!alive.length || (sd > 210 && !grp.provoked) || (sd > 300)) {
        for (const m of grp.members) if (!m.removed && !m.dead) g.population.remove(m);
        grp.spot.group = null;
        grp.spot.cooldown = alive.length ? 30 : 240;
        this.groups.splice(i, 1);
        continue;
      }
      if (grp.provoked || pl.dead) continue;
      // Revier-Warnung
      const near = alive.find((m) => m.pos.distanceTo(pl.pos) < CONFIG.ai.gangAggroRadius && m.canSee(pl.pos, CONFIG.ai.gangAggroRadius));
      if (near) {
        if (!grp.warned) { grp.warned = 0.001; near.say(WARN[this.rng.int(0, WARN.length - 1)], 3); for (const m of alive) m.lookAt = pl.pos; }
        grp.warned += dt;
        const close = near.pos.distanceTo(pl.pos) < 22;
        const armed = pl.aiming || (this.hostile[grp.gang] || 0) > 2;
        if ((grp.warned > 6 && close) || armed) this.provoke(grp, 'turf');
      } else if (grp.warned) grp.warned = Math.max(0, grp.warned - dt * 0.5);
    }
    // Verstärkungsautos: aussteigen bei Ankunft
    if (g.traffic) for (const v of g.traffic.cars) {
      if (!v.gangCar || v.gangCar.arrived || !v.ai) continue;
      if (v.ai.arrived || v.pos.distanceTo(p) < 16) {
        v.gangCar.arrived = true;
        const grp = v.gangCar.group;
        const d = v.driver;
        if (d && !d.isPlayer) { v.driver = null; d.onJacked(v, null); d.brain = new CombatBrain({ target: () => g.player, accuracy: CONFIG.ai.gangAccuracy, range: [6, 20], useCover: true, fleeAt: 0.2 }); }
        for (let k = 0; k < 2; k++) {
          const door = v.doorPos(k ? 1 : -1);
          this.spawnMember(grp.gang, door.x, door.z, grp);
        }
        v.ai = null;
        v.controls.brake = 1;
      }
    }
    this._updateGuards(dt);
  }

  // ------------------------------------------------------------------ Wachen
  _updateGuards() {
    const g = this.game;
    const p = g.player.pos;
    const inMil = (pos) => pos.x > MILITARY.fence.minX && pos.x < MILITARY.fence.maxX && pos.z > MILITARY.fence.minZ && pos.z < MILITARY.fence.maxZ;
    const inAirport = (pos) => pos.x > -900 && pos.x < -300 && pos.z > -800 && pos.z < -660 && (g.player.vehicle ? g.player.vehicle.isAircraft : true);
    for (const s of this.guardSpots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (!s.npc && d < 220 && (s.cooldown || 0) <= 0) {
        const npc = g.population.spawn({ kind: s.kind, x: s.x, z: s.z, heading: this.rng.float(0, 6.28) });
        npc.give(s.kind === 'soldier' ? 'rifle' : 'pistol', 999);
        npc.persistent = true;
        npc.despawnable = false;
        const zone = s.zone === 'military' ? inMil : inAirport;
        npc.brain = guardBrain({ x: s.x, z: s.z }, zone, {
          accuracy: s.kind === 'soldier' ? 0.4 : 0.25,
          onAlert: () => {
            npc.say(s.kind === 'soldier' ? 'Eindringling! Feuer frei!' : 'Halt! Sicherheitsdienst!', 2.5);
            events.emit('crime', { type: 'trespass', pos: g.player.pos.clone(), zone: s.zone, byGuard: true });
            // Andere Wachen in der Nähe alarmieren
            for (const o of this.guardSpots) if (o.npc && o.zone === s.zone && o.npc.pos.distanceTo(npc.pos) < 150) o.npc.provoked = true;
          },
        });
        s.npc = npc;
        this.guards.push(npc);
      } else if (s.npc && (d > 320 || (s.npc.dead && d > 120))) {
        g.population.remove(s.npc);
        this.guards.splice(this.guards.indexOf(s.npc), 1);
        s.npc = null;
        s.cooldown = 60;
      }
      if (s.cooldown > 0) s.cooldown -= 1 / 60;
    }
  }

  mapBlips(out) {
    for (const grp of this.groups) for (const m of grp.members) if (!m.dead && grp.provoked) out.push({ x: m.pos.x, z: m.pos.z, color: '#ff3b30', size: 5 });
    for (const s of this.guards) if (!s.dead && s.provoked) out.push({ x: s.pos.x, z: s.pos.z, color: '#ff3b30', size: 5 });
  }
}

export { THREE };
