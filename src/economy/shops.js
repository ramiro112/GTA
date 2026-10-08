// Läden und Immobilien: Waffenladen, Kleidung, Restaurant, Frisör, Autohändler, Tankstellen-Kiosk,
// Immobilienkauf (Speichern + Stellplätze), Kleiderschrank, Aufzug, Aussichtspunkt, Tresor.
// Inventar: Medikits, Westen, Snacks (Benutzung über das Inventar-Menü, Taste I).

import { CONFIG } from '../config.js';
import { tr } from '../core/i18n.js';
import { formatMoney } from '../core/mathutil.js';
import { events } from '../core/events.js';
import { WEAPON_META, weaponDef } from '../weapons/weapondata.js';
import { LANDMARKS, doorPosition } from '../world/layout.js';
import { SHIRTS, PANTS, HAIR } from '../player/character.js';

const SH = CONFIG.economy.shops;
const COLOR_NAMES = ['Rot', 'Blau', 'Grün', 'Orange', 'Lila', 'Dunkelblau', 'Weiss', 'Türkis', 'Rost', 'Grau', 'Pink'];

export const ITEMS = {
  medkit: { name: { de: 'Medikit', en: 'Medkit' }, icon: '✚', desc: { de: '+50 Gesundheit', en: '+50 health' } },
  vest: { name: { de: 'Schutzweste', en: 'Body armor' }, icon: '🦺', desc: { de: 'Rüstung auf 100', en: 'Armor to 100' } },
  snack: { name: { de: 'Snack', en: 'Snack' }, icon: '🍫', desc: { de: '+15 Gesundheit', en: '+15 health' } },
  documents: { name: { de: 'Lieferlisten', en: 'Delivery lists' }, icon: '📄', desc: { de: 'Missionsgegenstand', en: 'Mission item' } },
};

export class Inventory {
  constructor() { this.items = { medkit: 1, snack: 2 }; }
  add(id, n = 1) { this.items[id] = (this.items[id] || 0) + n; }
  count(id) { return this.items[id] || 0; }
  remove(id, n = 1) { if (this.count(id) < n) return false; this.items[id] -= n; if (!this.items[id]) delete this.items[id]; return true; }
  toJSON() { return { ...this.items }; }
  static fromJSON(d) { const i = new Inventory(); i.items = { ...(d || {}) }; return i; }
}

export class Shops {
  constructor(game) {
    this.game = game;
    game.shops = this;
    game.inventory = new Inventory();
    const I = game.interactions;
    I.register('shop', {
      label: (pt) => ({ gunshop: 'Waffen kaufen', clothes: 'Kleidung kaufen', restaurant: 'Essen bestellen', barber: 'Frisur ändern', dealer: 'Autos ansehen', kiosk: 'Einkaufen' }[pt.shop] || 'Einkaufen'),
      available: () => !game.player.vehicle,
      action: (pt) => this.open(pt.shop, pt),
    });
    I.register('wardrobe', { label: () => 'Kleiderschrank', available: () => !game.player.vehicle, action: () => this.wardrobe() });
    I.register('elevator', { label: (pt) => (pt.id === 'elevatorUp' ? 'Aufzug zum Penthouse' : 'Aufzug nach unten'), available: (pt) => pt.id !== 'elevatorUp' || game.economy.ownedProperties.has('penthouse') || true, action: (pt) => this.elevator(pt) });
    I.register('viewpoint', { label: () => 'Aussicht geniessen', available: () => true, action: () => { game.hud.notify('Was für ein Ausblick über Port Aurelia!'); events.emit('viewpoint'); } });
    I.register('vault', { label: () => 'Tresor', available: () => !game.missions.active, action: () => game.hud.notify('Der Tresor ist verschlossen. Dafür braucht es einen Plan …') });
    I.register('activity', { label: (pt) => (pt.activity === 'ambulance' ? 'Rettungsdienst: Krankenwagen nehmen' : 'Flugschule'), available: () => !game.player.vehicle, action: (pt) => game.hud.notify(pt.activity === 'ambulance' ? 'Steig in den Krankenwagen und drücke T für den Rettungsdienst.' : 'Jules bietet Flugstunden an – siehe Missionen.') });
    I.register('property', { label: (pt) => `${tr(LANDMARKS[pt.prop].name)} kaufen (${formatMoney(CONFIG.economy.properties[LANDMARKS[pt.prop].property].price)})`, available: (pt) => !game.economy.ownedProperties.has(LANDMARKS[pt.prop].property), action: (pt) => this.buyProperty(pt.prop) });
    // Kaufmarker vor den Immobilien
    for (const [id, lm] of Object.entries(LANDMARKS)) {
      if (!lm.property) continue;
      const d = doorPosition(lm, 2.5);
      I.add({ id: 'buy_' + id, type: 'property', x: d.x, z: d.z, r: 2, prop: id });
    }
  }

