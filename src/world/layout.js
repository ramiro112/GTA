// Prozeduraler Stadtplan von Port Aurelia (reine Daten, keine Grafik).
// Erzeugt Gebäude, Requisiten, Parkplätze, Wahrzeichen (Läden, Haus, Garage …) und Rampen.
// Die Grafik (city.js) und die Kollision lesen diese Daten.

import { CONFIG } from '../config.js';
import { Random } from '../core/random.js';
import { districtAt, riverCenter, terrainHeight, WATER_Y } from './terrain.js';

const W = CONFIG.world;
const HALF_ROAD = W.roadWidth / 2;
const HALF_HW = W.highwayWidth / 2;
const SW = W.sidewalkWidth;

/**
 * Wahrzeichen / besondere Orte. rect = Grundfläche, door = Seite mit Eingang (n/s/e/w),
 * interior = Art des Innenraums (betretbar) oder null.
 */
export const LANDMARKS = {
  playerHouse:  { name: { de: 'Dein Haus', en: 'Your House' }, x: 64, z: 88, w: 22, d: 18, h: 7, door: 'n', interior: 'house', icon: 'house', color: 0xd8c3a5 },
  playerGarage: { name: { de: 'Deine Garage', en: 'Your Garage' }, x: 96, z: 88, w: 14, d: 18, h: 5.5, door: 'n', doorW: 6, doorH: 4, interior: 'garage', icon: 'garage', color: 0xb0a090 },
  gunshop:      { name: { de: 'Eisenhand Waffen', en: 'Ironhand Arms' }, x: 182, z: -84, w: 22, d: 16, h: 6, door: 's', interior: 'gunshop', icon: 'gun', color: 0x6d6d6d },
  clothes:      { name: { de: 'Fadenwerk Mode', en: 'Threadworks Fashion' }, x: 300, z: -204, w: 22, d: 16, h: 6, door: 's', interior: 'clothes', icon: 'clothes', color: 0xc7a2c9 },
  restaurant:   { name: { de: 'Grillstation Möwe', en: 'Seagull Grill' }, x: 182, z: 204, w: 20, d: 16, h: 5.5, door: 'n', interior: 'restaurant', icon: 'food', color: 0xe0b060 },
  barber:       { name: { de: 'Salon Schnittpunkt', en: 'Crosscut Salon' }, x: -530, z: 84, w: 16, d: 14, h: 5, door: 'n', interior: 'barber', icon: 'barber', color: 0x9fd0e0 },
  tuning:       { name: { de: 'Theos Werkstatt', en: "Theo's Garage" }, x: 330, z: 86, w: 26, d: 20, h: 7, door: 'n', doorW: 8, doorH: 5, interior: 'tuning', icon: 'tuning', color: 0x8a8070 },
  dealer:       { name: { de: 'Autohaus Glanz', en: 'Glanz Motors' }, x: -380, z: -84, w: 30, d: 18, h: 7, door: 's', interior: 'dealer', icon: 'dealer', color: 0xe8eef2 },
  hospital:     { name: { de: 'St.-Aurelia-Klinik', en: 'St. Aurelia Hospital' }, x: -30, z: -245, w: 60, d: 50, h: 28, door: 's', interior: null, icon: 'hospital', color: 0xeeeeee, helipad: true },
  police:       { name: { de: 'Polizeirevier Mitte', en: 'Central Police Station' }, x: 330, z: -365, w: 56, d: 46, h: 16, door: 's', interior: null, icon: 'police', color: 0x8fa3c0, helipad: true },
  bank:         { name: { de: 'Aurelia Zentralbank', en: 'Aurelia Central Bank' }, x: 210, z: -355, w: 40, d: 34, h: 22, door: 's', doorW: 5, doorH: 4.5, interior: 'bank', icon: 'bank', color: 0xd9d0b8 },
  scrapyard:    { name: { de: 'Schrott-Hannes', en: "Scrap Hannes" }, x: 690, z: -120, w: 70, d: 70, h: 0, door: 's', interior: null, icon: 'scrap', color: 0x777766, open: true },
  penthouse:    { name: { de: 'Penthouse Himmelsturm', en: 'Skyspire Penthouse' }, x: 90, z: -360, w: 36, d: 36, h: 140, door: 's', interior: null, icon: 'safehouse', color: 0x8ab4d8, helipad: true, property: 'penthouse' },
  safeBeach:    { name: { de: 'Strandhaus', en: 'Beach House' }, x: 620, z: 540, w: 18, d: 14, h: 6, door: 'n', interior: 'house', icon: 'safehouse', color: 0xf0e0c0, property: 'safehouse_beach' },
  safeHills:    { name: { de: 'Villa Lindenhöhe', en: 'Lindenhöhe Villa' }, x: -620, z: -480, w: 24, d: 18, h: 8, door: 's', interior: 'house', icon: 'safehouse', color: 0xe6e2d3, property: 'safehouse_hills' },
  gas1:         { name: { de: 'Tankstelle Nord', en: 'Gas Station North' }, x: 452, z: -392, w: 30, d: 22, h: 0, door: 'n', interior: null, icon: 'fuel', open: true, fuel: true },
  gas2:         { name: { de: 'Tankstelle Lindenhain', en: 'Lindenhain Gas' }, x: -500, z: -160, w: 30, d: 22, h: 0, door: 's', interior: null, icon: 'fuel', open: true, fuel: true },
  gas3:         { name: { de: 'Tankstelle Altmarkt', en: 'Altmarkt Gas' }, x: 92, z: 392, w: 30, d: 22, h: 0, door: 's', interior: null, icon: 'fuel', open: true, fuel: true },
  parkhaus:     { name: { de: 'Parkhaus Zentrum', en: 'Central Car Park' }, x: 90, z: -120, w: 56, d: 40, h: 12, door: 's', interior: null, icon: null, garageLevels: 3 },
};

