// Einstiegspunkt: Ladebildschirm → Welt bauen → Hauptmenü.

import { Game } from './game.js';
import { CONFIG } from './config.js';
import { t } from './core/i18n.js';
import { installSystems } from './systems.js';
import { UI } from './ui/menus.js';

const TIPS = [
  'Tipp: Mit F steigst du in Fahrzeuge ein – auch in fremde.',
  'Tipp: Wechsle unbeobachtet das Auto, um die Polizei abzuschütteln.',
  'Tipp: Im eigenen Haus kannst du am Bett speichern.',
  'Tipp: In Theos Werkstatt kannst du dein Auto reparieren, umlackieren und tunen.',
  'Tipp: Mit P öffnest du das Handy – Taxi, Schnellreise und Missionen.',
  'Tipp: Gestohlene Autos bringen beim Schrott-Hannes bares Geld.',
];

async function boot() {
  const ui = document.getElementById('ui');
  ui.insertAdjacentHTML('beforeend', `
    <div id="loading">
      <h1>${CONFIG.gameTitle}</h1>
      <div class="subtitle-logo">Freie Stadt · Freie Fahrt</div>
      <div class="progress"><div id="load-bar"></div></div>
      <div class="step" id="load-step">${t('loading.title')}</div>
      <div class="tip">${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>
    </div>`);
  const bar = document.getElementById('load-bar');
  const step = document.getElementById('load-step');
  const game = new Game(document.getElementById('game'), ui);
  window.game = game; // für Tests und Fehlersuche
  installSystems(game);
  try {
    await game.init((f, s) => { bar.style.width = `${Math.round(f * 100)}%`; step.textContent = `${t('loading.title')} ${s}`; });
  } catch (err) {
    console.error(err);
    step.textContent = 'Fehler beim Laden: ' + err.message;
    return;
  }
  game.ui = new UI(game, ui);
  document.getElementById('loading').remove();
  game.ui.showMainMenu();
  window.__gameReady = true;
}

boot();
