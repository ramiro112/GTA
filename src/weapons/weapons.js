// Waffensystem: Zielen, Schiessen (Hitscan mit Trefferzonen), Streuung, Rückstoss, Nachladen,
// Nahkampf, Granaten und Raketen (Projektile), Zielhilfe, Deckung, Schiessen aus dem Auto,
// Treffereffekte (Funken, Einschusslöcher, Leuchtspur), Aufsammeln von Waffen.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WeaponInventory, weaponDef, computeDamage, WEAPON_META } from './weapondata.js';
import { events } from '../core/events.js';
import { tr } from '../core/i18n.js';
import { clamp } from '../core/mathutil.js';
import { WATER_Y } from '../world/terrain.js';
import { markShared } from '../core/dispose.js';

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- Waffenmodelle
// Je Waffe wird ein Vorlagemodell einmal gebaut; Kopien teilen Geometrie und Material
// (früher entstanden bei jedem Waffenwechsel/Pickup neue Geometrien → Speicherleck).
const modelCache = {};
const wmatCache = new Map();
function wmat(c) { if (!wmatCache.has(c)) wmatCache.set(c, markShared(new THREE.MeshLambertMaterial({ color: c }))); return wmatCache.get(c); }
export function makeWeaponModel(id) {
  if (!modelCache[id]) modelCache[id] = buildWeaponModel(id);
  return modelCache[id].clone();
}
function buildWeaponModel(id) {
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(markShared(new THREE.BoxGeometry(w, h, d)), wmat(c)); m.position.set(x, y, z); g.add(m); return m; };
  switch (id) {
    case 'knife': add(0.03, 0.03, 0.12, 0, 0, 0.02, 0x222222); add(0.01, 0.04, 0.22, 0, 0, 0.18, 0xcccccc); break;
    case 'bat': add(0.05, 0.05, 0.75, 0, 0, 0.3, 0x9b6b3a); add(0.08, 0.08, 0.3, 0, 0, 0.55, 0xa8784a); break;
    case 'pistol': add(0.04, 0.12, 0.08, 0, -0.04, 0, 0x222222); add(0.04, 0.05, 0.22, 0, 0.03, 0.08, 0x333333); break;
    case 'smg': add(0.05, 0.14, 0.08, 0, -0.05, 0, 0x222222); add(0.05, 0.07, 0.38, 0, 0.03, 0.12, 0x2c2c2c); add(0.04, 0.16, 0.05, 0, -0.08, 0.12, 0x111111); break;
    case 'shotgun': add(0.05, 0.08, 0.3, 0, 0, -0.05, 0x6b4a2a); add(0.04, 0.04, 0.7, 0, 0.03, 0.35, 0x333333); break;
    case 'rifle': add(0.05, 0.1, 0.3, 0, 0, -0.08, 0x2a2a2a); add(0.05, 0.07, 0.6, 0, 0.03, 0.3, 0x333333); add(0.04, 0.15, 0.06, 0, -0.08, 0.15, 0x111111); break;
    case 'sniper': add(0.05, 0.1, 0.35, 0, 0, -0.1, 0x3b3b2a); add(0.035, 0.035, 0.9, 0, 0.03, 0.45, 0x222222); add(0.05, 0.05, 0.25, 0, 0.1, 0.15, 0x111111); break;
    case 'grenade': { const m = new THREE.Mesh(markShared(new THREE.SphereGeometry(0.07, 8, 6)), wmat(0x3e4a2a)); g.add(m); break; }
    case 'rocket': add(0.12, 0.12, 1.1, 0, 0.05, 0.2, 0x4a5a32); add(0.06, 0.15, 0.06, 0, -0.06, 0.05, 0x222222); break;
    default: break;
  }
  g.rotation.x = Math.PI / 2; // Hand zeigt nach unten → Waffe nach vorne drehen
  g.position.y = -0.02;
  return g;
}

