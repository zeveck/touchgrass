# The original, as surveyed (2026-11-19)

## What it is

- **`plans/touch-grass.md`** (1,234 lines, Apr 2026, refined May 2026): a detailed 8-phase build plan for
  *Touch Grass*, "a zero-runtime-dependency web relaxation game". Everything below about mechanics comes from
  it. It was reviewed adversarially (its own "Plan Quality" and "Plan Review" sections).
- **Code:** one commit on `feat/touch-grass` (Apr 19): Phase 1 only. Title screen (heading, Start/Continue,
  "Best: --" stub, settings cog, Insect Farm button, all 48px+ with `data-testid`s), a state machine
  (`title | playing | paused | level-won | settings | farm` with validated transitions), a rAF loop with a 50 ms
  dt clamp and FPS sampler, a CSS palette with dark mode and safe-area padding, a guarded `?dev=1&level=N`
  skip, unit tests (state machine), a Playwright e2e for the title (chromium + iPhone 12 WebKit), and a CI
  workflow. The Progress Tracker in the plan was never ticked, but Phase 1's code exists.
- **Assets:** none (`assets/.gitkeep` only).
- **Not committed:** only dev-container tooling, now committed to `main` by the person. Nothing game-related.

## Playing it

There's nothing to play yet: Start goes to an empty `playing` state. Title renders cleanly; no console errors.
Tests: unit 4/4, e2e 2/2 (after moving into `game/`).

## The game the plan describes (the core to keep)

- Sweep a finger or mouse across a canvas field of grass. Touched cells drop to zero height, turn from green to
  gold, and give energy; untouched cells regrow (logistic `h += r(1-h)dt`).
- Energy per cell = `h_before × (1 + min(0.5, speed/500))` × the grass type's multiplier.
- **15 levels**, growing from 12×12 to 36×36, with polygon-masked fields: squares, rectangle, L-shapes, a cross,
  a pentagon, a two-island level (L14), an octagon (L15).
- **Five grass types:** default, tall (slow regrow, more energy), short (fast regrow, less), flowered, stiff
  (needs a second, separate stroke).
- **Win** by banking the energy threshold (`0.5 × validCells × avgMult`) **or** clearing the whole field; both in
  the same frame carries 20% of the threshold into the next level.
- **Three moves** that spend energy: Ring (10, radius 3), Line (20, 5-wide corridor), Full Clear (75). Arm, then
  tap/drag. Refund on disarm, pause or level end.
- **Seven bugs.** Biters (bee, wasp, ant) get angry with a 1.5 s warning halo when your finger is near, then
  bite for 15 energy (never below 0, never a game over). Friendlies (ladybug, butterfly, caterpillar, snail)
  can be tapped to pet them (+5 energy) and join your **Insect Farm** collection. Sweeps can't hurt friendlies.
  Spawn table per level (bugs start at L3).
- **Meta:** per-level and all-time high scores (score = level×100 + energy×2 + time bonus vs par + pets×10),
  Insect Farm screen, a 1200×630 share scorecard (Web Share → clipboard → download), challenge deep links
  (`?score&level&name`), settings (music, SFX, haptics, reduced motion, clear data), haptics, an ARIA live
  region, reduced-motion, perf degradation, PWA-friendly single page.

## Quirks that look deliberate (keep)

- **Never punishing:** no game over, bites floor at 0 energy, the level just continues.
- **First finger wins:** multi-touch is ignored by design.
- **Friendly bugs are untouchable by sweeps and moves** (grass under them is skipped; sweeping nudges them).
- **Stiff grass needs a fresh stroke:** zig-zagging within one stroke doesn't clear it.
- **Green-to-gold colour** for touched grass, shared across all grass types.
- **Zero runtime dependencies**, no build step.
- **Tapping a biter doesn't pet it.** Taps under 200 ms and 10 px are taps; everything else is a sweep.

## Unsure (asked in the plan stop, defaulted)

- The plan's exact numbers (thresholds, costs, regrowth rates, par times) are treated as starting points to tune
  by playing, not fixed values (leeway: some).
- The plan's process scaffolding (zskills phases, 8 MB asset budget, CI gating a protected `main`, exhaustive
  data-testid registry) is kept where it helps (tests, CI, testids) but doesn't dictate the build order.

## What's broken or weak in the original

- Nothing playable beyond the title.
- Title screen is a plain system-font web form: works, but doesn't feel like a game.
- `scripts/test-all.sh` gate didn't match `.mjs` files (fixed in the move commit).
- The plan's art approach (procedural blades + 1024px images shrunk to 128px tiles; text baked into the OG
  image) would look generic; the plan names the retired `gpt-image-1` tool.
- Clear data uses a native `confirm()`; the farm is a grid of cards; no how-to-play, no level select, no
  ending.
