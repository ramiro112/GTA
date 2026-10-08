// Baut eine einzige, eigenständige HTML-Datei: dist/PortAurelia.html
// (JavaScript inkl. Three.js und CSS eingebettet → per Doppelklick ohne Server startbar).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  write: false,
  legalComments: 'eof',
  alias: { three: path.join(root, 'vendor/three.module.js') },
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
const css = fs.readFileSync(path.join(root, 'src/ui/style.css'), 'utf8');
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Port Aurelia</title>
<style>${css}</style>
</head>
<body>
<div id="game"></div>
<div id="ui"></div>
<script>${js}</script>
</body>
</html>`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/PortAurelia.html');
fs.writeFileSync(out, html);
console.log(`Gebaut: ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
