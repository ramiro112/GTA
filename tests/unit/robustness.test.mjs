// Tests aus dem Bug-Check: Gamepad-Belegung, robuste Spielstände, Waffenwerte, Missionsdaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG } from '../../src/config.js';
import { WeaponInventory, WEAPON_META, WEAPON_IDS, SLOT_COUNT, weaponDef } from '../../src/weapons/weapondata.js';
import { normalizeState, decode, encode, defaultState } from '../../src/save/serialize.js';

// input.js greift erst beim Anhängen auf window/navigator zu → im Node-Test importierbar
const { PAD_BUTTONS, DEFAULT_BINDINGS } = await import('../../src/core/input.js');

test('Gamepad: keine Taste löst in derselben Situation zwei Aktionen aus', () => {
  const contexts = {
    zuFuss: ['jump', 'crouch', 'reload', 'interact', 'enterVehicle', 'weaponWheel', 'cover', 'aim', 'attack', 'map', 'pause', 'sprint', 'phone', 'passenger'],
    auto: ['handbrake', 'reload', 'enterVehicle', 'weaponWheel', 'horn', 'aim', 'attack', 'map', 'pause', 'lookBehind', 'radio', 'camera', 'lights'],
    luft: ['handbrake', 'fireAir', 'fireAirSecondary', 'enterVehicle', 'yawLeft', 'yawRight', 'map', 'pause', 'camera', 'flaps', 'gear', 'lookBehind'],
  };
  for (const [btn, actions] of Object.entries(PAD_BUTTONS)) {
    for (const [ctx, list] of Object.entries(contexts)) {
      const hits = actions.filter((a) => list.includes(a));
      assert.ok(hits.length <= 1, `Taste ${btn} im Kontext ${ctx}: ${hits.join(' + ')}`);
    }
  }
  // Jede Tastatur-Aktion hat mindestens eine Taste
  for (const [a, codes] of Object.entries(DEFAULT_BINDINGS)) assert.ok(codes.length > 0, a);
});

test('Spielstand: Waffen mit unbekannter ID, falschem Slot oder kaputter Munition werden repariert', () => {
  const inv = WeaponInventory.fromJSON({
    current: 4,
    slots: [null, { id: 'laserschwert', mag: 1, ammo: 1 }, null, { id: 'shotgun', mag: 'x', ammo: -5 }, { id: 'pistol', mag: 99, ammo: 30.7 }],
  });
  assert.equal(inv.slots[0].id, 'fist', 'Faust immer vorhanden');
  assert.ok(!inv.has('laserschwert'));
  assert.equal(inv.slots[CONFIG.weapons.shotgun.slot].id, 'shotgun', 'Schrotflinte in ihren Slot verschoben');
  assert.equal(inv.slots[CONFIG.weapons.shotgun.slot].ammo, 0);
  const p = inv.slots[CONFIG.weapons.pistol.slot];
  assert.equal(p.mag, CONFIG.weapons.pistol.mag, 'Magazin auf Kapazität begrenzt');
  assert.equal(p.ammo, 30);
  assert.equal(inv.current.id, 'pistol', 'aktuelle Waffe bleibt erhalten');
  assert.equal(WeaponInventory.fromJSON({ slots: 'kaputt' }).current.id, 'fist');
});

test('Spielstand: ungültige Zahlen für Position/Gesundheit/Geld werden ersetzt', () => {
  const s = normalizeState({ player: { pos: { x: NaN, y: 0, z: 3 }, health: 0, armor: -4, heading: 'n' }, economy: { money: Infinity, ownedProperties: 'x' }, time: { hour: null } });
  const d = defaultState();
  assert.deepEqual(s.player.pos, d.player.pos);
  assert.equal(s.player.health, d.player.health);
  assert.equal(s.player.armor, 0);
  assert.equal(s.player.heading, d.player.heading);
  assert.equal(s.economy.money, d.economy.money);
  assert.deepEqual(s.economy.ownedProperties, ['home']);
  assert.equal(s.time.hour, CONFIG.time.startHour);
  // JSON kennt kein NaN → Rundreise bleibt gültig
  const back = decode(encode(s));
  assert.equal(back.player.pos.x, d.player.pos.x);
});

test('Waffenwerte: vollständig und plausibel', () => {
  const slotsUsed = {};
  for (const id of WEAPON_IDS) {
    const d = weaponDef(id);
    assert.ok(d.damage > 0 && d.rate > 0, `${id}: Schaden/Kadenz`);
    assert.ok(d.slot >= 0 && d.slot < SLOT_COUNT, `${id}: Slot`);
    (slotsUsed[d.slot] = slotsUsed[d.slot] || []).push(id);
    assert.ok(WEAPON_META[id].icon && WEAPON_META[id].name.de && WEAPON_META[id].name.en, `${id}: Name/Symbol`);
    if (d.type === 'gun' || d.type === 'projectile') {
      assert.ok(d.mag > 0 && d.reload > 0 && d.range > 0, `${id}: Magazin/Nachladen/Reichweite`);
      assert.ok(d.ammoPrice > 0 && d.ammoPack > 0, `${id}: Munition kaufbar`);
    }
    if (id !== 'fist') assert.ok(d.price > 0, `${id}: Ladenpreis`);
  }
  // Nur Messer und Schläger teilen sich einen Slot (Nahkampf)
  for (const [slot, ids] of Object.entries(slotsUsed)) if (ids.length > 1) assert.deepEqual(ids.sort(), ['bat', 'knife'], `Slot ${slot}`);
  // Stärkere Waffen sind teurer
  assert.ok(CONFIG.weapons.pistol.price < CONFIG.weapons.smg.price && CONFIG.weapons.smg.price < CONFIG.weapons.rifle.price && CONFIG.weapons.rifle.price < CONFIG.weapons.rocket.price);
});

test('Waffeninventar: Raketenwerfer und Granaten werden nachgeladen bzw. nachgelegt', () => {
  const inv = new WeaponInventory();
  inv.give('rocket', 3);
  inv.select(CONFIG.weapons.rocket.slot);
  assert.equal(inv.current.mag, 1);
  assert.ok(inv.consume());
  assert.equal(inv.current.mag, 0);
  assert.ok(inv.canReload(), 'Raketenwerfer kann nachladen');
  inv.reload();
  assert.equal(inv.current.mag, 1);
  assert.equal(inv.current.ammo, 1);
});

test('Missionen: eindeutige IDs, Voraussetzungen existieren, Belohnungswaffen sind gültig', () => {
  const src = fs.readFileSync(new URL('../../src/missions/story.js', import.meta.url), 'utf8');
  const ids = [...src.matchAll(/reg\(\{\s*id: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'IDs eindeutig');
  for (const m of src.matchAll(/requires: \[([^\]]*)\]/g)) {
    for (const r of m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)) assert.ok(ids.includes(r), 'Voraussetzung ' + r);
  }
  for (const m of src.matchAll(/weapons: \[([^\]]*)\]/g)) {
    for (const w of m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)) assert.ok(CONFIG.weapons[w] && WEAPON_META[w], 'Belohnungswaffe ' + w);
  }
  // Erste Mission ohne Voraussetzung, alle anderen erreichbar (Kette ohne Zyklen)
  const req = {};
  for (const m of src.matchAll(/id: '([a-z_]+)'[^\n]*?requires: \[([^\]]*)\]/g)) req[m[1]] = m[2].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
  const done = new Set();
  for (let round = 0; round < ids.length + 1; round++) for (const id of ids) if ((req[id] || []).every((r) => done.has(r))) done.add(id);
  assert.equal(done.size, ids.length, 'alle Missionen erreichbar');
});
