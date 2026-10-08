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

  handleGlobalKeys() {
    const inp = this.game.input;
    if (inp.pressedRaw('pause')) {
      if (this.mode === 'game') this.showPause();
      else if (this.mode === 'pause') this.resume();
    }
    if (inp.pressedRaw('debugFps')) this.game.settings.showFps = !this.game.settings.showFps;
  }

  update() {}
}
