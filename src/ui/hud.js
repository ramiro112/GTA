// HUD: Gesundheit, Rüstung, Ausdauer, Geld, Waffe/Munition, Fahndungssterne, Uhrzeit, Minimap,
// Missionsziel, Timer, Tacho, Fluginstrumente, Hinweise, Meldungen, Fadenkreuz.

import { t, tr } from '../core/i18n.js';
import { formatMoney, formatTime } from '../core/mathutil.js';
import { districtAt } from '../world/terrain.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    root.insertAdjacentHTML('beforeend', `
<div id="hud" class="hidden">
  <div id="damage-vignette"></div>
  <div id="scope" class="hidden"></div>
  <div id="crosshair" class="hidden"><div class="dot hidden"></div></div>
  <div id="hitmarker"></div>
  <div id="hud-topright">
    <div id="hud-clock">09:00</div>
    <div id="hud-money">$0</div>
    <div id="hud-weapon"><span class="ammo"></span><span class="icon">✊</span></div>
    <div id="hud-stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>
  </div>
  <div id="hud-help" class="hidden"></div>
  <div id="hud-notify"></div>
  <div id="hud-timer" class="hidden"></div>
  <div id="hud-objective"></div>
  <div id="hud-prompt" class="hidden"></div>
  <div id="progress-action" class="hidden"><div class="label"></div><div class="progress"><div></div></div></div>
  <div id="hud-center-msg" class="hidden"></div>
  <div id="radio"></div>
  <div id="dialog" class="hidden"></div>
  <div id="speedo" class="hidden"><div class="v">0</div><div class="u">km/h</div><div class="sub"></div><div class="bar vhealth health"><div></div></div></div>
  <div id="instruments" class="hidden"></div>
  <div id="minimap-wrap">
    <canvas id="minimap" width="230" height="230"></canvas>
    <div class="bars"><div class="bar health"><div></div></div><div class="bar armor"><div></div></div></div>
    <div class="bars"><div class="bar stamina"><div></div></div></div>
  </div>
  <div id="hud-area"></div>
  <div id="fps" class="hidden"></div>
