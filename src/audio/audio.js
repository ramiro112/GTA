// Audio-System (Web Audio, alles prozedural): Motoren je Fahrzeugtyp (Stimmen-Pool für die nächsten
// Fahrzeuge), Rotor, Jet, Propeller, Schüsse je Waffe, Explosionen, Schritte, Umgebung (Stadt,
// Regen, Wellen, Vögel, Wind), Donner, Sirenen, Hupe, Alarm, Glas, UI-Klänge, Autoradio.
// Räumlich über PannerNodes (HRTF), Hörer = Kamera. Lautstärke: Gesamt / Effekte / Musik.

import * as THREE from 'three';
import { events } from '../core/events.js';
import { Radio } from './radio.js';
import { districtAt, WATER_Y, terrainHeight } from '../world/terrain.js';

const ENGINE_BASE = { compact: 55, sedan: 48, sports: 62, suv: 42, truck: 30, bus: 32, motorbike: 80, police: 52, ambulance: 45, taxi: 48, firetruck: 30, swat: 38, military: 38, speedboat: 50 };

export class AudioSystem {
  constructor(game) {
    this.game = game;
    game.audio = this;
    this.ctx = null;
    this.ready = false;
    this.voices = [];
    this.sirens = [];
    // Audio erst nach Benutzergeste starten (Browser-Vorgabe)
    const unlock = () => { this.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    this.ctx = c;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.sfx);
    this.noise = this._makeNoise(2);
    this.brown = this._makeBrown(3);
    this.setVolumes(this.game.settings);
    // Umgebung: Stadtrauschen, Regen, Wellen, Wind
    this.ambCity = this._loop(this.brown, 'lowpass', 400, 0);
    this.ambRain = this._loop(this.noise, 'highpass', 1200, 0);
    this.ambWaves = this._loop(this.brown, 'lowpass', 700, 0);
    this.ambWind = this._loop(this.noise, 'bandpass', 500, 0);
    // Motor-Stimmen (Pool)
    for (let i = 0; i < 5; i++) this.voices.push(this._engineVoice());
    for (let i = 0; i < 2; i++) this.sirens.push(this._sirenVoice());
    this.horn = this._hornVoice();
    this.rotor = this._rotorVoice();
    this.radio = new Radio(c, this.music);
    this._wire();
    this.ready = true;
  }

  setVolumes(s) {
    if (!this.ctx) return;
    this.master.gain.value = s.master ?? 0.8;
    this.sfx.gain.value = s.sfx ?? 0.8;
    this.music.gain.value = s.music ?? 0.5;
  }

  // ------------------------------------------------------------------ Bausteine
  _makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _makeBrown(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }

