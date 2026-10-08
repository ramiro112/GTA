// Testszenarien für den Smoke-Test. Jede Funktion bekommt {page, shot, wait}.
// Hinweis: Headless-Chromium rendert per Software (sehr langsam). Deshalb wird die Simulation
// über game.simulate(s) vorgespult und nur für Screenshots gerendert.

const ev = (page, fn, arg) => page.evaluate(fn, arg);
const view = (page, x, z, yaw, pitch = 0.15, hour = 12) => ev(page, ([x, z, yaw, pitch, hour]) => {
  const g = window.game; g.player.teleport(x, null, z, yaw); g.camera3p.yaw = yaw; g.camera3p.pitch = pitch; g.tod.hour = hour; g.simulate(0.3);
}, [x, z, yaw, pitch, hour]);

const scen = {
  async basic({ page, shot, wait }) {
    await page.click('[data-a=new]');
    await wait(500);
    await shot('01_start');
    // Laufen per Tastatur (simuliert)
    const before = await ev(page, () => window.game.player.pos.z);
    await page.keyboard.down('KeyW');
    await ev(page, () => window.game.simulate(2));
    await page.keyboard.up('KeyW');
    const after = await ev(page, () => window.game.player.pos.z);
    console.log('Laufen: z', before.toFixed(2), '→', after.toFixed(2));
    if (Math.abs(after - before) < 5) throw new Error('Spieler bewegt sich nicht');
    // Springen
    await page.keyboard.down('Space');
    await ev(page, () => window.game.simulate(0.1));
    await page.keyboard.up('Space');
    const y = await ev(page, () => window.game.player.pos.y);
    console.log('Sprung y', y.toFixed(2));
    await ev(page, () => window.game.simulate(1));
    await view(page, 150, -250, Math.PI, -0.1); await shot('02_downtown');
    await view(page, -60, -540, Math.PI / 2, 0.05); await shot('03_tunnel');
    await view(page, -250, -60, Math.PI / 2, 0.1); await shot('04_bridge');
    await view(page, 300, 530, Math.PI, 0.1, 17.5); await shot('05_beach_sunset');
    await view(page, -500, -680, -Math.PI / 2, 0.1); await shot('06_airport');
    await view(page, 90, -90, Math.PI, 0.2); await shot('07_parkhaus');
    await view(page, -440, 30, 0, 0.3); await shot('08_roundabout');
    await view(page, 210, -60, Math.PI, 0.05, 22); await shot('09_night');
    await view(page, 600, -650, 0, 0.1); await shot('10_military');
    await view(page, -60, -650, 0, 0.2); await shot('11_mountains');
  },
};
export default scen;

scen.vehicles = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game;
    const log = [];
    g.player.teleport(90, null, 60, Math.PI / 2);
    const v = g.vehicles.spawn('sedan', { x: 96, z: 57.5, heading: Math.PI / 2 });
    v.locked = true; v.hasAlarm = true;
    g.simulate(1.0);
    log.push('Auto y=' + v.pos.y.toFixed(2) + ' com=' + v.comHeight.toFixed(2) + ' wheels=' + v.wheelsOnGround);
    g.vehicles.beginEnter(v);
    g.simulate(5);
    log.push('Im Auto: ' + (g.player.vehicle === v) + ' Scheibe=' + v.windowBroken + ' Alarm=' + (v.alarmTimer > 0));
    return log;
  });
  console.log(r.join('\n'));
  await page.keyboard.down('KeyW');
  const d1 = await page.evaluate(() => { const g = window.game; g.simulate(4); const v = g.player.vehicle; return { speed: v.speed * 3.6, x: v.pos.x, z: v.pos.z, up: v.up.y }; });
  console.log('Nach 4 s Gas:', JSON.stringify(d1));
  await shot('01_driving');
  await page.keyboard.down('KeyD');
  const d2 = await page.evaluate(() => { const g = window.game; g.simulate(1.5); const v = g.player.vehicle; return { speed: v.speed * 3.6, heading: v.heading, up: v.up.y }; });
  console.log('Lenken rechts:', JSON.stringify(d2));
  await page.keyboard.down('Space');
  const d3 = await page.evaluate(() => { const g = window.game; g.simulate(1.0); const v = g.player.vehicle; return { speed: v.speed * 3.6, heading: v.heading, skid: v.skid }; });
  console.log('Handbremse:', JSON.stringify(d3));
  await page.keyboard.up('Space'); await page.keyboard.up('KeyD');
  await page.evaluate(() => window.game.simulate(3));
  await page.keyboard.up('KeyW');
  await shot('02_after');
  const d4 = await page.evaluate(() => { const g = window.game; const v = g.player.vehicle; return { health: v.health, pos: v.pos.toArray().map((n) => +n.toFixed(1)), stolen: v.stolen, carsStolen: g.stats.carsStolen }; });
  console.log('Zustand:', JSON.stringify(d4));
  // Rückwärts
  await page.keyboard.down('KeyS');
  const d5 = await page.evaluate(() => { const g = window.game; g.simulate(3); return g.player.vehicle.speed * 3.6; });
  await page.keyboard.up('KeyS');
  console.log('Rückwärts km/h:', d5.toFixed(1));
  // Aussteigen
  const d6 = await page.evaluate(() => { const g = window.game; g.simulate(2); g.vehicles.exitVehicle(g.player); g.simulate(0.5); return { inCar: !!g.player.vehicle, p: g.player.pos.toArray().map((n) => +n.toFixed(1)) }; });
  console.log('Ausgestiegen:', JSON.stringify(d6));
  // Crash in Wand
  const d7 = await page.evaluate(() => {
    const g = window.game;
    const v = g.vehicles.spawn('compact', { x: 182, z: -58, heading: Math.PI });
    g.simulate(0.5);
    v.vel.set(0, 0, -25); v.wake();
    const h0 = v.health;
    g.simulate(3);
    return { before: h0, after: v.health.toFixed(0), fire: v.onFire, z: v.pos.z.toFixed(1), dmg: v.damageLevel.toFixed(2) };
  });
  console.log('Crash:', JSON.stringify(d7));
  await page.evaluate(() => { const g = window.game; const v = g.vehicles.list.at(-1); g.player.teleport(v.pos.x + 6, null, v.pos.z + 6); g.camera3p.yaw = Math.atan2(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z); g.simulate(0.2); });
  await shot('03_crash');
  // Explosion
  await page.evaluate(() => { const g = window.game; const v = g.vehicles.list.at(-1); v.damage(5000, {}); g.simulate(0.3); });
  await shot('04_explosion');
};

scen.boat = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game;
    const out = [];
    const b = g.vehicles.spawn('speedboat', { x: 930, z: 200, heading: Math.PI / 2 });
    g.player.teleport(925, null, 200);
    g.vehicles._seatPlayer(b);
    g.simulate(1);
    out.push('Boot y=' + b.pos.y.toFixed(2));
    return out;
  });
  console.log(r.join('\n'));
  await page.keyboard.down('KeyW');
  const d = await page.evaluate(() => { const g = window.game; g.simulate(4); const b = g.player.vehicle; return { kmh: (b.speed * 3.6).toFixed(0), x: b.pos.x.toFixed(0), y: b.pos.y.toFixed(2) }; });
  await page.keyboard.up('KeyW');
  console.log('Boot fährt:', JSON.stringify(d));
  await page.evaluate(() => { const g = window.game; g.camera3p.yaw = g.player.vehicle.heading; g.simulate(0.3); });
  await shot('01_boat');
  // Aussteigen → Schwimmen
  const s = await page.evaluate(() => { const g = window.game; g.vehicles.exitVehicle(g.player); g.simulate(2); return { swim: g.player.swimming, y: g.player.pos.y.toFixed(2) }; });
  console.log('Schwimmen:', JSON.stringify(s));
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.game.simulate(1));
  await page.keyboard.up('KeyW');
  await shot('02_swim');
};

