// Low-Poly-Fahrzeugmodelle (alle Typen) aus Boxen/Zylindern, mit Lichtern, Rädern,
// Sirene, Taxischild und Schadensdarstellung.

import * as THREE from 'three';
import { MeshBuilder } from '../world/meshbuilder.js';

const shared = {};
function mat(key, make) { if (!shared[key]) shared[key] = make(); return shared[key]; }
const glassMat = () => mat('glass', () => new THREE.MeshLambertMaterial({ color: 0x1a2533, emissive: 0x0a1018 }));
const darkMat = () => mat('dark', () => new THREE.MeshLambertMaterial({ color: 0x1b1b1d }));
const trimMat = () => mat('trim', () => new THREE.MeshLambertMaterial({ vertexColors: true }));
const chromeMat = () => mat('chrome', () => new THREE.MeshLambertMaterial({ color: 0xb8bcc2 }));
const wheelGeo = (r, w) => { const k = `w${r}_${w}`; if (!shared[k]) { const g = new THREE.CylinderGeometry(r, r, w, 12); g.rotateZ(Math.PI / 2); shared[k] = g; } return shared[k]; };
const rimGeo = (r, w) => { const k = `r${r}_${w}`; if (!shared[k]) { const g = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 8); g.rotateZ(Math.PI / 2); shared[k] = g; } return shared[k]; };

function lightMat(color, intensity = 0.2) {
  return new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: intensity });
}

/**
 * Baut ein Fahrzeugmodell.
 * @param {string} type Fahrzeugtyp (config.vehicles)
 * @param {object} def  Fahrzeugdefinition
 * @param {number} color Lackfarbe
 * @param {number} groundY lokale Bodenhöhe (negativ, unter dem Schwerpunkt)
 */