// ---------------------------------------------------------------- Treffer gegen Figuren
/** Strahl gegen Figur (Hitboxen in lokalen Koordinaten). Liefert {t, zone} oder null. */
export function rayCharacter(ch, ox, oy, oz, dx, dy, dz, maxT) {
  const p = ch.vehicle ? (ch.model ? ch.model.root.position : ch.pos) : ch.pos;
  const h = ch.heading || 0;
  const c = Math.cos(-h), s = Math.sin(-h);
  const rx = ox - p.x, ry = oy - p.y, rz = oz - p.z;
  // Drehung um -heading
  const lx = rx * c + rz * s, lz = -rx * s + rz * c;
  const ldx = dx * c + dz * s, ldz = -dx * s + dz * c;
  const sc = (ch.model && ch.model.look.scale) || 1;
  const k = (ch.crouch || ch.inCover ? 0.72 : 1) * sc;
  let boxes;
  if (ch.dead) boxes = [['body', -0.35, 0, -1.9, 0.35, 0.4, 0.1]];
  else if (ch.vehicle) boxes = [['head', -0.15, 1.2 * k, -0.15, 0.15, 1.5 * k, 0.15], ['body', -0.3, 0.5 * k, -0.2, 0.3, 1.2 * k, 0.2]];
  else boxes = [['head', -0.15, 1.55 * k, -0.15, 0.15, 1.86 * k, 0.15], ['body', -0.33, 0.9 * k, -0.2, 0.33, 1.55 * k, 0.2], ['legs', -0.26, 0, -0.17, 0.26, 0.9 * k, 0.17]];
  let best = null;
  for (const [zone, x0, y0, z0, x1, y1, z1] of boxes) {
    let tmin = 0, tmax = maxT;
    const axes = [[lx, ldx, x0, x1], [ry, dy, y0, y1], [lz, ldz, z0, z1]];
    let ok = true;
    for (const [o, d, mn, mx] of axes) {
      if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) { ok = false; break; }
    }
    if (ok && (!best || tmin < best.t)) best = { t: tmin, zone };
  }
  return best;
}

/** Strahl gegen Fahrzeug (OBB). Liefert {t, local} oder null. */
export function rayVehicle(v, ox, oy, oz, dx, dy, dz, maxT) {
  if (!v.size) return null;
  const inv = v.quat.clone().invert();
  const o = new THREE.Vector3(ox - v.pos.x, oy - v.pos.y, oz - v.pos.z).applyQuaternion(inv);
  const d = new THREE.Vector3(dx, dy, dz).applyQuaternion(inv);
  const [W, H, L] = v.size;
  const com = v.comHeight || 0.5;
  const mn = [-W / 2, -com + 0.15, -L / 2], mx = [W / 2, H - com, L / 2];
  let tmin = 0, tmax = maxT;
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < mn[i] || oo[i] > mx[i]) return null; continue; }
    let t1 = (mn[i] - oo[i]) / dd[i], t2 = (mx[i] - oo[i]) / dd[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmin <= 0) return null;
  return { t: tmin, local: o.addScaledVector(d, tmin) };
}

// Geteilte Geometrien/Materialien für Projektile und Pickups (einmal erzeugt, nie freigegeben).
let _res = null;
function sharedRes() {
  if (_res) return _res;
  const pm = new Map();
  _res = {
    grenadeGeo: markShared(new THREE.SphereGeometry(0.1, 8, 6)),
    grenadeMat: markShared(new THREE.MeshLambertMaterial({ color: 0x3e4a2a })),
    rocketGeo: markShared(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6).rotateX(Math.PI / 2)),
    rocketMat: markShared(new THREE.MeshLambertMaterial({ color: 0x556b2f, emissive: 0x331100 })),
    boxGeo: markShared(new THREE.BoxGeometry(0.35, 0.35, 0.35)),
    ringGeo: markShared(new THREE.RingGeometry(0.45, 0.55, 20).rotateX(-Math.PI / 2)),
    ringMat: markShared(new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6 })),
    pickupMat: (c) => { if (!pm.has(c)) pm.set(c, markShared(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 }))); return pm.get(c); },
  };
  return _res;
}

// ---------------------------------------------------------------- System
export class WeaponSystem {
  constructor(game) {
    this.game = game;
    game.weapons = this;
    this.makeModel = makeWeaponModel;
    const pl = game.player;
    pl.inventory = new WeaponInventory();
    this.reloading = 0;
    this.fireTimer = 0;
    this.bloom = 0;
    this.recoilAnim = 0;
    this.meleeAnim = 0;
    this.meleePending = 0;
    this.projectiles = [];
    this.pickups = [];
    this.lastCrime = -10;
    this.wheelOpen = false;
    this._setupDecals();
    this._setupTracers();
    this._equipModel();
    // Waffen-Pickups in der Welt verteilen
    const spots = [
      ['bat', 60, 150], ['pistol', -150, -100], ['knife', 420, 240], ['smg', 600, -300], ['shotgun', 780, 380],
      ['health', -60, -190], ['armor', 300, -320], ['health', 640, 60], ['grenade', 560, -460], ['rifle', 520, -700],
      ['sniper', 115, -862], ['rocket', 760, -760], ['armor', -480, 420], ['health', 250, 560], ['pistol', -520, -280],
    ];
    for (const [type, x, z] of spots) this.dropPickup(type, new THREE.Vector3(x, 0, z), null, true);
    events.on('player:died', () => { this.reloading = 0; });
  }

  current(ch) { return ch.inventory ? ch.inventory.current : null; }

  isScoped(ch) {
    const w = this.current(ch);
    return !!(w && w.def.scope && ch.aiming && !ch.vehicle);
  }

