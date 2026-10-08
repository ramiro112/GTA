// Verhaltensweisen ("Gehirne") der NPCs:
//  - PedBrain: Passanten (friedlich, ängstlich, aggressiv): laufen auf Gehwegen, warten an Ampeln,
//    unterhalten sich, fliehen, geraten in Panik, wehren sich, melden Verbrechen (Zeugen).
//  - CombatBrain: Kämpfer (Gangster, Polizei, SEK, Soldaten, Wachen, Missionsgegner):
//    Ziel verfolgen (A*), Abstand halten, flankieren, Deckung suchen, schiessen, fliehen.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { findGridPath, clearLine } from './pathfinding.js';
import { lightState } from '../world/roads.js';
import { events } from '../core/events.js';
import { clamp } from '../core/mathutil.js';

const TALK_LINES = {
  de: ['Hast du das Spiel gestern gesehen?', 'Die Mieten hier sind Wahnsinn.', 'Ich muss noch einkaufen.', 'Schönes Wetter heute, oder?', 'Mein Chef nervt total.', 'Kennst du den neuen Imbiss am Hafen?', 'Ich hab gehört, im Rostfeld ist was los.', 'Wollen wir morgen an den Strand?'],
};
const PANIC_LINES = ['Hilfe!', 'Lauft!', 'Polizei!', 'Nicht schiessen!', 'Weg hier!', 'Oh nein!'];
const ANGRY_LINES = ['Was soll das?!', 'Pass doch auf!', 'Na warte!', 'Hey, du Idiot!'];
const REPORT_LINES = ['Hallo, Polizei? Hier wird geschossen!', 'Ich möchte ein Verbrechen melden!', 'Schicken Sie sofort jemanden!'];

// ============================================================================ Passanten
export class PedBrain {
  constructor(peds, type = 'peaceful') {
    this.peds = peds;           // PedSystem (Graph, Ampeln)
    this.type = type;           // 'peaceful' | 'scared' | 'aggressive'
    this.state = 'walk';
    this.timer = 0;
    this.node = null;           // aktueller Ecken-Knoten
    this.prevNode = null;
    this.target = null;         // nächster Knoten
    this.fleeFrom = null;
    this.partner = null;
    this.waitCross = null;
  }

