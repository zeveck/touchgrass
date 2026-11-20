# Assets

Budget: $20. Spent so far: **$0.83** (design mock pictures; all kept as final art).

Pricing used (2026-11-19): imagegen2 = gpt-image-2.6-flare, image output $30 / M tokens, image input $8 / M,
text input $5 / M (from third-party pages quoting OpenAI's price list; OpenAI's own page was not reachable).
nanogen pro 2K = $0.134 / image (from its skill).

| ID | File | Tool | Prompt (short) | Tries | Est. cost | Status |
|---|---|---|---|---|---|---|
| A01 | game/assets/style-anchor.png, game/assets/sprites/ladybug.png | imagegen2 high | sprite line + friendly round ladybug | 1 | $0.053 | accepted (sprite anchor; mock) |
| A10m | game/assets/scenes/morning-16x9.jpg, morning-9x16.jpg | nanogen pro 2K (ref A01) | scene line + morning meadow, edge-framed, quiet sandy/mown centre | 1 + 2 | $0.40 | accepted (scene anchor; mock). Reads a little warm rather than cool. |
| A08 | game/assets/tufts/default.png, stiff.png (256², base at 128,236) | imagegen2 medium (ref A01 + A10m) | tuft line + default / stiff needle tuft | 1 + 2 | $0.19 | accepted (mock); other 5 tufts to make |
| A10g | game/assets/scenes/golden-16x9.jpg | nanogen pro 2K (ref A01 + A10m) | scene line + same meadow at golden hour | 1 | $0.134 | accepted (mock); 9:16 to make |
| A03 | game/assets/sprites/bee-full.png | imagegen2 medium (ref A01) | sprite line + fuzzy bumblebee, wings spread | 1 | $0.052 | accepted (mock); wings opaque cream: draw the wing layer semi-transparent in code; body/wing edits to make |
| — | design/mockups/frame-morning.png, frame-golden.png | Pillow (design/mockups/frames.py) | composited gameplay mock frames | — | $0 | for the shared design only |

Notes for the build: scene JPGs are ~3.5 MB at 2K, re-encode for the web; fonts (Fraunces, Nunito, OFL) still
need bundling with licences; frames.py expects the fonts in a temporary folder.

## Audio (made 2026-11-20, audiogen, creator plan: no credit line)

Spent: $5.28. All in `game/assets/audio/`.

| ID | File | Tries | Est. cost | Notes |
|---|---|---|---|---|
| M01 | music-title.mp3 | 1 | $0.60 | D major; 1.5 s lead / 3.7 s tail silence (trim) |
| M02 | music-morning.mp3 | 1 | $0.60 | D major |
| M03 | music-afternoon.mp3 | 1 | $0.60 | D major; ~6 dB quieter than M04 |
| M04 | music-golden.mp3 | 2 | $1.20 | take 1 was C major, redone in D |
| S01 | amb-meadow.mp3 | 2 | $0.24 | very quiet (-50 dB RMS): ambience bus +15–20 dB |
| S16 | amb-dusk.mp3 | 1 | $0.12 | very quiet (-50 dB RMS) |
| S02 | rustle.wav | 4 | $0.48 | 44.1 kHz (pcm_44100 worked on creator), 4 s loop, gain raised; a bit hissy: check in WebKit |
| S06 | buzz.wav | 2 | $0.24 | 44.1 kHz, 2.96 s loop |
| S03 | twang.mp3 | 1 | $0.12 | |
| S07 | bonk.mp3 | 1 | $0.12 | |
| S08 | chirp.mp3 | 1 | $0.12 | |
| S10 | click.mp3 | 1 | $0.12 | |
| S11 | whoomp.mp3 | 1 | $0.12 | |
| S12 | swish.mp3 | 1 | $0.12 | |
| S13 | gust.mp3 | 2 | $0.24 | quietest effect |
| S14 | tap.mp3 | 1 | $0.12 | |
| S15 | whoosh.mp3 | 1 | $0.12 | |

