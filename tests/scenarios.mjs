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
    for (let i = 0; i < 6; i++) { inp.codesPressed.add('Mouse0'); g.simulate(0.3); }
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
    inp.codesPressed.add('KeyR'); g.simulate(2.5);
    out.push('Nach Nachladen: ' + w.mag + '/' + w.ammo);
    // Granate
    pl.inventory.select(7); g.weapons._equipModel();
    const car = g.vehicles.spawn('sedan', { x: 150, z: -150, heading: 0 });
    g.simulate(0.3);
    g.camera3p.pitch = 0.1;
    inp.codesPressed.add('Mouse0'); g.simulate(3.5);
    out.push('Granate: Auto HP ' + car.health.toFixed(0) + ' Brand=' + car.onFire + ' zerstört=' + car.destroyed);
    // Rakete
    pl.inventory.select(8); g.weapons._equipModel();
    const car2 = g.vehicles.spawn('suv', { x: 150, z: -165, heading: 0 });
    g.simulate(0.3);
    g.camera3p.pitch = 0.05;
    inp.codesDown.add('Mouse2'); inp.codesPressed.add('Mouse0'); g.simulate(1.0); inp.codesDown.delete('Mouse2');
    out.push('Rakete: SUV HP ' + car2.health.toFixed(0) + ' zerstört=' + car2.destroyed + ' Brände=' + g.combat.fires.length);
    // Nahkampf
    pl.inventory.select(1); g.weapons._equipModel();
    const ped = g.population.spawn({ kind: 'ped', x: pl.pos.x, z: pl.pos.z - 1.2, heading: 0 });
    pl.heading = Math.PI;
    for (let i = 0; i < 4; i++) { inp.codesPressed.add('Mouse0'); g.simulate(0.9); }
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
