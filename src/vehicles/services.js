// Fahrzeug-Dienste: eigene Garage (einlagern/abholen), Tuning-Werkstatt (Reparatur, Lackierung,
// Motor, Reifen, Panzerung), Schrottplatz (gestohlene Autos verkaufen), Tankstelle.

import { CONFIG } from '../config.js';
import { tr } from '../core/i18n.js';
import { formatMoney } from '../core/mathutil.js';
import { events } from '../core/events.js';
import { LANDMARKS } from '../world/layout.js';
import { Interactions } from '../core/interactions.js';

const GC = CONFIG.economy.garage;
const PAINTS = [
  [0xd94a38, 'Rot'], [0x3d7dd8, 'Blau'], [0x111111, 'Schwarz'], [0xf2f2f2, 'Weiss'], [0xf2c641, 'Gelb'],
  [0x2e8b57, 'Grün'], [0x8a8f99, 'Silber'], [0xff7f11, 'Orange'], [0x6a1b9a, 'Violett'], [0x00bcd4, 'Türkis'],
];

export class Services {
  constructor(game) {
    this.game = game;
    if (!game.interactions) game.addSystem(new Interactions(game), 'interactions');
    const I = game.interactions;
    const inVehicle = () => game.player.vehicle && !game.player.vehicle.isAircraft;
    I.register('garage', {
      label: (pt) => (pt.garage === 'player' ? 'Garage' : tr(LANDMARKS.tuning.name)),
      available: (pt) => (pt.garage === 'player' ? true : inVehicle()),
      action: (pt) => (pt.garage === 'player' ? this.playerGarage(pt) : this.tuningShop()),
    });
    I.register('scrap', {
      label: () => 'Auto verschrotten',
      available: () => inVehicle() && !game.player.vehicle.owned && !game.player.vehicle.isBoat,
      action: () => this.scrap(),
    });
    I.register('fuel', {
      label: () => 'Tanken',
      available: () => inVehicle() && Math.abs(game.player.vehicle.speed) < 1,
      action: () => this.refuel(),
    });
  }

  // ------------------------------------------------------------------ eigene Garage
  playerGarage(pt) {
    const g = this.game, eco = g.economy;
    const v = g.player.vehicle;
    const items = [];
    if (v) {
      const full = eco.ownedVehicles.length >= eco.garageSlots;
      items.push({ label: `Fahrzeug einlagern: ${tr(v.def.name)}`, sub: full ? 'Garage voll' : `Platz ${eco.ownedVehicles.length + 1}/${eco.garageSlots}`, disabled: full || v.isBoat, action: () => {
        eco.ownedVehicles.push({ type: v.type, color: v.color, tuning: { ...v.tuning }, health: Math.max(v.health, v.maxHealth * 0.3), fuel: v.fuel });
        g.vehicles.exitVehicle(g.player);
        g.vehicles.remove(v);
        g.hud.notify('Fahrzeug eingelagert');
        events.emit('garage:stored', { type: v.type });
        return false;
      } });
    }
    eco.ownedVehicles.forEach((o, i) => items.push({
      label: `Abholen: ${tr(CONFIG.vehicles[o.type].name)}`, sub: `Motor ${o.tuning.engine} · Reifen ${o.tuning.tires} · Panzer ${o.tuning.armor}`, disabled: !!v,
      action: () => {
        eco.ownedVehicles.splice(i, 1);
        const lm = LANDMARKS.playerGarage;
        const nv = this.spawnOwned(o, lm.x, lm.z - lm.d / 2 - 5, Math.PI);
        g.player.teleport(lm.x - 2.5, null, lm.z - lm.d / 2 - 5);
        g.vehicles._seatPlayer(nv);
        return false;
      },
    }));
    if (!items.length) items.push({ label: 'Garage ist leer', disabled: true });
    g.ui.openMenu({ title: 'Garage', subtitle: `${eco.ownedVehicles.length}/${eco.garageSlots} Stellplätze`, items });
    void pt;
  }

  spawnOwned(o, x, z, heading) {
    const v = this.game.vehicles.spawn(o.type, { x, z, heading, color: o.color });
    v.owned = true; v.persistent = true; v.locked = false;
    v.tuning = { ...o.tuning };
    v.health = o.health ?? v.maxHealth;
    v.fuel = o.fuel ?? CONFIG.vehicleCommon.fuelCapacity;
    v.damageLevel = 1 - v.health / v.maxHealth;
    v._applyDamageVisual();
    return v;
  }

