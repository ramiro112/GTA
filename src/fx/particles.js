// Partikelsystem (gepoolt, GPU-Punkte mit eigenem Shader): Rauch, Feuer, Funken, Explosionen,
// Staub, Wasserspritzer, stilisierte Treffer (jugendfreundlich: rote/graue Partikel statt Blut).

import * as THREE from 'three';

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = alpha;
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (420.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  if (gl_FragColor.a < 0.01) discard;
}`;

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

class ParticleLayer {
  constructor(scene, max, blending, tex) {
    this.max = max;
    this.count = 0;
    this.p = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }

  update(dt) {
    const arr = this.p;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i];
      q.age += dt;
      if (q.age >= q.life) continue;
      q.vy -= q.grav * dt;
      q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * dt; q.vz *= 1 - q.drag * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor !== undefined && q.y < q.floor) { q.y = q.floor; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
      arr[w++] = q;
    }
    arr.length = w;
    for (let i = 0; i < w; i++) {
      const q = arr[i];
      const t = q.age / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      const c0 = q.c0, c1 = q.c1;
      this.col[i * 3] = c0[0] + (c1[0] - c0[0]) * t;
      this.col[i * 3 + 1] = c0[1] + (c1[1] - c0[1]) * t;
      this.col[i * 3 + 2] = c0[2] + (c1[2] - c0[2]) * t;
      this.alpha[i] = q.a * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      this.size[i] = q.s0 + (q.s1 - q.s0) * t;
    }
    this.geo.setDrawRange(0, w);
    for (const k of ['position', 'pcolor', 'alpha', 'size']) this.geo.attributes[k].needsUpdate = true;
  }
}

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

export class Particles {
  constructor(scene, density = 1) {
    const tex = makeSprite();
    this.density = density;
    this.smoke = new ParticleLayer(scene, Math.floor(1800 * density) + 200, THREE.NormalBlending, tex);
    this.glow = new ParticleLayer(scene, Math.floor(1800 * density) + 200, THREE.AdditiveBlending, tex);
    this.scene = scene;
    // Ein gepooltes Licht für Explosionen / Mündungsfeuer
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 40, 2);
    scene.add(this.flashLight);
    this.flashT = 0;
  }

  _p(layer, x, y, z, o) {
    layer.spawn({ x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, age: 0, life: o.life || 1, grav: o.grav || 0, drag: o.drag || 0,
      c0: rgb(o.c0 ?? 0xffffff), c1: rgb(o.c1 ?? o.c0 ?? 0xffffff), a: o.a ?? 1, s0: o.s0 ?? 0.5, s1: o.s1 ?? o.s0 ?? 0.5, floor: o.floor });
  }

  rnd(a) { return (Math.random() - 0.5) * 2 * a; }

  smokePuff(pos, opts = {}) {
    if (Math.random() > this.density) return;
    const dark = opts.dark ?? 0.5;
    const c = Math.floor(200 - dark * 170);
    const col = (c << 16) | (c << 8) | c;
    this._p(this.smoke, pos.x + this.rnd(0.3), pos.y, pos.z + this.rnd(0.3), { vx: this.rnd(0.4) + (opts.wind || 0), vy: 1.2 + Math.random(), vz: this.rnd(0.4), life: opts.life || 2.5, c0: col, c1: col, a: opts.a ?? 0.55, s0: opts.size || 0.8, s1: (opts.size || 0.8) * 3.5, drag: 0.4 });
  }

  fire(pos, scale = 1) {
    if (Math.random() > this.density) return;
    this._p(this.glow, pos.x + this.rnd(0.4 * scale), pos.y + this.rnd(0.2), pos.z + this.rnd(0.4 * scale), { vy: 1.5 + Math.random() * 2, vx: this.rnd(0.3), vz: this.rnd(0.3), life: 0.5 + Math.random() * 0.4, c0: 0xffd27a, c1: 0xff3a00, a: 0.9, s0: 0.9 * scale, s1: 0.2 * scale });
  }

  sparks(pos, n = 8, color = 0xffd27a) {
    for (let i = 0; i < n; i++) this._p(this.glow, pos.x, pos.y, pos.z, { vx: this.rnd(5), vy: Math.random() * 4, vz: this.rnd(5), grav: 12, life: 0.25 + Math.random() * 0.3, c0: color, c1: 0xff5500, s0: 0.15, s1: 0.05 });
  }

  /** Treffer an Figur (stilisiert: kleine dunkelrote Wölkchen). */
  hit(pos, n = 6) {
    for (let i = 0; i < n; i++) this._p(this.smoke, pos.x, pos.y, pos.z, { vx: this.rnd(1.5), vy: Math.random() * 1.5, vz: this.rnd(1.5), grav: 6, life: 0.4 + Math.random() * 0.3, c0: 0x9a1010, c1: 0x5a0a0a, a: 0.8, s0: 0.25, s1: 0.1 });
  }

  dust(pos, n = 6, color = 0xb8a888) {
    for (let i = 0; i < n; i++) this._p(this.smoke, pos.x, pos.y, pos.z, { vx: this.rnd(1.5), vy: Math.random() * 1.2, vz: this.rnd(1.5), drag: 1.5, life: 0.8 + Math.random() * 0.6, c0: color, a: 0.5, s0: 0.4, s1: 1.4 });
  }

  splash(pos, n = 14) {
    for (let i = 0; i < n; i++) this._p(this.smoke, pos.x, pos.y, pos.z, { vx: this.rnd(2.5), vy: 3 + Math.random() * 4, vz: this.rnd(2.5), grav: 14, life: 0.8, c0: 0xdff2ff, a: 0.75, s0: 0.35, s1: 0.15 });
  }

  muzzle(pos) {
    this._p(this.glow, pos.x, pos.y, pos.z, { life: 0.06, c0: 0xfff2a0, c1: 0xff9a20, s0: 0.7, s1: 0.4 });
    this.flash(pos, 1.5, 0.05);
  }

  explosion(pos, scale = 1) {
    const n = Math.floor(40 * scale * this.density) + 10;
    for (let i = 0; i < n; i++) {
      const sp = 6 + Math.random() * 10;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - 0.3;
      this._p(this.glow, pos.x, pos.y + 0.5, pos.z, { vx: Math.cos(a) * Math.cos(b) * sp * scale, vy: Math.abs(Math.sin(b)) * sp * scale, vz: Math.sin(a) * Math.cos(b) * sp * scale, drag: 3, life: 0.5 + Math.random() * 0.6, c0: 0xfff0a0, c1: 0xff2a00, s0: 3 * scale, s1: 1.2 * scale });
    }
    for (let i = 0; i < n; i++) this._p(this.smoke, pos.x + this.rnd(2), pos.y + Math.random() * 2, pos.z + this.rnd(2), { vx: this.rnd(3), vy: 2 + Math.random() * 4, vz: this.rnd(3), drag: 1.2, life: 2.5 + Math.random() * 2, c0: 0x333333, c1: 0x777777, a: 0.7, s0: 2 * scale, s1: 7 * scale });
    this.sparks(pos, 20);
    this.flash(pos, 8 * scale, 0.35);
  }

  flash(pos, intensity, dur) {
    this.flashLight.position.copy(pos);
    this.flashLight.position.y += 1;
    this.flashLight.intensity = intensity * 30;
    this.flashT = dur;
    this.flashDur = dur;
    this.flashI = intensity * 30;
  }

  update(dt) {
    this.smoke.update(dt);
    this.glow.update(dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashLight.intensity = Math.max(0, this.flashI * (this.flashT / this.flashDur));
    } else this.flashLight.intensity = 0;
  }
}