scen.garage = async ({ page }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game;
    const out = [];
    const v = g.vehicles.spawn('sports', { x: 96, z: 88, heading: 0 });
    v.locked = false;
    g.player.teleport(92, null, 88);
    g.vehicles._seatPlayer(v);
    g.simulate(0.5);
    g.interactions.update();
    out.push('paused=' + g.paused + ' pts=' + g.interactions.points.filter((p) => p.type === 'garage').map((p) => p.garage + '@' + p.x.toFixed(0) + ',' + p.z.toFixed(0) + ' r' + p.r).join(';') + ' pos=' + v.pos.x.toFixed(1) + ',' + v.pos.z.toFixed(1));
    out.push('Interaktion: ' + (g.interactions.current ? g.interactions.current.type : 'keine'));
    g.interactions.handlers.get('garage').action(g.interactions.current);
    out.push('Menü offen: ' + !!g.ui.menu + ' Einträge: ' + g.ui.menu.items.map((i) => i.label).join(' | '));
    g.ui._menuSelect(0);
    out.push('Eingelagert: ' + g.economy.ownedVehicles.length + ' im Auto: ' + !!g.player.vehicle);
    // Abholen
    g.interactions.update();
    g.interactions.handlers.get('garage').action(g.interactions.current);
    g.ui._menuSelect(0);
    out.push('Abgeholt, im Auto: ' + !!g.player.vehicle + ' owned=' + g.player.vehicle.owned);
    // Tuning
    const v2 = g.player.vehicle;
    v2.damage(300, {});
    g.player.teleport(330, null, 86); v2.pos.set(330, v2.pos.y, 86);
    g.simulate(0.2);
    g.interactions.update();
    out.push('Werkstatt: ' + (g.interactions.current && g.interactions.current.garage));
    g.economy.money = 50000;
    g.interactions.handlers.get('garage').action(g.interactions.current);
    out.push('Werkstatt-Menü: ' + g.ui.menu.items.length + ' Einträge');
    g.ui._menuSelect(0); // reparieren
    out.push('Gesundheit nach Reparatur: ' + v2.health + ' Geld: ' + g.economy.money);
    const engineIdx = g.ui.menu.items.findIndex((i) => i.label.startsWith('Motor'));
    g.ui._menuSelect(engineIdx);
    out.push('Motorstufe: ' + v2.tuning.engine);
    g.ui.closeMenu();
    // Schrottplatz
    const s = g.vehicles.spawn('sedan', { x: 690, z: -120 });
    g.player.teleport(688, null, -120);
    g.vehicles._seatPlayer(s);
    g.simulate(0.2);
    g.interactions.update();
    const m0 = g.economy.money;
    g.interactions.handlers.get('scrap').action(g.interactions.current);
    g.ui._menuSelect(0);
    out.push('Schrott: +' + (g.economy.money - m0));
    return out;
  });
  console.log(r.join('\n'));
};
scen.dbg = async ({ page }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => {
    const g = window.game;
    const v = g.vehicles.spawn('sports', { x: 96, z: 88, heading: 0 });
    g.player.teleport(92, null, 88);
    g.vehicles._seatPlayer(v);
    g.simulate(0.5);
    g.interactions.update();
    return JSON.stringify({ paused: g.paused, pts: g.interactions.points.filter((p) => p.type === 'garage').map((p) => [p.garage, p.x, p.z, p.r]), pos: v.pos.toArray(), handlers: [...g.interactions.handlers.keys()], cur: g.interactions.current && g.interactions.current.type, dead: g.player.dead });
  }));
};

scen.weapons = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game;
    const out = [];
    const pl = g.player;
    pl.teleport(150, null, -120, Math.PI);
    g.camera3p.yaw = Math.PI; g.camera3p.pitch = 0.0;
    pl.inventory.give('pistol', 48); pl.inventory.give('rifle', 120); pl.inventory.give('shotgun', 24); pl.inventory.give('grenade', 3); pl.inventory.give('rocket', 3); pl.inventory.give('bat');
    const npc = g.population.spawn({ kind: 'gang_rust', x: 150, z: -132, heading: 0 });
    g.simulate(0.3);
    out.push('NPC HP ' + npc.health);
    // Pistole
    pl.inventory.select(2); g.weapons._equipModel();
    const inp = g.input;
    inp.codesDown.add('Mouse2');
    for (let i = 0; i < 6; i++) { inp.tap('Mouse0'); g.simulate(0.3); }
    inp.codesDown.delete('Mouse2');
    out.push('Nach 6 Pistolenschüssen: HP ' + npc.health.toFixed(0) + ' tot=' + npc.dead + ' Magazin ' + pl.inventory.current.mag + '/' + pl.inventory.current.ammo + ' Treffer ' + g.stats.hits + '/' + g.stats.shots);
    return out;
  });
  console.log(r.join('\n'));
  await shot('01_pistol');
  const r2 = await page.evaluate(() => {
    const g = window.game, pl = g.player, inp = g.input, out = [];
    // Sturmgewehr Dauerfeuer auf neuen Gegner
    const npc = g.population.spawn({ kind: 'gang_wolves', x: 150, z: -140, heading: 0 });
    pl.inventory.select(5); g.weapons._equipModel();
    g.camera3p.pitch = 0.02;
    inp.codesDown.add('Mouse2'); inp.codesDown.add('Mouse0');
    g.simulate(1.5);
    inp.codesDown.delete('Mouse0'); inp.codesDown.delete('Mouse2');
    out.push('Gewehr: Gegner tot=' + npc.dead + ' Pickups=' + g.weapons.pickups.length + ' Rückstoss pitch=' + g.camera3p.pitch.toFixed(2));
    // Nachladen
    const w = pl.inventory.current; w.mag = 3;
    inp.tap('KeyR'); g.simulate(2.5);
    out.push('Nach Nachladen: ' + w.mag + '/' + w.ammo);
    // Granate
    pl.inventory.select(7); g.weapons._equipModel();
    const car = g.vehicles.spawn('sedan', { x: 150, z: -150, heading: 0 });
    g.simulate(0.3);
    g.camera3p.pitch = 0.1;
    inp.tap('Mouse0'); g.simulate(3.5);
    out.push('Granate: Auto HP ' + car.health.toFixed(0) + ' Brand=' + car.onFire + ' zerstört=' + car.destroyed);
    // Rakete
    pl.inventory.select(8); g.weapons._equipModel();
    const car2 = g.vehicles.spawn('suv', { x: 150, z: -165, heading: 0 });
    g.simulate(0.3);
    g.camera3p.pitch = 0.05;
    inp.codesDown.add('Mouse2'); inp.tap('Mouse0'); g.simulate(1.0); inp.codesDown.delete('Mouse2');
    out.push('Rakete: SUV HP ' + car2.health.toFixed(0) + ' zerstört=' + car2.destroyed + ' Brände=' + g.combat.fires.length);
    // Nahkampf
    pl.inventory.select(1); g.weapons._equipModel();
    const ped = g.population.spawn({ kind: 'ped', x: pl.pos.x, z: pl.pos.z - 1.2, heading: 0 });
    pl.heading = Math.PI;
    for (let i = 0; i < 4; i++) { inp.tap('Mouse0'); g.simulate(0.9); }
    out.push('Schläger: Passant HP ' + ped.health.toFixed(0) + ' tot=' + ped.dead);
    // Waffen aufsammeln
    const pk = g.weapons.pickups.find((p) => !p.respawn);
    if (pk) { pl.teleport(pk.pos.x, null, pk.pos.z); g.simulate(0.3); out.push('Aufgesammelt: ' + pk.type + ' noch da=' + g.weapons.pickups.includes(pk)); }
    // Deckung
    pl.teleport(176, null, -75.2, Math.PI); g.simulate(0.2);
    g.weapons.toggleCover(pl);
    out.push('Deckung: ' + !!pl.inCover);
    return out;
  });
  console.log(r2.join('\n'));
  await shot('02_after');
};
scen.dbg2 = async ({ page }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => { const g = window.game; g.simulate(0.2); return JSON.stringify({ armor: g.player.armor, w: document.querySelector('#minimap-wrap .bar.armor > div').style.width, h: document.querySelector('#minimap-wrap .bar.health > div').style.width }); }));
};