/** Respawn-Punkte (vor Krankenhaus bzw. Polizei). */
export const RESPAWN = {
  hospital: { x: -30, z: -195, heading: Math.PI },
  police: { x: 330, z: -315, heading: Math.PI },
  start: { x: 64, z: 70, heading: Math.PI },
};

/** Tür-Position eines Wahrzeichens (Mittelpunkt der Türöffnung, aussen). */
export function doorPosition(lm, outside = 1.5) {
  const hw = lm.w / 2, hd = lm.d / 2;
  switch (lm.door) {
    case 'n': return { x: lm.x, z: lm.z - hd - outside, heading: 0 };
    case 's': return { x: lm.x, z: lm.z + hd + outside, heading: Math.PI };
    case 'e': return { x: lm.x + hw + outside, z: lm.z, heading: -Math.PI / 2 };
    default:  return { x: lm.x - hw - outside, z: lm.z, heading: Math.PI / 2 };
  }
}

/** Banden-Reviere. */
export const GANG_TURFS = [
  { id: 'rust', name: { de: 'Rostschlangen', en: 'Rust Snakes' }, color: 0xd35400, minX: 470, maxX: 840, minZ: -520, maxZ: -20 },
  { id: 'wolves', name: { de: 'Kaiwölfe', en: 'Dock Wolves' }, color: 0x2e86de, minX: 470, maxX: 905, minZ: 20, maxZ: 490 },
];

/** Stunt-Sprünge (Rampe + Zielzone). */
export const STUNT_JUMPS = [
  { id: 'river', x: -150, z: -372, axis: 'x', dir: -1, len: 14, h: 3.2, w: 6 },   // über den Fluss
  { id: 'beach', x: 150, z: 560, axis: 'z', dir: 1, len: 12, h: 2.6, w: 6 },     // am Strand
  { id: 'harbor', x: 820, z: 260, axis: 'x', dir: 1, len: 14, h: 3.0, w: 6 },    // Kai ins Wasser
  { id: 'industry', x: 570, z: -240, axis: 'z', dir: -1, len: 12, h: 3.0, w: 6 }, // über Container
];

