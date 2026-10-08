// Handy (Taste P): Kontakte, Missionen (Wegpunkt setzen), Taxi rufen (Mitfahren + Ziel wählen),
// Schnellreise, Wetter, Testmenü. Enthält auch den Taxi-Service (Beifahrer-Fahrten).

import * as THREE from 'three';
import { t, tr } from '../core/i18n.js';
import { formatMoney } from '../core/mathutil.js';
import { CONTACTS } from '../missions/story.js';
import { LANDMARKS, doorPosition } from '../world/layout.js';
import { events } from '../core/events.js';

const APPS = [
  ['contacts', '☎', 'phone.contacts'], ['missions', '★', 'phone.missions'], ['taxi', '🚕', 'phone.taxi'],
  ['travel', '⚡', 'phone.fasttravel'], ['weather', '☀', 'phone.weather'], ['cheats', '🛠', 'phone.cheats'],
];

export class Phone {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'phone';
    this.el.className = 'hidden';
    root.appendChild(this.el);
    this.isOpen = false;
    this.screen = 'home';
    this.sel = 0;
    this.items = [];
    this.taxi = new TaxiService(game);
    game.taxi = this.taxi;
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  open() {
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.screen = 'home';
    this.sel = 0;
    this.game.ui.noAutoPause = true;
    this.game.input.exitPointerLock();
    this.render();
    events.emit('phone:open');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    setTimeout(() => { this.game.ui.noAutoPause = false; }, 200);
    if (this.game.ui.mode === 'game') this.game.input.requestPointerLock();
  }

