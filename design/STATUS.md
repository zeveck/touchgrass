# Touch Grass

## Requests

1. `--plan-only --share-design --finish --leeway some`
2. "The folder we're in. That's what I'd expect calling it like this to do." (the source for `--finish`)
3. "then --in-place, yes"
4. `--plans`
5. `--continue --feedback on --no-confirm --publish --art-sheet --budget 30`
6. "This is mostly good, except the grass looks like my touching it is hurting it rather than improving it. I thought the grass would turn gold in a positive way, but as it is it looks like my touching it turns it to crab grass."
7. "But it may be the \"lies down when you sweep it\" is what makes it look like it died back. It seems like why you used a squat graphic that looks like crab grass?"

## Settings

- From: `/workspaces/touchgrass` (this repo), **finish in place** on branch `gamegen-finish`, leeway **some**
- `main` is untouched until the person merges `gamegen-finish`
- Platform: both (desktop and phones)
- Target: web (plain HTML + JavaScript modules, no build step, no runtime dependencies)
- Scope: medium (15 levels, about 30 to 40 minutes), from the original plan
- Budget: $30 (from `--budget 30` on --continue; was $20); mockups $5 of it
- Review rounds: 2
- Plan only: done; now building (--continue)
- Feedback: on
- Publish: yes, at the end (--publish; domain synapticnoise.com from .env) → https://touchgrass.synapticnoise.com from zeveck/touchgrass, made public at the person's request ("public", 2026-11-21)
- GitHub preview image: to upload (none set)
- Art sheet: yes
- No-confirm: yes (this run)
- Share design: page
- 3D: no
- Making-of: on (from `.env` default `GAMEGEN_MAKING_OF=on`)
- Publish defaults (from `.env`): domain synapticnoise.com, gallery zeveck/synapticnoise
- Credit: Rich Conlan (from GAMEGEN_CREDIT)
- ElevenLabs plan: creator (paid: no audio credit line needed)

## Available

- imagegen2 + anim8gen (OpenAI key ok), nanogen (Gemini key ok, after the person updated `.env`), audiogen (ElevenLabs creator)
- Node, Python 3 + Pillow (installed this run), playwright-cli, Playwright test browsers (chromium, webkit; installed this run)
- The original's test harness: `bash scripts/test-all.sh` (unit + e2e), dev server on 8080 from `game/`

## Setup done

- Main got the person's dev container update (`6e9f880`, committed by the person)
- `gamegen-finish` branch from `main`; Phase 1 scaffold brought over from `feat/touch-grass` (`075adf2`)
- Moved the game into `game/` (`2d38159`); unit 4/4 and e2e 2/2 pass

## Phases

- [x] Preflight: keys ok; branch made; game moved into `game/`
- [x] 1 Brief: written from the original plan; checklist of 17 things it aims at
- [x] 2 Design: 15 fields over a summer day, 7 bugs, 3 moves, Bug Garden, map, ending; ~25 art, 4 music, 16 sfx; est. $13-19
- [x] 3 Design review: 2 rounds; fixed a stall for brisk players (sim in design/tuning/), meter-only win, moves with real jobs, phone sizes in px, three prompt lines; 15-25 min total; est. ~$12-13
- [x] Share design: page https://claude.ai/artifact/NdpRQDpGNQPA5vzhgZENoE (private until shared; slug af33e960-0e6d-46be-acaa-f471b827d155); 5 mock pictures + 2 composited frames, $0.83, all kept as final art
- [x] Stop (`--plan-only`): next is `/gamegen --continue` (read the shared page's comments first)
- [x] 4 Art, animation and audio: every asset on the list made and checked; ~$10.26 of $30 so far (design/ASSETS.md)
- [x] 5 Build: M1 dd94adb, M2 23015db, M3 3b2e4e2, M4 4f2749c, M5 polish adbeee0. Open (low): hint cards cover the field on portrait phones; bugs can overlap on busy fields; field top border hidden by tufts on desktop f1/8/12; ~9.5 s splash on slow 4G.
- [x] 6 Play-test: every screen at 3 sizes, play-it-wrong, offline, first-load film, one-run playthrough to the ending (adbeee0); screenshots in design/screenshots/final/
- [x] 7 Final review: no must-fix; 5 should-fix fixed (bugs build anger over passes, net move prices + 'needs N%', audio suspend/resume, iOS resume, head-start pill), nice ones fixed; see REVIEW_LOG. Known: two timing-based e2e (bee build-up, net price) can flake when the shared machine's load is very high (~15+); they pass on rerun.
- [x] 8 Polish pass: no must-fix; every finding fixed (general How to play lines + move icons, landscape How to play, m:ss times, one verb 'say hello/met', aim label above bugs, landscape layouts, Copy button, Pause during hint, Ring stays armed while aiming). Playwright capped at 4 workers (16 at once starved the real-time specs).
- [x] 9 Wrap up: social card, GitHub preview, README, Pages workflow; published at https://touchgrass.synapticnoise.com (repo zeveck/touchgrass, public; HTTPS on; live-checked at desktop and phone, no errors); gallery card and plans card 'Published'; art sheet at https://synapticnoise.com/plans/touch-grass/art/; CI pinned to ubuntu-24.04

## Plans page

Plans page: yes. Card "Published" (was "Planned") at https://synapticnoise.com/plans/ (gallery zeveck/synapticnoise, private repo; plans/touch-grass/, design page https://synapticnoise.com/plans/touch-grass/). Pushed (cd62a3f).

## Design shared

Design shared: https://claude.ai/artifact/NdpRQDpGNQPA5vzhgZENoE, as a page (source design/share/).

## Spending

About $10.26 of $30. Details in design/ASSETS.md.

Art sheet: https://synapticnoise.com/plans/touch-grass/art/ (built from .gamegen/art-sheet/manifest.json)

## Changes after publishing

- 2026-11-21, requests 6-7: touched grass never lies down; it glows gold while it rests, turns green when ready, and keeps a tiny blossom for the field (rendering only; rules and pacing unchanged). Before/after in design/screenshots/gold-change/. Republished.
