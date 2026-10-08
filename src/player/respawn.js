// Tod ("Schwer verletzt") und Festnahme ("Verhaftet"): Zeitlupe, Einblendung, Abblende,
// Wiederbelebung im Krankenhaus bzw. Freilassung an der Polizeistation, Verlust von Waffen und Geld.

import { CONFIG } from '../config.js';
import { events } from '../core/events.js';
import { t } from '../core/i18n.js';
import { formatMoney } from '../core/mathutil.js';

export class RespawnSystem {
  constructor(game) {
    this.game = game;
    game.respawn = this;
    this.pending = null;
    const fade = document.createElement('div');
    fade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;transition:opacity 0.8s;pointer-events:none;z-index:30';
    game.uiRoot.appendChild(fade);
    this.fade = fade;
    events.on('player:died', (info) => this.start('dead', info));
    events.on('player:busted', () => this.start('busted'));
  }

  start(kind, info = {}) {
    if (this.pending) return;
    const g = this.game;
    const pl = g.player;
    if (kind === 'busted') {
      pl.dead = false;
      if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
      pl.state = 'hands';
      pl.model.animate(0.016, { state: 'hands' });
      g.stats.arrests++;
      g.hud.center(t('hud.busted'), 'busted', '', 4);
    } else {
      g.stats.deaths++;
      g.hud.center(t('hud.wasted'), 'wasted', info.type === 'fall' ? 'Fallschaden' : '', 4);
    }
    g.loop.timeScale = 0.35;
    this.pending = { kind, t: 0 };
    events.emit('mission:abort', { reason: kind });
  }

  update(dt) {
    const p = this.pending;
    if (!p) return;
    p.t += dt / Math.max(0.2, this.game.loop.timeScale);
    if (p.t > 2.2 && !p.faded) { p.faded = true; this.fade.style.opacity = '1'; }
    if (p.t > 3.4 && !p.done) { p.done = true; this._respawn(p.kind); }
    if (p.t > 4.4) { this.fade.style.opacity = '0'; this.pending = null; }
  }

  _respawn(kind) {
    const g = this.game;
    const pl = g.player;
    const eco = g.economy;
    g.loop.timeScale = 1;
    // Wer im Fahrzeug gestorben ist, sitzt sonst nach dem Respawn weiter darin
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    const sp = kind === 'busted' ? g.city.landmarks.spawnPoints.police : g.city.landmarks.spawnPoints.hospital;
    const fee = kind === 'busted' ? Math.max(100, Math.round(eco.money * CONFIG.player.bustFeePercent)) : CONFIG.player.respawnHospitalFee;
    const paid = Math.min(Math.max(0, eco.money), fee);
    eco.money -= paid;
    // Waffen verlieren (Faust bleibt); bei Tod bleibt die Weste weg
    const lost = pl.inventory.slots.filter((s) => s && s.id !== 'fist').length;
    pl.inventory.clear();
    g.weapons._equipModel();
    pl.armor = 0;
    pl.model.setVest(false);
    pl.inCover = null;
    pl.revive();
    pl.teleport(sp.x, null, sp.z, sp.heading);
    g.camera3p.yaw = sp.heading;
    g.tod.hour = (g.tod.hour + 4) % 24;
    events.emit('player:respawn', { kind });
    g.hud.notify(kind === 'busted' ? `Kaution: ${formatMoney(paid)}${lost ? ' · Waffen beschlagnahmt' : ''}` : `Krankenhausrechnung: ${formatMoney(paid)}${lost ? ' · Waffen verloren' : ''}`, 6000);
  }
}
