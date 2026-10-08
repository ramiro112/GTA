// Zentrale Spielklasse: verbindet Renderer, Welt, Spieler, Systeme und Oberfläche.
// Systeme mit fixedUpdate(dt) laufen im festen Physiktakt, update(dt) einmal pro Frame.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GameLoop } from './core/loop.js';
import { input } from './core/input.js';
import { events } from './core/events.js';
import { setLanguage } from './core/i18n.js';
import { loadSettings, saveSettings, qualityFrom, safeStorage } from './core/settings.js';
import { CollisionWorld } from './world/collision.js';
import { buildRoadNetwork } from './world/roads.js';
import { generateCity, RESPAWN } from './world/layout.js';
import { City } from './world/city.js';
import { Environment } from './world/environment.js';
import { TimeOfDay, Weather } from './world/timeweather.js';
import { Player } from './player/player.js';
import { ThirdPersonCamera } from './player/camera.js';
import { HUD } from './ui/hud.js';
import { MapRenderer } from './ui/map.js';

export class Game {
  constructor(container, uiRoot) {
    this.container = container;
    this.uiRoot = uiRoot;
    this.storage = safeStorage();
    this.settings = loadSettings(this.storage);
    setLanguage(this.settings.language);
    this.quality = qualityFrom(this.settings);
    this.input = input;
    this.events = events;
    this.systems = [];
    this.paused = true;
    this.started = false;
    this.elapsed = 0;
    this.godMode = false;
    this.stats = { distanceFoot: 0, distanceCar: 0, kills: 0, carsStolen: 0, shots: 0, hits: 0, deaths: 0, arrests: 0, moneyEarned: 0, playTime: 0, stunts: 0, maxWanted: 0, missionsDone: 0 };
  }

  async init(onProgress = () => {}) {
    // Renderer
    const r = new THREE.WebGLRenderer({ antialias: this.quality.antialias, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * this.quality.pixelRatio);
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = this.quality.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.container.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.15, 3500);
    window.addEventListener('resize', () => this.onResize());
    input.attach(window, r.domElement);
    input.setBindings(this.settings.bindings);
    input.sensitivity = this.settings.sensitivity;
    input.invertY = this.settings.invertY;

    onProgress(0.02, 'Strassennetz');
    await tick();
    this.collision = new CollisionWorld();
    this.roads = buildRoadNetwork();
    this.layout = generateCity();
    this.city = new City(this.scene, this.collision, this.roads, this.layout, this.quality);
    await this.city.build((f, s) => onProgress(0.05 + f * 0.6, s));
    this.env = new Environment(this.scene, r, this.quality);
    this.tod = new TimeOfDay();
    this.weather = new Weather(CONFIG.seed);
    onProgress(0.7, 'Karte');
    await tick();
    this.mapRenderer = new MapRenderer(this.layout, this.roads);

    this.player = new Player(this);
    this.camera3p = new ThirdPersonCamera(this.camera, this.collision);
    this.hud = new HUD(this, this.uiRoot);

    onProgress(0.8, 'Systeme');
    await tick();
    await this.initSystems(onProgress);

    this.loop = new GameLoop({
      fixedDt: CONFIG.physics.fixedDt,
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      update: (dt, a) => this.update(dt, a),
      render: () => this.render(),
    });
    // Erstes Bild, damit Shader kompiliert sind
    const sp = RESPAWN.start;
    this.player.teleport(sp.x, null, sp.z, sp.heading);
    this.camera3p.yaw = sp.heading;
    this.update(0.016, 1);
    r.compile(this.scene, this.camera);
    onProgress(1, 'Bereit');
    this.loop.start();
  }

  /** Optionale Systeme (werden in späteren Meilensteinen ergänzt). */
  async initSystems() {
    const mods = this.systemModules || [];
    for (const m of mods) {
      const sys = new m(this);
      this.systems.push(sys);
    }
  }