  _equipModel() {
    const pl = this.game.player;
    const w = pl.inventory.current;
    pl.model.setWeapon(w.id !== 'fist' ? makeWeaponModel(w.id) : null);
    this.reloading = 0;
  }

  // ---------------------------------------------------------------- Eingabe Spieler
  update(dt) {
    const g = this.game;
    const pl = g.player;
    const inp = g.input;
    const inv = pl.inventory;
    if (this.fireTimer > 0) this.fireTimer -= dt;
    this.bloom = Math.max(0, this.bloom - dt * 1.5);
    this.recoilAnim = Math.max(0, this.recoilAnim - dt * 6);
    this.meleeAnim = Math.max(0, this.meleeAnim - dt * 3);
    this._updateProjectiles(dt);
    this._updatePickups(dt);
    this._updateTracers(dt);
    if (pl.dead || g.paused) { pl.aiming = false; this._hudCrosshair(false); return; }

    // Waffenwechsel (nicht im Luftfahrzeug: dort gelten Bordwaffen, LB/Q steuern das Gieren)
    let changed = false;
    const inAircraft = !!(pl.vehicle && pl.vehicle.isAircraft);
    if (this.wheelOpen && inAircraft) { this.wheelOpen = false; g.ui.weaponWheel.close(); }
    for (let i = 0; i < 10 && !inAircraft; i++) if (inp.pressed('weapon' + i)) changed = inv.select(i === 0 ? 9 : i - 1) || changed;
    if (!inAircraft && inp.pressed('weaponNext')) { inv.cycle(1); changed = true; }
    if (!inAircraft && inp.pressed('weaponPrev')) { inv.cycle(-1); changed = true; }
    if (g.ui && g.ui.weaponWheel && !inAircraft) {
      if (inp.down('weaponWheel') && !this.wheelOpen) { this.wheelOpen = true; g.ui.weaponWheel.open(); }
      if (this.wheelOpen && !inp.down('weaponWheel')) { this.wheelOpen = false; const s = g.ui.weaponWheel.close(); if (s !== null && inv.select(s)) changed = true; }
      if (this.wheelOpen) g.ui.weaponWheel.update(inp);
    }
    if (changed) this._equipModel();

    const w = inv.current;
    const v = pl.vehicle;
    const canDriveBy = v && !v.isAircraft && !v.isBoat ? (w.def.type === 'gun' && (w.def.driveBy || w.id === 'pistol')) : v && v.isBoat ? w.def.type === 'gun' : false;
    // Zielen
    pl.aiming = !this.wheelOpen && inp.down('aim') && (!v || canDriveBy) && w.def.type !== 'throw' ? true : (!v && inp.down('aim') && w.def.type === 'throw');
    if (v && v.isAircraft) pl.aiming = false;
    // Deckung
    if (!v && inp.pressed('cover')) this.toggleCover(pl);
    if (pl.inCover && (v || pl.swimming)) pl.inCover = null;

    // Nachladen
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { inv.reload(); events.emit('weapon:reloaded', { shooter: pl }); }
    } else if ((inp.pressed('reload') && inv.canReload()) || ((w.def.type === 'gun' || w.def.type === 'projectile') && w.mag === 0 && w.ammo > 0)) {
      this.reloading = w.def.reload || 1.5;
      events.emit('weapon:reload', { shooter: pl, weapon: w.id });
    }

