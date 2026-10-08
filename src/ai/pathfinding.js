// Wegfindung zu Fuss: A* auf einem lokalen Gitter (2-m-Zellen), das bei Bedarf aus der
// Kollisionswelt abgeleitet wird. Reine Logik → testbar.

import { MinHeap } from '../world/roads.js';

const CELL = 2;

/**
 * Sucht einen Weg von (sx,sz) nach (tx,tz).
 * @param {import('../world/collision.js').CollisionWorld} col
 * @param {number} y  Höhe der Füsse (für die Hindernisprüfung)
 * @param {object} opts maxNodes (Rechenbudget), margin (Suchbereich um Start/Ziel)
 * @returns {{x:number,z:number}[]|null} Wegpunkte (ohne Start) oder null
 */
export function findGridPath(col, sx, sz, tx, tz, y = 0, { maxNodes = 2500, margin = 30 } = {}) {
  const minX = Math.min(sx, tx) - margin, minZ = Math.min(sz, tz) - margin;
  const maxX = Math.max(sx, tx) + margin, maxZ = Math.max(sz, tz) + margin;
  const w = Math.ceil((maxX - minX) / CELL), h = Math.ceil((maxZ - minZ) / CELL);
  if (w * h > 60000) return null;
  const blockedCache = new Map();
  const blocked = (i, j) => {
    const k = i * 100003 + j;
    let b = blockedCache.get(k);
    if (b === undefined) {
      const x = minX + (i + 0.5) * CELL, z = minZ + (j + 0.5) * CELL;
      b = false;
      const list = col.query(x - 0.7, z - 0.7, x + 0.7, z + 0.7, []);
      for (const o of list) if (o.solid && o.maxY > y + 0.5 && o.minY < y + 1.8) { b = true; break; }
      blockedCache.set(k, b);
    }
    return b;
  };
  const si = Math.floor((sx - minX) / CELL), sj = Math.floor((sz - minZ) / CELL);
  const ti = Math.floor((tx - minX) / CELL), tj = Math.floor((tz - minZ) / CELL);
  const key = (i, j) => i * 100003 + j;
  const open = new MinHeap();
  const g = new Map([[key(si, sj), 0]]);
  const came = new Map();
  const closed = new Set();
  open.push([si, sj], 0);
  let expanded = 0;
  let bestNode = [si, sj], bestH = Infinity;
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (open.size && expanded < maxNodes) {
    const [i, j] = open.pop();
    const k = key(i, j);
    if (closed.has(k)) continue;
    closed.add(k);
    expanded++;
    const hh = Math.hypot(ti - i, tj - j);
    if (hh < bestH) { bestH = hh; bestNode = [i, j]; }
    if (i === ti && j === tj) { bestNode = [i, j]; bestH = 0; break; }
    for (const [di, dj, c] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      if (blocked(ni, nj) && !(ni === ti && nj === tj)) continue;
      if (di && dj && (blocked(i + di, j) || blocked(i, j + dj))) continue; // keine Ecken schneiden
      const nk = key(ni, nj);
      const ng = g.get(k) + c;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, k);
        open.push([ni, nj], ng + Math.hypot(ti - ni, tj - nj));
      }
    }
  }
  if (bestH > 3 && !(bestNode[0] === ti && bestNode[1] === tj)) {
    // Ziel nicht erreicht: Teilweg zum nächstgelegenen Punkt, falls er näher ist
    if (bestH >= Math.hypot(ti - si, tj - sj) - 1) return null;
  }
  const path = [];
  let k = key(bestNode[0], bestNode[1]);
  const startK = key(si, sj);
  while (k !== startK && came.has(k)) {
    const i = Math.floor(k / 100003), j = k - i * 100003;
    path.unshift({ x: minX + (i + 0.5) * CELL, z: minZ + (j + 0.5) * CELL });
    k = came.get(k);
  }
  return smoothPath(col, sx, sz, path, y);
}

/** Entfernt unnötige Zwischenpunkte (Sichtlinie am Boden frei). */
export function smoothPath(col, sx, sz, path, y = 0) {
  if (path.length < 3) return path;
  const out = [];
  let ax = sx, az = sz, i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    for (; j > i; j--) if (clearLine(col, ax, az, path[j].x, path[j].z, y)) break;
    out.push(path[j]);
    ax = path[j].x; az = path[j].z;
    i = j + 1;
  }
  return out;
}

/** Ist die Strecke am Boden frei von soliden Hindernissen? */
export function clearLine(col, ax, az, bx, bz, y = 0) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d / 1.0);
  for (let k = 1; k < n; k++) {
    const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
    const list = col.query(x - 0.35, z - 0.35, x + 0.35, z + 0.35, []);
    for (const o of list) if (o.solid && o.maxY > y + 0.5 && o.minY < y + 1.8) return false;
  }
  return true;
}
