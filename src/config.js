// ============================================================================
//  PORT AURELIA – zentrale Konfiguration ALLER Spielwerte.
//  Geschwindigkeiten in m/s, Distanzen in Metern, Zeiten in Sekunden, Preise in $.
//  Diese Datei ist bewusst frei von Abhängigkeiten (auch in Node-Tests nutzbar).
// ============================================================================

export const CONFIG = {
  version: '0.1.0',
  gameTitle: 'PORT AURELIA',
  seed: 20261008,

  // --------------------------------------------------------------------------
  physics: {
    fixedDt: 1 / 60,
    gravity: 9.81 * 1.6, // etwas stärker als real → knackigeres Spielgefühl
  },

  // --------------------------------------------------------------------------
  world: {
    half: 1100,          // Weltgrenze (unsichtbare Wand) bei ±half
    waterY: -2,          // Wasserspiegel (Meer und Fluss)
    chunkSize: 200,      // Grösse der Render-Chunks
    riverX: -210,        // Flussmitte (mäandert)
    riverWidth: 46,
    blockLines: {
      // Strassen in Nord-Süd-Richtung (konstantes x) und Ost-West-Richtung (konstantes z)
      x: [-560, -440, -320, -90, 30, 150, 270, 390, 510, 630, 750],
      z: [-420, -300, -180, -60, 60, 180, 300, 420],
    },
    ring: { minX: -680, maxX: 840, minZ: -540, maxZ: 500 }, // Autobahnring
    roadWidth: 14,
    laneOffset: 2.0,
    parkOffset: 5.3,
    highwayWidth: 22,
    sidewalkWidth: 4,
    tunnel: { z: -540, x0: 10, x1: 210, height: 8, halfWidth: 12 },
    roundabout: { x: -440, z: 60, radius: 18 },
  },

  // --------------------------------------------------------------------------
  time: {
    dayLengthMinutes: 24,   // ein Spieltag dauert 24 echte Minuten
    startHour: 9.0,
  },

  weather: {
    types: ['clear', 'cloudy', 'rain', 'fog', 'storm'],
    minDuration: 120,
    maxDuration: 300,
    weights: { clear: 4, cloudy: 3, rain: 2, fog: 1, storm: 1 },
  },

  // --------------------------------------------------------------------------
  player: {
    walkSpeed: 2.2,
    runSpeed: 5.0,
    sprintSpeed: 8.0,
    crouchSpeed: 1.6,
    swimSpeed: 2.2,
    swimSprintSpeed: 3.6,
    jumpSpeed: 6.2,
    radius: 0.35,
    height: 1.8,
    stepUp: 0.45,
    climbMaxHeight: 1.6,      // höhere Hindernisse kann man nicht überklettern
    maxHealth: 100,
    maxArmor: 100,
    maxStamina: 100,
    staminaSprintCost: 14,    // pro Sekunde
    staminaSwimCost: 6,
    staminaRegen: 18,
    fallDamageMinSpeed: 11,   // m/s Aufprall ab dem Schaden entsteht
    fallDamagePerMs: 9,       // Schaden pro m/s über Schwelle
    respawnHospitalFee: 500,
    bustFeePercent: 0.1,
    startMoney: 1500,
    enterVehicleDistance: 3.2,
  },

  camera: {
    fov: 70,
    distance: 5.2,
    height: 1.6,
    aimDistance: 1.9,
    aimOffsetX: 0.7,
    aimFov: 55,
    sniperFov: 14,
    vehicleDistance: 8,
    vehicleHeight: 2.6,
    aircraftDistance: 16,
    minPitch: -1.2,
    maxPitch: 1.1,
  },

  // --------------------------------------------------------------------------
  // Bodenfahrzeuge: Masse kg, Leistung = max. Antriebskraft N, maxSpeed m/s, grip = Reifenhaftung
  vehicles: {
    compact:   { name: { de: 'Kleinwagen "Pico"', en: 'Compact "Pico"' }, mass: 950, power: 7800, maxSpeed: 38, reverseSpeed: 9, grip: 9.0, brake: 14000, steer: 0.62, size: [1.7, 1.4, 3.6], wheelbase: 2.3, track: 1.45, wheelR: 0.32, cgHeight: 0.42, health: 800, price: 9000, scrap: 600, colors: [0xd94a38, 0x3d7dd8, 0xf2c641, 0x7cc36e, 0xffffff], fuelUse: 0.4, seats: 2 },
    sedan:     { name: { de: 'Limousine "Corvan"', en: 'Sedan "Corvan"' }, mass: 1400, power: 11500, maxSpeed: 46, reverseSpeed: 10, grip: 9.5, brake: 18000, steer: 0.58, size: [1.85, 1.45, 4.6], wheelbase: 2.8, track: 1.55, wheelR: 0.34, cgHeight: 0.45, health: 1000, price: 18000, scrap: 1100, colors: [0x2b2b33, 0x8a8f99, 0x5b1f24, 0x1f3d5b, 0xe8e8e8], fuelUse: 0.5, seats: 4 },
    sports:    { name: { de: 'Sportwagen "Velox GT"', en: 'Sports car "Velox GT"' }, mass: 1250, power: 21000, maxSpeed: 68, reverseSpeed: 11, grip: 12.0, brake: 22000, steer: 0.55, size: [1.95, 1.15, 4.4], wheelbase: 2.65, track: 1.65, wheelR: 0.34, cgHeight: 0.34, health: 850, price: 95000, scrap: 4500, colors: [0xff3b1f, 0xffd000, 0x111111, 0x00a0ff, 0x3dff7a], fuelUse: 0.8, seats: 2 },
    suv:       { name: { de: 'Pickup "Ranger"', en: 'Pickup "Ranger"' }, mass: 2100, power: 15500, maxSpeed: 44, reverseSpeed: 10, grip: 9.0, brake: 24000, steer: 0.55, size: [2.05, 1.9, 5.0], wheelbase: 3.0, track: 1.7, wheelR: 0.42, cgHeight: 0.7, health: 1400, price: 32000, scrap: 1600, colors: [0x6b5a3a, 0x2f4f2f, 0x8b0000, 0x1c1c1c, 0xcfcfcf], fuelUse: 0.7, seats: 4 },
    truck:     { name: { de: 'Lastwagen "Atlas"', en: 'Truck "Atlas"' }, mass: 7500, power: 42000, maxSpeed: 30, reverseSpeed: 6, grip: 8.5, brake: 70000, steer: 0.5, size: [2.5, 3.4, 8.5], wheelbase: 5.2, track: 2.0, wheelR: 0.55, cgHeight: 1.2, health: 2500, price: 60000, scrap: 2200, colors: [0xe0e0e0, 0x2e6fd8, 0xd8a02e], fuelUse: 1.2, seats: 2 },
    bus:       { name: { de: 'Stadtbus', en: 'City bus' }, mass: 9000, power: 46000, maxSpeed: 26, reverseSpeed: 5, grip: 8.5, brake: 85000, steer: 0.5, size: [2.55, 3.2, 11], wheelbase: 6.5, track: 2.05, wheelR: 0.55, cgHeight: 1.1, health: 2600, price: 70000, scrap: 2000, colors: [0xffb000, 0x2a9d8f], fuelUse: 1.2, seats: 8 },
    motorbike: { name: { de: 'Motorrad "Strix"', en: 'Motorbike "Strix"' }, mass: 260, power: 4600, maxSpeed: 58, reverseSpeed: 4, grip: 10.5, brake: 5200, steer: 0.5, size: [0.8, 1.2, 2.1], wheelbase: 1.45, track: 0.5, wheelR: 0.33, cgHeight: 0.45, health: 450, price: 14000, scrap: 700, colors: [0x111111, 0xcc1111, 0x1166cc, 0xeeeeee], fuelUse: 0.3, seats: 2, bike: true },
    police:    { name: { de: 'Streifenwagen', en: 'Police cruiser' }, mass: 1550, power: 16500, maxSpeed: 56, reverseSpeed: 11, grip: 10.5, brake: 21000, steer: 0.58, size: [1.9, 1.5, 4.8], wheelbase: 2.85, track: 1.6, wheelR: 0.35, cgHeight: 0.45, health: 1300, price: 0, scrap: 400, colors: [0xf5f5f5], fuelUse: 0.6, seats: 4, siren: true, emergency: 'police' },
    ambulance: { name: { de: 'Krankenwagen', en: 'Ambulance' }, mass: 3200, power: 21000, maxSpeed: 44, reverseSpeed: 8, grip: 9.0, brake: 34000, steer: 0.52, size: [2.25, 2.7, 6.0], wheelbase: 3.6, track: 1.85, wheelR: 0.42, cgHeight: 0.95, health: 1500, price: 0, scrap: 500, colors: [0xffffff], fuelUse: 0.8, seats: 2, siren: true, emergency: 'ambulance' },
    taxi:      { name: { de: 'Taxi', en: 'Taxi' }, mass: 1450, power: 12000, maxSpeed: 46, reverseSpeed: 10, grip: 9.5, brake: 18000, steer: 0.58, size: [1.85, 1.5, 4.7], wheelbase: 2.8, track: 1.55, wheelR: 0.34, cgHeight: 0.45, health: 1000, price: 15000, scrap: 900, colors: [0xffc400], fuelUse: 0.5, seats: 4, taxi: true },
    firetruck: { name: { de: 'Feuerwehr', en: 'Fire truck' }, mass: 9000, power: 52000, maxSpeed: 36, reverseSpeed: 6, grip: 8.5, brake: 85000, steer: 0.5, size: [2.5, 3.2, 9], wheelbase: 5.0, track: 2.0, wheelR: 0.55, cgHeight: 1.15, health: 3000, price: 0, scrap: 600, colors: [0xc8141e], fuelUse: 1.2, seats: 2, siren: true, emergency: 'fire' },
    swat:      { name: { de: 'SEK-Transporter', en: 'SWAT van' }, mass: 5200, power: 36000, maxSpeed: 44, reverseSpeed: 8, grip: 9.0, brake: 55000, steer: 0.52, size: [2.4, 2.8, 6.2], wheelbase: 3.8, track: 1.95, wheelR: 0.5, cgHeight: 0.9, health: 3200, price: 0, scrap: 900, colors: [0x1d2430], fuelUse: 1.0, seats: 6, siren: true, emergency: 'police', armored: true },
    military:  { name: { de: 'Militär-Geländewagen', en: 'Military jeep' }, mass: 3000, power: 26000, maxSpeed: 42, reverseSpeed: 9, grip: 10, brake: 34000, steer: 0.55, size: [2.2, 2.0, 4.8], wheelbase: 3.0, track: 1.85, wheelR: 0.48, cgHeight: 0.75, health: 3000, price: 0, scrap: 1200, colors: [0x4a5a32], fuelUse: 0.9, seats: 4, armored: true },
  },

  vehicleCommon: {
    suspensionRest: 0.45,
    suspensionTravel: 0.35,
    springK: 7.5,          // × Masse/Rad → Federsteifigkeit
    damperC: 0.9,          // × sqrt(k·m)
    rollingDrag: 0.015,
    airDrag: 0.42,
    handbrakeGripFactor: 0.32,
    driftGripFactor: 0.55,
    fireAtHealthPct: 0.18,
    smokeAtHealthPct: 0.45,
    burnTime: 7,
    explosionDamage: 200,
    explosionRadius: 9,
    flipResetTime: 3,
    collisionDamageFactor: 0.9,
    fuelCapacity: 60,
    stealHotwireTime: 2.8,
    lockedChance: 0.35,
    alarmChance: 0.6,
    alarmDuration: 15,
    driverReaction: { flee: 0.6, fight: 0.25, gun: 0.15 },
  },

  boat: {
    speedboat: { name: { de: 'Motorboot "Marlin"', en: 'Speedboat "Marlin"' }, mass: 1200, power: 14000, maxSpeed: 32, turn: 1.2, size: [2.4, 1.3, 7], health: 900, price: 40000, colors: [0xffffff, 0x1a73e8] },
  },

  // --------------------------------------------------------------------------
  aircraft: {
    heliSmall:  { kind: 'heli', name: { de: 'Helikopter "Libelle"', en: 'Helicopter "Dragonfly"' }, mass: 1400, lift: 1.8, maxSpeed: 55, yawRate: 1.6, tilt: 0.45, health: 900, fuel: 120, size: [2.2, 2.6, 9], price: 250000, weapons: false, colors: [0x2f62d8, 0xe8e8e8] },
    heliMil:    { kind: 'heli', name: { de: 'Militärhubschrauber "Falke"', en: 'Military helicopter "Falcon"' }, mass: 5000, lift: 1.75, maxSpeed: 70, yawRate: 1.3, tilt: 0.5, health: 2200, fuel: 160, size: [3, 3.4, 15], price: 0, weapons: true, colors: [0x3b4a2f] },
    planeProp:  { kind: 'plane', name: { de: 'Propellerflugzeug "Möwe"', en: 'Prop plane "Gull"' }, mass: 900, thrust: 9000, maxSpeed: 72, stallSpeed: 22, liftK: 1.0, pitchRate: 1.1, rollRate: 1.9, yawRate: 0.5, health: 700, fuel: 200, size: [10, 2.6, 8], price: 180000, weapons: false, colors: [0xf2f2f2, 0xd32f2f] },
    jet:        { kind: 'plane', name: { de: 'Düsenjet "Speer"', en: 'Jet "Spear"' }, mass: 9000, thrust: 95000, maxSpeed: 150, stallSpeed: 45, liftK: 1.0, pitchRate: 1.5, rollRate: 3.0, yawRate: 0.5, health: 1500, fuel: 300, size: [10, 3.6, 16], price: 0, weapons: true, colors: [0x6c7a89] },
  },
  flight: {
    arcadeAutoLevel: 1.6,    // Rückstellkraft im Arcade-Modus
    safeLandingVSpeed: 6,
    safeLandingSpeed: 45,
    crashSpeed: 18,
    rotorSpinUp: 3,
    parachuteDeployHeight: 6,
    parachuteFallSpeed: 5,
    parachuteSteerSpeed: 9,
  },

  // --------------------------------------------------------------------------
  // Waffen. damage = Schaden pro Treffer/Projektil; rate = Schuss/s; spread = Streuung (rad)
  weapons: {
    fist:     { slot: 0, type: 'melee', damage: 12, rate: 2.2, range: 1.6, price: 0 },
    knife:    { slot: 1, type: 'melee', damage: 35, rate: 1.8, range: 1.8, price: 150 },
    bat:      { slot: 1, type: 'melee', damage: 28, rate: 1.2, range: 2.2, price: 120, knockback: 6 },
    pistol:   { slot: 2, type: 'gun', damage: 22, rate: 4, mag: 12, reload: 1.3, spread: 0.012, recoil: 0.03, range: 120, price: 600, ammoPrice: 60, ammoPack: 24, auto: false },
    smg:      { slot: 3, type: 'gun', damage: 14, rate: 12, mag: 30, reload: 1.8, spread: 0.035, recoil: 0.018, range: 90, price: 1800, ammoPrice: 100, ammoPack: 60, auto: true, driveBy: true },
    shotgun:  { slot: 4, type: 'gun', damage: 12, pellets: 8, rate: 1.1, mag: 6, reload: 2.4, spread: 0.09, recoil: 0.09, range: 35, price: 2200, ammoPrice: 120, ammoPack: 12, auto: false },
    rifle:    { slot: 5, type: 'gun', damage: 26, rate: 9, mag: 30, reload: 2.0, spread: 0.018, recoil: 0.022, range: 180, price: 4500, ammoPrice: 180, ammoPack: 60, auto: true },
    sniper:   { slot: 6, type: 'gun', damage: 110, rate: 0.8, mag: 5, reload: 2.6, spread: 0.0, recoil: 0.12, range: 450, price: 9000, ammoPrice: 250, ammoPack: 10, auto: false, scope: true },
    grenade:  { slot: 7, type: 'throw', damage: 180, rate: 1, mag: 1, radius: 8, fuse: 2.5, throwSpeed: 18, price: 300, ammoPrice: 300, ammoPack: 3 },
    rocket:   { slot: 8, type: 'projectile', damage: 260, rate: 0.7, mag: 1, reload: 2.2, radius: 9, speed: 70, range: 400, price: 15000, ammoPrice: 800, ammoPack: 3 },
    // Fahrzeugwaffen
    mg:       { type: 'vehicle', damage: 20, rate: 14, spread: 0.02, range: 220 },
    missile:  { type: 'vehicleProjectile', damage: 300, rate: 1.2, radius: 10, speed: 110, range: 600 },
  },
  hitZones: { head: 2.5, body: 1.0, legs: 0.6 },
  autoAim: { maxAngle: 0.22, maxDistance: 70 },

  // --------------------------------------------------------------------------
  ai: {
    guardWarnTime: 4,      // Sekunden Warnung, bevor Wachen im Sperrgebiet schiessen
    pedCount: { low: 22, medium: 40, high: 60 },
    trafficCount: { low: 12, medium: 22, high: 34 },
    spawnRadius: 140,
    despawnRadius: 190,
    minSpawnDistance: 45,
    pedWalkSpeed: 1.4,
    pedRunSpeed: 5.0,
    pedHealth: 60,
    trafficSpeed: 13,
    trafficHighwaySpeed: 22,
    hearingGunshot: 60,
    witnessRadius: 45,
    witnessReportTime: 4,
    gangHealth: 100,
    gangAggroRadius: 35,
    gangAccuracy: 0.35,
    nightDensityFactor: 0.45,
    behaviorWeights: { peaceful: 5, scared: 3, aggressive: 1 },
  },

  // --------------------------------------------------------------------------
  police: {
    crimePoints: {
      stealCar: 50, carAlarm: 20, shooting: 55, assault: 40, hitPed: 50, killPed: 80,
      assaultCop: 120, killCop: 200, explosion: 90, stealAircraft: 200, trespass: 400, robbery: 160,
    },
    starThresholds: [50, 150, 350, 700, 1200],  // Punkte für 1..5 Sterne
    loseSightTime: [12, 18, 25, 32, 40],          // Sekunden ausser Sicht bis Fahndung erlischt
    searchRadius: [90, 140, 200, 260, 320],
    sightRange: 70,
    maxUnits: [2, 4, 6, 8, 10],                   // Einheiten am Boden
    helicopterFrom: 3,
    roadblockFrom: 3,
    spikeStripFrom: 3,
    swatFrom: 4,
    militaryFrom: 5,
    bustTime: 2.5,
    bustDistance: 2.2,
    copAccuracy: [0.15, 0.22, 0.3, 0.38, 0.45],
    copHealth: 100,
    swatHealth: 200,
    stolenCarRecognition: 25,                     // Polizei erkennt gemeldetes Auto in dieser Distanz
  },

  // --------------------------------------------------------------------------
  economy: {
    shops: {
      restaurant: { burger: { price: 15, heal: 30 }, menu: { price: 40, heal: 100 } },
      clothes: { price: 250 },
      barber: { price: 80 },
      fuel: { pricePerLiter: 2 },
      medkit: { price: 200, heal: 50 },
      armor: { price: 500, amount: 100 },
    },
    garage: { repairBase: 200, repairPerDamage: 1.0, paint: 400, engine: [5000, 12000, 25000], tires: [3000, 8000], armor: [6000, 15000, 30000], storePrice: 0 },
    properties: {
      safehouse_beach: { price: 60000 },
      safehouse_hills: { price: 120000 },
      penthouse: { price: 350000 },
    },
    robberyMin: 400,
    robberyMax: 1500,
  },

  // --------------------------------------------------------------------------
  activities: {
    taxiBaseFare: 60,
    taxiPerMeter: 0.5,
    ambulanceReward: 400,
    fireReward: 450,
    vigilanteReward: 350,
    raceReward: 2500,
    stuntJumpReward: 500,
    bountyReward: 2000,
  },

  // --------------------------------------------------------------------------
  graphics: {
    presets: {
      low:    { pixelRatio: 0.75, shadows: false, shadowMap: 0, drawDistance: 450, propsDensity: 0.4, antialias: false, particles: 0.5 },
      medium: { pixelRatio: 1.0,  shadows: true,  shadowMap: 1024, drawDistance: 700, propsDensity: 0.7, antialias: false, particles: 0.8 },
      high:   { pixelRatio: 1.5,  shadows: true,  shadowMap: 2048, drawDistance: 1000, propsDensity: 1.0, antialias: true, particles: 1.0 },
    },
    defaultPreset: 'medium',
  },

  audio: { master: 0.8, sfx: 0.8, music: 0.5 },

  save: { slots: 3, key: 'portAurelia.save.', settingsKey: 'portAurelia.settings' },
};

/** Stern-Stufe (0–5) aus Fahndungspunkten. */
export function starsFromHeat(heat) {
  const t = CONFIG.police.starThresholds;
  let s = 0;
  for (let i = 0; i < t.length; i++) if (heat >= t[i]) s = i + 1;
  return s;
}
