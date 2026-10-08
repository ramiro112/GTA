// Baut die sichtbare Stadt (Three.js) aus den Layout-Daten und füllt die Kollisionswelt.
// Strategie für Performance: statische Geometrie wird pro Chunk (200 m) und Material zu
// wenigen grossen Meshes verschmolzen; Requisiten sind InstancedMeshes; Sichtweite und
// Frustum Culling blenden ferne Chunks aus.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { MeshBuilder } from './meshbuilder.js';
import { makeFacade, makeAsphalt, makePavement, makeNoiseTexture, makeRadial } from './textures.js';
import { terrainHeight, districtAt, riverCenter, WATER_Y, inTunnel } from './terrain.js';
import { roadHeight, lightState, BRIDGE_ROWS } from './roads.js';
import { Random } from '../core/random.js';
import { buildLandmarks } from './landmarks.js';
import { PROP_KITS, buildPropKit } from './props.js';

const W = CONFIG.world;

export class City {
  constructor(scene, collision, roads, layout, quality) {
    this.scene = scene;
    this.collision = collision;
    this.roads = roads;
    this.layout = layout;
    this.quality = quality;
    this.meshes = [];          // {mesh, center, radius} für Distanz-Culling
    this.chunks = new Map();
    this.props = [];           // zerstörbare/instanzierte Requisiten
    this.propMeshes = {};
    this.interactables = [];
    this.lightHeads = [];
    this.trafficLights = [];
    this.nightMaterials = [];
    this.root = new THREE.Group();
    this.root.name = 'city';
    scene.add(this.root);
    this._makeMaterials();
  }

