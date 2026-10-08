// Besondere Bauwerke: betretbare Gebäude mit Innenräumen, Krankenhaus, Polizei, Bank,
// Tankstellen, Parkhaus (Rampe + Treppe + begehbares Dach), Tunnel, Flughafen, Militärbasis,
// Stunt-Rampen. Liefert Interaktionspunkte (Läden, Speichern, Garage …).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { LANDMARKS, AIRPORT, MILITARY, STUNT_JUMPS, doorPosition } from './layout.js';
import { makeSignTexture } from './textures.js';

const W = CONFIG.world;

export function buildLandmarks(city) {
  const out = { interactables: [], spawnPoints: {}, keepers: [], showroom: [], parkedAircraft: [], parkedVehicles: [], guards: [] };
  const col = city.collision;

  for (const [id, lm] of Object.entries(LANDMARKS)) {
    lm.id = id;
    if (lm.interior) hollowBuilding(city, lm, out);
    else if (lm.fuel) gasStation(city, lm, out);
    else if (id === 'scrapyard') scrapyard(city, lm, out);
    else if (id === 'parkhaus') parkingGarage(city, lm, out);
    else solidLandmark(city, lm, out);
    if (lm.name && lm.h > 0 && id !== 'parkhaus') addSign(city, lm);
  }
  tunnel(city);
  airport(city, out);
  military(city, out);
  for (const j of STUNT_JUMPS) stuntRamp(city, j, out);
  // Aussichtspunkt auf dem Berg
  out.interactables.push({ id: 'viewpoint', type: 'viewpoint', x: 120, z: -860, r: 8 });
  void col;
  return out;
}

// ----------------------------------------------------------------- Hilfen
function wall(city, x0, z0, x1, z1, y0, y1, color, kind = 'wall') {
  if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
  city.mb((x0 + x1) / 2, (z0 + z1) / 2, 'plain').box(x0, y0, z0, x1, y1, z1, color, { skipTop: false });
  city.collision.add({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1, kind });
}

/** Innenwand-Verkleidung (leicht leuchtend, damit Innenräume nicht schwarz sind). */
function innerQuad(city, p0, p1, p2, p3, n, color) {
  city.mb(p0[0], p0[2], 'interior').quad(p0, p1, p2, p3, n, color);
}

function addSign(city, lm) {
  const name = lm.name.de;
  const tex = makeSignTexture(name.toUpperCase(), '#1d2733', '#ffd23f');
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 });
  city.nightMaterials.push(mat);
  const w = Math.min(lm.w * 0.8, 12), h = w / 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const y = Math.min(lm.h - 0.3, 6) - h / 2 + (lm.h > 8 ? 0 : 0.2);
  const yy = Math.max(y, 3.6 + h / 2);
  const off = 0.25;
  switch (lm.door) {
    case 'n': m.position.set(lm.x, yy, lm.z - lm.d / 2 - off); m.rotation.y = Math.PI; break;
    case 's': m.position.set(lm.x, yy, lm.z + lm.d / 2 + off); break;
    case 'e': m.position.set(lm.x + lm.w / 2 + off, yy, lm.z); m.rotation.y = Math.PI / 2; break;
    default: m.position.set(lm.x - lm.w / 2 - off, yy, lm.z); m.rotation.y = -Math.PI / 2;
  }
  m.updateMatrixWorld();
  city._addMesh(m);
}