/**
 * Frei nutzbare Luftfahrzeuge nahe am Spielstart (Flugschule von Jules):
 * Heliport im Flusspark (~200 m vom Start) und eine Graspiste am Strand (~460 m vom Start).
 */
export const AIRFIELDS = {
  heliport: { name: { de: 'Heliport Flusspark', en: 'River Park Heliport' }, x: -135, z: 120, r: 9 },
  beachStrip: { name: { de: 'Strandpiste', en: 'Beach Airstrip' }, x0: -80, x1: 440, z: 530, w: 18 },
};

/** Liegt (x, z) in einer freizuhaltenden Flugfläche (Piste/Heliport mit Sicherheitsabstand)? */
export function inAirfieldClearance(x, z) {
  const h = AIRFIELDS.heliport, s = AIRFIELDS.beachStrip;
  if (Math.hypot(x - h.x, z - h.z) < h.r + 8) return true;
  return x > s.x0 - 15 && x < s.x1 + 15 && Math.abs(z - s.z) < s.w / 2 + 6;
}

/** Flugplatz-/Militär-Geometrie. */
export const AIRPORT = {
  runway: { x0: -900, x1: -320, z: -770, w: 44 },
  apron: { minX: -760, maxX: -440, minZ: -730, maxZ: -670 },
  helipads: [{ x: -520, z: -700 }, { x: -470, z: -700 }],
  tower: { x: -380, z: -690 },
  terminal: { x: -600, z: -630, w: 120, d: 26, h: 14 },
  hangars: [{ x: -720, z: -700, w: 40, d: 30, h: 14 }, { x: -800, z: -700, w: 40, d: 30, h: 14 }],
};
export const MILITARY = {
  fence: { minX: 380, maxX: 870, minZ: -900, maxZ: -600 },
  gate: { x: 630, z: -600 },
  runway: { x0: 420, x1: 840, z: -840, w: 36 },
  helipads: [{ x: 500, z: -700 }, { x: 560, z: -700 }],
  hangars: [{ x: 760, z: -700, w: 40, d: 30, h: 14 }],
  barracks: [{ x: 470, z: -650, w: 40, d: 16, h: 6 }, { x: 760, z: -640, w: 40, d: 16, h: 6 }],
  guardSpots: [{ x: 615, z: -612 }, { x: 645, z: -612 }, { x: 520, z: -720 }, { x: 760, z: -740 }, { x: 600, z: -800 }, { x: 700, z: -680 }],
};

function rectsOverlap(a, b, pad = 0) {
  return a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad;
}

const lmRect = (lm) => ({ minX: lm.x - lm.w / 2, maxX: lm.x + lm.w / 2, minZ: lm.z - lm.d / 2, maxZ: lm.z + lm.d / 2 });

