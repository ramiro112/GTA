// Requisiten-Bausätze: Geometrie (Low-Poly, Vertex-Farben), Kollisionsmasse und Eigenschaften.
// size = Referenzmass [Breite, Höhe, Tiefe] (für skalierbare Zäune), collider = Kollisionsbox.

import * as THREE from 'three';
import { MeshBuilder } from './meshbuilder.js';

export const PROP_KITS = {
  lamp:     { collider: [0.35, 7, 0.35], destructible: true, castShadow: true },
  hydrant:  { collider: [0.5, 0.8, 0.5], destructible: true },
  mailbox:  { collider: [0.6, 1.2, 0.5], destructible: true, optional: true },
  trash:    { collider: [0.6, 1.0, 0.6], destructible: true, optional: true },
  bench:    { collider: [1.9, 0.9, 0.7], destructible: true, optional: true },
  sign:     { collider: [0.3, 2.6, 0.3], destructible: true, optional: true },
  fence:    { collider: [1, 1.1, 0.15], destructible: true, size: [1, 1.1, 0.15] },
  tree:     { collider: [0.6, 6, 0.6], castShadow: true },
  pine:     { collider: [0.6, 8, 0.6], castShadow: true },
  palm:     { collider: [0.5, 7, 0.5], castShadow: true },
  container:{ collider: [2.5, 2.6, 6.1], tintable: true, walkable: true, castShadow: true, onGround: false },
  tank:     { collider: [9, 8, 9], explosive: 1, walkable: true, castShadow: true },
  barrel:   { collider: [0.7, 1.0, 0.7], explosive: 0.5, destructible: true },
  chimney:  { collider: [4, 36, 4], castShadow: true },
  rock:     { collider: [1.6, 1.2, 1.6], walkable: true, onGround: true },
  lifeguard:{ collider: [3, 4.5, 3], walkable: true, castShadow: true },
  umbrella: { collider: [0.3, 2.4, 0.3], destructible: true, optional: true },
  fountain: { collider: [6, 1.0, 6], walkable: true },
  trafficlight: {},
};

const cache = new Map();
const plainMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });

