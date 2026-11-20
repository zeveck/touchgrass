# Touch Grass: brief

**In one sentence:** sweep your finger through a sunny meadow, watch the grass bow and turn gold under your
touch and slowly grow back, bank its energy to finish each field, and make friends with the little bugs that
live there.

**The feeling:** the calm, tactile pleasure of running your hand through long grass. Unhurried, warm,
never punishing, quietly satisfying. A few minutes of it should leave you calmer than you started. The name is
the joke, and the game is the gentle answer to it.

## What they asked for

The request was `--finish --leeway some` on this project, so "what they asked for" is what the original
plan clearly aimed at. Keep the core and the best parts; free to rework structure, controls and the look.

- [ ] Sweep a finger or mouse across a field of grass; touched grass drops and grants energy
- [ ] Untouched grass regrows (logistic curve), so the field fights back gently
- [ ] Touched grass shifts from green to gold
- [ ] Faster sweeps give a little more energy
- [ ] 15 hand-tuned levels that grow in size and shape complexity (squares, L-shapes, a cross, a pentagon,
      two islands, an octagon)
- [ ] Grass types: tall, short, flowered, stiff (needs a fresh stroke)
- [ ] Win by reaching an energy threshold or clearing the whole field; both at once carries a bonus forward
- [ ] Three energy-spend moves: ring, line, full clear
- [ ] Hostile bugs (bee, wasp, ant) that get angry with a clear warning and bite (drain energy, never fatal)
- [ ] Friendly bugs (ladybug, butterfly, caterpillar, snail) you pet for bonus energy
- [ ] A persistent Insect Farm collection of the friends you've met
- [ ] Title screen, settings (music, SFX, haptics, reduced motion, clear data), pause
- [ ] Local high scores (per level and all-time)
- [ ] Generated art and generated audio
- [ ] A shareable 1200×630 scorecard and challenge deep links ("X scored N on level M. Beat them?")
- [ ] Zero runtime dependencies; plays on phones and desktop; accessible (reduced motion, live region, 48px
      targets, dark mode)
- [ ] A relaxation game: no game over

## Who and where

Anyone wanting a few calm minutes, on a phone in a spare moment (one thumb, either orientation) or on a
computer with a mouse or trackpad. A level takes from about 15 seconds (the first) to about 2 minutes (the
last); a session is a handful of levels; the whole meadow is about 15 to 25 minutes.

## Style references

None given. The original asks for a "calming meadow at golden hour, soft watercolor style", "cute" top-down
bugs with friendly eyes, warm sunlight, lo-fi/ambient music with nature textures. Borrow that: soft painterly
watercolour, warm light, rounded friendly creatures. Avoid anything that reads as a specific existing
"zen" or idle game.

## Settings and decisions made on the person's behalf

- Finish **in place** on `gamegen-finish`, leeway **some**; game moved into `game/`.
- Platform both, web, no build step (matches the original's zero-dependency rule).
- Scope medium, from the plan's 15 levels.
- The plan's numbers are starting points, tuned by play.
- Budget $20, of which up to $5 for design mock pictures now (`--plan-only` stops before the rest).
- Credit: Rich Conlan.