  open(kind, pt) {
    switch (kind) {
      case 'gunshop': return this.gunshop();
      case 'clothes': return this.clothes();
      case 'restaurant': return this.restaurant();
      case 'barber': return this.barber();
      case 'dealer': return this.dealer();
      case 'kiosk': return this.kiosk();
      default: void pt;
    }
  }

  _pay(price, what) {
    const g = this.game;
    if (!g.economy.spend(price, what)) { g.hud.notify('Nicht genug Geld'); return false; }
    g.hud.notify(`Gekauft: ${what} (−${formatMoney(price)})`);
    events.emit('shop:buy', { what, price });
    return true;
  }

  gunshop() {
    const g = this.game, inv = g.player.inventory;
    const open = () => {
      const items = [];
      for (const id of ['knife', 'bat', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'grenade', 'rocket']) {
        const d = weaponDef(id);
        if (g.unlocks?.noRocketShop && id === 'rocket') continue;
        const owned = inv.has(id);
        if (!owned) items.push({ label: `${d.icon} ${tr(WEAPON_META[id].name)}`, sub: d.type === 'gun' ? `Schaden ${d.damage}${d.pellets ? '×' + d.pellets : ''} · Magazin ${d.mag} · Reichweite ${d.range} m` : '', price: d.price, action: () => { if (this._pay(d.price, tr(WEAPON_META[id].name))) { inv.give(id, d.ammoPack || 0); g.weapons._equipModel(); } setTimeout(open, 0); return true; } });
        else if (d.ammoPrice) items.push({ label: `${d.icon} Munition: ${tr(WEAPON_META[id].name)}`, sub: `+${d.ammoPack} Schuss`, price: d.ammoPrice, action: () => { if (this._pay(d.ammoPrice, 'Munition')) inv.give(id, d.ammoPack); setTimeout(open, 0); return true; } });
      }
      items.push({ label: '🦺 Schutzweste', sub: 'Rüstung auf 100', price: SH.armor.price, disabled: g.player.armor >= 100, action: () => { if (this._pay(SH.armor.price, 'Schutzweste')) { g.player.armor = 100; g.player.model.setVest(true); } setTimeout(open, 0); return true; } });
      items.push({ label: '🦺 Ersatzweste fürs Inventar', price: SH.armor.price, action: () => { if (this._pay(SH.armor.price, 'Weste')) g.inventory.add('vest'); setTimeout(open, 0); return true; } });
      g.ui.openMenu({ title: tr(LANDMARKS.gunshop.name), subtitle: '"Für jedes Problem die passende Lösung."', items });
    };
    open();
  }