/** Erzeugt die Stadtdaten. */
export function generateCity(seed = CONFIG.seed) {
  const rng = new Random(seed);
  const R = W.ring;
  const xs = [R.minX, ...W.blockLines.x, R.maxX];
  const zs = [R.minZ, ...W.blockLines.z, R.maxZ];
  const buildings = [];
  const props = [];
  const parking = [];
  const blocks = [];
  const trees = [];
  const gangSpots = [];
  const reserved = Object.values(LANDMARKS).map((lm) => ({ ...lmRect(lm), pad: 3 }));
  // Stunt-Rampen und Kreisverkehr freihalten
  reserved.push({ minX: W.roundabout.x - 30, maxX: W.roundabout.x + 30, minZ: W.roundabout.z - 30, maxZ: W.roundabout.z + 30 });

  const isFree = (r) => !reserved.some((q) => rectsOverlap(r, q, 2));

  const addBuilding = (b) => {
    const r = { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 };
    if (!isFree(r)) return false;
    buildings.push(b);
    reserved.push(r);
    return true;
  };

  // ---------------------------------------------------------------- Blöcke
  for (let i = 1; i < xs.length; i++) {
    for (let j = 1; j < zs.length; j++) {
      const x0 = xs[i - 1], x1 = xs[i], z0 = zs[j - 1], z1 = zs[j];
      const mx0 = x0 + (x0 === R.minX ? HALF_HW : HALF_ROAD), mx1 = x1 - (x1 === R.maxX ? HALF_HW : HALF_ROAD);
      const mz0 = z0 + (z0 === R.minZ ? HALF_HW : HALF_ROAD), mz1 = z1 - (z1 === R.maxZ ? HALF_HW : HALF_ROAD);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const crossesRiver = x0 < W.riverX && x1 > W.riverX;
      const district = crossesRiver ? 'park' : districtAt(cx, cz).id;
      const block = { minX: mx0, maxX: mx1, minZ: mz0, maxZ: mz1, district, river: crossesRiver };
      blocks.push(block);
      // Innenfläche (ohne Gehweg)
      const ix0 = mx0 + SW, ix1 = mx1 - SW, iz0 = mz0 + SW, iz1 = mz1 - SW;
      const inner = { minX: ix0, maxX: ix1, minZ: iz0, maxZ: iz1 };

      // Strassenlaternen, Hydranten, Briefkästen auf dem Gehweg
      sidewalkProps(rng, block, props, district);

      if (crossesRiver) { parkBlock(rng, inner, trees, props, true); continue; }
      switch (district) {
        case 'downtown': downtownBlock(rng, inner, addBuilding, props, trees, cx, cz); break;
        case 'residential': residentialBlock(rng, inner, addBuilding, trees, parking, props); break;
        case 'suburb': suburbBlock(rng, inner, addBuilding, trees, parking, props); break;
        case 'industrial': industrialBlock(rng, inner, addBuilding, props, parking, gangSpots); break;
        case 'harbor': harborBlock(rng, inner, addBuilding, props, gangSpots); break;
        case 'park': parkBlock(rng, inner, trees, props, false); break;
        default: parkBlock(rng, inner, trees, props, false);
      }
    }
  }

  // ---------------------------------------------------------------- Strand
  for (let x = -660; x < 880; x += rng.float(14, 26)) {
    const z = rng.float(520, 580);
    if (terrainHeight(x, z) > WATER_Y + 0.6) props.push({ type: 'palm', x, z, rot: rng.float(0, 6.28), s: rng.float(0.8, 1.3) });
  }
  for (let x = -600; x < 860; x += 140) props.push({ type: 'lifeguard', x: x + rng.float(-20, 20), z: 575, rot: Math.PI });
  for (let x = -640; x < 860; x += rng.float(30, 60)) props.push({ type: 'umbrella', x, z: rng.float(560, 600), rot: 0 });
  // Steg ins Meer
  props.push({ type: 'pier', x: 300, z: 640, w: 10, d: 110, rot: 0 });

  // ---------------------------------------------------------------- Wald und Berge
  for (let n = 0; n < 2600; n++) {
    const x = rng.float(-1000, 900), z = rng.float(-980, 650);
    const d = districtAt(x, z).id;
    if (d !== 'forest' && d !== 'mountains') continue;
    const h = terrainHeight(x, z);
    if (h < WATER_Y + 1 || h > 150) continue;
    // Abstand zur Bergstrasse ungefähr freihalten
    if (x > -130 && x < 140 && z > -880 && z < -560 && Math.abs(serpentineDistance(x, z)) < 12) continue;
    trees.push({ x, z, s: rng.float(0.8, 1.6), kind: h > 90 ? 'pine' : rng.chance(0.6) ? 'pine' : 'leaf' });
  }
  // Felsen
  for (let n = 0; n < 300; n++) {
    const x = rng.float(-1000, 900), z = rng.float(-980, 650);
    const d = districtAt(x, z).id;
    if (d !== 'mountains' && d !== 'forest') continue;
    if (terrainHeight(x, z) < WATER_Y + 1) continue;
    props.push({ type: 'rock', x, z, rot: rng.float(0, 6), s: rng.float(1, 4) });
  }

  // ---------------------------------------------------------------- Banden-Treffpunkte zusätzlich
  gangSpots.push({ x: 560, z: -110, gang: 'rust' }, { x: 700, z: -380, gang: 'rust' }, { x: 610, z: 120, gang: 'wolves' }, { x: 760, z: 360, gang: 'wolves' });

  // Heliport und Strandpiste freihalten (Bäume, Palmen, Schirme, Bänke)
  const clearTrees = trees.filter((t) => !inAirfieldClearance(t.x, t.z));
  const clearProps = props.filter((p) => !inAirfieldClearance(p.x, p.z));
  return { buildings, props: clearProps, parking, blocks, trees: clearTrees, gangSpots, landmarks: LANDMARKS };
}

