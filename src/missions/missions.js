// Missions-System: verbindet die Missions-Engine mit dem Spiel (Auftraggeber-Marker, Dialoge mit
// Untertiteln + optionaler Sprachausgabe, HUD-Ziel/Timer, Belohnungen, Checkpoint-Neustart,
// GPS-Route zum Wegpunkt, Aufräumen gespawnter Objekte).

import * as THREE from 'three';
import { MissionEngine } from './engine.js';
import { makeMarker } from './stages.js';
import { registerStory, CONTACTS } from './story.js';
import { events } from '../core/events.js';
import { t, tr, getLanguage } from '../core/i18n.js';
import { formatMoney, formatTime } from '../core/mathutil.js';
import { WEAPON_META } from '../weapons/weapondata.js';

// ------------------------------------------------------------------ Dialoge
class DialogPlayer {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.id = 0;
    this.doneIds = new Set();
  }

  /** lines: [[sprecher, deText, enText?], …] → Dialog-ID */
  play(lines) {
    const id = ++this.id;
    for (const l of lines) this.queue.push({ who: l[0], text: { de: l[1], en: l[2] || l[1] }, id });
    this.queue.push({ end: id });
    if (!this.current) this._next();
    return id;
  }

  done(id) { return this.doneIds.has(id); }
  get active() { return !!this.current; }

  _next() {
    const g = this.game;
    const n = this.queue.shift();
    if (!n) { this.current = null; g.hud.dialog(null); return; }
    if (n.end) { this.doneIds.add(n.end); this._next(); return; }
    this.current = n;
    const text = tr(n.text);
    this.timer = Math.max(2.2, text.length * 0.055);
    const who = CONTACTS[n.who] ? CONTACTS[n.who].name : n.who;
    if (g.settings.subtitles !== false) g.hud.dialog(who, text, 'Leertaste/Enter: weiter');
    if (g.settings.voice && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = getLanguage() === 'en' ? 'en-US' : 'de-DE';
        u.pitch = CONTACTS[n.who] ? CONTACTS[n.who].pitch : 1;
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      } catch { /* TTS nicht verfügbar */ }
    }
  }

  update(dt) {
    if (!this.current) return;
    this.timer -= dt;
    const inp = this.game.input;
    const skip = ['Enter', 'Space', 'NumpadEnter'].some((c) => inp.codesPressed.has(c));
    if (this.timer <= 0 || skip) this._next();
  }

  clear() { this.queue = []; for (let i = 0; i <= this.id; i++) this.doneIds.add(i); this.current = null; this.game.hud.dialog(null); }
}

// ------------------------------------------------------------------ System
export class MissionSystem {
  constructor(game) {
    this.game = game;
    game.missions = this;
    this.dialog = new DialogPlayer(game);
    this.markers = new Map();   // Missions-ID → Startmarker
    this.waypoint = null;
    this.hintTimer = 0;
    this.retryTimer = 0;
    this.userWaypoint = null;
    const host = {
      now: () => game.elapsed,
      onStart: (def) => this._onStart(def),
      onPass: (def, reward, time) => this._onPass(def, reward, time),
      onFail: (def, reason) => this._onFail(def, reason),
      onObjective: (text) => game.hud.objective(text ? `<b>▶</b> ${text}` : ''),
      onTimer: (sec) => game.hud.timer(sec),
      onCheckpoint: (def, i) => { if (i > 0) { game.hud.notify('Checkpoint erreicht'); events.emit('mission:checkpoint', { id: def.id, stage: i }); } },
      snapshot: () => this._snapshot(),
      restore: (s) => this._restore(s),
      cleanup: (entities, passed) => this._cleanup(entities, passed),
    };
    this.engine = new MissionEngine(host);
    this.kit = null;
    registerStory(game, this);
    events.on('mission:abort', (e) => {
      if (!this.engine.active) return;
      this.engine.fail(e.reason === 'busted' ? 'Du wurdest verhaftet.' : 'Du bist schwer verletzt worden.');
      this.retryTimer = 0; // nach Tod/Festnahme kein Sofort-Neustart an Ort und Stelle
      this.retryAfterRespawn = true;
    });
    events.on('player:respawn', () => { if (this.retryAfterRespawn && this.engine.failedRun) { this.retryTimer = 12; this.retryAfterRespawn = false; } });
  }

