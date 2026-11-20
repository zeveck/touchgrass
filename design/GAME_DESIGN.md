# Touch Grass

*Run your hand through the meadow.*

## Pitch

Sweep a finger or mouse through a sunlit field and the grass bends, flattens and turns gold under your touch,
then slowly grows back. Every stroke through standing grass gives energy. Fill the meter to its line and the
meadow sighs, blooms and opens the next field. Touch every blade along the way and you get a head start on the
next one. You also meet the bugs who live there: grumpy bees, wasps and ants that warn you before they nip, and
friendly ladybugs, butterflies, caterpillars and snails you can pet and collect in your Bug Garden. There's no
timer you can fail and no game over. It's just the pleasure of touching grass.

**Finished from the person's own project.** The core design (sweep, regrowth, energy, green-to-gold, 15 shaped
levels, five grass types, three moves, seven bugs, the farm, scores, sharing, challenge links) is theirs, from
`plans/touch-grass.md`. At leeway *some*, this design keeps all of it and reworks the numbers, presentation,
pacing and screens. Each change to one of the person's mechanics is marked **(changed)**, with the reason.

## Settings

- Platform: both. Desktop with a mouse or trackpad; phones and tablets by touch, in either orientation.
- Target: web. Plain HTML and ES modules in `game/src/`, no build step, **no runtime dependencies** (kept).
- Scope: medium. 15 fields in three times of day. Seeing the whole meadow takes about 15 to 25 minutes, plus
  replays for scores, whole-field badges and bugs.
- Budget: $20 for generated art and audio. About $2 of that goes on design mock pictures now, and every mock
  picture becomes a final asset.
- Tools available: imagegen2 (OpenAI), anim8gen, nanogen (Gemini), audiogen (ElevenLabs, creator plan),
  playwright-cli, Python 3 + Pillow, and the original's unit + e2e harness (`bash scripts/test-all.sh`).
  ffmpeg is not installed.
- Credit: Rich Conlan
- Finish in place on branch `gamegen-finish`. The game lives in `game/`.
- Decisions made on the player's behalf:
  - Every number below was checked with a headless pacing simulator (see "Pacing" and Tech plan). The game's
    own solver re-tunes `k`, `g` and par with bugs included, and the tuned values get written back here.
  - **(changed)** The 15 levels are grouped into three times of day (morning, afternoon, golden hour), each
    with its own painted surroundings and music. This gives the long run a visible journey and an ending.
  - **(changed)** A painted storybook look replaces the plan's flat procedural look and system-font UI.
  - **(changed)** The Insect Farm becomes the **Bug Garden**: a small painted garden where the friends you've
    met wander about, instead of a grid of cards. It holds the same data.
  - **(changed)** A level map is added so finished fields can be replayed. **Play** still goes straight to the
    next unfinished field.
  - **(changed)** The HUD mini-map is dropped. The whole field is always on screen, so it repeated what you
    can already see.
  - **(changed)** Clear data asks in an in-game dialog, not the browser's `confirm()`.
  - **Dark mode:** the game is a sunlit painting and looks the same in both modes. Dark mode changes only
    what surrounds it: the page behind the letterbox, the loading screen, `theme-color` and system controls
    (`color-scheme: light dark`). **(changed)** Reason: a darkened meadow would fight the whole look. The
    brief's "dark mode" item is met by respecting the system setting around the painting.

## The player's fantasy

You're lying in a summer meadow with your hand trailing through the grass. You're a gentle giant in a tiny
world. The grass leans away from your fingers, gold dust lifts into the air, bugs bumble about their day, and
the field slowly heals behind you.

## Core loop

- **10 seconds (the hands):** press and drag. Standing grass under your finger bends away from the motion,
  lies flat, flashes gold and puffs a few gold motes that drift into the energy meter, with a soft rustle
  pitched by how tall the grass was. Faster strokes give a little more energy. Behind you, the grass slowly
  grows back, and **stands up again when it's worth sweeping**.
- **15 seconds to 2 minutes (a field):** each field has a shape and a grass mix. Sweep the whole field once,
  then go round again, sweeping whatever has stood back up. A field takes 1.5 rounds ("laps") at first and
  3.5 on the last. Steer around grumpy bugs (their red glow tells you to move away), pet the friendly ones, and
  use a move when it does a job sweeping can't. Fill the meter to the line and the field blooms. If you
  touched every blade by then, the next field starts with a head start.
- **Session (why you come back):** the next field, a better score or a whole-field badge on an old one, a
  friend you haven't met yet for the Bug Garden, and a challenge link from a friend.
- **The mechanic it lives or dies by:** *the stroke*. It must feel lush and immediate: no lag, no skipped
  grass on fast swipes, grass that visibly bends and springs back, and a sound that follows your finger. If
  sweeping isn't pleasant on its own in the first milestone, fix that before anything else.

### Grass, energy and regrowth rules

These replace the plan's fast regrowth. **(changed)** Reason: at the plan's `r = 2.0`, swept grass came back
to 0.95 height in 1.5 s. The gold trail vanished at once, a full clear was impossible by hand, and scribbling
on one spot filled field 15's meter in about 10 seconds. These rules make covering the field the way to
progress, not scrubbing one patch, and they never stall a quick player.

- **Brush.** A stroke sweeps every cell whose centre lies within the brush radius of the pointer's path. Each
  frame, the segment between pointer samples is stamped as a capsule, so fast swipes never skip cells. This
  replaces the plan's one-cell Bresenham line. **(changed)** Reason: one cell is a 10 px line under a 40 px
  finger on a phone.
  - Radius = `max(0.75 cells, 5% of the field's shorter on-screen side, 18 CSS px for touch / 14 CSS px for
    mouse or pen)`.
  - So the brush is always about a twentieth of the field across: 18 px on field 15 on a phone, 38 px on field
    15 on desktop, 23 px and 47 px on field 1. It feels like a hand, not a broom, and phone and desktop take a
    similar number of strokes to cover a field.
- **Height** `h` runs from 0 to 1. Every field starts fully grown (`h = 1`), except the pre-mown stripes on
  fields 2 and 13 (see Structure).
- **Standing height `F = 0.4`.** Grass at or above 0.4 stands up and is worth sweeping. Grass below it lies
  low. **(changed)** Reason: in round 1 every sweep reset grass to 0, even grass too short to pay, so a brisk
  player who came back before it reached the yield height reset the whole field and never won (field 15 on a
  phone at 600 px/s stalled at 64% of the line after 10 minutes in simulation).
- **Sweeping a standing cell** (`h ≥ 0.4`) that isn't under a bug:
  - Energy gained = `type multiplier × h × speed factor`. What you see is what you get: a taller tuft gives
    more motes, and every standing tuft gives some.
  - Speed factor = `1 + 0.2 × clamp((speed − 150) / 450, 0, 1)`, with speed in CSS px per second. That's +20%
    at 600 px/s or faster. **(changed)** The cap drops from +50% to +20% so haste isn't the best plan.
  - Then `h = 0`, `goldness = 1`, `touched = true`, and the cell rests for 1.5 s before regrowing.
- **Sweeping a low cell** (`h < 0.4`) only bends it: it sways with the stroke and is marked touched. It gives
  nothing, and its height and regrowth carry on untouched. So rubbing one spot earns nothing until the grass
  stands up again, and sweeping over short grass never costs you anything.
- **Regrowth** (truly logistic, from a seed): after the 1.5 s rest,
  `h += r × g × max(h, 0.08) × (1 − h) × dt`, where `r` is the type's rate and `g` is the field's regrow
  scale. The grass creeps up slowly, speeds up in the middle, then eases to full.
- **Colour.** Each cell has its own `goldness`: 1 when swept, then `max(0.4, 1 − h)` as it grows back.
  Touched grass never goes fully green again that field, so **untouched grass stays deep green** and you can
  see what's left. Untouched cells have `goldness = 0`. (The floor is 0.4, up from 0.25, so touched and
  untouched stay apart on 10 px tufts.)
- **Grass types:**

| Type | Energy multiplier | Regrow rate `r` (/s) | Stands up again (g = 1) | Full again (g = 1) | Look |
|---|---|---|---|---|---|
| Default | 1.0 | 0.30 | ~12 s | ~23 s | medium rounded tuft |
| Tall | 1.6 | 0.18 | ~19 s | ~37 s | long, wispy, darker blades |
| Short | 0.7 | 0.55 | ~7 s | ~13 s | low stubbly clover tuft |
| Flowered | 1.2 | 0.30 | ~12 s | ~23 s | tuft dotted with white and yellow flowers |
| Stiff | 1.0 | 0.25 | ~14 s | ~27 s | straight dark spikes with a strong ink outline |

  Times include the 1.5 s rest. At `g = 1.5` (field 1) default grass stands up after 8.3 s; at `g = 0.8`
  (field 15) after 14.3 s.