  _makeMaterials() {
    const office = makeFacade('office', 11);
    const resi = makeFacade('resi', 22);
    const lambert = (o) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
    this.mat = {
      office: lambert({ map: office.map, emissiveMap: office.emissive, emissive: 0xffffff, emissiveIntensity: 0 }),
      resi: lambert({ map: resi.map, emissiveMap: resi.emissive, emissive: 0xffffff, emissiveIntensity: 0 }),
      plain: lambert({}),
      road: lambert({ map: makeAsphalt() }),
      mark: lambert({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      sidewalk: lambert({ map: makePavement() }),
      terrain: lambert({ map: makeNoiseTexture() }),
      interior: lambert({ emissive: 0x404040 }),
      glow: lambert({ emissive: 0xffffff, emissiveIntensity: 0.2 }),
    };
    this.nightMaterials.push(this.mat.office, this.mat.resi);
    this.lightPoolTex = makeRadial('rgba(255,220,150,0.9)', 'rgba(255,200,120,0)');
  }

  /** Chunk-Builder für eine Position holen. */
  chunk(x, z) {
    const cs = W.chunkSize;
    const cx = Math.floor(x / cs), cz = Math.floor(z / cs);
    const key = `${cx},${cz}`;
    let c = this.chunks.get(key);
    if (!c) {
      c = { cx, cz, b: {} };
      this.chunks.set(key, c);
    }
    return c;
  }

  /** MeshBuilder für Material an Position. */
  mb(x, z, mat) {
    const c = this.chunk(x, z);
    if (!c.b[mat]) c.b[mat] = new MeshBuilder();
    return c.b[mat];
  }

  /** Baut alles. onProgress(0..1, text). Asynchron, damit der Ladebildschirm flüssig bleibt. */
  async build(onProgress = () => {}) {
    const steps = [
      ['Terrain', () => this.buildTerrain()],
      ['Strassen', () => this.buildRoads()],
      ['Gehwege', () => this.buildBlocks()],
      ['Gebäude', () => this.buildBuildings()],
      ['Wahrzeichen', () => { this.landmarks = buildLandmarks(this); }],
      ['Requisiten', () => this.buildProps()],
      ['Bäume', () => this.buildTrees()],
      ['Ampeln', () => this.buildTrafficLights()],
      ['Meshes', () => this.finalizeChunks()],
    ];
    for (let i = 0; i < steps.length; i++) {
      onProgress(i / steps.length, steps[i][0]);
      await new Promise((r) => setTimeout(r, 0));
      steps[i][1]();
    }
    onProgress(1, 'fertig');
  }

  // ------------------------------------------------------------------ Terrain
  buildTerrain() {
    const cs = W.chunkSize;
    const half = W.half;
    const color = new THREE.Color();
    const tmp = new THREE.Color();
    for (let cx = -half; cx < half; cx += cs) {
      for (let cz = -half; cz < half; cz += cs) {
        // Flache Chunks (Stadt) mit grober, unebene (Berge, Fluss, Küste) mit feiner Auflösung
        let flat = true;
        for (let j = 0; j <= cs && flat; j += 10) for (let i = 0; i <= cs; i += 10) if (Math.abs(terrainHeight(cx + i, cz + j)) > 0.01) { flat = false; break; }
        const res = flat ? 25 : 8;
        const n = cs / res + 1;
        const pos = new Float32Array(n * n * 3);
        const col = new Float32Array(n * n * 3);
        const uv = new Float32Array(n * n * 2);
        let allFlat = true;
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const x = cx + i * res, z = cz + j * res;
            let h = terrainHeight(x, z);
            if (inTunnel(x, z)) h = Math.max(h, 9.5); // Tunneldecke verdecken
            if (Math.abs(h) > 0.01) allFlat = false;
            const k = (j * n + i);
            pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
            this._terrainColor(x, z, h, color, tmp);
            col[k * 3] = color.r; col[k * 3 + 1] = color.g; col[k * 3 + 2] = color.b;
            uv[k * 2] = x / 24; uv[k * 2 + 1] = z / 24;
          }
        }
        const idx = [];
        for (let j = 0; j < n - 1; j++) {
          for (let i = 0; i < n - 1; i++) {
            const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
            idx.push(a, c, b, b, c, d);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, this.mat.terrain);
        m.receiveShadow = true;
        m.castShadow = !allFlat;
        m.name = 'terrain';
        this._addMesh(m, false);
      }
    }
    // Weltgrenze: unsichtbare Wände weit draussen im Meer
    const h = W.half;
    for (const b of [[-h - 5, -h, h + 5, -h + 1], [-h - 5, h - 1, h + 5, h], [-h, -h, -h + 1, h], [h - 1, -h, h, h]]) {
      this.collision.add({ minX: b[0], minZ: b[1], maxX: b[2], maxZ: b[3], minY: -50, maxY: 2000, kind: 'worldWall', walkable: false, noRaycast: true });
    }
  }

  _terrainColor(x, z, h, out, tmp) {
    const d = districtAt(x, z).id;
    if (h < WATER_Y - 0.3) {
      out.setHex(h < -8 ? 0x2f5560 : 0xa89a70); // Meeresboden
      return;
    }
    if (d === 'beach' || (h < 0.6 && h > WATER_Y - 0.5 && (z > 500 || x > 870))) { out.setHex(0xe3d29a); return; }
    const rc = riverCenter(z);
    if (Math.abs(x - rc) < W.riverWidth / 2 + 6) { out.setHex(0x7d7356); return; }
    if (d === 'airport' || d === 'military') { out.setHex(d === 'airport' ? 0x7f9a5c : 0x8a8a5c); return; }
    if (h > 3) {
      const slopeish = Math.abs(terrainHeight(x + 4, z) - h) + Math.abs(terrainHeight(x, z + 4) - h);
      if (h > 125) out.setHex(0xf2f4f6);
      else if (slopeish > 6) out.setHex(0x7a746a);
      else out.setHex(0x55793e);
      tmp.setHex(0x3d5a2c);
      out.lerp(tmp, Math.min(1, (h % 17) / 60));
      return;
    }
    if (d === 'downtown' || d === 'industrial' || d === 'harbor') { out.setHex(0x8a8a86); return; }
    out.setHex(d === 'park' ? 0x5c9a48 : 0x6f9a4e);
  }

  // ------------------------------------------------------------------ Strassen
  buildRoads() {
    const g = this.roads;
    const ASPHALT = 0xffffff, WHITE = 0xf2f2f2, YELLOW = 0xf2c12e;
    for (const e of g.edges) {
      const mid = e.points[Math.floor(e.points.length / 2)];
      const hf = (x, z) => roadHeight(e, x, z);
      const road = this.mb(mid.x, mid.z, 'road');
      road.ribbon(e.points, e.width, hf, ASPHALT, 10, e.kind === 'highway' || e.kind === 'tunnel' || e.kind === 'highwayBridge' ? 0.035 : 0.03);
      // Markierungen (an Kreuzungen gekürzt)
      const mark = this.mb(mid.x, mid.z, 'mark');
      const trimmed = trimPolyline(e.points, e.kind === 'roundabout' ? 0 : e.width / 2 + 4);
      if (!trimmed) continue;
      if (e.kind === 'highway' || e.kind === 'tunnel' || e.kind === 'highwayBridge') {
        dashedLine(mark, trimmed, 0.35, 0, 1e9, 0, hf, YELLOW, 0.05, 0.6);
        dashedLine(mark, trimmed, 0.25, 5.5, 3, 6, hf, WHITE, 0.05);
        dashedLine(mark, trimmed, 0.25, -5.5, 3, 6, hf, WHITE, 0.05);
      } else if (e.kind !== 'roundabout') {
        dashedLine(mark, trimmed, 0.22, 0, 3, 4, hf, e.kind === 'mountain' ? YELLOW : WHITE, 0.05);
      }
      // Brücke: Deck, Geländer, Pfeiler
      if (e.kind === 'bridge' || e.kind === 'highwayBridge') this._buildBridge(e);
      if (e.draped) {
        // Bergstrasse: Leitplanken
        const plain = this.mb(mid.x, mid.z, 'plain');
        for (let i = 1; i < e.points.length; i += 2) {
          const p = e.points[i];
          const q = e.points[Math.min(e.points.length - 1, i + 1)];
          const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
          for (const s of [-1, 1]) {
            const ox = (-dz / l) * (e.width / 2 + 0.3) * s, oz = (dx / l) * (e.width / 2 + 0.3) * s;
            const y = hf(p.x + ox, p.z + oz);
            plain.boxRot(p.x + ox, y + 0.45, p.z + oz, 0.15, 0.9, 0.15, 0, 0xdddddd);
          }
        }
      }
    }
    // Kreuzungsflächen
    for (const n of g.nodes) {
      if (n.edges.length < 2 || n.kind === 'roundabout') continue;
      const w = Math.max(...n.edges.map((id) => g.edges[id].width));
      const road = this.mb(n.x, n.z, 'road');
      road.ground(n.x - w / 2, n.z - w / 2, n.x + w / 2, n.z + w / 2, (n.kind === 'mountain' ? terrainHeight(n.x, n.z) : 0) + 0.045, 0xffffff, 10);
      if (n.light) this._crosswalks(n, w);
    }
    // Kreisverkehr: Insel
    const rb = W.roundabout;
    const plain = this.mb(rb.x, rb.z, 'plain');
    const road = this.mb(rb.x, rb.z, 'road');
    ring(road, rb.x, rb.z, rb.radius - 6, rb.radius + 6, 0.032, 32, 0xffffff);
    plain.cylinder(rb.x, 0, rb.z, rb.radius - 6, 0.35, 24, 0x6e9e4e);
    plain.cylinder(rb.x, 0.35, rb.z, 1.2, 4, 8, 0x999999);
    plain.cylinder(rb.x, 4.3, rb.z, 2.2, 0.6, 8, 0xc9b26b);
    this.collision.add({ minX: rb.x - 2, maxX: rb.x + 2, minZ: rb.z - 2, maxZ: rb.z + 2, minY: 0, maxY: 5, kind: 'prop' });
    this.collision.add({ minX: rb.x - rb.radius + 7, maxX: rb.x + rb.radius - 7, minZ: rb.z - rb.radius + 7, maxZ: rb.z + rb.radius - 7, minY: -0.3, maxY: 0.35, kind: 'island', solid: false });
  }

  _crosswalks(n, w) {
    const mark = this.mb(n.x, n.z, 'mark');
    for (const eid of n.edges) {
      const e = this.roads.edges[eid];
      const other = e.a === n.id ? e.points[1] : e.points[e.points.length - 2];
      const dx = other.x - n.x, dz = other.z - n.z, l = Math.hypot(dx, dz) || 1;
      const ux = dx / l, uz = dz / l; // weg von der Kreuzung
      const rx = -uz, rz = ux;
      const d0 = w / 2 + 1.0, d1 = w / 2 + 4.0;
      for (let s = -e.width / 2 + 0.8; s < e.width / 2 - 0.5; s += 1.2) {
        const p = (t, o) => [n.x + ux * t + rx * o, 0.06, n.z + uz * t + rz * o];
        mark.quad(p(d0, s), p(d0, s + 0.6), p(d1, s + 0.6), p(d1, s), [0, 1, 0], 0xf4f4f4);
      }
      // Haltelinie (rechte Fahrbahnhälfte, ankommend)
      const p = (t, o) => [n.x + ux * t + rx * o, 0.06, n.z + uz * t + rz * o];
      mark.quad(p(d1 + 0.4, -e.width / 2 + 0.3), p(d1 + 0.4, -0.2), p(d1 + 0.9, -0.2), p(d1 + 0.9, -e.width / 2 + 0.3), [0, 1, 0], 0xf4f4f4);
    }
  }

  _buildBridge(e) {
    const a = e.points[0], b = e.points[e.points.length - 1];
    const z = a.z;
    const rc = riverCenter(z);
    const x0 = rc - W.riverWidth / 2 - 20, x1 = rc + W.riverWidth / 2 + 20;
    const hw = e.width / 2 + 1.5;
    const plain = this.mb(rc, z, 'plain');
    plain.box(x0, -1.2, z - hw, x1, -0.02, z + hw, 0x9a9590, { skipBottom: false });
    plain.box(x0, 0, z - hw, x1, 1.1, z - hw + 0.4, 0xb0aaa0);
    plain.box(x0, 0, z + hw - 0.4, x1, 1.1, z + hw, 0xb0aaa0);
    for (let x = x0 + 12; x < x1 - 6; x += 18) plain.box(x - 1, -8, z - hw + 2, x + 1, -1.2, z + hw - 2, 0x8a8580);
    // Bogen als Dekor
    for (let i = 0; i < 12; i++) {
      const t0 = i / 12, t1 = (i + 1) / 12;
      const xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1;
      const ya = 1.1 + Math.sin(t0 * Math.PI) * 9, yb = 1.1 + Math.sin(t1 * Math.PI) * 9;
      for (const s of [-1, 1]) plain.box(Math.min(xa, xb), Math.min(ya, yb), z + s * hw - 0.25, Math.max(xa, xb), Math.max(ya, yb) + 0.5, z + s * hw + 0.25, 0xc04a2a);
    }
    // Kollision: Deck (begehbar), Geländer
    this.collision.add({ minX: x0, maxX: x1, minZ: z - hw, maxZ: z + hw, minY: -1.2, maxY: 0, kind: 'deck' });
    this.collision.add({ minX: x0, maxX: x1, minZ: z - hw, maxZ: z - hw + 0.4, minY: 0, maxY: 1.1, kind: 'rail' });
    this.collision.add({ minX: x0, maxX: x1, minZ: z + hw - 0.4, maxZ: z + hw, minY: 0, maxY: 1.1, kind: 'rail' });
  }

  // ------------------------------------------------------------------ Blöcke / Gehwege
  buildBlocks() {
    const SW = W.sidewalkWidth;
    const top = 0.12;
    for (const b of this.layout.blocks) {
      const strips = [
        [b.minX, b.minZ, b.maxX, b.minZ + SW],
        [b.minX, b.maxZ - SW, b.maxX, b.maxZ],
        [b.minX, b.minZ + SW, b.minX + SW, b.maxZ - SW],
        [b.maxX - SW, b.minZ + SW, b.maxX, b.maxZ - SW],
      ];
      for (const s of strips) {
        let parts = [s];
        if (b.river) parts = splitAroundRiver(s);
        for (const p of parts) {
          const sw = this.mb((p[0] + p[2]) / 2, (p[1] + p[3]) / 2, 'sidewalk');
          sw.box(p[0], -0.2, p[1], p[2], top, p[3], 0xffffff, { skipTop: true });
          sw.ground(p[0], p[1], p[2], p[3], top, 0xffffff, 4);
          this.collision.add({ minX: p[0], minZ: p[1], maxX: p[2], maxZ: p[3], minY: -0.3, maxY: top, kind: 'sidewalk', solid: false });
        }
      }
      // Innenfläche gepflastert?
      if (['downtown', 'industrial', 'harbor'].includes(b.district) && !b.river) {
        const c = b.district === 'downtown' ? 0xb8b4ac : 0x9a968e;
        const sw = this.mb((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 'sidewalk');
        sw.ground(b.minX + SW, b.minZ + SW, b.maxX - SW, b.maxZ - SW, top - 0.005, c, 6);
        this.collision.add({ minX: b.minX + SW, minZ: b.minZ + SW, maxX: b.maxX - SW, maxZ: b.maxZ - SW, minY: -0.3, maxY: top, kind: 'ground', solid: false });
      }
    }
  }

  // ------------------------------------------------------------------ Gebäude
  buildBuildings() {
    const rng = new Random(99);
    for (const b of this.layout.buildings) {
      const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
      const roofColor = 0x5a5a5e;
      if (b.style === 'office' || b.style === 'resi') {
        const m = this.mb(b.x, b.z, b.style);
        m.box(x0, 0, z0, x1, b.h, z1, b.color, { uvScale: [12, 12], topColor: roofColor, uvOffset: rng.int(0, 3) * 0.25 });
        const p = this.mb(b.x, b.z, 'plain');
        // Dachbrüstung
        p.box(x0, b.h, z0, x1, b.h + 1, z0 + 0.4, b.color);
        p.box(x0, b.h, z1 - 0.4, x1, b.h + 1, z1, b.color);
        p.box(x0, b.h, z0, x0 + 0.4, b.h + 1, z1, b.color);
        p.box(x1 - 0.4, b.h, z0, x1, b.h + 1, z1, b.color);
        // Sockel / Erdgeschoss dunkler
        p.box(x0 - 0.15, 0, z0 - 0.15, x1 + 0.15, 3.2, z1 + 0.15, darken(b.color, 0.55), { skipTop: true });
        if (b.roofProps) {
          p.box(b.x - 3, b.h, b.z - 2, b.x + 3, b.h + 2.5, b.z + 2, 0x8a8a8a);
          p.cylinder(x0 + 3, b.h, z0 + 3, 0.15, 12, 4, 0xaaaaaa);
        }
        this._roofEdges(b);
      } else if (b.style === 'house') {
        const m = this.mb(b.x, b.z, 'resi');
        m.box(x0, 0, z0, x1, b.h, z1, b.color, { uvScale: [12, 12], topColor: b.roofColor });
        this.mb(b.x, b.z, 'plain').gable(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, b.h, 3, b.roofColor);
      } else {
        const p = this.mb(b.x, b.z, 'plain');
        p.box(x0, 0, z0, x1, b.h, z1, b.color, { topColor: 0x6a6a6a });
        // Rolltore
        p.box(b.x - 4, 0, z1, b.x + 4, 5, z1 + 0.15, 0x4a4a4a);
        p.box(b.x - 4, 0, z0 - 0.15, b.x + 4, 5, z0, 0x4a4a4a);
        // Dachoberlichter
        for (let x = x0 + 4; x < x1 - 4; x += 8) p.box(x, b.h, z0 + 3, x + 3, b.h + 0.8, z1 - 3, 0x7a8a99);
      }
      this.collision.add({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: 0, maxY: b.h, kind: 'building', data: b });
      if (b.helipad) this.addHelipad(b.x, b.h + 0.05, b.z, Math.min(b.w, b.d) * 0.7);
    }
  }

  _roofEdges(b) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    const t = 0.4;
    for (const r of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0, x0 + t, z1], [x1 - t, z0, x1, z1]]) {
      this.collision.add({ minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], minY: b.h, maxY: b.h + 1, kind: 'parapet' });
    }
  }

  addHelipad(x, y, z, size) {
    if (!this._helipadMat) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 76px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 68);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this._helipadMat = new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2 });
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this._helipadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.02, z);
    m.receiveShadow = true;
    this._addMesh(m);
    if (!this.helipads) this.helipads = [];
    this.helipads.push({ x, y, z });
  }

  // ------------------------------------------------------------------ Requisiten
  buildProps() {
    const density = this.quality.propsDensity;
    const rng = new Random(5);
    const byType = {};
    for (const p of this.layout.props) {
      if (p.type === 'pier') { this._buildPier(p); continue; }
      if (p.type === 'container' && p.stack > 1) {
        for (let k = 0; k < p.stack; k++) (byType.container ||= []).push({ ...p, y: k * 2.6 });
        continue;
      }
      const kit = PROP_KITS[p.type];
      if (!kit) continue;
      if (kit.optional && rng.next() > density) continue;
      (byType[p.type] ||= []).push(p);
    }
    for (const [type, list] of Object.entries(byType)) this._instanceProps(type, list);
    // Lichtkegel der Laternen (nachts sichtbar)
    const lamps = byType.lamp || [];
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    this.lightPoolMat = new THREE.MeshBasicMaterial({ map: this.lightPoolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = new THREE.InstancedMesh(poolGeo, this.lightPoolMat, lamps.length);
    const m = new THREE.Matrix4();
    lamps.forEach((p, i) => {
      const ox = Math.sin(p.rot) * 1.8, oz = Math.cos(p.rot) * 1.8;
      m.makeTranslation(p.x + ox, 0.2, p.z + oz);
      pools.setMatrixAt(i, m);
    });
    pools.renderOrder = 2;
    pools.frustumCulled = false;
    this.root.add(pools);
    this.lightPools = pools;
    this.lampList = lamps;
  }

  _instanceProps(type, list) {
    const kit = buildPropKit(type);
    const parts = kit.parts; // [{geometry, material, glow?}]
    const meshes = parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      im.castShadow = !!kit.castShadow && this.quality.shadows;
      im.receiveShadow = true;
      if (part.glow) this.nightMaterials.push(part.material);
      this.root.add(im);
      return im;
    });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    const col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((p, i) => {
      const scale = p.s || 1;
      const lenScale = p.len ? p.len / kit.size[0] : 1;
      const y = (p.y || 0) + (kit.onGround === false ? 0 : groundY(p.x, p.z));
      q.setFromAxisAngle(up, p.rot || 0);
      s.set(scale * lenScale, scale, scale);
      t.set(p.x, y, p.z);
      m.compose(t, q, s);
      for (const im of meshes) im.setMatrixAt(i, m);
      if (p.color !== undefined && kit.tintable) { col.setHex(p.color); meshes[0].setColorAt(i, col); }
      // Kollisionsbox (achsparallel aus gedrehter Grundfläche)
      if (kit.collider) {
        const [cw, ch, cd] = kit.collider;
        const w = cw * scale * lenScale, d = cd * scale;
        const c = Math.abs(Math.cos(p.rot || 0)), sn = Math.abs(Math.sin(p.rot || 0));
        const ax = (w * c + d * sn) / 2, az = (w * sn + d * c) / 2;
        const box = this.collision.add({
          minX: p.x - ax, maxX: p.x + ax, minZ: p.z - az, maxZ: p.z + az,
          minY: y, maxY: y + ch * scale, kind: 'prop', walkable: !!kit.walkable,
          destructible: !!kit.destructible, explosive: kit.explosive || 0, propType: type,
        });
        const rec = { type, index: i, meshes, x: p.x, y, z: p.z, rot: p.rot || 0, scale, lenScale, box, broken: false, kit };
        box.prop = rec;
        this.props.push(rec);
      }
    });
    for (const im of meshes) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.propMeshes[type] = meshes;
  }

  /** Requisit zerstören (vom Fahrzeug umgefahren / Explosion). Liefert Datensatz für Trümmer. */
  breakProp(rec) {
    if (rec.broken) return null;
    rec.broken = true;
    rec.brokenAt = performance.now();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of rec.meshes) { im.setMatrixAt(rec.index, zero); im.instanceMatrix.needsUpdate = true; }
    this.collision.remove(rec.box);
    if (rec.type === 'lamp' && this.lightPools) {
      const li = this.lampList.findIndex((l) => Math.abs(l.x - rec.x) < 0.01 && Math.abs(l.z - rec.z) < 0.01);
      if (li >= 0) { this.lightPools.setMatrixAt(li, zero); this.lightPools.instanceMatrix.needsUpdate = true; }
    }
    return rec;
  }

  /** Zerstörte Requisiten nach einiger Zeit wieder aufbauen, wenn der Spieler weit weg ist. */
  restoreProps(px, pz) {
    const now = performance.now();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    for (const rec of this.props) {
      if (!rec.broken || now - rec.brokenAt < 90000) continue;
      if (Math.hypot(rec.x - px, rec.z - pz) < 120) continue;
      rec.broken = false;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rec.rot);
      s.set(rec.scale * rec.lenScale, rec.scale, rec.scale);
      t.set(rec.x, rec.y, rec.z);
      m.compose(t, q, s);
      for (const im of rec.meshes) { im.setMatrixAt(rec.index, m); im.instanceMatrix.needsUpdate = true; }
      this.collision.add(rec.box);
    }
  }

  _buildPier(p) {
    const plain = this.mb(p.x, p.z, 'plain');
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
    plain.box(x0, -0.3, z0, x1, 0.4, z1, 0x8b6a45, { skipBottom: false });
    for (let z = z0 + 4; z < z1; z += 8) for (const x of [x0 + 0.5, x1 - 0.5]) plain.box(x - 0.3, -8, z - 0.3, x + 0.3, -0.3, z + 0.3, 0x6b4a2a);
    plain.box(x0, 0.4, z0, x0 + 0.2, 1.4, z1, 0x8b6a45);
    plain.box(x1 - 0.2, 0.4, z0, x1, 1.4, z1, 0x8b6a45);
    this.collision.add({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: -0.3, maxY: 0.4, kind: 'deck' });
    this.collision.add({ minX: x0, maxX: x0 + 0.2, minZ: z0, maxZ: z1, minY: 0.4, maxY: 1.4, kind: 'rail' });
    this.collision.add({ minX: x1 - 0.2, maxX: x1, minZ: z0, maxZ: z1, minY: 0.4, maxY: 1.4, kind: 'rail' });
  }

  // ------------------------------------------------------------------ Bäume
  buildTrees() {
    const leaf = [], pine = [];
    for (const t of this.layout.trees) (t.kind === 'pine' ? pine : leaf).push({ type: t.kind === 'pine' ? 'pine' : 'tree', x: t.x, z: t.z, s: t.s, rot: (t.x * 13.7) % 6.28 });
    for (const p of this.layout.props) if (p.type === 'streettree') leaf.push({ type: 'tree', x: p.x, z: p.z, s: 0.8, rot: 0 });
    this._instanceProps('tree', leaf);
    this._instanceProps('pine', pine);
  }

  // ------------------------------------------------------------------ Ampeln
  buildTrafficLights() {
    const nodes = this.roads.nodes.filter((n) => n.light);
    const heads = [];
    for (const n of nodes) {
      for (const eid of n.edges) {
        const e = this.roads.edges[eid];
        const other = e.a === n.id ? e.points[1] : e.points[e.points.length - 2];
        const dx = other.x - n.x, dz = other.z - n.z, l = Math.hypot(dx, dz) || 1;
        const ux = dx / l, uz = dz / l;
        const rx = -uz, rz = ux;
        // Mast an der rechten Ecke der ankommenden Fahrspur
        const off = e.width / 2 + 1.0;
        // rechts aus Sicht des ankommenden Verkehrs (fährt in Richtung -u) ist -r
        const px = n.x + ux * (e.width / 2 + 5) - rx * off, pz = n.z + uz * (e.width / 2 + 5) - rz * off;
        heads.push({ node: n, x: px, z: pz, rot: Math.atan2(ux, uz), axis: Math.abs(uz) > Math.abs(ux) ? 'ns' : 'ew' });
      }
    }
    const kit = buildPropKit('trafficlight');
    const pole = new THREE.InstancedMesh(kit.parts[0].geometry, kit.parts[0].material, heads.length);
    const bulbGeo = new THREE.SphereGeometry(0.17, 8, 6);
    const mk = (c) => new THREE.MeshBasicMaterial({ color: c });
    const bulbs = { red: new THREE.InstancedMesh(bulbGeo, mk(0xff2020), heads.length), yellow: new THREE.InstancedMesh(bulbGeo, mk(0xffc000), heads.length), green: new THREE.InstancedMesh(bulbGeo, mk(0x20ff60), heads.length) };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    heads.forEach((h, i) => {
      q.setFromAxisAngle(up, h.rot);
      m.compose(new THREE.Vector3(h.x, 0.12, h.z), q, new THREE.Vector3(1, 1, 1));
      pole.setMatrixAt(i, m);
      this.collision.add({ minX: h.x - 0.2, maxX: h.x + 0.2, minZ: h.z - 0.2, maxZ: h.z + 0.2, minY: 0, maxY: 4.5, kind: 'prop' });
    });
    pole.castShadow = this.quality.shadows;
    this.root.add(pole);
    for (const b of Object.values(bulbs)) { b.frustumCulled = false; this.root.add(b); }
    this.trafficLights = heads;
    this.bulbs = bulbs;
    this._lightStates = new Array(heads.length).fill('');
  }

  _updateTrafficLights(t) {
    if (!this.bulbs) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    let dirty = false;
    this.trafficLights.forEach((h, i) => {
      const st = lightState(h.node, h.axis, t);
      if (st === this._lightStates[i]) return;
      this._lightStates[i] = st;
      dirty = true;
      q.setFromAxisAngle(up, h.rot);
      const ys = { red: 4.05, yellow: 3.7, green: 3.35 };
      for (const c of ['red', 'yellow', 'green']) {
        if (c === st) {
          // Kugel leicht vor dem Gehäuse (Richtung ankommender Verkehr)
          const ox = Math.sin(h.rot) * 0.2, oz = Math.cos(h.rot) * 0.2;
          m.compose(new THREE.Vector3(h.x + ox, ys[c] + 0.12, h.z + oz), q, new THREE.Vector3(1, 1, 1));
          this.bulbs[c].setMatrixAt(i, m);
        } else this.bulbs[c].setMatrixAt(i, zero);
      }
    });
    if (dirty) for (const b of Object.values(this.bulbs)) b.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Abschluss
  finalizeChunks() {
    for (const c of this.chunks.values()) {
      for (const [matName, mb] of Object.entries(c.b)) {
        if (mb.empty) continue;
        const mesh = new THREE.Mesh(mb.build(), this.mat[matName]);
        mesh.receiveShadow = true;
        mesh.castShadow = this.quality.shadows && ['office', 'resi', 'plain'].includes(matName);
        mesh.name = `chunk ${c.cx},${c.cz} ${matName}`;
        this._addMesh(mesh);
      }
    }
    this.chunks.clear();
  }

  _addMesh(mesh, always = false) {
    this.root.add(mesh);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const bs = mesh.geometry.boundingSphere;
    const center = bs.center.clone().applyMatrix4(mesh.matrixWorld);
    this.meshes.push({ mesh, center, radius: bs.radius, always });
  }

  /** Pro Frame: Sichtweite, Ampeln, Nachtbeleuchtung. */
  update(dt, time, camPos, night) {
    const dd = this.quality.drawDistance;
    for (const m of this.meshes) {
      if (m.always) continue;
      const d = Math.hypot(m.center.x - camPos.x, m.center.z - camPos.z) - m.radius;
      m.mesh.visible = d < dd;
    }
    this._updateTrafficLights(time);
    const glow = night;
    for (const mat of this.nightMaterials) mat.emissiveIntensity = mat === this.mat.office || mat === this.mat.resi ? glow * 1.1 : 0.15 + glow * 1.2;
    if (this.lightPoolMat) this.lightPoolMat.opacity = glow * 0.85;
  }

  setDrawDistance(d) { this.quality.drawDistance = d; }
}

