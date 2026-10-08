// Himmel, Sonne/Mond, Sterne, Wolken, Nebel, Licht, Wasser, Regen und Blitze.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WATER_Y } from './terrain.js';
import { makeWaterNormal, makeRadial } from './textures.js';
import { lerp, clamp } from '../core/mathutil.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 bottomColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunSize;
uniform float cloud;
uniform float time;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizonColor, bottomColor, clamp(-h * 4.0, 0.0, 1.0));
  float sd = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(sd, 900.0 / sunSize) * 3.0 + pow(sd, 12.0) * 0.25);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.15) * 1.6 + vec2(time * 0.004, time * 0.002);
    float c = fbm(uv);
    float cov = smoothstep(1.0 - cloud * 0.85 - 0.15, 1.0, c + cloud * 0.35);
    vec3 cloudCol = mix(horizonColor * 1.1, vec3(1.0), 0.5) * (1.0 - cloud * 0.45);
    col = mix(col, cloudCol, cov * smoothstep(0.0, 0.15, h) * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.time = 0;
    this.lightning = 0;
    this.lightningTimer = 5;
    this._build();
  }

  _build() {
    const s = this.scene;
    // Himmelskuppel
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x3a7bd5) },
      horizonColor: { value: new THREE.Color(0xbcd6f0) },
      bottomColor: { value: new THREE.Color(0x6a8aa8) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(0xfff2d0) },
      sunSize: { value: 1 },
      cloud: { value: 0.2 },
      time: { value: 0 },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    s.add(sky);
    this.sky = sky;

    // Sterne
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 1500; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      if (u < 0.05) continue;
      sp.push(Math.cos(a) * r * 2800, u * 2800, Math.sin(a) * r * 2800);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    s.add(this.stars);

    // Mond
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0xe8ecf4, fog: false, transparent: true }));
    this.moon.frustumCulled = false;
    s.add(this.moon);

    // Licht
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5040, 0.9);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = this.quality.shadows;
    if (this.quality.shadows) {
      this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
      const c = this.sun.shadow.camera;
      c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 1; c.far = 600;
      this.sun.shadow.bias = -0.0008;
      this.sun.shadow.normalBias = 0.6;
    }
    s.add(this.sun);
    s.add(this.sun.target);

    // Nebel
    s.fog = new THREE.Fog(0xbcd6f0, 200, this.quality.drawDistance);

    // Wasser
    const wn = makeWaterNormal();
    wn.repeat.set(160, 160);
    this.waterNormal = wn;
    this.waterMat = new THREE.MeshPhongMaterial({ color: 0x1f5f7a, specular: 0x9fc8e0, shininess: 80, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.88 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1), this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    water.receiveShadow = true;
    water.renderOrder = 1;
    s.add(water);
    this.water = water;

    // Regen (Linien um die Kamera)
    const N = Math.floor(5000 * this.quality.particles);
    const rp = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80;
      rp.set([x, y, z, x + 0.05, y - 0.8, z], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.rainPositions = rp;
    this.rainCount = N;
    s.add(this.rain);

    // Blitz-Licht
    this.flash = new THREE.AmbientLight(0xdde6ff, 0);
    s.add(this.flash);
    this.glowTex = makeRadial();
  }

  /**
   * @param {number} dt
   * @param {import('./timeweather.js').TimeOfDay} tod
   * @param {import('./timeweather.js').Weather} weather
   * @param {THREE.Vector3} camPos
   * @param {(name:string)=>void} onThunder Callback für Donnergeräusch
   */
  update(dt, tod, weather, camPos, focus, onThunder) {
    this.time += dt;
    const sh = tod.sunHeight;
    const ang = ((tod.hour - 6) / 24) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const w = weather.state;
    const day = clamp((sh + 0.15) / 0.5, 0, 1);
    const dusk = clamp(1 - Math.abs(sh) / 0.3, 0, 1) * (sh > -0.2 ? 1 : 0);
    const dark = w.darkness;

    // Himmelsfarben
    const top = new THREE.Color().setHSL(0.62, 0.6, lerp(0.06, 0.45, day));
    const hor = new THREE.Color().setHSL(0.6, 0.35, lerp(0.13, 0.78, day));
    hor.lerp(new THREE.Color(0xff8a50), dusk * 0.55);
    const grey = new THREE.Color().setHSL(0.6, 0.08, lerp(0.05, 0.55, day));
    top.lerp(grey, dark); hor.lerp(grey, dark * 0.9);
    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.horizonColor.value.copy(hor);
    this.skyUniforms.bottomColor.value.copy(hor).multiplyScalar(0.7);
    this.skyUniforms.sunDir.value.copy(sunDir);
    this.skyUniforms.sunColor.value.setRGB(1, lerp(0.55, 0.95, day), lerp(0.3, 0.85, day)).multiplyScalar((sh > -0.05 ? 1 : 0) * (1 - dark * 0.85));
    this.skyUniforms.cloud.value = w.cloud;
    this.skyUniforms.time.value = this.time;
    this.sky.position.copy(camPos);
    this.stars.position.copy(camPos);
    this.starMat.opacity = clamp(-sh * 3, 0, 1) * (1 - w.cloud * 0.9);
    const moonDir = sunDir.clone().negate();
    this.moon.position.copy(camPos).addScaledVector(moonDir, 2600);
    this.moon.lookAt(camPos);
    this.moon.material.opacity = clamp(-sh * 4, 0, 1) * (1 - w.cloud * 0.8);

    // Licht
    const sunI = clamp(sh * 3, 0, 1) * (1 - dark * 0.75);
    const moonI = clamp(-sh * 3, 0, 1) * 0.45 * (1 - dark * 0.5);
    this.sun.intensity = sunI * 2.4 + moonI;
    this.sun.color.setRGB(1, lerp(0.7, 1, day), lerp(0.5, 0.95, day));
    if (sh < 0) this.sun.color.setHex(0x8fa8d8);
    const lightDir = sh > -0.02 ? sunDir : moonDir;
    this.sun.position.copy(focus).addScaledVector(lightDir, 300);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = lerp(0.42, 0.95, day) * (1 - dark * 0.3);
    this.hemi.color.copy(hor).lerp(new THREE.Color(0xffffff), 0.3);
    this.hemi.groundColor.setHex(0x4a4436).multiplyScalar(lerp(0.6, 1, day));

    // Nebel
    const dd = this.quality.drawDistance;
    const fogFar = lerp(dd, Math.min(dd, 140), w.fog);
    this.scene.fog.near = lerp(fogFar * 0.35, 10, w.fog);
    this.scene.fog.far = fogFar;
    this.scene.fog.color.copy(hor);
    this.renderer.setClearColor(hor);

    // Wasser
    this.waterNormal.offset.x += dt * 0.004 * (1 + w.wind);
    this.waterNormal.offset.y += dt * 0.002;
    this.waterMat.color.setHSL(0.54, 0.6, lerp(0.05, 0.28, day) * (1 - dark * 0.4));
    this.water.position.x = Math.round(camPos.x / 100) * 100;
    this.water.position.z = Math.round(camPos.z / 100) * 100;

    // Regen
    const rainI = w.rain;
    this.rainMat.opacity = rainI * 0.55;
    this.rain.visible = rainI > 0.02;
    if (this.rain.visible) {
      const p = this.rainPositions;
      const fall = dt * 38;
      const windX = w.wind * dt * 6;
      for (let i = 0; i < this.rainCount; i++) {
        const o = i * 6;
        p[o + 1] -= fall; p[o + 4] -= fall; p[o] += windX; p[o + 3] += windX;
        if (p[o + 1] < -2) {
          const x = (Math.random() - 0.5) * 80, y = 30 + Math.random() * 10, z = (Math.random() - 0.5) * 80;
          p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x + 0.05 + w.wind * 0.3; p[o + 4] = y - 0.9; p[o + 5] = z;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(camPos.x, camPos.y - 15, camPos.z);
    }

    // Blitze
    if (w.lightning > 0.5) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightning = 1;
        this.lightningTimer = 4 + Math.random() * 10;
        setTimeout(() => onThunder && onThunder(), 300 + Math.random() * 1500);
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 4);
    this.flash.intensity = this.lightning > 0 ? (Math.sin(this.lightning * 40) > 0 ? 2.5 : 0.6) * this.lightning : 0;
  }

  setQuality(q) {
    this.quality = q;
    this.sun.castShadow = q.shadows;
  }
}
