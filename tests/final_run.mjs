// Abschluss-Durchlauf mit der gebauten Einzeldatei (file://, kein Server), echte Tastatur-/Mausereignisse:
// neues Spiel → Startwaffen und Geld prüfen → Auto fahren → Helikopter und Flugzeug fliegen →
// im Haus speichern → Seite neu laden (kompletter Neustart) → Spielstand laden und vergleichen.
// Zeit wird mit game.simulate() vorgespult (Headless-Rendering ist sehr langsam); Wege werden per Teleport abgekürzt.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = path.join(root, 'docs/screenshots');
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
const log = [];
const ok = (c, msg) => { log.push((c ? 'OK   ' : 'FAIL ') + msg); console.log((c ? 'OK   ' : 'FAIL ') + msg); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const sim = (s) => ev((t) => window.game.simulate(t), s);
const shot = (n) => page.screenshot({ path: path.join(shotDir, `final_${n}.png`), timeout: 180000 });
const hold = async (keys, seconds) => { for (const k of keys) await page.keyboard.down(k); await sim(seconds); for (const k of keys) await page.keyboard.up(k); };
const press = async (key, after = 0.3) => { await page.keyboard.press(key); await sim(after); };
const url = 'file://' + path.join(root, 'dist/PortAurelia.html') + '?quality=low';

// ------------------------------------------------------------------ 1. Start
await page.goto(url);
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
await page.click('[data-a=new]');
await ev(() => { const g = window.game; g.ui.noAutoPause = true; g.settings.tutorialDone = true; g.ui.tutStep = 99; });
await sim(3);
const st = await ev(() => { const g = window.game; return { money: g.economy.money, hud: g.hud.el.money.textContent, weapons: g.player.inventory.slots.filter(Boolean).map((w) => `${w.id}:${w.mag}/${w.ammo}`) }; });
ok(st.money === 6000 && /6.000/.test(st.hud), `Startgeld ${st.money} $ (HUD "${st.hud}")`);
ok(['fist', 'bat', 'pistol', 'smg', 'shotgun'].every((id) => st.weapons.some((w) => w.startsWith(id + ':'))), 'Startwaffen: ' + st.weapons.join(', '));
const hudSeq = [];
for (const k of ['Digit2', 'Digit3', 'Digit4', 'Digit5']) {
  await press(k, 0.2);
  hudSeq.push(await ev(() => `${window.game.hud.el.weaponIcon.textContent} ${window.game.hud.el.ammo.textContent}`.trim()));
}
ok(hudSeq.length === 4 && hudSeq[1].includes('12 / 60') && hudSeq[2].includes('30 / 60') && hudSeq[3].includes('6 / 12'), 'HUD per Zifferntasten: ' + hudSeq.join(' | '));
await page.keyboard.down('Tab'); await sim(0.1);
const wheel = await ev(() => document.querySelectorAll('#wheel .seg:not(.none)').length);
await shot('01_waffenrad');
await page.keyboard.up('Tab'); await sim(0.2);
ok(wheel === 5, `Waffenrad zeigt ${wheel} Waffen`);
// Schuss mit der Pistole (echte Maus)
await press('Digit3', 0.2);
await page.mouse.move(480, 270);
await page.mouse.down({ button: 'left' }); await sim(0.1); await page.mouse.up({ button: 'left' }); await sim(0.3);
const mag = await ev(() => window.game.player.inventory.current.mag);
ok(mag === 11, `Pistole schiesst per Mausklick (Magazin ${mag}/12)`);
await press('Digit1', 0.2);

// ------------------------------------------------------------------ 2. Auto fahren
const car = await ev(() => {
  const g = window.game, pl = g.player;
  const v = g.vehicles.spawn('sedan', { x: 64, z: 56, heading: Math.PI / 2 });
  v.locked = false;
  pl.teleport(62, null, 56, Math.PI / 2); g.simulate(0.3);
  return v.id;
});
await press('KeyF', 3);
const inCar = await ev((id) => window.game.player.vehicle && window.game.player.vehicle.id === id, car);
ok(inCar, 'Auto: einsteigen mit F');
await hold(['KeyW'], 4);
await hold(['KeyW', 'KeyD'], 1.5);
await hold(['KeyS'], 3);
const drove = await ev(() => { const v = window.game.player.vehicle; return v ? { d: Math.hypot(v.pos.x - 64, v.pos.z - 56), up: v.up.y } : null; });
await shot('02_auto');
ok(drove && drove.d > 25 && drove.up > 0.8, `Auto: gefahren (${drove ? drove.d.toFixed(0) : '-'} m, aufrecht)`);
await press('KeyF', 0.6);
ok(await ev(() => !window.game.player.vehicle), 'Auto: aussteigen');

// ------------------------------------------------------------------ 3. Helikopter (Heliport Flusspark)
await ev(() => { const g = window.game, pl = g.player; const hs = g.vehicles.parkingSpots.find((s) => s.aircraft && s.free && s.type === 'heliSmall'); pl.teleport(hs.x + 220, null, hs.z); g.simulate(0.3); pl.teleport(hs.x + 3, null, hs.z + 3); g.simulate(0.3); });
await press('KeyF', 1.5);
ok(await ev(() => !!(window.game.player.vehicle && window.game.player.vehicle.kind2 === 'heli')), 'Helikopter: einsteigen mit F (Heliport, ~200 m vom Start)');
await hold(['ShiftLeft'], 4);
await hold(['KeyW'], 3);
await hold(['KeyE'], 1);
const heli = await ev(() => { const v = window.game.player.vehicle; return { alt: v.altitude, spd: v.vel.length() * 3.6 }; });
await ev(() => { const g = window.game; g.camera3p.yaw = g.player.vehicle.heading + 0.4; g.camera3p.pitch = 0.25; g.simulate(0.3); });
await shot('03_heli');
ok(heli.alt > 15 && heli.spd > 20, `Helikopter: fliegt (${heli.alt.toFixed(0)} m, ${heli.spd.toFixed(0)} km/h)`);
await press('KeyV', 0.3);
await shot('04_heli_cockpit');
await press('KeyV', 0.3);
await page.keyboard.down('ControlLeft');
for (let i = 0; i < 40; i++) { await sim(0.5); if (await ev(() => window.game.player.vehicle.onGround)) break; }
await page.keyboard.up('ControlLeft');
await sim(1);
const landed = await ev(() => { const v = window.game.player.vehicle; return { g: v.onGround, hp: v.health / v.maxHealth }; });
ok(landed.g && landed.hp > 0.9, `Helikopter: gelandet (Zustand ${(landed.hp * 100).toFixed(0)} %)`);
await press('KeyF', 0.6);
ok(await ev(() => !window.game.player.vehicle && !window.game.player.dead), 'Helikopter: aussteigen');

// ------------------------------------------------------------------ 4. Flugzeug (Strandpiste)
await ev(() => { const g = window.game, pl = g.player; const ps = g.vehicles.parkingSpots.find((s) => s.aircraft && s.free && s.type === 'planeProp'); pl.teleport(ps.x + 220, null, ps.z - 50); g.simulate(0.3); pl.teleport(ps.x + 2, null, ps.z + 6); g.simulate(0.3); });
await press('KeyF', 1.5);
ok(await ev(() => !!(window.game.player.vehicle && window.game.player.vehicle.kind2 === 'plane')), 'Flugzeug: einsteigen mit F (Strandpiste)');
await hold(['ShiftLeft'], 2.5);
await sim(4);
await hold(['KeyS'], 1.2);
await sim(3);
await press('KeyG', 0.2);
const plane = await ev(() => { const v = window.game.player.vehicle; return { alt: v.altitude, spd: v.speed * 3.6, gear: v.gearDown }; });
await ev(() => { const g = window.game; g.camera3p.yaw = g.player.vehicle.heading + 0.6; g.camera3p.pitch = 0.2; g.simulate(0.3); });
await shot('05_flugzeug');
ok(plane.alt > 20 && plane.spd > 100 && !plane.gear, `Flugzeug: gestartet (${plane.alt.toFixed(0)} m, ${plane.spd.toFixed(0)} km/h, Fahrwerk eingefahren)`);
// Absprung mit Fallschirm
await ev(() => { const v = window.game.player.vehicle; v.pos.y = Math.max(v.pos.y, 120); v.prevPos.copy(v.pos); });
await press('KeyF', 1.2);
await press('Space', 0.3);
ok(await ev(() => window.game.player.parachute), 'Flugzeug: Absprung + Fallschirm (Leertaste)');
for (let i = 0; i < 60; i++) { await sim(0.5); if (await ev(() => window.game.player.onGround)) break; }
ok(await ev(() => window.game.player.onGround && !window.game.player.dead), 'Fallschirm: sicher gelandet');
await sim(6);

// ------------------------------------------------------------------ 5. Speichern im Haus
const savePt = await ev(() => { const g = window.game; const p = g.interactions.points.find((q) => q.type === 'save' && (q.property || 'home') === 'home'); g.player.teleport(p.x, 0.12, p.z); g.police.reset(); g.police.wanted.heat = 0; g.economy.money = 5432; g.player.health = 77; g.simulate(0.5); return { x: p.x, z: p.z }; });
await press('KeyE', 0.3);
const slotsOpen = await ev(() => !!document.querySelector('[data-a=do][data-s="1"]'));
ok(slotsOpen, `Speichern am Bett (E) öffnet die Slots (Bett bei ${savePt.x.toFixed(0)}/${savePt.z.toFixed(0)})`);
await page.click('[data-a=do][data-s="1"]');
await page.click('[data-a=back]');
await sim(0.3);
const saved = await ev(() => { const g = window.game, pl = g.player; return { money: g.economy.money, x: pl.pos.x, z: pl.pos.z, hp: Math.round(pl.health), weapons: pl.inventory.slots.filter(Boolean).map((w) => w.id).join(','), mode: g.ui.mode, paused: g.paused }; });
ok(saved.mode === 'game' && !saved.paused, 'Nach dem Speichern zurück im Spiel');

// ------------------------------------------------------------------ 6. Kompletter Neustart + Laden
await page.reload();
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
await page.click('[data-a=load]');
await page.click('[data-a=do][data-s="1"]');
await ev(() => { window.game.ui.noAutoPause = true; });
await sim(0.5);
const loaded = await ev(() => { const g = window.game, pl = g.player; return { money: g.economy.money, x: pl.pos.x, z: pl.pos.z, hp: Math.round(pl.health), weapons: pl.inventory.slots.filter(Boolean).map((w) => w.id).join(','), mode: g.ui.mode }; });
await shot('06_geladen');
ok(loaded.money === saved.money && Math.hypot(loaded.x - saved.x, loaded.z - saved.z) < 1 && loaded.hp === saved.hp && loaded.weapons === saved.weapons && loaded.mode === 'game',
  `Neustart + Laden: Geld ${loaded.money}/${saved.money}, HP ${loaded.hp}/${saved.hp}, Waffen ${loaded.weapons} / ${saved.weapons}`);

const fails = log.filter((l) => l.startsWith('FAIL'));
console.log(errors.length ? `KONSOLE (${errors.length}):\n` + errors.slice(0, 10).join('\n') : 'Keine Konsolenfehler oder -warnungen.');
console.log(fails.length ? `${fails.length} Prüfungen fehlgeschlagen` : `Alle ${log.length} Prüfungen bestanden.`);
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