Mixing for the build: music is mastered loud (peaks ~-1 dB): keep the music bus low, trim M03 up ~+4 dB
relative. Per-effect gains to even loudness: gust +8 dB, twang +5, swish +4, click +3, bonk +2, tap/whoomp 0,
whoosh/chirp -2. Ambience bus ~+15–20 dB.

## Scenes and textures (made 2026-11-20, nanogen)

Spent: about $2.00 (14 pro 2K × $0.134 + 3 flash 1K ≈ $0.04 each). All scenes re-encoded to 1920 px long
side, q82, progressive; full-res in `.gamegen/fullres/`.

| ID | Files (game/assets/) | Tries | Est. cost | Notes |
|---|---|---|---|---|
| A10 afternoon | scenes/afternoon-16x9.jpg, afternoon-9x16.jpg | 2 | $0.27 | only a little brighter/warmer than morning |
| A10 golden 9:16 | scenes/golden-9x16.jpg | 1 | $0.13 | |
| A11 title | scenes/title-16x9.jpg, title-9x16.jpg | 2 | $0.27 | low view, open sky for the logo |
| A12 map | scenes/map-9x16.jpg, map-16x9.jpg | 3 | $0.40 | morning→sunset; no path/patches (code draws them); bottom of 9:16 a bit watery mint |
| A13 Bug Garden | scenes/garden-16x9.jpg, garden-9x16.jpg | 3 | $0.40 | jar knob slightly clipped at 844×390 |
| A19 ending | scenes/ending-16x9.jpg, ending-9x16.jpg | 3 | $0.40 | top-down dusk grade (no sky band) |
| A09 soil | textures/soil.jpg | 2 | ~$0.08 | seamless (2-pass smoothstep) |
| A18 paper | textures/paper.jpg | 1 | ~$0.04 | seamless |



## Sprites, tufts, icons, small art (made 2026-11-20, imagegen2 + anim8gen)

Spent: about $2.15. All accepted; 1024 px sources in `.gamegen/fullres/`.

| ID | Files (game/assets/ unless noted) | Tries | Est. cost | Notes |
|---|---|---|---|---|
| A02 | sprites/ant.png | 1 | $0.052 | |
| A06 | sprites/caterpillar.png | 1 | $0.043 | **96 wide × 160 tall** (head up), not 160×96 |
| A07 | sprites/snail.png | 1 | $0.053 | |
| A03 | sprites/bee-body.png, bee-wing.png | 2 | $0.104 | aligned to bee-full with Pillow; hinge (39,56); wings opaque: draw at ~70% |
| A04 | sprites/butterfly-full/-body/-wing.png | 3 | $0.157 | hinge (57,69) |
| A05 | sprites/wasp-full/-body/-wing.png | 3 | $0.157 | hinge (49,49); wings opaque: ~70% |
| — | sprites/wings.json | — | $0 | hinge points (left wing; right mirrored) |
| A08 | tufts/tall, short, flowered, loosened, flat.png (256², base 128,236) | 6 | $0.438 | heights: tall 232, flowered 216, loosened 180, short 120, flat 80 |
| A14 | ui/ring, line, clear.png | 3 | $0.159 | |
| A15 | ui/pause, sound-on, sound-off, settings, garden, map, share.png | 7 | $0.371 | |
| A17 | ui/hand.png | 1 | $0.053 | |
| A23 | ui/flower-centre.png, flower-petal.png | 2 | $0.104 | centre is fairly orange |
| A24 | sprites/buttercup, daisy, clover.png | 3 | $0.156 | |
| A25 | ui/patch-bare.png, patch-bloom.png | 2 | $0.130 | bloom patch green-on-green: add a code ring/glow on the map |
| A20 | icon-source.png; game/favicon.png, apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png | 1 | $0.070 | |
| A26 | sprites/ladybug-crawl/frame_0..3.png | 2 frames | $0.106 | gentle crawl; ladybug ~90% the size of ladybug.png: title/garden only |

## Running total

About **$10.26 of $30**: mockups $0.83, audio $5.28, scenes $2.00, sprites/tufts/icons $2.15.
