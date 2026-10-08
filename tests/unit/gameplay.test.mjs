import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WantedLevel } from '../../src/police/wanted.js';
import { WeaponInventory, computeDamage, weaponDef, WEAPON_IDS } from '../../src/weapons/weapondata.js';
import { CONFIG } from '../../src/config.js';
import { findGridPath } from '../../src/ai/pathfinding.js';
import { CollisionWorld } from '../../src/world/collision.js';
import { TimeOfDay, Weather } from '../../src/world/timeweather.js';

test('Fahndung: Verbrechen erhöhen Sterne, Polizistenmord ist schwerer', () => {
  const w = new WantedLevel();
  w.addCrime('carAlarm', { x: 0, z: 0 });
  assert.equal(w.stars, 0, 'Autoalarm allein unter 1 Stern');
  w.addCrime('shooting', { x: 0, z: 0 });
  assert.equal(w.stars, 1);
  const w2 = new WantedLevel();
  w2.addCrime('killCop', { x: 0, z: 0 });
  assert.ok(w2.stars >= 2);
});

test('Fahndung: erlischt ausser Sicht nach der Wartezeit, Suchgebiet verlangsamt', () => {
  const w = new WantedLevel();
  w.ensureStars(2, { x: 0, z: 0 });
  const lose = CONFIG.police.loseSightTime[1];
  // Im Suchgebiet: halbe Geschwindigkeit
  let cleared = false;
  for (let t = 0; t < lose * 1.5; t += 0.5) cleared = w.update(0.5, false, { x: 10, z: 0 }) || cleared;
  assert.equal(cleared, false, 'im Suchgebiet noch aktiv');
  for (let t = 0; t < lose * 2; t += 0.5) cleared = w.update(0.5, false, { x: 5000, z: 0 }) || cleared;
  assert.equal(cleared, true);
  assert.equal(w.stars, 0);
});

test('Fahndung: Sichtkontakt setzt den Timer zurück, Mindeststufe wird gehalten', () => {
  const w = new WantedLevel();
  w.ensureStars(3, { x: 0, z: 0 });
  w.update(10, false, { x: 900, z: 0 });
  w.update(0.1, true, { x: 900, z: 0 });
  assert.equal(w.unseen, 0);
  w.minStars = 2;
  w.clear();
  assert.equal(w.stars, 2);
  w.minStars = 0;
  w.ensureStars(4);
  w.reduceOneStar();
  assert.equal(w.stars, 3);
});

test('Waffen: Kopftreffer stärker als Beine, Reichweitenabfall', () => {
  const d = weaponDef('rifle');
  assert.ok(computeDamage(d, 'head', 10) > computeDamage(d, 'body', 10));
  assert.ok(computeDamage(d, 'body', 10) > computeDamage(d, 'legs', 10));
  assert.ok(computeDamage(d, 'body', d.range) < computeDamage(d, 'body', 10));
  for (const id of WEAPON_IDS) assert.ok(CONFIG.weapons[id], id);
});

test('Waffeninventar: geben, wählen, schiessen, nachladen, leeren, speichern', () => {
  const inv = new WeaponInventory();
  assert.equal(inv.current.id, 'fist');
  inv.give('pistol', 30);
  assert.ok(inv.select(CONFIG.weapons.pistol.slot));
  assert.equal(inv.current.mag, 12);
  assert.equal(inv.current.ammo, 18);
  for (let i = 0; i < 12; i++) assert.ok(inv.consume());
  assert.equal(inv.consume(), false, 'Magazin leer');
  assert.ok(inv.canReload());
  inv.reload();
  assert.equal(inv.current.mag, 12);
  assert.equal(inv.current.ammo, 6);
  inv.give('pistol', 10);
  assert.equal(inv.current.ammo, 16, 'Munition aufgefüllt');
  const restored = WeaponInventory.fromJSON(JSON.parse(JSON.stringify(inv.toJSON())));
  assert.equal(restored.current.id, 'pistol');
  assert.equal(restored.current.ammo, 16);
  inv.clear();
  assert.equal(inv.current.id, 'fist');
  assert.equal(inv.slots.filter(Boolean).length, 1);
  inv.give('knife'); inv.give('bat');
  assert.equal(inv.slots[1].id, 'bat', 'Schläger ersetzt Messer im Nahkampf-Slot');
  inv.give('rifle'); inv.give('rocket');
  inv.currentSlot = 0;
  inv.cycle(1);
  assert.equal(inv.current.id, 'bat');
  inv.cycle(-1);
  assert.equal(inv.current.id, 'fist');
});

test('Gitter-A*: findet einen Weg um eine Wand', () => {
  const c = new CollisionWorld();
  c.add({ minX: -1, maxX: 1, minZ: -10, maxZ: 10, minY: 0, maxY: 5 });
  const path = findGridPath(c, -6, 0, 6, 0, 0);
  assert.ok(path && path.length > 0);
  const last = path[path.length - 1];
  assert.ok(Math.hypot(last.x - 6, last.z) < 3);
  // kein Wegpunkt in der Wand
  for (const p of path) assert.ok(!(Math.abs(p.x) < 1 && Math.abs(p.z) < 10));
});

test('Tageszeit und Wetter', () => {
  const tod = new TimeOfDay(23.5);
  tod.update(60); // 1 Spielstunde pro Minute Echtzeit
  assert.ok(tod.hour < 1 && tod.day === 2);
  assert.ok(new TimeOfDay(0).night > 0.9);
  assert.ok(new TimeOfDay(12).night < 0.1);
  const w = new Weather(1);
  w.set('storm');
  for (let i = 0; i < 30; i++) w.update(1);
  assert.equal(w.type, 'storm');
  assert.ok(w.state.rain > 0.9);
});