export function buildVehicleModel(type, def, color, groundY) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const [W, H, L] = def.size;
  const hw = W / 2, hl = L / 2;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const mbBody = new MeshBuilder();   // Lackteile
  const mbGlass = new MeshBuilder();
  const mbDark = new MeshBuilder();
  const y0 = groundY + def.wheelR * 0.75;   // Unterkante Karosserie
  const lights = { head: [], tail: [], ind: [[], []], siren: [], extra: [] };
  const headMat = lightMat(0xfff6d8, 0.3);
  const tailMat = lightMat(0xff1a1a, 0.3);
  const indMat = [lightMat(0xffa000, 0), lightMat(0xffa000, 0)];
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); body.add(mesh); return mesh; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  let cabin = null;
  if (def.bike) {
    // Motorrad
    mbBody.boxRot(0, y0 + 0.45, 0.1, 0.35, 0.35, 1.2, 0, color);
    mbBody.boxRot(0, y0 + 0.7, -0.4, 0.3, 0.12, 0.6, 0, color);
    mbDark.boxRot(0, y0 + 0.35, 0.0, 0.3, 0.3, 0.6, 0, 0x333333);
    mbDark.boxRot(0, y0 + 0.95, 0.75, 0.7, 0.05, 0.05, 0, 0x222222);
    mbDark.boxRot(0, y0 + 0.75, 0.75, 0.06, 0.4, 0.06, 0.4, 0x222222);
    lights.head.push(add(box(0.18, 0.14, 0.05), headMat, 0, y0 + 0.75, 0.86));
    lights.tail.push(add(box(0.16, 0.08, 0.04), tailMat, 0, y0 + 0.72, -0.72));
  } else {
    // Unterbau + Aufbau je Typ
    const isBox = ['truck', 'bus', 'ambulance', 'firetruck', 'swat'].includes(type);
    const lowH = isBox ? H * 0.3 : H * 0.42;
    mbBody.box(-hw, y0, -hl, hw, y0 + lowH, hl, color, { skipTop: false });
    mbDark.box(-hw - 0.02, y0, -hl - 0.03, hw + 0.02, y0 + 0.18, hl + 0.03, 0x222222); // Stossstangen
    const top = y0 + lowH;
    if (type === 'bus') {
      mbBody.box(-hw, top, -hl, hw, groundY + H, hl, color, { skipTop: false });
      mbGlass.box(-hw - 0.02, top + 0.3, -hl + 1.5, hw + 0.02, groundY + H - 0.4, hl - 0.3, 0);
      mbGlass.box(-hw + 0.1, top + 0.2, hl - 0.05, hw - 0.1, groundY + H - 0.3, hl + 0.02, 0);
    } else if (type === 'truck' || type === 'firetruck') {
      const cabL = 2.4;
      mbBody.box(-hw, top, hl - cabL, hw, groundY + H * 0.85, hl, color, { skipTop: false });
      mbGlass.box(-hw + 0.1, top + 0.5, hl - 0.05, hw - 0.1, groundY + H * 0.8, hl + 0.02, 0);
      mbGlass.box(-hw - 0.02, top + 0.5, hl - cabL + 0.3, hw + 0.02, groundY + H * 0.8, hl - 0.4, 0);
      if (type === 'truck') mbBody.box(-hw, top, -hl, hw, groundY + H, hl - cabL - 0.2, 0xdddddd, { skipTop: false });
      else {
        mbBody.box(-hw, top, -hl, hw, top + 1.0, hl - cabL - 0.2, color, { skipTop: false });
        mbDark.boxRot(0, top + 1.3, -0.5, 0.8, 0.25, L * 0.65, 0, 0xcccccc); // Leiter
      }
    } else if (type === 'ambulance' || type === 'swat') {
      const cabL = 1.8;
      mbBody.box(-hw, top, -hl, hw, groundY + H, hl - cabL, color, { skipTop: false });
      mbBody.box(-hw, top, hl - cabL, hw, groundY + H * 0.82, hl, color, { skipTop: false });
      mbGlass.box(-hw + 0.1, top + 0.3, hl - 0.05, hw - 0.1, groundY + H * 0.78, hl + 0.02, 0);
      mbGlass.box(-hw - 0.02, top + 0.3, hl - cabL + 0.2, hw + 0.02, groundY + H * 0.78, hl - 0.3, 0);
      if (type === 'ambulance') {
        mbDark.box(-hw - 0.03, top + 0.6, -hl + 1, hw + 0.03, top + 0.9, hl - cabL - 0.3, 0xd32f2f);
      }
    } else {
      // PKW: Kabine
      const cabFront = type === 'sports' ? 0.1 : 0.35, cabBack = type === 'suv' ? -0.05 : -0.55;
      const cabTop = groundY + H;
      const cz0 = -hl + L * (0.5 + cabBack * 0.5) - L * 0.18, cz1 = hl - L * 0.3 - cabFront;
      cabin = { z0: type === 'suv' ? -0.3 : cz0, z1: cz1, top: cabTop };
      mbBody.box(-hw + 0.08, top, cabin.z0, hw - 0.08, cabTop, cabin.z1, color, { skipTop: false });
      mbGlass.box(-hw + 0.06, top + 0.08, cabin.z0 + 0.15, hw - 0.06, cabTop - 0.08, cabin.z1 - 0.15, 0);
      mbGlass.box(-hw + 0.15, top + 0.06, cabin.z1 - 0.05, hw - 0.15, cabTop - 0.1, cabin.z1 + 0.02, 0);
      mbGlass.box(-hw + 0.15, top + 0.06, cabin.z0 - 0.02, hw - 0.15, cabTop - 0.1, cabin.z0 + 0.05, 0);
      if (type === 'suv') { // Ladefläche
        mbDark.box(-hw + 0.05, top - 0.05, -hl + 0.1, hw - 0.05, top + 0.02, cabin.z0, 0x2a2a2a);
        mbBody.box(-hw, top, -hl, -hw + 0.1, top + 0.45, cabin.z0, color);
        mbBody.box(hw - 0.1, top, -hl, hw, top + 0.45, cabin.z0, color);
        mbBody.box(-hw, top, -hl, hw, top + 0.45, -hl + 0.1, color);
      }
      if (type === 'police') { // Türen schwarz
        mbDark.box(-hw - 0.01, y0 + 0.15, -0.6, hw + 0.01, top - 0.02, 0.9, 0x111111);
      }
      if (type === 'taxi') {
        const sign = add(box(0.7, 0.22, 0.25), lightMat(0xffe066, 0.4), 0, cabTop + 0.12, (cabin.z0 + cabin.z1) / 2);
        lights.extra.push(sign);
      }
    }
    // Scheinwerfer / Rückleuchten
    const hy = y0 + lowH * 0.6;
    for (const s of [-1, 1]) {
      lights.head.push(add(box(0.32, 0.14, 0.05), headMat, s * (hw - 0.3), hy, hl + 0.02));
      lights.tail.push(add(box(0.3, 0.12, 0.05), tailMat, s * (hw - 0.3), hy, -hl - 0.02));
      lights.ind[s < 0 ? 0 : 1].push(add(box(0.12, 0.1, 0.06), indMat[s < 0 ? 0 : 1], s * (hw - 0.08), hy, hl + 0.02));
      lights.ind[s < 0 ? 0 : 1].push(add(box(0.12, 0.1, 0.06), indMat[s < 0 ? 0 : 1], s * (hw - 0.08), hy, -hl - 0.02));
    }
    // Kühlergrill
    mbDark.box(-hw * 0.5, y0 + 0.2, hl, hw * 0.5, y0 + lowH * 0.5, hl + 0.03, 0x151515);
    // Sirene
    if (def.siren) {
      const sTop = (cabin ? cabin.top : groundY + H) + 0.08;
      const sz = cabin ? (cabin.z0 + cabin.z1) / 2 : hl - 1.0;
      lights.siren.push(add(box(0.5, 0.14, 0.25), lightMat(0xff2020, 0.1), -0.28, sTop, sz));
      lights.siren.push(add(box(0.5, 0.14, 0.25), lightMat(0x2050ff, 0.1), 0.28, sTop, sz));
    }
  }
  const meshBody = new THREE.Mesh(mbBody.build(), bodyMat);
  body.add(meshBody);
  if (!mbGlass.empty) body.add(new THREE.Mesh(mbGlass.build(), glassMat()));
  if (!mbDark.empty) body.add(new THREE.Mesh(mbDark.build(), trimMat()));

  // Räder
  const wheels = [];
  const r = def.wheelR;
  const ww = def.bike ? 0.12 : 0.26;
  const positions = def.bike
    ? [[0, def.wheelbase / 2], [0, -def.wheelbase / 2]]
    : [[-def.track / 2, def.wheelbase / 2], [def.track / 2, def.wheelbase / 2], [-def.track / 2, -def.wheelbase / 2], [def.track / 2, -def.wheelbase / 2]];
  for (const [x, z] of positions) {
    const steer = new THREE.Group();
    steer.position.set(x, 0, z);
    const spin = new THREE.Group();
    steer.add(spin);
    spin.add(new THREE.Mesh(wheelGeo(r, ww), darkMat()));
    spin.add(new THREE.Mesh(rimGeo(r, ww), chromeMat()));
    group.add(steer);
    wheels.push({ steer, spin, x, z, front: z > 0 });
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return { group, body, bodyMat, wheels, lights, headMat, tailMat, indMat, baseColor: new THREE.Color(color) };
}

