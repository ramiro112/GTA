// Registriert alle Spielsysteme in der Reihenfolge ihrer Aktualisierung.

import { Particles } from './fx/particles.js';
import { Debris } from './fx/debris.js';
import { Combat } from './weapons/combat.js';
import { VehicleManager } from './vehicles/manager.js';
import { Economy } from './economy/economy.js';
import { Services } from './vehicles/services.js';
import { Interactions } from './core/interactions.js';
import { WeaponSystem } from './weapons/weapons.js';
import { Population } from './ai/population.js';
import { PedSystem } from './ai/peds.js';
import { TrafficSystem } from './ai/traffic.js';
import { GangSystem } from './ai/gangs.js';
import { PoliceSystem } from './police/police.js';
import { RespawnSystem } from './player/respawn.js';

/** Hülle, damit das Partikelsystem wie ein System aktualisiert wird. */
class FxSystem {
  constructor(game) {
    this.fx = new Particles(game.scene, game.quality.particles);
    game.fx = this.fx;
  }
  update(dt) { this.fx.update(dt); }
}

export function installSystems(game) {
  game.systemModules = [Economy, FxSystem, Debris, Combat, WeaponSystem, Population, PedSystem, TrafficSystem, GangSystem, PoliceSystem, VehicleManager, Interactions, Services, RespawnSystem];
}