  update(npc, dt) {
    this.timer -= dt;
    switch (this.state) {
      case 'walk': this._walk(npc, dt); break;
      case 'wait':
        npc.stop();
        if (this._canCross()) { this.state = 'walk'; this.waitCross = null; }
        if (this.timer < -25) { this.state = 'walk'; this.waitCross = null; }
        break;
      case 'talk':
        npc.stop();
        npc.forcedAnim = 'talk';
        if (this.partner) npc.lookAt = this.partner.pos;
        if (this.timer <= 0 || !this.partner || this.partner.dead) this._endTalk(npc);
        break;
      case 'flee': {
        npc.forcedAnim = null;
        npc.lookAt = null;
        const from = this.fleeFrom || npc.pos;
        const away = new THREE.Vector3(npc.pos.x - from.x, 0, npc.pos.z - from.z);
        if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        away.normalize();
        if (npc.blocked > 0.4) away.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 * (npc.id % 2 ? 1 : -1));
        npc.goTo(npc.pos.x + away.x * 10, npc.pos.z + away.z * 10, CONFIG.ai.pedRunSpeed);
        if (this.timer <= 0) { this.state = 'walk'; this.node = null; }
        break;
      }
      case 'cower':
        npc.stop();
        npc.forcedAnim = 'cower';
        if (this.timer <= 0) { npc.forcedAnim = null; this.state = 'flee'; this.timer = 8; }
        break;
      case 'report':
        npc.stop();
        npc.forcedAnim = 'talk';
        if (this.timer <= 0) {
          npc.forcedAnim = null;
          events.emit('witness:report', { crime: this.crime, npc });
          npc.say(REPORT_LINES[npc.id % REPORT_LINES.length], 2.5);
          this.state = 'flee'; this.timer = 6;
        }
        break;
      case 'hands':
        npc.stop();
        npc.forcedAnim = 'hands';
        if (this.timer <= 0) { npc.forcedAnim = null; this.state = 'flee'; this.timer = 6; }
        break;
      default:
        this.state = 'walk';
    }
  }

  _walk(npc, dt) {
    npc.forcedAnim = null;
    npc.lookAt = null;
    const g = this.peds.graph;
    if (!this.node) {
      this.node = this.peds.nearestNode(npc.pos.x, npc.pos.z);
      this.target = this.node;
    }
    if (!this.target) { npc.stop(); return; }
    const d = Math.hypot(this.target.x - npc.pos.x, this.target.z - npc.pos.z);
    if (d < 1.0) {
      // Nächsten Knoten wählen (nicht zurück, wenn möglich)
      this.prevNode = this.node;
      this.node = this.target;
      const opts = this.node.links.filter((l) => l.to !== this.prevNode);
      const link = (opts.length ? opts : this.node.links)[Math.floor(Math.random() * (opts.length || this.node.links.length))];
      if (!link) { npc.stop(); return; }
      this.target = link.to;
      this.crossing = link.cross ? link : null;
      if (this.crossing && !this._canCross()) { this.state = 'wait'; this.timer = 0; this.waitCross = link; }
    }
    void g; void dt;
    const sp = (this.type === 'scared' ? 1.1 : 1) * CONFIG.ai.pedWalkSpeed * (0.85 + (npc.id % 7) * 0.05);
    npc.goTo(this.target.x, this.target.z, this.crossing ? sp * 1.4 : sp);
    // Gelegentlich stehen bleiben und unterhalten
    if (Math.random() < dt * 0.02 && !this.crossing) this.peds.tryTalk(npc);
  }

  _canCross() {
    const c = this.crossing || this.waitCross;
    if (!c) return true;
    const node = c.roadNode;
    if (node && node.light) {
      // Querung über eine N-S-Strasse geht in O-W-Richtung → N-S-Verkehr muss rot haben
      return lightState(node, c.crossAxis, this.peds.game.elapsed) === 'red';
    }
    // Ohne Ampel: kein Auto in der Nähe
    for (const v of this.peds.game.vehicles.list) {
      if (Math.abs(v.speed || 0) > 2 && Math.hypot(v.pos.x - c.to.x, v.pos.z - c.to.z) < 18) return false;
    }
    return true;
  }

  startTalk(npc, partner, seconds) {
    this.state = 'talk';
    this.partner = partner;
    this.timer = seconds;
    npc.say(TALK_LINES.de[(npc.id * 7) % TALK_LINES.de.length], 3);
  }

  _endTalk(npc) {
    this.state = 'walk';
    npc.forcedAnim = null;
    npc.lookAt = null;
    this.partner = null;
  }

  /** Gefahr wahrgenommen (Schüsse, Explosion, Unfall). */
  alarm(npc, pos, kind = 'shot') {
    if (this.state === 'flee' && this.timer > 3) return;
    const d = npc.pos.distanceTo(pos);
    npc.forcedAnim = null;
    this.partner = null;
    if (this.type === 'aggressive' && kind === 'pushed') return;
    if (d < 12 && Math.random() < 0.35 && kind !== 'car') { this.state = 'cower'; this.timer = 2 + Math.random() * 3; }
    else { this.state = 'flee'; this.timer = 8 + Math.random() * 6; this.fleeFrom = pos.clone(); }
    if (Math.random() < 0.3) npc.say(PANIC_LINES[npc.id % PANIC_LINES.length], 1.5);
  }

  /** Zeuge eines Verbrechens. */
  witness(npc, crime) {
    if (this.state === 'report') return false;
    this.state = 'report';
    this.timer = CONFIG.ai.witnessReportTime;
    this.crime = crime;
    return true;
  }

  onDamage(npc, amount, info) {
    const src = info.source;
    if (this.type === 'aggressive' && src && !src.dead && info.type !== 'vehicle' && info.type !== 'explosion') {
      npc.say(ANGRY_LINES[npc.id % ANGRY_LINES.length], 2);
      npc.hostile = true;
      npc.brain = new CombatBrain({ target: () => src, accuracy: 0.25, range: [1, 15], useCover: false, fleeAt: 0.25, giveUpAfter: 25 });
      return;
    }
    this.alarm(npc, src && src.pos ? src.pos : npc.pos, 'hurt');
  }

  /** Aus dem Auto gezerrt: fliehen, kämpfen oder Waffe ziehen. */
  onJacked(npc, vehicle, by) {
    const r = Math.random();
    const R = CONFIG.vehicleCommon.driverReaction;
    if (!by) { this.alarm(npc, vehicle.pos, 'car'); return; }
    if (r < R.flee || this.type === 'scared') {
      npc.say(PANIC_LINES[npc.id % PANIC_LINES.length], 1.5);
      this.state = 'flee'; this.timer = 10; this.fleeFrom = by.pos.clone();
    } else if (r < R.flee + R.fight) {
      npc.say('Mein Auto! Na warte!', 2);
      npc.hostile = true;
      npc.brain = new CombatBrain({ target: () => by, accuracy: 0.2, range: [1, 10], useCover: false, fleeAt: 0.3, giveUpAfter: 20 });
    } else {
      npc.say('Das bereust du!', 2);
      npc.give('pistol', 36);
      npc.hostile = true;
      npc.brain = new CombatBrain({ target: () => by, accuracy: 0.22, range: [6, 18], useCover: true, fleeAt: 0.3, giveUpAfter: 25 });
    }
  }
}