// ----------------------------------------------------------------- Betretbare Gebäude
function hollowBuilding(city, lm, out) {
  const t = 0.4;
  const x0 = lm.x - lm.w / 2, x1 = lm.x + lm.w / 2, z0 = lm.z - lm.d / 2, z1 = lm.z + lm.d / 2;
  const h = lm.h;
  const dw = lm.doorW || 2.6, dh = lm.doorH || 3.0;
  const c = lm.color;
  const INNER = 0xf0e8dc;
  const sides = {
    n: [x0, z0, x1, z0 + t, 'x'],
    s: [x0, z1 - t, x1, z1, 'x'],
    w: [x0, z0, x0 + t, z1, 'z'],
    e: [x1 - t, z0, x1, z1, 'z'],
  };
  for (const [side, [a0, b0, a1, b1, axis]] of Object.entries(sides)) {
    if (side !== lm.door) { wall(city, a0, b0, a1, b1, 0, h, c); continue; }
    if (axis === 'x') {
      const mid = lm.x;
      wall(city, a0, b0, mid - dw / 2, b1, 0, h, c);
      wall(city, mid + dw / 2, b0, a1, b1, 0, h, c);
      wall(city, mid - dw / 2, b0, mid + dw / 2, b1, dh, h, c);
    } else {
      const mid = lm.z;
      wall(city, a0, b0, a1, mid - dw / 2, 0, h, c);
      wall(city, a0, mid + dw / 2, a1, b1, 0, h, c);
      wall(city, a0, mid - dw / 2, a1, mid + dw / 2, dh, h, c);
    }
  }
  // Dach (begehbar) und Decke innen
  wall(city, x0, z0, x1, z1, h - 0.35, h, 0x5a5a5e, 'roof');
  innerQuad(city, [x0 + t, h - 0.36, z0 + t], [x1 - t, h - 0.36, z0 + t], [x1 - t, h - 0.36, z1 - t], [x0 + t, h - 0.36, z1 - t], [0, -1, 0], 0xfafafa);
  // Boden innen
  const floorC = lm.interior === 'garage' || lm.interior === 'tuning' ? 0x8a8a8a : lm.interior === 'bank' ? 0xd8cfc0 : 0xb08860;
  city.mb(lm.x, lm.z, 'interior').ground(x0 + t, z0 + t, x1 - t, z1 - t, 0.14, floorC);
  city.collision.add({ minX: x0 + t, maxX: x1 - t, minZ: z0 + t, maxZ: z1 - t, minY: -0.3, maxY: 0.14, kind: 'floor', solid: false });
  // Innenwände heller verkleiden
  const yb = 0.15, yt = h - 0.36, e = 0.01;
  innerQuad(city, [x0 + t + e, yb, z1 - t], [x0 + t + e, yb, z0 + t], [x0 + t + e, yt, z0 + t], [x0 + t + e, yt, z1 - t], [1, 0, 0], INNER);
  innerQuad(city, [x1 - t - e, yb, z0 + t], [x1 - t - e, yb, z1 - t], [x1 - t - e, yt, z1 - t], [x1 - t - e, yt, z0 + t], [-1, 0, 0], INNER);
  if (lm.door !== 'n') innerQuad(city, [x0 + t, yb, z0 + t + e], [x1 - t, yb, z0 + t + e], [x1 - t, yt, z0 + t + e], [x0 + t, yt, z0 + t + e], [0, 0, 1], INNER);
  if (lm.door !== 's') innerQuad(city, [x1 - t, yb, z1 - t - e], [x0 + t, yb, z1 - t - e], [x0 + t, yt, z1 - t - e], [x1 - t, yt, z1 - t - e], [0, 0, -1], INNER);
  // Deckenlampe
  city.mb(lm.x, lm.z, 'glow').box(lm.x - 1.5, h - 0.5, lm.z - 0.3, lm.x + 1.5, h - 0.36, lm.z + 0.3, 0xffffee, { skipBottom: false });

  // Inhalt je Typ. "back" = Rückwand (gegenüber der Tür) als Ausrichtung.
  const door = doorPosition(lm, -2.5); // innen hinter der Tür
  const backDir = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] }[lm.door];
  const back = { x: lm.x + backDir[0] * (lm.d / 2 - 2.2) * (backDir[1] !== 0 ? 1 : 0) + backDir[0] * (lm.w / 2 - 2.2) * (backDir[0] !== 0 ? 1 : 0), z: lm.z + backDir[1] * (lm.d / 2 - 2.2) };
  const p = city.mb(lm.x, lm.z, 'plain');
  const counter = (cx, cz, len, color = 0x6b4a2a) => {
    const along = backDir[1] !== 0 ? 'x' : 'z';
    const hx = along === 'x' ? len / 2 : 0.5, hz = along === 'x' ? 0.5 : len / 2;
    p.box(cx - hx, 0.14, cz - hz, cx + hx, 1.1, cz + hz, color, { skipTop: false });
    city.collision.add({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, minY: 0, maxY: 1.1, kind: 'furniture' });
  };
  const keeperPos = { x: back.x + backDir[0] * 0.8, z: back.z + backDir[1] * 0.8, heading: Math.atan2(-backDir[0], -backDir[1]) };
  const custPos = { x: back.x - backDir[0] * 1.6, z: back.z - backDir[1] * 1.6 };
  const inter = (type, pos, extra = {}) => out.interactables.push({ id: lm.id, type, x: pos.x, z: pos.z, r: extra.r || 2.2, lm, ...extra });

  switch (lm.interior) {
    case 'gunshop':
      counter(back.x - backDir[0] * 0.6, back.z - backDir[1] * 0.6, lm.w * 0.6, 0x3a3a3a);
      for (let i = -3; i <= 3; i++) {
        const along = backDir[1] !== 0;
        const wx = along ? lm.x + i * 2 : back.x + backDir[0] * 1.6, wz = along ? back.z + backDir[1] * 1.6 : lm.z + i * 2;
        p.box(wx - 0.6, 1.8, wz - 0.06, wx + 0.6, 2.1, wz + 0.06, 0x222222);
      }
      out.keepers.push({ ...keeperPos, lm: lm.id });
      inter('shop', custPos, { shop: 'gunshop' });
      break;
    case 'clothes':
      counter(back.x - backDir[0] * 0.6, back.z - backDir[1] * 0.6, 4, 0xe0d0e0);
      for (let i = 0; i < 6; i++) {
        const rx = lm.x - lm.w / 2 + 3 + i * (lm.w - 6) / 5, rz = lm.z;
        p.box(rx - 0.8, 0.14, rz - 0.3, rx + 0.8, 1.6, rz + 0.3, [0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad, 0xf39c12, 0x34495e][i]);
        city.collision.add({ minX: rx - 0.8, maxX: rx + 0.8, minZ: rz - 0.3, maxZ: rz + 0.3, minY: 0, maxY: 1.6, kind: 'furniture' });
      }
      out.keepers.push({ ...keeperPos, lm: lm.id });
      inter('shop', custPos, { shop: 'clothes' });
      break;
    case 'restaurant':
      counter(back.x - backDir[0] * 0.6, back.z - backDir[1] * 0.6, lm.w * 0.7, 0xc0392b);
      for (const [ox, oz] of [[-5, -2], [5, -2], [-5, 3], [5, 3]]) {
        p.cylinder(lm.x + ox, 0.14, lm.z + oz, 0.7, 0.85, 10, 0xffffff);
        city.collision.add({ minX: lm.x + ox - 0.7, maxX: lm.x + ox + 0.7, minZ: lm.z + oz - 0.7, maxZ: lm.z + oz + 0.7, minY: 0, maxY: 0.85, kind: 'furniture' });
      }
      out.keepers.push({ ...keeperPos, lm: lm.id });
      inter('shop', custPos, { shop: 'restaurant' });
      break;
    case 'barber':
      for (let i = -1; i <= 1; i++) {
        const along = backDir[1] !== 0;
        const cx = along ? lm.x + i * 3.5 : back.x, cz = along ? back.z : lm.z + i * 3.5;
        p.box(cx - 0.4, 0.14, cz - 0.4, cx + 0.4, 1.0, cz + 0.4, 0x8b0000);
        p.box(cx - 0.6, 1.4, cz + backDir[1] * 0.9 - 0.05, cx + 0.6, 2.4, cz + backDir[1] * 0.9 + 0.05, 0xbfe3f0);
      }
      out.keepers.push({ x: lm.x + 1.5, z: lm.z, heading: 0, lm: lm.id });
      inter('shop', { x: lm.x, z: lm.z }, { shop: 'barber', r: 3 });
      break;
    case 'house': {
      // Bett (Speichern), Sofa, Tisch, TV
      const bx = back.x, bz = back.z;
      p.box(bx - 1.1, 0.14, bz - 1.1, bx + 1.1, 0.7, bz + 1.1, 0x34495e, { skipTop: false });
      p.box(bx - 1.1, 0.7, bz - 1.1, bx + 1.1, 0.8, bz + 1.1, 0xecf0f1);
      city.collision.add({ minX: bx - 1.1, maxX: bx + 1.1, minZ: bz - 1.1, maxZ: bz + 1.1, minY: 0, maxY: 0.8, kind: 'furniture' });
      p.box(lm.x + 3, 0.14, lm.z - 0.6, lm.x + 6, 0.9, lm.z + 0.6, 0x7f8c8d);
      p.box(lm.x - 5, 0.14, lm.z - 0.2, lm.x - 3, 1.5, lm.z + 0.2, 0x111111);
      inter('save', { x: bx - backDir[0] * 2, z: bz - backDir[1] * 2 }, { property: lm.property || 'home', r: 2.6 });
      inter('wardrobe', { x: lm.x - 4, z: lm.z + 1 }, { r: 1.8 });
      break;
    }
    case 'garage':
      p.box(back.x - 3, 0.14, back.z + backDir[1] * 0.2 - 0.3, back.x + 3, 2.2, back.z + backDir[1] * 0.2 + 0.3, 0x7f6a50);
      inter('garage', { x: lm.x, z: lm.z }, { garage: 'player', r: 6 });
      break;
    case 'tuning':
      p.box(back.x - 4, 0.14, back.z - 0.4, back.x + 4, 2.4, back.z + 0.4, 0x555555);
      p.box(lm.x - 3, 0.14, lm.z - 0.2, lm.x - 2.6, 2.6, lm.z + 0.2, 0xd35400);
      p.box(lm.x + 2.6, 0.14, lm.z - 0.2, lm.x + 3, 2.6, lm.z + 0.2, 0xd35400);
      out.keepers.push({ x: back.x + 3, z: back.z - backDir[1] * 1.5, heading: Math.PI, lm: lm.id });
      inter('garage', { x: lm.x, z: lm.z }, { garage: 'tuning', r: 7 });
      break;
    case 'dealer':
      counter(back.x - backDir[0] * 0.6, back.z - backDir[1] * 0.6, 4, 0xffffff);
      out.keepers.push({ ...keeperPos, lm: lm.id });
      inter('shop', custPos, { shop: 'dealer' });
      out.showroom.push({ x: lm.x - 8, z: lm.z + 1, heading: 0.6 }, { x: lm.x + 8, z: lm.z + 1, heading: -0.6 });
      break;
    case 'bank': {
      counter(lm.x, lm.z + 3 * -backDir[1], lm.w * 0.6, 0x7a5a3a);
      // Tresorraum hinten
      const vz = back.z;
      wall(city, lm.x - 8, vz - backDir[1] * 3 - 0.2, lm.x - 1.5, vz - backDir[1] * 3 + 0.2, 0, lm.h - 0.4, 0x777777);
      wall(city, lm.x + 1.5, vz - backDir[1] * 3 - 0.2, lm.x + 8, vz - backDir[1] * 3 + 0.2, 0, lm.h - 0.4, 0x777777);
      p.cylinder(lm.x, 0.14, vz, 0.9, 1.2, 12, 0x999999);
      out.keepers.push({ x: lm.x + 3, z: lm.z + 4 * -backDir[1] + 1.5 * backDir[1], heading: Math.atan2(0, -backDir[1]), lm: lm.id });
      inter('vault', { x: lm.x, z: vz - backDir[1] * 1.5 }, { r: 2.5 });
      break;
    }
    default: break;
  }
  // Tür-Interaktion (für Hinweise / Missionen)
  out.spawnPoints[lm.id] = doorPosition(lm, 3);
  void door;
}