scen.ai = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [];
    g.player.teleport(150, null, -190, Math.PI); g.camera3p.yaw = Math.PI;
    g.simulate(6);
    const peds = g.peds.peds.length, cars = g.traffic.cars.length;
    out.push(`Ped-Graph ${g.peds.graph.length} Knoten · Passanten ${peds} · Verkehr ${cars} (Ziel ${g.traffic.targetCount()})`);
    // Verkehr bewegt sich?
    const moving = g.traffic.cars.filter((v) => Math.abs(v.speed) > 2).length;
    g.simulate(10);
    const moving2 = g.traffic.cars.filter((v) => Math.abs(v.speed) > 2).length;
    const stuck = g.traffic.cars.filter((v) => v.ai && v.ai.blocked > 4).length;
    const flipped = g.traffic.cars.filter((v) => v.up && v.up.y < 0.5).length;
    out.push(`Fahrende Autos: ${moving} → ${moving2}, feststeckend ${stuck}, umgekippt ${flipped}`);
    const walking = g.peds.peds.filter((n) => Math.hypot(n.vel.x, n.vel.z) > 0.5).length;
    const states = {}; for (const n of g.peds.peds) states[n.brain.state] = (states[n.brain.state] || 0) + 1;
    out.push(`Gehende Passanten: ${walking}, Zustände ${JSON.stringify(states)}`);
    // Schuss in die Luft → Panik
    g.events.emit('weapon:fired', { pos: g.player.pos.clone(), shooter: g.player });
    g.simulate(0.5);
    const st2 = {}; for (const n of g.peds.peds) st2[n.brain.state] = (st2[n.brain.state] || 0) + 1;
    out.push('Nach Schuss: ' + JSON.stringify(st2));
    return out;
  });
  console.log(r.join('\n'));
  await page.evaluate(() => { const g = window.game; g.camera3p.pitch = 0.25; g.simulate(0.2); });
  await shot('01_city_life');
  const r2 = await page.evaluate(() => {
    const g = window.game, out = [];
    // Bandengebiet
    g.player.teleport(560, null, -60, 0); g.simulate(3);
    const grp = g.gangs.groups.map((x) => `${x.gang}:${x.members.length}`);
    out.push('Bandengruppen: ' + grp.join(', '));
    const target = g.gangs.groups[0];
    if (target) {
      const m = target.members[0];
      g.player.teleport(m.pos.x + 12, null, m.pos.z, 0);
      g.player.health = 1e9;
      g.simulate(9);
      out.push(`Gruppe provoziert: ${target.provoked}, Spieler-HP-Verlust: ${(1e9 - g.player.health).toFixed(0)}, Verstärkungen: ${target.reinforcements}`);
      g.player.health = 100;
    }
    // Fahrer aus Auto ziehen
    const car = g.traffic.cars.find((v) => v.driver && !v.driver.isPlayer);
    if (car) {
      g.player.teleport(car.pos.x + 3, null, car.pos.z);
      car.vel.set(0, 0, 0); car.ai.mode = 'direct'; car.ai.goal = car.pos.clone();
      g.vehicles.beginEnter(car);
      g.simulate(2.5);
      const ex = g.population.characters.filter((c) => c.lastJacked);
      out.push(`Auto entführt: Spieler im Auto ${g.player.vehicle === car}, Fahrer-Brain ${g.population.characters.find((c) => c.vehicle === null && c.brain && c.brain.constructor.name !== 'PedBrain' && c.hostile) ? 'kämpft' : 'flieht/anders'}`);
    }
    return out;
  });
  console.log(r2.join('\n'));
  await shot('02_gang');
};

scen.police = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [];
    const pl = g.player;
    pl.teleport(330, null, -300, Math.PI); g.camera3p.yaw = Math.PI;
    pl.inventory.give('pistol', 200); pl.inventory.select(2); g.weapons._equipModel();
    g.simulate(1);
    // Polizist in Sichtweite, Spieler schiesst
    const cop = g.population.spawn({ kind: 'cop', x: 330, z: -285 });
    cop.give('pistol'); cop.equip('fist');
    g.simulate(0.5);
    const inp = g.input;
    inp.tap('Mouse0'); g.simulate(0.3);
    out.push('Nach Schuss neben Polizist: Sterne ' + g.police.stars);
    g.police.wanted.ensureStars(3, pl.pos);
    pl.health = 1e9;
    g.simulate(12);
    out.push(`3 Sterne: Streifenwagen ${g.police.cars.length}, Polizisten ${g.police.cops.length}, gesehen ${g.police.playerSeen}`);
    return out;
  });
  console.log(r.join('\n'));
  await shot('01_police');
  const r2 = await page.evaluate(() => {
    const g = window.game, out = [], pl = g.player;
    // Fahrzeugflucht → Strassensperre
    const v = g.vehicles.spawn('sports', { x: 330, z: -300, heading: Math.PI / 2 });
    pl.teleport(328, null, -300); g.vehicles._seatPlayer(v);
    g.police.roadblockTimer = 0;
    g.input.codesDown.add('KeyW');
    g.simulate(6);
    g.input.codesDown.delete('KeyW');
    out.push(`Strassensperren ${g.police.roadblocks.length}, Nagelbänder ${g.police.spikes.length}, Reifen platt ${v.wheels.filter((w) => w.burst).length}`);
    // Festnahme: Spieler zu Fuss, Polizist daneben, 1 Stern
    g.vehicles.exitVehicle(pl);
    g.police.reset();
    pl.teleport(90, null, 300);
    g.simulate(0.5);
    pl.health = 100;
    g.police.wanted.ensureStars(1, pl.pos);
    pl.inventory.select(0);
    const c = g.police._makeCop('cop', pl.pos.x + 1, pl.pos.z);
    const hist = [];
    for (let i = 0; i < 8; i++) { g.simulate(0.5); hist.push(`${g.police.stars}/${g.police.bustTimer.toFixed(1)}/${c.pos.distanceTo(pl.pos).toFixed(1)}/${pl.speed?.toFixed(1)}`); }
    out.push('Verlauf Sterne/Bust/Abstand/Tempo: ' + hist.join(' ') + ' Historie: ' + g.police.wanted.history.map((h) => h.type).join(','));
    out.push('Festnahme ausgelöst: ' + !!g.respawn?.pending + ' Kopfgeld-Gefühl: ' + g.stats.arrests);
    g.simulate(6);
    out.push(`Nach Festnahme: Sterne ${g.police.stars}, Position ${pl.pos.x.toFixed(0)},${pl.pos.z.toFixed(0)}, Waffen ${pl.inventory.slots.filter(Boolean).length}, Geld ${g.economy.money}`);
    // Tod → Krankenhaus
    pl.damage(500, { type: 'test' });
    g.simulate(8);
    out.push(`Nach Tod: HP ${pl.health}, tot ${pl.dead}, Position ${pl.pos.x.toFixed(0)},${pl.pos.z.toFixed(0)}, Tode ${g.stats.deaths}`);
    return out;
  });
  console.log(r2.join('\n'));
};