export function buildPropKit(type) {
  if (cache.has(type)) return cache.get(type);
  const meta = PROP_KITS[type] || {};
  const mb = new MeshBuilder();
  const parts = [];
  let glowMb = null;
  switch (type) {
    case 'lamp': {
      mb.cylinder(0, 0, 0, 0.12, 7, 6, 0x4a4f55);
      mb.box(-0.06, 6.8, 0, 0.06, 6.95, 1.9, 0x4a4f55);
      glowMb = new MeshBuilder();
      glowMb.box(-0.3, 6.6, 1.5, 0.3, 6.8, 2.1, 0xfff0c0, { skipBottom: false });
      break;
    }
    case 'hydrant':
      mb.cylinder(0, 0, 0, 0.18, 0.7, 8, 0xc0392b); mb.cylinder(0, 0.7, 0, 0.12, 0.15, 8, 0xa93226);
      mb.box(-0.3, 0.4, -0.06, 0.3, 0.5, 0.06, 0xa93226);
      break;
    case 'mailbox':
      mb.box(-0.25, 0, -0.2, 0.25, 1.1, 0.2, 0xf1c40f); mb.box(-0.27, 0.95, -0.22, 0.27, 1.15, 0.22, 0x2c3e50);
      break;
    case 'trash':
      mb.cylinder(0, 0, 0, 0.28, 0.95, 8, 0x2e5e3e);
      break;
    case 'bench':
      mb.box(-0.9, 0.42, -0.25, 0.9, 0.5, 0.25, 0x8b5a2b); mb.box(-0.9, 0.5, 0.2, 0.9, 0.9, 0.27, 0x8b5a2b);
      for (const x of [-0.8, 0.8]) mb.box(x - 0.05, 0, -0.22, x + 0.05, 0.42, 0.22, 0x333333);
      break;
    case 'sign':
      mb.cylinder(0, 0, 0, 0.05, 2.5, 5, 0x9aa0a6);
      mb.box(-0.4, 1.9, 0.06, 0.4, 2.6, 0.1, 0x1f5fbf);
      mb.box(-0.32, 2.15, 0.1, 0.32, 2.35, 0.11, 0xffffff);
      break;
    case 'fence':
      mb.box(-0.5, 0.15, -0.04, 0.5, 0.3, 0.04, 0xf4f4f4); mb.box(-0.5, 0.75, -0.04, 0.5, 0.9, 0.04, 0xf4f4f4);
      for (let x = -0.45; x <= 0.45; x += 0.15) mb.box(x - 0.03, 0, -0.03, x + 0.03, 1.1, 0.03, 0xf4f4f4);
      break;
    case 'tree':
      mb.cylinder(0, 0, 0, 0.25, 2.6, 6, 0x6b4a2a);
      mb.cylinder(0, 2.2, 0, 1.6, 1.4, 7, 0x3f7f3a, true, 2.3);
      mb.cylinder(0, 3.6, 0, 2.3, 1.4, 7, 0x4a8f42, true, 1.6);
      mb.cone(0, 5.0, 0, 1.6, 1.6, 7, 0x55a04a);
      break;
    case 'pine':
      mb.cylinder(0, 0, 0, 0.22, 2, 5, 0x5a3a20);
      mb.cone(0, 1.5, 0, 2.2, 3.2, 7, 0x2f5e34);
      mb.cone(0, 3.2, 0, 1.7, 2.8, 7, 0x356a3a);
      mb.cone(0, 4.8, 0, 1.2, 2.6, 7, 0x3c7640);
      break;
    case 'palm': {
      for (let i = 0; i < 7; i++) mb.cylinder(i * 0.12, i * 1.0, 0, 0.22 - i * 0.015, 1.05, 6, 0x8b6b45);
      const top = [0.84, 7, 0];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        mb.boxRot(top[0] + Math.cos(a) * 1.4, top[1] - 0.4, top[2] + Math.sin(a) * 1.4, 3.0, 0.08, 0.7, -a, 0x3e8e41);
      }
      break;
    }
    case 'container':
      mb.box(-1.25, 0, -3.05, 1.25, 2.6, 3.05, 0xffffff, { skipTop: false });
      for (let z = -2.8; z <= 2.8; z += 0.4) { mb.box(1.25, 0.1, z, 1.3, 2.5, z + 0.2, 0xdddddd); mb.box(-1.3, 0.1, z, -1.25, 2.5, z + 0.2, 0xdddddd); }
      break;
    case 'tank':
      mb.cylinder(0, 0, 0, 4.5, 8, 16, 0xe8e8e8);
      mb.cylinder(0, 8, 0, 4.5, 0.6, 16, 0xcccccc, true, 3.5);
      mb.box(-4.6, 2.5, -0.3, -4.4, 8, 0.3, 0x999999);
      mb.box(-0.5, 3, -4.55, 0.5, 5, -4.45, 0xd35400);
      break;
    case 'barrel':
      mb.cylinder(0, 0, 0, 0.33, 1.0, 10, 0xc0392b); mb.cylinder(0, 0.45, 0, 0.34, 0.08, 10, 0x922b21);
      break;
    case 'chimney':
      mb.cylinder(0, 0, 0, 2, 36, 10, 0x8b4a3a, true, 1.4);
      mb.cylinder(0, 30, 0, 1.45, 1.2, 10, 0xeeeeee, false, 1.43);
      break;
    case 'rock': {
      const g = new THREE.DodecahedronGeometry(1, 0);
      g.scale(1, 0.7, 1);
      const col = new Float32Array(g.attributes.position.count * 3);
      const c = new THREE.Color(0x7d7a73);
      for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push({ geometry: g, material: plainMat() });
      break;
    }
    case 'lifeguard':
      for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) mb.box(x - 0.1, 0, z - 0.1, x + 0.1, 2.5, z + 0.1, 0xffffff);
      mb.box(-1.5, 2.5, -1.5, 1.5, 2.7, 1.5, 0xd8d8d8);
      mb.box(-1.3, 2.7, -1.3, 1.3, 4.3, 1.3, 0xe74c3c);
      mb.box(-1.5, 4.3, -1.5, 1.5, 4.5, 1.5, 0xffffff);
      break;
    case 'umbrella':
      mb.cylinder(0, 0, 0, 0.04, 2.3, 4, 0xdddddd);
      mb.cone(0, 1.9, 0, 1.6, 0.6, 8, 0xff6f61);
      break;
    case 'fountain':
      mb.cylinder(0, 0, 0, 3, 0.8, 16, 0xb0aaa0);
      mb.cylinder(0, 0.6, 0, 2.7, 0.15, 16, 0x4aa3df);
      mb.cylinder(0, 0.8, 0, 0.4, 1.6, 8, 0xb0aaa0);
      mb.cylinder(0, 2.4, 0, 1.0, 0.3, 10, 0xb0aaa0);
      break;
    case 'trafficlight':
      mb.cylinder(0, 0, 0, 0.1, 3.2, 6, 0x333333);
      mb.box(-0.25, 3.15, -0.15, 0.25, 4.3, 0.15, 0x222222, { skipBottom: false });
      break;
    default:
      mb.box(-0.5, 0, -0.5, 0.5, 1, 0.5, 0xff00ff);
  }
  if (!mb.empty) parts.unshift({ geometry: mb.build(), material: plainMat() });
  if (glowMb) {
    parts.push({ geometry: glowMb.build(), material: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffe0a0, emissiveIntensity: 0.15 }), glow: true });
  }
  const kit = { ...meta, size: meta.size || [1, 1, 1], parts };
  cache.set(type, kit);
  return kit;
}

/** Einzelnes Mesh eines Requisits (für Trümmer). */
export function propMesh(type) {
  const kit = buildPropKit(type);
  const g = new THREE.Group();
  for (const p of kit.parts) g.add(new THREE.Mesh(p.geometry, p.material));
  return g;
}
