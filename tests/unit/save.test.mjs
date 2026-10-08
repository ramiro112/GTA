import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, encode, decode, normalizeState, SAVE_VERSION } from '../../src/save/serialize.js';
import { WeaponInventory } from '../../src/weapons/weapondata.js';
import { WantedLevel } from '../../src/police/wanted.js';
import { CONFIG } from '../../src/config.js';

test('Speichern: Rundreise erhält alle Kernwerte', () => {
  const s = defaultState();
  const inv = new WeaponInventory();
  inv.give('rifle', 90); inv.give('pistol', 20); inv.select(CONFIG.weapons.rifle.slot);
  const w = new WantedLevel(); w.ensureStars(2, { x: 5, z: 6 });
  s.player = { pos: { x: 12.5, y: 0.12, z: -40 }, heading: 1.2, health: 77, armor: 30, look: { shirt: 1, pants: 2, hair: 3 }, weapons: inv.toJSON() };
  s.economy = { money: 12345, ownedProperties: ['home', 'penthouse'], ownedVehicles: [{ type: 'sports', color: 0xff0000, tuning: { engine: 2, tires: 1, armor: 0 }, health: 600 }], garageSlots: 6 };
  s.missions = { completed: ['heimkehr', 'ersatzteile'], stats: { heimkehr: { attempts: 2, passed: 1, bestTime: 88 } } };
  s.wanted = w.toJSON();
  s.time = { hour: 21.5, day: 3 };
  s.inventory = { medkit: 4 };
  const back = decode(encode(s));
  assert.equal(back.version, SAVE_VERSION);
  assert.deepEqual(back.player.pos, s.player.pos);
  assert.equal(back.economy.money, 12345);
  assert.deepEqual(back.economy.ownedProperties, ['home', 'penthouse']);
  assert.equal(back.economy.ownedVehicles[0].tuning.engine, 2);
  assert.deepEqual(back.missions.completed, ['heimkehr', 'ersatzteile']);
  assert.equal(back.time.hour, 21.5);
  const inv2 = WeaponInventory.fromJSON(back.player.weapons);
  assert.equal(inv2.current.id, 'rifle');
  assert.ok(inv2.has('pistol'));
  assert.equal(WantedLevel.fromJSON(back.wanted).stars, 2);
  assert.equal(back.inventory.medkit, 4);
});

test('Speichern: kaputte oder alte Daten werden robust ergänzt', () => {
  assert.equal(decode('{kaputt'), null);
  const s = normalizeState({ economy: { money: 'abc', ownedProperties: [] }, player: { health: 50 } });
  assert.equal(s.economy.money, CONFIG.player.startMoney);
  assert.ok(s.economy.ownedProperties.includes('home'));
  assert.equal(s.player.health, 50);
  assert.ok(s.player.pos, 'fehlende Position ergänzt');
  assert.ok(Array.isArray(s.missions.completed));
});
