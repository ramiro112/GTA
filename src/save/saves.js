// Spielstände: 3 manuelle Slots (nur in Unterkünften speicherbar) + Autosave (Missions-Checkpoints,
// erledigte Missionen, Immobilienkauf). Speicherung in localStorage (Fallback: Arbeitsspeicher).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { defaultState, encode, decode } from './serialize.js';
import { WeaponInventory } from '../weapons/weapondata.js';
import { Inventory } from '../economy/shops.js';
import { WantedLevel } from '../police/wanted.js';
import { districtAt } from '../world/terrain.js';
import { tr, t } from '../core/i18n.js';
import { events } from '../core/events.js';

const KEY = CONFIG.save.key;

export class SaveSystem {
  constructor(game) {
    this.game = game;
    game.saves = this;
    this.storage = game.storage;
    game.newGame = () => this.apply(defaultState(), true);
    game.interactions.register('save', {
      label: () => 'Spiel speichern (Bett)',
      available: (pt) => game.economy.ownedProperties.has(pt.property || 'home') && !game.missions.active && game.police.stars === 0,
      action: () => { game.ui.mode = 'pause'; game.pause(true); game.ui.showSlots('save', () => game.ui.resume()); },
    });
    const auto = (why) => () => this.autosave(why);
    events.on('mission:checkpoint', auto('Checkpoint'));
    events.on('mission:complete', auto('Mission erledigt'));
    events.on('property:bought', auto('Immobilie'));
  }

  /** Steht der Spieler an einem Speicherpunkt (Bett in einer eigenen Unterkunft)? */
  canSaveHere() {
    const g = this.game;
    const cur = g.interactions.current;
    if (g.missions.active || g.police.stars > 0) return false;
    if (cur && cur.type === 'save' && g.economy.ownedProperties.has(cur.property || 'home')) return true;
    for (const pt of g.interactions.points) {
      if (pt.type !== 'save' || !g.economy.ownedProperties.has(pt.property || 'home')) continue;
      if (Math.hypot(pt.x - g.player.pos.x, pt.z - g.player.pos.z) < (pt.r || 2.5) + 0.5) return true;
    }
    return false;
  }

  /** Aktuellen Spielzustand einsammeln. */
  collect() {
    const g = this.game, pl = g.player;
    const look = pl.model.look;
    return {
      ...defaultState(),
      player: { pos: { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z }, heading: pl.heading, health: pl.health, armor: pl.armor, look: { shirt: look.shirt, pants: look.pants, hair: look.hair }, weapons: pl.inventory.toJSON() },
      economy: { money: g.economy.money, ownedProperties: [...g.economy.ownedProperties], ownedVehicles: g.economy.ownedVehicles.map((v) => ({ ...v })), garageSlots: g.economy.garageSlots },
      inventory: g.inventory.toJSON(),
      missions: g.missions.toJSON(),
      activities: g.activities ? { stuntsDone: [...g.activities.stuntsDone], racesDone: [...g.activities.racesDone], bountiesDone: g.activities.bountiesDone, best: { ...g.activities.best } } : undefined,
      wanted: g.police.wanted.toJSON(),
      time: { hour: g.tod.hour, day: g.tod.day },
      weather: g.weather.current,
      stats: { ...g.stats },
      unlocks: { ...(g.unlocks || {}) },
      settings: { ...g.settings },
      savedAt: Date.now(),
      meta: { date: new Date().toLocaleString('de-CH'), money: g.economy.money, missions: g.missions.engine.completed.size, place: tr(districtAt(pl.pos.x, pl.pos.z).name) },
    };
  }

  /** Zustand ins Spiel übernehmen. */
  apply(s, fresh = false) {
    const g = this.game, pl = g.player;
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    if (g.missions.engine.active) g.missions.engine.abort('Spielstand geladen');
    g.missions.engine.failedRun = null;
    g.missions.dialog.clear();
    if (g.activities) g.activities.stop();
    g.police.reset();
    pl.revive();
    pl.invulnerable = 1;
    pl.health = s.player.health; pl.armor = s.player.armor;
    pl.model.setVest(pl.armor > 0);
    if (s.player.look) { pl.model.setShirt(s.player.look.shirt); pl.model.setPants(s.player.look.pants); pl.model.setHair(s.player.look.hair); }
    pl.inventory = WeaponInventory.fromJSON(s.player.weapons);
    g.weapons._equipModel();
    const p = s.player.pos;
    pl.teleport(p.x, fresh ? null : p.y, p.z, s.player.heading);
    g.camera3p.yaw = s.player.heading;
    g.economy.money = s.economy.money;
    g.economy.ownedProperties = new Set(s.economy.ownedProperties);
    g.economy.ownedVehicles = s.economy.ownedVehicles.map((v) => ({ ...v }));
    g.economy.garageSlots = s.economy.garageSlots;
    g.inventory = Inventory.fromJSON(s.inventory);
    g.missions.load(s.missions);
    if (g.activities) {
      g.activities.stuntsDone = new Set(s.activities.stuntsDone);
      g.activities.racesDone = new Set(s.activities.racesDone);
      g.activities.bountiesDone = s.activities.bountiesDone;
      g.activities.best = { ...s.activities.best };
    }
    g.police.wanted = WantedLevel.fromJSON(s.wanted);
    g.tod.hour = s.time.hour; g.tod.day = s.time.day;
    g.weather.set(s.weather || 'clear', true);
    if (s.stats) Object.assign(g.stats, s.stats); else for (const k of Object.keys(g.stats)) g.stats[k] = 0;
    g.unlocks = { ...(s.unlocks || {}) };
    g.hud._displayMoney = g.economy.money;
    events.emit('game:loaded', { fresh });
    void THREE;
  }

  save(slot) {
    const data = this.collect();
    try { this.storage.setItem(KEY + slot, encode(data)); } catch (e) { this.game.hud.notify('Speichern fehlgeschlagen: ' + e.message); return false; }
    events.emit('game:saved', { slot });
    return true;
  }

  autosave(why = '') {
    if (!this.game.started) return;
    this.save('auto');
    this.game.hud.notify(`💾 Autosave${why ? ' – ' + why : ''}`, 2000);
  }

  load(slot) {
    const raw = this.storage.getItem(KEY + slot);
    const s = raw ? decode(raw) : null;
    if (!s) { this.game.hud.notify('Spielstand nicht lesbar.'); return false; }
    this.apply(s);
    this.game.hud.notify(t('menu.load') + ': ' + (slot === 'auto' ? 'Autosave' : 'Slot ' + slot));
    return true;
  }

  remove(slot) { try { this.storage.removeItem(KEY + slot); } catch { /* egal */ } }

  list() {
    const out = [];
    for (const slot of ['auto', '1', '2', '3']) {
      let meta = null;
      try { const raw = this.storage.getItem(KEY + slot); if (raw) meta = JSON.parse(raw).meta || { date: '?', money: 0, missions: 0, place: '?' }; } catch { meta = null; }
      out.push({ slot, meta });
    }
    return out;
  }

  latest() {
    let best = null;
    for (const s of this.list()) {
      if (!s.meta) continue;
      const raw = this.storage.getItem(KEY + s.slot);
      const ts = raw ? (JSON.parse(raw).savedAt || 0) : 0;
      if (!best || ts >= best.ts) best = { ...s, ts };
    }
    return best;
  }
}
