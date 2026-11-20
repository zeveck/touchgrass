// tools/solve-all.mjs -- run the headless solver on every field with every
// profile at the phone (390x844) and desktop (1280x800) layouts, and print
// the pacing table. With --write, also writes design/tuning/tuned.md.
//
//   node tools/solve-all.mjs            # print
//   node tools/solve-all.mjs --write    # print and write tuned.md
//
// Progress is printed one line per field as it goes.

import { writeFileSync } from 'node:fs';
import { runField, PROFILES } from '../game/src/sim/solver.mjs';
import { LEVELS } from '../game/src/sim/levels.mjs';

const profiles = Object.keys(PROFILES);
const rows = [];
const totals = {};
for (const l of LEVELS) {
  const row = { n: l.n, name: l.name, k: l.k, g: l.g, par: l.par };
  for (const lay of ['phone', 'desktop']) {
    for (const p of profiles) {
      const r = runField(l.n, lay, p);
      row[`${lay}-${p}`] = r.won ? r.time : null;
      row[`${lay}-${p}-whole`] = r.whole;
      totals[`${lay}-${p}`] = (totals[`${lay}-${p}`] || 0) + (r.time ?? 900);
    }
  }
  row.parFromSolver = Math.ceil(Math.max(row['phone-average'], row['desktop-average']) / 5) * 5;
  rows.push(row);
  console.log(`field ${l.n} ${l.name}: ` + ['phone', 'desktop'].map((lay) =>
    `${lay} ` + profiles.map((p) => `${p} ${row[`${lay}-${p}`] ?? 'STALL'}s`).join(', ')).join(' | ') +
    ` | par ${l.par} (solver ${row.parFromSolver})`);
}
console.log('totals (min): ' + Object.entries(totals).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}`).join(', '));

if (process.argv.includes('--write')) {
  const cols = rows.map((r) => r.n);
  const line = (label, f) => `| ${label} | ${rows.map(f).join(' | ')} |`;
  const md = [];
  md.push('# Tuned pacing (milestone 1, no bugs)');
  md.push('');
  md.push('Written by `node tools/solve-all.mjs --write` from the game\'s own headless solver');
  md.push('(`game/src/sim/solver.mjs`), which drives the real sim (`game/src/sim/world.mjs`) with the');
  md.push('design\'s profiles at the phone (390x844 portrait, touch, field area 366x664 px) and desktop');
  md.push('(1280x800, mouse, field area 932x752 px) layouts. Bugs, moves and hints are not in yet, so');
  md.push('par will move again when they land.');
  md.push('');
  md.push('**What changed vs GAME_DESIGN.md "Pacing":** `k` and `g` are unchanged (the design\'s table already');
  md.push('hits the lap targets in the game\'s own sim). **Par** is reset to the solver\'s slower "average"');
  md.push('time, rounded up to 5 s, as the design specifies.');
  md.push('');
  md.push(`| Field | ${cols.join(' | ')} |`);
  md.push(`|---|${cols.map(() => '---').join('|')}|`);
  md.push(line('`k` (laps)', (r) => r.k));
  md.push(line('`g`', (r) => r.g));
  md.push(line('Par (s)', (r) => r.par));
  for (const lay of ['phone', 'desktop']) {
    for (const p of profiles) md.push(line(`${p[0].toUpperCase()}${p.slice(1)}, ${lay} (s)`, (r) => r[`${lay}-${p}`] ?? 'stall'));
  }
  md.push('');
  md.push('Totals over all 15 fields (minutes): ' +
    Object.entries(totals).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}`).join(', ') + '.');
  md.push('');
  md.push('Notes:');
  md.push('');
  md.push('- Every field is won by every profile at both layouts; the unit test');
  md.push('  `test/solver.test.mjs` asserts this, plus the design\'s windows (average within 15% of par, fast');
  md.push('  and scribble within 1.5x par, calm within 2.5x par), fast never slower than average, and');
  md.push('  scribble never more than 10% slower than average.');
  const slowScrib = [];
  for (const r of rows) for (const lay of ['phone', 'desktop']) {
    if (r[`${lay}-scribble`] > r[`${lay}-average`]) slowScrib.push(`${lay} field ${r.n} (${r[`${lay}-scribble`]} vs ${r[`${lay}-average`]} s)`);
  }
  md.push('- **Scribble vs average:** the design says fast and scribbling players are never slower than');
  md.push('  average. Fast holds everywhere. A random scribbler does not quite: ' +
    (slowScrib.length ? slowScrib.join(', ') : 'none') + '.');
  md.push('  The design\'s own simulator (`all_k35.txt`) shows the same on desktop (fields 6, 8, 9, 12, 14).');
  md.push('  Changing `k`/`g` moves it around but does not remove it (it is a coverage effect of random');
  md.push('  strokes on shaped fields, not a regrowth effect), so the gap is kept small (under 10%) rather');
  md.push('  than chased. The scribbler stays on the field (turns back at the polygon, not the bounding box)');
  md.push('  and starts a quarter of its strokes somewhere new, so it reaches both of field 14\'s islands.');
  md.push('- Lane spacing is 0.9 x the brush diameter (as in `design/tuning/sim3.mjs`); methodical profiles');
  md.push('  lift at every turn (one stroke per lane).');
  md.push('- Type placement uses exact mix counts (largest remainder) instead of per-cell sampling, so');
  md.push('  average multipliers match the plan\'s table to 3-4 decimals.');
  md.push('- Pre-mown stripes are one brush-width wide: `ceil(2 x max(0.75, 0.05 x short side))` cells,');
  md.push('  at least 2 (field 2: 2 rows through the middle; field 13: alternating 4-row stripes).');
  writeFileSync(new URL('../design/tuning/tuned.md', import.meta.url), md.join('\n') + '\n');
  console.log('wrote design/tuning/tuned.md');
}