  // ------------------------------------------------------------------ Tuning
  tuningShop() {
    const g = this.game, eco = g.economy;
    const v = g.player.vehicle;
    const build = () => {
      const items = [];
      const repairCost = Math.round(GC.repairBase + (v.maxHealth - v.health) * GC.repairPerDamage);
      items.push({ label: 'Reparieren', price: repairCost, disabled: v.health >= v.maxHealth && !v.wheels?.some((w) => w.burst), action: () => this._buy(repairCost, () => v.repair(), 'Repariert') });
      for (const [hex, name] of PAINTS) items.push({ label: `Lackieren: ${name}`, price: GC.paint, swatch: hex, action: () => this._buy(GC.paint, () => this.respray(v, hex), 'Neu lackiert') });
      for (const [key, label, prices, max] of [['engine', 'Motor', GC.engine, 3], ['tires', 'Reifen', GC.tires, 2], ['armor', 'Panzerung', GC.armor, 3]]) {
        const lvl = v.tuning[key] || 0;
        if (lvl < max) items.push({ label: `${label} Stufe ${lvl + 1}`, sub: key === 'engine' ? 'mehr Leistung und Höchstgeschwindigkeit' : key === 'tires' ? 'mehr Grip, hält Kugeln besser stand' : 'weniger Schaden', price: prices[lvl], action: () => this._buy(prices[lvl], () => { v.tuning[key] = lvl + 1; }, `${label} verbessert`) });
        else items.push({ label: `${label}: maximal`, disabled: true });
      }
      return items;
    };
    const open = () => g.ui.openMenu({ title: tr(LANDMARKS.tuning.name), subtitle: `${tr(v.def.name)} · Zustand ${Math.round(Math.max(0, v.health) / v.maxHealth * 100)}%`, items: build().map((it) => ({ ...it, action: it.action ? () => { it.action(); setTimeout(open, 0); return true; } : null })) });
    open();
  }

  /** Umlackieren: gestohlenes Auto gilt nicht mehr als gemeldet, Fahndung sinkt, wenn unbeobachtet. */
  respray(v, hex) {
    v.setColor(hex);
    v.reported = false;
    v.stolen = false;
    const pol = this.game.police;
    if (pol && pol.stars > 0 && !pol.playerSeen) pol.clear('respray');
    events.emit('vehicle:respray', { vehicle: v });
  }

  _buy(price, fn, msg) {
    const g = this.game;
    if (!g.economy.spend(price, msg)) { g.hud.notify('Nicht genug Geld'); return false; }
    fn();
    g.hud.notify(`${msg} (−${formatMoney(price)})`);
    return true;
  }

  // ------------------------------------------------------------------ Schrottplatz
  scrap() {
    const g = this.game;
    const v = g.player.vehicle;
    const value = Math.round((v.def.scrap || 500) * (0.3 + 0.7 * Math.max(0, v.health) / v.maxHealth) * (v.stolen ? 1 : 0.6));
    g.ui.openMenu({ title: 'Schrott-Hannes', subtitle: `"Na, was bringst du mir da?"`, items: [
      { label: `${tr(v.def.name)} verkaufen`, price: -value, action: () => {
        g.vehicles.exitVehicle(g.player);
        g.vehicles.remove(v);
        g.economy.add(value, 'Schrottverkauf');
        events.emit('vehicle:scrapped', { type: v.type, value });
        return false;
      } },
    ] });
  }

  // ------------------------------------------------------------------ Tankstelle
  refuel() {
    const g = this.game;
    const v = g.player.vehicle;
    const cap = CONFIG.vehicleCommon.fuelCapacity;
    const liters = Math.max(0, cap - v.fuel);
    const cost = Math.ceil(liters * CONFIG.economy.shops.fuel.pricePerLiter);
    if (liters < 1) { g.hud.notify('Tank ist voll'); return; }
    if (!g.economy.spend(cost, 'Tanken')) { g.hud.notify('Nicht genug Geld'); return; }
    v.fuel = cap;
    g.hud.notify(`Vollgetankt: ${liters.toFixed(0)} l für ${formatMoney(cost)}`);
    events.emit('vehicle:refuel', { liters, cost });
  }
}
