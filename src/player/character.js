// Low-Poly-Figur aus Box-Gliedern mit prozeduraler Animation.
// Wird für Spieler, Passanten, Polizei, Gangster und Soldaten verwendet.
// Animationen: Stehen, Gehen, Rennen, Springen/Fallen, Schwimmen, Ducken, Zielen/Schiessen,
// Ein-/Aussteigen (sitzen), Fallschirm, umfallen (vereinfachter Ragdoll).

import * as THREE from 'three';
import { markShared } from '../core/dispose.js';

const geoCache = {};
function boxGeo(w, h, d, pivotTop = true) {
  const key = `${w},${h},${d},${pivotTop}`;
  if (!geoCache[key]) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (pivotTop) g.translate(0, -h / 2, 0);
    geoCache[key] = markShared(g);
  }
  return geoCache[key];
}

const matCache = new Map();
export function charMat(hex) {
  if (!matCache.has(hex)) matCache.set(hex, markShared(new THREE.MeshLambertMaterial({ color: hex })));
  return matCache.get(hex);
}

export const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4423];
export const SHIRTS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x2c3e50, 0xecf0f1, 0x16a085, 0xd35400, 0x7f8c8d, 0xe84393];
export const PANTS = [0x2c3e50, 0x34495e, 0x1f2a36, 0x6d4c41, 0x7f8c8d, 0x22313f, 0x3d3d3d];
export const HAIR = [0x2b1d0e, 0x5a3a1a, 0x111111, 0xd4a017, 0x8b4513, 0x777777];

export class CharacterModel {
  /**
   * @param {{skin?:number, shirt?:number, pants?:number, hair?:number, hat?:number|null, vest?:boolean, scale?:number}} look
   */
  constructor(look = {}) {
    this.look = { skin: SKIN[0], shirt: SHIRTS[0], pants: PANTS[0], hair: HAIR[0], hat: null, vest: false, scale: 1, ...look };
    const L = this.look;
    const root = new THREE.Group();
    this.root = root;
    const body = new THREE.Group(); // dreht sich beim Umfallen/Schwimmen
    root.add(body);
    this.body = body;
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    body.add(hips);
    this.hips = hips;

    const torso = new THREE.Mesh(boxGeo(0.5, 0.62, 0.28, false), charMat(L.shirt));
    torso.position.y = 0.33;
    hips.add(torso);
    this.torso = torso;
    const pelvis = new THREE.Mesh(boxGeo(0.46, 0.14, 0.26, false), charMat(L.pants));
    pelvis.position.y = 0.0;
    hips.add(pelvis);
    const vest = new THREE.Mesh(boxGeo(0.54, 0.45, 0.32, false), charMat(0x3d4a2f));
    vest.position.y = 0.38;
    vest.visible = !!L.vest;
    hips.add(vest);
    this.vest = vest;

    const neck = new THREE.Group();
    neck.position.y = 0.66;
    hips.add(neck);
    this.neck = neck;
    const head = new THREE.Mesh(boxGeo(0.26, 0.28, 0.26, false), charMat(L.skin));
    head.position.y = 0.16;
    neck.add(head);
    this.head = head;
    const hair = new THREE.Mesh(boxGeo(0.28, 0.08, 0.28, false), charMat(L.hat ?? L.hair));
    hair.position.y = 0.31;
    neck.add(hair);
    this.hair = hair;
    if (L.hat) {
      const brim = new THREE.Mesh(boxGeo(0.3, 0.03, 0.4, false), charMat(L.hat));
      brim.position.set(0, 0.28, 0.06);
      neck.add(brim);
    }
    // Augen (Blickrichtung erkennbar)
    const eyeM = charMat(0x111111);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(boxGeo(0.04, 0.04, 0.02, false), eyeM);
      eye.position.set(0.06 * s, 0.19, 0.135);
      neck.add(eye);
    }