    // Feuern
    const trigger = !(g.carry && g.carry.held) && (w.def.auto ? inp.down('attack') : inp.pressed('attack'));
    if (trigger && this.fireTimer <= 0 && this.reloading <= 0 && !this.wheelOpen) {
      if (!v) this._playerFire(pl, w);
      else if (canDriveBy && pl.aiming) this._playerFire(pl, w);
    }
    // Nahkampf-Treffer kurz nach dem Schlag
    if (this.meleePending > 0) {
      this.meleePending -= dt;
      if (this.meleePending <= 0) this._meleeHit(pl, w);
    }
    // Waffenmodell im Auto ausblenden (ausser beim Drive-by)
    if (pl.model.weaponMesh) pl.model.weaponMesh.visible = !v || pl.aiming;
    this._hudCrosshair(pl.aiming && w.def.type !== 'melee');
  }

  _hudCrosshair(show) {
    const h = this.game.hud;
    if (!h) return;
    const scoped = show && this.isScoped(this.game.player);
    h.el.crosshair.classList.toggle('hidden', !show || scoped);
    h.el.scope.classList.toggle('hidden', !scoped);
    if (show && this._targetUnderCrosshair !== undefined) h.el.crosshair.classList.toggle('target', !!this._targetUnderCrosshair);
  }

  _playerFire(pl, w) {
    const g = this.game;
    const def = w.def;
    this.fireTimer = 1 / def.rate;
    if (def.type === 'melee') {
      this.meleeAnim = 1;
      this.meleePending = 0.12;
      if (pl.stamina !== undefined) pl.stamina = Math.max(0, pl.stamina - 6);
      events.emit('weapon:swing', { shooter: pl, weapon: w.id });
      return;
    }
    if (!pl.inventory.consume()) {
      events.emit('weapon:empty', { shooter: pl });
      return;
    }
    g.stats.shots++;
    const cam = g.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const muzzle = this._muzzlePos(pl);
    // Startpunkt: Kamera, aber vor der Spielfigur beginnen
    const origin = cam.position.clone();
    const tStart = Math.max(0, muzzle.clone().sub(origin).dot(dir));
    origin.addScaledVector(dir, tStart);
    if (def.type === 'throw') {
      const aimDir = dir.clone(); aimDir.y += 0.25; aimDir.normalize();
      this.spawnProjectile('grenade', muzzle, aimDir.multiplyScalar(def.throwSpeed).add(pl.vel ? pl.vel.clone().multiplyScalar(0.5) : new THREE.Vector3()), pl);
      events.emit('weapon:throw', { shooter: pl });
      if (w.mag <= 0 && w.ammo > 0) { w.ammo--; w.mag = 1; }
      return;
    }
    if (def.type === 'projectile') {
      // Ziel bestimmen und Rakete von der Mündung dorthin schicken
      const hit = this.traceFirst(origin, dir, def.range, pl);
      const target = hit ? hit.point : origin.clone().addScaledVector(dir, def.range);
      const d = target.clone().sub(muzzle).normalize();
      this.spawnProjectile('rocket', muzzle, d.multiplyScalar(def.speed), pl);
      this.recoilAnim = 1;
      g.camera3p.addShake(0.3);
      this._crime(muzzle);
      return;
    }
    // Streuung
    const moving = pl.vehicle ? 1.6 : Math.min(1.5, (pl.speed || 0) / 4) + 1;
    const stance = pl.crouch || pl.inCover ? 0.7 : 1;
    const aimBonus = pl.aiming ? 0.6 : 1.2;
    const spread = (def.spread + this.bloom * def.spread * 2) * moving * stance * aimBonus * (this.isScoped(pl) ? 0.1 : 1);
    // Zielhilfe
    let aimDir = dir;
    if (g.settings.autoAim && !this.isScoped(pl)) {
      const tgt = this.findAutoAimTarget(origin, dir, pl);
      if (tgt) aimDir = tgt;
    }
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const d = this._spreadDir(aimDir, spread);
      this.fireRay(pl, origin, d, def, muzzle);
    }
    this.bloom = Math.min(1, this.bloom + 0.25);
    this.recoilAnim = 1;
    // Rückstoss: Kamera nach oben
    g.camera3p.pitch -= def.recoil * (pl.crouch ? 0.6 : 1);
    g.camera3p.yaw += (Math.random() - 0.5) * def.recoil * 0.5;
    if (g.fx) g.fx.muzzle(muzzle);
    events.emit('weapon:fired', { shooter: pl, pos: muzzle, weapon: w.id });
    this._crime(muzzle);
  }

  _crime(pos) {
    if (this.game.elapsed - this.lastCrime > 2) {
      this.lastCrime = this.game.elapsed;
      events.emit('crime', { type: 'shooting', pos: pos.clone(), quiet: false });
    }
  }

  _spreadDir(dir, spread) {
    if (spread <= 0) return dir.clone();
    const r = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * spread);
    return dir.clone().add(r).normalize();
  }

  _muzzlePos(ch) {
    if (ch.vehicle) {
      const v = ch.vehicle;
      const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(v.mesh.quaternion);
      return (v.mesh ? v.mesh.position : v.pos).clone().add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(side, -((v.size ? v.size[0] : 2) / 2 + 0.3));
    }
    const h = ch.heading;
    return new THREE.Vector3(ch.pos.x + Math.sin(h) * 0.55 - Math.cos(h) * 0.25, ch.pos.y + (ch.crouch ? 1.1 : 1.42), ch.pos.z + Math.cos(h) * 0.55 + Math.sin(h) * 0.25);
  }

  /** Ziel für Auto-Aim (nächste feindliche/lebende Figur im Kegel). */
  findAutoAimTarget(origin, dir, shooter) {
    const A = CONFIG.autoAim;
    let best = null, bestScore = Infinity;
    for (const ch of this.game.allCharacters()) {
      if (ch === shooter || ch.dead || ch.isPlayer) continue;
      if (ch.faction === 'civil' && !ch.hostile && ch.kind !== 'mission') continue;
      const tp = (ch.vehicle ? ch.model.root.position : ch.pos).clone(); tp.y += ch.vehicle ? 0.9 : 1.25;
      const to = tp.clone().sub(origin);
      const d = to.length();
      if (d > A.maxDistance || d < 1) continue;
      to.divideScalar(d);
      const ang = Math.acos(clamp(to.dot(dir), -1, 1));
      if (ang > A.maxAngle) continue;
      const score = ang * 30 + d * 0.05;
      if (score < bestScore) {
        const hit = this.game.collision.raycast(origin.x, origin.y, origin.z, to.x, to.y, to.z, d, { includeTerrain: true });
        if (hit && hit.t < d - 0.5) continue;
        bestScore = score; best = to;
      }
    }
    this._targetUnderCrosshair = !!best;
    return best;
  }

  /** Erster Treffer entlang eines Strahls (statisch, Figuren, Fahrzeuge). */
  traceFirst(origin, dir, range, shooter = null) {
    const g = this.game;
    let best = null;
    const st = g.collision.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range, { includeTerrain: true });
    if (st) best = { kind: 'static', t: st.t, point: new THREE.Vector3(st.x, st.y, st.z), normal: new THREE.Vector3(st.nx, st.ny, st.nz), obj: st.obj, terrain: st.terrain };
    const lim = best ? best.t : range;
    for (const ch of g.allCharacters()) {
      if (ch === shooter) continue;
      if (ch.vehicle && ch.vehicle === shooter?.vehicle) continue;
      const cp = ch.pos;
      // Grobtest: Abstand Punkt-Strahl
      const tx = cp.x - origin.x, ty = cp.y + 1 - origin.y, tz = cp.z - origin.z;
      const along = tx * dir.x + ty * dir.y + tz * dir.z;
      if (along < 0 || along > lim + 2) continue;
      const px = tx - dir.x * along, py = ty - dir.y * along, pz = tz - dir.z * along;
      if (px * px + py * py + pz * pz > 4) continue;
      const r = rayCharacter(ch, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, best ? best.t : range);
      if (r && (!best || r.t < best.t)) best = { kind: 'char', t: r.t, zone: r.zone, ch, point: origin.clone().addScaledVector(dir, r.t) };
    }
    for (const v of g.vehicles.list) {
      if (shooter && shooter.vehicle === v) continue;
      const big = v.size ? Math.max(...v.size) : 3;
      if (v.pos.distanceToSquared(origin) > (range + big) ** 2) continue;
      const tx = v.pos.x - origin.x, ty = v.pos.y - origin.y, tz = v.pos.z - origin.z;
      const along = tx * dir.x + ty * dir.y + tz * dir.z;
      if (along < -big || along > (best ? best.t : range) + big) continue;
      const r = rayVehicle(v, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, best ? best.t : range);
      if (r && (!best || r.t < best.t)) best = { kind: 'vehicle', t: r.t, v, local: r.local, point: origin.clone().addScaledVector(dir, r.t) };
    }
    // Wasseroberfläche
    if (dir.y < 0 && origin.y > WATER_Y) {
      const tw = (WATER_Y - origin.y) / dir.y;
      if (tw < (best ? best.t : range)) best = { kind: 'water', t: tw, point: origin.clone().addScaledVector(dir, tw) };
    }
    return best;
  }

  /** Schuss entlang eines Strahls abfeuern (Spieler und NPC). */
  fireRay(shooter, origin, dir, def, muzzle) {
    const g = this.game;
    const hit = this.traceFirst(origin, dir, def.range, shooter);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, def.range);
    this.addTracer(muzzle || origin, end);
    if (!hit) return null;
    const dist = hit.t;
    if (hit.kind === 'char') {
      const dmg = computeDamage(def, hit.zone, dist);
      const ch = hit.ch;
      const wasAlive = !ch.dead;
      ch.damage(dmg, { type: 'bullet', source: shooter, zone: hit.zone, point: hit.point, dir });
      if (g.fx) g.fx.hit(hit.point, hit.zone === 'head' ? 9 : 5);
      if (shooter && shooter.isPlayer) {
        g.stats.hits++;
        if (g.hud) g.hud.hit(wasAlive && ch.dead);
        if (wasAlive && ch.dead) g.stats.kills++;
      }
      events.emit('weapon:hit', { shooter, target: ch, zone: hit.zone, point: hit.point });
    } else if (hit.kind === 'vehicle') {
      const v = hit.v;
      v.lastAttacker = shooter;
      v.damage(def.damage * 0.45, { type: 'bullet', source: shooter });
      if (g.fx) g.fx.sparks(hit.point, 5);
      // Reifen?
      const l = hit.local;
      if (v.wheels && v.wheels.length && l.y < -(v.comHeight || 0.5) + (v.def.wheelR || 0.35) * 1.8) {
        let wi = -1, wd = 0.8;
        v.wheels.forEach((w, i) => { const d = Math.hypot(l.x - w.local.x, l.z - w.local.z); if (d < wd) { wd = d; wi = i; } });
        if (wi >= 0 && Math.random() < 0.55 - (v.tuning ? v.tuning.tires * 0.15 : 0)) v.burstTire(wi);
      }
      // Insassen am Fenster treffen
      if (v.driver && l.y > 0.1 && Math.random() < 0.3 && !v.def.armored) v.driver.damage(def.damage * 0.8, { type: 'bullet', source: shooter, zone: 'body' });
      this.addDecal(hit.point, dir.clone().negate());
      events.emit('weapon:hitVehicle', { shooter, vehicle: v });
    } else if (hit.kind === 'static') {
      if (g.fx) { g.fx.sparks(hit.point, 4); g.fx.dust(hit.point, 2); }
      this.addDecal(hit.point, hit.normal);
      if (hit.obj && hit.obj.explosive && g.combat) { hit.obj.hp = (hit.obj.hp ?? 60) - def.damage; if (hit.obj.hp <= 0) g.combat.explodeProp(hit.obj, shooter); }
      events.emit('weapon:impact', { point: hit.point });
    } else if (hit.kind === 'water' && g.fx) g.fx.splash(hit.point, 5);
    return hit;
  }

  /** NPC schiesst auf ein Ziel (mit Treffergenauigkeit 0..1). */
  npcFire(npc, target, accuracy = 0.3) {
    const w = npc.inventory.current;
    const def = w.def;
    if (npc.fireCooldown > 0) return false;
    npc.fireCooldown = 1 / def.rate * (1 + Math.random() * 0.6);
    if (def.type === 'melee') {
      const d = npc.pos.distanceTo(target.pos);
      npc.meleeAnim = 1;
      if (d < def.range + 0.4) { target.damage(def.damage, { type: 'melee', source: npc, dir: target.pos.clone().sub(npc.pos).normalize() }); events.emit('weapon:punch', { shooter: npc }); }
      return true;
    }
    const muzzle = this._muzzlePos(npc);
    const tp = (target.vehicle ? (target.vehicle.renderPos || target.vehicle.pos) : target.pos).clone();
    tp.y += target.vehicle ? 0.8 : target.crouch || target.inCover ? 0.9 : 1.25;
    const dir = tp.sub(muzzle).normalize();
    // Deckung: Ziel in Deckung und nicht zielend → kaum Treffer
    let acc = accuracy;
    if (target.inCover && !target.aiming) acc *= 0.15;
    if (target.vehicle) acc *= 0.7;
    const miss = Math.random() > acc;
    const spread = miss ? 0.06 + Math.random() * 0.08 : def.spread * 0.5;
    if (def.type === 'projectile') {
      this.spawnProjectile('rocket', muzzle, this._spreadDir(dir, spread * 0.3).multiplyScalar(def.speed), npc);
    } else {
      const pellets = def.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const d = this._spreadDir(dir, spread);
        if (miss) { d.x += (Math.random() - 0.5) * 0.08; d.y += Math.random() * 0.05; d.normalize(); }
        this.fireRay(npc, muzzle, d, def, muzzle);
      }
    }
    if (this.game.fx) this.game.fx.muzzle(muzzle);
    events.emit('weapon:fired', { shooter: npc, pos: muzzle, weapon: w.id });
    return true;
  }

  // ---------------------------------------------------------------- Nahkampf
  _meleeHit(ch, w) {
    const g = this.game;
    const def = w.def;
    const f = new THREE.Vector3(Math.sin(ch.heading), 0, Math.cos(ch.heading));
    let hitSomething = false;
    for (const t of g.allCharacters()) {
      if (t === ch || t.dead || t.vehicle) continue;
      const d = t.pos.clone().sub(ch.pos); d.y = 0;
      const dist = d.length();
      if (dist > def.range + 0.3) continue;
      if (d.normalize().dot(f) < 0.4) continue;
      t.damage(def.damage, { type: 'melee', source: ch, dir: f, point: t.pos.clone().add(new THREE.Vector3(0, 1.3, 0)) });
      if (t.knockback) t.knockback(f.clone().multiplyScalar(def.knockback || 2.5).setY(1.5));
      if (g.fx) g.fx.hit(t.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 4);
      hitSomething = true;
      if (ch.isPlayer && g.hud) g.hud.hit(t.dead);
      if (ch.isPlayer && t.dead) g.stats.kills++;
    }
    if (!hitSomething) {
      for (const v of g.vehicles.list) {
        if (v.pos.distanceTo(ch.pos) < (v.size ? v.size[2] / 2 + 1 : 3) && w.id === 'bat') { v.damage(15, { type: 'melee', source: ch }); hitSomething = true; break; }
      }
    }
    events.emit('weapon:punch', { shooter: ch, hit: hitSomething, weapon: w.id });
    if (hitSomething && ch.isPlayer) events.emit('crime', { type: 'assault', pos: ch.pos.clone() });
  }

  // ---------------------------------------------------------------- Deckung
  toggleCover(pl) {
    if (pl.inCover) { pl.inCover = null; pl.crouch = false; return; }
    const col = this.game.collision;
    const list = col.query(pl.pos.x - 1.5, pl.pos.z - 1.5, pl.pos.x + 1.5, pl.pos.z + 1.5, []);
    let best = null, bd = 1.5;
    for (const b of list) {
      if (!b.solid || b.maxY < pl.pos.y + 0.9 || b.minY > pl.pos.y + 0.5) continue;
      const cx = clamp(pl.pos.x, b.minX, b.maxX), cz = clamp(pl.pos.z, b.minZ, b.maxZ);
      const d = Math.hypot(pl.pos.x - cx, pl.pos.z - cz);
      if (d < bd && d > 0.01) { bd = d; best = { box: b, nx: (pl.pos.x - cx) / d, nz: (pl.pos.z - cz) / d, cx, cz }; }
    }
    // Fahrzeuge als Deckung
    for (const v of this.game.vehicles.list) {
      if (!v.size || v.isAircraft) continue;
      const d = Math.hypot(v.pos.x - pl.pos.x, v.pos.z - pl.pos.z) - v.size[0] / 2;
      if (d < bd) { bd = d; const n = new THREE.Vector3(pl.pos.x - v.pos.x, 0, pl.pos.z - v.pos.z).normalize(); best = { vehicle: v, nx: n.x, nz: n.z }; }
    }
    if (!best) { if (this.game.hud) this.game.hud.notify('Keine Deckung in der Nähe'); return; }
    pl.inCover = best;
    pl.crouch = true;
    pl.heading = Math.atan2(-best.nx, -best.nz);
    events.emit('player:cover', { on: true });
  }

  // ---------------------------------------------------------------- Projektile
  spawnProjectile(type, pos, vel, owner) {
    const g = this.game;
    const R = sharedRes();
    const mesh = type === 'grenade' ? new THREE.Mesh(R.grenadeGeo, R.grenadeMat) : new THREE.Mesh(R.rocketGeo, R.rocketMat);
    mesh.position.copy(pos);
    g.scene.add(mesh);
    const def = type === 'grenade' ? weaponDef('grenade') : type === 'missile' ? CONFIG.weapons.missile : weaponDef('rocket');
    this.projectiles.push({ type, pos: pos.clone(), vel: vel.clone(), owner, mesh, age: 0, fuse: def.fuse || 6, def, range: def.range || 400 });
  }

  _updateProjectiles(dt) {
    const g = this.game;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      let explode = false;
      if (p.type === 'grenade') {
        p.vel.y -= CONFIG.physics.gravity * dt;
        const next = p.pos.clone().addScaledVector(p.vel, dt);
        const gh = g.collision.groundHeight(next.x, next.z, next.y + 0.3, 0.3).h;
        if (next.y < gh + 0.1) { next.y = gh + 0.1; p.vel.y *= -0.35; p.vel.x *= 0.6; p.vel.z *= 0.6; }
        const r = g.collision.resolveCircle(next.x, next.z, 0.1, next.y - 0.05, next.y + 0.05, 0);
        if (r.hit) { next.x = r.x; next.z = r.z; const vn = p.vel.x * r.nx + p.vel.z * r.nz; p.vel.x -= 1.5 * vn * r.nx; p.vel.z -= 1.5 * vn * r.nz; }
        p.pos.copy(next);
        if (p.age >= p.fuse) explode = true;
      } else {
        const step = p.vel.length() * dt;
        const dir = p.vel.clone().normalize();
        const hit = this.traceFirst(p.pos, dir, step + 0.5, p.owner);
        if (hit && hit.kind !== 'water') { p.pos.copy(hit.point); explode = true; }
        else if (hit && hit.kind === 'water') { p.pos.copy(hit.point); explode = true; }
        else p.pos.addScaledVector(p.vel, dt);
        if (p.age * p.vel.length() > p.range) explode = true;
        if (g.fx) { g.fx.smokePuff(p.pos, { dark: 0.2, life: 1.2, size: 0.4, a: 0.4 }); g.fx.fire(p.pos, 0.4); }
        p.mesh.lookAt(p.pos.clone().add(p.vel));
      }
      p.mesh.position.copy(p.pos);
      if (explode) {
        g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        if (g.combat) g.combat.explosion(p.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), p.def.radius || 8, p.def.damage || 200, p.owner);
      }
    }
  }

  // ---------------------------------------------------------------- Pickups
  /** Pickup ablegen (Waffe, 'health', 'armor', 'money'). */
  dropPickup(type, pos, ammo = null, respawn = false) {
    const g = this.game;
    const group = new THREE.Group();
    const R = sharedRes();
    if (WEAPON_META[type]) group.add(makeWeaponModel(type));
    else group.add(new THREE.Mesh(R.boxGeo, R.pickupMat(type === 'health' ? 0x4cd964 : type === 'armor' ? 0x5ac8fa : 0xf1c40f)));
    const ring = new THREE.Mesh(R.ringGeo, R.ringMat);
    ring.position.y = -0.6;
    group.add(ring);
    const y = g.collision.groundHeight(pos.x, pos.z, pos.y + 1.5, 1.5).h;
    group.position.set(pos.x, y + 0.7, pos.z);
    g.scene.add(group);
    const p = { type, pos: group.position.clone(), mesh: group, ammo, respawn, active: true, timer: 0, life: respawn ? Infinity : 60 };
    this.pickups.push(p);
    return p;
  }

  _updatePickups(dt) {
    const g = this.game;
    const pl = g.player;
    const t = g.elapsed;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!p.active) {
        p.timer -= dt;
        if (p.timer <= 0 && pl.pos.distanceTo(p.pos) > 30) { p.active = true; p.mesh.visible = true; }
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) { g.scene.remove(p.mesh); this.pickups.splice(i, 1); continue; }
      p.mesh.rotation.y = t * 2;
      p.mesh.position.y = p.pos.y + Math.sin(t * 3) * 0.08;
      if (pl.dead || pl.vehicle) continue;
      if (pl.pos.distanceTo(p.pos) < 1.4 || (Math.hypot(pl.pos.x - p.pos.x, pl.pos.z - p.pos.z) < 1.2 && Math.abs(pl.pos.y + 0.7 - p.pos.y) < 1.5)) {
        if (!this.collect(p)) continue;
        if (p.respawn) { p.active = false; p.mesh.visible = false; p.timer = 90; }
        else { g.scene.remove(p.mesh); this.pickups.splice(i, 1); }
      }
    }
  }

  collect(p) {
    const g = this.game;
    const pl = g.player;
    if (p.type === 'health') { if (pl.health >= 100) return false; pl.heal(50); g.hud.notify('+50 Gesundheit'); }
    else if (p.type === 'armor') { if (pl.armor >= 100) return false; pl.armor = 100; pl.model.setVest(true); g.hud.notify('Schutzweste angelegt'); }
    else if (p.type === 'money') { g.economy.add(p.ammo || 100, 'aufgesammelt'); }
    else {
      const prev = pl.inventory.current.id;
      pl.inventory.give(p.type, p.ammo);
      g.hud.notify(`Aufgesammelt: ${tr(WEAPON_META[p.type].name)}`);
      if (prev === 'fist') { pl.inventory.select(weaponDef(p.type).slot); this._equipModel(); }
    }
    events.emit('pickup', { type: p.type });
    return true;
  }

  // ---------------------------------------------------------------- Effekte
  _setupDecals() {
    const geo = new THREE.CircleGeometry(0.07, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
    this.decals = new THREE.InstancedMesh(geo, mat, 150);
    this.decals.count = 0;
    this.decals.frustumCulled = false;
    this.decalIndex = 0;
    this.game.scene.add(this.decals);
  }

  addDecal(point, normal) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
    m.compose(point.clone().addScaledVector(normal, 0.02), q, new THREE.Vector3(1, 1, 1));
    this.decals.setMatrixAt(this.decalIndex, m);
    this.decalIndex = (this.decalIndex + 1) % 150;
    this.decals.count = Math.max(this.decals.count, this.decalIndex);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  _setupTracers() {
    const max = 48;
    this.tracerPos = new Float32Array(max * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    this.tracerMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.8 }));
    this.tracerMesh.frustumCulled = false;
    this.game.scene.add(this.tracerMesh);
    this.tracers = [];
    this.tracerMax = max;
  }

  addTracer(a, b) {
    if (this.tracers.length >= this.tracerMax) this.tracers.shift();
    this.tracers.push({ a: a.clone(), b: b.clone(), t: 0.06 });
  }

  _updateTracers(dt) {
    let n = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr2 = this.tracers[i];
      tr2.t -= dt;
      if (tr2.t <= 0) { this.tracers.splice(i, 1); continue; }
    }
    for (const tr2 of this.tracers) {
      this.tracerPos.set([tr2.a.x, tr2.a.y, tr2.a.z, tr2.b.x, tr2.b.y, tr2.b.z], n * 6);
      n++;
    }
    this.tracerMesh.geometry.setDrawRange(0, n * 2);
    this.tracerMesh.geometry.attributes.position.needsUpdate = true;
  }

  mapBlips(out) {
    for (const p of this.pickups) if (p.active && p.respawn) out.push({ x: p.pos.x, z: p.pos.z, color: p.type === 'health' ? '#4cd964' : p.type === 'armor' ? '#5ac8fa' : '#ffd23f', size: 5 });
  }
}

export { _v, UP };
