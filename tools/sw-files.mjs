// tools/sw-files.mjs -- the service worker's local file list.
//
// game/sw.js caches every file in game/ for offline play. On GitHub Pages the
// deploy workflow stamps its VERSION and FILES; served any other way (local
// play-tests, `?sw=1`), it uses LOCAL_VERSION and LOCAL_FILES, written here
// from the folder. Run after adding or removing a game file:
//   node tools/sw-files.mjs          rewrite the list in game/sw.js
//   node tools/sw-files.mjs --check  exit 1 if the list is out of date
// (test/pwa.test.mjs runs the check.)

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = fileURLToPath(new URL('../game/', import.meta.url));
const SW = join(GAME, 'sw.js');

export function gameFiles(dir = GAME) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(GAME, p).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.filter((f) => f !== 'sw.js' && !f.split('/').some((part) => part.startsWith('.'))).sort();
}

export function listBlock(files) {
  return `const LOCAL_FILES = [\n${files.map((f) => `  '${f}',`).join('\n')}\n];`;
}

const RE = /const LOCAL_FILES = \[[\s\S]*?\];/;

export function currentList(src = readFileSync(SW, 'utf8')) {
  const m = src.match(RE);
  if (!m) return null;
  return [...m[0].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = gameFiles();
  const src = readFileSync(SW, 'utf8');
  if (process.argv.includes('--check')) {
    const cur = currentList(src);
    const ok = cur && JSON.stringify(cur) === JSON.stringify(files);
    if (!ok) { console.error('game/sw.js LOCAL_FILES is out of date: run node tools/sw-files.mjs'); process.exit(1); }
    console.log(`sw.js lists all ${files.length} files`);
  } else {
    writeFileSync(SW, src.replace(RE, listBlock(files)));
    console.log(`sw.js: ${files.length} files`);
  }
}
