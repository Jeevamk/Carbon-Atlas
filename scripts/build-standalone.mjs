// Bundles dist/ into a single self-contained HTML file (CSS, JS and data inlined).
// Run after `vite build`:  node scripts/build-standalone.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const data = readFileSync(join(dist, 'data', 'co2.json'), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, file) =>
  `<style>${readFileSync(join(dist, file), 'utf8')}</style>`);
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, file) =>
  `<script>window.__CO2_DATA__=${safe(data)};</script>\n<script type="module">${safe(readFileSync(join(dist, file), 'utf8'))}</script>`);

if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('An asset was not inlined; check the patterns above.');
writeFileSync(join(dist, 'standalone.html'), html);
console.log(`dist/standalone.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
