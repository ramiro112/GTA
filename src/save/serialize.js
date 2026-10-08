// Spielstand-Format (rein, testbar): Zustand → JSON und zurück. Version für spätere Migrationen.

import { CONFIG } from '../config.js';

export const SAVE_VERSION = 1;

/** Standardzustand für ein neues Spiel. */
export function defaultState() {
  return {
    version: SAVE_VERSION,
    player: { pos: { x: 64, y: 0.12, z: 70 }, heading: Math.PI, health: 100, armor: 0, look: null, weapons: null },
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
  if (!out.economy.ownedProperties.includes('home')) out.economy.ownedProperties.push('home');
  if (typeof out.economy.money !== 'number' || !isFinite(out.economy.money)) out.economy.money = d.economy.money;
  out.version = SAVE_VERSION;
  return out;
}

export function encode(state) { return JSON.stringify(state); }

export function decode(text) {
  try { return normalizeState(JSON.parse(text)); } catch { return null; }
}