/** grober Abstand zur Bergstrasse (nur für Baum-Freihaltung). */
function serpentineDistance(x, z) {
  const raw = [[-90, -540], [-95, -600], [-60, -640], [-110, -680], [-40, -720], [-100, -760], [-10, -790], [60, -810], [20, -840], [90, -850], [120, -860]];
  let best = Infinity;
  for (let i = 1; i < raw.length; i++) {
    const [ax, az] = raw[i - 1], [bx, bz] = raw[i];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

function sidewalkProps(rng, b, props, district) {
  const lampEvery = 34;
  const off = SW / 2 + 1.2;
  // Laternen an allen vier Seiten des Blocks, am Bordstein
  const sides = [
    { x0: b.minX, z0: b.minZ + 0.6, x1: b.maxX, z1: b.minZ + 0.6, rot: 0 },
    { x0: b.minX, z0: b.maxZ - 0.6, x1: b.maxX, z1: b.maxZ - 0.6, rot: Math.PI },
    { x0: b.minX + 0.6, z0: b.minZ, x1: b.minX + 0.6, z1: b.maxZ, rot: Math.PI / 2 },
    { x0: b.maxX - 0.6, z0: b.minZ, x1: b.maxX - 0.6, z1: b.maxZ, rot: -Math.PI / 2 },
  ];
  for (const s of sides) {
    const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
    const n = Math.floor(len / lampEvery);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = s.x0 + (s.x1 - s.x0) * t, z = s.z0 + (s.z1 - s.z0) * t;
      if (b.river && Math.abs(x - riverCenter(z)) < 36) continue;
      props.push({ type: 'lamp', x, z, rot: s.rot });
      // dazwischen Kleinkram
      const mx = x + (s.x1 - s.x0) / n / 2, mz = z + (s.z1 - s.z0) / n / 2;
      if (b.river && Math.abs(mx - riverCenter(mz)) < 36) continue;
      const r = rng.next();
      const inward = { x: s.rot === Math.PI / 2 ? off : s.rot === -Math.PI / 2 ? -off : 0, z: s.rot === 0 ? off : s.rot === Math.PI ? -off : 0 };
      if (r < 0.12) props.push({ type: 'hydrant', x: mx, z: mz, rot: s.rot });
      else if (r < 0.2) props.push({ type: 'mailbox', x: mx + inward.x * 0.3, z: mz + inward.z * 0.3, rot: s.rot });
      else if (r < 0.3) props.push({ type: 'trash', x: mx, z: mz, rot: s.rot });
      else if (r < 0.38) props.push({ type: 'bench', x: mx + inward.x * 0.6, z: mz + inward.z * 0.6, rot: s.rot });
      else if (r < 0.46) props.push({ type: 'sign', x: mx, z: mz, rot: s.rot });
      else if (r < 0.62 && (district === 'residential' || district === 'downtown')) props.push({ type: 'streettree', x: mx + inward.x * 0.5, z: mz + inward.z * 0.5, rot: 0 });
    }
  }
}

function downtownBlock(rng, r, addBuilding, props, trees, cx, cz) {
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  const nx = rng.chance(0.5) ? 2 : 3, nz = rng.chance(0.5) ? 2 : 3;
  const centerDist = Math.hypot(cx - 150, cz - 250 + 500);
  const tall = Math.max(0.25, 1 - centerDist / 420);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const lw = w / nx, ld = d / nz;
      const lx = r.minX + lw * (i + 0.5), lz = r.minZ + ld * (j + 0.5);
      if (rng.chance(0.1)) { // kleiner Platz mit Bäumen
        trees.push({ x: lx, z: lz, s: 1.2, kind: 'leaf' });
        props.push({ type: 'bench', x: lx + 4, z: lz, rot: Math.PI / 2 });
        continue;
      }
      const bw = lw - rng.float(2, 7), bd = ld - rng.float(2, 7);
      const h = Math.round(rng.float(18, 40) + rng.float(0, 140) * tall * tall);
      addBuilding({ x: lx, z: lz, w: bw, d: bd, h, kind: 'tower', style: rng.chance(0.65) ? 'office' : 'resi', color: rng.pick([0xb8c4d0, 0x9aa8b8, 0xd0c8b8, 0x8899aa, 0xc0b0a0, 0x707f90, 0xe0dcd4]), roofProps: h > 60, helipad: h > 110 && rng.chance(0.4) });
    }
  }
}