  clothes() {
    const g = this.game, m = g.player.model;
    const open = () => {
      const items = [];
      SHIRTS.forEach((c, i) => items.push({ label: `Shirt: ${COLOR_NAMES[i] || 'Farbe ' + i}`, swatch: c, price: SH.clothes.price, disabled: m.look.shirt === c, action: () => { if (this._pay(SH.clothes.price, 'Shirt')) { m.setShirt(c); events.emit('player:outfit'); } setTimeout(open, 0); return true; } }));
      PANTS.forEach((c, i) => items.push({ label: `Hose ${i + 1}`, swatch: c, price: Math.round(SH.clothes.price * 0.8), disabled: m.look.pants === c, action: () => { if (this._pay(Math.round(SH.clothes.price * 0.8), 'Hose')) m.setPants(c); setTimeout(open, 0); return true; } }));
      g.ui.openMenu({ title: tr(LANDMARKS.clothes.name), subtitle: 'Neues Outfit – die Polizei erkennt dich schlechter wieder.', items });
    };
    open();
  }

  restaurant() {
    const g = this.game, pl = g.player;
    const R = SH.restaurant;
    g.ui.openMenu({ title: tr(LANDMARKS.restaurant.name), subtitle: `Gesundheit: ${Math.round(pl.health)}`, items: [
      { label: '🍔 Möwenburger', sub: `+${R.burger.heal} Gesundheit`, price: R.burger.price, action: () => { if (this._pay(R.burger.price, 'Burger')) pl.heal(R.burger.heal); return false; } },
      { label: '🍟 Grill-Menü', sub: 'volle Gesundheit', price: R.menu.price, action: () => { if (this._pay(R.menu.price, 'Grill-Menü')) pl.heal(R.menu.heal); return false; } },
      { label: '🥡 Snack zum Mitnehmen', sub: 'ins Inventar', price: 12, action: () => { if (this._pay(12, 'Snack')) g.inventory.add('snack'); return true; } },
    ] });
  }

  barber() {
    const g = this.game, m = g.player.model;
    g.ui.openMenu({ title: tr(LANDMARKS.barber.name), subtitle: 'Neue Frisur, neues Glück.', items: HAIR.map((c, i) => ({ label: `Haarfarbe ${['Schwarzbraun', 'Braun', 'Schwarz', 'Blond', 'Kupfer', 'Grau'][i]}`, swatch: c, price: SH.barber.price, disabled: m.look.hair === c, action: () => { if (this._pay(SH.barber.price, 'Frisur')) m.setHair(c); return false; } })) });
  }

  dealer() {
    const g = this.game, eco = g.economy;
    const list = ['compact', 'sedan', 'suv', 'taxi', 'motorbike', 'sports', 'truck'];
    g.ui.openMenu({ title: tr(LANDMARKS.dealer.name), subtitle: `Lieferung in deine Garage (${eco.ownedVehicles.length}/${eco.garageSlots})`, items: [
      ...list.map((type) => {
        const d = CONFIG.vehicles[type];
        return { label: tr(d.name), sub: `Höchstgeschw. ${Math.round(d.maxSpeed * 3.6)} km/h · Gewicht ${d.mass} kg`, price: d.price, disabled: eco.ownedVehicles.length >= eco.garageSlots, action: () => {
          if (this._pay(d.price, tr(d.name))) { eco.ownedVehicles.push({ type, color: d.colors[0], tuning: { engine: 0, tires: 0, armor: 0 }, health: null }); g.hud.notify('Das Fahrzeug steht in deiner Garage.'); }
          return false;
        } };
      }),
      { label: 'Helikopter "Libelle" (Penthouse-Dach)', price: CONFIG.aircraft.heliSmall.price, disabled: !eco.ownedProperties.has('penthouse') || g.unlocks?.heliOwned, sub: 'erfordert das Penthouse', action: () => { if (this._pay(CONFIG.aircraft.heliSmall.price, 'Helikopter')) g.unlocks = { ...(g.unlocks || {}), heliOwned: true }; return false; } },
    ] });
  }