    const limb = (x, y, w, h, color) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const upper = new THREE.Mesh(boxGeo(w, h, w), charMat(color));
      pivot.add(upper);
      return pivot;
    };
    this.armL = limb(-0.32, 0.6, 0.14, 0.62, L.shirt);
    this.armR = limb(0.32, 0.6, 0.14, 0.62, L.shirt);
    // Hände
    for (const a of [this.armL, this.armR]) {
      const hand = new THREE.Mesh(boxGeo(0.12, 0.12, 0.12), charMat(L.skin));
      hand.position.y = -0.6;
      a.add(hand);
    }
    this.legL = limb(-0.12, 0.0, 0.18, 0.92, L.pants);
    this.legR = limb(0.12, 0.0, 0.18, 0.92, L.pants);
    for (const l of [this.legL, this.legR]) {
      const shoe = new THREE.Mesh(boxGeo(0.2, 0.08, 0.28), charMat(0x1a1a1a));
      shoe.position.set(0, -0.88, 0.04);
      l.add(shoe);
    }
    hips.add(this.armL, this.armR, this.legL, this.legR);

    // Waffenhalter in der rechten Hand
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.6, 0.05);
    this.armR.add(this.hand);
    this.weaponMesh = null;

    // Fallschirm
    this.chute = null;

    root.scale.setScalar(L.scale);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.phase = Math.random() * 10;
    this.state = 'idle';
    this.fallAngle = 0;
  }

  setShirt(hex) { this.torso.material = charMat(hex); this.armL.children[0].material = charMat(hex); this.armR.children[0].material = charMat(hex); this.look.shirt = hex; }
  setPants(hex) { for (const l of [this.legL, this.legR]) l.children[0].material = charMat(hex); this.look.pants = hex; }
  setHair(hex) { this.hair.material = charMat(hex); this.look.hair = hex; }
  setVest(v) { this.vest.visible = v; }

  /** Waffenmodell in die Hand setzen (null = keins). */
  setWeapon(mesh) {
    if (this.weaponMesh) this.hand.remove(this.weaponMesh);
    this.weaponMesh = mesh;
    if (mesh) this.hand.add(mesh);
  }

  setChute(on) {
    if (on && !this.chute) {
      const g = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), charMat(0xe74c3c));
      canopy.scale.set(1.3, 0.5, 0.9);
      canopy.position.y = 4.5;
      g.add(canopy);
      const lineM = new THREE.LineBasicMaterial({ color: 0x333333 });
      const pts = [];
      for (const [x, z] of [[-2.5, -1.5], [2.5, -1.5], [-2.5, 1.5], [2.5, 1.5]]) pts.push(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(x, 4.6, z));
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineM));
      this.chute = g;
      this.root.add(g);
    } else if (!on && this.chute) {
      this.root.remove(this.chute);
      this.chute = null;
    }
  }

  /**
   * Animation aktualisieren.
   * @param {number} dt
   * @param {{speed:number, state:string, aim:boolean, aimPitch?:number, crouch?:boolean, recoil?:number}} s
   */
  animate(dt, s) {
    const speed = s.speed || 0;
    this.phase += dt * (2 + speed * 1.9);
    const ph = this.phase;
    let legSwing = 0, armSwing = 0, hipsY = 0.95, bodyPitch = 0, bodyRoll = 0;
    let armLX = 0, armRX = 0, armLZ = 0.06, armRZ = -0.06, legLX = 0, legRX = 0;
    const st = s.state;
    if (st === 'dead') {
      // vereinfachter Ragdoll: zur Seite kippen
      this.fallAngle = Math.min(Math.PI / 2, this.fallAngle + dt * 5);
      this.body.rotation.x = -this.fallAngle;
      this.body.position.y = Math.sin(this.fallAngle) * 0.15;
      this.armL.rotation.set(-2.6, 0, 0.6); this.armR.rotation.set(-2.4, 0, -0.5);
      this.legL.rotation.set(0.2, 0, 0.1); this.legR.rotation.set(-0.1, 0, -0.1);
      return;
    }
    this.fallAngle = 0;
    this.body.position.y = 0;
    switch (st) {
      case 'walk': case 'run': case 'sprint': {
        const amp = Math.min(1, 0.35 + speed * 0.11);
        legSwing = Math.sin(ph) * amp;
        armSwing = Math.sin(ph) * amp * 0.9;
        hipsY = 0.95 + Math.abs(Math.cos(ph)) * 0.04 * amp;
        bodyPitch = speed > 6 ? 0.18 : speed > 3 ? 0.08 : 0;
        break;
      }
      case 'jump': case 'fall':
        legLX = -0.5; legRX = 0.3; armLX = -2.4; armRX = -2.2; armLZ = 0.5; armRZ = -0.5;
        break;
      case 'swim':
        bodyPitch = 1.25;
        hipsY = 0.75;
        armLX = -2.6 + Math.sin(ph * 0.8) * 1.2; armRX = -2.6 - Math.sin(ph * 0.8) * 1.2;
        legLX = Math.sin(ph * 1.6) * 0.4; legRX = -Math.sin(ph * 1.6) * 0.4;
        break;
      case 'sit':
        hipsY = 0.55; legLX = -1.45; legRX = -1.45; armLX = -0.9; armRX = -0.9;
        break;
      case 'chute':
        legLX = -0.3; legRX = -0.2; armLX = -2.9; armRX = -2.9; armLZ = 0.3; armRZ = -0.3;
        break;
      case 'talk':
        armLX = Math.sin(ph * 0.7) * 0.3 - 0.3; armRX = Math.cos(ph * 0.9) * 0.4 - 0.5;
        break;
      case 'cower':
        hipsY = 0.55; legLX = -1.2; legRX = -1.2; armLX = -2.4; armRX = -2.4; bodyPitch = 0.5;
        break;
      case 'hands':
        armLX = -2.9; armRX = -2.9; armLZ = 0.2; armRZ = -0.2;
        break;
      case 'punch':
        armRX = -1.5 - Math.max(0, Math.sin(ph * 3)) * 0.3; armLX = -1.1;
        break;
      default: // idle
        armSwing = Math.sin(ph * 0.4) * 0.03;
        hipsY = 0.95 + Math.sin(ph * 0.5) * 0.005;
    }
    if (s.crouch && st !== 'swim') { hipsY -= 0.35; legLX -= 0.9; legRX -= 0.9; bodyPitch += 0.25; }
    legLX += legSwing; legRX -= legSwing;
    armLX += -armSwing; armRX += armSwing;
    if (s.aim) {
      const p = s.aimPitch || 0;
      armRX = -Math.PI / 2 - p - (s.recoil || 0) * 0.6;
      armRZ = 0;
      if (s.twoHanded) { armLX = -Math.PI / 2 - p + 0.15; armLZ = -0.45; }
      this.neck.rotation.x = -p * 0.6;
    } else this.neck.rotation.x = 0;
    if (s.melee > 0) armRX = -1.2 - Math.sin(s.melee * Math.PI) * 1.2;
    this.hips.position.y = hipsY;
    this.hips.rotation.x = bodyPitch;
    this.hips.rotation.z = bodyRoll;
    this.body.rotation.x = 0;
    this.legL.rotation.set(legLX, 0, 0);
    this.legR.rotation.set(legRX, 0, 0);
    this.armL.rotation.set(armLX, 0, armLZ);
    this.armR.rotation.set(armRX, 0, armRZ);
    // Schwimmen: Körper waagrecht
    if (st === 'swim') { this.body.rotation.x = 0; }
  }

  /** Trefferzone aus lokaler Höhe (Meter über den Füssen). */
  static zoneFromHeight(h, crouch = false) {
    const k = crouch ? 0.7 : 1;
    if (h > 1.5 * k) return 'head';
    if (h > 0.9 * k) return 'body';
    return 'legs';
  }
}