scen.flight = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [], pl = g.player;
    // Helikopter: Start, Schweben, Vorwärtsflug
    const h = g.vehicles.spawn('heliSmall', { x: -520, z: -700, heading: 0 });
    pl.teleport(-516, null, -700); g.vehicles._seatPlayer(h);
    g.simulate(0.5);
    out.push(`Heli am Boden y=${h.pos.y.toFixed(2)} alt=${h.altitude.toFixed(2)}`);
    const inp = g.input;
    inp.codesDown.add('ShiftLeft'); g.simulate(5); inp.codesDown.delete('ShiftLeft');
    out.push(`Nach Steigen: alt=${h.altitude.toFixed(1)} rotor=${h.rotor.toFixed(2)} HP=${h.health.toFixed(0)}`);
    const a0 = h.altitude;
    g.simulate(3);
    out.push(`Schweben (3 s ohne Eingabe): alt ${a0.toFixed(1)} → ${h.altitude.toFixed(1)}`);
    inp.codesDown.add('KeyW'); g.simulate(4); inp.codesDown.delete('KeyW');
    out.push(`Vorwärts: ${(h.vel.length() * 3.6).toFixed(0)} km/h, Nick ${(h.pitchAngle * 57.3).toFixed(0)}°, Kurs ${h.heading.toFixed(2)}`);
    inp.codesDown.add('KeyD'); g.simulate(1); out.push(`Rollen rechts: ${(h.rollAngle * 57.3).toFixed(0)}°`); inp.codesDown.delete('KeyD');
    inp.codesDown.add('KeyE'); g.simulate(1.5); out.push(`Gieren rechts: Kurs ${h.heading.toFixed(2)}`); inp.codesDown.delete('KeyE');
    g.simulate(2);
    // Absprung + Fallschirm
    inp.codesDown.add('ShiftLeft'); g.simulate(4); inp.codesDown.delete('ShiftLeft');
    out.push(`Höhe vor Absprung: ${h.altitude.toFixed(0)} m`);
    g.vehicles.exitVehicle(pl);
    g.simulate(1);
    inp.tap('Space'); g.simulate(0.2);
    out.push(`Fallschirm offen: ${pl.parachute}, vy=${pl.vel.y.toFixed(1)}`);
    g.simulate(12);
    out.push(`Gelandet: onGround=${pl.onGround} HP=${pl.health.toFixed(0)} Heli zerstört=${h.destroyed}`);
    return out;
  });
  console.log(r.join('\n'));
  const r2 = await page.evaluate(() => {
    const g = window.game, out = [], pl = g.player, inp = g.input;
    // Flugzeug: Startlauf auf der Piste
    const p = g.vehicles.spawn('planeProp', { x: -880, z: -770, heading: Math.PI / 2 });
    pl.teleport(-878, null, -767); pl.dead = false; pl.health = 100; g.vehicles._seatPlayer(p);
    g.simulate(0.5);
    out.push(`Flugzeug am Boden alt=${p.altitude.toFixed(2)} Fahrwerk ${p.gearDown}`);
    inp.codesDown.add('ShiftLeft'); g.simulate(2.5); inp.codesDown.delete('ShiftLeft');
    g.simulate(6);
    out.push(`Startlauf: ${(p.speed * 3.6).toFixed(0)} km/h, Schub ${(p.throttle * 100).toFixed(0)}%, alt ${p.altitude.toFixed(1)}`);
    inp.codesDown.add('KeyS'); g.simulate(1.2); inp.codesDown.delete('KeyS');
    g.simulate(4);
    out.push(`Nach Rotation: alt ${p.altitude.toFixed(1)} m, ${(p.speed * 3.6).toFixed(0)} km/h, Nick ${(p.pitchAngle * 57.3).toFixed(0)}°, stall=${p.stalled}, HP ${p.health.toFixed(0)}`);
    inp.tap('KeyG'); g.simulate(0.1);
    out.push('Fahrwerk eingefahren: ' + !p.gearDown);
    inp.codesDown.add('KeyD'); g.simulate(1.2); inp.codesDown.delete('KeyD');
    out.push(`Kurve: Roll ${(p.rollAngle * 57.3).toFixed(0)}°`);
    const tr = [];
    for (let i = 0; i < 6; i++) { g.simulate(0.5); tr.push(`${p.altitude.toFixed(0)}m/${(p.pitchAngle * 57.3).toFixed(0)}°/${(p.rollAngle * 57.3).toFixed(0)}°/${(p.vel.length() * 3.6).toFixed(0)}`); }
    out.push('Verlauf alt/nick/roll/kmh: ' + tr.join(' '));
    out.push(`Nach Kurve: alt ${p.altitude.toFixed(1)} m Roll ${(p.rollAngle * 57.3).toFixed(0)}° Kurs ${p.heading.toFixed(2)}`);
    return out;
  });
  console.log(r2.join('\n'));
  await page.evaluate(() => { const g = window.game; g.camera3p.yaw = g.player.vehicle ? g.player.vehicle.heading : 0; g.simulate(0.2); });
  await shot('01_plane');
  const r3 = await page.evaluate(() => {
    const g = window.game, out = [], pl = g.player;
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    pl.teleport(150, null, -200); pl.health = 1e6;
    g.police.wanted.ensureStars(4, pl.pos);
    g.police.heliTimer = 0;
    g.simulate(14);
    const h = g.police.heli;
    out.push(`Polizeiheli: ${!!h} Abstand ${h ? h.pos.distanceTo(pl.pos).toFixed(0) : '-'} m, Spieler-Schaden ${(1e6 - pl.health).toFixed(0)}`);
    return out;
  });
  console.log(r3.join('\n'));
  await page.evaluate(() => { const g = window.game; g.camera3p.pitch = -0.6; g.simulate(0.1); });
  await shot('02_police_heli');
};