  _loop(buffer, type, freq, gain) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.amb);
    src.start();
    return { src, f, g };
  }

  _panner() {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 6;
    p.maxDistance = 400;
    p.rolloffFactor = 1.2;
    p.connect(this.sfx);
    return p;
  }

  _setPos(p, v) {
    if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; }
    else p.setPosition(v.x, v.y, v.z);
  }

  _engineVoice() {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
    const g = c.createGain(); g.gain.value = 0;
    const p = this._panner();
    o1.connect(f); o2.connect(f); f.connect(g).connect(p);
    o1.start(); o2.start();
    return { o1, o2, f, g, p, vehicle: null };
  }

  _sirenVoice() {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'square';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
    const g = c.createGain(); g.gain.value = 0;
    const p = this._panner();
    p.refDistance = 15;
    o.connect(f).connect(g).connect(p);
    o.start();
    return { o, g, p, vehicle: null };
  }

  _hornVoice() {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'square'; o1.frequency.value = 370;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 466;
    const g = c.createGain(); g.gain.value = 0;
    const p = this._panner();
    o1.connect(g); o2.connect(g); g.connect(p);
    o1.start(); o2.start();
    return { g, p };
  }

  _rotorVoice() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const am = c.createGain(); am.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 12;
    const lfoG = c.createGain(); lfoG.gain.value = 0;
    lfo.connect(lfoG).connect(am.gain);
    const g = c.createGain(); g.gain.value = 0;
    const p = this._panner(); p.refDistance = 20;
    src.connect(f).connect(am).connect(g).connect(p);
    src.start(); lfo.start();
    const jet = c.createBufferSource(); jet.buffer = this.noise; jet.loop = true;
    const jf = c.createBiquadFilter(); jf.type = 'bandpass'; jf.frequency.value = 900; jf.Q.value = 0.5;
    const jg = c.createGain(); jg.gain.value = 0;
    jet.connect(jf).connect(jg).connect(p); jet.start();
    return { f, am, lfo, lfoG, g, p, jf, jg, aircraft: null };
  }

  /** Einmaliger Klang an einer Position (null = ohne Raum). */
  _burst({ pos = null, dur = 0.2, type = 'lowpass', freq = 1000, vol = 0.6, noise = true, tone = 0, toneEnd = 0, decay = 0.15, buffer = null }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const dest = pos ? this._panner() : this.sfx;
    if (pos) { this._setPos(dest, pos); setTimeout(() => dest.disconnect(), (dur + 0.5) * 1000); }
    g.connect(dest);
    if (noise) {
      const n = c.createBufferSource(); n.buffer = buffer || this.noise;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), t + decay);
      n.connect(f).connect(g);
      n.start(t, Math.random() * 1); n.stop(t + dur + 0.05);
    }
    if (tone) {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(tone, t);
      if (toneEnd) o.frequency.exponentialRampToValueAtTime(toneEnd, t + dur);
      o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  _beep(freq, dur = 0.12, vol = 0.15, type = 'square', delay = 0) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------------ Ereignisse
  _wire() {
    const W = { pistol: [0.18, 2500, 0.7, 120], smg: [0.12, 3000, 0.5, 140], shotgun: [0.35, 1200, 0.9, 80], rifle: [0.16, 3500, 0.7, 110], sniper: [0.5, 2000, 1.0, 70], mg: [0.12, 2800, 0.6, 100], rocket: [0.6, 600, 0.8, 60] };
    events.on('weapon:fired', (e) => {
      const p = W[e.weapon] || W.pistol;
      this._burst({ pos: e.pos, dur: p[0], freq: p[1], vol: p[2], tone: p[3], toneEnd: 40, decay: p[0] * 0.6 });
    });
    events.on('weapon:empty', () => this._beep(1800, 0.04, 0.1));
    events.on('weapon:reload', () => { this._beep(500, 0.05, 0.1, 'square'); this._beep(700, 0.05, 0.1, 'square', 0.4); });
    events.on('weapon:punch', (e) => { if (e.hit) this._burst({ pos: e.shooter.pos, dur: 0.12, freq: 400, vol: 0.5, tone: 90, toneEnd: 50 }); });
    events.on('weapon:swing', (e) => this._burst({ pos: e.shooter.pos, dur: 0.15, type: 'bandpass', freq: 1500, vol: 0.15 }));
    events.on('weapon:throw', () => this._burst({ dur: 0.2, type: 'bandpass', freq: 800, vol: 0.2 }));
    events.on('weapon:missile', (e) => this._burst({ pos: e.aircraft.pos, dur: 0.8, freq: 800, vol: 0.6 }));
    events.on('explosion', (e) => {
      this._burst({ pos: e.pos, dur: 2.2, freq: 900, vol: 1.6, tone: 70, toneEnd: 25, decay: 1.5, buffer: this.brown });
      this._burst({ pos: e.pos, dur: 0.5, freq: 3000, vol: 0.6, decay: 0.3 });
    });
    events.on('vehicle:impact', (e) => { if (e.speed > 4) this._burst({ pos: e.vehicle.pos, dur: 0.3, freq: 900, vol: Math.min(1, e.speed / 20), tone: 80, toneEnd: 40 }); });
    events.on('vehicle:windowSmash', (e) => { this._burst({ pos: e.vehicle.pos, dur: 0.4, type: 'highpass', freq: 3000, vol: 0.6 }); });
    events.on('vehicle:tire', (e) => this._burst({ pos: e.vehicle.pos, dur: 0.25, freq: 1500, vol: 0.7 }));
    events.on('player:jump', () => this._burst({ dur: 0.08, freq: 600, vol: 0.12 }));
    events.on('player:land', (e) => this._burst({ dur: e.hard ? 0.25 : 0.1, freq: 400, vol: e.hard ? 0.5 : 0.15, tone: e.hard ? 70 : 0 }));
    events.on('player:swim', () => this._burst({ dur: 0.5, type: 'highpass', freq: 800, vol: 0.4 }));
    events.on('weather:thunder', () => this._burst({ dur: 3.5, freq: 400, vol: 1.0, tone: 45, toneEnd: 25, decay: 2.5, buffer: this.brown }));
    events.on('money:change', (e) => { if (e.amount > 0) { this._beep(1320, 0.08, 0.08, 'sine'); this._beep(1760, 0.12, 0.08, 'sine', 0.08); } });
    events.on('mission:complete', () => [523, 659, 784, 1046].forEach((f, i) => this._beep(f, 0.25, 0.12, 'triangle', i * 0.12)));
    events.on('mission:failed', () => [392, 330, 262].forEach((f, i) => this._beep(f, 0.3, 0.12, 'triangle', i * 0.18)));
    events.on('mission:checkpointHit', () => this._beep(1046, 0.1, 0.12, 'sine'));
    events.on('wanted:up', () => { this._beep(880, 0.08, 0.1); this._beep(660, 0.12, 0.1, 'square', 0.1); });
    events.on('stunt:jump', () => [660, 880, 1100].forEach((f, i) => this._beep(f, 0.15, 0.1, 'triangle', i * 0.08)));
    events.on('pickup', () => this._beep(990, 0.08, 0.12, 'sine'));
  }

  // ------------------------------------------------------------------ Schleife
  update(dt) {
    if (!this.ready) return;
    const g = this.game;
    const c = this.ctx;
    const cam = g.camera;
    // Hörer
    const L = c.listener;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    if (L.positionX) {
      L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(cam.position.x, cam.position.y, cam.position.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
    const paused = g.paused && g.ui && g.ui.mode !== 'menu';
    const mute = paused ? 0 : 1;
    const t = c.currentTime;
    // Umgebung
    const p = g.player.pos;
    const d = districtAt(p.x, p.z).id;
    const city = ['downtown', 'residential', 'industrial', 'harbor'].includes(d) ? 0.12 : 0.04;
    this.ambCity.g.gain.setTargetAtTime(city * mute * (1 - g.tod.night * 0.5), t, 0.5);
    this.ambRain.g.gain.setTargetAtTime(g.weather.state.rain * 0.25 * mute, t, 0.5);
    const nearSea = terrainHeight(p.x, p.z + 40) < WATER_Y || terrainHeight(p.x + 40, p.z) < WATER_Y;
    this.ambWaves.g.gain.setTargetAtTime((nearSea ? 0.15 : 0) * mute, t, 0.8);
    this.ambWaves.f.frequency.setTargetAtTime(500 + Math.sin(g.elapsed * 0.4) * 250, t, 0.3);
    this.ambWind.g.gain.setTargetAtTime((g.weather.state.wind * 0.06 + (p.y > 40 ? 0.08 : 0)) * mute, t, 0.5);
    // Vögel tagsüber im Park/Vorort/Wald
    if (!paused && ['park', 'suburb', 'forest', 'mountains'].includes(d) && g.tod.night < 0.3 && Math.random() < dt * 0.6) {
      const f0 = 2500 + Math.random() * 2000;
      for (let i = 0; i < 3; i++) this._beep(f0 + i * 200 * (Math.random() - 0.5), 0.06, 0.03, 'sine', i * 0.09);
    }
    // Schritte
    const pl = g.player;
    if (!pl.vehicle && pl.onGround && (pl.speed || 0) > 1 && !paused) {
      this.stepT = (this.stepT || 0) - dt * (pl.speed || 0) * 0.55;
      if (this.stepT <= 0) { this.stepT = 1; this._burst({ dur: 0.07, freq: pl.swimming ? 600 : 900, vol: pl.crouch ? 0.05 : 0.12 }); }
    }
    this._engines(mute);
    this._sirens(mute);
    this._aircraft(mute);
    // Hupe (Spieler + KI)
    let hornV = null;
    for (const v of g.vehicles.list) if (v.horn && v.pos.distanceTo(cam.position) < 120) { hornV = v; break; }
    this.horn.g.gain.setTargetAtTime(hornV ? 0.12 * mute : 0, t, 0.02);
    if (hornV) this._setPos(this.horn.p, hornV.pos);
    // Autoalarm
    for (const v of g.vehicles.list) if (v.alarmTimer > 0 && Math.sin(g.elapsed * 8) > 0.9 && !paused) { this._beep(1200, 0.08, 0.06); break; }
    // Radio im Fahrzeug
    const inVeh = pl.vehicle && !pl.vehicle.isAircraft;
    if (inVeh && !paused) {
      if (!this.radio.on) { this.radio.start(); if (!this.radioShown) { g.hud.radio(this.radio.current.name); this.radioShown = true; } }
      if (g.input.pressed('radio')) g.hud.radio(this.radio.next().name);
    } else if (this.radio.on) { this.radio.stop(); this.radioShown = false; }
  }

  _engines(mute) {
    const g = this.game, t = this.ctx.currentTime;
    const cam = g.camera.position;
    const cand = g.vehicles.list.filter((v) => !v.isAircraft && (v.driver || v.ai) && !v.destroyed && v.pos.distanceTo(cam) < 90).sort((a, b) => a.pos.distanceTo(cam) - b.pos.distanceTo(cam)).slice(0, this.voices.length);
    this.voices.forEach((voice, i) => {
      const v = cand[i];
      if (!v) { voice.g.gain.setTargetAtTime(0, t, 0.1); return; }
      const base = ENGINE_BASE[v.type] || 45;
      const sp = Math.abs(v.speed || 0);
      const maxS = v.def.maxSpeed || 40;
      // Gänge: Drehzahl steigt und fällt in Stufen
      const gearSpan = maxS / 5;
      const rpm = 0.25 + ((sp % gearSpan) / gearSpan) * 0.6 + Math.min(1, sp / maxS) * 0.25;
      const f = base * (1 + rpm * 2.2);
      voice.o1.frequency.setTargetAtTime(f, t, 0.05);
      voice.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      voice.f.frequency.setTargetAtTime(400 + v.controls.throttle * 1400 + rpm * 600, t, 0.05);
      const own = g.player.vehicle === v;
      voice.g.gain.setTargetAtTime((own ? 0.11 : 0.07) * (0.5 + v.controls.throttle * 0.5) * mute, t, 0.08);
      this._setPos(voice.p, v.pos);
    });
  }

  _sirens(mute) {
    const g = this.game, t = this.ctx.currentTime;
    const cam = g.camera.position;
    const cand = g.vehicles.list.filter((v) => v.sirenOn && !v.destroyed && v.pos.distanceTo(cam) < 200).sort((a, b) => a.pos.distanceTo(cam) - b.pos.distanceTo(cam));
    this.sirens.forEach((s, i) => {
      const v = cand[i];
      if (!v) { s.g.gain.setTargetAtTime(0, t, 0.1); return; }
      const wail = v.def.emergency === 'ambulance' ? (Math.sin(g.elapsed * 3) > 0 ? 960 : 770) : 700 + Math.sin(g.elapsed * 2.5 + i) * 350;
      s.o.frequency.setTargetAtTime(wail, t, 0.03);
      s.g.gain.setTargetAtTime(0.07 * mute, t, 0.05);
      this._setPos(s.p, v.pos);
    });
  }

  _aircraft(mute) {
    const g = this.game, t = this.ctx.currentTime;
    const cam = g.camera.position;
    const a = g.vehicles.list.filter((v) => v.isAircraft && !v.destroyed && v.pos.distanceTo(cam) < 300 && ((v.rotor || 0) > 0.05 || (v.throttle || 0) > 0.02 || v.policeHeli)).sort((x, y) => x.pos.distanceTo(cam) - y.pos.distanceTo(cam))[0];
    const r = this.rotor;
    if (!a) { r.g.gain.setTargetAtTime(0, t, 0.2); r.jg.gain.setTargetAtTime(0, t, 0.2); return; }
    this._setPos(r.p, a.pos);
    if (a.kind2 === 'heli') {
      r.lfo.frequency.setTargetAtTime(6 + (a.rotor || 1) * 10, t, 0.1);
      r.lfoG.gain.setTargetAtTime(0.9, t, 0.1);
      r.g.gain.setTargetAtTime(0.5 * (a.rotor || 1) * mute, t, 0.2);
      r.jg.gain.setTargetAtTime(0.05 * mute, t, 0.2);
    } else {
      const thr = a.throttle || 0;
      r.lfo.frequency.setTargetAtTime(a.jet ? 0.5 : 25 + thr * 40, t, 0.1);
      r.lfoG.gain.setTargetAtTime(a.jet ? 0 : 0.6, t, 0.1);
      r.g.gain.setTargetAtTime((a.jet ? 0.1 : 0.35) * (0.3 + thr) * mute, t, 0.2);
      r.jf.frequency.setTargetAtTime(a.jet ? 600 + thr * 1500 : 400, t, 0.2);
      r.jg.gain.setTargetAtTime((a.jet ? 0.6 * (0.2 + thr) : 0.05) * mute, t, 0.2);
    }
  }
}
