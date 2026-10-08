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


// ---------------------------------------------------------------------------------------------
// Bug-Check: prüft Kernfunktionen mit harten Erwartungen (wirft bei Fehlschlag).
scen.bugcheck = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const res = await page.evaluate(() => {
    const g = window.game, pl = g.player, inp = g.input, log = [];
    const ok = (c, msg) => log.push((c ? 'OK   ' : 'FAIL ') + msg);
    const insideSolid = (p) => g.collision.query(p.x - 0.05, p.z - 0.05, p.x + 0.05, p.z + 0.05, []).some((b) => b.solid && p.x > b.minX + 0.05 && p.x < b.maxX - 0.05 && p.z > b.minZ + 0.05 && p.z < b.maxZ - 0.05 && p.y > b.minY + 0.05 && p.y < b.maxY - 0.05);
    g.settings.tutorialDone = true; g.ui.tutStep = 99;
    g.simulate(1);
    // --- Laufen, Springen
    const z0 = pl.pos.z; inp.codesDown.add('KeyW'); g.simulate(1.5); inp.codesDown.delete('KeyW');
    ok(Math.abs(pl.pos.z - z0) > 3, `Laufen (${(pl.pos.z - z0).toFixed(1)} m)`);
    inp.tap('Space'); g.simulate(0.2); const yj = pl.pos.y - g.collision.groundHeight(pl.pos.x, pl.pos.z, pl.pos.y, 0).h; g.simulate(1.5);
    ok(yj > 0.3 && pl.onGround, `Springen (+${yj.toFixed(2)} m) und Landen`);
    // --- Kamera an einer Hauswand: nicht in der Wand
    let camBad = 0;
    for (const [x, z, yaw] of [[64, 77.5, 0], [52, 88, -Math.PI / 2], [182, -74.5, 0]]) {
      pl.teleport(x, null, z, yaw); g.camera3p.yaw = yaw; g.camera3p.pitch = 0.1; g.simulate(0.5);
      if (insideSolid(g.camera.position)) camBad++;
    }
    ok(camBad === 0, `Kamera nicht in Wänden (${camBad} Fehler)`);
    // --- Auto: einsteigen, fahren, Position des Spielers folgt
    pl.teleport(64, null, 62, Math.PI);
    const car = g.vehicles.spawn('sedan', { x: 64, z: 58, heading: Math.PI });
    car.locked = false;
    g.vehicles.beginEnter(car); g.simulate(3);
    ok(pl.vehicle === car, 'Einsteigen per Tastenablauf');
    inp.codesDown.add('KeyW'); g.simulate(5); inp.codesDown.delete('KeyW');
    ok(car.pos.distanceTo(pl.pos.clone().set(64, 0, 58)) > 20, `Fahren (${(car.speedKmh || 0).toFixed(0)} km/h)`);
    ok(pl.pos.distanceTo(car.pos) < 3, `Spielerposition folgt dem Fahrzeug (Abstand ${pl.pos.distanceTo(car.pos).toFixed(1)} m)`);
    inp.codesDown.add('KeyS'); g.simulate(4); inp.codesDown.delete('KeyS');
    inp.tap('KeyF'); g.simulate(0.5);
    ok(!pl.vehicle && pl.pos.distanceTo(car.pos) < 5, 'Aussteigen neben dem Auto');
    // --- Fahrstabilität: 25 s Vollgas mit Lenkwechseln
    let flips = 0, flyAway = 0, maxY = 0;
    g.vehicles._seatPlayer(car); car.resetUpright(true);
    for (let i = 0; i < 50; i++) {
      inp.codesDown.add('KeyW'); if (i % 6 < 2) inp.codesDown.add('KeyA'); else if (i % 6 < 4) inp.codesDown.add('KeyD');
      g.simulate(0.5);
      inp.codesDown.delete('KeyA'); inp.codesDown.delete('KeyD');
      const gh = g.collision.groundHeight(car.pos.x, car.pos.z, car.pos.y + 1, 2).h;
      maxY = Math.max(maxY, car.pos.y - gh);
      if (car.pos.y - gh > 6) flyAway++;
      if (car.up.y < 0.3) flips++;
    }
    inp.codesDown.delete('KeyW');
    ok(flyAway === 0, `Auto hebt nicht ab (max. ${maxY.toFixed(1)} m über Boden)`);
    log.push(`INFO Umkipp-Proben: ${flips}/50`);
    g.vehicles.exitVehicle(pl, true);
    // --- Waffen
    const inv = pl.inventory;
    inv.give('pistol', 30); inv.give('rocket', 3); inv.give('grenade', 3);
    inp.tap('Digit3'); g.simulate(0.1);
    ok(inv.current.id === 'pistol', 'Waffenwechsel per Zifferntaste');
    const m0 = inv.current.mag; inp.codesDown.add('Mouse2'); inp.tap('Mouse0'); g.simulate(0.4); inp.codesDown.delete('Mouse2');
    ok(inv.current.mag === m0 - 1, `Schuss verbraucht Munition (${m0}→${inv.current.mag})`);
    inp.tap('KeyR'); g.simulate(2);
    ok(inv.current.mag === 12, `Nachladen (Magazin ${inv.current.mag}/${inv.current.ammo})`);
    inv.current.mag = 0; inv.current.ammo = 0; inp.tap('Mouse0'); g.simulate(0.3);
    ok(g.weapons.reloading <= 0, 'Leeres Magazin ohne Reserve hängt nicht im Nachladen');
    inv.select(8); g.weapons._equipModel();
    g.camera3p.pitch = 0.3; inp.codesDown.add('Mouse2'); inp.tap('Mouse0'); g.simulate(0.2); inp.codesDown.delete('Mouse2');
    const rAfterShot = inv.current.mag; g.simulate(3);
    ok(rAfterShot === 0 && inv.current.mag === 1, `Raketenwerfer lädt automatisch nach (${rAfterShot}→${inv.current.mag}/${inv.current.ammo})`);
    // --- Waffenrad + Pause
    inp.codesDown.add('Tab'); g.simulate(0.1);
    const wheelOpen = g.weapons.wheelOpen;
    g.ui.showPause(); g.simulate(0.1);
    const visiblePaused = !document.getElementById('wheel').classList.contains('hidden');
    inp.codesDown.delete('Tab'); g.ui.resume(); g.simulate(0.2);
    ok(wheelOpen && !visiblePaused && g.loop.timeScale === 1, `Waffenrad schliesst bei Pause (sichtbar=${visiblePaused}, Zeitfaktor ${g.loop.timeScale})`);
    // --- Speicherleck: zwischen zwei Orten pendeln (Streaming von Autos/Passanten), Projektile, Pickups
    g.godMode = true;
    const geoAt = [];
    for (let k = 0; k < 4; k++) {
      pl.teleport(64, null, 62); g.simulate(3);
      for (let i = 0; i < 15; i++) g.weapons.spawnProjectile('grenade', pl.pos.clone().setY(pl.pos.y + 30), pl.pos.clone().set(0, -1, 0), pl);
      for (let i = 0; i < 15; i++) g.weapons.dropPickup('pistol', pl.pos.clone().setX(pl.pos.x + 40 + i), 10);
      g.simulate(4);
      for (const p of [...g.weapons.pickups]) if (!p.respawn) p.life = 0;
      pl.teleport(600, null, 300); g.simulate(3);
      pl.teleport(-500, null, -100); g.simulate(3);
      pl.teleport(64, null, 62); g.simulate(3); g.render();
      geoAt.push(g.renderer.info.memory.geometries);
    }
    ok(geoAt[3] - geoAt[1] < 25, `Kein Geometrie-Leck beim Pendeln/Schiessen (Geometrien je Runde: ${geoAt.join(' → ')})`);
    g.godMode = false;
    // --- Tod im Auto → Respawn zu Fuss im Krankenhaus
    const car2 = g.vehicles.spawn('compact', { x: 150, z: -120, heading: 0 });
    pl.teleport(148, null, -120); g.vehicles._seatPlayer(car2); g.simulate(0.3);
    pl.damage(1000, { type: 'bullet' });
    g.simulate(6);
    const hosp = g.city.landmarks.spawnPoints.hospital;
    ok(!pl.dead && !pl.vehicle && Math.hypot(pl.pos.x - hosp.x, pl.pos.z - hosp.z) < 5, `Respawn nach Tod im Auto (im Fahrzeug=${!!pl.vehicle}, Abstand Klinik ${Math.hypot(pl.pos.x - hosp.x, pl.pos.z - hosp.z).toFixed(0)} m)`);
    ok(car2.driver !== pl, 'Auto hat nach dem Tod keinen Spieler-Fahrer mehr');
    // --- Tod zu Fuss + Fahndung zurückgesetzt
    g.police.wanted.ensureStars(2, pl.pos); pl.damage(1000, { type: 'bullet' }); g.simulate(6);
    ok(!pl.dead && pl.health === 100 && g.police.stars === 0, `Respawn zu Fuss (HP ${pl.health}, Sterne ${g.police.stars})`);
    // --- Speichern/Laden im Browser
    g.economy.money = 4321; pl.inventory.give('smg', 90); pl.inventory.select(3); pl.teleport(120, null, 60, 1.0); pl.health = 66; pl.armor = 40;
    g.missions.engine.completed.add('heimkehr');
    g.saves.save('3');
    g.economy.money = 1; pl.inventory.clear(); pl.teleport(0, null, 0); g.missions.engine.completed.clear();
    g.saves.load('3'); g.simulate(0.2);
    ok(g.economy.money === 4321 && pl.inventory.has('smg') && pl.inventory.current.id === 'smg' && Math.abs(pl.pos.x - 120) < 0.5 && Math.round(pl.health) === 66 && Math.round(pl.armor) === 40 && g.missions.engine.completed.has('heimkehr'),
      `Speichern/Laden (Geld ${g.economy.money}, Waffe ${pl.inventory.current.id}, Pos ${pl.pos.x.toFixed(0)}, HP ${pl.health}, Weste ${pl.armor})`);
    g.saves.remove('3');
    // Spielstand im Fahrzeug (Autosave) speichert die Fahrzeugposition
    const car3 = g.vehicles.spawn('sedan', { x: 200, z: 60, heading: 0 });
    pl.teleport(198, null, 60); g.vehicles._seatPlayer(car3); car3.pos.x = 260; g.simulate(0.2);
    const st = g.saves.collect();
    ok(Math.abs(st.player.pos.x - car3.pos.x) < 3, `Autosave im Fahrzeug speichert aktuelle Position (${st.player.pos.x.toFixed(0)} vs ${car3.pos.x.toFixed(0)})`);
    g.vehicles.exitVehicle(pl, true);
    // --- Wechsel Menü ↔ Spiel: nach jedem Schliessen läuft das Spiel wieder mit aktiver Eingabe
    const ui = g.ui; const back = (name) => ok(!g.paused && g.input.enabled && ui.mode === 'game', `Zurück im Spiel nach: ${name} (pausiert=${g.paused}, Eingabe=${g.input.enabled}, Modus=${ui.mode})`);
    ui.showMap(); ok(ui.mode === 'map', 'Karte öffnet'); ui.closeMap(); back('Karte');
    ui.showPause(); ok(g.paused, 'Pause pausiert'); ui.resume(); back('Pause');
    ui.mode = 'pause'; g.pause(true); ui.showInventory(() => ui.resume()); ui.resume(); back('Inventar');
    ui.phone.toggle(); ok(ui.phone.isOpen, 'Handy öffnet'); ui.phone.close(); back('Handy');
    g.shops.gunshop(); ui.resume(); back('Waffenladen');
    // --- Geld/Laden
    g.economy.money = 5000; const had = pl.inventory.has('shotgun');
    g.shops.gunshop(); const menu = g.ui.currentMenu || null;
    log.push('INFO Ladenmenü offen: ' + !!document.querySelector('.panel'));
    g.ui.resume();
    void had; void menu;
    return log;
  });
  console.log(res.join('\n'));
  const fails = res.filter((l) => l.startsWith('FAIL'));
  if (fails.length) throw new Error(fails.length + ' Prüfungen fehlgeschlagen');
};

