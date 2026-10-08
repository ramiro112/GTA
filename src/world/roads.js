// Strassennetz als Graph: Knoten (Kreuzungen) und Kanten (Strassen als Polylinien).
// Wird für Rendering, Verkehrs-KI, Polizei-Navigation, GPS-Route und Passanten genutzt.
// Reine Logik ohne Three.js → in Node testbar.

import { CONFIG } from '../config.js';
import { riverCenter, terrainHeight } from './terrain.js';

const W = CONFIG.world;

export class RoadGraph {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this._nodeKey = new Map();
  }

  addNode(x, z, kind = 'street') {
    const key = `${Math.round(x)},${Math.round(z)}`;
    if (this._nodeKey.has(key)) return this._nodeKey.get(key);
    const node = { id: this.nodes.length, x, z, kind, edges: [], light: null };
    this.nodes.push(node);
    this._nodeKey.set(key, node);
    return node;
  }

  getNode(x, z) { return this._nodeKey.get(`${Math.round(x)},${Math.round(z)}`) || null; }

  /**
   * Fügt eine Kante hinzu. points: Zwischenpunkte (ohne Start/Ende).
   * oneWay: nur von a nach b befahrbar.
   */
  addEdge(a, b, { kind = 'street', points = [], width = W.roadWidth, lanes = 1, speed = CONFIG.ai.trafficSpeed, oneWay = false, draped = false } = {}) {
    const pts = [{ x: a.x, z: a.z }, ...points, { x: b.x, z: b.z }];
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const edge = { id: this.edges.length, a: a.id, b: b.id, points: pts, kind, width, lanes, speed, oneWay, length, draped };
    this.edges.push(edge);
    a.edges.push(edge.id);
    b.edges.push(edge.id);
    return edge;
  }

  /** Nachbarn eines Knotens: [{edge, node, forward}] (respektiert Einbahnstrassen). */
  neighbors(nodeId) {
    const node = this.nodes[nodeId];
    const out = [];
    for (const eid of node.edges) {
      const e = this.edges[eid];
      if (e.a === nodeId) out.push({ edge: e, node: this.nodes[e.b], forward: true });
      else if (!e.oneWay) out.push({ edge: e, node: this.nodes[e.a], forward: false });
    }
    return out;
  }

  /** Nächster Knoten zu (x,z). */
  nearestNode(x, z, filter = null) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (filter && !filter(n)) continue;
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** Nächste Strasse zu (x,z): {edge, seg, t, x, z, d}. */
  nearestEdgePoint(x, z) {
    let best = null;
    for (const e of this.edges) {
      for (let i = 1; i < e.points.length; i++) {
        const p = e.points[i - 1], q = e.points[i];
        const dx = q.x - p.x, dz = q.z - p.z;
        const len2 = dx * dx + dz * dz || 1e-9;
        let t = ((x - p.x) * dx + (z - p.z) * dz) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = p.x + dx * t, pz = p.z + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (!best || d < best.d) best = { edge: e, seg: i - 1, t, x: px, z: pz, d };
      }
    }
    return best;
  }

  /** A*-Suche zwischen zwei Knoten. Liefert Liste [{edge, forward, node}] oder null. */
  findPath(startId, goalId) {
    if (startId === goalId) return [];
    const goal = this.nodes[goalId];
    const h = (n) => Math.hypot(n.x - goal.x, n.z - goal.z);
    const open = new MinHeap();
    const g = new Map([[startId, 0]]);
    const came = new Map();
    const closed = new Set();
    open.push(startId, h(this.nodes[startId]));
    while (open.size) {
      const cur = open.pop();
      if (cur === goalId) {
        const path = [];
        let c = goalId;
        while (came.has(c)) { const step = came.get(c); path.unshift(step); c = step.from; }
        return path;
      }
      if (closed.has(cur)) continue;
      closed.add(cur);
      for (const nb of this.neighbors(cur)) {
        const cost = g.get(cur) + nb.edge.length / (nb.edge.kind === 'highway' ? 1.6 : 1);
        if (cost < (g.get(nb.node.id) ?? Infinity)) {
          g.set(nb.node.id, cost);
          came.set(nb.node.id, { edge: nb.edge, forward: nb.forward, node: nb.node, from: cur });
          open.push(nb.node.id, cost + h(nb.node));
        }
      }
    }
    return null;
  }

  /** Polylinie einer Spur (rechts versetzt in Fahrtrichtung). laneIndex 0 = innen. */
  lanePoints(edge, forward, laneIndex = 0) {
    const pts = forward ? edge.points : [...edge.points].reverse();
    const off = edge.oneWay ? 0 : laneOffsetFor(edge, laneIndex);
    return offsetPolyline(pts, off);
  }
}

export function laneOffsetFor(edge, laneIndex = 0) {
  if (edge.kind === 'highway' || edge.kind === 'tunnel' || edge.kind === 'highwayBridge') return laneIndex === 0 ? 3 : 8;
  return W.laneOffset;
}