function residentialBlock(rng, r, addBuilding, trees, parking, props) {
  const depth = 14;
  // Gebäudereihe entlang des Nord- und Südrands, Hof in der Mitte
  for (const side of [-1, 1]) {
    let x = r.minX + 1;
    while (x < r.maxX - 10) {
      const len = Math.min(rng.float(16, 30), r.maxX - 1 - x);
      if (len < 10) break;
      const z = side < 0 ? r.minZ + depth / 2 + 0.5 : r.maxZ - depth / 2 - 0.5;
      addBuilding({ x: x + len / 2, z, w: len - 1.5, d: depth, h: rng.pick([9, 12, 15, 18, 21]), kind: 'apartment', style: 'resi', color: rng.pick([0xd8b89a, 0xc9a27e, 0xe3d0b0, 0xb98b6a, 0xd6c6a8, 0xa8b8a0, 0xd0a090]) });
      x += len;
    }
  }
  // Hof: Bäume, Parkplätze
  const cz = (r.minZ + r.maxZ) / 2;
  for (let x = r.minX + 10; x < r.maxX - 8; x += rng.float(10, 16)) {
    if (rng.chance(0.5)) trees.push({ x, z: cz + rng.float(-10, 10), s: rng.float(0.9, 1.3), kind: 'leaf' });
    else parking.push({ x, z: cz + rng.float(-6, 6), heading: rng.chance(0.5) ? 0 : Math.PI });
  }
  props.push({ type: 'bench', x: (r.minX + r.maxX) / 2, z: cz, rot: 0 });
}

function suburbBlock(rng, r, addBuilding, trees, parking, props) {
  const n = 3;
  const lw = (r.maxX - r.minX) / n, ld = (r.maxZ - r.minZ) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === 1 && j === 1) { // Mitte: Garten
        trees.push({ x: r.minX + lw * 1.5, z: r.minZ + ld * 1.5, s: 1.5, kind: 'leaf' });
        continue;
      }
      const x = r.minX + lw * (i + 0.5), z = r.minZ + ld * (j + 0.5);
      const ok = addBuilding({ x, z, w: rng.float(10, 13), d: rng.float(9, 12), h: rng.float(5, 7), kind: 'house', style: 'house', roof: 'gable', color: rng.pick([0xf2e6d0, 0xe8d4b0, 0xd0e0e8, 0xf0d0c0, 0xe0e8d0, 0xfaf0e0]), roofColor: rng.pick([0x8b3a2a, 0x5a4a42, 0x3a4a5a, 0x7a2a2a]) });
      if (!ok) continue;
      // Zaun, Baum, Auto in der Einfahrt
      const fz = j === 0 ? z - ld / 2 + 1 : z + ld / 2 - 1;
      if (j !== 1) props.push({ type: 'fence', x: x - lw / 4, z: fz, rot: 0, len: lw / 2 - 2 });
      if (rng.chance(0.6)) trees.push({ x: x + lw / 2 - 3, z: z + rng.float(-3, 3), s: rng.float(0.8, 1.2), kind: rng.chance(0.5) ? 'leaf' : 'pine' });
      if (rng.chance(0.5)) parking.push({ x: x + lw / 4 + 1, z: j === 0 ? z - ld / 2 + 3.2 : z + ld / 2 - 3.2, heading: j === 0 ? 0 : Math.PI });
    }
  }
}

