# Tuned pacing (milestone 3, with bugs; re-run in milestone 5 and after the final review)

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
**Final review:** biters' anger now builds over repeated passes and they drift towards standing
grass. Every profile still wins every field inside the design's windows; good play still takes 0
bites; every par is unchanged (each is still the slower layout's average rounded up to 5 s).

| Field | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `k` (laps) | 1.5 | 1.6 | 1.7 | 1.8 | 1.9 | 2 | 2.2 | 2.3 | 2.4 | 2.6 | 2.7 | 2.8 | 3 | 3.2 | 3.5 |
| `g` | 1.5 | 1.5 | 1.3 | 1.3 | 1.2 | 1.1 | 1 | 1 | 1 | 0.95 | 0.9 | 0.9 | 0.85 | 0.85 | 0.8 |
| Par (s) | 30 | 35 | 40 | 45 | 45 | 45 | 55 | 55 | 55 | 70 | 75 | 70 | 90 | 85 | 100 |
| Fast, phone (s) | 14.6 | 17.8 | 18.7 | 23 | 20.6 | 25.6 | 32.3 | 36.3 | 44.1 | 46.4 | 55.2 | 54.8 | 75.4 | 65.8 | 79 |
| Average, phone (s) | 16.7 | 20.2 | 22.5 | 30.3 | 26.7 | 33.6 | 39.8 | 48.7 | 53.1 | 57.6 | 69.3 | 62.3 | 85.6 | 75.9 | 91.7 |
| Calm, phone (s) | 34.7 | 42.9 | 50.1 | 59 | 56.2 | 53.1 | 66.6 | 62.2 | 64.6 | 87.3 | 91.2 | 88 | 112.2 | 100.7 | 124.5 |
| Scribble, phone (s) | 15.4 | 20.2 | 21.2 | 28.3 | 25 | 33 | 37.7 | 39.9 | 44.9 | 49.7 | 58.9 | 53.3 | 77.6 | 78.2 | 81.8 |
| Careless, phone (s) | 15.4 | 20.2 | 21.5 | 28.8 | 25.2 | 33.1 | 40.1 | 44.7 | 50.4 | 49.6 | 70.8 | 61.3 | 79.1 | 106.6 | 115.6 |
| Lanes, phone (s) | 16.7 | 20.2 | 22.6 | 31 | 27.1 | 32.5 | 39.6 | 49 | 44.5 | 56.3 | 71.3 | 58.2 | 83.1 | 76.4 | 88 |
| Fast, desktop (s) | 15.6 | 19.3 | 21.9 | 28.7 | 25.2 | 29.5 | 35.7 | 40 | 44.7 | 47.2 | 61.9 | 52.2 | 72.9 | 66.2 | 76.1 |
| Average, desktop (s) | 27 | 32.4 | 39.3 | 41.7 | 43.1 | 42.1 | 52.6 | 50.1 | 50.7 | 68.7 | 71.4 | 66.4 | 89.6 | 82 | 96.8 |
| Calm, desktop (s) | 64.1 | 77 | 93 | 100.6 | 105.7 | 95.6 | 121.7 | 105.3 | 92.5 | 153.4 | 141.2 | 125.1 | 176.5 | 161.4 | 185.5 |
| Scribble, desktop (s) | 25.5 | 29.4 | 33.4 | 38 | 35.2 | 40 | 53.5 | 52 | 49.2 | 63.8 | 69.2 | 66.8 | 89.1 | 82.6 | 96.7 |
| Careless, desktop (s) | 25.5 | 29.4 | 33.5 | 38.4 | 35.4 | 43.4 | 57.2 | 54.1 | 52.4 | 63 | 69.2 | 62.9 | 95.8 | 95 | 103.1 |
| Lanes, desktop (s) | 27 | 32.4 | 38.5 | 41.8 | 43.4 | 42.5 | 54.4 | 51.6 | 50.5 | 70.2 | 73 | 68.1 | 93.5 | 89.1 | 105.8 |
| Warnings / bites, good play (average), phone | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Warnings / bites, good play (average), desktop | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Warnings / bites, good scribble, phone | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 14 / 0 | 11 / 0 | 16 / 0 | 25 / 0 | 25 / 0 | 37 / 0 | 49 / 0 | 74 / 0 | 48 / 0 | 62 / 0 |
| Warnings / bites, good scribble, desktop | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 6 / 0 | 3 / 0 | 6 / 0 | 18 / 0 | 7 / 0 | 14 / 0 | 20 / 0 | 22 / 0 | 15 / 0 | 47 / 0 |
| Warnings / bites, lanes (no steering), phone | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 / 0 | 4 / 0 | 4 / 0 | 10 / 0 | 10 / 0 | 18 / 0 | 14 / 0 | 25 / 0 | 21 / 0 | 37 / 0 |
| Warnings / bites, lanes (no steering), desktop | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 / 0 | 3 / 0 | 3 / 0 | 6 / 0 | 5 / 0 | 13 / 0 | 11 / 0 | 14 / 0 | 11 / 0 | 24 / 0 |
| Warnings / bites, careless, phone | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 5 / 2 | 7 / 0 | 5 / 1 | 23 / 6 | 13 / 0 | 37 / 6 | 32 / 5 | 53 / 1 | 31 / 11 | 101 / 12 |
| Warnings / bites, careless, desktop | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 2 / 0 | 4 / 0 | 5 / 0 | 9 / 0 | 10 / 0 | 18 / 0 | 16 / 0 | 37 / 0 | 24 / 1 | 46 / 0 |
| Friends petted (good play) | 0 | 0 | 1 | 1 | 1 | 1 | 3 | 2 | 2 | 2 | 2 | 2 | 3 | 4 | 5 |

Totals over all 15 fields (minutes): phone-fast 10.2, phone-average 12.2, phone-calm 18.2, phone-scribble 11.1, desktop-fast 10.6, desktop-average 14.2, desktop-calm 30.0, desktop-scribble 13.7.

Notes:

- **Bugs:** no pacing profile is ever bitten (the unit test asserts 0 bites). Two profiles never
  steer and aren't in par or the totals: **lanes** (the average serpentine sweep, straight through
  every biter) and **careless** (the scribbler). Since the final review, anger **builds up over
  passes**: 0.4 each time a sweeping pointer comes into the radius, plus 0.75 per s inside, fading
  0.3 per s away, full at 1.5; a bite also needs the warning shown for 1.5 s. So one pass warns and
  going back and forth bites, at any speed. A lane sweep is warned on every bug field and not bitten
  (also checked at 150 and 240 px/s); the careless scribbler is bitten now and then (mostly on the
  phone, where its strokes keep crossing the same bugs); both still win every field. Biters also
  drift towards standing grass, so later laps meet them somewhere new.
  "Warnings" counts each time a biter starts a warning.
- Every field is won by every profile at both layouts; the unit test
  `test/solver.test.mjs` asserts this, plus the design's windows (average within 15% of par, fast
  and scribble within 1.5x par, calm within 2.5x par), fast never slower than average, and
  scribble never more than 10% slower than average.
- **Scribble vs average:** the design says fast and scribbling players are never slower than
  average. Fast holds everywhere. A random scribbler does not quite: desktop field 7 (53.5 vs 52.6 s), desktop field 8 (52 vs 50.1 s), desktop field 12 (66.8 vs 66.4 s), phone field 14 (78.2 vs 75.9 s), desktop field 14 (82.6 vs 82 s).
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
