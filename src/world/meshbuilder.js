// MeshBuilder: sammelt viele einfache Formen (Boxen, Quader, Zylinder, Dachgiebel) in EINER
// BufferGeometry mit Vertex-Farben. So bleibt die Zahl der Draw Calls klein (Performance).

import * as THREE from 'three';

const _c = new THREE.Color();

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  get vertexCount() { return this.pos.length / 3; }
  get empty() { return this.idx.length === 0; }

  _color(hex) {
    if (typeof hex === 'number') _c.setHex(hex);
    else _c.copy(hex);
    return _c;
  }

  /** Viereck aus 4 Punkten (gegen den Uhrzeigersinn von der Normalen aus gesehen). */
  quad(p0, p1, p2, p3, n, color, uvs = null) {
    const base = this.vertexCount;
    const c = this._color(color);
    for (const p of [p0, p1, p2, p3]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(c.r, c.g, c.b);
    }
    const u = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const t of u) this.uv.push(t[0], t[1]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Achsparallele Box. opts.uvScale = Meter pro Texturkachel [u, v] für Seitenflächen
   * (Fensterraster), opts.roofUV = feste UV für Ober-/Unterseite, opts.skipBottom.
   */
  box(minX, minY, minZ, maxX, maxY, maxZ, color, opts = {}) {
    const { uvScale = null, roofUV = [0.01, 0.01], skipBottom = true, skipTop = false, topColor = null, uvOffset = 0 } = opts;
    const sideUV = (w, h) => (uvScale
      ? [[uvOffset, 0], [uvOffset + w / uvScale[0], 0], [uvOffset + w / uvScale[0], h / uvScale[1]], [uvOffset, h / uvScale[1]]]
      : null);
    const ru = [roofUV, roofUV, roofUV, roofUV];
    const w = maxX - minX, h = maxY - minY, d = maxZ - minZ;
    // +Z (Süd)
    this.quad([minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ], [0, 0, 1], color, sideUV(w, h));
    // -Z (Nord)
    this.quad([maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ], [0, 0, -1], color, sideUV(w, h));
    // +X (Ost)
    this.quad([maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [1, 0, 0], color, sideUV(d, h));
    // -X (West)
    this.quad([minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ], [-1, 0, 0], color, sideUV(d, h));
    if (!skipTop) this.quad([minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, minZ], [0, 1, 0], topColor ?? color, uvScale ? ru : null);
    if (!skipBottom) this.quad([minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ], [0, -1, 0], color, uvScale ? ru : null);
  }

  /** Box um Mittelpunkt mit Drehung um Y. */
  boxRot(cx, cy, cz, w, h, d, rotY, color, skipBottom = true) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const N = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
    const hw = w / 2, hh = h / 2, hd = d / 2;
    this.quad(P(-hw, -hh, hd), P(hw, -hh, hd), P(hw, hh, hd), P(-hw, hh, hd), N(0, 0, 1), color);
    this.quad(P(hw, -hh, -hd), P(-hw, -hh, -hd), P(-hw, hh, -hd), P(hw, hh, -hd), N(0, 0, -1), color);
    this.quad(P(hw, -hh, hd), P(hw, -hh, -hd), P(hw, hh, -hd), P(hw, hh, hd), N(1, 0, 0), color);
    this.quad(P(-hw, -hh, -hd), P(-hw, -hh, hd), P(-hw, hh, hd), P(-hw, hh, -hd), N(-1, 0, 0), color);
    this.quad(P(-hw, hh, hd), P(hw, hh, hd), P(hw, hh, -hd), P(-hw, hh, -hd), N(0, 1, 0), color);
    if (!skipBottom) this.quad(P(-hw, -hh, -hd), P(hw, -hh, -hd), P(hw, -hh, hd), P(-hw, -hh, hd), N(0, -1, 0), color);
  }

  /** Satteldach (Prisma) über einem Rechteck, First entlang der längeren Seite. */
  gable(minX, minZ, maxX, maxZ, y, height, color) {
    const w = maxX - minX, d = maxZ - minZ;
    const along = w >= d ? 'x' : 'z';
    if (along === 'x') {
      const mz = (minZ + maxZ) / 2, top = y + height;
      const ny = d / 2, nz = height;
      const l = Math.hypot(ny, nz);
      this.quad([minX, y, maxZ], [maxX, y, maxZ], [maxX, top, mz], [minX, top, mz], [0, ny / l, nz / l], color);
      this.quad([maxX, y, minZ], [minX, y, minZ], [minX, top, mz], [maxX, top, mz], [0, ny / l, -nz / l], color);
      this.tri([maxX, y, maxZ], [maxX, y, minZ], [maxX, top, mz], [1, 0, 0], color);
      this.tri([minX, y, minZ], [minX, y, maxZ], [minX, top, mz], [-1, 0, 0], color);
    } else {
      const mx = (minX + maxX) / 2, top = y + height;
      const ny = w / 2, nx = height;
      const l = Math.hypot(ny, nx);
      this.quad([maxX, y, maxZ], [maxX, y, minZ], [mx, top, minZ], [mx, top, maxZ], [nx / l, ny / l, 0], color);
      this.quad([minX, y, minZ], [minX, y, maxZ], [mx, top, maxZ], [mx, top, minZ], [-nx / l, ny / l, 0], color);
      this.tri([minX, y, maxZ], [maxX, y, maxZ], [mx, top, maxZ], [0, 0, 1], color);
      this.tri([maxX, y, minZ], [minX, y, minZ], [mx, top, minZ], [0, 0, -1], color);
    }
  }

  tri(p0, p1, p2, n, color) {
    const base = this.vertexCount;
    const c = this._color(color);
    for (const p of [p0, p1, p2]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(c.r, c.g, c.b);
      this.uv.push(0.01, 0.01);
    }
    this.idx.push(base, base + 1, base + 2);
  }

  /** Zylinder (stehend). */
  cylinder(cx, cy, cz, r, h, seg, color, capTop = true, rTop = r) {
    const c = this._color(color).clone();
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const x0 = Math.cos(a0), z0 = Math.sin(a0), x1 = Math.cos(a1), z1 = Math.sin(a1);
      const am = (a0 + a1) / 2;
      this.quad([cx + x1 * r, cy, cz + z1 * r], [cx + x0 * r, cy, cz + z0 * r], [cx + x0 * rTop, cy + h, cz + z0 * rTop], [cx + x1 * rTop, cy + h, cz + z1 * rTop], [Math.cos(am), 0, Math.sin(am)], c);
      if (capTop && rTop > 0) this.tri([cx, cy + h, cz], [cx + x1 * rTop, cy + h, cz + z1 * rTop], [cx + x0 * rTop, cy + h, cz + z0 * rTop], [0, 1, 0], c);
    }
  }

  /** Kegel (z. B. Nadelbaum). */
  cone(cx, cy, cz, r, h, seg, color) {
    const c = this._color(color).clone();
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const ny = r / Math.hypot(r, h);
      this.tri([cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r], [cx, cy + h, cz], [Math.cos(am), ny, Math.sin(am)], c);
    }
  }

  /** Flaches Rechteck (Boden) mit optionalen Welt-UVs. */
  ground(minX, minZ, maxX, maxZ, y, color, uvScale = 0) {
    const uv = uvScale ? [[minX / uvScale, maxZ / uvScale], [maxX / uvScale, maxZ / uvScale], [maxX / uvScale, minZ / uvScale], [minX / uvScale, minZ / uvScale]] : null;
    this.quad([minX, y, maxZ], [maxX, y, maxZ], [maxX, y, minZ], [minX, y, minZ], [0, 1, 0], color, uv);
  }

  /** Band entlang einer Polylinie (Strasse). heightFn(x,z) liefert die Höhe. */
  ribbon(points, width, heightFn, color, uvScale = 8, lift = 0.03) {
    const hw = width / 2;
    let along = 0;
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1], q = points[i];
      const dx = q.x - p.x, dz = q.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      const rx = -dz / l * hw, rz = dx / l * hw;
      const yp = heightFn(p.x, p.z) + lift, yq = heightFn(q.x, q.z) + lift;
      const u0 = along / uvScale, u1 = (along + l) / uvScale;
      this.quad([p.x - rx, yp, p.z - rz], [p.x + rx, yp, p.z + rz], [q.x + rx, yq, q.z + rz], [q.x - rx, yq, q.z - rz], [0, 1, 0], color,
        [[0, u0], [1, u0], [1, u1], [0, u1]]);
      along += l;
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const n = this.vertexCount;
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
