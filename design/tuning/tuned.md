# Tuned pacing (milestone 1, no bugs)

Written by `node tools/solve-all.mjs --write` from the game's own headless solver
(`game/src/sim/solver.mjs`), which drives the real sim (`game/src/sim/world.mjs`) with the
design's profiles at the phone (390x844 portrait, touch, field area 366x664 px) and desktop
(1280x800, mouse, field area 932x752 px) layouts. Bugs, moves and hints are not in yet, so
par will move again when they land.

**What changed vs GAME_DESIGN.md "Pacing":** `k` and `g` are unchanged (the design's table already
hits the lap targets in the game's own sim). **Par** is reset to the solver's slower "average"
time, rounded up to 5 s, as the design specifies.

| Field | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `k` (laps) | 1.5 | 1.6 | 1.7 | 1.8 | 1.9 | 2 | 2.2 | 2.3 | 2.4 | 2.6 | 2.7 | 2.8 | 3 | 3.2 | 3.5 |
| `g` | 1.5 | 1.5 | 1.3 | 1.3 | 1.2 | 1.1 | 1 | 1 | 1 | 0.95 | 0.9 | 0.9 | 0.85 | 0.85 | 0.8 |
| Par (s) | 30 | 35 | 40 | 45 | 45 | 45 | 55 | 55 | 55 | 70 | 75 | 70 | 95 | 90 | 110 |
| Fast, phone (s) | 14.6 | 17.8 | 18.5 | 23.1 | 20.6 | 26.9 | 33 | 42.2 | 37 | 45.3 | 59.2 | 51.1 | 71.6 | 66.3 | 78.9 |
| Average, phone (s) | 16.7 | 20.2 | 22.6 | 31 | 27.1 | 32.5 | 39.5 | 48.9 | 44.4 | 56.1 | 71.2 | 56 | 82.2 | 76 | 87.4 |
| Calm, phone (s) | 34.7 | 42.9 | 49.8 | 60 | 57.4 | 53.4 | 69.2 | 63.6 | 60.4 | 87.7 | 85.8 | 81.5 | 111.3 | 102.9 | 124.3 |
| Scribble, phone (s) | 15.4 | 20.2 | 21.5 | 28.8 | 25.2 | 29.6 | 39.4 | 42.3 | 41.1 | 49.4 | 57.8 | 52.1 | 76.4 | 71.2 | 81.1 |
| Fast, desktop (s) | 15.6 | 19.3 | 21.9 | 29.1 | 25.4 | 29.3 | 36.6 | 42.3 | 43.9 | 48.8 | 60.8 | 52.2 | 75.8 | 70.6 | 84.5 |
| Average, desktop (s) | 27 | 32.4 | 38.5 | 41.8 | 43.4 | 42.1 | 54.2 | 51.5 | 50.2 | 69.9 | 72.4 | 67.6 | 93.2 | 88.3 | 105.3 |
| Calm, desktop (s) | 64.1 | 77 | 92.6 | 102.4 | 107.9 | 96.3 | 125.8 | 110.6 | 94.9 | 158.6 | 146.7 | 131.8 | 188.7 | 165.9 | 204.3 |
| Scribble, desktop (s) | 25.5 | 29.4 | 33.5 | 38.4 | 35.4 | 43.2 | 57 | 54.1 | 52.1 | 62.8 | 68.7 | 62.8 | 95.2 | 90.9 | 102 |

Totals over all 15 fields (minutes): phone-fast 10.1, phone-average 11.9, phone-calm 18.1, phone-scribble 10.9, desktop-fast 10.9, desktop-average 14.6, desktop-calm 31.1, desktop-scribble 14.2.

Notes:

- Every field is won by every profile at both layouts; the unit test
  `test/solver.test.mjs` asserts this, plus the design's windows (average within 15% of par, fast
  and scribble within 1.5x par, calm within 2.5x par), fast never slower than average, and
  scribble never more than 10% slower than average.
- **Scribble vs average:** the design says fast and scribbling players are never slower than
  average. Fast holds everywhere. A random scribbler does not quite: desktop field 6 (43.2 vs 42.1 s), desktop field 7 (57 vs 54.2 s), desktop field 8 (54.1 vs 51.5 s), desktop field 9 (52.1 vs 50.2 s), desktop field 13 (95.2 vs 93.2 s), desktop field 14 (90.9 vs 88.3 s).
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