scen.missions = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(async () => {
    const g = window.game, out = [], pl = g.player, M = g.missions, E = M.engine;
    const skip = (sec) => { for (let i = 0; i < sec * 4; i++) { g.input.tap('Enter'); g.simulate(0.25); } };
    out.push('Verfügbar: ' + E.available().map((m) => m.id).join(','));
    // Mission 1 durchspielen
    pl.teleport(64, null, 73); g.simulate(0.5);
    out.push('Aktiv nach Marker: ' + (E.active && E.active.id));
    skip(3);
    const car = E.active.data.car;
    out.push('Stufe ' + E.active.stage + ', Auto: ' + !!car);
    pl.teleport(car.pos.x - 2, null, car.pos.z); g.vehicles._seatPlayer(car); g.simulate(0.5);
    out.push('Stufe nach Einsteigen ' + E.active.stage);
    car.pos.set(330, car.pos.y, 66); car.vel.set(0, 0, 0); g.simulate(1.5);
    skip(4);
    out.push('Mission 1 erledigt: ' + E.completed.has('heimkehr') + ', Geld ' + g.economy.money + ', Pistole ' + pl.inventory.has('pistol'));
    // Alle Missionen anlaufen lassen
    for (const id of [...E.missions.keys()]) {
      const def = E.missions.get(id);
      for (const r of def.requires || []) E.completed.add(r);
      if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
      pl.revive(); g.police.reset();
      pl.teleport(def.start.x, null, def.start.z); g.simulate(0.4);
      if (!E.active) { out.push(id + ': NICHT gestartet'); continue; }
      skip(5);
      const st = E.active ? E.active.stage : 'beendet';
      out.push(`${id}: Stufe ${st} – ${document.getElementById('hud-objective').textContent.slice(0, 70)}`);
      if (E.active) E.abort('Test');
      g.simulate(0.3);
      E.completed.delete(id);
    }
    return out;
  });
  console.log(r.join('\n'));
};
scen.dbg3 = async ({ page }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => {
    const g = window.game, pl = g.player, E = g.missions.engine, out = [];
    E.completed.add('heimkehr'); E.completed.add('ersatzteile');
    pl.teleport(330, null, 70); g.simulate(0.4);
    out.push('aktiv ' + (E.active && E.active.id) + ' stage ' + E.active.stage);
    for (let i = 0; i < 12; i++) { g.input.tap('Enter'); g.simulate(0.25); out.push(`t${i} stage ${E.active ? E.active.stage : '-'} enemies ${E.active && E.active.data.enemies ? E.active.data.enemies.map((n) => (n.dead ? 'D' : n.removed ? 'R' : 'A')).join('') : '-'} wave ${E.active && E.active.data.wave}`); }
    return out.join('\n');
  }));
};

scen.ui = async ({ page, shot, wait }) => {
  // Hauptmenü-Unterseiten
  for (const a of ['settings', 'controls', 'credits', 'load']) {
    await page.click(`[data-a=${a}]`);
    await wait(200);
    if (a === 'settings' || a === 'controls') await shot('menu_' + a);
    await page.click('[data-a=back]');
  }
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [];
    g.simulate(0.5);
    // Speichern am Bett im eigenen Haus
    const bed = g.interactions.points.find((p) => p.type === 'save' && p.lm && p.lm.id === 'playerHouse');
    g.player.teleport(bed.x, null, bed.z); g.simulate(0.3);
    out.push('Speichern möglich: ' + g.saves.canSaveHere());
    g.economy.money = 4242;
    g.player.inventory.give('smg', 60);
    g.saves.save('1');
    g.economy.money = 1; g.player.teleport(500, null, 500);
    g.saves.load('1'); g.simulate(0.2);
    out.push(`Geladen: Geld ${g.economy.money}, MP ${g.player.inventory.has('smg')}, Pos ${g.player.pos.x.toFixed(0)},${g.player.pos.z.toFixed(0)}`);
    out.push('Slots: ' + g.saves.list().map((s) => s.slot + ':' + (s.meta ? 'belegt' : 'leer')).join(' '));
    return out;
  });
  console.log(r.join('\n'));
  // Waffenladen
  await page.evaluate(() => { const g = window.game; g.player.teleport(182, null, -79); g.simulate(0.3); g.economy.money = 20000; g.interactions.update(); g.interactions.handlers.get('shop').action(g.interactions.points.find((p) => p.shop === 'gunshop')); });
  await wait(200);
  await shot('shop_gunshop');
  const r2 = await page.evaluate(() => { const g = window.game; const i = g.ui.menu.items.findIndex((x) => x.label.includes('Schrotflinte')); g.ui._menuSelect(i); const ok = g.player.inventory.has('shotgun'); g.ui.closeMenu(); return 'Schrotflinte gekauft: ' + ok + ', Geld ' + g.economy.money; });
  console.log(r2);
  // Pause, Karte, Handy, Missionen, Inventar
  await page.evaluate(() => window.game.ui.showPause());
  await wait(200); await shot('pause');
  await page.evaluate(() => { window.game.ui.resume(); window.game.ui.showMap(); });
  await wait(300); await shot('map');
  await page.evaluate(() => { window.game.ui.closeMap(); window.game.ui.phone.open(); });
  await wait(200); await shot('phone');
  await page.evaluate(() => { const ph = window.game.ui.phone; ph.screen = 'cheats'; ph.sel = 0; ph.render(); });
  await wait(100); await shot('phone_cheats');
  await page.evaluate(() => { window.game.ui.phone.close(); window.game.ui.mode = 'pause'; window.game.pause(true); window.game.ui.showMissionLog(() => {}); });
  await wait(200); await shot('missionlog');
  await page.evaluate(() => { window.game.ui.showInventory(() => {}); });
  await wait(200); await shot('inventory');
  const r3 = await page.evaluate(() => { const g = window.game; g.ui.resume(); g.settings.language = 'en'; g.applySettings(); g.ui.showPause(); const txt = document.querySelector('.menu-btn').textContent; g.settings.language = 'de'; g.applySettings(); g.ui.resume(); return 'Englisch: ' + txt; });
  console.log(r3);
};

scen.perf = async ({ page }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [];
    const measure = (label, sec) => {
      const t0 = performance.now();
      g.simulate(sec);
      const ms = performance.now() - t0;
      const frames = sec * 20; // simulate() ruft update alle 3 Physikschritte
      out.push(`${label}: ${(ms / (sec * 60)).toFixed(2)} ms pro Physikschritt, ~${(ms / frames).toFixed(1)} ms pro Frame (Logik), NPCs ${g.population.characters.length}, Fahrzeuge ${g.vehicles.list.length}`);
    };
    g.player.teleport(150, null, -200);
    g.simulate(5);
    measure('Innenstadt zu Fuss', 10);
    const v = g.vehicles.spawn('sports', { x: 150, z: -190, heading: 0 }); g.vehicles._seatPlayer(v);
    g.input.codesDown.add('KeyW');
    measure('Innenstadt im Auto', 10);
    g.input.codesDown.delete('KeyW');
    g.police.wanted.ensureStars(4, g.player.pos);
    measure('4 Sterne Verfolgung', 10);
    // Einzelne Systeme profilieren
    const prof = {};
    for (const s of g.systems) {
      const name = s.constructor.name;
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) { if (s.fixedUpdate) s.fixedUpdate(1 / 60); if (s.update) s.update(1 / 60); }
      prof[name] = ((performance.now() - t0) / 60).toFixed(3);
    }
    out.push('ms pro Frame je System: ' + Object.entries(prof).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v).join(', '));
    // Render-Statistik
    g.renderer.render(g.scene, g.camera);
    const info = g.renderer.info;
    out.push(`Render: ${info.render.calls} Draw Calls, ${(info.render.triangles / 1000).toFixed(0)}k Dreiecke, Geometrien ${info.memory.geometries}, Texturen ${info.memory.textures}`);
    out.push(`JS-Heap: ${performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a'}`);
    return out;
  });
  console.log(r.join('\n'));
};