// ----------------------------------------------------------------- Massive Wahrzeichen
function solidLandmark(city, lm, out) {
  const x0 = lm.x - lm.w / 2, x1 = lm.x + lm.w / 2, z0 = lm.z - lm.d / 2, z1 = lm.z + lm.d / 2;
  const style = lm.h > 40 ? 'office' : 'resi';
  city.mb(lm.x, lm.z, style).box(x0, 0, z0, x1, lm.h, z1, lm.color, { uvScale: [12, 12], topColor: 0x55585e });
  city.collision.add({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: 0, maxY: lm.h, kind: 'building' });
  city._roofEdges({ x: lm.x, z: lm.z, w: lm.w, d: lm.d, h: lm.h });
  const p = city.mb(lm.x, lm.z, 'plain');
  p.box(x0, lm.h, z0, x1, lm.h + 1, z0 + 0.4, lm.color);
  p.box(x0, lm.h, z1 - 0.4, x1, lm.h + 1, z1, lm.color);
  p.box(x0, lm.h, z0, x0 + 0.4, lm.h + 1, z1, lm.color);
  p.box(x1 - 0.4, lm.h, z0, x1, lm.h + 1, z1, lm.color);
  if (lm.helipad) city.addHelipad(lm.x, lm.h + 0.02, lm.z, Math.min(lm.w, lm.d) * 0.55);
  if (lm.id === 'hospital') {
    // Rotes Kreuz
    const cz = z1 + 0.05;
    p.box(lm.x - 3, lm.h - 9, cz, lm.x + 3, lm.h - 7, cz + 0.1, 0xd32f2f);
    p.box(lm.x - 1, lm.h - 11, cz, lm.x + 1, lm.h - 5, cz + 0.1, 0xd32f2f);
    out.spawnPoints.hospital = { x: lm.x, z: z1 + 10, heading: Math.PI };
    out.parkedVehicles.push({ type: 'ambulance', x: lm.x + 18, z: z1 + 6, heading: Math.PI / 2 });
    out.interactables.push({ id: 'hospital', type: 'activity', activity: 'ambulance', x: lm.x + 14, z: z1 + 6, r: 4 });
  }
  if (lm.id === 'police') {
    p.box(lm.x - 8, 3.5, z1, lm.x + 8, 4.5, z1 + 0.2, 0x1f4fbf);
    out.spawnPoints.police = { x: lm.x, z: z1 + 10, heading: Math.PI };
    out.parkedVehicles.push({ type: 'police', x: lm.x - 18, z: z1 + 6, heading: Math.PI / 2 }, { type: 'police', x: lm.x - 12, z: z1 + 6, heading: Math.PI / 2 });
  }
  if (lm.property === 'penthouse') {
    // Aufzug: unten an der Tür → aufs Dach und zurück
    const d = doorPosition(lm, 1.5);
    out.interactables.push({ id: 'elevatorUp', type: 'elevator', x: d.x, z: d.z, r: 2, to: { x: lm.x + 6, y: lm.h + 0.1, z: lm.z + 6 } });
    out.interactables.push({ id: 'elevatorDown', type: 'elevator', x: lm.x + 6, z: lm.z + 6, y: lm.h, r: 2, to: { x: d.x, y: 0.2, z: d.z + 1.5 } });
    out.interactables.push({ id: lm.id, type: 'save', x: lm.x - 6, z: lm.z - 6, y: lm.h, r: 2.5, property: 'penthouse', lm });
    city.mb(lm.x, lm.z, 'glow').box(lm.x + 5, lm.h, lm.z + 5, lm.x + 7, lm.h + 2.6, lm.z + 7, 0x9fd8ff);
    city.mb(lm.x, lm.z, 'plain').box(lm.x - 7, lm.h, lm.z - 7, lm.x - 5, lm.h + 0.6, lm.z - 5, 0x34495e);
  }
}

