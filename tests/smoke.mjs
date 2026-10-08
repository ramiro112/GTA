// Browser-Smoke-Test: startet das Spiel headless (Chromium/SwiftShader), prüft auf Fehler,
// spielt kurze Szenen durch und speichert Screenshots in docs/screenshots/.
// Aufruf: node tests/smoke.mjs [szenario]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
const port = Number(process.env.SMOKE_PORT || 8137);
const scenario = process.argv[2] || 'basic';

const server = spawn(process.execPath, [path.join(root, 'start.js'), String(port)], { env: { ...process.env, NO_OPEN: '1' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 540) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (process.env.VERBOSE) console.log('[console]', m.type(), m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));

const t0 = Date.now();
await page.goto(`http://localhost:${port}/?quality=${process.env.QUALITY || 'low'}`);
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
console.log(`Geladen in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.screenshot({ path: path.join(outDir, `${scenario}_00_menu.png`) });
await page.evaluate(() => { window.game.ui.noAutoPause = true; });

const scenarios = (await import('./scenarios.mjs')).default;
const fn = scenarios[scenario];
if (!fn) { console.error('Unbekanntes Szenario', scenario); process.exit(2); }
const shot = async (name) => page.screenshot({ path: path.join(outDir, `${scenario}_${name}.png`), timeout: 180000 });
try {
  await fn({ page, shot, wait: (ms) => page.waitForTimeout(ms) });
} catch (e) {
  errors.push('SZENARIO: ' + e.message);
}
const stats = await page.evaluate(() => ({ fps: window.game.loop.fps, calls: window.game.renderer.info.render.calls, tris: window.game.renderer.info.render.triangles, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }));
console.log('Statistik:', JSON.stringify(stats));
console.log(errors.length ? `FEHLER (${errors.length}):\n` + errors.slice(0, 15).join('\n') : 'Keine Konsolenfehler.');
await browser.close();
server.kill();
process.exit(errors.length ? 1 : 0);