  addSystem(sys, name) {
    this.systems.push(sys);
    if (name) this[name] = sys;
    return sys;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  applySettings() {
    setLanguage(this.settings.language);
    input.sensitivity = this.settings.sensitivity;
    input.invertY = this.settings.invertY;
    input.setBindings(this.settings.bindings);
    const q = qualityFrom(this.settings);
    const shadowChanged = q.shadows !== this.quality.shadows;
    Object.assign(this.quality, q);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.env.setQuality(this.quality);
    if (shadowChanged) this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    if (this.audio) this.audio.setVolumes(this.settings);
    saveSettings(this.storage, this.settings);
    events.emit('settings:changed', this.settings);
  }

  // ------------------------------------------------------------------ Schleife
  fixedUpdate(dt) {
    if (this.paused) return;
    this.player.fixedUpdate(dt);
    for (const s of this.systems) if (s.fixedUpdate) s.fixedUpdate(dt);
  }

  update(dt, alpha) {
    input.pollGamepad();
    if (this.ui) this.ui.handleGlobalKeys();
    if (!this.paused) {
      this.elapsed += dt;
      this.stats.playTime += dt;
      this.tod.update(dt);
      this.weather.update(dt);
      for (const s of this.systems) if (s.update) s.update(dt);
    }
    // Kamera
    const p = this.player;
    const look = this.paused ? { x: 0, y: 0 } : input.lookDelta(dt);
    const v = p.vehicle;
    const focus = v ? v.renderPos || v.pos : p.model.root.position;
    p.update(this.paused ? 0 : dt, alpha);
    this.camera3p.update(dt, look, {
      focus,
      vehicle: v,
      aircraft: v && v.isAircraft,
      heading: v ? v.heading : p.heading,
      speed: v ? Math.abs(v.speed || 0) : 0,
      aiming: p.aiming,
      scope: p.aiming && this.weapons && this.weapons.isScoped(p),
      crouch: p.crouch,
      lookBehind: v && input.down('lookBehind'),
      firstPersonPos: v && v.driverEyePos ? v.driverEyePos() : null,
    });
    const camPos = this.camera.position;
    this.env.update(dt, this.tod, this.weather, camPos, focus, () => events.emit('weather:thunder'));
    this.city.wetness = this.weather.wetness;
    this.city.update(dt, this.elapsed, camPos, this.tod.night);
    if (this.hud && this.started) this.hud.update(dt);
    if (this.ui) this.ui.update(dt);
    input.endFrame();
  }

  /** Test-Hook: Simulation ohne Rendern vorspulen (für automatisierte Tests). */
  simulate(seconds) {
    const steps = Math.round(seconds / CONFIG.physics.fixedDt);
    const wasPaused = this.paused;
    this.paused = false;
    for (let i = 0; i < steps; i++) {
      this.fixedUpdate(CONFIG.physics.fixedDt);
      if (i % 3 === 2 || i === steps - 1) {
        const keep = new Set(this.input.codesPressed);
        this.update(CONFIG.physics.fixedDt * 3, 1);
        if (i < 3) for (const k of keep) this.input.codesPressed.delete(k);
      }
    }
    this.paused = wasPaused;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ Steuerung
  start() {
    this.started = true;
    this.paused = false;
    this.hud.show(true);
    input.enabled = true;
    input.requestPointerLock();
  }

  pause(v = true) {
    this.paused = v;
    input.enabled = !v;
    if (v) input.exitPointerLock(); else input.requestPointerLock();
    events.emit(v ? 'game:paused' : 'game:resumed');
  }

  /** Alle Figuren mit Gesundheit (Spieler, Passanten, Polizei, Gangster …). */
  allCharacters() {
    const out = [this.player];
    for (const s of this.systems) if (s.characters) for (const c of s.characters) out.push(c);
    return out;
  }

  /** Blips für Minimap/Karte (Systeme können über mapBlips() beitragen). */
  blips() {
    const out = [];
    for (const s of this.systems) if (s.mapBlips) s.mapBlips(out);
    return out;
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }
