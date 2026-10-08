// Prüft die gebaute Einzeldatei dist/PortAurelia.html (per file://, ohne Server).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + path.join(root, 'dist/PortAurelia.html') + '?quality=low');
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
await page.click('[data-a=new]');
await page.evaluate(() => { window.game.ui.noAutoPause = true; window.game.simulate(2); });
await page.screenshot({ path: path.join(root, 'docs/screenshots/dist_start.png') });
console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'Einzeldatei startet ohne Fehler.');
await browser.close();
process.exit(errors.length ? 1 : 0);