// ============================================================================ Kämpfer
export class CombatBrain {
  /**
   * @param {object} o
   *  target: (npc) => Figur|null
   *  accuracy, range [min, max], useCover, fleeAt (Anteil Gesundheit), home {x,z}, leash,
   *  onAlert(npc), giveUpAfter (s ohne Sicht), flankAngle, arrest (Polizei versucht Festnahme)
   */
  constructor(o = {}) {
    this.o = { accuracy: 0.3, range: [8, 25], useCover: true, fleeAt: 0, leash: 120, giveUpAfter: 0, ...o };
    this.state = 'engage';
    this.timer = 0;
    this.losTimer = 0;
    this.los = false;
    this.lastSeen = null;
    this.path = null;
    this.pathTimer = 0;
    this.cover = null;
    this.coverPhase = 0;
    this.noSight = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.alerted = false;
  }

  update(npc, dt) {
    const o = this.o;
    const g = npc.game;
    this.timer -= dt;
    let t = o.target ? o.target(npc, dt) : null;
    if (t && (t.dead || t.removed)) t = null;
    if (!t) {
      npc.aiming = false; npc.lookAt = null; npc.crouch = false;
      if (o.home && Math.hypot(npc.pos.x - o.home.x, npc.pos.z - o.home.z) > 3) npc.goTo(o.home.x, o.home.z, 2);
      else { npc.stop(); if (o.homeHeading !== undefined) npc.heading = o.homeHeading; }
      if (o.idleAnim) npc.forcedAnim = o.idleAnim;
      return;
    }
    npc.forcedAnim = null;
    const tp = t.vehicle ? (t.vehicle.renderPos || t.vehicle.pos) : t.pos;
    const dist = Math.hypot(tp.x - npc.pos.x, tp.z - npc.pos.z);
    // Sichtprüfung gedrosselt
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.25 + Math.random() * 0.2;
      this.los = npc.canSee(tp, Math.max(o.range[1] * 2.5, 60));
      if (this.los) { this.lastSeen = tp.clone(); this.noSight = 0; }
    }
    if (!this.los) this.noSight += dt;
    if (!this.alerted && this.los) { this.alerted = true; if (o.onAlert) o.onAlert(npc, t); }
    if (o.giveUpAfter && this.noSight > o.giveUpAfter) { o.target = () => null; npc.hostile = false; return; }
    // Flucht bei wenig Gesundheit
    if (o.fleeAt && npc.health < npc.maxHealth * o.fleeAt && this.state !== 'flee') {
      this.state = 'flee'; this.timer = 10;
      npc.say(npc.faction === 'police' ? 'Ich brauche Unterstützung!' : 'Rückzug! Verstärkung!', 2);
      if (o.onAlert) o.onAlert(npc, t, true);
    }
    if (this.state === 'flee') {
      npc.aiming = false; npc.crouch = false;
      const away = new THREE.Vector3(npc.pos.x - tp.x, 0, npc.pos.z - tp.z).normalize();
      npc.goTo(npc.pos.x + away.x * 10, npc.pos.z + away.z * 10, 5.5);
      if (this.timer <= 0) this.state = 'engage';
      return;
    }
    // Leine (Wachen kehren zurück)
    if (o.home && Math.hypot(npc.pos.x - o.home.x, npc.pos.z - o.home.z) > o.leash) { npc.goTo(o.home.x, o.home.z, 4); return; }

