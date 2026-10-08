// Karte: vorgerendertes Stadtbild (Canvas) + Minimap (rotierend, mit Blips) + Vollbildkarte.

import { CONFIG } from '../config.js';
import { terrainHeight, WATER_Y, DISTRICTS } from '../world/terrain.js';
import { tr } from '../core/i18n.js';

const W = CONFIG.world;
const SCALE = 0.5;            // Pixel pro Meter im Kartenbild
const SIZE = W.half * 2;      // Meter

export const BLIP_ICONS = {
  house: '🏠', garage: '🅿', gun: '🔫', clothes: '👕', food: '🍔', barber: '✂', tuning: '🔧', dealer: '🚘',
  hospital: '✚', police: '★', bank: '$', scrap: '♻', safehouse: '🏡', fuel: '⛽', mission: 'M', activity: '◆',
  airport: '✈', military: '⚔', waypoint: '⬤', target: '▼', stunt: '↗', race: '🏁', viewpoint: '⛰',
};

export class MapRenderer {
  constructor(layout, roads) {
    this.layout = layout;
    this.roads = roads;
    this.image = this._render();
  }

  /** Weltkoordinate → Kartenbild-Pixel */
  toImg(x, z) { return [(x + W.half) * SCALE, (z + W.half) * SCALE]; }
  toWorld(px, py) { return [px / SCALE - W.half, py / SCALE - W.half]; }