// Spielt alle Story-Missionen automatisiert durch (Teleports statt echter Fahrt), um die
// Abschliessbarkeit zu prüfen. Gibt je Mission "OK" oder die Stelle aus, an der es hakt.
scen.playthrough = async ({ page }) => {
  await page.click('[data-a=new]');
  const res = await page.evaluate(async () => {
    const g = window.game, M = g.missions, E = M.engine, pl = g.player, out = [];
    g.godMode = true;
    const step = (s = 0.25) => { g.input.tap('Enter'); g.simulate(s); };
    const run = () => E.active;
    const data = () => (E.active ? E.active.data : {});
    const stage = () => (E.active ? E.active.stage : -1);
    const seat = (v) => { if (pl.vehicle) g.vehicles.exitVehicle(pl, true); pl.teleport(v.pos.x + 3, null, v.pos.z); g.vehicles._seatPlayer(v); g.simulate(0.3); };
    const moveTo = (x, z, y = null) => {
      const v = pl.vehicle;
      if (v) { const gy = y ?? g.collision.groundHeight(x, z, 300, 0).h; v.pos.set(x, gy + (v.comHeight || 1.3) + (v.model && v.model.bottom ? -v.model.bottom - (v.comHeight || 0) : 0), z); v.vel.set(0, 0, 0); v.angVel && v.angVel.set(0, 0, 0); v.prevPos.copy(v.pos); }
      else pl.teleport(x, y, z);
      g.simulate(0.4);
    };
    const waitStage = (pred, sec = 20) => { for (let t = 0; t < sec * 4 && run() && !pred(); t++) step(); return !!run() && pred(); };
    const killAll = (list) => { for (const n of list) if (!n.dead) n.damage(99999, { source: pl, type: 'bullet' }); g.simulate(0.3); };
    const start = (id) => {
      const def = E.missions.get(id);
      for (const r of def.requires || []) E.completed.add(r);
      if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
      g.police.reset(); pl.revive();
      E.start(id); g.simulate(0.2);
    };
    const report = (id) => { const ok = E.completed.has(id) && E.stats[id] && E.stats[id].passed > 0; out.push(`${id}: ${ok ? 'OK' : 'NICHT abgeschlossen (Stufe ' + stage() + ', ' + (E.failReason || '') + ')'}`); if (E.active) E.abort('Test'); g.simulate(0.2); };

    const missions = [
      ['heimkehr', () => {
    start('heimkehr');
    waitStage(() => data().car && stage() >= 2); seat(data().car);
    moveTo(330, 66); waitStage(() => false, 10);
      }],
      ['ersatzteile', () => {
    start('ersatzteile');
    waitStage(() => data().car && stage() >= 2); moveTo(90, -98); waitStage(() => stage() >= 3, 3);
    seat(data().car); waitStage(() => stage() >= 4, 6);
    moveTo(330, 66); waitStage(() => false, 10);
      }],
      ['schutzgeld', () => {
    start('schutzgeld');
    for (let w = 0; w < 4 && run(); w++) { waitStage(() => data().enemies && data().enemies.some((n) => !n.dead), 6); if (data().enemies) killAll(data().enemies); g.simulate(0.5); }
    waitStage(() => false, 10);
      }],
      ['eilzustellung', () => {
    start('eilzustellung');
    waitStage(() => data().truck && stage() >= 2); seat(data().truck); moveTo(850, 300); waitStage(() => false, 10);
      }],
      ['spitzel', () => {
    start('spitzel');
    waitStage(() => data().myCar && stage() >= 2); seat(data().myCar);
    waitStage(() => data().target && stage() >= 4, 4); moveTo(240, 186); waitStage(() => stage() >= 5, 4); data().target.explode(pl); waitStage(() => false, 10);
      }],
      ['flugstunde', () => {
    start('flugstunde');
    waitStage(() => data().plane && stage() >= 2); seat(data().plane);
    for (let i = 0; i < 14 && run() && stage() === 3; i++) { const cp = data()._cp; const RINGS = run().stageObj; void RINGS; const p = data()._cpm ? data()._cpm.pos : null; if (p) moveTo(p.x, p.z, p.y - 1.3); }
    { const p = data().plane; p.gearDown = true; p.pos.set(-600, 1.4, -770); p.prevPos.copy(p.pos); p.vel.set(0, 0, 0); p.quat.setFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2); g.simulate(1); }
    waitStage(() => false, 10);
      }],
      ['luftrettung', () => {
    start('luftrettung');
    waitStage(() => data().heli && stage() >= 2); seat(data().heli);
    waitStage(() => stage() >= 3, 3);
    { const h = data().heli; h.pos.set(210, 22 - h.model.bottom, -355); h.prevPos.copy(h.pos); h.vel.set(0, 0, 0); g.simulate(1.5); }
    waitStage(() => stage() >= 5, 8);
    { const h = data().heli; h.pos.set(-30, 28 - h.model.bottom + 0.05, -245); h.prevPos.copy(h.pos); h.vel.set(0, 0, 0); g.simulate(1.5); }
    waitStage(() => false, 10);
      }],
      ['unsichtbar', () => {
    start('unsichtbar');
    waitStage(() => stage() >= 1, 15); moveTo(372, -690); waitStage(() => stage() >= 2, 3);
    pl.crouch = true;
    for (const gd of data().guards) gd.damage(99999, { source: pl, type: 'melee' });
    moveTo(470, -640); g.simulate(0.5); moveTo(372, -690); g.simulate(0.5);
    pl.crouch = false;
    moveTo(366, -324); waitStage(() => false, 10);
      }],
      ['strassenkoenig', () => {
    start('strassenkoenig');
    waitStage(() => data().car && stage() >= 2); seat(data().car); waitStage(() => stage() >= 4, 5);
    const RACE = [{ x: 500, z: 500 }, { x: 150, z: 500 }, { x: -200, z: 500 }, { x: -450, z: 500 }, { x: -680, z: 300 }, { x: -680, z: 0 }, { x: -680, z: -300 }, { x: -440, z: -540 }, { x: -90, z: -540 }, { x: 300, z: -540 }, { x: 630, z: -540 }, { x: 840, z: -300 }, { x: 840, z: 0 }, { x: 840, z: 300 }];
    for (const p of RACE) { if (!run() || stage() !== 4) break; moveTo(p.x, p.z); }
    waitStage(() => false, 10);
      }],
      ['der_plan', () => {
    start('der_plan');
    waitStage(() => stage() >= 1, 10); moveTo(210, -338); g.input.codesDown.add('KeyE'); waitStage(() => stage() >= 3, 6); g.input.codesDown.delete('KeyE');
    waitStage(() => data().suv, 3); seat(data().suv); waitStage(() => stage() >= 5, 4);
    moveTo(96, 72); waitStage(() => stage() >= 7, 6);
    waitStage(() => data().wolves, 3); killAll(data().wolves); if (pl.vehicle) g.vehicles.exitVehicle(pl, true); moveTo(620, 125);
    waitStage(() => false, 10);
      }],
      ['der_coup', () => {
    start('der_coup');
    waitStage(() => data().suv && stage() >= 2); seat(data().suv); moveTo(210, -326); waitStage(() => stage() >= 4, 4);
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    moveTo(210, -362); g.input.codesDown.add('KeyE'); waitStage(() => stage() >= 7, 12); g.input.codesDown.delete('KeyE');
    moveTo(210, -365); waitStage(() => stage() >= 9, 3);
    seat(data().suv); waitStage(() => stage() >= 10, 3);
    g.police.clear('test'); waitStage(() => stage() >= 11, 3);
    moveTo(64, 73); waitStage(() => false, 10);
      }],
      ['abrechnung', () => {
    start('abrechnung');
    waitStage(() => stage() >= 1, 10); moveTo(680, -310); waitStage(() => data().guards, 4);
    killAll(data().guards); waitStage(() => data().boss, 10);
    killAll([data().boss]); waitStage(() => false, 15);
      }],
    ];
    for (const [id, fn] of missions) {
      try { fn(); } catch (e) { out.push(`${id}: FEHLER im Test – ${e.message} (Stufe ${stage()})`); }
      report(id);
    }
    out.push(`Abgeschlossen: ${E.completed.size}/12, Geld ${g.economy.money}`);
    return out;
  });
  console.log(res.join('\n'));
};