    const w = npc.inventory.current;
    const melee = w.def.type === 'melee';
    npc.lookAt = tp;
    if (melee) {
      npc.aiming = false;
      if (dist > w.def.range + 0.3) this._moveTo(npc, tp, 5.2, dt);
      else { npc.stop(); if (this.los) g.weapons.npcFire(npc, t, 1); }
      return;
    }
    // Fernkampf
    const [rMin, rMax] = o.range;
    if (!this.los) {
      npc.aiming = false; npc.crouch = false; this.cover = null;
      const goal = this.lastSeen || tp;
      this._moveTo(npc, goal, 4.6, dt);
      return;
    }
    // Deckung suchen
    if (o.useCover && !this.cover && Math.random() < dt * 0.6) this.cover = this._findCover(npc, tp);
    if (this.cover) {
      const dc = Math.hypot(this.cover.x - npc.pos.x, this.cover.z - npc.pos.z);
      if (dc > 0.8) { npc.aiming = false; npc.crouch = false; npc.goTo(this.cover.x, this.cover.z, 4.8); this.coverPhase = 0; }
      else {
        npc.stop();
        // Abwechselnd ducken und schiessen
        this.coverPhase += dt;
        const cyc = this.coverPhase % 3.2;
        const peek = cyc > 1.4;
        npc.crouch = !peek;
        npc.aiming = peek;
        if (peek && this.los) g.weapons.npcFire(npc, t, o.accuracy);
        if (dist < rMin * 0.6 || this.coverPhase > 14) { this.cover = null; this.coverPhase = 0; }
      }
      return;
    }
    npc.crouch = false;
    npc.aiming = true;
    // Position: Abstand halten, seitlich ausweichen, flankieren
    if (dist > rMax) {
      const goal = o.flankAngle ? this._flankPoint(npc, tp, (rMin + rMax) / 2) : tp;
      this._moveTo(npc, goal, 4.2, dt);
    } else if (dist < rMin) {
      const away = new THREE.Vector3(npc.pos.x - tp.x, 0, npc.pos.z - tp.z).normalize();
      npc.goTo(npc.pos.x + away.x * 4, npc.pos.z + away.z * 4, 3);
    } else {
      if (Math.random() < dt * 0.4) this.strafe *= -1;
      const side = new THREE.Vector3(-(tp.z - npc.pos.z), 0, tp.x - npc.pos.x).normalize().multiplyScalar(this.strafe * 2);
      npc.goTo(npc.pos.x + side.x, npc.pos.z + side.z, 1.6);
    }
    if (this.los) g.weapons.npcFire(npc, t, o.accuracy);
  }

  _flankPoint(npc, tp, r) {
    const a = Math.atan2(npc.pos.x - tp.x, npc.pos.z - tp.z) + (this.o.flankAngle || 0);
    return new THREE.Vector3(tp.x + Math.sin(a) * r, tp.y, tp.z + Math.cos(a) * r);
  }

  /** Bewegung mit A*-Weg bei verdeckter Sicht. */
  _moveTo(npc, goal, speed, dt) {
    const col = npc.game.collision;
    this.pathTimer -= dt;
    const direct = clearLine(col, npc.pos.x, npc.pos.z, goal.x, goal.z, npc.pos.y);
    if (direct) { this.path = null; npc.goTo(goal.x, goal.z, speed); return; }
    if (!this.path || this.pathTimer <= 0) {
      this.pathTimer = 2 + Math.random();
      this.path = findGridPath(col, npc.pos.x, npc.pos.z, goal.x, goal.z, npc.pos.y, { maxNodes: 1500, margin: 20 }) || [];
    }
    while (this.path.length && Math.hypot(this.path[0].x - npc.pos.x, this.path[0].z - npc.pos.z) < 1.2) this.path.shift();
    const wp = this.path[0] || goal;
    npc.goTo(wp.x, wp.z, speed);
  }

  /** Deckungspunkt hinter einer Box oder einem Fahrzeug (vom Ziel abgewandt). */
  _findCover(npc, tp) {
    const col = npc.game.collision;
    const list = col.query(npc.pos.x - 14, npc.pos.z - 14, npc.pos.x + 14, npc.pos.z + 14, []);
    let best = null, bd = Infinity;
    const consider = (cx, cz, hx, hz) => {
      const ax = cx - tp.x, az = cz - tp.z;
      const l = Math.hypot(ax, az) || 1;
      const ext = Math.abs(ax / l) * hx + Math.abs(az / l) * hz;
      const px = cx + (ax / l) * (ext + 0.8), pz = cz + (az / l) * (ext + 0.8);
      const d = Math.hypot(px - npc.pos.x, pz - npc.pos.z);
      const dt = Math.hypot(px - tp.x, pz - tp.z);
      if (d < bd && dt > 5 && dt < this.o.range[1] * 1.5) {
        const r = col.resolveCircle(px, pz, 0.35, npc.pos.y, npc.pos.y + 1.6, 0.4);
        if (!r.hit) { bd = d; best = { x: px, z: pz }; }
      }
    };
    for (const b of list) {
      if (!b.solid || b.maxY - b.minY < 0.9 || b.maxY < npc.pos.y + 0.9 || b.minY > npc.pos.y + 0.5) continue;
      const hx = (b.maxX - b.minX) / 2, hz = (b.maxZ - b.minZ) / 2;
      if (hx > 20 || hz > 20) continue;
      consider((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, hx, hz);
    }
    for (const v of npc.game.vehicles.list) {
      if (!v.size || v.isAircraft || Math.hypot(v.pos.x - npc.pos.x, v.pos.z - npc.pos.z) > 14) continue;
      consider(v.pos.x, v.pos.z, v.size[0] / 2, v.size[2] / 2);
    }
    return best;
  }

  onDamage(npc, amount, info) {
    if (info.source && !this.o.lockTarget && info.source !== npc && !info.source.dead) {
      const src = info.source;
      if (src.isPlayer || src.faction !== npc.faction) this.o.target = () => src;
    }
    this.cover = null;
  }
}

/** Wache: steht am Posten, greift Eindringlinge in einer Zone an. */
export function guardBrain(home, zoneTest, opts = {}) {
  return new CombatBrain({
    home, homeHeading: home.heading || 0, leash: opts.leash || 80, range: [8, 30], useCover: true, accuracy: opts.accuracy || 0.3,
    target: (npc, dt) => {
      const p = npc.game.player;
      if (p.dead) return null;
      if (npc.provoked) return p;
      // Erst warnen, dann schiessen: wer nach der Warnzeit noch im Sperrgebiet ist, wird angegriffen.
      if (zoneTest(p.pos) && npc.canSee(p.pos, 45)) {
        if (npc.warnT === undefined) { npc.warnT = 0; if (opts.onWarn) opts.onWarn(npc); }
        npc.warnT += dt || 0;
        if (npc.warnT >= CONFIG.ai.guardWarnTime) { npc.provoked = true; if (opts.onAlert) opts.onAlert(npc); return p; }
      } else if (npc.warnT !== undefined && !zoneTest(p.pos)) npc.warnT = undefined;
      return null;
    },
    ...opts,
  });
}

export { clamp };