/** Versetzt eine Polylinie seitlich (positiv = rechts in Laufrichtung). */
export function offsetPolyline(pts, off) {
  if (!off) return pts.map((p) => ({ x: p.x, z: p.z }));
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    let dx = p1.x - p0.x, dz = p1.z - p0.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    // rechts von (dx,dz) ist (-dz, dx) bei x=Ost, z=Süd, Blick von oben
    out.push({ x: pts[i].x - dz * off, z: pts[i].z + dx * off });
  }
  return out;
}

/** Binärer Min-Heap für A*. */
export class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value, prio) {
    const a = this.items;
    a.push({ value, prio });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].prio <= a[i].prio) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].prio < a[m].prio) m = l;
        if (r < a.length && a[r].prio < a[m].prio) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.value;
  }
}

/** Zeilen (z), in denen eine Brücke über den Fluss führt. */
export const BRIDGE_ROWS = [-300, -60, 180, 420];

/** Baut das komplette Strassennetz von Port Aurelia. */
export function buildRoadNetwork() {
  const g = new RoadGraph();
  const xs = W.blockLines.x;
  const zs = W.blockLines.z;
  const R = W.ring;
  const T = W.tunnel;
  const RB = W.roundabout;
  const westXs = xs.filter((x) => x < W.riverX);
  const eastXs = xs.filter((x) => x > W.riverX);
  const inTunnelX = (x) => x > T.x0 - 15 && x < T.x1 + 15;
  const isRoundabout = (x, z) => x === RB.x && z === RB.z;

  // Kreisverkehr: vier Knoten auf dem Ring
  const rbNodes = {
    e: g.addNode(RB.x + RB.radius, RB.z, 'roundabout'),
    n: g.addNode(RB.x, RB.z - RB.radius, 'roundabout'),
    w: g.addNode(RB.x - RB.radius, RB.z, 'roundabout'),
    s: g.addNode(RB.x, RB.z + RB.radius, 'roundabout'),
  };
  const arc = (from, to, a0, a1) => {
    const pts = [];
    for (let i = 1; i < 6; i++) {
      const a = a0 + (a1 - a0) * (i / 6);
      pts.push({ x: RB.x + Math.cos(a) * RB.radius, z: RB.z + Math.sin(a) * RB.radius });
    }
    g.addEdge(from, to, { kind: 'roundabout', points: pts, oneWay: true, speed: 8, width: 10 });
  };
  // Gegen den Uhrzeigersinn von oben gesehen (Norden oben): Ost → Nord → West → Süd → Ost
  arc(rbNodes.e, rbNodes.n, 0, -Math.PI / 2);
  arc(rbNodes.n, rbNodes.w, -Math.PI / 2, -Math.PI);
  arc(rbNodes.w, rbNodes.s, -Math.PI, -Math.PI * 1.5);
  arc(rbNodes.s, rbNodes.e, Math.PI / 2, 0);

  /** Liefert für eine Strasse, die auf den Kreisverkehr trifft, den passenden Ringknoten. */
  const nodeAt = (x, z, fromX, fromZ) => {
    if (isRoundabout(x, z)) {
      if (fromX > x) return rbNodes.e;
      if (fromX < x) return rbNodes.w;
      if (fromZ < z) return rbNodes.n;
      return rbNodes.s;
    }
    const kind = x === R.minX || x === R.maxX || z === R.minZ || z === R.maxZ ? 'highway' : 'street';
    return g.addNode(x, z, kind);
  };

  const street = (x0, z0, x1, z1, opts = {}) => {
    const a = nodeAt(x0, z0, x1, z1);
    const b = nodeAt(x1, z1, x0, z0);
    return g.addEdge(a, b, opts);
  };

  // --- Ost-West-Strassen ---
  for (const z of zs) {
    const row = [R.minX, ...westXs, ...eastXs, R.maxX];
    for (let i = 1; i < row.length; i++) {
      const x0 = row[i - 1], x1 = row[i];
      const crossesRiver = x0 < W.riverX && x1 > W.riverX;
      if (crossesRiver && !BRIDGE_ROWS.includes(z)) continue;
      street(x0, z, x1, z, { kind: crossesRiver ? 'bridge' : 'street' });
    }
  }
  // --- Nord-Süd-Strassen ---
  for (const x of xs) {
    const col = [R.minZ, ...zs, R.maxZ];
    for (let i = 1; i < col.length; i++) {
      const z0 = col[i - 1], z1 = col[i];
      if (z0 === R.minZ && inTunnelX(x)) continue; // würde im Tunnel münden
      street(x, z0, x, z1);
    }
  }
  // --- Autobahnring ---
  const hw = { kind: 'highway', width: W.highwayWidth, lanes: 2, speed: CONFIG.ai.trafficHighwaySpeed };
  const north = [R.minX, ...xs.filter((x) => !inTunnelX(x)), R.maxX];
  for (let i = 1; i < north.length; i++) {
    const x0 = north[i - 1], x1 = north[i];
    const crossesRiver = x0 < W.riverX && x1 > W.riverX;
    const throughTunnel = x0 < T.x0 && x1 > T.x1;
    const pts = throughTunnel ? [{ x: T.x0, z: R.minZ }, { x: T.x1, z: R.minZ }] : [];
    street(x0, R.minZ, x1, R.minZ, { ...hw, kind: throughTunnel ? 'tunnel' : crossesRiver ? 'highwayBridge' : 'highway', points: pts });
  }
  const south = [R.minX, ...xs, R.maxX];
  for (let i = 1; i < south.length; i++) {
    const x0 = south[i - 1], x1 = south[i];
    const crossesRiver = x0 < W.riverX && x1 > W.riverX;
    street(x0, R.maxZ, x1, R.maxZ, { ...hw, kind: crossesRiver ? 'highwayBridge' : 'highway' });
  }
  for (const x of [R.minX, R.maxX]) {
    const col = [R.minZ, ...zs, R.maxZ];
    for (let i = 1; i < col.length; i++) street(x, col[i - 1], x, col[i], hw);
  }

  // --- Zufahrten ausserhalb des Rings ---
  // Flughafen
  const apA = g.getNode(-440, R.minZ);
  const apB = g.addNode(-440, -650, 'airport');
  const apC = g.addNode(-760, -650, 'airport');
  const apD = g.addNode(-300, -650, 'airport');
  g.addEdge(apA, apB, { kind: 'street' });
  g.addEdge(apB, apC, { kind: 'street' });
  g.addEdge(apB, apD, { kind: 'street' });
  // Militärbasis
  const mA = g.getNode(630, R.minZ);
  const mB = g.addNode(630, -610, 'military');
  const mC = g.addNode(630, -760, 'military');
  const mD = g.addNode(450, -760, 'military');
  const mE = g.addNode(800, -760, 'military');
  g.addEdge(mA, mB, { kind: 'street' });
  g.addEdge(mB, mC, { kind: 'street' });
  g.addEdge(mC, mD, { kind: 'street' });
  g.addEdge(mC, mE, { kind: 'street' });
  // Bergstrasse mit Serpentinen zum Gipfel-Aussichtspunkt
  const bA = g.getNode(-90, R.minZ);
  const bEnd = g.addNode(120, -860, 'mountain');
  const serp = [];
  const raw = [[-95, -600], [-60, -640], [-110, -680], [-40, -720], [-100, -760], [-10, -790], [60, -810], [20, -840], [90, -850]];
  for (const [x, z] of raw) serp.push({ x, z });
  const dense = densify([{ x: bA.x, z: bA.z }, ...serp, { x: bEnd.x, z: bEnd.z }], 6).slice(1, -1);
  g.addEdge(bA, bEnd, { kind: 'mountain', points: dense, speed: 10, draped: true });

  // Ampeln an Stadtkreuzungen (ab Grad 3, nicht im Vorort, nicht am Kreisverkehr)
  for (const n of g.nodes) {
    if (n.kind !== 'street') continue;
    if (n.x < -100 || n.edges.length < 3) continue;
    n.light = { offset: ((n.x * 7 + n.z * 3) % 13 + 13) % 13, phase: 0 };
  }
  return g;
}

