// Spielstand-Format (rein, testbar): Zustand → JSON und zurück. Version für spätere Migrationen.

import { CONFIG } from '../config.js';
import { startInventory } from '../weapons/weapondata.js';

export const SAVE_VERSION = 1;

/** Standardzustand für ein neues Spiel. */
export function defaultState() {
  return {
    version: SAVE_VERSION,
    // Neue Spiele starten mit der Startausrüstung aus config.js (alte Spielstände bringen ihr eigenes Inventar mit)
    player: { pos: { x: 64, y: 0.12, z: 70 }, heading: Math.PI, health: 100, armor: 0, look: null, weapons: startInventory().toJSON() },
    economy: { money: CONFIG.player.startMoney, ownedProperties: ['home'], ownedVehicles: [], garageSlots: 4 },
    inventory: { medkit: 1, snack: 2 },
    missions: { completed: [], stats: {} },
    activities: { stuntsDone: [], racesDone: [], bountiesDone: 0, best: {} },
    wanted: { heat: 0, lastSeen: null },
    time: { hour: CONFIG.time.startHour, day: 1 },
    weather: 'clear',
    stats: null,
    unlocks: {},
    settings: null,
  };
}

/** Prüft und vervollständigt einen geladenen Zustand (fehlende Felder → Standard). */
export function normalizeState(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const out = { ...d, ...raw };
  out.player = { ...d.player, ...(raw.player || {}) };
  out.economy = { ...d.economy, ...(raw.economy || {}) };
  out.missions = { ...d.missions, ...(raw.missions || {}) };
  out.activities = { ...d.activities, ...(raw.activities || {}) };
  out.time = { ...d.time, ...(raw.time || {}) };
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!Array.isArray(out.economy.ownedProperties)) out.economy.ownedProperties = [...d.economy.ownedProperties];
  if (!out.economy.ownedProperties.includes('home')) out.economy.ownedProperties.push('home');
  if (!Array.isArray(out.economy.ownedVehicles)) out.economy.ownedVehicles = [];
  if (!fin(out.economy.money)) out.economy.money = d.economy.money;
  // Spielerwerte: ungültige Zahlen (NaN, Text) würden Position/Gesundheit zerstören
  const p = out.player.pos;
  if (!p || !fin(p.x) || !fin(p.z)) out.player.pos = { ...d.player.pos };
  else if (!fin(p.y)) out.player.pos = { x: p.x, y: d.player.pos.y, z: p.z };
  if (!fin(out.player.heading)) out.player.heading = d.player.heading;
  if (!fin(out.player.health) || out.player.health <= 0) out.player.health = d.player.health;
  out.player.health = Math.min(CONFIG.player.maxHealth, out.player.health);
  if (!fin(out.player.armor) || out.player.armor < 0) out.player.armor = 0;
  if (!out.inventory || typeof out.inventory !== 'object') out.inventory = { ...d.inventory };
  if (!Array.isArray(out.missions.completed)) out.missions.completed = [];
  if (!fin(out.time.hour)) out.time.hour = d.time.hour;
  out.version = SAVE_VERSION;
  return out;
}

export function encode(state) { return JSON.stringify(state); }

export function decode(text) {
  try { return normalizeState(JSON.parse(text)); } catch { return null; }
}