  _list(title, items) {
    this.items = items;
    this.el.innerHTML = `<div class="screen-title">${title}</div><div class="list">${items.map((it, i) => `<div class="item ${i === this.sel ? 'sel' : ''}" data-i="${i}">${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</div>`).join('')}</div>
      <div class="footer-note">↑/↓ · Enter · Rücktaste = zurück</div>`;
    this.el.querySelectorAll('.item').forEach((d) => { d.onclick = () => { this.sel = Number(d.dataset.i); this._activate(); }; });
  }

  render() {
    const g = this.game;
    if (this.screen === 'home') {
      this.items = APPS.map(([id, ic, key]) => ({ id, label: `<span class="ic">${ic}</span>${t(key)}` }));
      this.el.innerHTML = `<div class="screen-title">${g.tod.toString()} · ${t('phone.title')}</div><div class="apps">${this.items.map((it, i) => `<div class="app ${i === this.sel ? 'sel' : ''}" data-i="${i}">${it.label}</div>`).join('')}</div>
        <div class="footer-note" style="margin-top:auto">Pfeiltasten + Enter oder Maus · P/Esc schliessen</div>`;
      this.el.querySelectorAll('.app').forEach((d) => { d.onclick = () => { this.sel = Number(d.dataset.i); this._activate(); }; });
      return;
    }
    const M = g.missions;
    switch (this.screen) {
      case 'contacts':
        this._list(t('phone.contacts'), Object.entries(CONTACTS).filter(([, c]) => c.phone).map(([id, c]) => {
          const m = M.engine.available().find((x) => x.giver === id);
          return { label: c.name, sub: m ? `Hat einen Auftrag: ${tr(m.title)}` : tr(c.desc), action: () => this._call(id, m) };
        }));
        break;
      case 'missions': {
        const av = M.engine.available();
        this._list(t('phone.missions'), av.length ? av.map((m) => ({ label: tr(m.title), sub: `${CONTACTS[m.giver]?.name} · ${Math.round(Math.hypot(m.start.x - g.player.pos.x, m.start.z - g.player.pos.z))} m – Wegpunkt setzen`, action: () => { M.setUserWaypoint(m.start); g.hud.notify('Wegpunkt gesetzt'); this.close(); } })) : [{ label: M.engine.active ? 'Mission läuft …' : 'Keine Aufträge verfügbar', action: () => {} }]);
        break;
      }
      case 'taxi':
        this._list(t('phone.taxi'), [{ label: 'Taxi hierher rufen', sub: 'Ein Taxi holt dich ab. Einsteigen mit G.', action: () => { this.taxi.call(); this.close(); } }]);
        break;
      case 'travel': {
        const eco = g.economy;
        const dests = [['playerHouse', true], ['playerGarage', true], ['tuning', true], ['hospital', true], ['police', true], ['gunshop', true], ['safeBeach', eco.ownedProperties.has('safehouse_beach')], ['safeHills', eco.ownedProperties.has('safehouse_hills')], ['penthouse', eco.ownedProperties.has('penthouse')]];
        this._list(t('phone.fasttravel'), dests.filter(([, ok]) => ok).map(([id]) => ({ label: tr(LANDMARKS[id].name), sub: 'Schnellreise · $100', action: () => { this.taxi.fastTravel(id); this.close(); } })));
        break;
      }
      case 'weather':
        this._list(t('phone.weather'), ['clear', 'cloudy', 'rain', 'fog', 'storm'].map((w) => ({ label: { clear: 'Klar', cloudy: 'Bewölkt', rain: 'Regen', fog: 'Nebel', storm: 'Gewitter' }[w], sub: 'Wetter ändern (Testfunktion)', action: () => { g.weather.set(w); g.hud.notify('Wetter ändert sich …'); } })).concat([{ label: 'Zeit +3 Stunden', action: () => { g.tod.hour = (g.tod.hour + 3) % 24; } }]));
        break;
      case 'cheats':
        this._list(t('phone.cheats'), [
          { label: '+ $10.000', sub: 'Testfunktion', action: () => g.economy.add(10000, 'Testmenü') },
          { label: 'Alle Waffen', sub: 'Testfunktion', action: () => { for (const w of ['bat', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'grenade', 'rocket']) g.player.inventory.give(w); g.weapons._equipModel(); } },
          { label: 'Gesundheit + Weste', action: () => { g.player.health = 100; g.player.armor = 100; g.player.model.setVest(true); } },
          { label: 'Fahndung löschen', action: () => g.police.clear('cheat') },
          { label: 'Fahndung +1 Stern', action: () => g.police.wanted.ensureStars(Math.min(5, g.police.stars + 1), g.player.pos) },
          { label: 'Sportwagen spawnen', action: () => this._spawn('sports') },
          { label: 'Helikopter spawnen', action: () => this._spawn('heliSmall') },
          { label: 'Militärhubschrauber spawnen', action: () => this._spawn('heliMil') },
          { label: 'Jet spawnen (Flughafen)', action: () => { const v = g.vehicles.spawn('jet', { x: -850, z: -770, heading: Math.PI / 2 }); v.persistent = true; g.player.teleport(-848, null, -766); g.vehicles._seatPlayer(v); } },
          { label: 'Motorrad spawnen', action: () => this._spawn('motorbike') },
          { label: 'Panzerwagen (SEK) spawnen', action: () => this._spawn('swat') },
          { label: 'Gott-Modus an/aus', action: () => { g.godMode = !g.godMode; g.hud.notify('Gott-Modus ' + (g.godMode ? 'an' : 'aus')); } },
          { label: 'Alle Story-Missionen freischalten', action: () => { for (const id of g.missions.engine.missions.keys()) for (const r of g.missions.engine.missions.get(id).requires || []) g.missions.engine.completed.add(r); g.hud.notify('Missionen freigeschaltet (Voraussetzungen erfüllt)'); } },
        ]);
        break;
      default: break;
    }
  }

  _spawn(type) {
    const g = this.game, p = g.player;
    const f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const v = g.vehicles.spawn(type, { x: p.pos.x + f.x * 6, z: p.pos.z + f.z * 6, heading: p.heading });
    v.locked = false; v.owned = true; v.persistent = true;
    this.close();
  }

  _call(id, mission) {
    const g = this.game;
    const c = CONTACTS[id];
    if (mission) {
      g.missions.dialog.play([[id, `Komm vorbei, ich hab was für dich: „${tr(mission.title)}“. Ich markiere dir den Treffpunkt.`, `Come by, I have something for you: "${tr(mission.title)}". I'll mark the meeting point.`]]);
      g.missions.setUserWaypoint(mission.start);
    } else g.missions.dialog.play([[id, 'Gerade nichts zu tun. Ich melde mich.', 'Nothing right now. I\'ll get back to you.']]);
    this.close();
    void c;
  }

  _activate() {
    const it = this.items[this.sel];
    if (!it) return;
    if (this.screen === 'home') { this.screen = it.id; this.sel = 0; this.render(); return; }
    if (it.action) { it.action(); if (this.isOpen) this.render(); }
  }

  update() {
    if (!this.isOpen) return;
    const inp = this.game.input;
    const k = (c) => inp.codesPressed.has(c);
    const n = this.items.length;
    const cols = this.screen === 'home' ? 3 : 1;
    if (k('ArrowDown')) { this.sel = (this.sel + cols) % n; this.render(); }
    if (k('ArrowUp')) { this.sel = (this.sel - cols + n) % n; this.render(); }
    if (k('ArrowRight') && cols > 1) { this.sel = (this.sel + 1) % n; this.render(); }
    if (k('ArrowLeft') && cols > 1) { this.sel = (this.sel - 1 + n) % n; this.render(); }
    if (k('Enter') || k('NumpadEnter')) this._activate();
    if (k('Backspace')) { if (this.screen === 'home') this.close(); else { this.screen = 'home'; this.sel = 0; this.render(); } }
  }
}

// ---------------------------------------------------------------------- Taxi-Service
class TaxiService {
  constructor(game) {
    this.game = game;
    this.called = null;
    this.ride = null;
  }

