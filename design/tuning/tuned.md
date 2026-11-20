# Tuned pacing (milestone 3, with bugs; re-run in milestone 5)

Written by `node tools/solve-all.mjs --write` from the game's own headless solver
(`game/src/sim/solver.mjs`), which drives the real sim (`game/src/sim/world.mjs`) with the
design's profiles at the phone (390x844 portrait, touch, field area 366x664 px) and desktop
(1280x800, mouse, field area 932x752 px) layouts, **with every field's bugs in** (the seeded
spawn table). Good play steers round the biters (methodical profiles lift and hop past a biter in
their lane, re-planning as it moves; the scribbler turns away from the red glow) and pets each
friendly once between strokes. Moves are not used: they never add to the meter, so they can't
make a field quicker. Hint cards pause the field, so they don't count.

**What changed vs GAME_DESIGN.md "Pacing":** `k` and `g` are unchanged (the design's table already
hits the lap targets in the game's own sim). **Par** is reset to the solver's slower "average"
time, rounded up to 5 s, as the design specifies.

**Milestone 5:** bugs are drawn bigger (`clamp(2 cells, 36, 72 px)`, ant x1.2, bee and wasp x1.1), which
widens pet areas and bug margins, and each field is fitted to its shape's real bounds (field 14's
islands). Field 8's desktop average moved from 50 s to 50.1 s, so its par is 55 s (was 50 s).
Every other par is unchanged; every profile still wins every field at both layouts.

| Field | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `k` (laps) | 1.5 | 1.6 | 1.7 | 1.8 | 1.9 | 2 | 2.2 | 2.3 | 2.4 | 2.6 | 2.7 | 2.8 | 3 | 3.2 | 3.5 |
| `g` | 1.5 | 1.5 | 1.3 | 1.3 | 1.2 | 1.1 | 1 | 1 | 1 | 0.95 | 0.9 | 0.9 | 0.85 | 0.85 | 0.8 |
| Par (s) | 30 | 35 | 40 | 45 | 45 | 45 | 55 | 55 | 55 | 70 | 75 | 70 | 90 | 85 | 100 |
| Fast, phone (s) | 14.6 | 17.8 | 18.7 | 23 | 20.6 | 29.2 | 31.5 | 35.8 | 40.1 | 43.4 | 54 | 52.8 | 71.1 | 64.1 | 75.2 |
| Average, phone (s) | 16.7 | 20.2 | 22.5 | 30.3 | 26.7 | 34.3 | 38.5 | 47.7 | 48 | 57.4 | 68.1 | 62.7 | 84.3 | 75.5 | 87.7 |
| Calm, phone (s) | 34.7 | 42.9 | 50.1 | 59 | 56.2 | 53.3 | 66.6 | 62.2 | 63.1 | 86.2 | 85.8 | 86.7 | 109.7 | 100.8 | 119.9 |
| Scribble, phone (s) | 15.4 | 20.2 | 21.2 | 28.3 | 25 | 30.6 | 38.6 | 38.3 | 44.7 | 48.9 | 55.5 | 53.6 | 73.6 | 81.1 | 80.9 |
| Careless, phone (s) | 15.4 | 20.2 | 21.5 | 28.8 | 25.2 | 29.8 | 39.6 | 42.3 | 41.4 | 49.4 | 57.8 | 52.5 | 76.5 | 80.5 | 81.4 |
| Fast, desktop (s) | 15.6 | 19.3 | 21.9 | 28.7 | 25.2 | 29.5 | 35.8 | 39.9 | 44.6 | 47.3 | 61.7 | 54.6 | 74.5 | 65.5 | 75.3 |
| Average, desktop (s) | 27 | 32.4 | 39.3 | 41.7 | 43.1 | 42 | 52.6 | 50.1 | 50.1 | 68.7 | 71 | 66.9 | 89.2 | 81.9 | 96.9 |
| Calm, desktop (s) | 64.1 | 77 | 93 | 100.6 | 105.7 | 95 | 120.6 | 106.3 | 93.7 | 153.4 | 142.1 | 125 | 178.4 | 164.2 | 185.4 |
| Scribble, desktop (s) | 25.5 | 29.4 | 33.4 | 38 | 35.2 | 38.1 | 54.4 | 50 | 48.6 | 65.7 | 68.7 | 63.7 | 90.3 | 82.4 | 91.6 |
| Careless, desktop (s) | 25.5 | 29.4 | 33.5 | 38.4 | 35.4 | 43.4 | 57 | 54.1 | 52.3 | 62.9 | 69.2 | 62.9 | 95.8 | 91 | 102.8 |
| Bites (careless, phone / desktop) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 / 0 | 0 / 0 |
| Friends petted (good play) | 0 | 0 | 1 | 1 | 1 | 1 | 3 | 2 | 2 | 2 | 2 | 2 | 3 | 4 | 5 |

Totals over all 15 fields (minutes): phone-fast 9.9, phone-average 12.0, phone-calm 18.0, phone-scribble 10.9, desktop-fast 10.7, desktop-average 14.2, desktop-calm 30.1, desktop-scribble 13.6.

Notes:

- **Bugs:** no pacing profile is ever bitten (the unit test asserts 0 bites). The **careless**
  row is the "bitten" check: the scribbler with its steering off. It wanders into biters and gets
  bitten now and then (a bite needs 1.5 s of sweeping inside the anger radius, which a quick
  random scribble rarely does), and it still wins every field. It isn't in par or the totals.
- Every field is won by every profile at both layouts; the unit test
  `test/solver.test.mjs` asserts this, plus the design's windows (average within 15% of par, fast
  and scribble within 1.5x par, calm within 2.5x par), fast never slower than average, and
  scribble never more than 10% slower than average.
- **Scribble vs average:** the design says fast and scribbling players are never slower than
  average. Fast holds everywhere. A random scribbler does not quite: phone field 7 (38.6 vs 38.5 s), desktop field 7 (54.4 vs 52.6 s), desktop field 13 (90.3 vs 89.2 s), phone field 14 (81.1 vs 75.5 s), desktop field 14 (82.4 vs 81.9 s).
  The design's own simulator (`all_k35.txt`) shows the same on desktop (fields 6, 8, 9, 12, 14).
  Changing `k`/`g` moves it around but does not remove it (it is a coverage effect of random
  strokes on shaped fields, not a regrowth effect), so the gap is kept small (under 10%) rather
  than chased. The scribbler stays on the field (turns back at the polygon, not the bounding box)
  and starts a quarter of its strokes somewhere new, so it reaches both of field 14's islands.
- Lane spacing is 0.9 x the brush diameter (as in `design/tuning/sim3.mjs`); methodical profiles
  lift at every turn (one stroke per lane).
- Type placement uses exact mix counts (largest remainder) instead of per-cell sampling, so
  average multipliers match the plan's table to 3-4 decimals.
- Pre-mown stripes are one brush-width wide: `ceil(2 x max(0.75, 0.05 x short side))` cells,
  at least 2 (field 2: 2 rows through the middle; field 13: alternating 4-row stripes).