  _render() {
    const px = SIZE * SCALE;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    // Terrain/Wasser (grob abgetastet)
    const step = 8;
    for (let z = -W.half; z < W.half; z += step) {
      for (let x = -W.half; x < W.half; x += step) {
        const h = terrainHeight(x + step / 2, z + step / 2);
        let col;
        if (h < WATER_Y - 0.3) col = h < -8 ? '#1b4f72' : '#2e6f95';
        else if (h > 100) col = '#c9cdd2';
        else if (h > 40) col = '#5d7a4a';
        else if (h > 4) col = '#4f7a3f';
        else {
          const d = DISTRICTS.find((dd) => x >= dd.minX && x < dd.maxX && z >= dd.minZ && z < dd.maxZ);
          col = d ? d.color : '#5d8a4a';
          if (d && (d.id === 'downtown' || d.id === 'industrial' || d.id === 'harbor' || d.id === 'residential')) col = '#6b6e75';
          if (d && d.id === 'beach' && h < 0.6) col = '#e6d49c';
        }
        g.fillStyle = col;
        const [ix, iy] = this.toImg(x, z);
        g.fillRect(ix, iy, step * SCALE + 0.5, step * SCALE + 0.5);
      }
    }
    // Gebäude
    g.fillStyle = '#9a9ca3';
    for (const b of this.layout.buildings) {
      const [ix, iy] = this.toImg(b.x - b.w / 2, b.z - b.d / 2);
      g.fillRect(ix, iy, b.w * SCALE, b.d * SCALE);
    }
    for (const lm of Object.values(this.layout.landmarks)) {
      if (!lm.w) continue;
      g.fillStyle = lm.open ? '#7d7f86' : '#b5a68a';
      const [ix, iy] = this.toImg(lm.x - lm.w / 2, lm.z - lm.d / 2);
      g.fillRect(ix, iy, lm.w * SCALE, lm.d * SCALE);
    }
    // Strassen
    g.lineCap = 'round';
    for (const e of this.roads.edges) {
      const hw = e.kind === 'highway' || e.kind === 'tunnel' || e.kind === 'highwayBridge';
      g.strokeStyle = hw ? '#e8c26a' : e.kind === 'mountain' ? '#c8b58a' : '#e9e9ec';
      g.lineWidth = Math.max(2, e.width * SCALE * (hw ? 0.9 : 0.8));
      g.beginPath();
      e.points.forEach((p, i) => { const [ix, iy] = this.toImg(p.x, p.z); if (i) g.lineTo(ix, iy); else g.moveTo(ix, iy); });
      g.stroke();
    }
    // Startbahnen
    g.fillStyle = '#3a3a3e';
    for (const r of [{ x0: -900, x1: -320, z: -770, w: 44 }, { x0: 420, x1: 840, z: -840, w: 36 }]) {
      const [ix, iy] = this.toImg(r.x0, r.z - r.w / 2);
      g.fillRect(ix, iy, (r.x1 - r.x0) * SCALE, r.w * SCALE);
    }
    // Gebietsnamen
    g.font = 'bold 13px Arial';
    g.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [ix, iy] = this.toImg((d.minX + d.maxX) / 2, (d.minZ + d.maxZ) / 2);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(tr(d.name).toUpperCase(), ix + 1, iy + 1);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(tr(d.name).toUpperCase(), ix, iy);
    }
    return c;
  }

  /**
   * Minimap zeichnen (rotiert mit Kamera, Spieler in der Mitte).
   * blips: [{x, z, icon?, color?, size?, label?}]
   */
  drawMinimap(ctx, px, pz, rotation, blips, zoom = 1, route = null) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, cw, ch);
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, cw / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1b4f72';
    ctx.fillRect(0, 0, cw, ch);
    const scale = 1.1 * zoom; // Bildpixel → Minimap-Pixel
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    const [ix, iy] = this.toImg(px, pz);
    ctx.drawImage(this.image, -ix, -iy);
    // Route
    if (route && route.length > 1) {
      ctx.strokeStyle = '#c86bff';
      ctx.lineWidth = 4 / scale;
      ctx.beginPath();
      route.forEach((p, i) => { const [rx, ry] = this.toImg(p.x, p.z); if (i) ctx.lineTo(rx - ix, ry - iy); else ctx.moveTo(rx - ix, ry - iy); });
      ctx.stroke();
    }
    ctx.restore();
    // Blips (aufrecht, am Rand geklemmt)
    const radius = cw / 2 - 10;
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    for (const b of blips) {
      const dx = (b.x - px) * SCALE * scale, dz = (b.z - pz) * SCALE * scale;
      const c = Math.cos(rotation), s = Math.sin(rotation);
      let x = dx * c - dz * s, y = dx * s + dz * c;
      const d = Math.hypot(x, y);
      if (d > radius) { if (!b.edge) continue; x *= radius / d; y *= radius / d; }
      drawBlip(ctx, x, y, b);
    }
    // Spieler-Pfeil (zeigt in Blickrichtung des Spielers relativ zur Karte)
    ctx.restore();
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(this._playerArrow || 0);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Nordmarke
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    const nx = Math.sin(-rotation) * -(cw / 2 - 12), ny = Math.cos(-rotation) * -(cw / 2 - 12);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.beginPath(); ctx.arc(nx, ny, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('N', nx, ny + 1);
    ctx.restore();
  }

  /** Vollbildkarte mit allen Blips. */
  drawBig(ctx, px, pz, heading, blips, view, route = null) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.fillStyle = '#123';
    ctx.fillRect(0, 0, cw, ch);
    const s = view.scale;
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(s, s);
    const [cx, cy] = this.toImg(view.x, view.z);
    ctx.drawImage(this.image, -cx, -cy);
    if (route && route.length > 1) {
      ctx.strokeStyle = '#c86bff'; ctx.lineWidth = 3 / s;
      ctx.beginPath();
      route.forEach((p, i) => { const [rx, ry] = this.toImg(p.x, p.z); if (i) ctx.lineTo(rx - cx, ry - cy); else ctx.moveTo(rx - cx, ry - cy); });
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    for (const b of blips) {
      const [bx, by] = this.toImg(b.x, b.z);
      drawBlip(ctx, (bx - cx) * s, (by - cy) * s, b, true);
    }
    const [ppx, ppy] = this.toImg(px, pz);
    ctx.translate((ppx - cx) * s, (ppy - cy) * s);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  screenToWorld(sx, sy, cw, ch, view) {
    const [cx, cy] = this.toImg(view.x, view.z);
    const ix = (sx - cw / 2) / view.scale + cx, iy = (sy - ch / 2) / view.scale + cy;
    return this.toWorld(ix, iy);
  }
}

function drawBlip(ctx, x, y, b, big = false) {
  const r = (b.size || 8) * (big ? 1.2 : 1);
  if (b.icon && BLIP_ICONS[b.icon]) {
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = b.color || 'rgba(20,24,32,0.9)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(r * 1.3)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(BLIP_ICONS[b.icon], x, y + 1);
  } else {
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = b.color || '#fff'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (big && b.label) {
    ctx.font = '12px Arial'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(b.label, x + r + 4, y + 4); ctx.fillText(b.label, x + r + 4, y + 4);
  }
}