  get active() { return this.engine.active; }

  // ------------------------------------------------------------------ Hilfen für Missionen
  objective(text) { this.game.hud.objective(text ? `<b>▶</b> ${text}` : ''); }

  hint(text) {
    if (this.hintTimer > 0) return;
    this.hintTimer = 4;
    this.game.hud.help(text, 3.5);
  }

  setWaypoint(p) {
    this.waypoint = { x: p.x, z: p.z };
    this._route();
  }

  clearWaypoint() { this.waypoint = null; this.game.route = this.userWaypoint ? this.game.route : null; }

  /** GPS-Route über das Strassennetz. */
  _route() {
    const g = this.game;
    const tgt = this.waypoint || this.userWaypoint;
    if (!tgt) { g.route = null; return; }
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const a = g.roads.nearestNode(p.x, p.z), b = g.roads.nearestNode(tgt.x, tgt.z);
    const path = g.roads.findPath(a.id, b.id);
    const pts = [{ x: p.x, z: p.z }, { x: a.x, z: a.z }];
    if (path) for (const s of path) {
      const ep = s.forward ? s.edge.points : [...s.edge.points].reverse();
      for (let i = 1; i < ep.length; i++) pts.push(ep[i]);
    }
    pts.push({ x: tgt.x, z: tgt.z });
    g.route = pts;
  }

  setUserWaypoint(p) {
    this.userWaypoint = p ? { x: p.x, z: p.z } : null;
    if (!this.waypoint) this._route();
  }

  spawnVehicle(c, type, x, z, heading = 0, opts = {}) {
    const v = this.game.vehicles.spawn(type, { x, z, heading, y: opts.y, color: opts.color });
    v.persistent = true;
    v.missionVehicle = !!opts.mission;
    v.locked = !!opts.locked;
    if (!opts.keep) c.track(v);
    return v;
  }

  spawnEnemy(c, gang, x, z, opts = {}) {
    const n = this.game.gangs.spawnMember(gang, x, z, opts.group || null, { persistent: true, weapon: opts.weapon, health: opts.health, accuracyMul: opts.accuracyMul, boss: opts.boss, leash: 300 });
    n.missionTarget = true;
    if (!opts.group) n.brain.o.target = () => (this.game.player.dead ? null : this.game.player);
    c.track(n);
    return n;
  }

  spawnNPC(c, kind, x, z, opts = {}) {
    const n = this.game.population.spawn({ kind, x, z, heading: opts.heading || 0, look: opts.look });
    n.persistent = true;
    n.despawnable = false;
    n.kind = opts.kind2 || n.kind;
    c.track(n);
    return n;
  }

  // ------------------------------------------------------------------ Host-Ereignisse
  _onStart(def) {
    const g = this.game;
    g.hud.center(tr(def.title), 'passed', CONTACTS[def.giver] ? CONTACTS[def.giver].name : '', 3);
    this.objective('');
    this._cinematic(4.5);
    this.retryTimer = 0;
    events.emit('mission:start', { id: def.id });
  }

  /** Kurze Zwischensequenz: Kamerafahrt um den Spieler mit Kinobalken. */
  _cinematic(sec) {
    const g = this.game;
    const pl = g.player;
    if (pl.vehicle) return;
    if (!this.bars) {
      this.bars = document.createElement('div');
      this.bars.id = 'cinebars';
      this.bars.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      g.hud.el.hud.appendChild(this.bars);
    }
    this.bars.classList.remove('hidden');
    this.cineT = sec;
    this.cineA = g.camera3p.yaw + Math.PI * 0.75;
  }

  _updateCinematic(dt) {
    const g = this.game;
    if (!(this.cineT > 0)) return;
    this.cineT -= dt;
    const pl = g.player;
    this.cineA += dt * 0.35;
    const head = pl.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
    const pos = head.clone().add(new THREE.Vector3(Math.sin(this.cineA) * 4.5, 0.6, Math.cos(this.cineA) * 4.5));
    g.camera3p.cinematic = { pos, look: head };
    const skip = g.input.codesPressed.has('Escape');
    if (this.cineT <= 0 || pl.vehicle || skip || (g.player.speed || 0) > 1) {
      this.cineT = 0;
      g.camera3p.cinematic = null;
      this.bars.classList.add('hidden');
    }
  }