- **Stiff grass needs a fresh stroke** (kept). The first stroke over standing stiff grass *loosens* it: it
  twangs, wobbles and changes to its own **loosened** look (bent over, lighter, outline gone), and gives a
  10 ms haptic tick. It doesn't flatten and gives no energy. Zig-zagging within the same stroke does nothing
  more. A new stroke flattens it as normal. A new stroke is a fresh press, or with hover-sweep, the pointer
  after it left the field or rested for 0.4 s. Twangs are limited to one every 120 ms. Loosened grass stays
  loosened until it's flattened. **After regrowth**, stiff grass becomes stiff again the moment it stands up
  (reaches 0.4), and is drawn with the stiff tuft again.
- **Under bugs.** A cell is "under a bug" if its centre lies within 0.35 × the bug's drawn size of the bug's
  centre. Strokes and moves skip those cells (kept: friendlies are never harmed). A sweep over a friendly
  nudges it one brush-width away (kept).

## Controls

**Phone orientation:** either. The HUD and toolbar are placed first, inside the safe-area insets, and the
field fills what's left, so they never cover it.

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Sweep grass | Hold the left button and drag over the field. Optional: **Sweep by hovering** in Settings (off by default) | Drag one finger over the field. The first finger wins and extra fingers are ignored (kept). |
| Pet a friendly bug | Click it | Tap it |
| Arm a move | Click Ring / Line / Clear in the toolbar, or press **1 / 2 / 3** | Tap the toolbar button (64 px, cost shown under the icon) |
| Use an armed Ring | Press on the field to show the ring, drag to aim, release to fire | Same |
| Use an armed Line | Drag along the field. The corridor shows as you drag and fires on release | Same |
| Use an armed Clear | Click the field | Tap the field |
| Cancel an armed move | Click the armed button again, press **Esc**, or wait 5 s | Tap the armed button again, or wait 5 s |
| Pause | **Esc** (when no move is armed) or **P**, or the pause button | Pause button (48 px) |
| Mute / unmute | **M**, or the speaker button | Speaker button beside pause |
| Menus | Click; **Tab / Enter / Space** move between and press focused buttons | Tap |

- **Tap or sweep.** A press that starts on a friendly bug's pet area waits to see what it is. Released within
  **350 ms** after moving less than **14 px** in total, it's a pet. Anything else turns into a sweep from the
  press point. A press anywhere else sweeps at once, so there's no lag. **(changed)** The plan's 200 ms /
  10 px turned relaxed taps into sweeps. A pet latches the bug at press, so a moving bug is still petted.
- **Pet area:** a circle of radius `max(24 px, half the drawn bug size + 6 px)`, so every friend has at least
  a 48 px target.
- **Tapping a biter does nothing** (kept). A press near a biter is a sweep like any other.
- **A sweeping pointer** is one that is pressed (or, with hover-sweep, over the field) **and moved in the last
  0.4 s**. Only a sweeping pointer sweeps grass or angers biters. A finger held still, or a mouse parked over
  the field with hover-sweep on, does neither.
- **Hover-sweep** (desktop setting, off by default): the pointer sweeps whenever it moves over the field, with
  no button held. Clicks still pet bugs and fire moves. The hint card says that a moving pointer angers
  grumpy bugs when you switch it on.
- **Armed moves and the field's edge.** A Line whose drag touched the field fires along the part inside the
  field, even if the release lands outside it (thumbs overshoot edges). A drag that never touches the field
  fires nothing. The Ring's aim is clamped to the field's shape. The 5 s auto-cancel is paused while the
  pointer is down.
- **Robust pointers.** The field canvas uses `setPointerCapture`. These are all treated exactly like a
  release, except that an armed Ring or Line is **cancelled** (nothing paid) instead of fired:
  `pointercancel`, `lostpointercapture`, window `blur`. The stroke ends, an angry bug calms down, and the
  rustle stops. When the page is hidden (`visibilitychange`), the game pauses. CSS: `touch-action: none` on
  the body and canvas, `overscroll-behavior: none` on `html` and `body`, `user-select: none`,
  `-webkit-touch-callout: none`, and `contextmenu` is prevented on the field. This stops pans,
  pull-to-refresh and the iOS long-press menu.
- **Keyboard:** Esc cancels an armed move first. Only when nothing is armed does it pause.

## Structure and difficulty

Fifteen fields across one summer day. Sizes and shapes are kept from the original plan's polygons. Each field
gets a name. A short hint card introduces **what's new** the first time. Hint cards appear when the field opens,
before your first stroke, with the field paused. The press that dismisses a card is swallowed and never sweeps.
Hints never repeat. Each move is introduced on the field where its job first matters. **(changed)** Reason:
the Ring used to unlock on field 4, which has no bugs and where the brush reaches every corner, so it taught
nothing.

| # | Name | Time | Size, shape | What's new |
|---|---|---|---|---|
| 1 | The Back Lawn | Morning | 12×12 square | Sweeping and the meter. A ghost hand shows a stroke until you make your first one. |
| 2 | Dew Patch | Morning | 13×13 square | Regrowth. **The field opens with a broad stripe already mown and growing back**, so you can watch it stand up. Hint: "Grass grows back. When it stands up, sweep it again." |
| 3 | Clover Corner | Morning | 15×15 square | **Short grass** (stands up fast, worth less) and the first **ladybug**: tap to pet. The first friend joins the Bug Garden. The **whole-field badge** is explained. |
| 4 | Long Meadow | Morning | 17×19 rectangle | **Tall grass** (slow to grow back, worth more). |
| 5 | Buttercup Field | Morning | 19×19 square | **Flowered grass** (a little more energy, petals fly). End of morning: the light warms. |
| 6 | The Garden Corner | Afternoon | 21×21 L-shape | First odd shape and the first **ant**. It glows red when your finger comes close; move away or it nips. The **Ring** unlocks: "A Ring calms a grumpy bug and sweeps the grass around it." |
| 7 | Picnic Lawn | Afternoon | 23×23 square | Two ladybugs, an ant and the first **snail** **(changed: the snail arrives here, not on field 14, so the Bug Garden fills sooner)**. A calm breather. |
| 8 | Butterfly Bend | Afternoon | 25×25 L-shape | **Butterfly**: it flutters about and settles now and then. Tap it to say hello. |
| 9 | Crossroads | Afternoon | 27×27 cross | **Stiff grass**: loosen it, lift your finger, sweep again. Two ants. The **Line** unlocks: "A Line flattens stiff grass in one go." |
| 10 | Orchard Grass | Afternoon | 29×29 square | **Bee**: wanders faster than ants. Every grass type together. End of afternoon. |
| 11 | Hedge Garden | Golden hour | 31×31 L-shape | **A hedge of tall grass** lines the outer edges, and a bee and two ants start at the L's inner corner. **Full Clear** unlocks: "Full Clear touches every blade at once, even round the grumpy corner." |
| 12 | Five-Stone Lawn | Golden hour | 33×33 pentagon | **Wasp**: quick and wide-roaming. |
| 13 | The Big Green | Golden hour | 34×34 square | **A half-mown lawn**: it opens with alternating mown stripes growing back, so the field is a moving patchwork. The busiest bug field yet. |
| 14 | Two Islands | Golden hour | 35×35 two islands | A gap between two fields; the **caterpillar** arrives. |
| 15 | Sunset Meadow | Golden hour | 36×36 octagon | The finale: every bug, every grass type. Winning it plays the ending. |

Polygon vertices, grass-type mixes and the bug spawn table are the original plan's (Phase 3 and Phase 5
tables), with one change: a snail also spawns on field 7. Fields 2, 11 and 13 change only *where* types and
starting heights are placed, not the mix. All placement and bug spawns are seeded per field (see Tech plan).

- **Pre-mown cells** (field 2's stripe, field 13's alternating stripes, each stripe one brush-width wide):
  they start at `h = 0.05`, `touched = false`, `goldness = 0`, with no rest. They grow back normally and must
  still be swept for the whole-field badge.

### Pacing

**The meter line = `k × one lap`**, where one lap is the energy of sweeping the whole field once at full height
(`valid cells × average type multiplier`). So `k` is the number of laps a field takes. **(changed)** The plan
used `k = 0.5`. `g` is the field's regrow scale: small fields regrow faster so the second lap has grass to sweep.