function gasStation(city, lm, out) {
  const p = city.mb(lm.x, lm.z, 'plain');
  const x0 = lm.x - lm.w / 2, x1 = lm.x + lm.w / 2, z0 = lm.z - lm.d / 2, z1 = lm.z + lm.d / 2;
  // Dach auf Säulen
  p.box(x0, 5, z0, x1, 5.6, z1, 0xe74c3c, { skipBottom: false });
  city.mb(lm.x, lm.z, 'glow').box(x0 + 2, 4.95, z0 + 2, x1 - 2, 5.0, z1 - 2, 0xffffff, { skipBottom: false });
  for (const [x, z] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) {
    p.box(x - 0.3, 0, z - 0.3, x + 0.3, 5, z + 0.3, 0xdddddd);
    city.collision.add({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, minY: 0, maxY: 5, kind: 'prop' });
  }
  city.collision.add({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: 5, maxY: 5.6, kind: 'roof' });
  // Zapfsäulen
  for (const dx of [-6, 0, 6]) {
    p.box(lm.x + dx - 0.4, 0.12, lm.z - 0.6, lm.x + dx + 0.4, 1.7, lm.z + 0.6, 0xf0f0f0);
    p.box(lm.x + dx - 0.42, 1.2, lm.z - 0.62, lm.x + dx + 0.42, 1.5, lm.z + 0.62, 0xe74c3c);
    city.collision.add({ minX: lm.x + dx - 0.4, maxX: lm.x + dx + 0.4, minZ: lm.z - 0.6, maxZ: lm.z + 0.6, minY: 0, maxY: 1.7, kind: 'prop', explosive: 1, propType: 'pump' });
    out.interactables.push({ id: lm.id, type: 'fuel', x: lm.x + dx, z: lm.z + 3, r: 3.2, lm });
    out.interactables.push({ id: lm.id, type: 'fuel', x: lm.x + dx, z: lm.z - 3, r: 3.2, lm });
  }
  // Kiosk
  const kz = lm.door === 'n' ? z1 + 4 : z0 - 4;
  p.box(lm.x - 6, 0, kz - 3, lm.x + 6, 3.5, kz + 3, 0xf5f5f5);
  city.collision.add({ minX: lm.x - 6, maxX: lm.x + 6, minZ: kz - 3, maxZ: kz + 3, minY: 0, maxY: 3.5, kind: 'building' });
  const kd = lm.door === 'n' ? kz - 3.8 : kz + 3.8;
  out.interactables.push({ id: lm.id + '_kiosk', type: 'shop', shop: 'kiosk', x: lm.x, z: kd, r: 2.2, lm });
  addSign(city, { ...lm, x: lm.x, z: kz, w: 12, d: 6, h: 3.5, door: lm.door === 'n' ? 'n' : 's' });
}

