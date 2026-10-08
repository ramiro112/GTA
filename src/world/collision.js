// Statische Kollisionswelt: achsparallele Boxen (Gebäude, Wände, Objekte) und Rampen
// in einem Spatial Hash, plus Terrain-Höhenfunktion. Reine Logik → testbar.

import { groundTerrain, terrainHeight } from './terrain.js';

const CELL = 24;

export class CollisionWorld {
  constructor() {
    this.cells = new Map();
    this.stamp = 0;
    this.count = 0;
  }

  _key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  _cellsOf(o) {
    const out = [];
    const x0 = Math.floor(o.minX / CELL), x1 = Math.floor(o.maxX / CELL);
    const z0 = Math.floor(o.minZ / CELL), z1 = Math.floor(o.maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) out.push(this._key(cx, cz));
    return out;
  }

  /**
   * Box hinzufügen. Pflichtfelder: minX,minY,minZ,maxX,maxY,maxZ.
   * Optionale Felder: kind ('building'|'wall'|'prop'|'deck'|…), solid (Standard true),
   * walkable (Oberseite begehbar, Standard true), onHit(), data.
   */
  add(o) {
    if (o.solid === undefined) o.solid = true;
    if (o.walkable === undefined) o.walkable = true;
    o._stamp = 0;
    o._cells = this._cellsOf(o);
    for (const k of o._cells) {
      let c = this.cells.get(k);
      if (!c) { c = []; this.cells.set(k, c); }
      c.push(o);
    }
    this.count++;
    return o;
  }

  /** Rampe: Oberseite steigt linear entlang axis ('x' oder 'z') von y0 auf y1. */
  addRamp(r) {
    r.ramp = true;
    r.solid = false;
    r.walkable = true;
    r.minY = Math.min(r.y0, r.y1) - (r.thickness || 0.5);
    r.maxY = Math.max(r.y0, r.y1);
    return this.add(r);
  }

  remove(o) {
    if (!o._cells) return;
    for (const k of o._cells) {
      const c = this.cells.get(k);
      if (!c) continue;
      const i = c.indexOf(o);
      if (i >= 0) c.splice(i, 1);
    }
    o._cells = null;
    this.count--;
  }

