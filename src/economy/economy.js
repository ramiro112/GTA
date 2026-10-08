// Wirtschaft: Geld, Einnahmen/Ausgaben mit Statistik. (Inventar/Läden: inventory.js, shops.js)

import { CONFIG } from '../config.js';
import { events } from '../core/events.js';
import { formatMoney } from '../core/mathutil.js';

export class Economy {
  constructor(game) {
    this.game = game;
    game.economy = this;
    this.money = CONFIG.player.startMoney;
    this.ownedProperties = new Set(['home']);
    this.ownedVehicles = [];   // Garage: [{type, color, tuning, health}]
    this.garageSlots = 4;
  }

  /** Geld gutschreiben. */
  add(amount, reason = '') {
    amount = Math.round(amount);
    this.money += amount;
    if (amount > 0) this.game.stats.moneyEarned += amount;
    events.emit('money:change', { amount, reason, money: this.money });
    if (this.game.hud && amount !== 0) this.game.hud.notify(`${amount > 0 ? '+' : ''}${formatMoney(amount)} ${reason}`);
  }

  /** Bezahlen. Liefert false, wenn das Geld nicht reicht. */
  spend(amount, reason = '') {
    amount = Math.round(amount);
    if (this.money < amount) return false;
    this.money -= amount;
    events.emit('money:change', { amount: -amount, reason, money: this.money });
    return true;
  }

  canAfford(amount) { return this.money >= amount; }
}