function scrapyard(city, lm, out) {
  const x0 = lm.x - lm.w / 2, x1 = lm.x + lm.w / 2, z0 = lm.z - lm.d / 2, z1 = lm.z + lm.d / 2;
  const c = 0x7a7a6a;
  wall(city, x0, z0, x1, z0 + 0.3, 0, 3, c);
  wall(city, x0, z0, x0 + 0.3, z1, 0, 3, c);
  wall(city, x1 - 0.3, z0, x1, z1, 0, 3, c);
  wall(city, x0, z1 - 0.3, lm.x - 6, z1, 0, 3, c);
  wall(city, lm.x + 6, z1 - 0.3, x1, z1, 0, 3, c);
  const p = city.mb(lm.x, lm.z, 'plain');
  // Schrottberge
  for (let i = 0; i < 10; i++) {
    const sx = x0 + 6 + (i % 5) * 12, sz = z0 + 6 + Math.floor(i / 5) * 10;
    p.box(sx - 2, 0, sz - 1, sx + 2, 1.4 + (i % 3) * 0.5, sz + 1, [0x6d4c41, 0x546e7a, 0x8d6e63, 0x455a64][i % 4], { skipTop: false });
  }
  // Presse
  p.box(lm.x - 4, 0, lm.z - 3, lm.x + 4, 1, lm.z + 3, 0xf1c40f);
  p.box(lm.x - 4, 4, lm.z - 3, lm.x + 4, 5, lm.z + 3, 0xf1c40f);
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) p.box(lm.x + x - 0.3, 0, lm.z + z - 0.3, lm.x + x + 0.3, 5, lm.z + z + 0.3, 0x333333);
  out.interactables.push({ id: 'scrapyard', type: 'scrap', x: lm.x, z: lm.z, r: 6, lm });
}

function parkingGarage(city, lm, out) {
  // Deck auf 6 m, Rampe entlang der Südseite, Treppe auf der Westseite.
  const x0 = lm.x - lm.w / 2, x1 = lm.x + lm.w / 2, z0 = lm.z - lm.d / 2, z1 = lm.z + lm.d / 2;
  const H = 6, rampW = 8;
  const deckZ1 = z1 - rampW;
  const p = city.mb(lm.x, lm.z, 'plain');
  p.box(x0, H - 0.4, z0, x1, H, deckZ1, 0x9a9a9a, { skipBottom: false });
  city.collision.add({ minX: x0, maxX: x1, minZ: z0, maxZ: deckZ1, minY: H - 0.4, maxY: H, kind: 'deck' });
  // Stützen
  for (let x = x0 + 2; x <= x1 - 2; x += 13) {
    for (let z = z0 + 2; z <= deckZ1 - 2; z += 12) {
      p.box(x - 0.4, 0, z - 0.4, x + 0.4, H - 0.4, z + 0.4, 0x8a8a8a);
      city.collision.add({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, minY: 0, maxY: H - 0.4, kind: 'pillar' });
    }
  }
  // Brüstung (Nord, Ost, West)
  wall(city, x0, z0, x1, z0 + 0.3, H, H + 1.1, 0xbbbbbb);
  wall(city, x0, z0, x0 + 0.3, deckZ1, H, H + 1.1, 0xbbbbbb);
  wall(city, x1 - 0.3, z0, x1, deckZ1 - 10, H, H + 1.1, 0xbbbbbb);
  wall(city, x0 + 12, deckZ1 - 0.3, x1 - 10, deckZ1, H, H + 1.1, 0xbbbbbb);
  // Rampe (von West nach Ost ansteigend)
  const rampVis = city.mb(lm.x, z1, 'road');
  const rz0 = deckZ1, rz1 = z1;
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const xa = x0 + (x1 - x0) * (i / segs), xb = x0 + (x1 - x0) * ((i + 1) / segs);
    const ya = H * (i / segs) + 0.04, yb = H * ((i + 1) / segs) + 0.04;
    rampVis.quad([xa, ya, rz1], [xb, yb, rz1], [xb, yb, rz0], [xa, ya, rz0], [0, 1, 0], 0xffffff);
    p.box(xa, 0, rz1 - 0.3, xb, Math.max(ya, yb) + 1, rz1, 0xbbbbbb);
  }
  city.collision.addRamp({ minX: x0, maxX: x1, minZ: rz0, maxZ: rz1, axis: 'x', y0: 0.12, y1: H, thickness: 0.6 });
  city.collision.add({ minX: x0, maxX: x1, minZ: rz1 - 0.3, maxZ: rz1, minY: 0, maxY: 1.0, kind: 'rail', solid: false });
  // Treppe an der Westseite (Stufen als Rampe + Stufenoptik)
  const sx0 = x0 - 3.2, sx1 = x0, sz0 = z0 + 2, sz1 = z0 + 20;
  for (let i = 0; i < 20; i++) {
    const za = sz1 - (sz1 - sz0) * (i / 20), zb = sz1 - (sz1 - sz0) * ((i + 1) / 20);
    p.box(sx0, 0, zb, sx1, H * ((i + 1) / 20), za, 0xaaaaaa, { skipTop: false });
  }
  city.collision.addRamp({ minX: sx0, maxX: sx1, minZ: sz0, maxZ: sz1, axis: 'z', y0: H, y1: 0.1, thickness: 0.8 });
  wall(city, sx0 - 0.2, sz0, sx0, sz1, 0, H + 1, 0xbbbbbb);
  // Parkplätze unten und oben
  for (let x = x0 + 6; x < x1 - 4; x += 6.5) {
    out.parkedVehicles.push({ type: 'random', x, z: z0 + 6, heading: 0, y: H });
    if (Math.random() < 0.5) out.parkedVehicles.push({ type: 'random', x, z: z0 + 6, heading: 0, y: 0.12 });
  }
}