  /** Alle Objekte, deren xz-Fläche das Rechteck berührt. */
  query(minX, minZ, maxX, maxZ, out = []) {
    this.stamp++;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const c = this.cells.get(this._key(cx, cz));
        if (!c) continue;
        for (const o of c) {
          if (o._stamp === this.stamp) continue;
          o._stamp = this.stamp;
          if (o.maxX < minX || o.minX > maxX || o.maxZ < minZ || o.minZ > maxZ) continue;
          out.push(o);
        }
      }
    }
    return out;
  }

  /** Oberkante eines Objekts an (x,z). */
  static topAt(o, x, z) {
    if (!o.ramp) return o.maxY;
    const t = o.axis === 'x' ? (x - o.minX) / (o.maxX - o.minX) : (z - o.minZ) / (o.maxZ - o.minZ);
    return o.y0 + (o.y1 - o.y0) * Math.max(0, Math.min(1, t));
  }

  /**
   * Bodenhöhe unter (x,z), wenn man sich auf Höhe y befindet.
   * Berücksichtigt Terrain, begehbare Boxoberseiten und Rampen bis y + stepUp.
   */
  groundHeight(x, z, y, stepUp = 0.5) {
    let h = groundTerrain(x, z, y);
    let hit = null;
    const list = this.query(x, z, x, z, this._tmp || (this._tmp = []));
    for (const o of list) {
      if (!o.walkable) continue;
      if (x < o.minX || x > o.maxX || z < o.minZ || z > o.maxZ) continue;
      const top = CollisionWorld.topAt(o, x, z);
      if (top <= y + stepUp && top > h) { h = top; hit = o; }
    }
    list.length = 0;
    return { h, hit };
  }

  /**
   * Schiebt einen Kreis (Radius r) aus allen soliden Boxen heraus, deren Höhenbereich
   * [yBottom + stepUp, yTop] überlappt. Liefert {x, z, hit, nx, nz, obj}.
   */
  resolveCircle(x, z, r, yBottom, yTop, stepUp = 0.5) {
    const list = this.query(x - r, z - r, x + r, z + r, this._tmp2 || (this._tmp2 = []));
    let hit = false, nx = 0, nz = 0, obj = null;
    for (let iter = 0; iter < 2; iter++) {
      for (const o of list) {
        if (!o.solid) continue;
        if (o.maxY <= yBottom + stepUp || o.minY >= yTop) continue;
        const cx = Math.max(o.minX, Math.min(x, o.maxX));
        const cz = Math.max(o.minZ, Math.min(z, o.maxZ));
        let dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          dx /= d; dz /= d;
          x = cx + dx * r; z = cz + dz * r;
        } else {
          // Mittelpunkt in der Box: entlang der kürzesten Achse hinausschieben
          const pl = x - o.minX, pr = o.maxX - x, pf = z - o.minZ, pb = o.maxZ - z;
          const m = Math.min(pl, pr, pf, pb);
          if (m === pl) { x = o.minX - r; dx = -1; dz = 0; }
          else if (m === pr) { x = o.maxX + r; dx = 1; dz = 0; }
          else if (m === pf) { z = o.minZ - r; dx = 0; dz = -1; }
          else { z = o.maxZ + r; dx = 0; dz = 1; }
        }
        hit = true; nx = dx; nz = dz; obj = o;
      }
    }
    list.length = 0;
    return { x, z, hit, nx, nz, obj };
  }

  /** Höhe des höchsten soliden Hindernisses direkt vor einem Punkt (zum Klettern). */
  obstacleTop(x, z, r, yBottom, yTop) {
    const list = this.query(x - r, z - r, x + r, z + r, []);
    let top = -Infinity, found = null;
    for (const o of list) {
      if (!o.solid) continue;
      if (o.maxY <= yBottom || o.minY >= yTop) continue;
      const cx = Math.max(o.minX, Math.min(x, o.maxX));
      const cz = Math.max(o.minZ, Math.min(z, o.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r && o.maxY > top) { top = o.maxY; found = o; }
    }
    return found ? { top, obj: found } : null;
  }

  /**
   * Strahltest gegen Boxen (Slab-Methode) und Terrain.
   * dir muss normiert sein. Liefert {t, x, y, z, nx, ny, nz, obj, terrain} oder null.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, { ignore = null, includeTerrain = true, onlySolid = true } = {}) {
    let best = null;
    // Grob: Boxen entlang des Strahls in Abschnitten sammeln
    const steps = Math.ceil(maxDist / CELL);
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t0 = s * CELL, t1 = Math.min(maxDist, (s + 1) * CELL);
      if (best && best.t < t0) break;
      const ax = ox + dx * t0, az = oz + dz * t0, bx = ox + dx * t1, bz = oz + dz * t1;
      const list = this.query(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1, []);
      for (const o of list) {
        if (seen.has(o)) continue;
        seen.add(o);
        if (o === ignore || (onlySolid && !o.solid && !o.ramp)) continue;
        if (o.noRaycast) continue;
        const r = rayBox(ox, oy, oz, dx, dy, dz, o, maxDist);
        if (r && (!best || r.t < best.t)) best = { ...r, obj: o, terrain: false };
      }
    }
    if (includeTerrain) {
      const lim = best ? best.t : maxDist;
      const tt = rayTerrain(ox, oy, oz, dx, dy, dz, lim);
      if (tt !== null && (!best || tt < best.t)) {
        best = { t: tt, x: ox + dx * tt, y: oy + dy * tt, z: oz + dz * tt, nx: 0, ny: 1, nz: 0, obj: null, terrain: true };
      }
    }
    if (best && best.x === undefined) { best.x = ox + dx * best.t; best.y = oy + dy * best.t; best.z = oz + dz * best.t; }
    return best;
  }
}

/** Strahl gegen achsparallele Box. Liefert {t, nx, ny, nz} oder null. */
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxDist) {
  let tmin = 0, tmax = maxDist, nx = 0, ny = 0, nz = 0;
  const axes = [[ox, dx, b.minX, b.maxX, 0], [oy, dy, b.minY, b.maxY, 1], [oz, dz, b.minZ, b.maxZ, 2]];
  for (const [o, d, mn, mx, ax] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d, t2 = (mx - o) / d, s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; nx = ax === 0 ? s : 0; ny = ax === 1 ? s : 0; nz = ax === 2 ? s : 0; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (tmin <= 0) return null; // Start in der Box → ignorieren
  return { t: tmin, nx, ny, nz };
}

/** Strahl gegen Terrain (Marching + Bisektion). */
export function rayTerrain(ox, oy, oz, dx, dy, dz, maxDist) {
  const step = 2.0;
  let prevT = 0;
  let prevAbove = oy - terrainHeight(ox, oz) > 0;
  if (!prevAbove) return null;
  for (let t = step; t <= maxDist + step; t += step) {
    const tc = Math.min(t, maxDist);
    const x = ox + dx * tc, y = oy + dy * tc, z = oz + dz * tc;
    const above = y - groundTerrain(x, z, y) > 0;
    if (!above) {
      let a = prevT, b = tc;
      for (let i = 0; i < 8; i++) {
        const m = (a + b) / 2;
        const my = oy + dy * m;
        if (my - groundTerrain(ox + dx * m, oz + dz * m, my) > 0) a = m; else b = m;
      }
      return (a + b) / 2;
    }
    prevT = tc;
    if (tc >= maxDist) break;
  }
  return null;
}
