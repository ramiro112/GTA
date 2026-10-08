// Trümmer: umgefahrene Requisiten fliegen als einfache Starrkörper weg und bleiben liegen.

import * as THREE from 'three';
import { propMesh } from '../world/props.js';

export class Debris {
  constructor(game) {
    this.game = game;
    game.debris = this;
    this.items = [];
    this.max = 40;
  }

  /** Trümmerteil aus einem zerstörten Requisit erzeugen. */
  spawn(rec, vel) {
    const mesh = propMesh(rec.type);
    mesh.scale.set(rec.scale * rec.lenScale, rec.scale, rec.scale);
    mesh.position.set(rec.x, rec.y, rec.z);
    mesh.rotation.y = rec.rot;
    this.game.scene.add(mesh);
    const it = { mesh, vel: vel.clone(), ang: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6), age: 0, rest: false };
    this.items.push(it);
    if (this.items.length > this.max) this._kill(this.items.shift());
  }

  _kill(it) { this.game.scene.remove(it.mesh); }

  update(dt) {
    const g = this.game;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age > 45) { this._kill(it); this.items.splice(i, 1); continue; }
      if (it.rest) continue;
      it.vel.y -= g.collision ? 15 * dt : 0;
      it.mesh.position.addScaledVector(it.vel, dt);
      it.mesh.rotation.x += it.ang.x * dt;
      it.mesh.rotation.y += it.ang.y * dt;
      it.mesh.rotation.z += it.ang.z * dt;
      const p = it.mesh.position;
      const gh = g.collision.groundHeight(p.x, p.z, p.y + 0.5, 0.5).h;
      if (p.y < gh) {
        p.y = gh;
        it.vel.y *= -0.25;
        it.vel.x *= 0.6; it.vel.z *= 0.6;
        it.ang.multiplyScalar(0.5);
        // liegend ausrichten
        if (it.vel.lengthSq() < 0.5) {
          it.rest = true;
          it.mesh.rotation.x = Math.PI / 2 * Math.sign(it.mesh.rotation.x || 1);
          it.mesh.rotation.z = 0;
          it.mesh.position.y = gh + 0.15;
        }
      }
    }
  }
}