// ----------------------------------------------------------------- Tunnel
function tunnel(city) {
  const T = W.tunnel;
  const z = T.z, hw = T.halfWidth, H = T.height;
  const c = 0x9a958c;
  // Wände und Decke
  wall(city, T.x0, z - hw - 1, T.x1, z - hw, 0, H, c, 'tunnel');
  wall(city, T.x0, z + hw, T.x1, z + hw + 1, 0, H, c, 'tunnel');
  city.mb((T.x0 + T.x1) / 2, z, 'plain').box(T.x0, H, z - hw - 1, T.x1, H + 1.5, z + hw + 1, 0x77736c, { skipBottom: false });
  city.collision.add({ minX: T.x0, maxX: T.x1, minZ: z - hw - 1, maxZ: z + hw + 1, minY: H, maxY: H + 1.5, kind: 'tunnel', walkable: false });
  // Innenverkleidung (leicht leuchtend) + Lampen
  innerQuad(city, [T.x0, 0.05, z - hw + 0.01], [T.x1, 0.05, z - hw + 0.01], [T.x1, H, z - hw + 0.01], [T.x0, H, z - hw + 0.01], [0, 0, 1], 0xd8d0b8);
  innerQuad(city, [T.x1, 0.05, z + hw - 0.01], [T.x0, 0.05, z + hw - 0.01], [T.x0, H, z + hw - 0.01], [T.x1, H, z + hw - 0.01], [0, 0, -1], 0xd8d0b8);
  innerQuad(city, [T.x0, H - 0.01, z + hw], [T.x1, H - 0.01, z + hw], [T.x1, H - 0.01, z - hw], [T.x0, H - 0.01, z - hw], [0, -1, 0], 0xb0a890);
  for (let x = T.x0 + 5; x < T.x1; x += 10) {
    for (const s of [-1, 1]) city.mb(x, z, 'glow').box(x - 1.5, H - 0.3, z + s * 5 - 0.2, x + 1.5, H - 0.05, z + s * 5 + 0.2, 0xffe2a8, { skipBottom: false });
  }
  // Portale
  for (const px of [T.x0, T.x1]) {
    const dir = px === T.x0 ? -1 : 1;
    const x0 = px + (dir < 0 ? -2 : 0), x1 = px + (dir < 0 ? 0 : 2);
    const p = city.mb(px, z, 'plain');
    p.box(x0, 0, z - 30, x1, 22, z - hw - 1, 0x8a857c, { skipTop: false });
    p.box(x0, 0, z + hw + 1, x1, 22, z + 30, 0x8a857c, { skipTop: false });
    p.box(x0, H, z - hw - 1, x1, 22, z + hw + 1, 0x8a857c, { skipTop: false });
    p.box(x0 - 0.05 * dir, H + 0.5, z - 6, x1 + 0.05 * dir, H + 2, z + 6, 0xf1c40f);
    city.collision.add({ minX: x0, maxX: x1, minZ: z - 30, maxZ: z - hw - 1, minY: 0, maxY: 22, kind: 'tunnel' });
    city.collision.add({ minX: x0, maxX: x1, minZ: z + hw + 1, maxZ: z + 30, minY: 0, maxY: 22, kind: 'tunnel' });
    city.collision.add({ minX: x0, maxX: x1, minZ: z - hw - 1, maxZ: z + hw + 1, minY: H, maxY: 22, kind: 'tunnel' });
  }
}