/** Unterteilt eine Polylinie in Abschnitte von max. step Metern. */
export function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const l = Math.hypot(q.x - p.x, q.z - p.z);
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++) out.push({ x: p.x + (q.x - p.x) * (k / n), z: p.z + (q.z - p.z) * (k / n) });
  }
  return out;
}

// --- Ampelphasen ---------------------------------------------------------
// Zyklus 26 s: 0–11 N/S grün, 11–13 gelb, 13–24 O/W grün, 24–26 gelb.
export const LIGHT_CYCLE = 26;

/** Zustand einer Ampel für eine Achse ('ns' oder 'ew') zur Zeit t: 'green' | 'yellow' | 'red'. */
export function lightState(node, axis, t) {
  if (!node || !node.light) return 'green';
  const p = (t + node.light.offset) % LIGHT_CYCLE;
  if (axis === 'ns') return p < 11 ? 'green' : p < 13 ? 'yellow' : 'red';
  return p >= 13 && p < 24 ? 'green' : p >= 24 ? 'yellow' : 'red';
}

/** Achse einer Bewegungsrichtung. */
export const axisOf = (dx, dz) => (Math.abs(dz) > Math.abs(dx) ? 'ns' : 'ew');

/** Höhe einer Strasse an einem Punkt (draped = folgt Terrain). */
export function roadHeight(edge, x, z) {
  return edge.draped ? Math.max(terrainHeight(x, z), CONFIG.world.waterY + 0.5) : 0;
}

/** Brückendeck-Spanne über dem Fluss für eine Kante (x-Bereich). */
export function bridgeSpan(z) {
  const c = riverCenter(z);
  return { x0: c - W.riverWidth / 2 - 22, x1: c + W.riverWidth / 2 + 22 };
}