  _onPass(def, reward, time) {
    const g = this.game;
    this.objective('');
    this.clearWaypoint();
    let sub = '';
    if (reward.money) { g.economy.add(reward.money, 'Missionsbelohnung'); sub += t('hud.reward', { money: formatMoney(reward.money) }); }
    for (const w of reward.weapons || []) { g.player.inventory.give(w); sub += ` · ${tr(WEAPON_META[w].name)}`; }
    if (reward.vehicle) { g.economy.ownedVehicles.push({ type: reward.vehicle, color: reward.color || 0xffd000, tuning: { engine: 1, tires: 1, armor: 0 }, health: null }); sub += ' · Fahrzeug in deiner Garage'; }
    if (reward.unlock) g.unlocks = { ...(g.unlocks || {}), [reward.unlock]: true };
    g.stats.missionsDone++;
    g.hud.center(t('hud.missionPassed'), 'passed', `${sub}<br><small>Zeit ${formatTime(time)}</small>`, 5);
    events.emit('mission:complete', { id: def.id, reward });
    if (def.onPassed) def.onPassed(g);
  }

  _onFail(def, reason) {
    const g = this.game;
    this.dialog.clear();
    this.objective('');
    this.clearWaypoint();
    g.hud.center(t('hud.missionFailed'), 'failed', reason, 4);
    this.retryTimer = g.player.dead ? 0 : 12;
    events.emit('mission:failed', { id: def.id, reason });
  }

  _snapshot() {
    const g = this.game, pl = g.player;
    const v = pl.vehicle;
    return {
      pos: pl.pos.clone(), heading: pl.heading, health: pl.health, armor: pl.armor,
      weapons: JSON.stringify(pl.inventory.toJSON()), money: g.economy.money,
      vehicle: v ? { type: v.type, pos: v.pos.clone(), heading: v.heading, color: v.color, mission: v.missionVehicle } : null,
      hour: g.tod.hour,
    };
  }

  _restore(s) {
    const g = this.game, pl = g.player;
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    g.police.reset();
    pl.revive();
    pl.health = s.health; pl.armor = s.armor;
    pl.inventory = (pl.inventory.constructor).fromJSON(JSON.parse(s.weapons));
    g.weapons._equipModel();
    pl.teleport(s.pos.x, s.pos.y, s.pos.z, s.heading);
    if (s.vehicle && !s.vehicle.mission) {
      const v = g.vehicles.spawn(s.vehicle.type, { x: s.vehicle.pos.x, z: s.vehicle.pos.z, heading: s.vehicle.heading, color: s.vehicle.color });
      v.locked = false; v.hotwired = true; v.stolenCounted = true;
      g.vehicles._seatPlayer(v);
    }
  }

  _cleanup(entities, passed) {
    const g = this.game;
    for (const e of entities) {
      if (e.isMarker || e.isArrow) { e.remove(); continue; }
      if (e.keepAfter && passed) continue;
      if (e.isNPC) { if (!e.removed && !(e.vehicle && e.vehicle.driver && e.vehicle.driver.isPlayer)) g.population.remove(e); continue; }
      if (e.size || e.isAircraft || e.isBoat) {
        if (g.player.vehicle === e) { e.persistent = false; e.missionVehicle = false; e.blip = null; continue; }
        e.blip = null;
        g.vehicles.remove(e);
        continue;
      }
      if (e.remove) e.remove();
    }
    g.weather.locked = false;
    if (g.gangs) g.gangs.guardsDisabled = false;
    if (g.traffic) g.traffic.cars = g.traffic.cars.filter((v) => !v.removed);
  }

