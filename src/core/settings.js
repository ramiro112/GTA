// Einstellungen (Grafik, Ton, Steuerung, Sprache) – getrennt vom Spielstand gespeichert.

import { CONFIG } from '../config.js';

export const DEFAULT_SETTINGS = {
  quality: CONFIG.graphics.defaultPreset,
  drawDistance: null,          // null = Wert der Qualitätsstufe
  master: CONFIG.audio.master,
  sfx: CONFIG.audio.sfx,
  music: CONFIG.audio.music,
  sensitivity: 1,
  invertY: false,
  autoAim: true,
  flightMode: 'arcade',
  language: 'de',
  showFps: false,
  subtitles: true,
  voice: false,
  bindings: {},
  tutorialDone: false,
};

/** Liest Einstellungen aus einem Storage-Objekt (localStorage-kompatibel). */
export function loadSettings(storage) {
  try {
    const raw = storage && storage.getItem(CONFIG.save.settingsKey);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage, settings) {
  try { storage && storage.setItem(CONFIG.save.settingsKey, JSON.stringify(settings)); return true; } catch { return false; }
}

/** Effektive Grafikwerte aus Einstellungen. */
export function qualityFrom(settings) {
  // URL-Parameter ?quality=low (z. B. für automatisierte Tests)
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q && CONFIG.graphics.presets[q]) settings = { ...settings, quality: q };
  } catch { /* Node */ }
  const p = CONFIG.graphics.presets[settings.quality] || CONFIG.graphics.presets.medium;
  return { ...p, name: settings.quality, drawDistance: settings.drawDistance || p.drawDistance };
}

/** Sicherer Zugriff auf localStorage (kann in privaten Fenstern fehlen). */
export function safeStorage() {
  try {
    const s = window.localStorage;
    const k = '__pa_test';
    s.setItem(k, '1'); s.removeItem(k);
    return s;
  } catch {
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i], get length() { return mem.size; } };
  }
}