**Targets:** field 1 is a tutorial of 1.5 laps (about 15 to 30 s). Field 15 is 3.5 laps (about 1.5 to 2
minutes). The whole run is about 12 to 15 minutes of sweeping, or 15 to 25 minutes with bugs, hints and cards.
Later fields get longer mostly from what changes between laps (bugs to steer round, stiff grass, the striped
lawn), not from more identical laps.

**Player profiles** (all in CSS px per second): fast-methodical 600, average 350, calm 150, and a scribbler
(random strokes of 1.5 s at 700 px/s with short lifts). Methodical profiles sweep serpentine lanes, one stroke
per lane (they lift at each turn). Layouts: phone 390×844 portrait (field area 366×603 px) and desktop 1280×800
(field area 902×752 px).

| Field | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `k` (laps) | 1.5 | 1.6 | 1.7 | 1.8 | 1.9 | 2.0 | 2.2 | 2.3 | 2.4 | 2.6 | 2.7 | 2.8 | 3.0 | 3.2 | 3.5 |
| `g` | 1.5 | 1.5 | 1.3 | 1.3 | 1.2 | 1.1 | 1.0 | 1.0 | 1.0 | 0.95 | 0.9 | 0.9 | 0.85 | 0.85 | 0.8 |
| Average, phone (s) | 17 | 19 | 23 | 30 | 27 | 32 | 40 | 50 | 52 | 56 | 71 | 56 | 73 | 81 | 87 |
| Average, desktop (s) | 29 | 33 | 41 | 44 | 45 | 42 | 56 | 53 | 56 | 71 | 73 | 67 | 86 | 88 | 105 |
| Starting par (s) | 30 | 35 | 45 | 45 | 45 | 45 | 60 | 55 | 60 | 75 | 75 | 70 | 90 | 90 | 105 |

**Simulator check of the standing-height rule** (fields 1 and 15, no bugs, seconds to win; "stall" = no win):

| Field, layout | Cell, brush radius | Fast 600 | Average 350 | Calm 150 | Scribble |
|---|---|---|---|---|---|
| 1, phone | 30.5 px, 23 px | 15 | 17 | 37 | 16 |
| 1, desktop | 62.7 px, 47 px | 16 | 29 | 69 | 29 |
| 15, phone | 10.2 px, 18 px | 79 | 87 | 124 | 82 |
| 15, desktop | 20.9 px, 38 px | 84 | 105 | 204 | 100 |
| *Round 1 rule, 15, phone* | *10.2 px, 18 px* | *stall (64% at 600 s)* | *164* | *86* | *144* |

- Fast and scribbling players are never slower than average players, on every one of the 15 fields and both
  layouts. Over all 15 fields: phone fast 9.9 min, average 11.9, calm 18.4, scribble 10.7; desktop fast 10.6,
  average 14.8, calm 32.0, scribble 14.8.
- The result barely depends on the exact standing height: with `F = 0.3` or `0.5`, field 15 times move by
  under 15%.
- Calm play on desktop is the slowest case, because the field is twice as many pixels across. It still wins
  every field, and nothing is lost by going slowly.
- **Par** is the slower of the two layouts' "average" times, rounded up to 5 s. The starting pars above come
  from the pacing simulator without bugs. The game's solver (with bugs, stripes and lifts) sets the final ones.

**The difficulty curve** comes from size, grass mix and bugs, never from a clock. Early fields are small and
all default grass. Later ones mix fast-regrowing short grass, stiff grass that needs two strokes, and more
biters to steer around.

**Avoiding frustration:**

- No game over and no fail timer. Bites take a little energy (never below 0) and the field carries on.
- The angry glow always shows for at least 1.5 s before a bite (kept hard minimum), with a rising buzz and a
  haptic tick.
- The win is the meter. You never need to find the last blade of grass; touching every blade is an optional
  bonus.
- Grass always grows back and sweeping short grass never resets it, so the meter can always be filled, at any
  speed.
- A field can be restarted from pause, and every unlocked field can be replayed from the map.

## Win, lose and progress

- **Win a field:** fill the energy meter to its line. **(changed)** Reason: the plan also let a full clear
  win. With grass growing back, every cell can't be flat at once on a big field, and touching every cell
  happens before the meter fills, so it would have made the meter pointless.
- **Whole field (the "clear"):** a field is **cleared** when every valid cell has been touched at least once
  this field (bending low grass counts, and moves count).
  - A cell under a bug counts as touched once every other valid cell is touched.
  - A small leaf badge next to the meter fills in a ring as you go and turns gold at 100%. From 90%, it also
    shows how many cells are left ("3 left").
  - From 90%, untouched cells shimmer softly so you can find them on a small screen. With reduced motion they
    get a steady pale outline instead.
  - Untouched grass stays deep green on the field.
