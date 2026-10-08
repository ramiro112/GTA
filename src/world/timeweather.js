// Tageszeit und Wetter als reine Logik (testbar). Die Darstellung übernimmt environment.js.

import { CONFIG } from '../config.js';
import { clamp, smoothstep, lerp } from '../core/mathutil.js';
import { mulberry32 } from '../core/random.js';

export class TimeOfDay {
  constructor(hour = CONFIG.time.startHour) {
    this.hour = hour;          // 0..24
    this.day = 1;
    this.scale = (24 * 60) / (CONFIG.time.dayLengthMinutes * 60); // Spielstunden pro Echtsekunde × 60
    this.paused = false;
  }

  /** dt in Echtsekunden. */
  update(dt) {
    if (this.paused) return;
    this.hour += (dt * this.scale) / 60;
    while (this.hour >= 24) { this.hour -= 24; this.day++; }
  }

  /** Spielminuten pro Echtsekunde. */
  get minutesPerSecond() { return this.scale; }

  /** Sonnenhöhe -1..1 (Mittag = 1, Mitternacht = -1). */
  get sunHeight() { return Math.sin(((this.hour - 6) / 24) * Math.PI * 2); }

  /** Nachtfaktor 0 (Tag) .. 1 (tiefe Nacht) für Lichter. */
  get night() { return clamp(1 - smoothstep(-0.18, 0.12, this.sunHeight), 0, 1); }

  get isNight() { return this.night > 0.5; }

  toString() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Sprung zu einer Uhrzeit (z. B. Schlafen). */
  advanceTo(hour) {
    if (hour <= this.hour) this.day++;
    this.hour = hour;
  }
}

/** Wetterparameter je Typ. */
export const WEATHER_PRESETS = {
  clear:  { cloud: 0.1, rain: 0, fog: 0.0, wind: 0.2, darkness: 0, lightning: 0 },
  cloudy: { cloud: 0.7, rain: 0, fog: 0.1, wind: 0.4, darkness: 0.25, lightning: 0 },
  rain:   { cloud: 0.9, rain: 0.7, fog: 0.3, wind: 0.6, darkness: 0.4, lightning: 0 },
  fog:    { cloud: 0.5, rain: 0, fog: 1.0, wind: 0.1, darkness: 0.25, lightning: 0 },
  storm:  { cloud: 1.0, rain: 1.0, fog: 0.4, wind: 1.0, darkness: 0.6, lightning: 1 },
};

export class Weather {
  constructor(seed = 42) {
    this.rand = mulberry32(seed);
    this.type = 'clear';
    this.next = 'clear';
    this.timer = 180;
    this.blend = 1;       // 0..1 Überblendung zum nächsten Typ
    this.state = { ...WEATHER_PRESETS.clear };
    this.locked = false;  // für Missionen / Einstellungen
    this.wetness = 0;     // Strassennässe
  }

  pickNext() {
    const w = CONFIG.weather.weights;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = this.rand() * total;
    for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; }
    return 'clear';
  }

  set(type, instant = false) {
    if (!WEATHER_PRESETS[type]) return;
    this.next = type;
    this.blend = instant ? 1 : 0;
    if (instant) { this.type = type; this.state = { ...WEATHER_PRESETS[type] }; }
    this.timer = lerp(CONFIG.weather.minDuration, CONFIG.weather.maxDuration, this.rand());
  }

  update(dt) {
    if (!this.locked) {
      this.timer -= dt;
      if (this.timer <= 0) this.set(this.pickNext());
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 20);
      const a = WEATHER_PRESETS[this.type], b = WEATHER_PRESETS[this.next];
      for (const k of Object.keys(a)) this.state[k] = lerp(a[k], b[k], this.blend);
      if (this.blend >= 1) this.type = this.next;
    }
    const targetWet = this.state.rain > 0.1 ? 1 : 0;
    this.wetness = clamp(this.wetness + (targetWet ? dt / 30 : -dt / 90), 0, 1);
  }

  get current() { return this.blend >= 1 ? this.type : this.next; }
}