  /** Taxi zum Spieler rufen. */
  call() {
    const g = this.game;
    if (this.called && !this.called.removed) { g.hud.notify('Dein Taxi ist schon unterwegs.'); return; }
    const p = g.player.pos;
    let node = null;
    for (const n of g.roads.nodes) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d > 60 && d < 140 && n.kind === 'street') { node = n; break; } }
    if (!node) node = g.roads.nearestNode(p.x + 80, p.z);
    const v = g.vehicles.spawn('taxi', { x: node.x, z: node.z, y: 0.03 });
    v.persistent = true; v.locked = false;
    const d = g.population.spawn({ kind: 'ped', x: node.x, z: node.z });
    d.vehicle = v; v.driver = d;
    v.ai = { mode: 'direct', targetFn: () => g.player, maxSpeed: 20, arriveDist: 8 };
    g.traffic.cars.push(v);
    v.blip = { color: '#ffd23f', size: 8 };
    this.called = v;
    g.hud.notify('Taxi gerufen – es kommt gleich. Einsteigen mit G.');
  }

  /** Als Beifahrer einsteigen → Ziel wählen → Schnellreise gegen Fahrpreis. */
  enterAsPassenger(v) {
    const g = this.game;
    if (g.police.stars > 0) { g.hud.notify('Mit Fahndung nimmt dich kein Taxi mit!'); return; }
    if (g.missions.active) { g.hud.notify('Nicht während einer Mission.'); return; }
    const dests = ['playerHouse', 'tuning', 'gunshop', 'clothes', 'restaurant', 'hospital', 'police', 'bank', 'dealer', 'scrapyard', 'barber'];
    const items = [];
    if (g.missions.userWaypoint) items.push({ label: 'Zum Wegpunkt', dest: g.missions.userWaypoint });
    for (const m of g.missions.engine.available()) items.push({ label: `Mission: ${tr(m.title)}`, dest: m.start });
    for (const id of dests) items.push({ label: tr(LANDMARKS[id].name), dest: doorPosition(LANDMARKS[id], 4) });
    items.push({ label: 'Flughafen', dest: { x: -600, z: -605 } });
    g.ui.openMenu({
      title: 'Taxi', subtitle: '"Wohin soll\'s gehen?"',
      items: items.map((it) => {
        const dist = Math.hypot(it.dest.x - g.player.pos.x, it.dest.z - g.player.pos.z);
        const fare = Math.round(20 + dist * 0.15);
        return { label: it.label, sub: `${Math.round(dist)} m`, price: fare, action: () => { if (g.economy.spend(fare, 'Taxi')) this._travel(it.dest, v); return false; } };
      }),
    });
  }

  fastTravel(id) {
    const g = this.game;
    if (g.police.stars > 0) { g.hud.notify('Schnellreise mit Fahndung nicht möglich.'); return; }
    if (g.missions.active) { g.hud.notify('Nicht während einer Mission.'); return; }
    if (!g.economy.spend(100, 'Schnellreise')) { g.hud.notify('Nicht genug Geld'); return; }
    const lm = LANDMARKS[id];
    const d = lm.property === 'penthouse' ? { x: lm.x + 6, z: lm.z + 6, y: lm.h + 0.1 } : doorPosition(lm, 3);
    this._travel(d, null);
  }

  _travel(dest, taxi) {
    const g = this.game;
    const fade = g.respawn ? g.respawn.fade : null;
    if (fade) fade.style.opacity = '1';
    setTimeout(() => {
      if (g.player.vehicle) g.vehicles.exitVehicle(g.player, true);
      g.player.teleport(dest.x, dest.y ?? null, dest.z);
      g.tod.hour = (g.tod.hour + 0.5) % 24;
      if (taxi && taxi.ai) { taxi.ai = null; }
      if (fade) setTimeout(() => { fade.style.opacity = '0'; }, 400);
      events.emit('fasttravel', { dest });
      g.hud.notify('Angekommen.');
    }, 800);
  }

  update() {}
}

export { formatMoney };