scen.stress = async ({ page }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [], pl = g.player;
    g.godMode = true;
    pl.teleport(150, null, -190);
    g.simulate(5);
    const offRoad = (v) => { const e = g.roads.nearestEdgePoint(v.pos.x, v.pos.z); return e ? e.d : 99; };
    const samples = { cars: 0, stuck: 0, flipped: 0, off: 0, peds: 0, pedStuck: 0, pedWater: 0 };
    for (let k = 0; k < 12; k++) {
      g.simulate(5);
      for (const v of g.traffic.cars) {
        if (!v.ai || !v.driver || v.driver.isPlayer) continue;
        samples.cars++;
        if (v.ai.blocked > 4) samples.stuck++;
        if (v.up.y < 0.5) samples.flipped++;
        if (offRoad(v) > 10) samples.off++;
      }
      for (const n of g.peds.peds) {
        if (n.dead) continue;
        samples.peds++;
        if ((n.blocked || 0) > 3) samples.pedStuck++;
        if (n.swimming) samples.pedWater++;
      }
    }
    out.push(`Verkehr (60 s, Stichproben): ${samples.cars} · feststeckend ${(samples.stuck / samples.cars * 100).toFixed(1)}% · umgekippt ${(samples.flipped / samples.cars * 100).toFixed(1)}% · abseits der Strasse ${(samples.off / samples.cars * 100).toFixed(1)}%`);
    out.push(`Passanten: ${samples.peds} · feststeckend ${(samples.pedStuck / samples.peds * 100).toFixed(1)}% · im Wasser ${(samples.pedWater / samples.peds * 100).toFixed(1)}%`);
    // Tunnel: Auto mit KI-Controller von West nach Ost
    const v = g.vehicles.spawn('sedan', { x: -60, z: -537, heading: Math.PI / 2 });
    const d = g.population.spawn({ kind: 'ped', x: -60, z: -537 }); d.vehicle = v; v.driver = d;
    v.ai = { mode: 'direct', goal: v.pos.clone().set(260, 0, -537), maxSpeed: 15, arriveDist: 6 }; g.traffic.cars.push(v);
    pl.teleport(-50, null, -520);
    let maxY = 0;
    for (let i = 0; i < 40 && !v.ai.arrived; i++) { g.simulate(0.5); maxY = Math.max(maxY, v.pos.y); }
    out.push(`Tunnel: Ziel erreicht ${!!(v.ai && v.ai.arrived)}, x=${v.pos.x.toFixed(0)}, max. Höhe ${maxY.toFixed(1)} m (sollte < 3)`);
    // Bergstrasse
    const e = g.roads.edges.find((x) => x.kind === 'mountain');
    const v2 = g.vehicles.spawn('suv', { x: e.points[3].x, z: e.points[3].z, heading: 0 });
    const d2 = g.population.spawn({ kind: 'ped', x: v2.pos.x, z: v2.pos.z }); d2.vehicle = v2; v2.driver = d2;
    g.traffic.initRoute(v2, e, true, 0.05);
    pl.teleport(v2.pos.x + 20, null, v2.pos.z);
    const y0 = v2.pos.y;
    g.simulate(25);
    out.push(`Bergstrasse: Höhe ${y0.toFixed(0)} → ${v2.pos.y.toFixed(0)} m, umgekippt ${v2.up.y < 0.5}, abseits ${offRoad(v2).toFixed(1)} m`);
    // Brücke: Spieler fährt über die Brücke bei z=-60
    const v3 = g.vehicles.spawn('compact', { x: -330, z: -58, heading: Math.PI / 2 });
    pl.teleport(-332, null, -55); g.vehicles._seatPlayer(v3);
    g.input.codesDown.add('KeyW'); g.simulate(9); g.input.codesDown.delete('KeyW');
    out.push(`Brücke: x=${v3.pos.x.toFixed(0)} y=${v3.pos.y.toFixed(1)} (über dem Fluss erwartet x>-150, y>0)`);
    return out;
  });
  console.log(r.join('\n'));
};
scen.tunnel = async ({ page }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => {
    const g = window.game, pl = g.player, out = [];
    g.godMode = true;
    const v = g.vehicles.spawn('sedan', { x: -60, z: -537, heading: Math.PI / 2 });
    pl.teleport(-62, null, -534); g.vehicles._seatPlayer(v);
    g.input.codesDown.add('KeyW');
    for (let i = 0; i < 60; i++) {
      g.simulate(0.2);
      out.push(`${(i * 0.2).toFixed(1)}s x=${v.pos.x.toFixed(1)} y=${v.pos.y.toFixed(2)} z=${v.pos.z.toFixed(1)} v=${v.vel.length().toFixed(1)} w=${v.wheelsOnGround} up=${v.up.y.toFixed(2)}`);
      if (v.pos.y > 20) break;
    }
    return out.join('\n');
  }));
};
scen.tunnel2 = async ({ page }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => {
    const g = window.game, pl = g.player, out = [];
    g.godMode = true;
    pl.teleport(150, null, -190);
    g.simulate(3);
    const v = g.vehicles.spawn('sedan', { x: -60, z: -537, heading: Math.PI / 2 });
    const d = g.population.spawn({ kind: 'ped', x: -60, z: -537 }); d.vehicle = v; v.driver = d;
    v.ai = { mode: 'direct', goal: v.pos.clone().set(260, 0, -537), maxSpeed: 15, arriveDist: 6 }; g.traffic.cars.push(v);
    pl.teleport(-50, null, -520);
    for (let i = 0; i < 60; i++) {
      g.simulate(0.25);
      out.push(`${(i * 0.25).toFixed(2)}s x=${v.pos.x.toFixed(1)} y=${v.pos.y.toFixed(2)} z=${v.pos.z.toFixed(1)} v=${v.vel.length().toFixed(1)} w=${v.wheelsOnGround} up=${v.up.y.toFixed(2)} removed=${!!v.removed} sleep=${v.sleeping} wps=${v.ai && v.ai.wps ? v.ai.wps.length : '-'}`);
      if (v.pos.y > 20) break;
    }
    return out.slice(-20).join('\n');
  }));
};
scen.mountain = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => {
    const g = window.game, pl = g.player, out = [];
    g.godMode = true;
    const v = g.vehicles.spawn('suv', { x: -92, z: -560, heading: Math.PI });
    pl.teleport(-90, null, -556); g.vehicles._seatPlayer(v);
    // Spieler-Auto per Autopilot (gleicher Controller wie KI) zum Gipfel
    const d = g.population.spawn({ kind: 'ped', x: -92, z: -560 });
    v.driver = d; d.vehicle = v; pl.vehicle = null;
    v.ai = { mode: 'direct', goal: v.pos.clone().set(120, 0, -860), maxSpeed: 14, arriveDist: 8 }; g.traffic.cars.push(v);
    pl.teleport(-80, null, -560);
    for (let i = 0; i < 12; i++) { g.simulate(5); pl.teleport(v.pos.x + 8, null, v.pos.z + 8); out.push(`t=${(i + 1) * 5}s pos=${v.pos.x.toFixed(0)},${v.pos.y.toFixed(0)},${v.pos.z.toFixed(0)} v=${(v.vel.length() * 3.6).toFixed(0)}km/h up=${v.up.y.toFixed(2)} wps=${v.ai && v.ai.wps ? v.ai.wps.length : '-'}`); if (v.ai && v.ai.arrived) break; }
    return out.join('\n');
  }));
  await page.evaluate(() => { const g = window.game; g.camera3p.yaw = 0; g.camera3p.pitch = 0.3; g.simulate(0.1); });
  await shot('01_mountain');
};

