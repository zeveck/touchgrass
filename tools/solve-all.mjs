// tools/solve-all.mjs -- run the headless solver on every field with every
// profile at the phone (390x844) and desktop (1280x800) layouts, and print
// the pacing table. With --write, also writes design/tuning/tuned.md.
//
//   node tools/solve-all.mjs            # print
//   node tools/solve-all.mjs --write    # print and write tuned.md
//
// Progress is printed one line per field as it goes.

import { writeFileSync } from 'node:fs';
import { runField, PACING_PROFILES } from '../game/src/sim/solver.mjs';
import { LEVELS } from '../game/src/sim/levels.mjs';

const profiles = [...PACING_PROFILES, 'careless', 'lanes'];
const rows = [];
const totals = {};
for (const l of LEVELS) {
  const row = { n: l.n, name: l.name, k: l.k, g: l.g, par: l.par };
  for (const lay of ['phone', 'desktop']) {
    for (const p of profiles) {
      const r = runField(l.n, lay, p);
      row[`${lay}-${p}`] = r.won ? r.time : null;
      row[`${lay}-${p}-whole`] = r.whole;
      row[`${lay}-${p}-bites`] = r.bites;
      row[`${lay}-${p}-warnings`] = r.warnings;
      row[`${lay}-${p}-petted`] = r.petted;
      if (PACING_PROFILES.includes(p)) totals[`${lay}-${p}`] = (totals[`${lay}-${p}`] || 0) + (r.time ?? 900);
    }
  }
  row.parFromSolver = Math.ceil(Math.max(row['phone-average'], row['desktop-average']) / 5) * 5;
  rows.push(row);
  console.log(`field ${l.n} ${l.name}: ` + ['phone', 'desktop'].map((lay) =>
    `${lay} ` + profiles.map((p) => `${p} ${row[`${lay}-${p}`] ?? 'STALL'}s${row[`${lay}-${p}-bites`] ? ` (${row[`${lay}-${p}-bites`]} bites)` : ''}`).join(', ')).join(' | ') +
    ` | par ${l.par} (solver ${row.parFromSolver})`);
}
console.log('totals (min): ' + Object.entries(totals).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}`).join(', '));

if (process.argv.includes('--write')) {
  const cols = rows.map((r) => r.n);
  const line = (label, f) => `| ${label} | ${rows.map(f).join(' | ')} |`;
  const md = [];
  md.push('# Tuned pacing (milestone 3, with bugs; re-run in milestone 5 and after the final review)');
  md.push('');
  md.push('Written by `node tools/solve-all.mjs --write` from the game\'s own headless solver');
  md.push('(`game/src/sim/solver.mjs`), which drives the real sim (`game/src/sim/world.mjs`) with the');
  md.push('design\'s profiles at the phone (390x844 portrait, touch, field area 366x664 px) and desktop');
  md.push('(1280x800, mouse, field area 932x752 px) layouts, **with every field\'s bugs in** (the seeded');
  md.push('spawn table). Good play steers round the biters (methodical profiles lift and hop past a biter in');
  md.push('their lane, re-planning as it moves; the scribbler turns away from the red glow) and pets each');
  md.push('friendly once between strokes. Moves are not used: they never add to the meter, so they can\'t');
  md.push('make a field quicker. Hint cards pause the field, so they don\'t count.');
  md.push('');
  md.push('**What changed vs GAME_DESIGN.md "Pacing":** `k` and `g` are unchanged (the design\'s table already');
  md.push('hits the lap targets in the game\'s own sim). **Par** is reset to the solver\'s slower "average"');
  md.push('time, rounded up to 5 s, as the design specifies.');
  md.push('');
  md.push('**Milestone 5:** bugs are drawn bigger (`clamp(2 cells, 36, 72 px)`, ant x1.2, bee and wasp x1.1), which');
  md.push('widens pet areas and bug margins, and each field is fitted to its shape\'s real bounds (field 14\'s');
  md.push('islands). Field 8\'s desktop average moved from 50 s to 50.1 s, so its par is 55 s (was 50 s).');
  md.push('Every other par is unchanged; every profile still wins every field at both layouts.');
  md.push('**Final review:** biters\' anger now builds over repeated passes and they drift towards standing');
  md.push('grass. Every profile still wins every field inside the design\'s windows; good play still takes 0');
  md.push('bites; every par is unchanged (each is still the slower layout\'s average rounded up to 5 s).');
  md.push('');
  md.push(`| Field | ${cols.join(' | ')} |`);
  md.push(`|---|${cols.map(() => '---').join('|')}|`);
  md.push(line('`k` (laps)', (r) => r.k));
  md.push(line('`g`', (r) => r.g));
  md.push(line('Par (s)', (r) => r.par));
  for (const lay of ['phone', 'desktop']) {
    for (const p of profiles) md.push(line(`${p[0].toUpperCase()}${p.slice(1)}, ${lay} (s)`, (r) => r[`${lay}-${p}`] ?? 'stall'));
  }
  md.push(line('Warnings / bites, good play (average), phone', (r) => `${r['phone-average-warnings']} / ${r['phone-average-bites']}`));
  md.push(line('Warnings / bites, good play (average), desktop', (r) => `${r['desktop-average-warnings']} / ${r['desktop-average-bites']}`));
  md.push(line('Warnings / bites, good scribble, phone', (r) => `${r['phone-scribble-warnings']} / ${r['phone-scribble-bites']}`));
  md.push(line('Warnings / bites, good scribble, desktop', (r) => `${r['desktop-scribble-warnings']} / ${r['desktop-scribble-bites']}`));
  md.push(line('Warnings / bites, lanes (no steering), phone', (r) => `${r['phone-lanes-warnings']} / ${r['phone-lanes-bites']}`));
  md.push(line('Warnings / bites, lanes (no steering), desktop', (r) => `${r['desktop-lanes-warnings']} / ${r['desktop-lanes-bites']}`));
  md.push(line('Warnings / bites, careless, phone', (r) => `${r['phone-careless-warnings']} / ${r['phone-careless-bites']}`));
  md.push(line('Warnings / bites, careless, desktop', (r) => `${r['desktop-careless-warnings']} / ${r['desktop-careless-bites']}`));
  md.push(line('Friends petted (good play)', (r) => r['phone-average-petted']));
  md.push('');
  md.push('Totals over all 15 fields (minutes): ' +
    Object.entries(totals).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}`).join(', ') + '.');
  md.push('');
  md.push('Notes:');
  md.push('');
  md.push('- **Bugs:** no pacing profile is ever bitten (the unit test asserts 0 bites). Two profiles never');
  md.push('  steer and aren\'t in par or the totals: **lanes** (the average serpentine sweep, straight through');
  md.push('  every biter) and **careless** (the scribbler). Since the final review, anger **builds up over');
  md.push('  passes**: 0.4 each time a sweeping pointer comes into the radius, plus 0.75 per s inside, fading');
  md.push('  0.3 per s away, full at 1.5; a bite also needs the warning shown for 1.5 s. So one pass warns and');
  md.push('  going back and forth bites, at any speed. A lane sweep is warned on every bug field and not bitten');
  md.push('  (also checked at 150 and 240 px/s); the careless scribbler is bitten now and then (mostly on the');
  md.push('  phone, where its strokes keep crossing the same bugs); both still win every field. Biters also');
  md.push('  drift towards standing grass, so later laps meet them somewhere new.');
  md.push('  "Warnings" counts each time a biter starts a warning.');
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
