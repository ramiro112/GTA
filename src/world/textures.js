// Prozedural erzeugte Texturen (Canvas) – keine externen Bilddateien, keine Lizenzfragen.

import * as THREE from 'three';
import { Random } from '../core/random.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Fassadentextur mit Fensterraster. Eine Kachel = cols × rows Fenster.
 * Liefert {map, emissive}: Tagestextur und Nacht-Leuchttextur (zufällig beleuchtete Fenster).
 */
export function makeFacade(style, seed = 1) {
  const rng = new Random(seed);
  const S = 256;
  const [c, g] = canvas(S, S);
  const [ce, ge] = canvas(S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const cols = style === 'office' ? 4 : 4, rows = 4;
  const cw = S / cols, rh = S / rows;
  // Wand (hell, wird über Vertex-Farbe eingefärbt)
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) { // leichte Körnung
    const v = 215 + rng.int(0, 30);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng.int(0, S), rng.int(0, S), 2, 2);
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x, y, w, h;
      if (style === 'office') { x = i * cw + 4; y = j * rh + 8; w = cw - 8; h = rh - 14; }
      else { x = i * cw + cw * 0.25; y = j * rh + rh * 0.22; w = cw * 0.5; h = rh * 0.55; }
      // Fensterrahmen + Glas
      g.fillStyle = style === 'office' ? '#3d4a5a' : '#5a4a3a';
      g.fillRect(x - 2, y - 2, w + 4, h + 4);
      const grd = g.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, '#5f7f9f'); grd.addColorStop(0.5, '#2c3e55'); grd.addColorStop(1, '#4a6a8a');
      g.fillStyle = grd; g.fillRect(x, y, w, h);
      if (style !== 'office') { g.fillStyle = '#e8e8e8'; g.fillRect(x + w / 2 - 1, y, 2, h); g.fillRect(x, y + h / 2 - 1, w, 2); }
      // Nachts beleuchtet?
      if (rng.chance(0.42)) {
        const warm = rng.pick(['#ffd890', '#ffe7b0', '#fff4d8', '#cfe6ff', '#ffc070']);
        ge.fillStyle = warm; ge.fillRect(x, y, w, h);
        ge.fillStyle = 'rgba(0,0,0,0.25)'; ge.fillRect(x, y + h * 0.6, w, h * 0.4);
      }
    }
  }
  // Ecke (0..4 px) bleibt Wandfarbe → für Dach-UV (0.01, 0.01)
  g.fillStyle = '#e0e0e0'; g.fillRect(0, S - 6, 6, 6);
  return { map: toTexture(c), emissive: toTexture(ce) };
}

/** Asphalt mit leichter Körnung. */
export function makeAsphalt() {
  const rng = new Random(77);
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#4a4a4e'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = 55 + rng.int(0, 40);
    g.fillStyle = `rgba(${v},${v},${v + 3},0.6)`;
    g.fillRect(rng.int(0, S), rng.int(0, S), rng.int(1, 3), rng.int(1, 3));
  }
  for (let i = 0; i < 6; i++) { // Flicken
    g.fillStyle = 'rgba(30,30,32,0.25)';
    g.fillRect(rng.int(0, S), rng.int(0, S), rng.int(20, 60), rng.int(10, 40));
  }
  return toTexture(c);
}

/** Gehweg-Platten. */
export function makePavement() {
  const rng = new Random(78);
  const S = 128;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1500; i++) {
    const v = 180 + rng.int(0, 50);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng.int(0, S), rng.int(0, S), 2, 2);
  }
  g.strokeStyle = 'rgba(90,90,90,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(S, i * 32); g.stroke();
  }
  return toTexture(c);
}

/** Graustufen-Rauschen als Detailtextur fürs Terrain. */
export function makeNoiseTexture() {
  const rng = new Random(79);
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14000; i++) {
    const v = 170 + rng.int(0, 85);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng.int(0, S), rng.int(0, S), rng.int(1, 4), rng.int(1, 4));
  }
  return toTexture(c);
}

/** Weicher radialer Verlauf (Lichtkegel am Boden, Partikel). */
export function makeRadial(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, g] = canvas(size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return toTexture(c, false);
}

/** Wasser-Normalen (prozedurale Wellen). */
export function makeWaterNormal() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * Math.PI * 2, fy = (y / S) * Math.PI * 2;
      const nx = Math.cos(fx * 3 + fy * 2) * 0.35 + Math.cos(fx * 7 - fy * 5) * 0.15 + Math.sin(fx * 11 + fy * 13) * 0.08;
      const ny = Math.sin(fy * 4 - fx * 1) * 0.35 + Math.cos(fy * 9 + fx * 6) * 0.15 + Math.sin(fx * 13 - fy * 11) * 0.08;
      const i = (y * S + x) * 4;
      img.data[i] = 128 + nx * 120; img.data[i + 1] = 128 + ny * 120; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

/** Schild/Logo-Textur mit Text (für Läden). */
export function makeSignTexture(text, bg = '#202833', fg = '#ffd23f', w = 512, h = 128) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg;
  g.font = `bold ${Math.floor(h * 0.48)}px Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2, w - 30);
  return toTexture(c, false);
}

/** Helipad-Markierung. */
export function makeHelipad() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#3a3d42'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#ffd23f'; g.lineWidth = 10; g.beginPath(); g.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffffff'; g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('H', S / 2, S / 2 + 8);
  return toTexture(c, false);
}