// ---------------------------------------------------------------- Hilfsfunktionen

function groundY(x, z) {
  const h = terrainHeight(x, z);
  return h > 0.05 || h < -0.05 ? h : 0.12;
}

function darken(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

/** Kürzt eine Polylinie an beiden Enden um cut Meter. */
function trimPolyline(pts, cut) {
  if (cut <= 0) return pts;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  if (total < cut * 2 + 1) return null;
  const pointAt = (d) => {
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      if (acc + l >= d) { const t = (d - acc) / l; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t, i }; }
      acc += l;
    }
    return { ...pts[pts.length - 1], i: pts.length - 1 };
  };
  const a = pointAt(cut), b = pointAt(total - cut);
  const out = [{ x: a.x, z: a.z }];
  for (let i = a.i; i < b.i; i++) out.push(pts[i]);
  out.push({ x: b.x, z: b.z });
  return out;
}

/** Gestrichelte (oder durchgezogene) Linie entlang Polylinie mit seitlichem Versatz. */
function dashedLine(mb, pts, width, offset, dash, gap, hf, color, lift, doubleGap = 0) {
  const offsets = doubleGap ? [offset - doubleGap / 2, offset + doubleGap / 2] : [offset];
  for (const off of offsets) {
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
      if (l < 0.01) continue;
      const ux = dx / l, uz = dz / l, rx = -uz, rz = ux;
      let s = carry;
      while (s < l) {
        const e = Math.min(l, s + dash);
        const P = (t, o) => { const x = p.x + ux * t + rx * o, z = p.z + uz * t + rz * o; return [x, hf(x, z) + lift, z]; };
        mb.quad(P(s, off - width / 2), P(s, off + width / 2), P(e, off + width / 2), P(e, off - width / 2), [0, 1, 0], color);
        s += dash + gap;
      }
      carry = s - l;
    }
  }
}

function ring(mb, cx, cz, r0, r1, y, seg, color) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r, a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    mb.quad(p(r1, a0), p(r0, a0), p(r0, a1), p(r1, a1), [0, 1, 0], color);
  }
}

/** Teilt einen Gehwegstreifen am Fluss. */
function splitAroundRiver(s) {
  const [x0, z0, x1, z1] = s;
  const zc = (z0 + z1) / 2;
  const rc = riverCenter(zc);
  const r0 = rc - W.riverWidth / 2 - 6, r1 = rc + W.riverWidth / 2 + 6;
  if (x1 < r0 || x0 > r1) return [s];
  // Auf Brückenzeilen geht der Gehweg über die Brücke (dort gibt es das Deck)
  const out = [];
  if (x0 < r0) out.push([x0, z0, r0, z1]);
  if (x1 > r1) out.push([r1, z0, x1, z1]);
  return out;
}

export { BRIDGE_ROWS };
