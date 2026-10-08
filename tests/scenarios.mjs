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