  // ------------------------------------------------------------------ Schleife
  update(dt) {
    const g = this.game;
    if (this.hintTimer > 0) this.hintTimer -= dt;
    this.dialog.update(dt);
    this._updateCinematic(dt);
    this.engine.update(dt);
    // Route regelmässig neu berechnen
    this._routeT = (this._routeT || 0) - dt;
    if ((this.waypoint || this.userWaypoint) && this._routeT <= 0) { this._routeT = 1.5; this._route(); }
    if (this.userWaypoint) {
      const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
      if (Math.hypot(p.x - this.userWaypoint.x, p.z - this.userWaypoint.z) < 15) { this.userWaypoint = null; if (!this.waypoint) g.route = null; }
    }
    // Neustart vom Checkpoint anbieten
    if (this.retryTimer > 0 && this.engine.failedRun && !g.player.dead) {
      this.retryTimer -= dt;
      g.hud.prompt(t('hud.restartCheckpoint', { key: '<kbd>Enter</kbd>' }));
      if (g.input.codesPressed.has('Enter') || g.input.codesPressed.has('NumpadEnter')) { this.retryTimer = 0; g.hud.prompt(null); this.engine.retryFromCheckpoint(); }
      if (this.retryTimer <= 0) g.hud.prompt(null);
    }
    this._updateStartMarkers(dt);
    this._animateMarkers(dt);
  }

  _updateStartMarkers() {
    const g = this.game;
    const avail = new Set(this.engine.available().map((m) => m.id));
    for (const [id, m] of this.markers) if (!avail.has(id)) { m.remove(); this.markers.delete(id); }
    for (const id of avail) {
      const def = this.engine.missions.get(id);
      if (!this.markers.has(id)) this.markers.set(id, makeMarker(g, def.start, { radius: 1.6, color: 0xffd23f }));
    }
    if (this.engine.active || g.player.dead || this.dialog.active) return;
    const pl = g.player;
    const p = pl.vehicle ? pl.vehicle.pos : pl.pos;
    for (const id of avail) {
      const def = this.engine.missions.get(id);
      const d = Math.hypot(p.x - def.start.x, p.z - def.start.z);
      if (d < 2.2 && (!pl.vehicle || Math.abs(pl.vehicle.speed || 0) < 2) && g.police.stars === 0) {
        this.markers.get(id)?.remove();
        this.markers.delete(id);
        this.engine.start(id);
        break;
      }
      if (d < 2.2 && g.police.stars > 0) this.hint('Erst die Polizei abschütteln, dann die Mission starten.');
    }
  }

  _animateMarkers(dt) {
    const tm = this.game.elapsed;
    for (const m of this.markers.values()) if (m.mesh.userData.arrow) { m.mesh.userData.arrow.position.y = 4 + Math.sin(tm * 3) * 0.3; m.mesh.userData.arrow.rotation.y += dt * 2; }
    const run = this.engine.active;
    if (run) for (const e of run.entities) {
      if (e.isArrow) {
        const tp = e.target.renderPos || e.target.pos;
        if (!tp) continue;
        e.mesh.position.set(tp.x, tp.y + (e.target.size ? e.target.size[1] + 1.2 : 2.6) + Math.sin(tm * 4) * 0.2, tp.z);
        e.mesh.rotation.y += dt * 3;
        e.mesh.visible = !e.target.dead && !e.target.removed;
      } else if (e.isMarker && e.mesh.userData.arrow) { e.mesh.userData.arrow.position.y = (e.mesh.children[0].geometry.parameters.height || 2.5) + 1.5 + Math.sin(tm * 3) * 0.3; }
      else if (e.isMarker && e.mesh.userData.ring) e.mesh.userData.ring.rotation.z += dt;
    }
  }

  mapBlips(out) {
    for (const id of this.engine.available().map((m) => m.id)) {
      const def = this.engine.missions.get(id);
      out.push({ x: def.start.x, z: def.start.z, icon: 'mission', color: '#c49a00', size: 9, label: tr(def.title), edge: true });
    }
    if (this.waypoint) out.push({ x: this.waypoint.x, z: this.waypoint.z, color: '#ffd23f', size: 9, edge: true, label: 'Ziel' });
    if (this.userWaypoint) out.push({ x: this.userWaypoint.x, z: this.userWaypoint.z, color: '#c86bff', size: 9, edge: true, label: 'Wegpunkt' });
    const run = this.engine.active;
    if (run) for (const e of run.entities) {
      if (e.isNPC && !e.dead && e.missionTarget) out.push({ x: e.pos.x, z: e.pos.z, color: '#ff3b30', size: 6, edge: e.boss });
      if (e.isNPC && !e.dead && e.missionFriend) out.push({ x: e.pos.x, z: e.pos.z, color: '#5ac8fa', size: 7, edge: true });
    }
  }

  toJSON() { return this.engine.toJSON(); }
  load(d) { this.engine.load(d); }
}

export { THREE };
