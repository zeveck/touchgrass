// test/pwa.test.mjs -- install and offline (GAME_DESIGN.md "Tech plan"): the
// manifest, the service worker's file list, and the page's tags.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { gameFiles, currentList } from '../tools/sw-files.mjs';

const G = new URL('../game/', import.meta.url);
const read = (p) => readFileSync(new URL(p, G), 'utf8');

test('pwa: the manifest names the game and its three icons, which exist', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Touch Grass');
  assert.ok(m.display === 'fullscreen' || m.display === 'standalone');
  assert.equal(m.start_url, './');
  const sizes = m.icons.map((i) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ''}`);
  assert.deepEqual(sizes, ['192x192', '512x512', '512x512:maskable']);
  for (const i of m.icons) assert.ok(existsSync(new URL(i.src, G)), i.src);
});

test('pwa: sw.js caches every game file (the local list is up to date) and keeps the deploy stamps', () => {
  const src = read('sw.js');
  assert.deepEqual(currentList(src), gameFiles(), 'run node tools/sw-files.mjs');
  assert.ok(src.includes("const VERSION = '__BUILD__';"), 'the Pages workflow stamps VERSION');
  assert.ok(src.includes('const FILES = [/*__FILES__*/];'), 'and FILES');
  assert.match(src, /const PREFIX = 'touchgrass-';/);
  for (const f of ['index.html', 'src/main.mjs', 'vendor/report.js', 'vendor/gh-feedback.js', 'manifest.webmanifest']) {
    assert.ok(currentList(src).includes(f), f);
  }
});

test('page: title, description, theme colours, manifest, preview tags, and the report form', () => {
  const html = read('index.html');
  for (const re of [
    /<meta name="description" content="[^"]{60,}"/, /name="theme-color"[^>]*light/, /name="theme-color"[^>]*dark/,
    /<meta name="color-scheme" content="light dark">/, /rel="manifest" href="manifest.webmanifest"/,
    /property="og:title"/, /property="og:description"/, /property="og:image" content="https:\/\/touchgrass\.synapticnoise\.com\/social-card\.jpg"/,
    /<link rel="canonical" href="https:\/\/touchgrass\.synapticnoise\.com\/">/, /property="og:url" content="https:\/\/touchgrass\.synapticnoise\.com\/"/,
    /property="og:image:width" content="1200"/, /property="og:image:alt"/, /name="twitter:card" content="summary_large_image"/,
    /<script src="vendor\/report.js"><\/script>/, /<gh-feedback id="report" trigger="none" repo="zeveck\/touchgrass"/, /theme="light"/,
    /<div id="loading"/,
  ]) assert.match(html, re);
});

test('feedback: the bundled files are gamegen\'s, unchanged', () => {
  const skill = process.env.GAMEGEN_DIR || '/home/vscode/.claude/plugins/cache/gamegen/gamegen/2026.11.20.2/gamegen';
  for (const f of ['gh-feedback.js', 'report.js']) {
    const src = new URL(`file://${skill}/templates/feedback/${f}`);
    if (!existsSync(src)) continue;    // the skill isn't on this machine
    assert.equal(read(`vendor/${f}`), readFileSync(src, 'utf8'), f);
  }
});