function industrialBlock(rng, r, addBuilding, props, parking, gangSpots) {
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  addBuilding({ x: r.minX + w * 0.3, z: r.minZ + d * 0.3, w: w * 0.5, d: d * 0.45, h: rng.float(10, 15), kind: 'warehouse', style: 'plain', color: rng.pick([0x8a7a6a, 0x6a7a8a, 0x9a8a70, 0x7a6a5a]) });
  if (rng.chance(0.6)) addBuilding({ x: r.minX + w * 0.75, z: r.minZ + d * 0.72, w: w * 0.38, d: d * 0.4, h: rng.float(8, 12), kind: 'warehouse', style: 'plain', color: rng.pick([0x9a9a9a, 0x8a7a6a, 0xa08060]) });
  // Tanks (explosiv)
  for (let k = 0; k < 3; k++) props.push({ type: 'tank', x: r.minX + w * 0.72 + k * 11 - 11, z: r.minZ + d * 0.22, rot: 0, s: 1 });
  props.push({ type: 'chimney', x: r.minX + w * 0.15, z: r.minZ + d * 0.8, rot: 0 });
  for (let k = 0; k < 4; k++) props.push({ type: 'container', x: r.minX + 6 + k * 3.2, z: r.maxZ - 8, rot: Math.PI / 2, stack: rng.int(1, 2), color: rng.pick([0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad]) });
  for (let k = 0; k < 3; k++) props.push({ type: 'barrel', x: r.minX + w * 0.5 + k * 1.2, z: r.minZ + d * 0.62, rot: 0 });
  parking.push({ x: r.minX + w * 0.32, z: r.maxZ - 18, heading: 0 });
  gangSpots.push({ x: r.minX + w * 0.5, z: r.minZ + d * 0.6, gang: 'rust' });
}

function harborBlock(rng, r, addBuilding, props, gangSpots) {
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  if (rng.chance(0.6)) addBuilding({ x: r.minX + w * 0.3, z: r.minZ + d * 0.35, w: w * 0.45, d: d * 0.5, h: rng.float(9, 13), kind: 'warehouse', style: 'plain', color: rng.pick([0x6a7a8a, 0x5a6a7a, 0x8a8a8a]) });
  // Containerstapel
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 6; k++) {
      if (rng.chance(0.25)) continue;
      props.push({ type: 'container', x: r.minX + w * 0.62 + row * 3.4, z: r.minZ + 8 + k * 7.2, rot: 0, stack: rng.int(1, 3), color: rng.pick([0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x16a085, 0xd35400]) });
    }
  }
  gangSpots.push({ x: r.minX + w * 0.55, z: r.maxZ - 10, gang: 'wolves' });
}

function parkBlock(rng, r, trees, props, river) {
  for (let n = 0; n < 40; n++) {
    const x = rng.float(r.minX + 3, r.maxX - 3), z = rng.float(r.minZ + 3, r.maxZ - 3);
    if (river && Math.abs(x - riverCenter(z)) < W.riverWidth / 2 + 8) continue;
    trees.push({ x, z, s: rng.float(0.8, 1.5), kind: rng.chance(0.7) ? 'leaf' : 'pine' });
  }
  for (let n = 0; n < 4; n++) {
    const x = rng.float(r.minX + 5, r.maxX - 5), z = rng.float(r.minZ + 5, r.maxZ - 5);
    if (river && Math.abs(x - riverCenter(z)) < W.riverWidth / 2 + 6) continue;
    props.push({ type: 'bench', x, z, rot: rng.float(0, 6.28) });
  }
  if (!river && rng.chance(0.4)) props.push({ type: 'fountain', x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, rot: 0 });
}
