// Kamera: Dritte-Person-Orbit (Maus/Stick), Kollision gegen Gebäude, Schulterblick beim Zielen,
// Zoom (Scharfschützengewehr), Verfolgerkamera im Fahrzeug, Ego-Perspektive, Flugkamera.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, angleDiff, lerp } from '../core/mathutil.js';

const C = CONFIG.camera;

export class ThirdPersonCamera {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = Math.PI;      // Blickrichtung (0 = +z/Süden)
    this.pitch = 0.15;       // positiv = nach unten schauen
    this.dist = C.distance;
    this.mode = 'third';     // 'third' | 'first' (nur Fahrzeug)
    this.fov = C.fov;
    this.shake = 0;
    this.lastMouse = 0;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.zoom = 1;
    this.cinematic = null;   // {pos, look} für Zwischensequenzen
  }

  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

  /**
   * @param {number} dt
   * @param {{x:number,y:number}} look Mausdelta
   * @param {object} ctx {focus:Vector3, aiming, scope, vehicle, aircraft, heading, speed, lookBehind}
   */
  update(dt, look, ctx) {
    const cam = this.camera;
    if (this.cinematic) {
      cam.position.lerp(this.cinematic.pos, 1 - Math.exp(-dt * 2));
      cam.lookAt(this.cinematic.look);
      this._setFov(C.fov, dt);
      return;
    }
    if (Math.abs(look.x) + Math.abs(look.y) > 0.0001) this.lastMouse = 0; else this.lastMouse += dt;
    const zoomMul = ctx.scope ? 0.25 : 1;
    this.yaw -= look.x * zoomMul;
    this.pitch = clamp(this.pitch + look.y * zoomMul, C.minPitch, C.maxPitch);

    const focus = ctx.focus;
    let dist, height, fov = C.fov, sideOffset = 0;
    if (ctx.vehicle) {
      const v = ctx.vehicle;
      const big = v.size ? Math.max(v.size[2], v.size[0]) : 5;
      dist = ctx.aircraft ? Math.max(C.aircraftDistance, big * 1.4) : Math.max(C.vehicleDistance, big * 1.25);
      height = ctx.aircraft ? 4 : Math.max(C.vehicleHeight, (v.size ? v.size[1] : 1.5) * 1.2);
      // Automatisch hinter das Fahrzeug drehen, wenn die Maus ruht
      if (this.lastMouse > 1.2 && !ctx.aiming) {
        const desired = ctx.heading + (ctx.lookBehind ? Math.PI : 0);
        const k = ctx.speed > 2 ? 3 : 0.8;
        this.yaw += angleDiff(this.yaw, desired) * Math.min(1, dt * k);
        this.pitch = damp(this.pitch, ctx.aircraft ? 0.12 : 0.2, 2, dt);
      }
      if (ctx.lookBehind) this.yaw = ctx.heading + Math.PI;
      fov = C.fov + Math.min(15, (ctx.speed || 0) * 0.18);
      if (this.mode === 'first' && !ctx.aircraft) {
        const p = ctx.firstPersonPos;
        cam.position.copy(p);
        const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        cam.lookAt(p.clone().add(dir));
        this._setFov(fov, dt);
        return;
      }
    } else if (ctx.aiming) {
      dist = C.aimDistance;
      height = 1.55;
      sideOffset = C.aimOffsetX;
      fov = ctx.scope ? C.sniperFov : C.aimFov;
    } else {
      dist = C.distance;
      height = ctx.crouch ? 1.15 : C.height;
    }
    this.dist = damp(this.dist, dist, 8, dt);

    this.target.set(focus.x, focus.y + height, focus.z);
    // Schulterversatz (rechts der Blickrichtung)
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    this.target.x += rx * sideOffset;
    this.target.z += rz * sideOffset;

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp); // vom Ziel zur Kamera
    let d = this.dist;
    // Kamera-Kollision
    const hit = this.collision.raycast(this.target.x, this.target.y, this.target.z, dir.x, dir.y, dir.z, d + 0.3, { onlySolid: true });
    if (hit) d = Math.max(0.35, hit.t - 0.3);
    this.pos.copy(this.target).addScaledVector(dir, d);
    // nicht unter den Boden
    const gh = this.collision.groundHeight(this.pos.x, this.pos.z, this.pos.y, 0).h;
    if (this.pos.y < gh + 0.3) this.pos.y = gh + 0.3;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.25;
      this.pos.x += (Math.random() - 0.5) * s; this.pos.y += (Math.random() - 0.5) * s; this.pos.z += (Math.random() - 0.5) * s;
    }
    cam.position.copy(this.pos);
    const lookAt = this.target.clone().addScaledVector(dir, -10);
    cam.lookAt(lookAt);
    this._setFov(fov, dt);
  }

  _setFov(fov, dt) {
    this.fov = damp(this.fov, fov, 10, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Richtung, in die die Kamera schaut (normiert). */
  forward(out = new THREE.Vector3()) {
    return this.camera.getWorldDirection(out);
  }

  toggleMode() { this.mode = this.mode === 'third' ? 'first' : 'third'; }
}

export { lerp };