</div>`);
    this.el = {
      hud: $('hud'), clock: $('hud-clock'), money: $('hud-money'), weaponIcon: document.querySelector('#hud-weapon .icon'), ammo: document.querySelector('#hud-weapon .ammo'),
      stars: $('hud-stars'), help: $('hud-help'), notify: $('hud-notify'), timer: $('hud-timer'), objective: $('hud-objective'),
      prompt: $('hud-prompt'), center: $('hud-center-msg'), radio: $('radio'), dialog: $('dialog'), speedo: $('speedo'),
      instruments: $('instruments'), minimap: $('minimap'), area: $('hud-area'), fps: $('fps'), crosshair: $('crosshair'),
      scope: $('scope'), hitmarker: $('hitmarker'), vignette: $('damage-vignette'), progress: $('progress-action'),
      health: document.querySelector('#minimap-wrap .bar.health > div'), armor: document.querySelector('#minimap-wrap .bar.armor > div'),
      stamina: document.querySelector('#minimap-wrap .bar.stamina > div'),
    };
    this.mmCtx = this.el.minimap.getContext('2d');
    this.lastArea = null;
    this.areaTimer = 0;
    this.centerTimer = 0;
    this.helpTimer = 0;
    this.radioTimer = 0;
    this.hitTimer = 0;
    this._money = 0;
    this._displayMoney = 0;
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  /** Kurze Meldung links oben. */
  notify(text, ms = 3500) {
    const d = document.createElement('div');
    d.className = 'notify';
    d.innerHTML = text;
    this.el.notify.appendChild(d);
    while (this.el.notify.children.length > 5) this.el.notify.firstChild.remove();
    setTimeout(() => d.remove(), ms);
  }

  /** Hilfetext (Tutorial) oben links. */
  help(html, seconds = 8) {
    this.el.help.innerHTML = html;
    this.el.help.classList.remove('hidden');
    this.helpTimer = seconds;
  }

  /** Grosse Meldung in der Mitte (MISSION ERFÜLLT, VERHAFTET …). */
  center(text, cls = 'passed', sub = '', seconds = 4) {
    this.el.center.className = cls;
    this.el.center.innerHTML = `${text}${sub ? `<div class="sub">${sub}</div>` : ''}`;
    this.centerTimer = seconds;
  }

  prompt(html) {
    if (!html) { this.el.prompt.classList.add('hidden'); return; }
    if (this.el.prompt.innerHTML !== html) this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }

  progress(label, frac) {
    if (label === null) { this.el.progress.classList.add('hidden'); return; }
    this.el.progress.classList.remove('hidden');
    this.el.progress.querySelector('.label').textContent = label;
    this.el.progress.querySelector('.progress > div').style.width = `${Math.round(frac * 100)}%`;
  }

  objective(html) { if (this.el.objective.innerHTML !== (html || '')) this.el.objective.innerHTML = html || ''; }

  timer(sec) {
    if (sec === null || sec === undefined) { this.el.timer.classList.add('hidden'); return; }
    this.el.timer.classList.remove('hidden');
    this.el.timer.textContent = formatTime(sec);
    this.el.timer.style.color = sec < 10 ? '#ff3b30' : '#fff';
  }

  dialog(speaker, text, hint = '') {
    if (!text) { this.el.dialog.classList.add('hidden'); return; }
    this.el.dialog.classList.remove('hidden');
    this.el.dialog.innerHTML = `${speaker ? `<span class="speaker">${speaker}:</span>` : ''}${text}${hint ? `<div class="hint">${hint}</div>` : ''}`;
  }

  radio(name) {
    this.el.radio.textContent = name;
    this.el.radio.classList.add('show');
    this.radioTimer = 3;
  }

  hit(kill = false) {
    this.el.hitmarker.classList.add('show');
    this.el.hitmarker.classList.toggle('kill', kill);
    this.hitTimer = 0.15;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const e = this.el;
    // Uhr, Geld (zählt animiert)
    e.clock.textContent = g.tod.toString();
    const money = g.economy ? g.economy.money : 0;
    this._displayMoney += (money - this._displayMoney) * Math.min(1, dt * 8);
    if (Math.abs(money - this._displayMoney) < 1) this._displayMoney = money;
    e.money.textContent = formatMoney(this._displayMoney);
    e.money.style.color = money < 0 ? '#ff6b6b' : '#7ee787';
    // Balken
    e.health.style.width = `${Math.max(0, p.health)}%`;
    e.armor.style.width = `${p.armor}%`;
    e.stamina.style.width = `${p.stamina}%`;
    e.health.style.background = p.health < 25 ? '#ff3b30' : '';
    // Fahndung
    const stars = g.police ? g.police.stars : 0;
    [...e.stars.children].forEach((s, i) => s.classList.toggle('on', i < stars));
    e.stars.classList.toggle('flash', !!(g.police && g.police.searching));
    // Waffe
    if (g.weapons) {
      const w = g.weapons.current(p);
      if (w) {
        e.weaponIcon.textContent = w.def.icon || '✊';
        e.ammo.textContent = w.def.type === 'melee' ? '' : g.weapons.reloading > 0 ? t('hud.reload') : `${w.mag} / ${w.ammo}`;
      }
    }
    // Schadensvignette
    e.vignette.style.opacity = Math.max(p.hitFlash * 0.8, p.health < 25 ? 0.35 + Math.sin(performance.now() / 300) * 0.15 : 0);
    // Gebietsanzeige beim Wechsel
    const d = districtAt(p.pos.x, p.pos.z);
    if (d.id !== this.lastArea) {
      this.lastArea = d.id;
      e.area.textContent = tr(d.name);
      e.area.classList.add('show');
      this.areaTimer = 4;
    }
    if (this.areaTimer > 0 && (this.areaTimer -= dt) <= 0) e.area.classList.remove('show');
    if (this.centerTimer > 0 && (this.centerTimer -= dt) <= 0) e.center.classList.add('hidden');
    else if (this.centerTimer > 0) e.center.classList.remove('hidden');
    if (this.helpTimer > 0 && (this.helpTimer -= dt) <= 0) e.help.classList.add('hidden');
    if (this.radioTimer > 0 && (this.radioTimer -= dt) <= 0) e.radio.classList.remove('show');
    if (this.hitTimer > 0 && (this.hitTimer -= dt) <= 0) e.hitmarker.classList.remove('show');
    // FPS
    e.fps.classList.toggle('hidden', !g.settings.showFps);
    if (g.settings.showFps) {
      const info = g.renderer.info.render;
      e.fps.textContent = `${g.loop.fps.toFixed(0)} FPS · ${g.loop.frameMs.toFixed(1)} ms · ${info.calls} Draw Calls · ${(info.triangles / 1000).toFixed(0)}k Dreiecke · x ${p.pos.x.toFixed(0)} z ${p.pos.z.toFixed(0)} y ${p.pos.y.toFixed(1)}`;
    }
    // Minimap
    const cam = g.camera3p;
    const rot = cam.yaw - Math.PI;
    g.mapRenderer._playerArrow = Math.PI - (this._heading() - rot);
    const speed = p.vehicle ? Math.abs(p.vehicle.speed || 0) : 0;
    const zoom = speed > 25 ? 0.6 : speed > 12 ? 0.8 : 1;
    g.mapRenderer.drawMinimap(this.mmCtx, this._focus().x, this._focus().z, rot, g.blips ? g.blips() : [], zoom, g.route || null);
  }

  _heading() { const p = this.game.player; return p.vehicle ? p.vehicle.heading : p.heading; }
  _focus() { const p = this.game.player; return p.vehicle ? p.vehicle.pos : p.pos; }
}