  kiosk() {
    const g = this.game;
    g.ui.openMenu({ title: 'Tankstellen-Shop', items: [
      { label: '🍫 Snack', sub: '+15 Gesundheit (Inventar)', price: 8, action: () => { if (this._pay(8, 'Snack')) g.inventory.add('snack'); return true; } },
      { label: '✚ Medikit', sub: `+${SH.medkit.heal} Gesundheit (Inventar)`, price: SH.medkit.price, action: () => { if (this._pay(SH.medkit.price, 'Medikit')) g.inventory.add('medkit'); return true; } },
      { label: '🗺 Stadtplan-Update', sub: 'alle Läden auf der Karte', price: 0, action: () => { g.hud.notify('Alle Läden sind auf der Karte markiert.'); return false; } },
    ] });
  }

  wardrobe() {
    const g = this.game, m = g.player.model;
    const outfits = [['Strassen-Look', 0x2d6a4f, 0x22313f], ['Geschäftsmann', 0x2c3e50, 0x1f2a36], ['Hafenarbeiter', 0xd35400, 0x34495e], ['Rennfahrer', 0xc0392b, 0x111111]];
    g.ui.openMenu({ title: 'Kleiderschrank', items: outfits.map(([n, s, p]) => ({ label: n, swatch: s, action: () => { m.setShirt(s); m.setPants(p); return false; } })) });
  }

  elevator(pt) {
    const g = this.game;
    if (pt.id === 'elevatorUp' && !g.economy.ownedProperties.has('penthouse')) { g.hud.notify('Nur für Bewohner. Das Penthouse kostet ' + formatMoney(CONFIG.economy.properties.penthouse.price) + '.'); return; }
    g.player.teleport(pt.to.x, pt.to.y, pt.to.z);
    events.emit('elevator');
  }

  buyProperty(id) {
    const g = this.game;
    const lm = LANDMARKS[id];
    const price = CONFIG.economy.properties[lm.property].price;
    if (!this._pay(price, tr(lm.name))) return;
    g.economy.ownedProperties.add(lm.property);
    g.economy.garageSlots += 2;
    g.hud.center('IMMOBILIE GEKAUFT', 'passed', `${tr(lm.name)} – hier kannst du speichern. +2 Garagenplätze.`, 4);
    events.emit('property:bought', { id: lm.property });
  }

  /** Gegenstand aus dem Inventar benutzen. */
  useItem(id) {
    const g = this.game, pl = g.player;
    if (!g.inventory.count(id)) return false;
    if (id === 'medkit') { if (pl.health >= 100) return false; pl.heal(SH.medkit.heal); }
    else if (id === 'snack') { if (pl.health >= 100) return false; pl.heal(15); }
    else if (id === 'vest') { if (pl.armor >= 100) return false; pl.armor = 100; pl.model.setVest(true); }
    else return false;
    g.inventory.remove(id);
    g.hud.notify(`${tr(ITEMS[id].name)} benutzt`);
    return true;
  }

  mapBlips(out) {
    const icons = { gunshop: 'gun', clothes: 'clothes', restaurant: 'food', barber: 'barber', tuning: 'tuning', dealer: 'dealer', hospital: 'hospital', police: 'police', bank: 'bank', scrapyard: 'scrap', playerHouse: 'house', playerGarage: 'garage', gas1: 'fuel', gas2: 'fuel', gas3: 'fuel', penthouse: 'safehouse', safeBeach: 'safehouse', safeHills: 'safehouse' };
    for (const [id, icon] of Object.entries(icons)) {
      const lm = LANDMARKS[id];
      const owned = lm.property && this.game.economy.ownedProperties.has(lm.property);
      out.push({ x: lm.x, z: lm.z, icon, size: 7, label: tr(lm.name) + (lm.property ? (owned ? ' (dein)' : ' (zu verkaufen)') : ''), color: owned ? '#2d6a4f' : undefined });
    }
    out.push({ x: -600, z: -700, icon: 'airport', size: 7, label: 'Flughafen' }, { x: 630, z: -700, icon: 'military', size: 7, label: 'Militärbasis (Sperrgebiet)' }, { x: 120, z: -860, icon: 'viewpoint', size: 7, label: 'Aussichtspunkt' });
  }
}