// Lädt das Spiel, spult vor und besucht den Flughafen – mit VERBOSE=1 werden alle Konsolenmeldungen (auch Warnungen) ausgegeben.
scen.warnings = async ({ page }) => {
  await page.click('[data-a=new]');
  await page.evaluate(() => { const g = window.game; g.simulate(5); g.render(); g.player.teleport(-540, null, -690); g.simulate(2); g.render(); });
};

// ---------------------------------------------------------------------------------------------
// Luftfahrzeuge: alle vier Typen am echten Abstellplatz – einsteigen, starten, fliegen, landen,
// aussteigen, Absturz, Respawn. Wirft bei Fehlschlag.
scen.aircraft = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const step1 = await page.evaluate(() => {
    const g = window.game, pl = g.player, inp = g.input, log = [];
    window.__log = log;
    const ok = (c, msg) => log.push((c ? 'OK   ' : 'FAIL ') + msg);
    g.settings.tutorialDone = true; g.ui.tutStep = 99; g.godMode = false;
    const keys = (list, sec, fn) => { for (const k of list) inp.codesDown.add(k); const n = Math.round(sec / 0.1); for (let i = 0; i < n; i++) { g.simulate(0.1); if (fn) fn(); } for (const k of list) inp.codesDown.delete(k); };
    window.__keys = keys; window.__ok = ok;
    const spotOf = (type, free) => g.vehicles.parkingSpots.find((s) => s.aircraft && s.type === type && (free === undefined || !!s.free === free));
    window.__spotOf = spotOf;
    // Abstand zum Start
    const st = { x: 64, z: 70 };
    const hs = spotOf('heliSmall', true), ps = spotOf('planeProp', true);
    ok(hs && Math.hypot(hs.x - st.x, hs.z - st.z) < 300, `Helikopter nahe am Start (${hs ? Math.hypot(hs.x - st.x, hs.z - st.z).toFixed(0) : '-'} m)`);
    ok(ps && Math.hypot(ps.x - st.x, ps.z - st.z) < 600, `Flugzeug nahe am Start (${ps ? Math.hypot(ps.x - st.x, ps.z - st.z).toFixed(0) : '-'} m)`);
    // Sichtbar von Weitem: Spawn schon bei ~300 m Abstand
    pl.teleport(hs.x + 250, null, hs.z); g.simulate(0.5);
    ok(!!hs.vehicle, 'Heliport-Helikopter erscheint schon aus 250 m Entfernung');

    // ---------------- Kleiner Helikopter (Heliport Flusspark)
    pl.teleport(hs.x + 4, null, hs.z + 4); g.simulate(0.5);
    const h = hs.vehicle;
    g.vehicles.beginEnter(h); g.simulate(1.5);
    ok(pl.vehicle === h, 'Helikopter: einsteigen mit F');
    ok(g.police.stars === 0, `Helikopter (frei): keine Fahndung (${g.police.stars}★)`);
    const groundY = h.pos.y;
    keys(['ShiftLeft'], 5);
    ok(h.altitude > 12, `Helikopter: steigen (${h.altitude.toFixed(1)} m, Rotor ${(h.rotor * 100).toFixed(0)} %)`);
    const a0 = h.altitude; g.simulate(3);
    ok(Math.abs(h.altitude - a0) < 3, `Helikopter: schweben (${a0.toFixed(1)} → ${h.altitude.toFixed(1)} m)`);
    keys(['KeyW'], 3);
    const fwdSpeed = h.vel.dot(h.forward); ok(fwdSpeed > 10, `Helikopter: vorwärts (${(fwdSpeed * 3.6).toFixed(0)} km/h)`);
    keys(['KeyS'], 4);
    ok(h.vel.dot(h.forward) < fwdSpeed * 0.5, `Helikopter: rückwärts/bremsen (${(h.vel.dot(h.forward) * 3.6).toFixed(0)} km/h)`);
    g.simulate(2);
    keys(['KeyD'], 2);
    const side = h.vel.dot(h.right); ok(side > 3, `Helikopter: seitwärts (${(side * 3.6).toFixed(0)} km/h nach rechts)`);
    g.simulate(2);
    const hd0 = h.heading; keys(['KeyE'], 1.5);
    ok(Math.abs(((h.heading - hd0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.4, `Helikopter: drehen (${((h.heading - hd0) * 57.3).toFixed(0)}°)`);
    // Instrumente + Cockpit
    const instr = document.getElementById('hud-instruments') || g.hud.el.instruments;
    const txt = instr.textContent;
    ok(!instr.classList.contains('hidden') && /Höhe/.test(txt) && /Tempo/.test(txt) && /Kompass/.test(txt) && /Nick/.test(txt) && /Tank/.test(txt), 'HUD: Höhe, Tempo, Kompass, Neigung, Tank sichtbar');
    inp.tap('KeyV'); g.simulate(0.3);
    const camD = g.camera.position.distanceTo(h.pos);
    ok(g.camera3p.mode === 'first' && camD < 4 && !pl.model.root.visible, `Cockpit-Ansicht (Kamera ${camD.toFixed(1)} m vom Rumpf)`);
    inp.tap('KeyV'); g.simulate(0.3);
    ok(g.camera3p.mode === 'third' && g.camera.position.distanceTo(h.pos) > 8, 'Verfolgerkamera');
    // Landung auf dem Penthouse-Dach (Helipad)
    const ph = g.city.landmarks ? null : null; void ph;
    h.pos.set(90, 175, -340); h.vel.set(0, 0, 0); h.quat.set(0, 0, 0, 1); h.prevPos.copy(h.pos); g.simulate(0.5);
    for (let i = 0; i < 25; i++) { const dx = 90 - h.pos.x, dz = -360 - h.pos.z; h.vel.x += dx * 0.05; h.vel.z += dz * 0.05; h.vel.x *= 0.8; h.vel.z *= 0.8; g.simulate(0.1); }
    keys(['ControlLeft'], 12, () => { h.vel.x *= 0.9; h.vel.z *= 0.9; if (h.onGround) inp.codesDown.delete('ControlLeft'); });
    g.simulate(1.5);
    ok(h.onGround && h.pos.y > 135 && h.health > h.maxHealth * 0.9, `Helikopter: Landung auf dem Penthouse-Dach (y ${h.pos.y.toFixed(1)}, Zustand ${(h.health / h.maxHealth * 100).toFixed(0)} %)`);
    // Zurück zum Heliport und dort landen
    h.pos.set(hs.x, 40, hs.z); h.vel.set(0, 0, 0); h.prevPos.copy(h.pos); g.simulate(0.3);
    keys(['ControlLeft'], 14, () => { h.vel.x *= 0.9; h.vel.z *= 0.9; if (h.onGround) inp.codesDown.delete('ControlLeft'); });
    g.simulate(1);
    ok(h.onGround && Math.abs(h.pos.y - groundY) < 0.6, `Helikopter: Landung am Heliport (y ${h.pos.y.toFixed(2)} / Boden ${groundY.toFixed(2)})`);
    h.fuel = h.maxFuel * 0.4; g.simulate(3);
    ok(h.fuel > h.maxFuel * 0.6, `Auftanken auf dem Landeplatz (${(h.fuel / h.maxFuel * 100).toFixed(0)} %)`);
    inp.tap('KeyF'); g.simulate(0.5);
    ok(!pl.vehicle && pl.pos.distanceTo(h.pos) < 6 && !pl.dead, 'Helikopter: aussteigen');
    // Gebäudekollision: Helikopter seitlich in ein Hochhaus
    g.vehicles._seatPlayer(h);
    const tower = g.city.layout ? null : null; void tower;
    h.pos.set(90, 60, -320); h.prevPos.copy(h.pos); h.vel.set(0, 0, -30); h.rotor = 1; g.simulate(1.5);
    const insidePent = h.pos.x > 72 && h.pos.x < 108 && h.pos.z > -378 && h.pos.z < -342 && h.pos.y < 140;
    ok(!insidePent && h.health < h.maxHealth, `Helikopter: prallt am Hochhaus ab (Schaden ${(h.maxHealth - h.health).toFixed(0)}, im Gebäude=${insidePent})`);
    return log;
  });
  console.log(step1.join('\n'));
  await shot('01_heli');

  const step2 = await page.evaluate(() => {
    const g = window.game, pl = g.player, inp = g.input, log = [];
    const ok = (c, msg) => log.push((c ? 'OK   ' : 'FAIL ') + msg);
    const keys = window.__keys, spotOf = window.__spotOf;
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    pl.revive(); pl.health = 100;
    // ---------------- Propellerflugzeug (Strandpiste)
    const ps = spotOf('planeProp', true);
    pl.teleport(ps.x + 200, null, ps.z - 60); g.simulate(0.4);
    pl.teleport(ps.x + 6, null, ps.z + 12); g.simulate(0.6);
    const p = ps.vehicle;
    ok(!!p, 'Flugzeug steht an der Strandpiste');
    g.vehicles.beginEnter(p); g.simulate(1.5);
    ok(pl.vehicle === p && g.police.stars === 0, `Flugzeug: einsteigen, keine Fahndung (${g.police.stars}★)`);
    let minClear = 99;
    const clearance = () => { const gh = g.collision.groundHeight(p.pos.x, p.pos.z, p.pos.y + 1, 0).h; minClear = Math.min(minClear, p.pos.y + p.model.bottom - gh); };
    keys(['ShiftLeft'], 2.5, clearance);
    let rot = false;
    for (let i = 0; i < 150 && !rot; i++) { g.simulate(0.1); clearance(); if (p.speed > p.def.stallSpeed * 1.25) rot = true; }
    const runDist = p.pos.x - ps.x;
    ok(rot && runDist < 480, `Flugzeug: Startlauf auf der Piste (${(p.speed * 3.6).toFixed(0)} km/h nach ${runDist.toFixed(0)} m)`);
    keys(['KeyS'], 1.2, clearance); keys([], 5, clearance);
    ok(p.altitude > 20 && !p.destroyed, `Flugzeug: abgehoben (${p.altitude.toFixed(0)} m, ${(p.speed * 3.6).toFixed(0)} km/h)`);
    inp.tap('KeyG'); g.simulate(0.2);
    ok(!p.gearDown, 'Flugzeug: Fahrwerk einfahren (G)');
    keys(['KeyD'], 1.0); keys([], 3);
    const hdg1 = p.heading;
    ok(Math.abs(p.rollAngle) < 0.5 && p.altitude > 15, `Flugzeug: Kurve und Stabilisierung (Roll ${(p.rollAngle * 57.3).toFixed(0)}°, ${p.altitude.toFixed(0)} m)`);
    keys(['KeyQ'], 1.5);
    ok(Math.abs(p.heading - hdg1) > 0.05, `Flugzeug: gieren (${((p.heading - hdg1) * 57.3).toFixed(0)}°)`);
    // Landeanflug auf die Piste: in 30 m Höhe ausgerichtet, Regler für Sinkrate und Tempo
    inp.tap('KeyG'); g.simulate(0.2);
    const s = { x0: ps.x - 18, z: ps.z };
    p.pos.set(s.x0 - 180, 28, s.z); p.quat.setFromAxisAngle(pl.pos.clone().set(0, 1, 0), Math.PI / 2); p.vel.set(p.def.stallSpeed * 1.35, -1.5, 0); p.angVel.set(0, 0, 0); p.throttle = 0.3; p.prevPos.copy(p.pos);
    let touched = false, tdVs = 0;
    for (let i = 0; i < 400 && !touched; i++) {
      const alt = p.altitude, vs = p.vel.y;
      const target = alt > 4 ? -2.2 : -0.7;
      inp.codesDown.delete('KeyW'); inp.codesDown.delete('KeyS'); inp.codesDown.delete('ShiftLeft'); inp.codesDown.delete('ControlLeft');
      if (vs < target - 0.4) inp.codesDown.add('KeyS'); else if (vs > target + 0.4) inp.codesDown.add('KeyW');
      if (p.speed < p.def.stallSpeed * 1.25) inp.codesDown.add('ShiftLeft'); else if (p.speed > p.def.stallSpeed * 1.45) inp.codesDown.add('ControlLeft');
      // Kurs halten (Querruder)
      inp.codesDown.delete('KeyA'); inp.codesDown.delete('KeyD');
      if (p.pos.z - s.z > 3) inp.codesDown.add('KeyA'); else if (p.pos.z - s.z < -3) inp.codesDown.add('KeyD');
      tdVs = p.vel.y;
      g.simulate(0.05); clearance();
      if (p.onGround) touched = true;
    }
    for (const k of ['KeyW', 'KeyS', 'ShiftLeft', 'ControlLeft', 'KeyA', 'KeyD']) inp.codesDown.delete(k);
    p.throttle = 0; inp.codesDown.add('ControlLeft');
    keys(['Space'], 8);
    inp.codesDown.delete('ControlLeft');
    const onStrip = p.pos.x > s.x0 && p.pos.x < s.x0 + 520 && Math.abs(p.pos.z - s.z) < 12;
    ok(touched && onStrip && !p.destroyed && p.health > p.maxHealth * 0.5 && p.vel.length() < 3, `Flugzeug: Landung auf der Strandpiste (Aufsetzen ${tdVs.toFixed(1)} m/s, steht bei x=${p.pos.x.toFixed(0)}, Zustand ${(p.health / p.maxHealth * 100).toFixed(0)} %)`);
    ok(minClear > -0.6, `Flugzeug: nie durch den Boden (min. Abstand ${minClear.toFixed(2)} m)`);
    inp.tap('KeyF'); g.simulate(0.5);
    ok(!pl.vehicle && !pl.dead, 'Flugzeug: aussteigen');
    // ---------------- Absturz: Flugzeug in den Boden → Explosion, Pilot tot, Respawn
    g.vehicles._seatPlayer(p); pl.health = 100;
    p.pos.set(100, 60, 400); p.quat.setFromAxisAngle(pl.pos.clone().set(0, 1, 0), Math.PI / 2); p.vel.set(40, 0, 0); p.prevPos.copy(p.pos); p.throttle = 1; p.health = p.maxHealth;
    const deaths0 = g.stats.deaths; let diedInCrash = false;
    keys(['KeyW'], 6, () => { if (p.destroyed) { inp.codesDown.delete('KeyW'); if (pl.dead) diedInCrash = true; } });
    ok(p.destroyed && (diedInCrash || g.stats.deaths > deaths0), `Absturz: Flugzeug zerstört=${p.destroyed}, Pilot tot=${diedInCrash || g.stats.deaths > deaths0}`);
    g.simulate(6);
    const hosp = g.city.landmarks.spawnPoints.hospital;
    ok(!pl.dead && !pl.vehicle && Math.hypot(pl.pos.x - hosp.x, pl.pos.z - hosp.z) < 6, 'Absturz: Respawn im Krankenhaus');
    // Respawn des Flugzeugs an der Strandpiste nach Ablauf der Sperrzeit
    ps.cooldown = 0; if (ps.vehicle === p) ps.vehicle = null;
    pl.teleport(ps.x + 120, null, ps.z - 40); g.simulate(0.5);
    ok(ps.vehicle && ps.vehicle !== p && !ps.vehicle.destroyed, 'Neues Flugzeug steht nach dem Absturz wieder an der Strandpiste');
    // Hang-Aufprall: Flugzeug fliegt waagrecht in den Berg → Schaden (früher unbeschadet „gelandet“)
    const p2 = g.vehicles.spawn('planeProp', { x: -60, z: -700, heading: Math.PI });
    g.vehicles._seatPlayer(p2); pl.health = 100;
    const gh = g.collision.groundHeight(-60, -700, 400, 0).h;
    p2.pos.set(-60, gh + 3, -660); p2.vel.set(0, 0, -50); p2.quat.setFromAxisAngle(pl.pos.clone().set(0, 1, 0), Math.PI); p2.prevPos.copy(p2.pos); p2.throttle = 1;
    g.simulate(3);
    ok(p2.health < p2.maxHealth * 0.5 || p2.destroyed, `Flugzeug in Berghang: Schaden (${(p2.health / p2.maxHealth * 100).toFixed(0)} %)`);
    g.simulate(6);
    return log;
  });
  console.log(step2.join('\n'));

  const step3 = await page.evaluate(() => {
    const g = window.game, pl = g.player, inp = g.input, log = [];
    const ok = (c, msg) => log.push((c ? 'OK   ' : 'FAIL ') + msg);
    const keys = window.__keys, spotOf = window.__spotOf;
    if (pl.vehicle) g.vehicles.exitVehicle(pl, true);
    if (pl.dead) g.simulate(6);
    pl.health = 100; g.godMode = false;
    // ---------------- Militärhubschrauber (Militärbasis) – Diebstahl → Fahndung, Bordwaffen
    const ms = spotOf('heliMil');
    pl.teleport(ms.x + 150, null, ms.z); g.simulate(0.4);
    pl.teleport(ms.x + 8, null, ms.z + 8); g.simulate(0.5);
    const m = ms.vehicle;
    ok(!!m, 'Militärhubschrauber steht auf der Militärbasis');
    for (const gu of g.gangs.guards || []) gu.provoked = false;
    g.gangs.guardsDisabled = true;
    g.vehicles.beginEnter(m); g.simulate(1.5);
    ok(pl.vehicle === m, 'Militärhubschrauber: einsteigen');
    ok(g.police.stars >= 2, `Militärhubschrauber stehlen → Fahndung (${g.police.stars}★)`);
    keys(['ShiftLeft'], 5);
    ok(m.altitude > 10, `Militärhubschrauber: steigen (${m.altitude.toFixed(0)} m)`);
    keys(['KeyW'], 3);
    ok(m.vel.length() > 8, `Militärhubschrauber: vorwärts (${(m.vel.length() * 3.6).toFixed(0)} km/h)`);
    let mgShots = 0; const origTracer = g.weapons.addTracer;
    g.weapons.addTracer = function (a, b) { mgShots++; return origTracer.call(this, a, b); };
    inp.codesDown.add('Mouse0'); g.simulate(0.5); inp.codesDown.delete('Mouse0');
    g.weapons.addTracer = origTracer;
    const proj0 = g.weapons.projectiles.length;
    inp.tap('Mouse2'); g.simulate(0.1);
    ok(mgShots >= 4, `Bord-MG feuert (${mgShots} Schuss in 0,5 s)`);
    ok(g.weapons.projectiles.length > proj0, `Raketen (Maus R) (${g.weapons.projectiles.length - proj0} neu)`);
    // Fahndung: Polizeihubschrauber erscheint und folgt
    g.police.wanted.ensureStars(3, pl.pos); g.police.heliTimer = 0.01; g.simulate(6);
    ok(!!g.police.heli, `Polizeihubschrauber verfolgt den Spieler (${g.police.heli ? g.police.heli.pos.distanceTo(m.pos).toFixed(0) + ' m' : 'keiner'})`);
    // Landung und Aussteigen
    keys(['ControlLeft'], 15, () => { m.vel.x *= 0.92; m.vel.z *= 0.92; if (m.onGround) inp.codesDown.delete('ControlLeft'); });
    g.simulate(1);
    ok(m.onGround && !m.destroyed, `Militärhubschrauber: Landung (Zustand ${(m.health / m.maxHealth * 100).toFixed(0)} %)`);
    inp.tap('KeyF'); g.simulate(0.5);
    ok(!pl.vehicle, 'Militärhubschrauber: aussteigen');
    g.police.reset(); g.police.wanted.heat = 0;
    // ---------------- Düsenjet (Militärbasis)
    const js = spotOf('jet');
    pl.teleport(js.x + 150, null, js.z); g.simulate(0.4);
    pl.teleport(js.x + 8, null, js.z + 8); g.simulate(0.5);
    const j = js.vehicle;
    ok(!!j, 'Düsenjet steht auf der Militärbasis');
    g.vehicles.beginEnter(j); g.simulate(1.5);
    ok(pl.vehicle === j, 'Düsenjet: einsteigen');
    g.police.reset(); g.police.wanted.heat = 0;
    // Startlauf auf freier Fläche (Richtung Westen, Rollfeld der Basis)
    keys(['ShiftLeft'], 2);
    let up = false;
    for (let i = 0; i < 200 && !up; i++) { g.simulate(0.1); if (j.speed > j.def.stallSpeed * 1.25) up = true; }
    ok(up, `Düsenjet: Startlauf (${(j.speed * 3.6).toFixed(0)} km/h, ${Math.abs(j.pos.x - js.x).toFixed(0)} m)`);
    keys(['KeyS'], 1.0); keys([], 5);
    ok(j.altitude > 20 && !j.destroyed, `Düsenjet: abgehoben (${j.altitude.toFixed(0)} m, ${(j.speed * 3.6).toFixed(0)} km/h)`);
    keys(['ShiftLeft'], 6);
    ok(j.speed > 90, `Düsenjet: hohe Geschwindigkeit (${(j.speed * 3.6).toFixed(0)} km/h, max. ${(j.def.maxSpeed * 3.6).toFixed(0)})`);
    // Richtung Weltgrenze: automatische Wende statt Abprall
    const UPV = pl.pos.clone().set(0, 1, 0);
    j.pos.set(880, 160, -300); j.quat.setFromAxisAngle(UPV, Math.PI / 2); j.vel.set(80, 0, 0); j.angVel.set(0, 0, 0); j.prevPos.copy(j.pos); j.gearDown = false; j.throttle = 0.7;
    let turned = false, minSpd = 999, maxX = 0;
    for (let i = 0; i < 100; i++) { g.simulate(0.1); if (j.leavingAirspace) turned = true; minSpd = Math.min(minSpd, j.speed); maxX = Math.max(maxX, j.pos.x); }
    ok(turned && maxX < 1100 && minSpd > 40 && !j.destroyed, `Düsenjet: wendet an der Luftraumgrenze (max. x=${maxX.toFixed(0)}, min. ${(minSpd * 3.6).toFixed(0)} km/h, Kurs jetzt ${(j.heading * 57.3).toFixed(0)}°)`);
    // Absprung mit Fallschirm über der Stadt (Fahndung vom Jet-Diebstahl vorher löschen)
    g.police.reset(); g.police.wanted.heat = 0;
    const d0 = g.stats.deaths, a0b = g.stats.arrests;
    j.pos.set(-60, 160, 330); j.quat.setFromAxisAngle(UPV, Math.PI / 2); j.vel.set(70, 0, 0); j.prevPos.copy(j.pos);
    g.simulate(0.2);
    inp.tap('KeyF'); g.simulate(1.2);
    ok(!pl.vehicle && !pl.onGround, `Düsenjet: Absprung in der Luft (Höhe ${(pl.pos.y - pl.groundBelow()).toFixed(0)} m)`);
    inp.tap('Space'); g.simulate(0.3);
    ok(pl.parachute, `Fallschirm öffnet (airTime ${pl.airTime.toFixed(2)}, über Grund ${(pl.pos.y - pl.groundBelow()).toFixed(0)} m, Tode +${g.stats.deaths - d0}, Festnahmen +${g.stats.arrests - a0b}, x=${pl.pos.x.toFixed(0)} z=${pl.pos.z.toFixed(0)})`);
    const hurt = []; const origDmg = pl.damage;
    pl.damage = function (a, info = {}) { hurt.push(`${info.type || '?'}:${Math.round(a)}@${Math.round(this.pos.y)}m${this.parachute ? '/Schirm' : ''}`); return origDmg.call(this, a, info); };
    for (let i = 0; i < 80 && !pl.onGround; i++) g.simulate(0.5);
    pl.damage = origDmg;
    ok(pl.onGround && !pl.dead && !hurt.some((h) => h.startsWith('fall')), `Fallschirm-Landung ohne Fallschaden (HP ${pl.health.toFixed(0)}${hurt.length ? ', Schaden: ' + hurt.join(' ') : ''}, x=${pl.pos.x.toFixed(0)} z=${pl.pos.z.toFixed(0)})`);
    // Führerloser Hubschrauber in Sichtweite stürzt ab
    const fh = g.vehicles.spawn('heliSmall', { x: pl.pos.x + 25, z: pl.pos.z, heading: 0 });
    fh.pos.y += 50; fh.prevPos.copy(fh.pos); fh.rotor = 1;
    for (let i = 0; i < 20 && !fh.destroyed; i++) g.simulate(0.5);
    ok(fh.destroyed, `Hubschrauber ohne Pilot stürzt ab und explodiert (Höhe ${fh.altitude.toFixed(0)} m, Zustand ${Math.round(fh.health)})`);
    return log;
  });
  console.log(step3.join('\n'));
  const all = [...step1, ...step2, ...step3];
  const fails = all.filter((l) => l.startsWith('FAIL'));
  if (fails.length) throw new Error(fails.length + ' Luftfahrzeug-Prüfungen fehlgeschlagen');
};


// Bilder der Luftfahrzeuge für die Dokumentation
scen.airshots = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const prep = () => page.evaluate(() => { const g = window.game; g.settings.tutorialDone = true; g.ui.tutStep = 99; document.getElementById('hud-help').classList.add('hidden'); g.weather.set('clear', true); g.tod.hour = 11; });
  await prep();
  const run = (fn) => page.evaluate(fn);
  await run(() => { const g = window.game, pl = g.player; const hs = g.vehicles.parkingSpots.find((s) => s.aircraft && s.free && s.type === 'heliSmall'); pl.teleport(hs.x + 200, null, hs.z); g.simulate(0.3); pl.teleport(hs.x + 14, null, hs.z + 12, -2.3); g.camera3p.yaw = -2.3 + Math.PI; g.camera3p.yaw = Math.atan2(hs.x - pl.pos.x, hs.z - pl.pos.z); g.camera3p.pitch = 0.12; g.simulate(1); });
  await shot('01_heliport');
  await run(() => { const g = window.game, pl = g.player, inp = g.input; const hs = g.vehicles.parkingSpots.find((s) => s.aircraft && s.free && s.type === 'heliSmall'); g.vehicles._seatPlayer(hs.vehicle); inp.codesDown.add('ShiftLeft'); g.simulate(4); inp.codesDown.delete('ShiftLeft'); inp.codesDown.add('KeyW'); g.simulate(3); inp.codesDown.delete('KeyW'); const h = pl.vehicle; g.camera3p.yaw = h.heading + 0.5; g.camera3p.pitch = 0.25; g.simulate(1.5); });
  await shot('02_heli_flight');
  await run(() => { const g = window.game; g.input.tap('KeyV'); g.simulate(0.5); });
  await shot('03_heli_cockpit');
  await run(() => { const g = window.game, pl = g.player; g.input.tap('KeyV'); g.simulate(0.2); g.vehicles.exitVehicle(pl, true); const ps = g.vehicles.parkingSpots.find((s) => s.aircraft && s.free && s.type === 'planeProp'); pl.teleport(ps.x + 200, null, ps.z - 40); g.simulate(0.3); pl.teleport(ps.x - 16, null, ps.z + 5, 0.6); g.camera3p.yaw = Math.atan2(ps.x + 30 - pl.pos.x, ps.z - 2 - pl.pos.z); g.camera3p.pitch = 0.16; g.tod.hour = 16.5; g.simulate(1); });
  await shot('04_beach_airstrip');
  await run(() => { const g = window.game, pl = g.player, inp = g.input; const ps = g.vehicles.parkingSpots.find((s) => s.aircraft && s.free && s.type === 'planeProp'); const p = ps.vehicle; g.vehicles._seatPlayer(p); inp.codesDown.add('ShiftLeft'); g.simulate(2.5); inp.codesDown.delete('ShiftLeft'); g.simulate(4); inp.codesDown.add('KeyS'); g.simulate(1.0); inp.codesDown.delete('KeyS'); g.simulate(3); g.camera3p.yaw = p.heading + 0.7; g.camera3p.pitch = 0.2; g.simulate(1.5); });
  await shot('05_plane_flight');
  await run(() => { const g = window.game, pl = g.player; g.vehicles.exitVehicle(pl, true); g.gangs.guardsDisabled = true; const js = g.vehicles.parkingSpots.find((s) => s.aircraft && s.type === 'jet'); pl.teleport(js.x + 200, null, js.z); g.simulate(0.3); pl.teleport(js.x + 20, null, js.z - 16, -1); g.camera3p.yaw = Math.atan2(js.x + 4 - pl.pos.x, js.z + 4 - pl.pos.z); g.camera3p.pitch = 0.18; g.tod.hour = 12; g.simulate(1); });
  await shot('06_jet_military');
};

// ---------------------------------------------------------------------------------------------
// Startausrüstung: neues Spiel → Waffen, Munition, Geld, HUD, Waffenrad, Speichern/Laden, alter Spielstand.
scen.startkit = async ({ page, shot }) => {
  await page.click('[data-a=new]');
  const res = await page.evaluate(() => {
    const g = window.game, pl = g.player, inp = g.input, C = window.__CONFIG || null, log = [];
    const ok = (c, msg) => log.push((c ? 'OK   ' : 'FAIL ') + msg);
    void C;
    g.settings.tutorialDone = true; g.ui.tutStep = 99;
    g.simulate(2);
    const inv = pl.inventory;
    const has = (id) => inv.has(id);
    ok(has('fist') && has('bat') && has('pistol') && has('smg') && has('shotgun') && !has('rifle') && !has('rocket'), 'Neues Spiel: Faust, Schläger, Pistole, MP, Schrotflinte (Gewehr/Raketenwerfer nicht)');
    const am = (id) => { const w = inv.slots.find((s) => s && s.id === id); return w ? `${w.mag}/${w.ammo}` : '-'; };
    ok(am('pistol') === '12/60' && am('smg') === '30/60' && am('shotgun') === '6/12', `Startmunition: Pistole ${am('pistol')}, MP ${am('smg')}, Schrotflinte ${am('shotgun')}`);
    ok(g.economy.money === 6000, `Startgeld ${g.economy.money} $`);
    g.simulate(3);
    ok(/6[.']?000/.test(g.hud.el.money.textContent), `HUD zeigt das Geld: "${g.hud.el.money.textContent}"`);
    ok(inv.current.id === 'fist' && g.hud.el.weaponIcon.textContent === '✊', 'Start mit Faust in der Hand');
    // HUD je Waffe (Zifferntasten)
    const hudFor = [];
    for (const [key, id] of [['Digit2', 'bat'], ['Digit3', 'pistol'], ['Digit4', 'smg'], ['Digit5', 'shotgun'], ['Digit1', 'fist']]) {
      inp.tap(key); g.simulate(0.2);
      const icon = g.hud.el.weaponIcon.textContent, ammo = g.hud.el.ammo.textContent.trim();
      hudFor.push(`${id}:${icon}:${ammo || '–'}`);
      const expAmmo = { pistol: '12 / 60', smg: '30 / 60', shotgun: '6 / 12' }[id] || '';
      ok(inv.current.id === id && icon === inv.current.def.icon && ammo === expAmmo, `HUD ${id}: Symbol ${icon}, Munition "${ammo}"`);
    }
    // Waffenrad zeigt alle Startwaffen
    inp.codesDown.add('Tab'); g.simulate(0.1);
    const segs = [...document.querySelectorAll('#wheel .seg:not(.none)')].map((e) => e.textContent);
    inp.codesDown.delete('Tab'); g.simulate(0.2);
    const names = ['Faust', 'Baseballschläger', 'Pistole', 'Maschinenpistole', 'Schrotflinte'];
    ok(segs.length === 5 && names.every((n) => segs.some((t) => t.includes(n))), `Waffenrad: ${segs.length} Waffen (${segs.map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ')})`);
    ok(segs.some((t) => t.includes('12/60')), 'Waffenrad zeigt die Munition');
    // Im Waffenladen sofort etwas kaufbar (Sturmgewehr + Weste)
    const before = g.economy.money;
    const okRifle = g.economy.canAfford(g.shops ? 4500 : 0);
    ok(okRifle && before - 4500 - 500 >= 0, 'Startgeld reicht für Sturmgewehr + Weste');
    // Speichern/Laden mit Startausrüstung und neuem Geld
    inp.tap('Digit4'); g.simulate(0.2);
    pl.inventory.current.mag = 17;
    g.saves.save('3');
    pl.inventory.clear(); g.economy.money = 0;
    g.saves.load('3'); g.simulate(0.3);
    ok(g.economy.money === 6000 && pl.inventory.current.id === 'smg' && pl.inventory.current.mag === 17 && ['bat', 'pistol', 'shotgun'].every((id) => pl.inventory.has(id)), `Speichern/Laden: Geld ${g.economy.money}, Waffe ${pl.inventory.current.id} (${pl.inventory.current.mag})`);
    // Alter Spielstand (Vorversion: 1500 $, nur Pistole) bleibt unverändert
    const oldSave = { version: 1, player: { pos: { x: 64, y: 0.12, z: 70 }, heading: 0, health: 90, armor: 0, look: null, weapons: { current: 2, slots: [{ id: 'fist', mag: 0, ammo: 0 }, null, { id: 'pistol', mag: 4, ammo: 20 }, null, null, null, null, null, null] } }, economy: { money: 1500, ownedProperties: ['home'], ownedVehicles: [], garageSlots: 4 }, missions: { completed: ['heimkehr'], stats: {} }, meta: { date: 'alt', money: 1500, missions: 1, place: 'Altmarkt' }, savedAt: 1 };
    g.storage.setItem('portAurelia.save.2', JSON.stringify(oldSave));
    g.saves.load('2'); g.simulate(0.3);
    ok(g.economy.money === 1500 && pl.inventory.has('pistol') && !pl.inventory.has('smg') && !pl.inventory.has('bat') && pl.inventory.current.mag === 4 && g.missions.engine.completed.has('heimkehr'), `Alter Spielstand: Geld ${g.economy.money}, Waffen ${pl.inventory.slots.filter(Boolean).map((w) => w.id).join(',')}`);
    g.saves.remove('2'); g.saves.remove('3');
    // Neues Spiel nach geladenem Spielstand: wieder volle Startausrüstung
    g.newGame(); g.simulate(0.3);
    ok(g.economy.money === 6000 && pl.inventory.has('shotgun') && !g.missions.engine.completed.has('heimkehr'), 'Neues Spiel nach Laden: wieder Startausrüstung und Startgeld');
    return log;
  });
  console.log(res.join('\n'));
  await page.evaluate(() => { const g = window.game; g.input.tap('Digit3'); g.simulate(0.3); g.input.codesDown.add('Tab'); g.simulate(0.1); });
  await shot('01_wheel');
  await page.evaluate(() => { const g = window.game; g.input.codesDown.delete('Tab'); g.simulate(0.2); });
  await shot('02_hud_pistol');
  const fails = res.filter((l) => l.startsWith('FAIL'));
  if (fails.length) throw new Error(fails.length + ' Prüfungen fehlgeschlagen');
};