// ----------------------------------------------------------------- Flughafen
function airport(city, out) {
  const r = AIRPORT.runway;
  const road = city.mb((r.x0 + r.x1) / 2, r.z, 'road');
  road.ground(r.x0, r.z - r.w / 2, r.x1, r.z + r.w / 2, 0.04, 0xbbbbbb, 12);
  const mark = city.mb((r.x0 + r.x1) / 2, r.z, 'mark');
  for (let x = r.x0 + 30; x < r.x1 - 30; x += 30) mark.ground(x, r.z - 0.5, x + 15, r.z + 0.5, 0.07, 0xffffff);
  for (const x of [r.x0 + 5, r.x1 - 25]) for (let s = -r.w / 2 + 3; s < r.w / 2 - 3; s += 3) mark.ground(x, r.z + s, x + 20, r.z + s + 1.5, 0.07, 0xffffff);
  const ap = AIRPORT.apron;
  road.ground(ap.minX, ap.minZ, ap.maxX, ap.maxZ, 0.04, 0xcccccc, 12);
  // Rollweg
  road.ground(-620, ap.maxZ, -600, r.z - r.w / 2, 0.04, 0xbbbbbb, 12);
  road.ground(-480, ap.maxZ, -460, r.z - r.w / 2, 0.04, 0xbbbbbb, 12);
  // Pistenbefeuerung
  for (let x = r.x0; x <= r.x1; x += 20) for (const s of [-1, 1]) city.mb(x, r.z, 'glow').box(x - 0.3, 0, r.z + s * (r.w / 2 + 1) - 0.3, x + 0.3, 0.4, r.z + s * (r.w / 2 + 1) + 0.3, s > 0 ? 0xffffff : 0x9fd8ff);
  // Terminal
  const t = AIRPORT.terminal;
  city.mb(t.x, t.z, 'office').box(t.x - t.w / 2, 0, t.z - t.d / 2, t.x + t.w / 2, t.h, t.z + t.d / 2, 0xc8d8e8, { uvScale: [12, 12], topColor: 0x777777 });
  city.collision.add({ minX: t.x - t.w / 2, maxX: t.x + t.w / 2, minZ: t.z - t.d / 2, maxZ: t.z + t.d / 2, minY: 0, maxY: t.h, kind: 'building' });
  addSign(city, { name: { de: 'Flughafen Aurelia' }, x: t.x, z: t.z, w: 40, d: t.d, h: t.h, door: 'n' });
  // Tower
  const tw = AIRPORT.tower;
  const p = city.mb(tw.x, tw.z, 'plain');
  p.cylinder(tw.x, 0, tw.z, 3, 30, 10, 0xdddddd);
  p.cylinder(tw.x, 30, tw.z, 6, 5, 10, 0x4a6a8a, true, 7);
  p.cylinder(tw.x, 35, tw.z, 7, 1, 10, 0xeeeeee);
  city.collision.add({ minX: tw.x - 3, maxX: tw.x + 3, minZ: tw.z - 3, maxZ: tw.z + 3, minY: 0, maxY: 30, kind: 'building' });
  city.collision.add({ minX: tw.x - 6.5, maxX: tw.x + 6.5, minZ: tw.z - 6.5, maxZ: tw.z + 6.5, minY: 30, maxY: 36, kind: 'building' });
  // Hangars
  for (const h of AIRPORT.hangars) hangar(city, h);
  for (const hp of AIRPORT.helipads) city.addHelipad(hp.x, 0.06, hp.z, 14);
  // Abgestellte Luftfahrzeuge
  out.parkedAircraft.push({ type: 'planeProp', x: -560, z: -700, heading: -Math.PI / 2 });
  out.parkedAircraft.push({ type: 'planeProp', x: -720, z: -690, heading: -Math.PI / 2 });
  out.parkedAircraft.push({ type: 'heliSmall', x: AIRPORT.helipads[0].x, z: AIRPORT.helipads[0].z, heading: 0 });
  out.parkedAircraft.push({ type: 'heliSmall', x: AIRPORT.helipads[1].x, z: AIRPORT.helipads[1].z, heading: 0 });
  out.interactables.push({ id: 'airport', type: 'activity', activity: 'flightschool', x: -600, z: -610, r: 3 });
}

function hangar(city, h) {
  const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2, z0 = h.z - h.d / 2, z1 = h.z + h.d / 2;
  const c = 0xa0a8b0;
  wall(city, x0, z0, x1, z0 + 0.5, 0, h.h, c);
  wall(city, x0, z0, x0 + 0.5, z1, 0, h.h, c);
  wall(city, x1 - 0.5, z0, x1, z1, 0, h.h, c);
  wall(city, x0, z1 - 0.5, x0 + 4, z1, 0, h.h, c);
  wall(city, x1 - 4, z1 - 0.5, x1, z1, 0, h.h, c);
  wall(city, x0, z1 - 0.5, x1, z1, 9, h.h, c);
  wall(city, x0, z0, x1, z1, h.h, h.h + 0.6, 0x7a8088, 'roof');
}