/** Bootsmodell. */
export function buildBoatModel(def, color) {
  const group = new THREE.Group();
  const [W, H, L] = def.size;
  const mb = new MeshBuilder();
  const hw = W / 2, hl = L / 2;
  // Rumpf (spitz zulaufend)
  mb.box(-hw, -0.4, -hl, hw, 0.5, hl - 1.5, color, { skipTop: false, skipBottom: false });
  mb.quad([-hw, 0.5, hl - 1.5], [hw, 0.5, hl - 1.5], [0, 0.6, hl], [0, 0.6, hl], [0, 1, 0], color);
  mb.tri([hw, -0.4, hl - 1.5], [0, 0.0, hl], [hw, 0.5, hl - 1.5], [1, 0, 0.5], color);
  mb.tri([-hw, 0.5, hl - 1.5], [0, 0.0, hl], [-hw, -0.4, hl - 1.5], [-1, 0, 0.5], color);
  mb.box(-hw + 0.1, 0.5, -hl + 0.5, hw - 0.1, 0.7, hl - 2.5, 0xeeeeee);
  mb.box(-0.6, 0.7, -0.5, 0.6, 1.4, 0.3, 0x1a73e8);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const body = new THREE.Mesh(mb.build(), bodyMat);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.06), glassMat());
  glass.position.set(0, 1.3, 0.6);
  glass.rotation.x = -0.4;
  group.add(body, glass);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), darkMat());
  motor.position.set(0, 0.2, -hl - 0.2);
  group.add(motor);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, body: group, bodyMat, wheels: [], lights: { head: [], tail: [], ind: [[], []], siren: [], extra: [] }, baseColor: new THREE.Color(color) };
}
