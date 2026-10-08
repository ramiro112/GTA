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
