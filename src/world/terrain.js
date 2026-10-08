// Terrain als analytische Höhenfunktion (keine Abhängigkeit zu Three.js → in Node testbar).
// Die Stadt ist flach (y = 0). Berge im Westen und Norden, Fluss, Küsten fallen zum Meer ab.

import { CONFIG } from '../config.js';
import { fbm } from '../core/random.js';
import { smoothstep, clamp } from '../core/mathutil.js';

const W = CONFIG.world;
export const WATER_Y = W.waterY;

/** Rechteckige Zonen, die garantiert flach sind (Stadt, Flughafen, Militär). */
export const FLAT_ZONES = [
  { name: 'city', minX: -700, maxX: 905, minZ: -560, maxZ: 525, margin: 30 },
  { name: 'airport', minX: -940, maxX: -265, minZ: -925, maxZ: -590, margin: 40 },
  { name: 'military', minX: 355, maxX: 885, minZ: -925, maxZ: -575, margin: 40 },
];

/** Gebiete (für Karte, Spawn-Dichte, Banden-Reviere). Reihenfolge = Priorität. */
export const DISTRICTS = [
  { id: 'airport', name: { de: 'Flughafen Aurelia', en: 'Aurelia Airport' }, minX: -940, maxX: -265, minZ: -925, maxZ: -590, color: '#8a8f99' },
  { id: 'military', name: { de: 'Militärbasis Fort Kessel', en: 'Fort Kessel Military Base' }, minX: 355, maxX: 885, minZ: -925, maxZ: -575, color: '#56603f' },
  { id: 'mountains', name: { de: 'Graufels-Berge', en: 'Greyrock Mountains' }, minX: -270, maxX: 350, minZ: -960, maxZ: -560, color: '#5e7146' },
  { id: 'beach', name: { de: 'Sonnenstrand', en: 'Sunshore Beach' }, minX: -700, maxX: 905, minZ: 511, maxZ: 700, color: '#e8d39a' },
  { id: 'forest', name: { de: 'Westwald', en: 'Westwood' }, minX: -1000, maxX: -690, minZ: -560, maxZ: 700, color: '#3f6b35' },
  { id: 'suburb', name: { de: 'Lindenhain (Vorort)', en: 'Lindenhain (Suburbs)' }, minX: -690, maxX: -245, minZ: -560, maxZ: 511, color: '#9bb36d' },
  { id: 'park', name: { de: 'Flusspark', en: 'River Park' }, minX: -245, maxX: -100, minZ: -560, maxZ: 511, color: '#4f9a4a' },
  { id: 'downtown', name: { de: 'Innenstadt', en: 'Downtown' }, minX: -100, maxX: 450, minZ: -560, maxZ: 0, color: '#7d7f8c' },
  { id: 'industrial', name: { de: 'Industriegebiet Rostfeld', en: 'Rustfield Industrial' }, minX: 450, maxX: 905, minZ: -560, maxZ: 0, color: '#8c7a63' },
  { id: 'residential', name: { de: 'Wohnviertel Altmarkt', en: 'Altmarkt Residential' }, minX: -100, maxX: 450, minZ: 0, maxZ: 511, color: '#b39b7d' },
  { id: 'harbor', name: { de: 'Hafen', en: 'Harbor' }, minX: 450, maxX: 1000, minZ: 0, maxZ: 511, color: '#5f7d8c' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d;
  return { id: 'ocean', name: { de: 'Ozean', en: 'Ocean' }, color: '#2a6f97' };
}

/** Flussmitte als Funktion von z. */
export function riverCenter(z) {
  return W.riverX + 16 * Math.sin(z / 140) + 6 * Math.sin(z / 47);
}

function flatFactor(x, z) {
  let f = 0;
  for (const zone of FLAT_ZONES) {
    const m = zone.margin;
    const fx = Math.min(smoothstep(zone.minX - m, zone.minX, x), 1 - smoothstep(zone.maxX, zone.maxX + m, x));
    const fz = Math.min(smoothstep(zone.minZ - m, zone.minZ, z), 1 - smoothstep(zone.maxZ, zone.maxZ + m, z));
    f = Math.max(f, Math.min(fx, fz));
  }
  return f;
}

/** Bergmaske 0..1 (wo Berge entstehen dürfen). */
function mountainMask(x, z) {
  // Nördliche Berge zwischen Flughafen und Militär
  const north = Math.min(smoothstep(-280, -150, x), 1 - smoothstep(330, 420, x)) * (1 - smoothstep(-640, -560, z));
  // Westwald-Hügel
  const west = 1 - smoothstep(-780, -690, x);
  // Ganz im Norden hinter Flughafen/Militär
  const farNorth = 1 - smoothstep(-990, -930, z);
  return clamp(Math.max(north, west * 0.8, farNorth * 0.6), 0, 1);
}

/** Bergsporn über der Autobahn (für den Tunnel). */
function tunnelSpur(x, z) {
  const t = W.tunnel;
  // Einschnitt für die Autobahn vor/nach dem Tunnel (Strasse bleibt frei)
  if (Math.abs(z - t.z) < t.halfWidth + 1 && (x < t.x0 || x > t.x1)) return 0;
  const fx = Math.min(smoothstep(t.x0 - 25, t.x0 + 5, x), 1 - smoothstep(t.x1 - 5, t.x1 + 25, x));
  const fz = Math.min(smoothstep(-640, -590, z), 1 - smoothstep(-505, -490, z));
  return Math.min(fx, fz) * 34;
}

/** Abstand zur Küste (positiv = an Land). */
function coastDistance(x, z) {
  const harborQuay = z > -40 && z < 520;
  const east = (harborQuay ? 905 : 880) - x;
  const south = 640 - z + 18 * Math.sin(x / 90);
  const north = z + 975;
  const west = x + 975 + 15 * Math.sin(z / 70);
  return { d: Math.min(east, south, north, west), harborEdge: harborQuay && east < Math.min(south, north, west) };
}

/** Rohe Terrainhöhe ohne Tunnel-Sonderfall. */
export function terrainHeight(x, z) {
  const flat = flatFactor(x, z);
  let h = 0;
  const mm = mountainMask(x, z);
  if (mm > 0) {
    const n = fbm(x / 210, z / 210, 4, 7);
    const ridge = 1 - Math.abs(fbm(x / 120 + 3.1, z / 120 - 1.7, 3, 11) * 2 - 1);
    h = mm * (25 + 110 * n * n + 45 * ridge * mm);
  } else {
    h = 2.5 * (fbm(x / 60, z / 60, 2, 3) - 0.5);
  }
  h *= 1 - flat;
  h = Math.max(h, tunnelSpur(x, z));

  // Fluss
  const rc = riverCenter(z);
  const dx = Math.abs(x - rc);
  const half = W.riverWidth / 2;
  if (z > -990 && dx < half + 18) {
    const bank = smoothstep(half + 18, half - 2, dx);
    const riverBed = -6.5;
    h = h + (riverBed - h) * bank;
  }

  // Küsten
  const c = coastDistance(x, z);
  if (c.harborEdge) {
    if (c.d < 0) h = -12; // Kaimauer: senkrechter Abfall
  } else if (c.d < 80) {
    const t = smoothstep(80, -60, c.d);
    h = h * (1 - t) + (-14) * t; // Strand bzw. Klippe: weicher Übergang ins Meer
  }
  return h;
}

/** Liegt (x,z) im Tunnelkorridor? */
export function inTunnel(x, z) {
  const t = W.tunnel;
  return x > t.x0 - 2 && x < t.x1 + 2 && Math.abs(z - t.z) < t.halfWidth;
}

/** Bodenhöhe des Terrains für Physik – im Tunnel unter der Decke ist der Boden 0. */
export function groundTerrain(x, z, y = 0) {
  if (inTunnel(x, z) && y < CONFIG.world.tunnel.height - 0.5) return 0;
  return terrainHeight(x, z);
}

export function isWater(x, z) {
  return terrainHeight(x, z) < WATER_Y - 0.4;
}

export function waterDepth(x, z) {
  return WATER_Y - terrainHeight(x, z);
}