// ----------------------------------------------------------------- Militär
function military(city, out) {
  const f = MILITARY.fence;
  const c = 0x5a6048;
  const fence = (x0, z0, x1, z1) => {
    wall(city, x0, z0, x1, z1, 0, 4, c, 'fence');
  };
  fence(f.minX, f.minZ, f.maxX, f.minZ + 0.3);
  fence(f.minX, f.minZ, f.minX + 0.3, f.maxZ);
  fence(f.maxX - 0.3, f.minZ, f.maxX, f.maxZ);
  fence(f.minX, f.maxZ - 0.3, MILITARY.gate.x - 8, f.maxZ);
  fence(MILITARY.gate.x + 8, f.maxZ - 0.3, f.maxX, f.maxZ);
  // Tor-Häuschen
  const g = MILITARY.gate;
  const p = city.mb(g.x, g.z, 'plain');
  p.box(g.x + 9, 0, g.z - 6, g.x + 13, 3, g.z - 2, 0x6a7058);
  city.collision.add({ minX: g.x + 9, maxX: g.x + 13, minZ: g.z - 6, maxZ: g.z - 2, minY: 0, maxY: 3, kind: 'building' });
  p.box(g.x - 8, 1, g.z - 0.2, g.x + 8, 1.2, g.z + 0.2, 0xe74c3c);
  out.interactables.push({ id: 'militaryGate', type: 'trespass', x: g.x, z: g.z - 20, r: 1, zone: f });
  // Startbahn
  const r = MILITARY.runway;
  const road = city.mb((r.x0 + r.x1) / 2, r.z, 'road');
  road.ground(r.x0, r.z - r.w / 2, r.x1, r.z + r.w / 2, 0.04, 0x999999, 12);
  const mark = city.mb((r.x0 + r.x1) / 2, r.z, 'mark');
  for (let x = r.x0 + 20; x < r.x1 - 20; x += 25) mark.ground(x, r.z - 0.4, x + 12, r.z + 0.4, 0.07, 0xffffff);
  road.ground(r.x0 + 200, -760, r.x0 + 220, r.z - r.w / 2, 0.04, 0x999999, 12);
  for (const h of MILITARY.hangars) hangar(city, h);
  for (const b of MILITARY.barracks) {
    city.mb(b.x, b.z, 'plain').box(b.x - b.w / 2, 0, b.z - b.d / 2, b.x + b.w / 2, b.h, b.z + b.d / 2, 0x6b7356, { topColor: 0x4a4f3a });
    city.collision.add({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, minY: 0, maxY: b.h, kind: 'building' });
  }
  for (const hp of MILITARY.helipads) city.addHelipad(hp.x, 0.06, hp.z, 16);
  // Wachtürme
  for (const [x, z] of [[f.minX + 5, f.minZ + 5], [f.maxX - 5, f.minZ + 5], [f.minX + 5, f.maxZ - 5], [f.maxX - 5, f.maxZ - 5]]) {
    const q = city.mb(x, z, 'plain');
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) q.box(x + dx - 0.15, 0, z + dz - 0.15, x + dx + 0.15, 8, z + dz + 0.15, 0x555a44);
    q.box(x - 2, 8, z - 2, x + 2, 8.3, z + 2, 0x555a44);
    q.box(x - 2, 8.3, z - 2, x + 2, 9.4, z - 1.8, 0x555a44);
    q.box(x - 2.2, 11, z - 2.2, x + 2.2, 11.3, z + 2.2, 0x444a36);
    city.collision.add({ minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2, minY: 8, maxY: 8.3, kind: 'deck' });
  }
  out.parkedAircraft.push({ type: 'heliMil', x: MILITARY.helipads[0].x, z: MILITARY.helipads[0].z, heading: 0 });
  out.parkedAircraft.push({ type: 'heliMil', x: MILITARY.helipads[1].x, z: MILITARY.helipads[1].z, heading: 0 });
  out.parkedAircraft.push({ type: 'jet', x: 500, z: -810, heading: -Math.PI / 2 });
  out.parkedAircraft.push({ type: 'jet', x: 560, z: -810, heading: -Math.PI / 2 });
  out.parkedVehicles.push({ type: 'military', x: 600, z: -660, heading: 0 }, { type: 'military', x: 680, z: -660, heading: 0 });
  for (const s of MILITARY.guardSpots) out.guards.push({ ...s, kind: 'soldier' });
}

// ----------------------------------------------------------------- Stunt-Rampen
function stuntRamp(city, j, out) {
  const p = city.mb(j.x, j.z, 'plain');
  const hw = j.w / 2;
  let minX, maxX, minZ, maxZ, y0, y1;
  if (j.axis === 'x') {
    minZ = j.z - hw; maxZ = j.z + hw;
    if (j.dir > 0) { minX = j.x; maxX = j.x + j.len; y0 = 0.1; y1 = j.h; } else { minX = j.x - j.len; maxX = j.x; y0 = j.h; y1 = 0.1; }
  } else {
    minX = j.x - hw; maxX = j.x + hw;
    if (j.dir > 0) { minZ = j.z; maxZ = j.z + j.len; y0 = 0.1; y1 = j.h; } else { minZ = j.z - j.len; maxZ = j.z; y0 = j.h; y1 = 0.1; }
  }
  const base = Math.max(0, Math.min(terrainAt(j.x, j.z), 0.5));
  // Oberfläche als schräges Viereck + Seitenwände
  const Y = (x, z) => {
    const t = j.axis === 'x' ? (x - minX) / (maxX - minX) : (z - minZ) / (maxZ - minZ);
    return base + y0 + (y1 - y0) * t;
  };
  const q = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  p.quad([q[3][0], Y(q[3][0], q[3][1]), q[3][1]], [q[2][0], Y(q[2][0], q[2][1]), q[2][1]], [q[1][0], Y(q[1][0], q[1][1]), q[1][1]], [q[0][0], Y(q[0][0], q[0][1]), q[0][1]], [0, 1, 0], 0xf39c12);
  const hi = Math.max(y0, y1) + base;
  if (j.axis === 'x') {
    const hx = j.dir > 0 ? maxX : minX;
    p.box(hx - 0.2, 0, minZ, hx + 0.2, hi, maxZ, 0x7f8c8d);
  } else {
    const hz = j.dir > 0 ? maxZ : minZ;
    p.box(minX, 0, hz - 0.2, maxX, hi, hz + 0.2, 0x7f8c8d);
  }
  city.collision.addRamp({ minX, maxX, minZ, maxZ, axis: j.axis, y0: base + y0, y1: base + y1, thickness: hi });
  out.interactables.push({ id: 'stunt_' + j.id, type: 'stunt', x: j.axis === 'x' ? (j.dir > 0 ? maxX : minX) : j.x, z: j.axis === 'z' ? (j.dir > 0 ? maxZ : minZ) : j.z, r: 4, jump: j });
}

function terrainAt() { return 0.12; }
