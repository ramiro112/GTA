// Menüs und Bildschirme: Hauptmenü, Pause, Einstellungen (Grafik/Ton/Steuerung/Sprache),
// Tastenbelegung, Spielstände, Karte, Missionen/Statistik, Inventar, Handy, Tutorial, Lizenzen,
// sowie das generische Auswahlmenü für Läden/Garage.

import { CONFIG } from '../config.js';
import { t, tr, setLanguage } from '../core/i18n.js';
import { keyLabel } from '../core/input.js';
import { formatMoney, formatTime } from '../core/mathutil.js';
import { WeaponWheel } from './weaponwheel.js';
import { Phone } from './phone.js';
import { ITEMS } from '../economy/shops.js';
import { BLIP_ICONS } from './map.js';
import { CONTACTS } from '../missions/story.js';

const ACTION_LABELS = {
  moveForward: 'Vorwärts / Gas', moveBack: 'Rückwärts / Bremse', moveLeft: 'Links', moveRight: 'Rechts', sprint: 'Sprinten', jump: 'Springen / Klettern',
  crouch: 'Ducken', enterVehicle: 'Ein-/Aussteigen', passenger: 'Als Beifahrer mitfahren', interact: 'Benutzen / Interagieren', attack: 'Angriff / Schiessen', aim: 'Zielen',
  reload: 'Nachladen', cover: 'Deckung', weaponWheel: 'Waffenrad', weaponNext: 'Nächste Waffe', weaponPrev: 'Vorige Waffe', handbrake: 'Handbremse',
  horn: 'Hupe', lights: 'Licht', siren: 'Sirene', radio: 'Radiosender', camera: 'Kamera (Ego/3. Person)', lookBehind: 'Nach hinten schauen',
  resetVehicle: 'Fahrzeug aufrichten', activity: 'Nebenjob starten/beenden', throttleUp: 'Schub+ / Steigen', throttleDown: 'Schub− / Sinken', yawLeft: 'Gieren links',
  yawRight: 'Gieren rechts', gear: 'Fahrwerk', flaps: 'Landeklappen', fireSecondary: 'Raketen (Luftfahrzeug)', parachute: 'Fallschirm', map: 'Karte',
  phone: 'Handy', inventory: 'Inventar', pause: 'Pause', missionLog: 'Missionen & Statistik', debugFps: 'FPS-Anzeige',
};