scen.carry = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => {
    const g = window.game, out = [], pl = g.player;
    const trash = g.city.props.find((p) => p.type === 'trash' && !p.broken && Math.abs(p.x) < 400 && p.z > -400 && p.z < 400);
    pl.teleport(trash.x + 1, null, trash.z, -Math.PI / 2); g.simulate(0.3);
    g.input.tap('KeyE'); g.simulate(0.2);
    out.push('Trägt: ' + (g.carry.held ? g.carry.held.type : 'nichts') + ', Requisit entfernt: ' + trash.broken);
    const ped = g.population.spawn({ kind: 'ped', x: pl.pos.x + Math.sin(pl.heading) * 5, z: pl.pos.z + Math.cos(pl.heading) * 5 });
    g.camera3p.yaw = pl.heading; g.camera3p.pitch = 0.0; g.simulate(0.1);
    const hp0 = ped.health;
    g.input.tap('Mouse0'); g.simulate(1.5);
    out.push(`Geworfen: hält noch ${!!g.carry.held}, Passant HP ${hp0} → ${ped.health.toFixed(0)}`);
    // Zwischensequenz beim Missionsstart
    pl.teleport(64, null, 73); g.simulate(0.3);
    out.push('Mission aktiv: ' + (g.missions.active && g.missions.active.id) + ', Kinokamera: ' + !!g.camera3p.cinematic);
    return out;
  });
  console.log(r.join('\n'));
  await shot('01_cinematic');
};
scen.dbg4 = async ({ page }) => {
  await page.click('[data-a=new]');
  console.log(await page.evaluate(() => { const g = window.game; g.player.teleport(64, null, 73); g.simulate(0.3); return document.getElementById('dialog').innerHTML; }));
};

scen.showcase = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const set = (fn) => page.evaluate(fn);
  await set(() => { const g = window.game; g.settings.tutorialDone = true; g.ui.tutStep = 99; document.getElementById('hud-help').classList.add('hidden'); g.simulate(4); });
  const view = async (name, fn) => { await page.evaluate(fn); await page.evaluate(() => { window.game.simulate(0.3); document.getElementById('hud-help').classList.add('hidden'); }); await shot(name); };
  await view('01_downtown_day', () => { const g = window.game; g.weather.set('clear', true); g.tod.hour = 11; g.player.teleport(150, null, -168, Math.PI); g.camera3p.yaw = Math.PI * 0.95; g.camera3p.pitch = -0.05; g.simulate(4); });
  await view('02_downtown_night', () => { const g = window.game; g.tod.hour = 22.5; g.player.teleport(270, null, -178, Math.PI); g.camera3p.yaw = Math.PI * 1.1; g.camera3p.pitch = 0; g.simulate(2); });
  await view('03_storm', () => { const g = window.game; g.weather.set('storm', true); g.tod.hour = 16; g.player.teleport(90, null, 180, 0); g.camera3p.yaw = Math.PI * 0.6; g.camera3p.pitch = 0.05; g.simulate(2); });
  await view('04_beach_sunset', () => { const g = window.game; g.weather.set('clear', true); g.tod.hour = 18.3; g.player.teleport(300, null, 570, Math.PI); g.camera3p.yaw = Math.PI * 0.7; g.camera3p.pitch = 0.08; });
  await view('05_car_chase', () => { const g = window.game; g.tod.hour = 13; const v = g.vehicles.spawn('sports', { x: 390, z: -300, heading: 0 }); g.player.teleport(388, null, -300); g.vehicles._seatPlayer(v); g.police.wanted.ensureStars(2, g.player.pos); g.input.codesDown.add('KeyW'); g.simulate(5); g.input.codesDown.delete('KeyW'); g.camera3p.yaw = v.heading; g.camera3p.pitch = 0.2; });
  await view('06_heli_city', () => { const g = window.game; g.police.reset(); g.vehicles.exitVehicle(g.player, true); const h = g.vehicles.spawn('heliSmall', { x: 100, z: 100, heading: Math.PI, y: 60 }); g.player.teleport(100, 60, 100); g.vehicles._seatPlayer(h); h.rotor = 1; g.simulate(1); g.camera3p.yaw = Math.PI; g.camera3p.pitch = 0.35; });
  await view('07_suburb_roundabout', () => { const g = window.game; g.vehicles.exitVehicle(g.player, true); g.player.teleport(-470, null, 40, 1); g.camera3p.yaw = 1.0; g.camera3p.pitch = 0.25; g.simulate(2); });
  await view('08_harbor', () => { const g = window.game; g.player.teleport(760, null, 300, Math.PI / 2); g.camera3p.yaw = Math.PI / 2; g.camera3p.pitch = 0.1; g.simulate(2); });
  await view('09_mountain_view', () => { const g = window.game; g.player.teleport(115, null, -855, Math.PI); g.camera3p.yaw = Math.PI * 0.85; g.camera3p.pitch = 0.0; g.simulate(1); });
  await view('10_airport', () => { const g = window.game; g.player.teleport(-540, null, -690, -Math.PI / 2); g.camera3p.yaw = -Math.PI / 2 - 0.3; g.camera3p.pitch = 0.05; g.simulate(2); });
};

scen.dbgAirport = async ({ page }) => {
  await page.click('[data-a=new]');
  const r = await page.evaluate(() => { const g = window.game; g.simulate(2); g.player.teleport(-540, null, -690, -Math.PI / 2); const out = []; for (let i = 0; i < 12; i++) { g.simulate(0.5); out.push({ hp: g.player.health, dead: g.player.dead, stars: g.police.wanted.stars, pend: !!g.respawn.pending, fade: g.respawn.fade.style.opacity, y: g.player.pos.y.toFixed(1) }); } return out; });
  console.log(JSON.stringify(r));
};
