import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainHeight, groundTerrain, districtAt, WATER_Y, riverCenter } from '../../src/world/terrain.js';
import { buildRoadNetwork, lightState, offsetPolyline } from '../../src/world/roads.js';
import { CollisionWorld, rayBox } from '../../src/world/collision.js';
import { generateCity, LANDMARKS } from '../../src/world/layout.js';
import { CONFIG } from '../../src/config.js';

test('Terrain: Stadt flach, Fluss und Meer unter Wasser, Berge hoch', () => {
  assert.equal(terrainHeight(150, -250), 0);
  assert.ok(terrainHeight(riverCenter(0), 0) < WATER_Y - 2);
  assert.ok(terrainHeight(0, 900) < WATER_Y);
  assert.ok(terrainHeight(100, -750) > 30);
});

test('Terrain: Tunnelkorridor ist befahrbar (Boden 0 unter der Decke)', () => {
  const T = CONFIG.world.tunnel;
  const mx = (T.x0 + T.x1) / 2;
  assert.ok(terrainHeight(mx, T.z) > 20, 'Berg über dem Tunnel');
  assert.equal(groundTerrain(mx, T.z, 1), 0);
  assert.equal(terrainHeight(T.x0 - 10, T.z), 0, 'Einfahrt frei');
});

test('Gebiete: alle 10 geforderten Gebiete existieren', () => {
  const ids = new Set();
  for (let x = -1000; x < 1000; x += 20) for (let z = -1000; z < 700; z += 20) ids.add(districtAt(x, z).id);
  for (const id of ['downtown', 'residential', 'industrial', 'harbor', 'beach', 'suburb', 'park', 'airport', 'military', 'mountains', 'forest']) assert.ok(ids.has(id), id);
});

test('Strassennetz: zusammenhängend, A* findet Wege, Ampeln, Brücken, Tunnel, Kreisverkehr', () => {
  const g = buildRoadNetwork();
  assert.ok(g.nodes.length > 100);
  const kinds = new Set(g.edges.map((e) => e.kind));
  for (const k of ['street', 'highway', 'bridge', 'tunnel', 'roundabout', 'mountain', 'highwayBridge']) assert.ok(kinds.has(k), k);
  assert.ok(g.nodes.some((n) => n.light));
  // Jeder Knoten von einem Startknoten erreichbar
  const start = g.nodes[0].id;
  let unreachable = 0;
  for (const n of g.nodes) if (n.id !== start && !g.findPath(start, n.id)) unreachable++;
  assert.equal(unreachable, 0);
});

test('Ampeln: Achsen nie gleichzeitig grün', () => {
  const node = { light: { offset: 3 } };
  for (let t = 0; t < 60; t += 0.5) {
    const ns = lightState(node, 'ns', t), ew = lightState(node, 'ew', t);
    assert.ok(!(ns === 'green' && ew === 'green'), `t=${t}`);
  }
});

test('Spurversatz liegt rechts der Fahrtrichtung', () => {
  const pts = offsetPolyline([{ x: 0, z: 0 }, { x: 0, z: -10 }], 2); // nach Norden
  assert.equal(pts[0].x, 2); // rechts = Osten
});

test('Kollision: Bodenhöhe, Wand-Auflösung, Strahltest', () => {
  const c = new CollisionWorld();
  c.add({ minX: 0, maxX: 10, minZ: 0, maxZ: 10, minY: 0, maxY: 5 });
  c.addRamp({ minX: 20, maxX: 30, minZ: 0, maxZ: 4, axis: 'x', y0: 0, y1: 3 });
  assert.equal(c.groundHeight(5, 5, 6).h, 5, 'auf dem Dach');
  assert.equal(c.groundHeight(5, 5, 0).h, 0, 'zu hoch zum Hochsteigen');
  assert.ok(Math.abs(c.groundHeight(25, 2, 2).h - 1.5) < 1e-6, 'Rampe halb');
  const r = c.resolveCircle(-0.2, 5, 0.5, 0, 1.8);
  assert.ok(r.hit && r.x <= -0.5 + 1e-6);
  const hit = c.raycast(-10, 2, 5, 1, 0, 0, 50, { includeTerrain: false });
  assert.ok(hit && Math.abs(hit.t - 10) < 1e-6 && hit.nx === -1);
  assert.equal(rayBox(-10, 2, 5, -1, 0, 0, { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 10 }, 50), null);
});

test('Stadtgenerator: deterministisch, Wahrzeichen frei von Gebäuden', () => {
  const a = generateCity(), b = generateCity();
  assert.equal(a.buildings.length, b.buildings.length);
  assert.ok(a.buildings.length > 200);
  for (const lm of Object.values(LANDMARKS)) {
    for (const bd of a.buildings) {
      const overlap = Math.abs(bd.x - lm.x) < (bd.w + lm.w) / 2 && Math.abs(bd.z - lm.z) < (bd.d + lm.d) / 2;
      assert.ok(!overlap, `Gebäude überlappt ${lm.name.de}`);
    }
  }
});