- **Both at once → head start** (the plan's carry-over, **changed**): if the field was cleared when the meter
  reached the line, the next field starts with its meter **15% full** ("Head start: +15%").
  - The head start is a share of the *next* field's line, so it can't snowball.
  - It's saved and used once, the next time that field is started, from anywhere. Only one can be held. If a
    field started with a head start is restarted, the restart keeps it.
  - It can be earned on any play, first or replay. Field 15 has no next field, so clearing it gives only the
    whole-field score.
  - It isn't earned or used in guest challenge play.
  - Reason: the plan's 20% of the current threshold, plus Full Clear always clearing, could win later fields in
    their first second.
- **Win the game:** finish field 15. The ending plays, then the map shows all 15 fields in bloom.
- **Lose:** you can't. Bites drain a little energy and the field carries on.
- **Bites** take **3% of the field's line** (never below 0). **(changed)** The plan's flat 15 meant nothing on
  late fields and a lot on early ones.
- **Petting** gives **2% of the line** and 25 score, **once per bug per field**. More taps still make it hop,
  float hearts and chirp. **(changed)** Reason: tap spamming earned unlimited energy.
- **Score** (**changed**: "energy at win × 2" is always about the same as the line, so it's replaced):
  `field × 100 + whole-field 250 + 2 per second under par (up to 100) + 25 per bug petted`. Speed is only a
  small part of it, because this is a calm game. A head start saves a few seconds, so it's worth at most about
  20 points. It's shown on the field-complete card next to your best for that field.
- **Saved** (one localStorage key, `touchgrass.v1`, kept): unlocked fields, best score per field, all-time
  best, a pending head start, the Bug Garden (species, first met, fields befriended), settings (including
  name and hover-sweep), and hints seen. Saved after every field, every first pet of a bug, and every settings
  change.

## Moves

The plan's three moves are kept. **(changed)** Each now has a job sweeping can't do, and none can speed up a
win. Reason: at the plan's flat costs every move earned more than it cost (Line about 5× sweeping) and Full
Clear won any field outright. In round 1 they earned nothing and only reset grass, so nobody would use them.

**The price rule: a move never adds to the meter.**

- A move flattens the **standing** grass it covers and gives that grass's normal energy (`type multiplier × h`,
  with no speed bonus).
- It costs the **full-height** value of the same cells (`type multiplier × 1` each).
- So it breaks even on full-grown grass and costs a little more on shorter grass. Low grass in its area is
  bent and touched, free. Cells under bugs are skipped and not charged.
- It's paid and paid back in the same instant when it fires, so the meter only ever stays level or dips.

| Move | Unlocks | Size | Its job |
|---|---|---|---|
| Ring | Field 6 | A disc of radius `max(3 cells, 2.5 × brush radius)` around the aim point | **Calms every biter in the disc** (each flees, see Bugs) and sweeps the grass around it, which you can't do by hand without a bite. |
| Line | Field 9 | A corridor 3 × brush radius wide along the dragged path, up to the field's width long | **Flattens stiff grass in one go**, ignoring the fresh-stroke rule, and reaches far edges and corners in one drag. |
| Full Clear | Field 11 | Every valid cell not under a bug | **Touches every blade**, which completes the whole-field badge (and so earns the head start) on a big field where the last cells are hard to find. A gust rolls across the meadow and the whole field regrows in step. |

- **Prices shown.** The button shows the price for an average spot as a share of the line ("~3%"). Full Clear
  shows its exact price, updated twice a second. While armed, the preview shows the exact price for where
  you're aiming. A button is disabled when the meter is below its shown price. If the exact price is more than
  the meter, the preview turns grey and releasing does nothing (no charge, a soft low click).
- **Typical prices** (full-height cells covered, at the field's average mix): Ring on field 6 covers about 30
  cells, about 4% of the line. Line across field 9 covers about 100 cells, about 10%. Full Clear
  costs a full lap minus the low grass, which is at most 1/k of the line (37% on field 11, 29% on field 15). The
  meter has to be well past the first lap before you can afford it.
- **Paid when it fires**, not when armed. Arming never drains the meter, so there's nothing to refund on
  cancel, pause, a pointer cancel or the end of a field. Tapping a disabled button plays a soft low click.
- **Preview while armed:** the Ring's circle and the Line's corridor show under the pointer before release,
  with the grass they'd flatten shimmering. Full Clear makes the whole field shimmer.
- A Line passing over a grumpy bug also calms it. Moves never harm a bug.
- A press on a friendly bug while a move is armed pets the bug, and the move stays armed (kept).
- Firing a move doesn't anger biters. Only a sweeping pointer does.
- Unit tests: across random aims and field states, the meter after any move is never higher than before it;
  and no field can be won in under 10 s with any combination of moves and a head start (field 2 with a head
  start is the quickest case, at about 15 s for the fast and scribble profiles).

## Bugs

Seven species, kept from the plan with its wander chances and spawn table (plus the snail on field 7). Sizes and
speeds are now in CSS pixels, so bugs look and move the same on every screen. **(changed)** Reason: one cell is
10 px on a phone and 60 px on desktop, so cell-based sizes and speeds were six times apart.

- **Speeds** (the plan's cells/s × 30 px): ant 15 px/s, bee 21, wasp 33, ladybug 9, butterfly 24, caterpillar
  6, snail 4.5.
- **Drawn size:** `clamp(2 cells, 36 px, 72 px)`, the ant ×1.2 and the bee and wasp ×1.1 (their leggy art reads
  smaller than the round friends; milestone 5, was `clamp(1.8 cells, 32 px, 64 px)`) (the caterpillar 1.4× longer). Every bug gets a soft dark
  drop shadow (drawn in code) and a strong dark ink outline (in the art). Sprites face up (head at the top) and
  are rotated to their heading.
- **Anger radius** (hostiles): `max(1.5 cells, 40 px)` from the bug's centre to a *sweeping* pointer.
- **Warning:** the bug puffs up and tints red. A pulsing red ring is drawn at `max(anger radius + 8 px, 48 px)`
  so it shows past the finger. A rising buzz plays, there's a 20 ms haptic tick, and the meter's edge glows red
  on the side nearest the bug. After at least 1.5 s, if a sweeping pointer is still inside the anger radius, it
  bites. If the pointer stays more than 1.25 × the radius away, or stops sweeping, for 0.5 s, it calms down.
- **Bite:** a squash, a "bonk", a short shake of the meter, 15 ms haptics, −3% of the line. Then it flees.
- **Flee** (after a bite, or when calmed by a Ring): the bug moves away from the pointer at
  `max(2 × its speed, 60 px/s)` until it is 1.5 × its anger radius away. Then it can't get angry again for 2 s.
  **(changed)** The plan's 2 s at 1.4× speed moved an ant about 14 px on a phone, still inside its anger
  radius, so it re-angered at once.
- **Friendly bugs** wander slowly, can be petted, are never harmed, and are nudged aside by strokes.
- Bugs keep to valid cells and bounce off the field's edges (kept).

## Screens

- **Loading:** CSS only, in the palette. A cream page, a small inline-SVG leaf that sways, and "Touch Grass"
  set in the system serif. It needs no art, so it shows at once.
- **Title:** a painted morning meadow. Grass along the bottom edge bends as your pointer passes over it, so
  it's a toy before you start. The "Touch Grass" logo is set in the display font (Fraunces). Buttons: **Play**
  (the next unfinished field; field 1 the first time; the map once all are done), **Map**, **Bug Garden**, a
  settings cog and a speaker. "Best: N" sits under the logo once there's a score.
- **How to play:** field 1 teaches by doing (the ghost hand), and hint cards introduce each new thing. "How to
  play" in the pause menu lists every hint seen so far. Hint cards are built from in-game art: the bug sprite,
  a grass tuft, the move icon or the ghost hand over a little swatch of grass.
- **Meadow map:** a painted meadow with no path or patches in the painting. The path and 15 patch tokens are
  drawn in code from one list of coordinates per orientation. Nothing scrolls.
  - **Portrait:** the 9:16 painting (morning at the bottom, sunset at the top), with a serpentine path in five
    rows of three patches.
  - **Landscape and desktop:** the 16:9 painting (morning on the left, sunset on the right), with a serpentine
    path in three rows of five.
  - Tokens are at least 56 px across. A locked patch is bare and greyed. An unlocked one glows softly. A
    finished one shows its bloom, its best score, and a small gold leaf if it was cleared. Tap a patch to play
    it.
- **Gameplay HUD:**
  - Portrait: a slim strip across the top. Landscape: a column on the left.
  - It holds the field name, the energy meter (the main readout) with its line and a small flower that opens a
    petal at each quarter, the whole-field leaf badge (with "N left" from 90%), and the pause and speaker
    buttons.
  - The toolbar sits at the bottom in portrait and on the right in landscape. It holds the unlocked moves with
    icon and price, disabled when unaffordable and pulsing when armed.
  - An ARIA live region announces 25/50/75/100%, "Whole field touched" and "Field N complete" (kept).
- **Pause:** the field dims under a card with Resume, Restart field, How to play, Settings, Map and Title.
- **Field complete:** the field blooms (see Juice). Then a card slides up: field name, score, best, time vs
  par, friends petted, and the head start if earned. Buttons: **Next field**, Map, Share.
- **Ending:** after field 15 the light fades to dusk, fireflies rise, and every friend you've met wanders onto
  the field. A short line: "You touched all the grass. Go touch some real grass." Then the total score, Share,
  and back to the map.
- **Bug Garden:** a painted garden plot under a bell jar. Friends you've met wander and idle there. Unmet ones
  are soft silhouettes marked "Not met yet". Tap a friend for its card: name, a one-line note ("Ladybug: counts
  its spots when it's nervous."), first met date, and friendship hearts for the number of fields you've petted
  it in (1, 5, 15). Close returns to the screen you came from.
- **Settings:** music volume, sound volume, haptics (on phones that support it), reduced motion (Auto / Off /
  On), sweep by hovering (desktop, off by default), your name for challenges, credits ("Made by Rich Conlan,
  finished with gamegen", plus the tools used), and clear data (with an in-game confirm). Back returns to the
  screen you came from.
- **Share** (kept): the first time, a small card asks "Your name, for challenge links (optional)", up to 12
  characters, saved. Then it renders the 1200×630 scorecard (the field's painted backdrop, the logo, score,
  field and up to three friend sprites, with the link written in the UI font) and runs Web Share → clipboard →
  download.
- **Challenge links** (kept): `?f=<field 1–15>&s=<score>&n=<name>`.
  - Validation: `f` must be a whole number from 1 to 15, or the link is ignored. `s` is clamped to a whole
    number from 0 to 999,999. `n` has control characters removed, is trimmed to 12 characters, and falls back
    to "A friend". All three are only ever shown with `textContent`.
  - The overlay reads "Sam scored 1,240 on Sunset Meadow. Beat them?" with Play and Not now.
  - **A locked field is played as a guest challenge.** First a short checklist card names everything new up to
    that field (for example, "Stiff grass needs two strokes. Grumpy bugs glow red: move away."). Then the field
    plays normally. The end card compares your score with theirs and has two buttons: **Try again** and
    **Map**. A guest result doesn't unlock anything on the map, isn't saved as a best, and doesn't earn or use a
    head start. Friends you pet still join the Bug Garden.
  - The parameters are removed from the address bar after reading (`history.replaceState`).
- **Code-drawn pieces:** the whole-field leaf badge, the "New friend!" ribbon, the field edge, the meter, and
  the map path are drawn in code (canvas or inline SVG) in the palette, so they need no generated art.

- **Report a bug** (`--feedback on`): a "Report a bug" button in the **pause card** and on the **Settings**
  screen, styled like the other buttons, shown only once the game is published to a public repo
  (`window.gameReport?.shown()`). **Ctrl+Shift+F** opens it from anywhere (the game doesn't use Ctrl+Shift).
  The form (gh-feedback, bundled in `game/vendor/`) uses the game's font (Nunito) and a light theme with the
  meadow-green accent. While it's open the game ignores its own keys and pointer. Settings lists
  "Ctrl+Shift+F: report a bug".

**State machine:** `state.mjs` gains `map`, `ending`, `challenge`, `garden` (was `farm`) and `hint`.
Settings, the Bug Garden and How to play use "return to previous" instead of fixed targets. A unit test walks
every button on every screen and checks that each one leads to an allowed state, so there are no dead buttons.
In production, an invalid transition is logged and the nearest safe screen is shown (the map, or the title)
instead of being silently ignored.

## Juice

Must-haves are marked ★.

- ★ Grass bends away from the stroke, lies flat, and springs back with a slight overshoot as it regrows. When
  regrowing grass reaches standing height, it pops up with a little spring, so "worth sweeping" is visible.
- ★ Swept grass turns gold and fades back toward green as it grows, keeping a touch of gold (kept: one
  green-to-gold scale for all types).
- ★ Gold motes lift from flattened grass and fly to the meter; it pulses as they arrive. A taller tuft gives
  more motes.
- ★ The rustle follows the stroke, pitched by grass height (`0.8 + 0.4 × h`, kept) and louder for faster
  strokes. Over low grass it's softer and lower.
- ★ Field-complete bloom: a ripple runs out from your last touch, every tuft springs up, flowers (buttercup,
  daisy, clover sprites) pop open across the field, petals swirl, and a warm bell arpeggio plays.
- ★ Angry warning: see Bugs. No screen shake with reduced motion.
- ★ Petting: the bug hops, little hearts float up, it chirps (pitched per species: the snail low and slow, the
  butterfly high), and "+2%" floats to the meter the first time. A first meeting adds a "New friend!" ribbon.
- Milestone bells at 25/50/75% (rising notes) and the meter's flower opening a petal at each.
- The whole-field badge fills with a soft "ting" and a golden shimmer runs across the field when it's done.
- Petals flick off flowered grass when it's swept. Stiff grass wobbles and twangs when loosened.
- Move effects: Ring sends a circular shock-wave through the grass; Line carves a breeze trail; Full Clear is a
  gust that rolls across the whole field.
- Buttons squash slightly on press, screens cross-fade, and hint cards slide in.
- Haptics (where supported, kept): 8 ms at stroke start, 25 ms on a pet, 15 ms on a bite, 20 ms when a bug gets
  angry, and 10 ms when stiff grass loosens (at most one every 120 ms).
- Reduced motion (kept): particles off, no bounce or shake, instant fades, no shimmer (outlines instead). Grass
  still bends and changes colour, without the overshoot.
- Performance mode (kept): if the game runs under 45 fps for 2 s, particles cap at 50 and bends stop
  overshooting.

## Art direction

- **Three prompt lines.** Each prompt uses exactly one:
  - **Scene line** (nanogen paintings and textures): "soft storybook watercolour, warm sunlit meadow palette of
    fresh green, buttercup yellow and honey gold, gentle hand-inked outlines, soft paper texture, cozy and
    rounded, friendly, edge-framed composition with a quiet open centre".
  - **Sprite line** (bugs, icons, flowers, tokens, ghost hand): "soft storybook watercolour sprite, top-down
    view, facing up with the head at the top, bold readable silhouette, strong dark hand-inked outline, warm
    meadow palette, cozy and rounded, friendly, isolated on a transparent background, centred, no shadow, no
    ground, no paper, no border".
  - **Tuft line** (A08 grass tufts): "front three-quarter view of a single standing grass tuft, base at bottom
    centre, soft storybook watercolour, strong dark hand-inked outline, isolated on a transparent background,
    no soil, no shadow, no ground".
  - **(changed from round 1)** Reason: one line with "top-down view" and "soft paper texture" made rosette
    tufts that smear when sheared, and invited paper cards and baked shadows behind transparent sprites.
- **Two anchors:**
  - The **ladybug** (A01) is the anchor for every sprite and icon (imagegen2 `--image`). It's made at the mock
    stage with its final settings (transparent, sprite line, quality high), so the mock *is* the anchor.
  - The **morning surroundings** (A10m, the first nanogen image) is the anchor for every other painted scene.
    Every nanogen image references it and the ladybug.
- **Palette:** meadow green `#5f9e45`, deep grass `#2f6b34`, gold `#e7b84a`, buttercup `#f4d35e`, soil
  `#7a5a3a`, sky cream `#fbf3df`, dusk rose `#d98c7a`, ink `#2b2a26`, plum `#6b3f6e` (for the caterpillar).
- **Time-of-day grade.** Cool and fresh in the morning, neutral in the afternoon, amber at golden hour. The
  surroundings and soil take the full grade. The grass atlas takes it **only in value and highlight warmth**,
  so green and gold always stay apart:
  - The green ramp's hue never goes warmer than about 100° (yellow-green), at any time of day.
  - The gold ramp gets paler and warmer at golden hour, keeping its distance from the green.
  - Milestone 1 test: a 10 px swatch of untouched, touched and regrowing grass under all three grades must
    read as three different things.
- **Bugs read on green and gold.** Ink outlines on all of them; shadows are drawn only in code (one soft
  ellipse under each bug, never rotated with the sprite). The wasp is mostly black with thin yellow bands; the
  bee is fuzzy with broad dark bands and white wings. **(changed)** The caterpillar is plum-purple with cream
  spots, not green, so it shows on green grass.
- **Grass types differ by silhouette, not just colour** (see the types table): long wisps, low stubble, a
  flower-dotted tuft, straight dark spikes, and the loosened stiff tuft bent over. Test all six on a 10 px
  grid in milestone 1.
- **Camera:** the field reads as a gentle three-quarter view: tufts stand up from their base and taller ones
  overlap the row behind. Bugs are flat top-down sprites crawling over it, with a code shadow.
- **Layout and sizes:** the canvas fills the window at `min(devicePixelRatio, 2)`. The field gets the space
  left after the HUD and toolbar. Cell size is whatever fits: about 10 px on field 15 on a phone, up to about
  63 px on field 1 on desktop. Bugs, the brush and the pet and anger areas have the CSS-pixel minimums above,
  so they work at any cell size.
- **Surroundings are edge-framed:** hedges, flowers and paths around the borders. The **quiet centre** is pale
  sandy earth and short mown lawn, never long grass, so painted grass never sits beside the field's grass.
  Each scene is generated in both 16:9 and 9:16, and each is checked at 390×844, 844×390 and 1280×800 before
  it's accepted.
- **Field edge** (code): the soil is clipped to the field's polygon and framed by a 6 px soil lip and a 2 px
  ink line along the polygon, with small A24 flowers dotted along it about every 80 px. So the field's edge is
  always clear, including outside the L's missing quarter, the octagon's corners and between the islands.
  Checked on fields 6, 9, 14 and 15 in both orientations.

### How the grass is drawn

- **Canvases:** two full-window canvases, with the DOM HUD, toolbar and cards above them.
  - The *static* canvas holds the painted surroundings (drawn "cover"), the soil clipped to the field's
    shape and the field edge. It's redrawn only on resize or a new field.
  - The *live* canvas is redrawn every frame: grass, then bugs and their shadows, then particles. Gold motes
    fly to the meter's on-screen position (read from its bounding box at layout) and fade as they arrive.
- **Tuft art (A08):** seven imagegen2 tufts with the tuft line: the five types standing, loosened stiff, and
  one shared flattened tuft. They're transparent, and made with the ladybug and scene anchors as references.
  - Each is cropped to its alpha box with Pillow and placed on a fixed 256×256 canvas with the base centre at
    (128, 236). The atlas code uses that one base point for every tuft.
  - The flattened tuft is tinted per type in code (darker for tall, stubbier for short, flecked for flowered).
    Loosened stiff grass flattens to the stiff tint.
  - If they don't fit, a code painter draws tufts in the palette instead (tapered blades, dark ink edge,
    highlight).
- **Atlas:** built when a field loads, in code.
  - 11 shapes (6 standing: five types and loosened stiff; 5 flattened tints) × 5 goldness steps (0, 0.4, 0.6,
    0.8, 1.0) = **55 images**. Each step is the green tuft graded for the time of day, blended with a gold
    gradient map of the same tuft. Each cell uses its nearest step, so it's **one draw per cell**.
  - Each image is `1.5 × cell size × min(dpr, 2)` square (tufts spill over the cell above), capped at 192
    device pixels. Worst case: 55 × 192² × 4 B ≈ 8 MB, only on fields 1 to 4 on a high-DPI desktop. On field 15
    on a phone the images are about 30 px (≈ 0.2 MB).
- **Each frame**, for each valid cell, in row order from the top row down (so a tuft spilling upward is drawn
  over the row behind it):
  - Pose: standing if `h ≥ 0.4`. Below that, the flattened tuft, growing from 70% to 100% of its size as `h`
    goes from 0 to 0.4.
  - Height: the standing tuft is scaled vertically to `0.6 + 0.4 × h`.
  - Bend: each cell has a bend vector `(bx, by)`, set to the stroke direction when swept or brushed. It returns
    to zero with a damped spring (ω = 10/s, ζ = 0.5) so it overshoots slightly. It's drawn as a shear about the
    tuft's base: `setTransform(s, 0, s × bx × 0.8, s × heightScale × (1 − 0.3 × |by|), baseX, baseY)`,
    where `s` is the pixel scale.
  - Colour: the image for the cell's nearest goldness step.
  - Untouched cells shimmer (a slight brightness pulse) once the whole-field badge passes 90%.
- **Budget:** about 1,176 `drawImage` + 1,176 `setTransform` a frame on field 15. This is measured in milestone
  1 on a mid-range phone profile. If it's too slow, fully grown, still cells (no bend, no shimmer) are cached
  in an offscreen layer; they're the only ones that stay unchanged for long.

## Audio direction

- **Music** (instrumental, **no nature sounds, no birds**, all in **D major** at about 80 bpm, quiet under the
  effects):
  - M01, title and map: warm acoustic guitar and soft pads, unhurried. Also plays in the Bug Garden, Settings
    and the guest-challenge result.
  - M02, morning (fields 1 to 5): light and airy, plucked strings and a little glockenspiel.
  - M03, afternoon (6 to 10): fuller, with a soft brushed groove, still calm.
  - M04, golden hour (11 to 15): warm and slow, a touch wistful, strings and piano.
  - A guest challenge plays its field's time-of-day music. The ending reuses M04, fading into the dusk
    ambience.
- **Looping music.** audiogen music has no seamless loop. At decode, near-silent padding at the start and end
  is trimmed, and the track loops with a 3 s overlapping crossfade (two sources scheduled on the music bus).
- **Ambience:** a meadow loop (breeze, distant birds) under the music during play. The birds live only here.
  Dusk with crickets for the ending.
- **Effects from audiogen** (short, soft, never harsh): grass rustle (looping while sweeping, pitch by height),
  stiff-grass twang, angry buzz (rising, loops while angry), bite bonk, pet chirp (playback rate per species),
  move arm click (also, at rate 0.7, the "can't afford" click), Ring whoomp, Line swish, Full Clear gust,
  button tap, page whoosh.
- **Bells in code (Web Audio)** **(changed from round 1)**: the milestone bells (D5, F♯5, A5), the
  whole-field ting (D6), the bloom arpeggio (D5 F♯5 A5 D6) and the new-friend jingle (A5, D6, F♯6). Each note
  is a soft bell: a sine with one FM partial and a 1.2 s exponential decay. Reason: audiogen's sfx model has no
  key or pitch control, so generated chimes wouldn't match the D-major music. Code bells are always in key
  and cost nothing.
- **Short effects:** audiogen's sfx `--duration` is 0.5 to 30 s. Every effect is generated at 0.5 s or more.
  At decode, the leading silence is found (the first sample above −40 dB), and each effect plays as a window
  with `start(when, offset, duration)` and a 10 ms fade-out. No ffmpeg is needed.
- **Native loops** (S01, S02, S06, S16) use audiogen's `--loop`:
  - Rustle and buzz are saved as `.wav` with `--output-format pcm_24000`. The CLI writes the WAV header itself,
    so there's no extra wrapper. `pcm_44100` is tried once; ElevenLabs keeps 44.1 kHz PCM for higher tiers, so
    on this creator plan it falls back to 24 kHz.
  - The ambience loops are MP3. Only the MP3 padding is trimmed, and they loop with `loopStart`/`loopEnd`, with
    no crossfade.
  - Every loop is checked by ear in WebKit.
- **Unlocking audio:** the `AudioContext` is created on the first `pointerdown` or key press, and `resume()` is
  called again on `pointerup`, `click` and `keydown` until its state is `running` (older iOS only unlocks on
  touchend/click).

## Asset list

| ID | What it is | Tool | Size and format | Transparent | Animation | Priority |
|---|---|---|---|---|---|---|
| A01 | Ladybug (sprite anchor; mock stage) | imagegen2, quality high, sprite line | 1024 → 128 PNG | yes | code: crawl bob and wiggle | must |
| A02 | Ant | imagegen2 (ref A01), medium | 1024 → 128 PNG | yes | code: jitter, quick turns | must |
| A03 | Bee: complete with wings spread (mock stage), then body and left wing as edits of it | imagegen2 (ref A01), medium | 3 × 1024 → 128 PNG | yes | code: wings flap about a hinge, hover bob | must |
| A04 | Butterfly: complete, then body and left wing as edits | imagegen2 (ref A01), medium | 3 × 1024 → 128 PNG | yes | code: wings flap (mirrored) | must |
| A05 | Wasp: complete, then body and left wing as edits | imagegen2 (ref A01), medium | 3 × 1024 → 128 PNG | yes | code: fast wing flap, darting | must |
| A06 | Caterpillar (plum with cream spots) | imagegen2 (ref A01), medium | 1024 → 160×96 PNG | yes | code: segment ripple (horizontal slices) | must |
| A07 | Snail | imagegen2 (ref A01), medium | 1024 → 128 PNG | yes | code: slow glide, shell wobble | must |
| A08 | Grass tufts: 5 types standing, loosened stiff, one flattened (default and stiff at the mock stage) | imagegen2 (ref A01 + A10m), medium, tuft line | 7 × 1024 → 256 PNG, base-aligned with Pillow | yes | atlas + bend in code; code-painter fallback | must |
| A09 | Soil texture (one, graded per time in code) | nanogen flash 1K (ref A10m) | 512×512 JPG, made seamless with Pillow offset-and-blend, checked 3×3 | no | none | must |
| A10 | Field surroundings: morning (scene anchor, both orientations at the mock stage), afternoon, golden hour (16:9 at the mock stage); edge-framed, quiet centre of sandy earth and mown lawn | nanogen pro 2K (ref A01 + A10m) | 16:9 and 9:16 each, JPG | no | none | must |
| A11 | Title backdrop (meadow, morning), edge-framed | nanogen pro 2K | 16:9 and 9:16 JPG | no | grass along the bottom drawn in code | must |
| A12 | Meadow map painting, **no path or patches**, morning to sunset | nanogen pro 2K | 9:16 (bottom to top) and 16:9 (left to right) JPG | no | path and tokens in code | must |
| A13 | Bug Garden scene (plot under a bell jar), edge-framed | nanogen pro 2K | 16:9 and 9:16 JPG | no | bugs wander in code | must |
| A14 | Move icons: Ring, Line, Full Clear | imagegen2 (ref A01), medium | 1024 → 128 PNG | yes | none | must |
| A15 | UI icons: pause, speaker on/off, settings, garden, map, share | imagegen2 (ref A01), medium | 1024 → 96 PNG each, or code if they don't match | yes | none | should |
| A16 | Heart, petal, gold mote, firefly particles | code | drawn | yes | code | must |
| A17 | Ghost hand (field 1 tutorial) | imagegen2 (ref A01), medium | 1024 → 192 PNG | yes | code: glides along a stroke | must |
| A18 | Paper panel texture for cards | nanogen flash 1K | 1024 JPG, seamless as A09 | no | none | should |
| A19 | Ending scene (dusk meadow), edge-framed | nanogen pro 2K | 16:9 and 9:16 JPG | no | fireflies in code | should |
| A20 | App icon + favicon (a ladybug on a grass tuft) | imagegen2 (ref A01), high | 1024 PNG → 512/192/180/32 + maskable | no | none | must |
| A21 | Social card 1200×630 and GitHub preview 1280×640 | code (the game's art + logo) | JPG / PNG | no | none | must |
| A22 | Fonts: **Fraunces** (display: logo, card titles) and **Nunito** (UI, scorecard text) | bundled OFL fonts, Latin subset | WOFF2 | n/a | none | must |
| A23 | Meter flower: centre + one petal (petals placed and opened in code) | imagegen2 (ref A01), medium | 2 × 1024 → 96 PNG | yes | code | must |
| A24 | Bloom flowers: buttercup, daisy, clover (also dotted along the field edge) | imagegen2 (ref A01), medium | 3 × 1024 → 96 PNG | yes | code: pop open (scale) | must |
| A25 | Map patch tokens: bare, bloomed | imagegen2 (ref A01 + A10m), medium | 2 × 1024 → 128 PNG | yes | code: glow on the next field | must |
| A26 | Ladybug crawl, 4 frames, for the title and Bug Garden only | anim8gen (ref A01) | 128 px frames | yes | 4-frame loop | nice (only if the forecast after the mocks is under $15) |
| M01 | Music: title, map, Bug Garden, settings | audiogen music | about 2 min, MP3 | n/a | crossfade loop | must |
| M02 | Music: morning | audiogen music | about 2 min | n/a | crossfade loop | must |
| M03 | Music: afternoon | audiogen music | about 2 min | n/a | crossfade loop | must |
| M04 | Music: golden hour (also the ending) | audiogen music | about 2 min | n/a | crossfade loop | must |
| S01 | Meadow ambience (breeze, birds) | audiogen sfx `--loop` | 20 s, MP3 | n/a | native loop | should |
| S02 | Grass rustle | audiogen sfx `--loop`, `pcm_24000` → .wav | 2 s | n/a | native loop | must |
| S03 | Stiff grass twang | audiogen sfx | 0.5 s, trimmed at decode | n/a | | should |
| S04 | Milestone bells (D5, F♯5, A5) | code (Web Audio bell) | n/a | n/a | | must |
| S05 | Field-complete bloom arpeggio (D5 F♯5 A5 D6) | code (Web Audio bell) | n/a | n/a | | must |
| S06 | Angry buzz | audiogen sfx `--loop`, `pcm_24000` → .wav | 1.5 s | n/a | native loop | must |
| S07 | Bite bonk | audiogen sfx | 0.5 s, trimmed | n/a | | must |
| S08 | Pet chirp (rate per species) | audiogen sfx | 0.5 s | n/a | | must |
| S09 | New-friend jingle (A5, D6, F♯6) | code (Web Audio bell) | n/a | n/a | | should |
| S10 | Move arm click (also "can't afford" at rate 0.7) | audiogen sfx | 0.5 s, trimmed | n/a | | must |
| S11 | Ring whoomp | audiogen sfx | 0.7 s | n/a | | must |
| S12 | Line swish | audiogen sfx | 0.6 s | n/a | | must |
| S13 | Full Clear gust | audiogen sfx | 1.2 s | n/a | | must |
| S14 | Button tap | audiogen sfx | 0.5 s, trimmed | n/a | | should |
| S15 | Screen whoosh | audiogen sfx | 0.5 s, trimmed | n/a | | nice |
| S16 | Dusk ambience with crickets (ending) | audiogen sfx `--loop` | 20 s, MP3 | n/a | native loop | nice |
| S17 | Whole-field ting (D6) | code (Web Audio bell) | n/a | n/a | | should |

- **Winged bugs (A03–A05):** first the complete bug with wings spread. Then the body as an imagegen2 `--image`
  edit ("same bug, wings removed, same scale and position") and the left wing as another ("only the left wing,
  same scale and position, nothing else"). The wing's hinge point is recorded per species in a JSON file. If
  the pieces still don't match after two tries, the complete sprite is used and the flap is a quick vertical
  squash in code.
- Hint card illustrations are not separate images. They're built from A01–A08, A14 and A17. **(changed)**
  Reason: seven one-off pictures would drift from the sprite style.

### Mock pictures

Made now, for the shared design; every one is kept as final art. About $2 with retries.

1. **A01 ladybug**: imagegen2 high, transparent, sprite line. The sprite anchor.
2. **A10 morning surroundings**, 16:9 and 9:16: nanogen pro 2K, ref A01. The scene anchor; tests the edge frame
   and the quiet centre.
3. **A08 default tuft and stiff tuft**: imagegen2 medium, tuft line, refs A01 + A10m. Tests the three-quarter
   view, base alignment and 10 px silhouettes.
4. **A10 golden-hour surroundings**, 16:9: nanogen pro 2K, refs A01 + A10m. Tests the range of the day and the
   green-versus-gold grade.
5. **A03 bee, complete with wings spread**: imagegen2 medium, ref A01. Tests that bugs match the anchor; it's
   the source for the body and wing edits.

Then two "gameplay" mock frames are composited with Pillow from these real assets, at no cost: a morning
L-shaped field with a gold trail, the ladybug and the field edge; and a golden-hour field with the bee and its
red warning ring. The A01 run's reported token usage is used to re-forecast the imagegen2 lines below.

## Tech plan

- **Keep and extend the person's code** (finish, not rewrite):
  - `game/src/main.mjs` bootstrap.
  - `state.mjs`: add the new states and "return to previous".
  - `loop.mjs`: change to a fixed-step accumulator (60 Hz) around the same rAF loop and dt clamp. **A thrown
    error no longer stops the loop for good.** It's logged, that frame is skipped, and the loop keeps running.
    After 10 errors in 5 s, a card offers "Something went wrong. Restart field".
  - `style.css`: keep the palette and safe-area rules; add the pointer CSS (see Controls) and the two fonts.
  - `ui/title.mjs`, restyled.
  - The `?dev=1&level=N` skip and `data-testid`s on every button.
- **Module layout:**
  - The simulation is pure modules, with no DOM and no wall clock, so it runs headless in Node:
    `sim/rng.mjs` (mulberry32), `sim/grid.mjs` (heights, types, toughness, goldness, touched, rest timers,
    bend springs, regrowth, standing height), `sim/levels.mjs` (polygons, mixes, placement, pre-mown stripes,
    `k`, `g`, par), `sim/mask.mjs`, `sim/energy.mjs` (meter, whole-field, head start), `sim/brush.mjs`
    (capsule stamping, brush radius from layout), `sim/moves.mjs` (sizes, price rule), `sim/insects.mjs`
    (species, px speeds, wander, anger, bite, flee, pet), `sim/score.mjs`, `sim/world.mjs` (steps everything by
    a fixed `dt`).
  - The sim works in cells but takes the layout's cell size in px, so brush, bug sizes, speeds and radii can be
    given in CSS px.
  - Around it: `input/pointer.mjs` (first pointer wins, capture, cancel handling, tap-or-sweep, hover-sweep,
    the 0.4 s "sweeping" rule), `render/{canvas,atlas,grass,bugs,particles,edge}.mjs`,
    `ui/{hud,toolbar,pause,field-complete,map,garden,settings,hints,ending,challenge,share-name,error}.mjs`,
    `audio.mjs` (Web Audio buses for music, ambience and effects; crossfade music loops; native loops; silence
    trimming; a looping rustle with live `playbackRate`; the code bells), `assets.mjs`, `storage.mjs` (the
    single `touchgrass.v1` key), `share/{scorecard,flow,link}.mjs`, `haptics.mjs`, `a11y.mjs`.
- **Determinism:** every random choice (type placement, spawn points, wander) comes from one RNG per field,
  seeded by field number, or by `?seed=N` in dev. Time in the sim only advances by fixed steps.
- **Scaling:** both canvases fill the window at `min(devicePixelRatio, 2)`. Layout reserves the HUD and
  toolbar first, inside the safe areas, then fits the field's bounding box. Recompute on `resize` and
  `orientationchange` (the plan's `layout-changed` event).
- **Performance:** see "How the grass is drawn". The target is 60 fps on field 15 on a mid-range phone.
- **Audio:** see Audio direction. Music, ambience and effects have separate gain nodes wired to the settings
  sliders; mute persists. Music ducks while paused.
- **Saving:** `storage.mjs` read/write/merge with `migrate()`, as planned. The old `farm` key migrates to
  `garden`.
- **Install and offline:** `manifest.webmanifest`, `sw.js` caching every file, icons.
- **Debug hook** (extends `window.__game`, dev hosts only): `loadLevel(n)`, `world`, `state`, `layout`,
  `setEnergy(x)`, `spawn(species, r, c)`, `step(n)` (n fixed steps), `timeScale`, `seed`, `solve(profile)`,
  `fps`.
- **Solver and headless simulator** (replaces "recorded solutions"; it's also the tuning tool):
  `solve(profile)` generates a brush path over the field's shape at the layout's real cell size, steering
  around hostiles' anger radii and re-planning as they move. Profiles, in CSS px/s:
  - "fast": 600, serpentine lanes, one stroke per lane (lifts 0.12 s at each turn).
  - "average": 350, serpentine, lifts 0.2 s at each turn.
  - "calm": 150, serpentine, lifts 0.4 s at each turn.
  - "scribble": 700, random curving strokes of 1.5 s with 0.1 s lifts.
  - Each runs at the phone (390×844) and desktop (1280×800) layouts.

  A Node unit test runs every field headless with every profile at both layouts and asserts a win: "average"
  within 15% of par, "fast" and "scribble" within 1.5× par, "calm" within 2.5× par. It also checks the cases
  from "No soft-locks". A tuning script prints times per field so `k`, `g` and par can be set and written back
  here.
- **Tests:** keep the person's harness. Add:
  - Unit tests for the grid (regrowth curve; yield `mult × h` above 0.4; low grass only bends and keeps
    growing; rest; stiff loosening across strokes; stiff again once it stands; pre-mown cells), masks (valid
    counts per field), brush radius per layout, energy and head start (including restart and field 15), moves
    (price rule never raises the meter; Line ignores stiff; Ring calms; off-field Line release; no win under
    10 s), insects (warning ≥ 1.5 s, only a sweeping pointer angers, flee distance and cool-down, floor at 0,
    pet once per field), whole-field (cells under bugs count last), storage, score, challenge-link parsing
    (bad, huge and script-like values), every screen transition, and the headless solver for all 15 fields.
  - E2E tests: a sweep, a field win, a pet, settings round-trip, a challenge link (including a locked field
    and its Try again / Map buttons), share, a parked mouse with hover-sweep on next to an ant (no anger), and
    **a real touch drag on WebKit iPhone 12** asserting that cells along the whole path were swept and that no
    `pointercancel` fired. One field is replayed end to end with real pointer events from the solver's path.
- **CI:** keep `ci.yml`; add the GitHub Pages workflow at wrap-up.

## No soft-locks

Checked by playing wrong on purpose, and by unit tests where possible:

- **Zero energy:** grass always grows back and sweeping standing grass always earns, so the meter can always
  fill. Bites floor at 0.
- **Sweeping too fast or scribbling:** low grass is never reset, so it always stands up again. The fast and
  scribble profiles win every field no slower than "average".
- **A bug on the last untouched cell:** it counts once every other cell is touched, and the win never needs
  whole-field anyway.
- **Can't find the last cells:** they shimmer and the badge counts them from 90%; Full Clear touches them all
  from field 11; and the win never needs them.
- **Pointer lost mid-stroke** (cancel, blur, hidden tab): treated as a release; the game pauses when hidden.
- **A thumb overshoots the edge with a Line armed:** the on-field part fires.
- **Armed move at the field's end, on pause, or on cancel:** nothing was paid; it simply disarms.
- **A move you can't quite afford:** the preview turns grey and nothing is charged.
- **A mouse parked over a bug with hover-sweep on:** a still pointer doesn't sweep or anger.
- **A bug that just bit:** it flees out of range and can't re-anger for 2 s.
- **A hint card mid-stroke:** hints only appear before the first stroke, with the field paused.
- **A challenge link to a locked field or bad values:** guest play with Try again and Map on its end card, or
  the link is ignored.
- **A script error in a frame:** the loop keeps running and offers Restart field.
- **Every screen has a way out:** checked by the transition test.

## Cut list

In order, first to go:

1. A26 ladybug crawl animation (already skipped unless the forecast is under $15; the code crawl is used
   everywhere)
2. S16 dusk ambience (reuse S01, filtered)
3. S15 screen whoosh
4. A19 ending scene (use the golden-hour surroundings, darkened, plus code fireflies)
5. A15 UI icons (drawn in code)
6. A18 paper texture (CSS gradient instead)
7. A08 generated tufts (use the code painter)
8. M03 afternoon music (the morning theme plays through the afternoon)

Never cut: the stroke, regrowth, the 15 fields, grass types, moves, the seven bugs, the Bug Garden, saving.

## Effort and cost estimate

A forecast, not a promise.

- **Effort:** 15 fields (the shape data exists), a headless sim and solver, 7 bug species with AI, 3 moves,
  about 10 screens, about 55 generated images, 4 music tracks, 13 generated sound effects and 4 code bells.
  The person's Phase 1 scaffold is kept.
- **Biggest and riskiest:**
  - The grass renderer: lush and 60 fps at 36×36 on phones. Measured in milestone 1.
  - The feel of the stroke (bend, sound, motes, grass standing back up) in milestone 1.
  - Touch input on iOS WebKit (capture, cancel, no page pan).
  - Tuning 15 fields with bugs to the lap targets. The simulator makes this a script, not guesswork.
  - Layout in both phone orientations with the HUD and toolbar.
- **Cost** (of the $20). imagegen2 reports tokens, not prices, and its docs don't list a price, so its lines
  are a guess (about $0.05 medium, $0.20 high, at 1024 px). They're re-forecast from A01's reported usage at
  the mock stage. Even at three times the guess, the total stays under $20. nanogen and audiogen use their
  skills' price lists.

| Item | Count | Each | Total |
|---|---|---|---|
| Mock pictures (A01 high; A10 morning ×2; A08 default and stiff; A10 golden hour 16:9; A03 complete bee), kept as final art, with retries | 7 | — | about $2.00 |
| Bug sprites and edits (A02, A06, A07; A03 body + wing; A04 and A05 complete + body + wing) | 11 imagegen2 medium | $0.05 | $0.55 |
| Grass tufts (A08, the other five) | 5 imagegen2 medium | $0.05 | $0.25 |
| Icons (A14: 3; A15: pause, speaker on, speaker off, settings, garden, map, share) | 10 imagegen2 medium | $0.05 | $0.50 |
| Ghost hand, meter flower, bloom flowers, map tokens (A17, A23–A25) | 8 imagegen2 medium | $0.05 | $0.40 |
| App icon (A20) | 1 imagegen2 high | $0.20 | $0.20 |
| Painted scenes: A10 afternoon ×2 and golden hour 9:16; A11, A12, A13, A19 ×2 each | 11 nanogen pro 2K | $0.134 | $1.47 |
| Soil and paper textures (A09, A18) | 2 nanogen flash 1K | $0.034 | $0.07 |
| Music (M01–M04) | 4 × 2 min | $0.30/min | $2.40 |
| Sound effects (S01–S03, S06–S08, S10–S16) | 13 audiogen sfx | $0.12 | $1.56 |
| Bells (S04, S05, S09, S17) | code | — | $0.00 |
| **Subtotal after mocks** | | | **$7.40** |
| **Retries** (about 30%: the asset guide allows up to two better prompts per asset) | | | **$2.22** |
| **Total with mocks** | | | **about $11.62** |
| Ladybug crawl (A26, nice, only if the forecast is under $15) | 1 anim8gen run, ~16 frames tried | — | $1.00 + $0.30 retries |
| **Total with A26** | | | **about $12.92** |

That leaves about $7 of the $20 for anything the play-test or polish pass finds missing, or for imagegen2
costing more than guessed.

## Definition of done

- [ ] Starts with no errors at desktop (1280×800) and phone sizes (390×844 portrait, 844×390 landscape).
- [ ] The headless solver wins every one of the 15 fields with all four profiles (fast, average, calm, scribble)
      at both layouts, inside the windows in Tech plan, and the game can be won (the ending plays).
- [ ] The final `k`, `g` and par for every field, and the solver's times, are written back into "Pacing".
- [ ] The meter win works. Whole field is tracked (cells under bugs count last, shimmer and "N left" from 90%),
      and the head start is granted only when both happen, used once on the next field (kept on restart), and
      never in guest play.
- [ ] Rubbing one spot earns nothing until the grass stands up again (`h ≥ 0.4`); sweeping low grass never
      resets it; standing grass always gives motes; the gold trail is visible for seconds and untouched grass
      stays deep green.
- [ ] Bites never take energy below 0; the angry warning always shows for at least 1.5 s first, visible
      outside a finger; only a moving pointer angers; a bitten bug flees out of range.
- [ ] Friendly bugs can be petted (energy once per bug per field), join the Bug Garden, and are never harmed by
      strokes or moves.
- [ ] Stiff grass needs a fresh stroke, loosened stiff grass looks different, and regrown stiff grass is stiff
      again.
- [ ] All three moves arm, preview with their exact price, fire (paying then), never raise the meter, do their
      jobs (Ring calms, Line flattens stiff, Full Clear touches every blade), and cancel without cost, including
      on pause, pointer cancel and the end of a field. A Line released past the edge fires its on-field part.
- [ ] The game can always go on, even when played wrong (see "No soft-locks").
- [ ] Every control works with mouse, keyboard and touch. Touch controls never cover the field, a drag never
      pans or refreshes the page, and hover-sweep works when switched on.
- [ ] Every screen looks finished at every size from the first load, including both map layouts, every
      painted scene's crop, and a clear field edge on fields 6, 9, 14 and 15.
- [ ] Untouched, touched and regrowing grass read as different on a 10 px grid under all three times of day.
- [ ] Music and sound play after the first press (including iOS WebKit), loops have no clicks, the bells are in
      key with the music, and the sliders and mute work and persist.
- [ ] Progress, scores, the Bug Garden and settings are saved and restored; clear data works.
- [ ] Share produces a correct scorecard. Challenge links show the overlay, reject bad values, and play a
      locked field as a guest.
- [ ] 60 fps on field 15 in desktop Chromium. No drop below 45 fps with mobile emulation and 4× CPU throttle,
      or the perf mode engages cleanly.
- [ ] Installs as an app and works offline.
- [ ] The person's test suites pass (`bash scripts/test-all.sh`: unit and e2e).