const TUTORIAL = ['tut.move', 'tut.jump', 'tut.car', 'tut.weapons', 'tut.map', 'tut.mission'];

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.mode = 'main';
    this.menu = null;
    root.insertAdjacentHTML('beforeend', '<div id="menus"></div>');
    this.menus = document.getElementById('menus');
    this.weaponWheel = new WeaponWheel(game, root);
    this.phone = new Phone(game, root);
    game.input.onPointerLockChange = (locked) => {
      if (!locked && this.mode === 'game' && this.game.started && !this.game.paused && !this.noAutoPause && !this.phone.isOpen) this.showPause();
    };
    game.renderer.domElement.addEventListener('click', () => {
      if (!this.game.paused && this.game.started) this.game.input.requestPointerLock();
    });
    this.tutStep = 0;
    this.tutTimer = 3;
  }

  clear() { this.menus.innerHTML = ''; }

  _screen(html, cls = '') {
    this.menus.innerHTML = `<div class="menu-screen ${cls}">${html}</div>`;
    return this.menus.firstElementChild;
  }

  _bind(el, map) {
    for (const [sel, fn] of Object.entries(map)) el.querySelectorAll(`[data-a="${sel}"]`).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); fn(b); }; });
  }

  // ------------------------------------------------------------------ Hauptmenü
  showMainMenu() {
    this.mode = 'main';
    this.game.paused = true;
    this.game.hud.show(false);
    const hasSave = this.game.saves && this.game.saves.latest();
    const el = this._screen(`
      <div class="title-logo">${CONFIG.gameTitle}</div>
      <div class="subtitle-logo">Schatten der Bucht</div>
      <div class="menu-list">
        ${hasSave ? `<button class="menu-btn" data-a="continue">${t('menu.continue')}</button>` : ''}
        <button class="menu-btn" data-a="new">${t('menu.new')}</button>
        <button class="menu-btn" data-a="load">${t('menu.load')}</button>
        <button class="menu-btn" data-a="settings">${t('menu.settings')}</button>
        <button class="menu-btn" data-a="controls">${t('menu.controls')}</button>
        <button class="menu-btn" data-a="credits">${t('menu.credits')}</button>
      </div>
      <div class="footer-note">v${CONFIG.version} · Eigene Erfindung · Alle Inhalte prozedural erzeugt</div>`);
    this._bind(el, {
      continue: () => { this.game.saves.load(hasSave.slot); this.startGame(); },
      new: () => this.startNew(),
      load: () => this.showSlots('load', () => this.showMainMenu()),
      settings: () => this.showSettings(() => this.showMainMenu()),
      controls: () => this.showControls(() => this.showMainMenu()),
      credits: () => this.showCredits(() => this.showMainMenu()),
    });
  }

  startNew() {
    if (this.game.newGame) this.game.newGame();
    this.startGame();
  }

  startGame() {
    this.clear();
    this.mode = 'game';
    this.game.start();
    if (!this.game.settings.tutorialDone) { this.tutStep = 0; this.tutTimer = 2; }
    else this.tutStep = TUTORIAL.length;
  }

  // ------------------------------------------------------------------ Pause
  showPause() {
    this.mode = 'pause';
    this.pauseTime = performance.now();
    this.game.pause(true);
    this.phone.close();
    const g = this.game;
    const canSave = g.saves && g.saves.canSaveHere();
    const el = this._screen(`
      <div class="title-logo" style="font-size:54px">${t('menu.paused')}</div>
      <div class="menu-list">
        <button class="menu-btn" data-a="resume">${t('menu.resume')}</button>
        <button class="menu-btn" data-a="map">${t('menu.map')}</button>
        <button class="menu-btn" data-a="missions">${t('menu.missions')} & ${t('menu.stats')}</button>
        <button class="menu-btn" data-a="inventory">${t('menu.inventory')}</button>
        <button class="menu-btn" data-a="save" ${canSave ? '' : 'disabled'}>${t('menu.save')}${canSave ? '' : ' (nur in Unterkünften am Bett)'}</button>
        <button class="menu-btn" data-a="load">${t('menu.load')}</button>
        <button class="menu-btn" data-a="settings">${t('menu.settings')}</button>
        <button class="menu-btn" data-a="controls">${t('menu.controls')}</button>
        <button class="menu-btn" data-a="quit">${t('menu.quit')}</button>
      </div>`);
    this._bind(el, {
      resume: () => this.resume(),
      map: () => this.showMap(),
      missions: () => this.showMissionLog(() => this.showPause()),
      inventory: () => this.showInventory(() => this.showPause()),
      save: () => this.showSlots('save', () => this.showPause()),
      load: () => this.showSlots('load', () => this.showPause()),
      settings: () => this.showSettings(() => this.showPause()),
      controls: () => this.showControls(() => this.showPause()),
      quit: () => { if (g.saves) g.saves.autosave('Hauptmenü'); this.showMainMenu(); },
    });
  }

  resume() {
    this.clear();
    this.mode = 'game';
    this.game.pause(false);
  }

  // ------------------------------------------------------------------ Spielstände
  showSlots(kind, back) {
    const g = this.game;
    const slots = g.saves ? g.saves.list() : [];
    const el = this._screen(`<div class="panel" style="min-width:520px">
      <h2>${kind === 'save' ? t('menu.save') : t('menu.load')}</h2>
      ${slots.map((s) => `<div class="slot"><div><b>${s.slot === 'auto' ? 'Autosave' : 'Slot ' + s.slot}</b><div class="info">${s.meta ? `${s.meta.date} · ${formatMoney(s.meta.money)} · ${s.meta.missions}/12 Missionen · ${s.meta.place}` : 'leer'}</div></div>
        <div>${kind === 'save' ? (s.slot === 'auto' ? '' : `<button class="btn primary" data-a="do" data-s="${s.slot}">Speichern</button>`) : (s.meta ? `<button class="btn primary" data-a="do" data-s="${s.slot}">Laden</button>` : '')}
        ${s.meta && s.slot !== 'auto' ? `<button class="btn small" data-a="del" data-s="${s.slot}">Löschen</button>` : ''}</div></div>`).join('')}
      <div style="margin-top:14px"><button class="btn" data-a="back">${t('menu.back')}</button></div></div>`, 'center');
    this._bind(el, {
      do: (b) => {
        const slot = b.dataset.s;
        if (kind === 'save') { g.saves.save(slot); this.showSlots(kind, back); g.hud.notify(t('hud.saved')); }
        else { g.saves.load(slot); this.startGame(); }
      },
      del: (b) => { g.saves.remove(b.dataset.s); this.showSlots(kind, back); },
      back,
    });
  }

  // ------------------------------------------------------------------ Einstellungen
  showSettings(back) {
    const g = this.game;
    const s = g.settings;
    const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
    const q = CONFIG.graphics.presets[s.quality] || CONFIG.graphics.presets.medium;
    const el = this._screen(`<div class="panel" style="min-width:560px">
      <h2>${t('menu.settings')}</h2>
      <h3>${t('settings.graphics')}</h3>
      <div class="row"><label>${t('settings.quality')}</label><select data-k="quality">${opt('low', s.quality, t('settings.low'))}${opt('medium', s.quality, t('settings.medium'))}${opt('high', s.quality, t('settings.high'))}</select></div>
      <div class="row"><label>${t('settings.drawDistance')} <span id="dd-v">${s.drawDistance || q.drawDistance} m</span></label><input type="range" min="250" max="1200" step="50" value="${s.drawDistance || q.drawDistance}" data-k="drawDistance"></div>
      <div class="row"><label>${t('settings.showFps')}</label><input type="checkbox" data-k="showFps" ${s.showFps ? 'checked' : ''}></div>
      <h3>${t('settings.audio')}</h3>
      ${['master', 'sfx', 'music'].map((k) => `<div class="row"><label>${t('settings.' + k)}</label><input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-k="${k}"></div>`).join('')}
      <h3>${t('settings.controls')}</h3>
      <div class="row"><label>${t('settings.sensitivity')}</label><input type="range" min="0.2" max="3" step="0.1" value="${s.sensitivity}" data-k="sensitivity"></div>
      <div class="row"><label>${t('settings.invertY')}</label><input type="checkbox" data-k="invertY" ${s.invertY ? 'checked' : ''}></div>
      <div class="row"><label>${t('settings.autoAim')}</label><input type="checkbox" data-k="autoAim" ${s.autoAim ? 'checked' : ''}></div>
      <div class="row"><label>${t('settings.flightMode')}</label><select data-k="flightMode">${opt('arcade', s.flightMode, t('settings.arcade'))}${opt('sim', s.flightMode, t('settings.sim'))}</select></div>
      <div class="row"><label>Tastenbelegung</label><button class="btn" data-a="keys">Tasten ändern …</button></div>
      <h3>${t('settings.language')}</h3>
      <div class="row"><label>${t('settings.language')}</label><select data-k="language">${opt('de', s.language, 'Deutsch')}${opt('en', s.language, 'English')}</select></div>
      <div class="row"><label>${t('settings.subtitles')}</label><input type="checkbox" data-k="subtitles" ${s.subtitles !== false ? 'checked' : ''}></div>
      <div class="row"><label>${t('settings.voice')}</label><input type="checkbox" data-k="voice" ${s.voice ? 'checked' : ''}></div>
      <div style="margin-top:16px;display:flex;gap:10px"><button class="btn primary" data-a="back">${t('menu.back')}</button></div>
      <div class="footer-note">Änderungen werden sofort übernommen und gespeichert.</div></div>`, 'center');
    el.querySelectorAll('[data-k]').forEach((inp) => {
      inp.oninput = inp.onchange = () => {
        const k = inp.dataset.k;
        const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? Number(inp.value) : inp.value;
        if (k === 'quality') s.drawDistance = null;
        s[k] = v;
        if (k === 'drawDistance') el.querySelector('#dd-v').textContent = `${v} m`;
        g.applySettings();
        if (k === 'language' || k === 'quality') { setLanguage(s.language); this.showSettings(back); }
      };
    });
    this._bind(el, { back, keys: () => this.showKeybinds(() => this.showSettings(back)) });
  }

  showKeybinds(back) {
    const g = this.game;
    const b = g.input.bindings;
    const rows = Object.keys(ACTION_LABELS).filter((a) => b[a]).map((a) => `<div class="row"><label>${ACTION_LABELS[a]}</label><button class="btn keybind" data-a="rebind" data-act="${a}">${keyLabel(b[a][0])}${b[a][1] ? ' / ' + keyLabel(b[a][1]) : ''}</button></div>`).join('');
    const el = this._screen(`<div class="panel" style="min-width:560px"><h2>Tastenbelegung</h2>
      <div class="footer-note" style="margin:-6px 0 10px">Klicke eine Aktion und drücke die neue Taste (Esc = abbrechen). Gamepad-Belegung ist fest (siehe README).</div>
      ${rows}
      <div style="margin-top:14px;display:flex;gap:10px"><button class="btn primary" data-a="back">${t('menu.back')}</button><button class="btn" data-a="reset">${t('settings.reset')}</button></div></div>`, 'center');
    this._bind(el, {
      back,
      reset: () => { g.settings.bindings = {}; g.applySettings(); this.showKeybinds(back); },
      rebind: (btn) => {
        btn.textContent = t('settings.rebind');
        g.input.onAnyKey = (code) => {
          g.input.onAnyKey = null;
          if (code !== 'Escape') {
            g.input.rebind(btn.dataset.act, code, 0);
            g.settings.bindings = { ...g.input.bindings };
            g.applySettings();
          }
          this.showKeybinds(back);
        };
      },
    });
  }

  showControls(back) {
    const g = this.game;
    const k = (a) => `<kbd>${g.input.labelFor(a)}</kbd>`;
    const el = this._screen(`<div class="panel" style="max-width:900px">
      <h2>${t('menu.controls')}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;font-size:14px;line-height:1.7">
        <div><h3>Zu Fuss</h3>
          ${k('moveForward')}${k('moveLeft')}${k('moveBack')}${k('moveRight')} Bewegen · Maus Umsehen<br>${k('sprint')} Sprinten · ${k('jump')} Springen/Klettern · ${k('crouch')} Ducken<br>
          ${k('enterVehicle')} Einsteigen/Stehlen · ${k('passenger')} Mitfahren (Taxi) · ${k('interact')} Benutzen<br>
          Maus L Schiessen · Maus R Zielen · ${k('reload')} Nachladen · ${k('cover')} Deckung<br>${k('weaponWheel')} (halten) Waffenrad · 1–9 / Mausrad Waffe wechseln</div>
        <div><h3>Fahrzeug</h3>
          ${k('moveForward')} Gas · ${k('moveBack')} Bremse/Rückwärts · ${k('moveLeft')}${k('moveRight')} Lenken<br>${k('handbrake')} Handbremse · ${k('horn')} Hupe · ${k('lights')} Licht · ${k('siren')} Sirene<br>
          ${k('radio')} Radiosender · ${k('camera')} Ego-Perspektive · ${k('lookBehind')} Zurückschauen<br>${k('resetVehicle')} Aufrichten · ${k('activity')} Nebenjob (Taxi, Krankenwagen …)<br>Maus R + L: aus dem Auto schiessen (Pistole/MP)</div>
        <div><h3>Helikopter</h3>${k('throttleUp')} Steigen · ${k('throttleDown')} Sinken<br>${k('moveForward')}${k('moveBack')} Nicken · ${k('moveLeft')}${k('moveRight')} Rollen · ${k('yawLeft')}${k('yawRight')} Gieren<br>Maus L MG · Maus R Raketen (Militär)</div>
        <div><h3>Flugzeug</h3>${k('throttleUp')}/${k('throttleDown')} Schub · ${k('moveForward')} Nase runter · ${k('moveBack')} Nase hoch<br>${k('moveLeft')}${k('moveRight')} Rollen · ${k('yawLeft')}${k('yawRight')} Seitenruder · ${k('gear')} Fahrwerk · ${k('flaps')} Klappen<br>${k('enterVehicle')} in der Luft: Absprung · dann ${k('parachute')} Fallschirm</div>
        <div><h3>Menüs</h3>${k('map')} Karte · ${k('phone')} Handy · ${k('inventory')} Inventar · ${k('missionLog')} Missionen<br>${k('pause')} Pause · F3 FPS · Enter Dialog weiter / Checkpoint-Neustart</div>
        <div><h3>Gamepad</h3>Linker Stick bewegen/lenken · Rechter Stick Kamera<br>RT Schiessen/Gas · LT Zielen/Bremse · A Springen/Handbremse/Fallschirm<br>Y Einsteigen · X Benutzen · B Nachladen · LB Waffenrad (halten) · RB Deckung/Hupe<br>L3 Sprinten · R3 Ducken/Zurückschauen<br>Luftfahrzeug: RT/LT Steigen/Sinken bzw. Schub · LB/RB Gieren · B MG · X Raketen · D-Pad ↓ Klappen<br>D-Pad: ↑ Handy · ↓ Radio · ← Kamera/Cockpit · → Licht/Fahrwerk · Start Pause · Back Karte</div>
      </div>
      <div style="margin-top:14px"><button class="btn primary" data-a="back">${t('menu.back')}</button></div></div>`, 'center');
    this._bind(el, { back });
  }

  showCredits(back) {
    const el = this._screen(`<div class="panel" style="max-width:720px"><h2>${t('menu.credits')}</h2>
      <p>PORT AURELIA – Schatten der Bucht. Ein Open-World-Prototyp im Browser.</p>
      <h3>Technik</h3><p>Three.js r169 (MIT-Lizenz, © three.js authors) – lokal eingebunden.</p>
      <h3>Inhalte</h3><p>Alle Texturen (Fassaden, Asphalt, Wasser), Modelle (Low-Poly aus Grundformen), Geräusche und die Radiomusik werden zur Laufzeit prozedural erzeugt. Es werden keine externen Bilder, Modelle oder Audiodateien verwendet.</p>
      <p>Stadt, Figuren, Firmen und Story sind eigene Erfindungen. Ähnlichkeiten mit realen Personen oder Marken sind nicht beabsichtigt.</p>
      <div style="margin-top:14px"><button class="btn primary" data-a="back">${t('menu.back')}</button></div></div>`, 'center');
    this._bind(el, { back });
  }

  // ------------------------------------------------------------------ Karte
  showMap() {
    const g = this.game;
    if (this.mode === 'game') g.pause(true);
    this.mode = 'map';
    const W = Math.round(Math.min(window.innerWidth * 0.92, 1400)), H = Math.round(Math.min(window.innerHeight * 0.86, 900));
    const el = this._screen(`<div id="bigmap"><div class="title">${t('map.title')}</div><canvas width="${W}" height="${H}"></canvas>
      <div class="legend">${t('map.waypoint')}<br>Rechtsklick: Wegpunkt löschen<br>Mausrad: Zoom · Ziehen: Verschieben<br><br>
      ${[['mission', 'Mission'], ['house', 'Dein Haus'], ['garage', 'Garage'], ['gun', 'Waffenladen'], ['clothes', 'Kleidung'], ['food', 'Restaurant'], ['barber', 'Frisör'], ['tuning', 'Werkstatt/Tuning'], ['dealer', 'Autohändler'], ['fuel', 'Tankstelle'], ['hospital', 'Krankenhaus'], ['police', 'Polizei'], ['bank', 'Bank'], ['scrap', 'Schrottplatz'], ['safehouse', 'Immobilie'], ['race', 'Rennen'], ['stunt', 'Stunt-Sprung'], ['target', 'Kopfgeld'], ['airport', 'Flughafen'], ['heli', 'Heliport (frei)'], ['airstrip', 'Strandpiste (frei)'], ['military', 'Sperrgebiet']].map(([i, l]) => `${BLIP_ICONS[i]} ${l}`).join('<br>')}
      <br><br><button class="btn" data-a="close">Schliessen (M)</button></div></div>`, 'center');
    el.style.padding = '0';
    const canvas = el.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const p = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const view = { x: p.x, z: p.z, scale: 1.0 };
    const draw = () => g.mapRenderer.drawBig(ctx, p.x, p.z, g.player.vehicle ? g.player.vehicle.heading : g.player.heading, g.blips(), view, g.route);
    draw();
    let drag = null;
    canvas.onmousedown = (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vz: view.z, moved: false }; };
    window.onmousemove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; view.x = drag.vx - dx / view.scale / 0.5; view.z = drag.vz - dy / view.scale / 0.5; draw(); };
    window.onmouseup = (e) => {
      if (drag && !drag.moved && e.target === canvas) {
        const r = canvas.getBoundingClientRect();
        const sx = (e.clientX - r.left) * (canvas.width / r.width), sy = (e.clientY - r.top) * (canvas.height / r.height);
        if (e.button === 2) g.missions.setUserWaypoint(null);
        else { const [wx, wz] = g.mapRenderer.screenToWorld(sx, sy, canvas.width, canvas.height, view); g.missions.setUserWaypoint({ x: wx, z: wz }); }
        draw();
      }
      drag = null;
    };
    canvas.onwheel = (e) => { view.scale = Math.max(0.35, Math.min(4, view.scale * (e.deltaY < 0 ? 1.2 : 0.83))); draw(); e.preventDefault(); };
    canvas.oncontextmenu = (e) => e.preventDefault();
    this._bind(el, { close: () => this.closeMap() });
  }

  closeMap() {
    window.onmousemove = null; window.onmouseup = null;
    this.clear();
    this.mode = 'game';
    this.game.pause(false);
  }

  // ------------------------------------------------------------------ Missionen & Statistik
  progressPercent() {
    const g = this.game;
    const E = g.missions.engine;
    const A = g.activities;
    const extras = (A ? A.stuntsDone.size + A.racesDone.size + Math.min(5, A.bountiesDone) : 0) + g.economy.ownedProperties.size - 1;
    return Math.round((E.completed.size / E.missions.size) * 75 + (extras / 14) * 25);
  }

  showMissionLog(back) {
    const g = this.game;
    const E = g.missions.engine;
    const A = g.activities;
    const total = E.missions.size;
    const done = E.completed.size;
    const pct = this.progressPercent();
    const st = g.stats;
    const missions = [...E.missions.values()].map((m) => {
      const s = E.stats[m.id];
      const status = E.completed.has(m.id) ? '✔ erledigt' : E.active && E.active.id === m.id ? '▶ aktiv' : E.isAvailable(m.id) ? '● verfügbar' : '🔒 gesperrt';
      return `<div class="mission-entry ${E.completed.has(m.id) ? 'done' : ''}"><span class="st">${status}${s && s.bestTime ? ' · ' + formatTime(s.bestTime) : ''}</span><b>${tr(m.title)}</b> <small style="color:#9aa6b8">– ${CONTACTS[m.giver]?.name || ''}${s ? ` · Versuche ${s.attempts}` : ''}</small></div>`;
    }).join('');
    const el = this._screen(`<div class="panel" style="min-width:720px;max-width:980px">
      <h2>${t('menu.missions')} · ${t('menu.stats')} – Fortschritt ${pct}%</h2>
      <div class="progress" style="width:100%;margin:0 0 14px"><div style="width:${pct}%"></div></div>
      <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:24px">
        <div><h3>Story (${done}/${total})</h3>${missions}</div>
        <div><h3>Statistik</h3><div class="stat-grid">
          <div>Spielzeit</div><div>${formatTime(st.playTime)}</div>
          <div>Geld verdient</div><div>${formatMoney(st.moneyEarned)}</div>
          <div>Gestohlene Fahrzeuge</div><div>${st.carsStolen}</div>
          <div>Strecke im Fahrzeug</div><div>${(st.distanceCar / 1000).toFixed(1)} km</div>
          <div>Schüsse / Treffer</div><div>${st.shots} / ${st.hits} (${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%)</div>
          <div>Ausgeschaltete Gegner</div><div>${st.kills}</div>
          <div>Höchste Fahndung</div><div>${'★'.repeat(st.maxWanted) || '–'}</div>
          <div>Krankenhaus / Verhaftet</div><div>${st.deaths} / ${st.arrests}</div>
          <div>Stunt-Sprünge</div><div>${A ? A.stuntsDone.size : 0}/4</div>
          <div>Rennen gewonnen</div><div>${A ? A.racesDone.size : 0}/2</div>
          <div>Kopfgelder</div><div>${A ? A.bountiesDone : 0}</div>
          <div>Rekorde Taxi/Rettung/Feuer/Polizei</div><div>${A ? [A.best.taxi, A.best.ambulance, A.best.fire, A.best.vigilante].map((x) => x || 0).join(' / ') : '-'}</div>
          <div>Immobilien</div><div>${g.economy.ownedProperties.size - 1}/3</div>
        </div></div>
      </div>
      <div style="margin-top:14px"><button class="btn primary" data-a="back">${t('menu.back')}</button></div></div>`, 'center');
    this._bind(el, { back });
  }

  // ------------------------------------------------------------------ Inventar
  showInventory(back) {
    const g = this.game;
    const inv = g.player.inventory;
    const items = Object.entries(g.inventory.items).filter(([, n]) => n > 0);
    const el = this._screen(`<div class="panel" style="min-width:560px"><h2>${t('menu.inventory')}</h2>
      <h3>Waffen</h3>${inv.slots.map((w, i) => (w ? `<div class="shop-item ${i === inv.currentSlot ? 'sel' : ''}" data-a="equip" data-i="${i}"><div>${w.def.icon} ${tr(w.def.name)}<small>Slot ${i + 1}</small></div><div class="price">${w.def.type === 'melee' ? '' : `${w.mag} / ${w.ammo}`}</div></div>` : '')).join('')}
      <h3>Gegenstände</h3>${items.length ? items.map(([id, n]) => `<div class="shop-item" data-a="use" data-id="${id}"><div>${ITEMS[id] ? ITEMS[id].icon + ' ' + tr(ITEMS[id].name) : id}<small>${ITEMS[id] ? tr(ITEMS[id].desc) : ''}</small></div><div class="price">×${n} · benutzen</div></div>`).join('') : '<div class="footer-note">Keine Gegenstände.</div>'}
      <h3>Status</h3><div class="stat-grid"><div>Gesundheit</div><div>${Math.round(g.player.health)}</div><div>Rüstung</div><div>${Math.round(g.player.armor)}</div><div>Geld</div><div>${formatMoney(g.economy.money)}</div><div>Fahrzeuge in der Garage</div><div>${g.economy.ownedVehicles.length}/${g.economy.garageSlots}</div></div>
      <div style="margin-top:14px"><button class="btn primary" data-a="back">${t('menu.back')}</button></div></div>`, 'center');
    this._bind(el, {
      back,
      equip: (b) => { inv.select(Number(b.dataset.i)); g.weapons._equipModel(); this.showInventory(back); },
      use: (b) => { if (!g.shops.useItem(b.dataset.id)) g.hud.notify('Kann gerade nicht benutzt werden.'); this.showInventory(back); },
    });
  }

  // ------------------------------------------------------------------ Generisches Auswahlmenü
  /** items: [{label, sub?, price?, disabled?, swatch?, action?: () => boolean (true = offen lassen)}] */
  openMenu({ title, subtitle = '', items, onClose = null }) {
    this.closeMenu(false);
    this.mode = 'menu';
    this.game.paused = true;
    this.game.input.enabled = false;
    const el = document.createElement('div');
    el.id = 'shop';
    el.className = 'panel interactive';
    el.innerHTML = `<h2>${title}</h2>${subtitle ? `<div style="color:#9aa6b8;margin:-8px 0 10px">${subtitle}</div>` : ''}<div style="color:#7ee787;font-weight:700;margin-bottom:6px">${formatMoney(this.game.economy ? this.game.economy.money : 0)}</div><div class="items"></div>
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
    this.menu = { el, items, sel: 0, onClose };
    const first = items.findIndex((it) => !it.disabled);
    this._menuHighlight(first < 0 ? 0 : first);
    this.game.input.exitPointerLock();
  }

  _menuHighlight(i) {
    if (!this.menu) return;
    this.menu.sel = i;
    [...this.menu.el.querySelectorAll('.shop-item')].forEach((d, k) => { d.classList.toggle('sel', k === i); if (k === i && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' }); });
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

  // ------------------------------------------------------------------ Tasten & Schleife
  handleGlobalKeys() {
    const inp = this.game.input;
    if (this.mode === 'menu' && this.menu) { this._menuKeys(); return; }
    if (this.mode === 'map') { if (inp.pressedRaw('map') || inp.pressedRaw('pause')) this.closeMap(); return; }
    if (inp.pressedRaw('pause')) {
      if (this.phone.isOpen) { this.phone.close(); return; }
      if (this.mode === 'game') this.showPause();
      else if (this.mode === 'pause' && performance.now() - (this.pauseTime || 0) > 300) this.resume();
      return;
    }
    if (inp.pressedRaw('debugFps')) this.game.settings.showFps = !this.game.settings.showFps;
    if (this.mode !== 'game' || this.game.player.dead) return;
    if (inp.pressedRaw('map')) this.showMap();
    else if (inp.pressedRaw('phone')) this.phone.toggle();
    else if (inp.pressedRaw('inventory')) { this.mode = 'pause'; this.game.pause(true); this.showInventory(() => this.resume()); }
    else if (inp.pressedRaw('missionLog')) { this.mode = 'pause'; this.game.pause(true); this.showMissionLog(() => this.resume()); }
  }

  update(dt) {
    this.phone.update(dt);
    // Tutorial-Hinweise beim ersten Start
    const g = this.game;
    if (this.mode === 'game' && this.tutStep < TUTORIAL.length && g.started && !g.paused) {
      this.tutTimer -= dt;
      if (this.tutTimer <= 0) {
        const k = (a) => `<kbd>${g.input.labelFor(a)}</kbd>`;
        const html = t(TUTORIAL[this.tutStep], { up: k('moveForward'), left: k('moveLeft'), down: k('moveBack'), right: k('moveRight'), sprint: k('sprint'), jump: k('jump'), crouch: k('crouch'), enter: k('enterVehicle'), map: k('map'), phone: k('phone'), pause: k('pause'), wheel: k('weaponWheel') });
        g.hud.help(`<b>Tipp ${this.tutStep + 1}/${TUTORIAL.length}</b><br>${html}`, 9);
        this.tutStep++;
        this.tutTimer = 10;
        if (this.tutStep >= TUTORIAL.length) { g.settings.tutorialDone = true; g.applySettings(); }
      }
    }
  }
}
