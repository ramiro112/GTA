// Menüs: Hauptmenü, Pause. (Wird in Meilenstein 9 um Einstellungen, Karte, Handy usw. erweitert.)

import { CONFIG } from '../config.js';
import { t } from '../core/i18n.js';

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.screen = null; // aktuelles Menü-Element
    this.mode = 'main';
    root.insertAdjacentHTML('beforeend', '<div id="menus"></div>');
    this.menus = document.getElementById('menus');
    game.input.onPointerLockChange = (locked) => {
      if (!locked && this.mode === 'game' && this.game.started && !this.game.paused && !this.noAutoPause) this.showPause();
    };
    game.renderer.domElement.addEventListener('click', () => {
      if (!this.game.paused && this.game.started) this.game.input.requestPointerLock();
    });
  }

  clear() { this.menus.innerHTML = ''; this.screen = null; }

  showMainMenu() {
    this.mode = 'main';
    this.game.paused = true;
    this.menus.innerHTML = `
      <div class="menu-screen" id="main-menu">
        <div class="title-logo">${CONFIG.gameTitle}</div>
        <div class="subtitle-logo">Freie Stadt · Freie Fahrt</div>
        <div class="menu-list">
          <button class="menu-btn" data-a="new">${t('menu.new')}</button>
        </div>
        <div class="footer-note">v${CONFIG.version} · eigene Erfindung · prozedurale Inhalte</div>
      </div>`;
    this.menus.querySelector('[data-a=new]').onclick = () => this.startNew();
  }

  startNew() {
    this.clear();
    this.mode = 'game';
    this.game.start();
  }

  showPause() {
    this.mode = 'pause';
    this.pauseTime = performance.now();
    this.game.pause(true);
    this.menus.innerHTML = `
      <div class="menu-screen" id="pause-menu">
        <div class="title-logo" style="font-size:54px">${t('menu.paused')}</div>
        <div class="menu-list">
          <button class="menu-btn" data-a="resume">${t('menu.resume')}</button>
        </div>
      </div>`;
    this.menus.querySelector('[data-a=resume]').onclick = () => this.resume();
  }

  resume() {
    this.clear();
    this.mode = 'game';
    this.game.pause(false);
  }

  /**
   * Generisches Auswahlmenü (Läden, Garage, Werkstatt …).
   * items: [{label, sub?, price?, disabled?, swatch?, action?: () => boolean (true = offen lassen)}]
   */
  openMenu({ title, subtitle = '', items, onClose = null }) {
    this.closeMenu(false);
    const prevMode = this.mode;
    this.mode = 'menu';
    this.game.paused = true;
    this.game.input.enabled = false;
    const el = document.createElement('div');
    el.id = 'shop';
    el.className = 'panel interactive';
    el.innerHTML = `<h2>${title}</h2>${subtitle ? `<div style="color:#9aa6b8;margin:-8px 0 10px">${subtitle}</div>` : ''}<div class="items"></div>
      <div class="footer-note">↑/↓ bzw. W/S wählen · Enter/E kaufen · Esc schliessen</div>`;
    const list = el.querySelector('.items');
    const money = this.game.economy ? this.game.economy.money : 0;
    items.forEach((it, i) => {
      const d = document.createElement('div');
      const tooExpensive = it.price > 0 && it.price > money;
      d.className = 'shop-item' + (it.disabled || tooExpensive ? ' disabled' : '');
      const priceTxt = it.price === undefined || it.price === null ? '' : it.price < 0 ? `+$${-it.price}` : it.price === 0 ? 'gratis' : `$${it.price}`;
      d.innerHTML = `<div>${it.swatch !== undefined ? `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;margin-right:8px;vertical-align:middle;background:#${it.swatch.toString(16).padStart(6, '0')}"></span>` : ''}${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</div><div class="price">${priceTxt}</div>`;
      d.onclick = () => this._menuSelect(i);
      d.onmouseenter = () => this._menuHighlight(i);
      list.appendChild(d);
    });
    this.menus.appendChild(el);
    this.menu = { el, items, sel: 0, onClose, prevMode };
    const first = items.findIndex((it) => !it.disabled);
    this._menuHighlight(first < 0 ? 0 : first);
    this.game.input.exitPointerLock();
  }

  _menuHighlight(i) {
    if (!this.menu) return;
    this.menu.sel = i;
    [...this.menu.el.querySelectorAll('.shop-item')].forEach((d, k) => d.classList.toggle('sel', k === i));
  }

  _menuSelect(i) {
    const m = this.menu;
    if (!m) return;
    const it = m.items[i];
    if (!it || it.disabled || !it.action) return;
    if (it.price > 0 && this.game.economy && this.game.economy.money < it.price) { this.game.hud.notify('Nicht genug Geld'); return; }
    const keep = it.action();
    if (!keep && this.menu === m) this.closeMenu();
  }

  closeMenu(resume = true) {
    if (!this.menu) return;
    const m = this.menu;
    this.menu = null;
    m.el.remove();
    if (resume) {
      this.mode = 'game';
      this.game.paused = false;
      this.game.input.enabled = true;
      this.game.input.requestPointerLock();
      if (m.onClose) m.onClose();
    }
  }

  _menuKeys() {
    const inp = this.game.input;
    const m = this.menu;
    const raw = (codes) => codes.some((c) => inp.codesPressed.has(c));
    if (raw(['ArrowDown', 'KeyS'])) { let i = m.sel; for (let k = 0; k < m.items.length; k++) { i = (i + 1) % m.items.length; if (!m.items[i].disabled) break; } this._menuHighlight(i); }
    if (raw(['ArrowUp', 'KeyW'])) { let i = m.sel; for (let k = 0; k < m.items.length; k++) { i = (i - 1 + m.items.length) % m.items.length; if (!m.items[i].disabled) break; } this._menuHighlight(i); }
    if (raw(['Enter', 'KeyE', 'Space'])) this._menuSelect(m.sel);
    if (raw(['Escape', 'Backspace'])) this.closeMenu();
  }

  handleGlobalKeys() {
    if (this.mode === 'menu' && this.menu) { this._menuKeys(); return; }
    const inp = this.game.input;
    if (inp.pressedRaw('pause')) {
      if (this.mode === 'game') this.showPause();
      else if (this.mode === 'pause' && performance.now() - (this.pauseTime || 0) > 300) this.resume();
    }
    if (inp.pressedRaw('debugFps')) this.game.settings.showFps = !this.game.settings.showFps;
  }

  update() {}
}
