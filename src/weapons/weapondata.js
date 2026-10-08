// Waffendaten und Waffen-Inventar (reine Logik, ohne Three.js → testbar).

import { CONFIG } from '../config.js';

export const WEAPON_META = {
  fist:    { name: { de: 'Faust', en: 'Fist' }, icon: '✊' },
  knife:   { name: { de: 'Messer', en: 'Knife' }, icon: '🔪' },
  bat:     { name: { de: 'Baseballschläger', en: 'Baseball bat' }, icon: '🏏' },
  pistol:  { name: { de: 'Pistole', en: 'Pistol' }, icon: '🔫' },
  smg:     { name: { de: 'Maschinenpistole', en: 'SMG' }, icon: 'MP' },
  shotgun: { name: { de: 'Schrotflinte', en: 'Shotgun' }, icon: 'SF' },
  rifle:   { name: { de: 'Sturmgewehr', en: 'Assault rifle' }, icon: 'SG' },
  sniper:  { name: { de: 'Scharfschützengewehr', en: 'Sniper rifle' }, icon: '🎯' },
  grenade: { name: { de: 'Granaten', en: 'Grenades' }, icon: '💣' },
  rocket:  { name: { de: 'Raketenwerfer', en: 'Rocket launcher' }, icon: '🚀' },
};

export const WEAPON_IDS = Object.keys(WEAPON_META);
export const SLOT_COUNT = 9;

export function weaponDef(id) {
  const d = CONFIG.weapons[id];
  if (!d) throw new Error('Unbekannte Waffe ' + id);
  return { ...d, ...WEAPON_META[id], id };
}

/** Schaden eines Treffers je Zone (Kopf/Körper/Beine) und Distanz (Abfall ab 60 % Reichweite). */
export function computeDamage(def, zone = 'body', distance = 0) {
  const zoneMul = CONFIG.hitZones[zone] ?? 1;
  let falloff = 1;
  if (def.range && distance > def.range * 0.6) falloff = Math.max(0.3, 1 - (distance - def.range * 0.6) / (def.range * 0.8));
  return def.damage * zoneMul * falloff;
}

/**
 * Startausrüstung eines neuen Spiels laut CONFIG.player.startWeapons/startWeapon.
 * Unbekannte Waffen in der Konfiguration werden übersprungen (mit Warnung), statt das Spiel zu blockieren.
 */
export function startInventory() {
  const inv = new WeaponInventory();
  for (const [id, ammo] of CONFIG.player.startWeapons || []) {
    if (!CONFIG.weapons[id] || !WEAPON_META[id] || id === 'fist') { if (id !== 'fist') console.warn('Unbekannte Startwaffe in config.js:', id); continue; }
    inv.give(id, Math.max(0, Math.floor(ammo || 0)));
  }
  const sel = CONFIG.player.startWeapon;
  if (sel && CONFIG.weapons[sel]) inv.select(CONFIG.weapons[sel].slot);
  return inv;
}

/** Waffeninventar einer Figur. */
export class WeaponInventory {
  constructor() {
    this.slots = new Array(SLOT_COUNT).fill(null); // je Slot {id, def, mag, ammo}
    this.slots[0] = { id: 'fist', def: weaponDef('fist'), mag: 0, ammo: 0 };
    this.currentSlot = 0;
  }

  get current() { return this.slots[this.currentSlot] || this.slots[0]; }

  /** Waffe hinzufügen oder Munition auffüllen. Liefert den Eintrag. */
  give(id, ammo = null) {
    const def = weaponDef(id);
    const slot = def.slot;
    const existing = this.slots[slot];
    const addAmmo = ammo ?? (def.ammoPack || def.mag || 0) * 2;
    if (existing && existing.id === id) {
      existing.ammo += addAmmo;
      return existing;
    }
    const entry = { id, def, mag: 0, ammo: addAmmo };
    if (def.type === 'gun' || def.type === 'projectile' || def.type === 'throw') {
      const load = Math.min(def.mag || 1, entry.ammo);
      entry.mag = load;
      entry.ammo -= load;
    }
    this.slots[slot] = entry;
    return entry;
  }

  has(id) { return this.slots.some((s) => s && s.id === id); }

  select(slot) {
    if (slot < 0 || slot >= SLOT_COUNT || !this.slots[slot]) return false;
    this.currentSlot = slot;
    return true;
  }

  /** Nächste/vorige vorhandene Waffe. */
  cycle(dir) {
    for (let k = 1; k <= SLOT_COUNT; k++) {
      const s = (this.currentSlot + dir * k + SLOT_COUNT * 2) % SLOT_COUNT;
      if (this.slots[s]) { this.currentSlot = s; return s; }
    }
    return this.currentSlot;
  }

  /** Einen Schuss verbrauchen. false = Magazin leer. */
  consume() {
    const w = this.current;
    if (w.def.type === 'melee') return true;
    if (w.mag <= 0) return false;
    w.mag--;
    return true;
  }

  canReload() {
    const w = this.current;
    return (w.def.type === 'gun' || w.def.type === 'projectile') && w.mag < (w.def.mag || 1) && w.ammo > 0;
  }

  /** Nachladen abschliessen. */
  reload() {
    const w = this.current;
    const need = (w.def.mag || 1) - w.mag;
    const take = Math.min(need, w.ammo);
    w.mag += take;
    w.ammo -= take;
    return take;
  }

  /** Alles ausser Faust verlieren (Festnahme / Tod). */
  clear() {
    this.slots = new Array(SLOT_COUNT).fill(null);
    this.slots[0] = { id: 'fist', def: weaponDef('fist'), mag: 0, ammo: 0 };
    this.currentSlot = 0;
  }

  toJSON() {
    return { current: this.currentSlot, slots: this.slots.map((s) => (s ? { id: s.id, mag: s.mag, ammo: s.ammo } : null)) };
  }

  /**
   * Inventar aus Spielstand. Robust gegen alte/kaputte Daten: unbekannte Waffen werden übersprungen,
   * jede Waffe landet in ihrem aktuellen Slot laut Konfiguration, Munition wird auf ganze Zahlen ≥ 0 begrenzt.
   */
  static fromJSON(data) {
    const inv = new WeaponInventory();
    if (!data || !Array.isArray(data.slots)) return inv;
    const num = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
    let currentId = null;
    data.slots.forEach((s, i) => {
      if (!s || !CONFIG.weapons[s.id] || !WEAPON_META[s.id]) return;
      const def = weaponDef(s.id);
      if (def.slot === undefined || def.slot >= SLOT_COUNT) return;
      inv.slots[def.slot] = { id: s.id, def, mag: Math.min(num(s.mag), def.mag || 0), ammo: num(s.ammo) };
      if (i === data.current) currentId = s.id;
    });
    if (!inv.slots[0]) inv.slots[0] = { id: 'fist', def: weaponDef('fist'), mag: 0, ammo: 0 };
    const cur = currentId ? weaponDef(currentId).slot : 0;
    inv.currentSlot = inv.slots[cur] ? cur : 0;
    return inv;
  }
}
