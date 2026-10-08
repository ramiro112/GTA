import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../src/core/events.js';
import { ObjectPool } from '../../src/core/pool.js';
import { Random } from '../../src/core/random.js';
import { wrapAngle, angleDiff, formatMoney, formatTime, pointSegment } from '../../src/core/mathutil.js';
import { CONFIG, starsFromHeat } from '../../src/config.js';

test('EventBus: on/emit/off/once', () => {
  const bus = new EventBus();
  let n = 0;
  const off = bus.on('x', (d) => { n += d; });
  bus.emit('x', 2);
  bus.once('x', (d) => { n += d * 10; });
  bus.emit('x', 1);
  bus.emit('x', 1);
  off();
  bus.emit('x', 100);
  assert.equal(n, 2 + 1 + 10 + 1);
});

test('EventBus: Fehler in einem Listener stoppt andere nicht', () => {
  const bus = new EventBus();
  let ok = false;
  const orig = console.error; console.error = () => {};
  bus.on('e', () => { throw new Error('boom'); });
  bus.on('e', () => { ok = true; });
  bus.emit('e');
  console.error = orig;
  assert.ok(ok);
});

test('ObjectPool: wiederverwendet Objekte und respektiert max', () => {
  let created = 0;
  const pool = new ObjectPool(() => ({ id: created++ }), (o) => { o.reset = true; }, 2);
  const a = pool.acquire(), b = pool.acquire();
  assert.equal(pool.acquire(), null);
  pool.release(a);
  assert.ok(a.reset);
  const c = pool.acquire();
  assert.equal(c, a);
  assert.equal(created, 2);
  assert.equal(pool.activeCount, 2);
  void b;
});

test('Random ist deterministisch', () => {
  const r1 = new Random(5), r2 = new Random(5);
  for (let i = 0; i < 10; i++) assert.equal(r1.next(), r2.next());
});

test('Winkel- und Formatfunktionen', () => {
  assert.ok(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9 || Math.abs(wrapAngle(Math.PI * 3) + Math.PI) < 1e-9);
  assert.ok(Math.abs(angleDiff(0.1, -0.1) + 0.2) < 1e-9);
  assert.equal(formatMoney(1234567), '$1.234.567');
  assert.equal(formatMoney(-50), '-$50');
  assert.equal(formatTime(65), '1:05');
  const r = pointSegment(5, 5, 0, 0, 10, 0);
  assert.equal(r.d, 5);
});

test('Konfiguration: Sterne aus Fahndungspunkten', () => {
  assert.equal(starsFromHeat(0), 0);
  assert.equal(starsFromHeat(CONFIG.police.starThresholds[0]), 1);
  assert.equal(starsFromHeat(99999), 5);
});

test('Konfiguration: alle Fahrzeuge haben Pflichtwerte', () => {
  for (const [id, v] of Object.entries(CONFIG.vehicles)) {
    for (const k of ['mass', 'power', 'maxSpeed', 'grip', 'health', 'size', 'wheelbase']) assert.ok(v[k] !== undefined, `${id}.${k}`);
    assert.ok(v.maxSpeed > 0 && v.mass > 0);
  }
  const required = ['compact', 'sedan', 'sports', 'suv', 'truck', 'bus', 'motorbike', 'police', 'ambulance', 'taxi'];
  for (const r of required) assert.ok(CONFIG.vehicles[r], r);
});
