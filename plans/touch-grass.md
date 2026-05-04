---
title: Touch Grass -- A Web Relaxation Game
created: 2026-04-19
status: active
---

# Plan: Touch Grass -- A Web Relaxation Game

> **Landing mode: PR** -- This plan targets PR-based landing. All phases use worktree isolation with a named feature branch.

## Overview

Touch Grass is a zero-runtime-dependency web relaxation game where the player sweeps a finger or mouse across a canvas field of grass; touched cells drop in height and grant energy, while untouched cells regrow over a logistic curve. Levels grow in size and polygon complexity, introduce grass-type variants (tall/short/flowered/stiff) and an insect ecosystem (hostile biters that drain energy with an angry warning, and friendly critters that can be petted to bank bonus energy and fill a persistent farm collection). A level is won by reaching an energy threshold or fully clearing the field, with carryover bonus if both fire the same frame. v1 delivers 15 hand-tuned levels, a title screen, settings panel, three energy-spend moves (ring/line/full-clear), local high-scores, imagegen-sourced art and audiogen-sourced audio, a shareable 1200x630 scorecard, a deep-link challenge flow, and a CI workflow gating PRs into the locked main branch. The phasing front-loads the testing harness and zskills config (so every later phase has a runnable `bash scripts/test-all.sh`), then builds from the smallest playable substrate (grass model + sweep) outward through gameplay systems, interactions, A/V polish, meta features, and finally a dedicated pre-release verification phase that exercises the full game across orientation, mobile performance, aesthetic review, and a real device. A/V generation is deferred to Phase 6 because the insect species must be finalized (Phase 5) before their sprites and SFX are prompted, and settings+moves are folded into a single UI phase (Phase 4) so the first human playtest can happen before art is in place. Pre-release verification is split into its own Phase 8 (was appended to Phase 7 during drafting) so the share/farm/CI build session is not forced to bundle ~25 minutes of real-event playthrough and subjective asset review in the same agent run.

## Progress Tracker

| Phase | Status | Commit | Notes |
|-------|--------|--------|-------|
| 1 -- Foundation, Testing Harness, Title Screen | ⬚ | | |
| 2 -- Grass Model, Rendering, Pointer Sweep | ⬚ | | |
| 3 -- Levels, Polygon Shapes, Energy, Win Conditions, Progression | ⬚ | | |
| 4 -- Energy Moves, Settings, Consolidated Storage | ⬚ | | |
| 5 -- Insects: Ecosystem & Interactions | ⬚ | | |
| 6 -- Audio & Visual Polish (imagegen + audiogen) | ⬚ | | |
| 7 -- High Score, Insect Farm, Share, Deep Link, CI | ⬚ | | |
| 8 -- Pre-Release Verification & Release | ⬚ | | |

## Phase 1 -- Foundation, Testing Harness, Title Screen

### Goal

Stand up the repository scaffold, wire the zskills testing harness end-to-end by PATCHING the existing scaffold (not rewriting it), populate CLAUDE.md's TODO markers, and ship a title screen that transitions to an empty `playing` state with both unit and e2e smoke tests green.

### Work Items

- [ ] Create directory layout: `src/`, `src/ui/`, `test/`, `e2e/`, `assets/` (empty placeholder with a `.gitkeep`), `.github/workflows/`, `scripts/` (already exists from zskills -- extend, do not overwrite).
- [ ] Write `index.html` at repo root: responsive `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `body { height: 100dvh; margin: 0 }`, a `<div id="app">` root, and `<script type="module" src="./src/main.mjs"></script>`.
- [ ] Write `src/style.css` with a system-font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`), a CSS-variables-based palette that responds to `prefers-color-scheme: dark`, `html, body { height: 100%; background: var(--bg); color: var(--fg); }`, AND a root `#app` rule with safe-area-inset padding so HUD/title/overlays are never clipped by notches: `#app { padding-top: env(safe-area-inset-top); padding-right: env(safe-area-inset-right); padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); box-sizing: border-box; min-height: 100%; }`. Authored here rather than retrofitted in Phase 8 (closes R-5 / DA-4).
- [ ] Write `src/main.mjs` as a thin bootstrap that imports `src/state.mjs` and mounts the title UI. Expose a dev-only `window.__game` object (populated across phases) and a `?level=N&dev=1` URL-parameter handler that, when `location.hostname === 'localhost'` OR `location.hostname === '127.0.0.1'` OR the LAN range (any IPv4) AND `params.get('dev') === '1'`, bypasses the title screen and, after Phase 3 lands `loadLevel`, calls `window.__game.loadLevel(Number(params.get('level')))` and transitions to `'playing'` with full energy. Phase 1 stubs this check (logs `console.info('dev level-skip: waiting for Phase 3 loadLevel')` because `loadLevel` doesn't exist yet); Phase 3 makes it functional. The guard ensures production deploys with `location.hostname === 'game.example.com'` never expose the backdoor. (Closes R-7 / DA-12 by establishing the dev-skip mechanism up-front so Phase 8's screenshot gallery can use it.)
- [ ] Write `src/state.mjs`: exports a minimal state machine with states `'title' | 'playing' | 'paused' | 'level-won' | 'settings' | 'farm'` and a transition API (`getState()`, `setState(next)`, `onChange(cb)`). Invalid transitions throw in dev mode.
- [ ] Write `src/ui/title.mjs`: renders the title ("Touch Grass"), a primary Start button (label switches to "Continue" if any save exists under `localStorage['touchgrass.v1']`), a best-score summary stub ("Best: --" until Phase 7 populates), a settings cog button (stub that sets state to `'settings'` -- the modal itself lands in Phase 4), and an Insect Farm button (stub that sets state to `'farm'` -- screen stays empty until Phase 7). All buttons >=48px hit target. Start click sets state to `'playing'`. **Attach `data-testid` attributes per the Data-testid convention block in Design & Constraints** (Start = `btn-start`, Continue variant = `btn-continue`, settings cog = `btn-settings`, farm = `btn-farm`). Icon-only buttons also receive `aria-label` matching their testid intent.
- [ ] Write `src/loop.mjs`: `requestAnimationFrame`-based loop. Computes `const dt = Math.min(50, now - lastNow) / 1000;` (clamp at 50ms wall time, convert to seconds). Exposes `start(updateFn, renderFn)` / `stop()`. Includes a 1-second FPS sampler -- if sampled FPS < 45, `console.warn` for now (full perf-degradation wiring lands in Phase 6).
- [ ] Populate `.claude/zskills-config.json` with the testing + dev-server + ui fields listed in Design & Constraints. Confirm no `testing.*`, `dev_server.cmd`, or `ui.*` field is empty after writing (except `ui.auth_bypass` which is intentionally empty string).
- [ ] **PATCH (not rewrite)** the existing `scripts/test-all.sh`: replace the four `{{PLACEHOLDER}}` tokens (`UNIT_TEST_CMD`, `E2E_TEST_CMD`, `BUILD_TEST_CMD`, `MAIN_REPO_PATH`) with the values in Design & Constraints. Add `shopt -s globstar` early in the file. Set `BUILD_TEST_CMD=':'` (shell no-op) since this project has no build step. Keep the existing `has_changed_source_files` gate that blocks E2E skips when `src/` files change. The final file is ~165 lines and preserves the color output, record/summary tables, and safety gate -- only tokens change.
- [ ] Write `package.json` with: `name: "touchgrass"`, `private: true`, `type: "module"`, `devDependencies: { "@playwright/test": "^1.47.0" }`, and `scripts: { "test:unit": "shopt -s globstar; node --test test/**/*.test.mjs", "test:e2e": "playwright test", "test:all": "bash scripts/test-all.sh" }`.
- [ ] Run `npm install --save-dev @playwright/test`.
- [ ] Run `npx playwright install --with-deps chromium webkit` (include `--with-deps` because WebKit needs system libraries not guaranteed present on this dev container; matches the CI workflow install line). If `--with-deps` requires sudo and fails, fall back to `npx playwright install chromium webkit` and document the webkit-lib prereq in the phase report.
- [ ] Write `playwright.config.mjs` with the full content given in Design & Constraints -- port is resolved at config-load time (not `${PORT}` string interpolation), and `reuseExistingServer` is hard-coded to `true` so pre-started dev servers (including in CI) are respected rather than fought.
- [ ] Write `.env.example` at repo root documenting `OPENAI_API_KEY=` and `ELEVENLABS_API_KEY=` with a comment that both are optional at runtime (the shipped game loads from `assets/` regardless) but required for Phase 6 regeneration. Add `.env.example` to git; ensure `.env` is listed in `.gitignore`.
- [ ] Append `.env`, `node_modules/`, `test-results/`, `playwright-report/`, and `.test-results.txt` to `.gitignore` (repo `.gitignore` already exists -- append, do not overwrite). `.test-results.txt` is ignored defensively even though test output is routed to `/tmp/zskills-tests/` (see Design & Constraints). Note that `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` are set by the user and must never be echoed or rewritten.
- [ ] **Update `CLAUDE.md`** to replace six `TODO` markers with real values (see Design & Constraints "CLAUDE.md patches" block). Populate the source-layout block with the Phase 1 src/ tree. Populate the test command blocks with `node --test test/**/*.test.mjs` and `bash scripts/test-all.sh`. Populate the auth-bypass block with "no auth required -- the game has no login". Populate the test-file-patterns block with `test/**/*.test.mjs` and `e2e/**/*.spec.mjs`.
- [ ] Document "no linter" policy in a short `.editorconfig` (2-space indent, LF line endings, final-newline true, trim-trailing-whitespace true) and mention in CLAUDE.md's architecture section that "this project does not run a linter; `.editorconfig` is the style reference." This closes the question without introducing an ESLint devDependency.
- [ ] Write `test/smoke.test.mjs`: imports `src/state.mjs` and asserts `setState('playing')` from `'title'` succeeds; asserts an invalid transition throws.
- [ ] Write `e2e/title.spec.mjs`: navigates to the server root, asserts `page.getByRole('heading', { name: /touch grass/i })` is visible, asserts the Start button is visible and enabled, clicks it, and verifies the state transition (via `page.evaluate(() => window.__game?.state)` after wiring a dev-only `window.__game` export in `main.mjs`).
- [ ] Write `.github/workflows/ci.yml` with the full YAML given in Design & Constraints. The workflow does NOT start its own dev server -- `playwright.config.mjs`'s `webServer` block starts one instead (avoids CI port-conflict with a pre-started server).
- [ ] Verify the workflow YAML parses via `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exiting 0.

### Design & Constraints

**Complete `.claude/zskills-config.json` content to write** (merge with existing file; do not drop other preset fields):

```json
{
  "testing": {
    "unit_cmd": "shopt -s globstar; node --test test/**/*.test.mjs",
    "full_cmd": "bash scripts/test-all.sh",
    "output_file": "/tmp/zskills-tests/touchgrass/.test-results.txt",
    "file_patterns": ["test/**/*.test.mjs", "e2e/**/*.spec.mjs"]
  },
  "dev_server": {
    "cmd": "python3 -m http.server $DEV_PORT"
  },
  "ui": {
    "file_patterns": "src/.*\\.(mjs|js|css|html)$",
    "auth_bypass": ""
  }
}
```

**`scripts/test-all.sh` token replacements** (patch the existing scaffold; keep `has_changed_source_files` gate, color output, summary tables):

- `UNIT_TEST_CMD='shopt -s globstar; node --test test/**/*.test.mjs'`
- `E2E_TEST_CMD='npx playwright test'`
- `BUILD_TEST_CMD=':'` (no-op; project has no build step)
- `MAIN_REPO_PATH='/workspaces/touchgrass'`
- Add `shopt -s globstar` at the top of the script so `test/**/*.test.mjs` expands correctly.
- Test output is already captured to `/tmp/zskills-tests/$(basename pwd)/.test-results.txt` by the existing scaffold. Do NOT add a `cp` step that copies it into the repo tree -- that would violate CLAUDE.md's "route test output OUT of the working tree" rule.

**Full `playwright.config.mjs` body** (port resolved at config-load time; `reuseExistingServer: true` unconditionally):

```js
import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';

const PORT = Number(execSync('bash scripts/port.sh').toString().trim()) || 8000;

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile-safari', use: devices['iPhone 12'] },
  ],
});
```

**Full `.github/workflows/ci.yml` body** (does NOT pre-start dev server; Playwright's webServer starts it):

```yaml
name: ci
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install deps
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium webkit
      - name: Run all tests
        run: bash scripts/test-all.sh
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            /tmp/zskills-tests/touchgrass/.test-results.txt
            playwright-report/
            test-results/
          if-no-files-found: ignore
```

**CLAUDE.md patches** (six TODO replacements):

1. Line 5 source-layout TODO -> describe `src/` (main.mjs entrypoint; state.mjs state machine; loop.mjs rAF loop; ui/ UI modules; grass/ model; input/ pointer; render/ canvas/grass; levels.mjs, moves.mjs, insects/, audio.mjs, haptics.mjs, storage.mjs (Phase 4+); test/ unit tests; e2e/ Playwright specs).
2. Line 10 dev-server TODO -> `python3 -m http.server $DEV_PORT`.
3. Line 19 auth-bypass TODO -> "no auth; `ui.auth_bypass` is empty because Touch Grass has no login flow".
4. Line 26 unit-test TODO -> `shopt -s globstar; node --test test/**/*.test.mjs`.
5. Line 27, 30, 38, 49 full-test TODO (four occurrences) -> `bash scripts/test-all.sh`.
6. Line 66 test-file-patterns TODO -> `test/**/*.test.mjs` (unit), `e2e/**/*.spec.mjs` (e2e).

By end of Phase 7, CLAUDE.md Architecture section is revisited to reflect the full final src/ tree.

**File tree after Phase 1**:

```
/workspaces/touchgrass/
  index.html
  package.json
  playwright.config.mjs
  .gitignore
  .editorconfig
  .env                         (pre-existing, untouched)
  .env.example
  .github/workflows/ci.yml
  .claude/zskills-config.json  (populated)
  CLAUDE.md                    (TODOs filled)
  src/
    main.mjs
    state.mjs
    loop.mjs
    style.css
    ui/title.mjs
  test/
    smoke.test.mjs
  e2e/
    title.spec.mjs
  scripts/
    port.sh                    (pre-existing, untouched)
    test-all.sh                (patched tokens; `has_changed_source_files` gate preserved)
  assets/                      (empty + .gitkeep)
```

**`dt` clamp formula** (in `src/loop.mjs`): `const dt = Math.min(50, now - lastNow) / 1000;   // clamp at 50ms wall time, convert to seconds` -- clamped before the first render tick so tab backgrounding does not produce huge physics jumps.

**Data-testid convention** (authored up-front so Phase 8's touch-target audit has a stable selector set; closes R-6 / DA-5):

Every interactive DOM element gets `data-testid="<kebab-case>"`. Icon-only buttons additionally get `aria-label` matching their textual purpose. The following registry is the complete v1 set; each owning phase attaches the attribute when the element is authored:

| testid                  | Element                                 | Owning phase |
|-------------------------|-----------------------------------------|--------------|
| `btn-start`             | Title screen Start button               | 1            |
| `btn-continue`          | Title screen Continue variant           | 1            |
| `btn-settings`          | Title screen settings cog               | 1            |
| `btn-farm`              | Title screen Insect Farm button         | 1            |
| `btn-pause`             | HUD pause icon                          | 3            |
| `btn-resume`            | Pause overlay Resume button             | 3            |
| `btn-pause-title`       | Pause overlay Title button              | 3            |
| `btn-level-won-next`    | Level-won overlay Next button           | 3            |
| `btn-move-ring`         | Toolbar Ring button                     | 4            |
| `btn-move-line`         | Toolbar Line button                     | 4            |
| `btn-move-clear`        | Toolbar Full-clear button               | 4            |
| `btn-settings-close`    | Settings modal Close button             | 4            |
| `btn-clear-data`        | Settings modal Clear Data button        | 4            |
| `btn-farm-close`        | Farm screen Close button                | 7            |
| `btn-share`             | Post-win / farm Share button            | 7            |
| `btn-deep-link-play`    | Deep-link overlay Play button           | 7            |
| `btn-deep-link-dismiss` | Deep-link overlay Dismiss button        | 7            |

Phase 8's touch-target audit enumerates exactly this set and asserts each selector's bounding rect width+height >= 48 CSS px. Phase 8 does NOT invent new testids -- if a button is missing a testid, the bug is in the owning phase, not Phase 8.

**Dev-only level-skip query-param** (authored in Phase 1 stub form; functional in Phase 3; closes R-7 / DA-12):
- Activated by `?dev=1&level=N` where `N in [1..15]`.
- Guarded by `location.hostname === 'localhost' || location.hostname === '127.0.0.1' || /^(10|172|192)\./.test(location.hostname)` (covers dev-container + LAN IPs used by real-device test).
- In prod (any other hostname), `dev=1` is ignored and the query param is silently stripped.
- Phase 1 wires the parsing + stub; Phase 3 makes it call `window.__game.loadLevel(N)`.

### Acceptance Criteria

- [ ] `bash scripts/test-all.sh` exits 0 locally -- unit passes; e2e passes (Playwright's webServer starts the dev server).
- [ ] `scripts/test-all.sh` is executable (`x` bit set for owner) and retains its `has_changed_source_files` gate (grep returns a match).
- [ ] Title screen renders with the system font stack; the word "Touch Grass" appears as a heading and a Start button is visible and enabled.
- [ ] Clicking Start transitions `window.__game.state` from `'title'` to `'playing'`; an empty canvas or placeholder is acceptable at this phase.
- [ ] `.claude/zskills-config.json` has no empty fields among `testing.unit_cmd`, `testing.full_cmd`, `testing.output_file`, `testing.file_patterns`, `dev_server.cmd`, `ui.file_patterns`. (`ui.auth_bypass` is intentionally empty string.)
- [ ] `CLAUDE.md` has zero `TODO:` markers remaining under the zskills-config fields (verified via `grep -c "TODO:" CLAUDE.md` returning 0, or whatever non-TODO markers survive are explicitly non-zskills-config items).
- [ ] `.github/workflows/ci.yml` validates as YAML (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0).
- [ ] `.env.example` exists and lists both env vars with comments.
- [ ] Manual playwright-cli check: launch dev server via `python3 -m http.server $(bash scripts/port.sh) &`, navigate to the title URL, take a screenshot, click Start, verify no console errors in the page.
- [ ] Unit test `test/smoke.test.mjs` passes under `node --test`.
- [ ] E2E test `e2e/title.spec.mjs` passes under `npx playwright test` (Playwright starts its own dev server via `webServer` config).

### Dependencies

None. This phase bootstraps everything.

## Phase 2 -- Grass Model, Rendering, Pointer Sweep

### Goal

Deliver a live, interactive canvas of procedurally rendered grass where dragging a pointer zeros cell heights along a Bresenham-traced path and cells regrow via a logistic curve.

### Work Items

- [ ] Create `src/grass/model.mjs` exporting a `Grid` class. The **Phase 2 constructor signature** is `new Grid(width, height)` with fields `heights: Float32Array` (length = width*height, row-major, initialized to 1.0), `toughness: Uint8Array` (same length, initialized to 0 for Phase 2; consumed in Phase 3's stiff grass), `types: Uint8Array` (same length, all 0 = DEFAULT for Phase 2; set in Phase 3), `valid: Uint8Array` (all 1 for Phase 2, later set by polygon mask), and `totalEnergy: number`. Adding `types` now (even though only DEFAULT is used) keeps the Phase 3 extension backward-compatible (no constructor-signature break). API: `update(dt)`, `touchCells(cellSet, speed, gesture)`, `getCell(r, c)`, `setCell(r, c, h)`, `getAllHeights()`, `setLevelShape(polygons, typeMap)` (Phase 2 stub accepts `polygons=[singleBoxPolygon]`, `typeMap=null`; full impl Phase 3).
- [ ] Regrowth: inside `update(dt)`, for each valid cell apply `h = h + r * (1 - h) * dt` with `r = 2.0` (Phase 3 extends to per-type `r`). Cap at 1.0.
- [ ] Touch: `touchCells(cellSet, speed, gesture)` iterates a `Set<number>` of packed cell indices (`r * width + c`). For each valid cell: compute `dE = base * h_before * (1 + Math.min(0.5, speed / 500))` with `base = 1.0`; add to `totalEnergy`; set `heights[i] = 0`. (Stiff-grass branch is stubbed in Phase 2; full behavior in Phase 3, including per-gesture toughness.) The `gesture` parameter is a monotonic id (incremented on each pointerdown); Phase 2 ignores it; Phase 3 uses it for per-gesture toughness accounting.
- [ ] Create `src/input/pointer.mjs`: Pointer Events wrapper. On `pointerdown`, capture `pointerId` (first pointer wins; subsequent pointers ignored until release). On `pointermove`, record `{x, y, t}` in CSS pixels relative to the canvas bounding rect. On `pointerup`, `pointercancel`, `pointerleave`: clear active pointer. Attach listeners with `{passive: false}` where needed and set CSS `touch-action: none` on the canvas via `src/style.css`. Emit a monotonic `gestureId` on each new `pointerdown`.
- [ ] Create `src/input/sweep.mjs`: given `(prevCell, currCell)` in grid coords, returns a `Set<number>` of cell indices along the Bresenham line from prev to curr (inclusive of both). On initial `pointerdown`, the sweep is a single cell. Off-grid cells are filtered out. Speed input for energy = `distance_px / dt_seconds` in canvas-CSS coordinates.
- [ ] Create `src/render/canvas.mjs`: sets up `<canvas>` with `ctx.scale(dpr, dpr)` where `dpr = window.devicePixelRatio || 1`. Canvas CSS size fills the viewport (respecting HUD reservation added in Phase 3). **First-class `resize` + orientation handler** (closes R-4 / DA-3): attach a single `window.addEventListener('resize', onResize)` listener that (a) reads current `innerWidth`, `innerHeight`, `devicePixelRatio`, (b) sets `canvas.width = innerWidth * dpr` and `canvas.height = (innerHeight - hudReservedPx) * dpr`, (c) sets matching `canvas.style.width`/`height` in CSS px, (d) resets the 2D context transform via `ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr);`, (e) emits a module-level `layout-changed` event (custom event on `window` or a module-scoped emitter) that Phase 3 HUD, Phase 4 toolbar, and Phase 7 overlays subscribe to. Phase 2 wires the listener and publishes the event; Phase 3's HUD consumes it for bottom-strip re-layout; Phase 4's toolbar consumes it for button positioning. The `hudReservedPx` reference starts at 0 in Phase 2 and is updated by Phase 3 when the HUD module initializes (publishes its own `layout-reserve` event that canvas.mjs reads).
- [ ] Create `src/render/grass.mjs`: for each valid cell, render a cluster of 3-5 procedural mini-blades (precomputed per-cell offsets using a seeded PRNG so blades do not shimmer). Blade color from an 11-entry HSL lookup table computed once at module load: index = `Math.round((1 - h) * 10)`, quantizing `hsl(120, 60%, 45%)` (h=1, pristine green) to `hsl(45, 75%, 65%)` (h=0, gold). Invalid cells fill with `hsl(30, 20%, 30%)` (dirt) -- rendered only once to an offscreen canvas background to save inner-loop cost.
- [ ] Precompute HSL lookup table in `src/render/grass.mjs` module scope:
  ```js
  const COLOR_STEPS = 11;
  const COLOR_LUT = Array.from({ length: COLOR_STEPS }, (_, i) => {
    const t = i / (COLOR_STEPS - 1); // 0 = pristine green, 1 = gold
    const H = 120 + (45 - 120) * t;
    const S = 60 + (75 - 60) * t;
    const L = 45 + (65 - 45) * t;
    return `hsl(${H.toFixed(1)}, ${S.toFixed(1)}%, ${L.toFixed(1)}%)`;
  });
  ```
  Phase 3 does NOT add per-type LUT variants. Grass-type differentiation in Phase 3 is implemented purely as overlay geometry (petals for FLOWERED, darker outline for STIFF, taller blades for TALL, shorter denser blades for SHORT). The green-to-gold LUT is shared across all grass types so the touch-response color feedback stays consistent. (See Phase 3 note: the `hue` key on `GRASS_TYPES` is metadata for future variants and is not consumed by the renderer in v1.)
- [ ] Wire the game loop: `update(dt)` calls `grid.update(dt)` then collects cells swept since last frame from pointer history and calls `grid.touchCells(cells, speed, gestureId)`. `render()` calls `renderGrass(ctx, grid)`.
- [ ] Expose `window.__game = { grid, state, cells: () => grid.getAllHeights(), layout: { cellPx: {w, h}, hudOffsetPx } }` in dev mode for e2e assertions. `layout` is populated by `canvas.mjs` on each resize (Phase 3 adds `hudOffsetPx` when HUD reserves its strip). E2E tests that need to click on a specific cell read `window.__game.layout.cellPx` to compute pixel coordinates (closes DA-13).
- [ ] Unit tests in `test/grass.test.mjs`:
  - Regrowth asymptote: starting `h=0`, after 100 steps of `dt=0.1`, `h > 0.99`.
  - Regrowth closed-form correctness: starting `h=0`, one step of `dt=1e-3` with `r=2.0` matches the closed-form `1 - exp(-r*dt)` to within `1e-6`. (This replaces the earlier "doubling dt" test which is mathematically not achievable to 1e-3 for forward Euler at 60fps-scale dt.)
  - Bresenham line (0,0) -> (5,3): asserts exact cell set.
  - Bresenham diagonal (0,0) -> (4,4): 5 cells on the diagonal.
  - Bresenham off-grid: (-2, 1) -> (3, 1) on a 4x4 grid yields cells (0..3, 1).
  - `touchCells` zeroing: heights at swept indices == 0, others unchanged.
  - Energy formula: `h=1, speed=0 -> dE=1.0`; `h=0.5, speed=1000 -> dE = 0.5 * (1 + 0.5) = 0.75`; speed clamp verified at 2000.
  - HSL LUT: `COLOR_LUT.length === 11`; endpoint strings match expected hue values.
  - **Multi-touch policy:** synthesize `pointerdown` with `pointerId=1`, then `pointerdown` with `pointerId=2` without a release; assert only `pointerId=1` is tracked (`pointer.activePointerId === 1`); `pointerup` on id=2 is ignored; `pointerup` on id=1 clears the active pointer.
- [ ] E2E test `e2e/sweep.spec.mjs`: loads page, waits for canvas, drags via `page.mouse.move(x1,y1); page.mouse.down(); page.mouse.move(x2, y2, {steps: 20}); page.mouse.up();`. Asserts `await page.evaluate(() => { const h = window.__game.grid.getAllHeights(); return [...h].some(v => v < 0.1); })`.
- [ ] Manual playwright-cli walkthrough: open dev server, sweep pointer in a zigzag, take a screenshot, verify green-to-gold gradient is visible along the path.

### Design & Constraints

**Regrowth formula** (verbatim): `h_{t+dt} = h_t + r * (1 - h_t) * dt`, `r = 2.0` for DEFAULT (Phase 3 introduces per-type `r`), heights clamped to `[0, 1]`. **Note:** forward Euler on this ODE has O(dt^2) local error; the unit test uses the closed-form `h(t) = 1 - exp(-r*t)` as ground truth at a small step size (1e-3) rather than a "doubling dt" comparison (which is mathematically not achievable to 1e-3 tolerance for forward Euler at gameplay-scale dt).

**Energy gain per touched cell** (verbatim): `dE = base * h_before * (1 + min(0.5, speed / 500))`, `base = 1.0`; `speed` is pointer speed in CSS px/sec measured from pointer history. In Phase 3, `dE` is multiplied by `GRASS_TYPES[types[i]].energyMult`.

**Pointer sampling strategy**: record `pointermove` events into a small ring buffer; on each rAF tick, for each consecutive pair of positions since last frame, map to cell coords and Bresenham-fill into a per-frame `Set<number>`. This prevents fast drags from skipping cells (a pointermove-only approach misses cells between samples).

**Multi-touch policy**: first pointer wins. Track `activePointerId`; ignore `pointerdown` events with a different id until `pointerup`/`pointercancel` on the active id. Asserted by unit test above.

**CSS**: in `src/style.css`, `canvas { touch-action: none; display: block; width: 100%; height: 100%; }` and `html, body { overscroll-behavior: none; }` to prevent pull-to-refresh.

**FPS sampler hook**: warn-only when < 45fps in Phase 2 (full perf-degradation path -- particle cap reduction, LUT step reduction -- lands in Phase 6).

### Acceptance Criteria

- [ ] A 20x20 debug grid renders with all 400 cells visible at > 55fps on desktop Chromium (the FPS sampler warns otherwise).
- [ ] Dragging across the canvas zeros heights along the Bresenham path (verified by e2e state assertion).
- [ ] Zeroed cells regrow to `h >= 0.95` within 1.5 seconds of cessation (loose bound; logistic to ~0.95 at r=2.0 is ~1.5s).
- [ ] Color transitions smoothly from pristine green (h=1) to gold (h=0) via the 11-step LUT; at least 3 distinct colors are visible in a screenshot of a partially swept grid.
- [ ] `touch-action: none` verified: dragging across the canvas on mobile WebKit project does not scroll the page.
- [ ] All unit tests in `test/grass.test.mjs` pass under `node --test`, including the multi-touch first-pointer-wins test.
- [ ] E2E test `e2e/sweep.spec.mjs` passes.
- [ ] Manual screenshot (attached in Phase report) shows gradient from touched to untouched cells.

### Dependencies

Phase 1 complete (test harness, loop stub, title->playing transition).

## Phase 3 -- Levels, Polygon Shapes, Energy, Win Conditions, Progression

### Goal

Turn the free-running grass canvas into a 15-level progression with polygon-masked play fields (including a two-island level), typed grass, energy threshold / full-clear win conditions, a HUD, pause, and level-won transitions.

### Work Items

- [ ] Create `src/levels.mjs` exporting `LEVELS: Array<LevelSpec>` of length 15. Each spec has `{ index, size: {w, h}, polygons: Array<Array<[x, y]>>, grassTypes: Array<{type, weight}>, insectsPreview: [] }`. **Note the plural `polygons`** -- a field that is always an array of at least one polygon. Single-shape levels have `polygons.length === 1`; L14 has `polygons.length === 2` (main + island). `energyThreshold` is NOT stored on the spec -- it is computed at level load from the formula `0.5 * validCells * avgEnergyMult` where `validCells` is the polygon-union mask count and `avgEnergyMult` is the mean `energyMult` across valid cells after type seeding.
- [ ] Create `src/level-mask.mjs` exporting `pointInPolygon(x, y, poly)` (ray-cast) and `computeValidCells(grid, polygons)` that stamps `grid.valid[i] = 1` iff the cell center is inside ANY polygon in the `polygons` array (union). Coordinates are in grid units (a cell at row r, col c has center (c+0.5, r+0.5)).
- [ ] Pseudocode for ray-cast point-in-polygon (in `src/level-mask.mjs`):
  ```
  function pointInPolygon(x, y, poly):
    inside = false
    j = poly.length - 1
    for i in 0..poly.length-1:
      (xi, yi) = poly[i]; (xj, yj) = poly[j]
      if (yi > y) !== (yj > y):
        xCross = (xj - xi) * (y - yi) / (yj - yi) + xi
        if x < xCross: inside = !inside
      j = i
    return inside

  function computeValidCells(grid, polygons):
    for r in 0..grid.height-1:
      for c in 0..grid.width-1:
        let hit = false
        for poly in polygons:
          if pointInPolygon(c + 0.5, r + 0.5, poly):
            hit = true; break
        grid.valid[r * grid.width + c] = hit ? 1 : 0
  ```
- [ ] Extend `src/grass/model.mjs` for grass types. The Phase 2 constructor (`new Grid(width, height)`) is unchanged -- `types: Uint8Array` was already added in Phase 2 initialized to 0 (DEFAULT). Phase 3 adds a per-type config table and wires it into `update(dt)` and `touchCells`. The existing Phase 2 tests continue to pass unchanged.
  ```js
  export const GRASS_TYPES = {
    DEFAULT:  { id: 0, regrow: 2.0, energyMult: 1.0, toughness: 0 },
    TALL:     { id: 1, regrow: 1.0, energyMult: 1.6, toughness: 0 },
    SHORT:    { id: 2, regrow: 3.5, energyMult: 0.7, toughness: 0 },
    FLOWERED: { id: 3, regrow: 2.0, energyMult: 1.2, toughness: 0 },
    STIFF:    { id: 4, regrow: 2.0, energyMult: 1.0, toughness: 1 }
  };
  ```
  The `hue` field is intentionally NOT on these entries; grass-type visual differentiation is overlay-only (see Phase 2 note). Update `update(dt)` to look up `regrow` per cell via `GRASS_TYPES[types[i]].regrow`. Update `touchCells(cellSet, speed, gestureId)` with per-gesture toughness (see next item).
- [ ] **Stiff-grass per-gesture toughness** (closing DA-14): `touchCells` receives the current `gestureId`. The Grid maintains an internal `_lastDecrementGesture: Int32Array` (length = cells, initialized to -1). For each swept cell `i`: if `types[i] === STIFF.id` and `toughness[i] > 0`:
    - If `_lastDecrementGesture[i] === gestureId`: skip (already decremented this gesture; do NOT further reduce on zigzag re-entries).
    - Else: `toughness[i] -= 1; _lastDecrementGesture[i] = gestureId;` and do NOT zero height or grant energy for this touch.
  If `toughness[i] === 0` (or type is not STIFF), zero the height and grant `dE * GRASS_TYPES[type].energyMult`.
- [ ] Extend `src/level-loader.mjs` exporting `loadLevel(index)`: validates the spec, calls `computeValidCells(grid, spec.polygons)` (union of islands), seeds `types` per the level's `grassTypes` weight distribution (deterministic RNG seeded by level index), reinitializes `heights[i] = 1.0` on valid cells, **reinitializes `toughness[i] = GRASS_TYPES[types[i]].toughness` for every valid cell** (closing R-20), resets `_lastDecrementGesture` to `-1`, computes `energyThreshold = 0.5 * validCells * avgEnergyMult` where `avgEnergyMult = mean(GRASS_TYPES[types[i]].energyMult for i where valid[i] === 1)`, sets `totalEnergy = carryoverBonus` (replace, not add), then clears `carryoverBonus` to 0. Also exposes `window.__game.loadLevel = loadLevel` in dev mode so the Phase 1 `?dev=1&level=N` handler can activate; Phase 8's screenshot gallery script uses this to jump levels quickly.
- [ ] Extend `src/render/grass.mjs` to branch on type for overlay geometry only (not for base-color LUT): FLOWERED adds a small 3-pixel pink/purple petal accent centered on the blade cluster; STIFF renders a darker blade outline (using `hsl(140, 40%, 25%)` stroke) around the cluster; TALL blades are rendered ~1.5x taller using the same LUT color; SHORT blades are ~0.6x shorter, denser (5 blades instead of 3). All overlays are overlays on top of the shared green-to-gold LUT base color.
- [ ] Create `src/energy.mjs` exporting an `EnergyTracker` class: fields `totalEnergy`, `threshold`, `cellCountValid`, `carryoverBonus`. Re-initialized by `loadLevel` (see above).
- [ ] Win-condition check (per-frame, ordered) in `src/loop.mjs` `update(dt)`:
  ```js
  // Ordering note: if both true same frame, both-true branch fires (carryover);
  // otherwise either alone fires without carryover. Equivalent to "check energy
  // first, full-clear second" because carryover is only granted when both are
  // true simultaneously.
  const hitEnergy = energy.totalEnergy >= energy.threshold;
  const cleared = allValidCells.every(i => grid.heights[i] < 0.05 && grid.toughness[i] <= 0);
  if (hitEnergy && cleared) {
    energy.carryoverBonus = 0.2 * energy.threshold;
    state.setState('level-won');
  } else if (hitEnergy || cleared) {
    energy.carryoverBonus = 0;
    state.setState('level-won');
  }
  ```
- [ ] Create `src/ui/hud.mjs`: bottom strip showing energy meter (fills left-to-right, threshold marker), level number label, progress percentage (`totalEnergy / threshold * 100`, capped at 100), a top-corner SVG mini-map showing the polygon shape(s) with valid area filled, and a right-side pause icon button (`data-testid="btn-pause"`, `aria-label="Pause"`). **Accessibility:** the HUD contains a `<div role="status" aria-live="polite" aria-atomic="false">` that is updated on threshold-percentile milestones (25/50/75/100%) and on level-won with the message "Level N complete". This is the ARIA live region called for in research; it is not a full screen-reader experience but it emits score/level updates to assistive tech. **Layout integration:** subscribes to the `layout-changed` event from `src/render/canvas.mjs` (added in Phase 2) so HUD strip reflows on orientation/resize; publishes a `layout-reserve` event on mount with `hudOffsetPx` (72 mobile, 56 desktop) that canvas.mjs consumes.
- [ ] Create `src/ui/level-won.mjs`: full-screen overlay "Level N complete", shows `+carryoverBonus` to next level when nonzero ("Carryover: +X energy"), a primary "Next" button (`data-testid="btn-level-won-next"`) that increments level, calls `loadLevel(n+1)`, and transitions state back to `'playing'`. Persists progress via `storage.writeState({ progress: { level: n+1 }, lastPlayed: new Date().toISOString() })`. **Storage invariant preserved up-front** (closes R-9): `src/storage.mjs` does not yet exist in Phase 3 (it lands in Phase 4), but Phase 3's level-won writer does NOT introduce a second key. Instead, Phase 3 defines an inline helper in `src/ui/level-won.mjs` that reads `localStorage.getItem('touchgrass.v1')`, parses (falling back to `{ version: 1, progress: { level: 1 }, lastPlayed: null }`), deep-merges `{ progress: { level: n+1 }, lastPlayed: ... }`, and writes back to the SAME consolidated key `touchgrass.v1`. Phase 4 simply refactors `level-won.mjs` to call `storage.writeState({ progress: ..., lastPlayed: ... })` -- behavior is unchanged; the storage module replaces the inline helper. No second key (`touchgrass.v1.progress`) is ever created, so Phase 4's `migrate` has nothing to clean up.
- [ ] Create `src/ui/pause.mjs`: overlay with Resume / Title buttons (`data-testid="btn-resume"`, `data-testid="btn-pause-title"`). Triggered by `Escape` on desktop or the HUD pause icon on touch.
- [ ] Unit tests in `test/levels.test.mjs`:
  - `pointInPolygon` for a square (0,0)-(10,10): (5,5) in, (15,5) out, boundary behavior (document inclusive or exclusive in test comment; matches `xCross > x` exactly as pseudocode states).
  - `pointInPolygon` for an L-shape with concave notch: assert a point in the notch is outside.
  - Irregular pentagon: spot-check 3 interior, 3 exterior.
  - Two-island union: L14 polygons; cell center at (17,10) is inside main, (18,29) is inside island, (18,23) between islands is outside.
  - Win-condition ordering: construct a grid where energy>=threshold and all-cleared on the same frame; assert `carryoverBonus === 0.2 * threshold`.
  - Progression table: every level in `LEVELS` validates (`polygons.length >= 1`; each polygon `length >= 3`; all vertices within `size`; `grassTypes` weights sum to 1).
  - `computeValidCells` spot-check: for each of the 15 levels, assert 3 known cells (picked from Design & Constraints validation table below) -- 1 inside main polygon, 1 inside any island if present, 1 outside both. Asserts cell inclusion uses cell-center rule.
  - `validCells` counts: for each level, assert the computed `grid.valid` count equals the verbatim count in the progression table below (these were computed from the cell-center rule using the specified polygon vertices; see script in Design & Constraints).
  - Grass-type regrowth: TALL cell reaches 0.5 at ~0.69 sec (r=1.0); SHORT at ~0.20 sec (r=3.5).
  - **Stiff toughness per-gesture semantics:** a single touch with gestureId=1 decrements toughness to 0 but does not grant energy; a second touch on the SAME gestureId=1 does NOT further decrement and does NOT grant energy (still stiff, toughness now 0 but next-touch must be a new gesture); a first touch with a new gestureId=2 on a toughness=0 cell zeros it and grants energy. A zigzag that re-enters the same stiff cell twice within one gestureId does not clear it.
  - **Toughness reset on level load:** start with a grid where `toughness[5] = 0` (stiff cell already cleared on level N); call `loadLevel(n+1)` where cell 5's new type is STIFF; assert `toughness[5] === 1` after load (closing R-20).
- [ ] E2E test `e2e/levels.spec.mjs`:
  - Load page, start, programmatically force `totalEnergy = threshold + 1` and tick one frame; assert `level-won` overlay shows.
  - Start a new level, programmatically zero all valid cells; assert `level-won` overlay shows `Carryover: 0` (energy was < threshold when cleared).
  - Click Next; assert level index incremented.
- [ ] Manual playwright-cli: play levels 1 through 3 by sweeping, verify HUD, polygon shape matches the mini-map, and level-won transitions correctly.

### Design & Constraints

**Level progression table** (v1, extensible). `validCells` and `avgMult` are computed from the polygon vertices by cell-center inclusion and the grass-type weight distribution using the Node reproducer at the end of this section. `energyThreshold` is derivable via `0.5 * validCells * avgMult` and is NOT stored on the level spec -- it is computed at `loadLevel` time.

| Idx | Size (WxH) | Shape       | Polygon(s) vertices (grid coords) | Grass type distribution | validCells | avgMult | energyThreshold (= 0.5 * vC * avgMult) | Insects preview |
|-----|-----------|-------------|-----------------------------------|-------------------------|------------|---------|--------------------------------------|-----------------|
| 1   | 12x12 | square      | `[[0,0],[12,0],[12,12],[0,12]]` | DEFAULT 1.0 | 144 | 1.0000 | 72.00 | none |
| 2   | 13x13 | square      | `[[0,0],[13,0],[13,13],[0,13]]` | DEFAULT 1.0 | 169 | 1.0000 | 84.50 | none |
| 3   | 15x15 | square      | `[[0,0],[15,0],[15,15],[0,15]]` | DEFAULT 0.8, SHORT 0.2 | 225 | 0.9400 | 105.75 | (ladybug unlocked Phase 5) |
| 4   | 17x19 | rectangle   | `[[0,0],[17,0],[17,19],[0,19]]` | DEFAULT 0.7, TALL 0.3 | 323 | 1.1800 | 190.57 | none |
| 5   | 19x19 | square      | `[[0,0],[19,0],[19,19],[0,19]]` | DEFAULT 0.6, SHORT 0.2, FLOWERED 0.2 | 361 | 0.9800 | 176.89 | none |
| 6   | 21x21 | L-shape     | `[[0,0],[21,0],[21,12],[12,12],[12,21],[0,21]]` | DEFAULT 0.6, TALL 0.2, SHORT 0.2 | 360 | 1.0600 | 190.80 | (ant unlocked Phase 5) |
| 7   | 23x23 | square      | `[[0,0],[23,0],[23,23],[0,23]]` | DEFAULT 0.5, TALL 0.2, SHORT 0.2, FLOWERED 0.1 | 529 | 1.0800 | 285.66 | none |
| 8   | 25x25 | L-shape     | `[[0,0],[25,0],[25,15],[14,15],[14,25],[0,25]]` | DEFAULT 0.5, TALL 0.25, FLOWERED 0.25 | 515 | 1.2000 | 309.00 | (butterfly unlocked Phase 5) |
| 9   | 27x27 | cross (+)   | `[[9,0],[18,0],[18,9],[27,9],[27,18],[18,18],[18,27],[9,27],[9,18],[0,18],[0,9],[9,9]]` | DEFAULT 0.5, TALL 0.2, FLOWERED 0.2, STIFF 0.1 | 405 | 1.1600 | 234.90 | none |
| 10  | 29x29 | square      | `[[0,0],[29,0],[29,29],[0,29]]` | DEFAULT 0.4, TALL 0.2, SHORT 0.2, FLOWERED 0.1, STIFF 0.1 | 841 | 1.0800 | 454.14 | (bee unlocked Phase 5) |
| 11  | 31x31 | L-shape     | `[[0,0],[31,0],[31,18],[18,18],[18,31],[0,31]]` | DEFAULT 0.4, TALL 0.25, FLOWERED 0.2, STIFF 0.15 | 792 | 1.1900 | 471.24 | none |
| 12  | 33x33 | pentagon    | `[[16,0],[33,12],[27,33],[6,33],[0,12]]` | DEFAULT 0.4, TALL 0.2, SHORT 0.2, FLOWERED 0.1, STIFF 0.1 | 765 | 1.0800 | 413.10 | (wasp unlocked Phase 5) |
| 13  | 34x34 | square      | `[[0,0],[34,0],[34,34],[0,34]]` | DEFAULT 0.3, TALL 0.25, SHORT 0.15, FLOWERED 0.2, STIFF 0.1 | 1156 | 1.1450 | 661.81 | none |
| 14  | 35x35 | two-island  | main `[[0,0],[35,0],[35,20],[0,20]]` + island `[[8,25],[28,25],[28,33],[8,33]]` (stored as `polygons: [main, island]`; union via `computeValidCells`) | DEFAULT 0.3, TALL 0.25, SHORT 0.15, FLOWERED 0.15, STIFF 0.15 | 860 | 1.1350 | 488.05 | (caterpillar + snail unlocked Phase 5) |
| 15  | 36x36 | irregular octagon | `[[6,0],[30,0],[36,10],[36,26],[30,36],[6,36],[0,26],[0,10]]` | DEFAULT 0.25, TALL 0.25, SHORT 0.2, FLOWERED 0.15, STIFF 0.15 | 1176 | 1.1200 | 658.56 | mixed |

**Threshold reproducer** (Node, kept as living reference; test/levels.test.mjs runs an equivalent assertion):

```js
// Using GRASS_TYPES mults: DEFAULT=1.0, TALL=1.6, SHORT=0.7, FLOWERED=1.2, STIFF=1.0
// avgMult = sum(weight_t * mult_t for t in types)
// validCells = count of (c,r) in [0,w) x [0,h) with cell-center (c+0.5, r+0.5)
//              inside any polygon (ray-cast point-in-polygon, union over polygons)
// threshold = 0.5 * validCells * avgMult
// Values above were computed by this exact script; unit test asserts table <-> formula.
```

**Win-condition ordering** (verbatim): energy-threshold check and full-clear check run in the same frame. Both true => `carryoverBonus = 0.2 * threshold`. Only one true => `carryoverBonus = 0`. Neither => continue playing.

**Toughness reset at level load** (verbatim semantics): `loadLevel(index)` calls `grid.setLevelShape(polygons, typeMap)` (new Phase 3 method) which: (a) stamps `grid.valid` via polygon union; (b) assigns `grid.types[i]` per seeded weight distribution; (c) sets `grid.toughness[i] = GRASS_TYPES[types[i]].toughness` for every cell (zero for invalid cells is fine); (d) zeros `_lastDecrementGesture[i] = -1` everywhere; (e) sets `grid.heights[i] = 1.0` on valid cells, `0` elsewhere. The level-loader then sets `energyTracker.totalEnergy = carryoverBonus; energyTracker.carryoverBonus = 0;` (assignment, not addition).

**HUD layout**:
- Bottom strip: 72px tall on mobile, 56px on desktop. Energy bar spans 80% width; level + percent on the left; pause icon on the right.
- Top-right mini-map: 96x96 SVG, polygon(s) filled in `--accent` color, currently-swept area overlaid at 40% alpha. Two-island levels render both shapes.
- ARIA live region: `<div role="status" aria-live="polite" aria-atomic="false" class="sr-only">` at the root of the HUD. Updated on energy milestones (25/50/75/100%) and level-won.

### Acceptance Criteria

- [ ] All 15 levels load without errors; for each level, `grid.valid` count equals the `validCells` value in the progression table exactly (integer equality, not tolerance-based -- the numbers were computed from the cell-center rule; if an implementer changes the rule, the test reveals it).
- [ ] Cell-inclusion spot-check passes for each level: 3 known cells assert the expected `valid[i]` value (inside / outside / island-only, as the test defines).
- [ ] `energyThreshold` computed at `loadLevel` matches the table value to within 0.01 (rounding allowance for IEEE 754 `avgMult`).
- [ ] HUD energy meter fills left-to-right and reaches the threshold marker at the correct energy total.
- [ ] ARIA live region emits a text update when energy crosses 25/50/75/100% thresholds and when level-won fires (verified by e2e reading `document.querySelector('[aria-live="polite"]').textContent` before and after a forced energy jump).
- [ ] Level wins by energy-threshold alone (no full clear): next-level carryover bonus is 0.
- [ ] Level wins by full-clear alone (energy under threshold): next-level carryover bonus is 0.
- [ ] Level wins by both conditions same frame: next-level starts with `totalEnergy = 0.2 * prevThreshold`.
- [ ] Pause overlay pauses the loop (heights do not regrow while paused).
- [ ] L-shape level (L6): at least one cell in the concave notch is `valid[i] === 0`.
- [ ] L14 two-island level: `polygons.length === 2`; cells inside either polygon have `valid[i] === 1`; cells between islands have `valid[i] === 0`.
- [ ] Stiff cells (L9+): a first touch (new gestureId) decrements toughness; a second zigzag touch within the same gestureId does NOT further change state; a fresh pointerdown (new gestureId) on a toughness=0 stiff cell zeros it and grants energy.
- [ ] After `loadLevel(n+1)`, `toughness[i]` is reset per the new level's type distribution (not carried from level n).
- [ ] All unit tests in `test/levels.test.mjs` pass; e2e `e2e/levels.spec.mjs` passes.
- [ ] Manual: levels 1-3 playable end-to-end.

### Dependencies

Phase 2 (grass model, rendering, sweep).

## Phase 4 -- Energy Moves, Settings, Consolidated Storage

### Goal

Give the player three energy-spend moves (ring sweep, line sweep, full clear) via a toolbar; ship a settings modal; introduce `src/storage.mjs` as the single localStorage gateway so Phases 5 and 7 do not need a migration. Also wire a haptics wrapper and a lazy Web Audio context stub ready for Phase 6.

### Work Items

- [ ] **Create `src/storage.mjs`** (consolidation landing now, not Phase 7; closes R-13 and DA-11): exports `readState()` and `writeState(partial)`. Single localStorage key `touchgrass.v1` holds the full shape:
  ```js
  // Default state returned by readState() when the key is absent or parse fails:
  const DEFAULT_STATE = {
    version: 1,
    settings: { music: 60, sfx: 80, haptics: null, reducedMotion: 'auto' }, // haptics=null means "auto-detect on first read"
    farm: {},            // { speciesId: { firstMet, petCount } }
    highscores: { byLevel: {}, allTime: null },
    progress: { level: 1 },
    lastPlayed: null,
  };
  export function readState() {
    try { const raw = localStorage.getItem('touchgrass.v1'); if (!raw) return structuredClone(DEFAULT_STATE);
          const parsed = JSON.parse(raw); return migrate(parsed); }
    catch (e) { console.warn('storage.readState', e); return structuredClone(DEFAULT_STATE); }
  }
  export function writeState(partial) {
    try { const cur = readState(); const next = deepMerge(cur, partial);
          localStorage.setItem('touchgrass.v1', JSON.stringify(next)); return next; }
    catch (e) { console.warn('storage.writeState', e); return null; }
  }
  export function migrate(state) {
    // v1 is the initial shape in this plan -- migration is a no-op for v1.
    // For farm: drop any species id not in the current SPECIES registry (handles
    // future species removals). This is Phase 5-aware; Phase 4 can leave the
    // filter as a TODO that Phase 5 fills in when SPECIES is defined.
    if (!state || state.version !== 1) return structuredClone(DEFAULT_STATE);
    return state;
  }
  ```
  All Phase 3, 4, 5, 7 localStorage access goes through `readState`/`writeState`. No phase writes a separate `touchgrass.v1.settings` or `touchgrass.v1.farm` key. (Phase 3's inline progress write from its `level-won.mjs` is replaced here to call `writeState({ progress: { level: n+1 }, lastPlayed: ... })`.)
- [ ] Create `src/moves.mjs` exporting three moves keyed by id:
  ```js
  export const MOVES = {
    RING:  { id: 'ring',  cost: 10, cooldownMs: 300, activate(ctx, cell) { /* zero cells within radius 3 of cell, filtered by ctx.skipCellPredicate (insect footprints) */ } },
    LINE:  { id: 'line',  cost: 20, cooldownMs: 300, activate(ctx, path) { /* zero cells within 5-cell-wide corridor along path, filtered by ctx.skipCellPredicate */ } },
    CLEAR: { id: 'clear', cost: 75, cooldownMs: 300, activate(ctx) { /* zero all valid cells EXCEPT those currently covered by any insect footprint (uses ctx.skipCellPredicate) */ } },
  };
  ```
  Each `activate` respects `grid.valid` (does nothing on invalid cells) and still runs the energy-gain formula for affected cells (so full-clear both costs 75 and grants energy from the cleared grass, which typically wins by the full-clear condition). **Insect-footprint protection applies to moves** (closes DA-8): every `activate` receives the same `skipCellPredicate` that Phase 5 wires for sweeps. CLEAR does NOT zero cells under ladybugs/butterflies/caterpillars/snails; RING and LINE likewise filter. This preserves the Phase 5 invariant "friendlies cannot be harmed by sweeps" under moves. Unit test: place a ladybug at (5,5); `MOVES.CLEAR.activate({ grid, skipCellPredicate: buildInsectPredicate() })`; assert `heights[5*w+5]` unchanged; all other valid cells zeroed.
- [ ] Create an armed-move state machine: `{ armed: 'ring' | 'line' | 'clear' | null, armedAt: timestampMs }`. Arming: `armMove(id)` deducts cost up-front, sets armed=id. Disarming (tap canvas elsewhere or timeout at 5s): refunds cost, clears armed. Executing: on next canvas `pointerdown` (RING, CLEAR) or on `pointerup` after a drag (LINE), invoke `activate` then clear armed. Cooldown: after execute, ignore new arms for `cooldownMs`. **Level-end and pause always disarm with refund** (closes R-22): if state transitions to `'level-won'` or `'paused'` while a move is armed, refund the cost and clear `armed` before the transition fires side effects.
- [ ] **Move trigger uniformity** (closes R-9): all three moves are triggered by the next `pointerdown` on the canvas (not by tap classification). Ring executes at the down cell; Line starts accumulating a path from pointerdown and executes on pointerup; Full Clear executes immediately on pointerdown anywhere on the canvas. This keeps Phase 4 trigger semantics orthogonal to Phase 5's tap-vs-sweep discriminator.
- [ ] **Armed-move + insect-interaction priority** (closes R-16 / DA-7): when a move is armed and the next `pointerdown` lands on an insect footprint cell, the INSECT interaction wins -- the move stays armed (no refund, no execution, no double-fire). Rationale: insect interaction (pet on friendly, or angry-timer on hostile) is the foreground UX and the move-arm is cheap to retain for a follow-up tap on grass. Implementation: at `pointerdown`, compute `insectHit = pointerIsOnAnyInsectFootprint(x, y)`. If `armedMove !== null && insectHit`, skip the move's `activate` call and let Phase 5's insect-hit path run normally; the move remains armed with its existing 5-second timeout. If `armedMove !== null && !insectHit`, run `activate` as specified and clear `armed` per the Phase 4 state machine. Unit test in `test/moves.test.mjs`: arm RING (cost 10 deducted), synthesize a pointerdown on a spawned ladybug cell, assert `armed === 'ring'` still, `totalEnergy` unchanged from post-arm value, ladybug transitioned to `petted` on pointerup-as-tap.
- [ ] Create `src/ui/toolbar.mjs`: three buttons along the bottom strip. Each shows icon + cost. Disabled state when `totalEnergy < cost`. Armed state: button is highlighted, a subtle pulse animation. Canvas overlay shows a preview shape (ring circle cursor for RING, corridor trailing the pointer for LINE, full-field flash intent for CLEAR). Each button receives `data-testid` and `aria-label` per the Phase 1 convention: `btn-move-ring`, `btn-move-line`, `btn-move-clear`. Subscribes to the `layout-changed` event from `src/render/canvas.mjs` to reposition on orientation/resize.
- [ ] Create `src/ui/settings.mjs`: modal reached via title-screen cog OR pause overlay. Controls:
  - Music volume slider `0..100`, default 60.
  - SFX volume slider `0..100`, default 80.
  - Haptics toggle (checkbox). Default: on if `matchMedia('(pointer: coarse)').matches`, off otherwise. Stored as explicit boolean once the user opens settings the first time (resolving the `null` sentinel in DEFAULT_STATE).
  - Reduced motion: segmented control `Auto | Force Off | Force On`. Default `Auto`.
  - Clear data: danger button (`data-testid="btn-clear-data"`); shows native `confirm()` "Erase all Touch Grass data?" then `localStorage.removeItem('touchgrass.v1')` and reload.
  - Close button (`data-testid="btn-settings-close"`) returns to prior state.
- [ ] Persist settings: every setting change calls `writeState({ settings: { ... } })`. On load, read via `readState().settings` and hydrate controls. No direct `localStorage.setItem` or `localStorage.getItem` calls outside `src/storage.mjs`.
- [ ] Create `src/haptics.mjs` exporting `vibrate(ms)`: `if (settings.haptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)`. No-op on browsers without Vibration API (Safari desktop and iOS -- closes DA-8). Default `ms` scaled by caller.
- [ ] Create `src/audio.mjs` exporting `AudioBus`: lazy-creates `AudioContext` on first pointerdown (`{ once: true }`), exposes `musicGain`, `sfxGain`, a `muteAll` flag. Setter methods write `settings.music / 100` and `settings.sfx / 100` to the respective gain nodes. Phase 6 populates the actual sources.
- [ ] Unit tests in `test/storage.test.mjs`:
  - `readState` on empty localStorage returns default shape deep-equal to `DEFAULT_STATE`.
  - `writeState({ settings: { music: 0 } })` followed by `readState()` shows `music: 0`, preserves other settings defaults, preserves `farm: {}`.
  - `writeState({ farm: { ladybug: { firstMet: 'X', petCount: 1 } } })`: deep-merge preserves settings.
  - `readState` with malformed JSON falls back to defaults and logs.
  - Migration from legacy split keys (`touchgrass.v1.settings`, etc.) is NOT needed (no migration path exists because Phase 4 is the first time anything is written and it uses the consolidated shape); the test asserts that setting a legacy key and calling `readState` does NOT merge it (the consolidated key is authoritative).
- [ ] Unit tests in `test/moves.test.mjs`:
  - Cost deduction: arming RING with energy 15 leaves 5; refund on disarm returns to 15.
  - Armed state machine: arm -> pointerdown -> execute -> armed is null.
  - Cooldown: a second arm within 300ms is ignored.
  - Full-clear zeros all valid cells and grants energy from the cleared grass.
  - Settings round-trip via storage module: `writeState({ settings: { music: 42 } })` then fresh import + `readState()` returns `music: 42` (reload simulated by new imports).
  - Haptics toggle: with haptics off, `vibrate(10)` is a no-op (spy on `navigator.vibrate`).
  - Haptics no-op on Safari: simulate `navigator.vibrate === undefined`; `vibrate(10)` does not throw.
  - AudioBus: created only after first `pointerdown`; `muteAll` sets master gain to 0.
  - **Level-end disarm:** arm RING (deduct 10), transition state to `level-won` without pointerdown; assert `armed === null`, `totalEnergy` is back to pre-arm value (refunded).
- [ ] E2E test `e2e/moves.spec.mjs`:
  - Play **level 5** (threshold 176.89, not 72 -- closes DA-9). Programmatically set `totalEnergy = 80` (enough to afford CLEAR at cost 75, well below L5's 176.89 threshold), arm full-clear, tap canvas, assert level-won overlay (triggered by full-clear condition since L5 has 361 valid cells and they are all zeroed by CLEAR). Also test: on L1, attempting to afford CLEAR is impossible because L1's threshold (72) fires before energy can reach 75 -- the toolbar CLEAR button is disabled at all times on L1 in practice; this is documented in Design & Constraints as "CLEAR is first affordable on L4+".
  - Settings panel opens/closes, slider values round-trip after page reload (verifies `writeState` -> `readState` flow).
- [ ] Manual playwright-cli: playtest each move; verify settings panel controls all work; verify haptics toggle has no console errors.

### Design & Constraints

**Move specs** (verbatim):

| Move        | Cost | Radius / Width | Cooldown | Trigger                                           |
|-------------|------|----------------|----------|---------------------------------------------------|
| Ring sweep  | 10   | radius 3 cells | 300ms    | arm -> next `pointerdown` on canvas; executes at the downed cell |
| Line sweep  | 20   | 5-cell width   | 300ms    | arm -> `pointerdown` starts path; execute on `pointerup` using drag path |
| Full clear  | 75   | entire field   | 300ms    | arm -> next `pointerdown` anywhere on canvas; executes immediately |

**When each move is first affordable** (documented so designer/tester has a reference):
- RING (10): affordable on L1 after ~10 seconds of sweeping. Usable on all 15 levels.
- LINE (20): affordable on L1 after ~20 seconds. Usable on all 15 levels.
- CLEAR (75): NOT affordable before L4 (L1 threshold 72 < 75 triggers energy-win before CLEAR can be bought; L2 threshold 84.5 > 75 so CLEAR is affordable right at threshold -- but threshold-win fires first in the same frame; L3 threshold 105.75 gives the first ~30 sec window where CLEAR is affordable without auto-winning; L4 threshold 190.57 gives the first comfortable usage window). E2E test targets L5 as a stable test ground.

**Settings schema** (accessed via `storage.readState().settings`):

```json
{
  "music": 60,
  "sfx": 80,
  "haptics": true,
  "reducedMotion": "auto"
}
```

**Haptics default detection** (resolves the `null` sentinel in DEFAULT_STATE at first settings open):

```js
const defaultHaptics = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(pointer: coarse)').matches;
```

**Storage invariants** (verbatim):
- The ONLY localStorage key touched by game code is `touchgrass.v1`.
- All reads/writes go through `src/storage.mjs`.
- Phase 5 farm writes, Phase 7 high-score writes, and Phase 3 progress writes all use `writeState({ farm: {...} })` etc.
- Clear-data removes exactly `touchgrass.v1`.

### Acceptance Criteria

- [ ] Toolbar shows three move buttons with costs; disabled when insufficient energy.
- [ ] Arming a move deducts cost immediately; disarming refunds.
- [ ] Full-clear with sufficient energy (tested on L5) clears the field and transitions to `level-won`.
- [ ] Level-end or pause while armed triggers a refund and clears `armed`; assertion in unit test.
- [ ] Settings panel writes via `storage.writeState({ settings })` and survives a page reload.
- [ ] Clear-data button, after confirm, removes exactly `touchgrass.v1` from localStorage and reloads.
- [ ] Haptics toggle default: on mobile-emulation project (Playwright `iPhone 12`), UI defaults to OFF (since vibration unsupported) and the wrapper is a no-op; on desktop Chromium, default is OFF because `(pointer: coarse)` does not match. On an Android-emulating Chromium profile (not in the default projects; use a manual override for testing), default is ON.
- [ ] AudioContext is not created until the first pointerdown (verified via `window.__audio.ctx === null` before ANY pointer interaction, non-null after the FIRST pointerdown -- including a tap on the title-screen settings cog before Start, per the `{once: true}` listener binding to any gesture; closes DA-6).
- [ ] All unit tests in `test/storage.test.mjs` and `test/moves.test.mjs` pass; e2e `e2e/moves.spec.mjs` passes.
- [ ] Manual playtest confirms moves execute and settings persist.

### Dependencies

Phase 3 (levels, energy, HUD exist; moves consume/earn energy against that model).

## Phase 5 -- Insects: Ecosystem & Interactions

### Goal

Introduce a living ecosystem of hostile (bee/wasp/ant) and friendly (ladybug/butterfly/caterpillar/snail) insects with AI, tap-vs-sweep disambiguation, energy drain from bites (never fatal), and a petted-species collection persisted via `src/storage.mjs` for the Phase 7 farm screen.

### Work Items

- [ ] Create `src/insects/types.mjs` exporting a species registry:
  ```js
  export const SPECIES = {
    bee:         { id: 'bee',         name: 'Bee',         hostile: true,  footprint: 1, speed: 0.7, wanderProb: 0.85 },
    wasp:        { id: 'wasp',        name: 'Wasp',        hostile: true,  footprint: 1, speed: 1.1, wanderProb: 0.90 },
    ant:         { id: 'ant',         name: 'Ant',         hostile: true,  footprint: 1, speed: 0.5, wanderProb: 0.80 },
    ladybug:     { id: 'ladybug',     name: 'Ladybug',     hostile: false, footprint: 1, speed: 0.3, wanderProb: 0.70, petEnergyBonus: 5 },
    butterfly:   { id: 'butterfly',   name: 'Butterfly',   hostile: false, footprint: 1, speed: 0.8, wanderProb: 0.95, petEnergyBonus: 5 },
    caterpillar: { id: 'caterpillar', name: 'Caterpillar', hostile: false, footprint: 2, speed: 0.2, wanderProb: 0.60, petEnergyBonus: 5 },
    snail:       { id: 'snail',       name: 'Snail',       hostile: false, footprint: 1, speed: 0.15, wanderProb: 0.50, petEnergyBonus: 5 }
  };
  ```
  `footprint` is in cells (caterpillar occupies its current cell plus one trailing cell). `speed` is in cells/sec.
- [ ] Update `src/storage.mjs` `migrate()` to drop any farm entries whose species id is not in the current `SPECIES` registry (closing DA-15). Add a unit test: seed localStorage with `{ farm: { oldspecies: {...}, ladybug: {...} } }`; `readState()` returns a farm with only `ladybug`.
- [ ] Create `src/insects/entity.mjs` exporting an `Insect` class: fields `{ id, species: speciesId, x, y, vx, vy, aiState, stateTimer }`. `aiState` is `'wander' | 'angry' | 'fleeing' | 'petted'`. `stateTimer` counts down state-specific durations.
- [ ] Create `src/insects/ai.mjs`:
  - Wander: every frame, with `wanderProb * dt` nudge `vx, vy` by a small random delta (bounded to species speed); keep on valid cells (bounce off polygon edges).
  - Hostile -> Angry: **angry iff Euclidean distance between the active pointer position (converted to cell coords by `(x_px / cellPxW, y_px / cellPxH)`) and any cell occupied by the bug's footprint is <= 1.5 cells** (closing R-17). Transition to `angry` with `stateTimer = 1.5s`. Render a pulsing red halo. The "or adjacent" alternate from the earlier draft is dropped; this one rule covers adjacency because a footprint cell 1 cell away is <= sqrt(2) ~ 1.41 < 1.5.
  - Angry -> Bite: when `stateTimer <= 0` and pointer still satisfies the adjacency rule, deduct 15 energy (clamped at `totalEnergy = max(0, totalEnergy - 15)`; never fatal, no game-over), transition to `fleeing` with `stateTimer = 2.0s`. If pointer moved away before bite, transition back to `wander`. **Haptics & bite SFX** fire at bite (see Phase 6); if the user has lifted the pointer before the bite timer expires the transition goes to wander, so vibrate is never invoked outside a recent pointer gesture (address DA-13; Android Chrome requires vibrate within ~5s of a gesture -- still holding the pointer trivially satisfies this).
  - Fleeing: move opposite the last pointer position at 1.4x species speed until timer expires.
  - Friendly -> Petted: on a tap (see disambiguation below), transition to `petted` with `stateTimer = 0.8s`; grant `petEnergyBonus` energy; call `storage.writeState({ farm: { [speciesId]: { firstMet: existing?.firstMet ?? new Date().toISOString(), petCount: (existing?.petCount ?? 0) + 1 } } })`.
- [ ] Create `src/insects/spawn.mjs`: level spawns per the table in Design & Constraints. Spawn positions are random valid cells. Insect entities stored in a list on the current level state.
- [ ] Create `src/insects/render.mjs` (placeholder art; real sprites land in Phase 6): 18x18px rounded rects, species color (bee=yellow/black stripes, wasp=yellow/black slimmer, ant=brown, ladybug=red with dots, butterfly=cyan, caterpillar=green segmented, snail=beige+shell). Two dot eyes. Angry halo = pulsing red ring. Petted = brief white flash + sparkle particles.
- [ ] Hit-testing in `src/input/pointer.mjs` (extend): on each `pointerdown`, first check insect entities (any footprint cell under pointer). If an insect is hit, mark the gesture as `insectGesture = true` and prevent Phase 2's sweep pipeline from touching any cell covered by any insect footprint FOR THE DURATION OF THIS GESTURE (see next item).
- [ ] **Modify Phase 2 sweep pipeline to skip insect-footprint cells** (closes DA-10): in `src/grass/model.mjs` `touchCells`, accept a `skipCellPredicate: (r,c) => boolean` (new optional parameter). The pointer module builds this predicate per frame: union of every insect's footprint cells. Phase 2's swept cell set is filtered through this predicate BEFORE height-zeroing. Unit test: spawn a ladybug at (5,5); simulate a sweep that includes (5,5); assert `heights[5*w+5]` is unchanged.
- [ ] Tap-vs-sweep discriminator (extend pointer module): track `pointerdown` time and total path length. `totalPathPx` is the **integrated CSS-pixel Euclidean distance** from each consecutive `pointermove` pair in the active gesture (summed; not cell-space, not device-pixel-space -- CSS pixels are dpr-independent so the 10-px threshold corresponds to ~1.6mm physical distance at typical mobile pixel densities -- closes DA-9). On `pointerup`: if `(upTime - downTime) < 200ms && totalPathPx < 10`, emit a `'tap'` event with the initial cell; else emit a `'sweep'` event (cells already processed each frame as usual). A tap on a friendly pets it. A tap on a hostile counts as an attempted sweep on the cell (no pet); if the pointer was adjacent >= 1.5s the bite fires per the AI rules. **Friendly-pet hit-test latching** (closes DA-14): on `pointerdown`, if an insect footprint is under the pointer, latch `{ gestureId, insectId, species }` as the candidate pet target. On `pointerup`-classified-as-tap, pet the LATCHED insect (even if it has wandered off the pointerup cell in the 0-200ms window) provided the latched insect entity still exists. If the insect was despawned (e.g. level-won during the tap), the pet is a no-op.
- [ ] Unit tests in `test/insects.test.mjs`:
  - AI state transitions: mock pointer adjacency, step through wander -> angry -> bite -> fleeing -> wander; assert timers decrement, energy deducted by 15 on bite, clamped at 0.
  - Adjacency rule: place bug at cell (5,5); assert pointer at (6,6) [Euclidean 1.41] is angry-eligible; pointer at (7,5) [Euclidean 2.0] is not; pointer at (6.4, 5) [Euclidean 1.4] is eligible; pointer at (6.6, 5) [Euclidean 1.6] is not.
  - Tap vs sweep: synthesize `down` at (100,100) then `up` at (105,100) 120ms later -> tap; `down` at (100,100) then series of moves to (200,100) over 250ms then `up` -> sweep.
  - Pet: tapping a friendly adds its species via `storage.writeState`; repeated pets increment `petCount`; `petEnergyBonus` added to energy.
  - Farm migration: seed `storage.writeState({ farm: { unknown: {...}, ladybug: {...} } })`; re-read; assert only `ladybug` remains.
  - Spawn: L3 spawns 1 ladybug, 0 hostiles; L10 spawns 1 bee, 1 ant, 1 butterfly; matches table.
  - Bite floor: starting energy 5, bite deducts to 0 not -10.
  - **Insect-footprint skip:** place a caterpillar at (5,5)-(5,6); simulate a sweep through (4,5), (5,5), (6,5); assert heights at (4,5) and (6,5) zero, `heights[5,5]` unchanged.
- [ ] E2E test `e2e/insects.spec.mjs`: programmatically spawn a ladybug at a known cell `(cr, cc)`. Read `const { cellPx, hudOffsetPx } = await page.evaluate(() => window.__game.layout);` (Phase 2-exposed layout info; closes DA-13). Compute click coords `cx = canvasBoundingBox.x + cc * cellPx.w + cellPx.w / 2; cy = canvasBoundingBox.y + cr * cellPx.h + cellPx.h / 2;` (HUD reservation already excluded from canvas box). Synthesize a tap (mouse down + up within 100ms at `(cx, cy)`); verify `storage.readState().farm.ladybug.petCount === 1` and the grass cell under the ladybug has `heights[cr * w + cc] ~ 1.0` (sweep skipped). Spawn a bee, drag near it for >1.5s, verify energy decreased by 15.
- [ ] Manual playwright-cli: play L6 (ant introduced), verify angry halo renders; play L3 and pet the ladybug; open the farm screen stub (still empty in Phase 5) and confirm no console error.

### Design & Constraints

**Spawn table** (per-level insect counts):

| Level | bee | wasp | ant | ladybug | butterfly | caterpillar | snail |
|-------|-----|------|-----|---------|-----------|-------------|-------|
| 1-2   | 0   | 0    | 0   | 0       | 0         | 0           | 0     |
| 3     | 0   | 0    | 0   | 1       | 0         | 0           | 0     |
| 4-5   | 0   | 0    | 0   | 1       | 0         | 0           | 0     |
| 6     | 0   | 0    | 1   | 1       | 0         | 0           | 0     |
| 7     | 0   | 0    | 1   | 2       | 0         | 0           | 0     |
| 8     | 0   | 0    | 1   | 1       | 1         | 0           | 0     |
| 9     | 0   | 0    | 2   | 1       | 1         | 0           | 0     |
| 10    | 1   | 0    | 1   | 1       | 1         | 0           | 0     |
| 11    | 1   | 0    | 2   | 1       | 1         | 0           | 0     |
| 12    | 1   | 1    | 1   | 1       | 1         | 0           | 0     |
| 13    | 1   | 1    | 2   | 2       | 1         | 0           | 0     |
| 14    | 1   | 1    | 1   | 1       | 1         | 1           | 1     |
| 15    | 2   | 1    | 2   | 2       | 1         | 1           | 1     |

**Relaxation-safe invariants** (verbatim):
- No game-over on bite. Energy is clamped at 0; the level continues.
- Angry halo MUST appear at least 1.5s before any bite; this is a hard minimum.
- Friendly insects cannot be harmed by sweeps; sweeping over a friendly displaces it (nudges its position 1 cell away) without damage.

**Tap-vs-sweep thresholds** (verbatim): `tapMaxDurationMs = 200`, `tapMaxPathPx = 10`. `tapMaxPathPx` is the integrated CSS-pixel Euclidean distance across pointermove deltas (dpr-independent, ~1.6mm physical on standard mobile density; uniform across the 12x12 L1 and 36x36 L15 grids because it is measured in CSS px, not cell units). Outside these bounds, the gesture is a sweep.

**Adjacency rule** (verbatim): Euclidean distance in cell coords from pointer to nearest bug footprint cell <= 1.5. No "or adjacent" alternate.

**Sweep-skip-under-insect rule** (verbatim): when an insect's footprint cell is under the pointer at any frame during an active gesture, that cell is skipped by `touchCells`. The predicate is recomputed each frame from all live insects (bugs may move during the gesture).

### Acceptance Criteria

- [ ] Hostile insect renders an angry halo for a full 1.5s before any energy deduction.
- [ ] Bite deducts exactly 15 energy, clamped at a floor of 0 (never negative, never triggers a game-over or level reset).
- [ ] Friendly tap grants exactly `petEnergyBonus` (5) energy and writes the species via `storage.writeState`.
- [ ] Tapping a friendly does NOT sweep the underlying grass cell (asserted in e2e by checking height unchanged and in unit test via the footprint-skip predicate).
- [ ] Tap-vs-sweep discriminator correctly classifies synthesized gestures in unit tests.
- [ ] Spawn table exactly matches the verbatim table above for levels 1-15.
- [ ] Sweeping through a friendly displaces it without damage (no state change other than position).
- [ ] Adjacency rule: exactly the Euclidean <= 1.5 rule is tested; alternates removed.
- [ ] `storage.migrate` drops unknown species ids from farm.
- [ ] All unit tests pass; e2e `e2e/insects.spec.mjs` passes.
- [ ] Manual: L6 bite scenario and L3 pet scenario verified.

### Dependencies

Phase 4 (settings + energy moves + storage module; insects write farm via `storage.writeState`).

## Phase 6 -- Audio & Visual Polish (imagegen + audiogen)

### Goal

Replace all placeholder art and silent audio with imagegen-generated PNGs and audiogen-generated MP3s, wire the Web Audio bus, wire dynamic FPS-based performance degradation, and complete the accessibility pass (prefers-reduced-motion, prefers-color-scheme, haptics scaling, particle caps). This phase is the heaviest in the plan; implementers should take the intermediate checkpoint noted below.

### Work Items

**Checkpoint guidance:** this phase has two natural checkpoints. (1) Generate and commit all 20 images + 9 audio files, verify `du -sh assets/` (target <= 8 MB post-resize; see asset budget below). (2) Then implement the audio engine, particles, a11y, and perf-degradation wiring. Commit and run tests after each checkpoint. Expected wall-clock: 1-2 hr for asset generation, 2-3 hr for engine wiring.

- [ ] **imagegen strategy** (closes DA-7 and DA-12): all imagegen outputs are 1024x1024 (or 1536x1024 for landscape) -- the `gpt-image-1` model does not support native 256x256. To meet the asset budget, a post-generation resize step downscales sprites/tiles/icons to 128x128 and the title/og to their target dimensions using Pillow (Python). Install Pillow locally as a build-time tool (`pip install --user Pillow`) -- this is a Phase 6 build-time dep, NOT a runtime dep, and does not violate the "no runtime deps" rule. Add `scripts/resize-assets.py` (see Design & Constraints for content). The resize script runs after imagegen and operates on files in-place.
- [ ] **Style-consistency strategy** (closes DA-12): generate ONE reference sprite (`ladybug.png`) at `--quality high`. Review visually (manual playwright-cli + file open). Then generate the remaining 15 sprites/tiles/icons at `--quality low` using `--image assets/sprites/ladybug.png --input-fidelity high` as a style reference. This keeps cost near ~$1.50 for the full pass and keeps style consistent. Promote any asset to `--quality high` individually only if the `low` pass is visually unusable.
- [ ] Use the `/imagegen` skill to generate the following assets. Each listed size is the FINAL size after resize (see `scripts/resize-assets.py`). The imagegen call uses the intermediate size (1024x1024 or 1536x1024) noted in parentheses. **imagegen flag shorthand** (verified against `.claude/skills/imagegen/SKILL.md`): `--size 1024x1024|1024x1536|1536x1024`, `--quality low|medium|high`, `--background transparent|opaque|auto` (NOT a bare `transparent` positional), `--image <path>` + `--input-fidelity high|low` for style reference, `--output <path>`, `--prompt '<prompt>'`. Example verbatim call: `/imagegen --size 1024x1024 --quality low --background transparent --output ./assets/sprites/bee.png --image ./assets/sprites/ladybug.png --input-fidelity high --prompt 'cute round bee sprite, top-down, yellow and black, friendly eyes, transparent background'`.
  1. `assets/backgrounds/title.png` -- FINAL 1536x1024 -- `--size 1536x1024 --background opaque --quality low` -- "calming meadow at golden hour, soft watercolor style, stylized grass, gentle breeze, warm sunlight, zero text, wide landscape"
  2. `assets/tiles/grass-default.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low` -- "top-down stylized green grass blade cluster, transparent background, game tile, soft painterly"
  3. `assets/tiles/grass-tall.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low` (with ladybug style ref after item 7) -- "top-down tall stylized grass blades, slightly bluer green, wispy tips, transparent background, game tile"
  4. `assets/tiles/grass-short.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low` -- "top-down short stubby stylized grass, bright yellow-green, dense carpet, transparent background, game tile"
  5. `assets/tiles/grass-flowered.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low` -- "top-down grass with small pink and purple flowers, soft petals, transparent background, game tile"
  6. `assets/tiles/grass-stiff.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low` -- "top-down stiff wiry grass, darker forest green, rigid blades, transparent background, game tile"
  7. `assets/sprites/ladybug.png` -- FINAL 128x128 -- **`--size 1024x1024 --background transparent --quality high`** (style reference for the rest of the pass) -- "cute red ladybug sprite with black spots, top-down, smiling, transparent background"
  8. `assets/sprites/bee.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low --image ./assets/sprites/ladybug.png --input-fidelity high` -- "cute round bee sprite, top-down, yellow and black, friendly eyes, transparent background"
  9. `assets/sprites/wasp.png` -- FINAL 128x128 -- same flags -- "cute slim wasp sprite, top-down, yellow and black, subtle menace, transparent background"
  10. `assets/sprites/ant.png` -- FINAL 128x128 -- same flags -- "cute red-brown ant sprite, top-down, three segments, friendly eyes, transparent background"
  11. `assets/sprites/butterfly.png` -- FINAL 128x128 -- same flags -- "cute pastel butterfly sprite, cyan and pink wings, top-down, transparent background"
  12. `assets/sprites/caterpillar.png` -- FINAL 128x128 -- same flags -- "cute green caterpillar sprite, segmented body, big eyes, top-down, transparent background"
  13. `assets/sprites/snail.png` -- FINAL 128x128 -- same flags -- "cute beige snail sprite with swirled shell, top-down, smiling, transparent background"
  14. `assets/ui/icon-ring.png` -- FINAL 128x128 -- `--size 1024x1024 --background transparent --quality low --image ./assets/sprites/ladybug.png --input-fidelity low` -- "clean game UI icon: ring sweep, circle of grass clearing outward, flat style, transparent background"
  15. `assets/ui/icon-line.png` -- FINAL 128x128 -- same flags -- "clean game UI icon: line sweep, straight cleared path, flat style, transparent background"
  16. `assets/ui/icon-clear.png` -- FINAL 128x128 -- same flags -- "clean game UI icon: full-clear burst, radiating lines, flat style, transparent background"
  17. `assets/ui/icon-settings.png` -- FINAL 128x128 -- same flags -- "clean game UI icon: settings cog, flat style, transparent background"
  18. `assets/ui/icon-farm.png` -- FINAL 128x128 -- same flags -- "clean game UI icon: insect farm jar with small leaves, flat style, transparent background"
  19. `assets/effects/level-won-burst.png` -- FINAL 512x512 -- `--size 1024x1024 --background transparent --quality low` -- "radial burst of green and gold petals, celebratory, transparent background"
  20. `assets/backgrounds/og-image.png` -- FINAL 1200x630 landscape -- `--size 1536x1024 --background opaque --quality medium` then resize to 1200x630 via Pillow center-crop -- "Touch Grass game social share card, stylized meadow with title 'Touch Grass' typography bottom-left, warm colors"
- [ ] Use the `/audiogen` skill to generate, save to `assets/` subpaths as indicated. **audiogen flag shorthand** (verified against `.claude/skills/audiogen/SKILL.md`): `music` subcommand accepts `--length-ms <ms>` (3000-600000, max 5 min), `--force-instrumental`, `--output-format <fmt>` (default `mp3_44100_128`; use `mp3_44100_96` for the music-budget reduction), `--seed <n>`, `--output <path>`. There is no `--loop` flag on music and no `--looping=true` -- **seamless looping is handled at engine time** in `src/audio.mjs` via `AudioBufferSourceNode.loop = true` (per the Phase 6 audio wiring work item below and SKILL.md's "Loop Caveat" section). `sfx` subcommand accepts `--duration <seconds>` (0.5-30), `--loop` (SFX-only native loop flag; not used here), `--prompt-influence <0-1>`, `--output-format`, `--output`. Transcode long music via `--output-format mp3_44100_96` to stay under the 8 MB asset budget.
  1. `assets/music/title.mp3` -- `music --length-ms 150000 --force-instrumental --output-format mp3_44100_96 --output ./assets/music/title.mp3` -- "calm lo-fi ambient music, soft pads, light acoustic guitar, nature textures, 80 bpm"
  2. `assets/music/gameplay.mp3` -- `music --length-ms 150000 --force-instrumental --output-format mp3_44100_96 --output ./assets/music/gameplay.mp3` -- "calming ambient music with gentle melodic progression, soft synths, subtle percussion, 90 bpm"
  3. `assets/sfx/grass-touch.mp3` -- `sfx --duration 0.4 --output ./assets/sfx/grass-touch.mp3` -- "subtle natural grass swoosh, soft, pleasant"
  4. `assets/sfx/energy-gain.mp3` -- `sfx --duration 0.5 --output ./assets/sfx/energy-gain.mp3` -- "soft ascending chime, warm, rewarding"
  5. `assets/sfx/level-won.mp3` -- `sfx --duration 1.5 --output ./assets/sfx/level-won.mp3` -- "short celebratory arpeggio, warm, uplifting"
  6. `assets/sfx/bite.mp3` -- `sfx --duration 0.4 --output ./assets/sfx/bite.mp3` -- "soft negative tone, gentle 'oof', not harsh"
  7. `assets/sfx/pet.mp3` -- `sfx --duration 0.6 --output ./assets/sfx/pet.mp3` -- "gentle friendly chirp, soft, cute"
  8. `assets/sfx/move-activate.mp3` -- `sfx --duration 0.5 --output ./assets/sfx/move-activate.mp3` -- "subtle UI whoosh, empowering"
  9. `assets/sfx/full-clear.mp3` -- `sfx --duration 1.2 --output ./assets/sfx/full-clear.mp3` -- "big sweep, wind + chime, satisfying"
  Fallback: if the ElevenLabs account tier does not accept `mp3_44100_96`, fall back to `mp3_44100_64` for music; document the choice in the phase report.
- [ ] Create `scripts/resize-assets.py` (Pillow-based, build-time only) that enforces final sizes. See Design & Constraints for content. Add `Pillow` to `.env.example`'s optional-tools comment block. Do NOT add Pillow to `package.json`.
- [ ] **Verify asset budget** (closes R-10): after `scripts/resize-assets.py` runs, `du -sh assets/` must be <= 8 MB. If over, the plan falls back to (a) transcode music to 80kbps, (b) downscale tiles to 96x96, (c) drop the `og-image` to a lossy JPEG. This is a Phase 6 work-item decision checkpoint; document which fallback was taken in the phase report.
- [ ] Create `src/assets.mjs` exporting `preload()`: returns a Promise that resolves when all images and audio listed above are loaded. Show a CSS-only loader (centered pulsing grass blade) on `index.html` until resolved. On asset error, log and continue (fall back to the Phase 5 placeholder renderer for missing sprites).
- [ ] Wire Web Audio in `src/audio.mjs` (extend Phase 4 stub):
  - Decode music MP3s to `AudioBuffer`; play via `AudioBufferSourceNode` with `loop = true` into `musicGain`.
  - Cross-fade music between title and gameplay states over 1.0s.
  - SFX: decode once, play via short-lived `AudioBufferSourceNode` into `sfxGain`. Pitch-shift grass-touch by cell height: `playbackRate = 0.8 + 0.4 * h`.
  - Resume context on first `pointerdown` `{once: true}`.
- [ ] Create `src/render/particles.mjs`: simple array-pooled particle system. Default cap 200 active. Emitters: `emitClearBurst(x, y)` for move activations, `emitWinBurst()` for level-won. If `prefersReducedMotion()` is true, all emitters are no-ops. **Perf degradation** (closes R-12): `src/loop.mjs` FPS sampler tracks a rolling 2-second window. On sustained `< 45fps for 2s`, set `window.__perfMode = 'reduced'`, and the particle cap drops 200 -> 50; `COLOR_STEPS` effectively drops from 11 to 6 by rounding the LUT index as `Math.round((1 - h) * 5) * 2` (still uses the same 11-entry LUT but only 6 distinct values). On `>= 55fps for 2s`, restore `window.__perfMode = 'normal'`. Expose `window.__perfMode` for e2e assertion.
- [ ] `src/a11y.mjs` exporting `prefersReducedMotion()` and `prefersColorSchemeDark()`: honor the `reducedMotion` setting override (`auto | force-off | force-on`). Respect `prefers-color-scheme` for the palette in `style.css` (already plumbed in Phase 1; verify WCAG AA contrast for HUD text against both backgrounds).
- [ ] **ARIA live region finalize**: verify the Phase 3 HUD live region is wired and emits text updates on energy thresholds and level-won. Add test in `e2e/av.spec.mjs`.
- [ ] Haptics wiring (final): on grass touch (first frame of a new sweep, not every swept cell), `vibrate(8)`; on pet, `vibrate(25)`; on bite, `vibrate(15)`. All gated through `src/haptics.mjs` from Phase 4 (which already no-ops when `navigator.vibrate` is undefined -- Safari/iOS path).
- [ ] Credit line: in a small About link accessible from the settings panel, render "Audio generated with ElevenLabs. Art generated with OpenAI gpt-image-1." (satisfies ElevenLabs free-tier attribution).
- [ ] Unit tests in `test/assets.test.mjs`, `test/audio.test.mjs`, `test/particles.test.mjs`:
  - Asset loader states: `'loading' | 'ready' | 'error'` transition on mocked fetches.
  - Audio manager: `setMusicVolume(0)` mutes; `setMusicVolume(100)` unmutes; `muteAll` overrides.
  - Particle emitter: cap of 200 enforced; reduced-motion returns 0 emitted.
  - Perf mode toggle: simulate fps=30 for 120 frames; assert `window.__perfMode === 'reduced'`; simulate fps=60 for 120 frames; assert back to `'normal'`.
- [ ] E2E test `e2e/av.spec.mjs`:
  - Load page, click Start (triggers pointerdown -> audio unlock), assert `await page.evaluate(() => window.__audio.ctx.state === 'running')`.
  - Assert no 404s in `page.on('response')` for paths under `/assets/`.
  - Assert `du -sh assets/` via a Node-side check reads `<= 8 * 1024 * 1024` bytes (using `fs.statSync` across the assets directory).
  - ARIA live region: force energy to 50% of threshold; assert `document.querySelector('[aria-live="polite"]').textContent` updated.
  - **Haptics spy is only attached on chromium project** (closes DA-8): use `test.skip(project.name !== 'chromium', ...)` to gate. On chromium, spy on `navigator.vibrate` and assert it's called with duration 8 on grass-touch. On mobile-safari, only assert `navigator.vibrate` is undefined and `vibrate(x)` does not throw.
- [ ] Manual playwright-cli: play through a level with audio on, verify title music fades to gameplay music on Start, SFX plays on grass touch, level-won arpeggio plays on win.

### Design & Constraints

**Asset budget** (enforced): `du -sb assets/` after resize must be `<= 8 * 1024 * 1024 = 8388608` bytes. Acceptance criterion checks this. Fallback order if breached: transcode music to 80kbps -> downscale tiles to 96x96 -> swap og-image to JPEG.

**OffscreenCanvas fallback** (closes R-11; used by Phase 7 scorecard, spec'd here so Phase 6's a11y pass can reference it):

```js
// src/util/canvas-util.mjs (new)
export function makeOffscreenCanvas(w, h) {
  return typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
}
export async function canvasToPngBlob(c) {
  return c.convertToBlob
    ? await c.convertToBlob({ type: 'image/png' })
    : await new Promise(r => c.toBlob(r, 'image/png'));
}
```

**`scripts/resize-assets.py`** (verbatim skeleton):

```python
#!/usr/bin/env python3
# Build-time tool: resizes imagegen outputs to final game asset sizes.
# Requires: pip install --user Pillow
# Usage: python3 scripts/resize-assets.py
from PIL import Image
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1] / 'assets'

# (glob, target_size) pairs
TARGETS = [
    ('tiles/*.png', (128, 128)),
    ('sprites/*.png', (128, 128)),
    ('ui/*.png', (128, 128)),
    ('effects/level-won-burst.png', (512, 512)),
    ('backgrounds/og-image.png', (1200, 630)),
    # title.png stays 1536x1024 -- no resize entry
]

def resize_one(path: Path, target):
    img = Image.open(path)
    if img.size == target:
        return
    # For non-square targets (og-image), center-crop then resize
    if target[0] != target[1] and img.size[0] / img.size[1] != target[0] / target[1]:
        # center-crop
        tw, th = target
        iw, ih = img.size
        ratio = max(tw / iw, th / ih)
        nw, nh = int(iw * ratio), int(ih * ratio)
        img = img.resize((nw, nh), Image.LANCZOS)
        left = (nw - tw) // 2; top = (nh - th) // 2
        img = img.crop((left, top, left + tw, top + th))
    else:
        img = img.resize(target, Image.LANCZOS)
    img.save(path, optimize=True)

for glob, size in TARGETS:
    for p in ROOT.glob(glob):
        resize_one(p, size)
        print(f'resized {p.relative_to(ROOT.parent)} -> {size}')
```

**Music looping technique**: prefer `AudioBufferSourceNode` with `loop=true`, `loopStart=0`, `loopEnd=buffer.duration`. Fallback `<audio loop>` tag only if buffer decoding fails.

**Pitch-by-height formula** (grass-touch SFX, verbatim): `playbackRate = 0.8 + 0.4 * h_at_touch`.

**Reduced motion**: particles disabled; level-won overlay fade shortened from 300ms to 0ms; HUD energy bar transitions use `transition: none` when active.

**Perf degradation thresholds** (verbatim): sustained-average FPS sample over 2s window. `< 45 fps` -> reduced mode (particle cap 50, COLOR_STEPS-effective 6). `>= 55 fps` -> normal mode (cap 200, steps 11). Exposed as `window.__perfMode in { 'normal', 'reduced' }`.

### Acceptance Criteria

- [ ] All 20 images listed exist under `assets/` and load without 404 (verified in e2e response listener).
- [ ] All 9 audio files listed exist under `assets/` and decode successfully.
- [ ] `du -sb assets/` reports <= 8 MB; if not, the fallback notes in the Phase 6 report document which reductions were applied.
- [ ] AudioContext is suspended before any user gesture and running after the first pointerdown.
- [ ] Music cross-fades between title and gameplay.
- [ ] Settings volume sliders affect audible output live (manual).
- [ ] With `reducedMotion = force-on`, particle count observed in a frame is 0.
- [ ] HUD text passes WCAG AA contrast (>= 4.5:1) in both light and dark palette.
- [ ] ARIA live region emits text on energy-milestone and level-won (e2e assertion).
- [ ] Perf mode: forcing fps < 45 for 2s sets `window.__perfMode === 'reduced'`; restoring sets it back to `'normal'`.
- [ ] Haptics test: chromium project asserts `navigator.vibrate` called with 8/15/25 at the right events; mobile-safari project asserts `navigator.vibrate === undefined` and no throw.
- [ ] About credits line mentions ElevenLabs and OpenAI gpt-image-1.
- [ ] All unit + e2e tests in this phase pass.
- [ ] Manual playwright-cli walkthrough confirms audio and art feel correct.

### Dependencies

Phase 5 (species list finalized so sprite and SFX prompts are exhaustive).

## Phase 7 -- High Score, Insect Farm, Share, Deep Link, CI

### Goal

Ship the meta features that make Touch Grass repeatable and viral: per-level and all-time high-scores, the insect farm screen with idle animations, shareable 1200x630 scorecard with the Web Share API fallback chain, deep-link challenges via URL params, and a green CI run on a real PR. Because storage consolidation landed in Phase 4, Phase 7 adds `highscores` fields to the existing `touchgrass.v1` object without any migration code.

### Work Items

- [ ] Create `src/score.mjs` exporting `computeScore({ level, energyAtWin, parTimeSec, elapsedSec, petsThisLevel })`:
  ```js
  export function computeScore({ level, energyAtWin, parTimeSec, elapsedSec, petsThisLevel }) {
    const timeBonus = elapsedSec < parTimeSec ? Math.round((parTimeSec - elapsedSec) * 5) : 0;
    return level * 100 + Math.round(energyAtWin * 2) + timeBonus + petsThisLevel * 10;
  }
  ```
  `parTimeSec` is per level (table in Design & Constraints).
- [ ] **No migration step needed**. Storage already consolidated in Phase 4. Phase 7 simply calls `storage.writeState({ highscores: { ... } })`. `src/storage.mjs`'s `migrate()` function remains a no-op for v1.
- [ ] Create `src/ui/farm.mjs`: full-screen grid of petted species cards. Reads via `storage.readState().farm`. Each card: sprite (from `assets/sprites/<id>.png`), name, first-met date, pet count. Empty-state when `Object.keys(farm).length === 0`: centered illustration + text "Tap friendly bugs to add them!". Idle animation: each sprite bobbles (2px vertical sine, 1.5s period). Close button (`data-testid="btn-farm-close"`) returns to title. A share button (`data-testid="btn-share"`) invokes `src/share/flow.mjs`. **Unknown species handling**: if a farm entry's id is not in `SPECIES`, the card is omitted and a one-time `console.info` logs the orphan id (migrate should have dropped it; defense in depth).
- [ ] Create `src/share/scorecard.mjs`: `async function renderScorecard({ level, score, pets }): Promise<Blob>`. Uses `makeOffscreenCanvas(1200, 630)` from `src/util/canvas-util.mjs` (introduced in Phase 6 Design & Constraints) and `canvasToPngBlob` for the fallback. Draws title-font "Touch Grass" header, big score, level, up to 3 petted species sprite thumbs, and a deep-link URL.
- [ ] Create `src/share/flow.mjs` exporting `async function share({ score, level, petSpecies })`:
  ```js
  export async function share({ score, level, petSpecies }) {
    const png = await renderScorecard({ level, score, pets: petSpecies });
    const file = new File([png], 'touch-grass-score.png', { type: 'image/png' });
    const url = buildDeepLink({ score, level, name: 'A friend' });
    const text = `I scored ${score} on level ${level} of Touch Grass. Beat me?`;
    // 1: native share with file
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Touch Grass', text, url }); return 'share-files'; }
      catch (e) {
        // AbortError means the user cancelled -- do NOT fall through.
        if (e && e.name === 'AbortError') return 'share-aborted';
        // Other errors (NotAllowedError on iOS WebView, browser bugs): fall through to tier 2.
      }
    }
    // 2: native share text+url
    if (navigator.share) {
      try { await navigator.share({ title: 'Touch Grass', text, url }); return 'share-text'; }
      catch (e) {
        if (e && e.name === 'AbortError') return 'share-aborted';
        // fall through
      }
    }
    // 3: clipboard + toast
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text + ' ' + url); toast('Copied to clipboard!'); return 'clipboard'; } catch {}
    }
    // 4: <a download> + copy URL button in a modal
    return openDownloadModal(file, url);
  }
  ```
  **AbortError handling** (closes DA-10): `navigator.canShare({files})` returning true does not guarantee `navigator.share({files})` will resolve -- iOS Safari in WebView, Chrome Android in some PWA contexts, and certain headless browsers can still reject with `NotAllowedError`. The try/catch distinguishes `AbortError` (user intentionally cancelled -- returns `'share-aborted'` without falling through) from other errors (fall through to the next tier).
- [ ] Deep-link parsing in `src/main.mjs`: on load, `const params = new URLSearchParams(location.search);` if `params.has('score') && params.has('level')`, show a blocking title overlay: "<name> scored <score> on Level <level>. Beat them?" with Play (`data-testid="btn-deep-link-play"`) / Dismiss (`data-testid="btn-deep-link-dismiss"`) buttons. On dismiss, replace URL with `history.replaceState({}, '', location.pathname)` and fall through to normal title. Note: the dev-level-skip param from Phase 1 (`?dev=1&level=N`) is parsed by the SAME `URLSearchParams` pass and takes precedence when the `dev` guard matches.
- [ ] `buildDeepLink({ score, level, name })`: returns the current origin + pathname + `?score=<N>&level=<M>&name=<urlencoded>`.
- [ ] OG meta tags in `index.html`:
  ```html
  <meta property="og:title" content="Touch Grass">
  <meta property="og:description" content="A web relaxation game. Sweep grass, bank energy, pet bugs.">
  <meta property="og:image" content="./assets/backgrounds/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  ```
- [ ] Update CLAUDE.md Architecture section to reflect the full src/ tree as of Phase 7 (all modules created across phases 1-7).
- [ ] CI finalize: confirm `.github/workflows/ci.yml` (from Phase 1) runs green against a real PR. If no git remote is configured at this point, add a note in the plan and provide the commands in Design & Constraints so the user can push when ready. Do NOT block plan completion on a remote being present.
- [ ] Unit tests in `test/score.test.mjs`, `test/share.test.mjs`, `test/deeplink.test.mjs`:
  - Score formula: hand-computed cases for a few input tuples.
  - Share payload: `canShare({files})` returns true (stub) -> path `'share-files'`; returns false -> path falls through to `'share-text'`; neither available -> `'clipboard'`; none -> `'download'`.
  - Deep-link parser: `?score=123&level=3&name=Alice` yields `{score: 123, level: 3, name: 'Alice'}`; missing/invalid returns null.
  - Farm state shape: `Object.keys` equals pet species ids; values have `firstMet` + `petCount`.
  - Farm orphan filter: seed state with an unknown species id; `readState` drops it (migration test already in Phase 5 asserts migrate; Phase 7 tests the UI behavior: unknown id -> card omitted + `console.info` call).
- [ ] E2E tests in `e2e/share.spec.mjs` and `e2e/deeplink.spec.mjs`:
  - Finish a level (programmatically), trigger share; stub `navigator.share` with `page.addInitScript`; assert it was called with the expected payload shape.
  - Reload with `?score=999&level=5&name=Test` in URL; assert the challenge overlay is visible with "Test scored 999 on Level 5".
- [ ] Manual playwright-cli: complete a level, pet a bug, visit the farm screen, trigger share (should fall through to clipboard in headless), take a screenshot of the scorecard via `renderScorecard` invoked from devtools.

### Design & Constraints

**Per-level par times** (seconds) used by `timeBonus`:

| Level | par |
|-------|-----|
| 1 | 45 |
| 2 | 50 |
| 3 | 55 |
| 4 | 75 |
| 5 | 80 |
| 6 | 90 |
| 7 | 95 |
| 8 | 100 |
| 9 | 110 |
| 10 | 120 |
| 11 | 130 |
| 12 | 140 |
| 13 | 150 |
| 14 | 160 |
| 15 | 175 |

**Score formula** (verbatim):
```
score = level * 100
      + round(energyAtWin * 2)
      + (elapsedSec < parTimeSec ? round((parTimeSec - elapsedSec) * 5) : 0)
      + petsThisLevel * 10
```

**Storage key** (invariant repeated): only `touchgrass.v1` is read or written. No legacy keys are touched because Phase 4 established consolidation from the start.

**Remote-push docs** (if no remote yet, print these in the phase report):
```
git remote add origin git@github.com:<user>/touchgrass.git
git push -u origin main
git checkout -b feature/phase-7
gh pr create --title "Phase 7: meta features" --body "..."
# Wait for CI green, then merge.
```

### Acceptance Criteria

- [ ] Score for a hand-computed case matches: `level=1, energyAtWin=60, parTimeSec=45, elapsedSec=30, petsThisLevel=1` -> `100 + 120 + 75 + 10 = 305`.
- [ ] `highscores` is written to `touchgrass.v1` via `storage.writeState`. No `touchgrass.v1.highscores`, `touchgrass.v1.settings`, `touchgrass.v1.farm`, or `touchgrass.v1.progress` keys are ever created.
- [ ] Farm screen shows petted species with sprite + first-met date + pet count; empty state renders when none; unknown species ids are omitted and logged.
- [ ] Farm sprites exhibit a 2px sine bobble with 1.5s period (visual; verified by unit test on the animation helper).
- [ ] Share flow: `navigator.share` with files is attempted first; falls back through text+url, clipboard, and download modal in that order.
- [ ] Deep-link: reloading with `?score&level&name` shows the challenge overlay; dismissing replaces the URL.
- [ ] OG meta tags present in `index.html`; the `og:image` path resolves (no 404).
- [ ] CI workflow runs and passes against a real PR (or: plan notes document the exact steps for the user to complete this once a remote is added, and all tests pass locally).
- [ ] CLAUDE.md architecture section reflects the final src/ tree.
- [ ] All unit tests pass; e2e `e2e/share.spec.mjs` and `e2e/deeplink.spec.mjs` pass.
- [ ] Manual: scorecard PNG visually correct and contains level + score + URL.

### Dependencies

Phase 6 (sprites and OG image generated; farm screen references `assets/sprites/<id>.png` and the scorecard references the title font + sprites; `src/util/canvas-util.mjs` exists).

## Phase 8 -- Pre-Release Verification & Release

### Goal

Exercise the fully built game across orientation, mobile performance under throttling, touch-target ergonomics, aesthetic sign-off of imagegen/audiogen outputs, and a real-device best-effort pass. Every earlier phase authored its cross-cutting behavior (safe-area insets in Phase 1, resize handler in Phase 2, data-testids across Phases 1/3/4/7, dev level-skip in Phase 1/3). Phase 8 is pure verification and does not modify source files under `src/`. The phase's deliverables are E2E tests in `e2e/`, review markdown artifacts under `reports/playtest-<date>/`, and a final commit flipping the plan's `status` to `complete`.

### Work Items

- [ ] **Verify safe-area insets** (source authored in Phase 1 `src/style.css`): add an E2E test `e2e/safe-area.spec.mjs` that navigates to the title, queries `getComputedStyle(document.querySelector('#app'))`, and asserts each of `padding-top`, `padding-right`, `padding-bottom`, `padding-left` is a non-empty value that matches `/env\(|\d+px/`. Note (closes R-2 / DA-4): Playwright device emulation does NOT produce non-zero safe-area-inset values (verified via `grep "safe-area" /usr/local/share/nvm/versions/node/v22.22.2/lib/node_modules/@playwright/cli/node_modules/playwright-core/lib/server/deviceDescriptorsSource.json` -> 0 matches; the iPhone 13 Pro descriptor sets viewport + UA + DPR but not inset envs). The test therefore verifies that the CSS DECLARATION is present and uses `env(safe-area-inset-*)`, not that the rendered inset is non-zero. Real-device inset rendering is the domain of the real-device artifact below. This is a source-level correctness check, not a runtime-rendering check.
- [ ] **Verify orientation/resize handler** (source authored in Phase 2 `src/render/canvas.mjs`): add an E2E test `e2e/orientation.spec.mjs` that swaps viewport dims mid-level via `page.setViewportSize({ width: 844, height: 390 })` (iPhone 13 Pro portrait->landscape) and asserts (a) the `resize` listener fires (spy via `page.evaluate(() => window.__game.layout)` before/after, values differ), (b) canvas element `clientWidth`/`clientHeight` match the new viewport after HUD reservation, (c) no overflow (`document.body.scrollHeight <= innerHeight + 2`). Note (closes R-14): `page.setViewportSize` does NOT fire `orientationchange` or update `screen.orientation.type`; this test exercises the resize-handler path, not the orientation-API path. Real `orientationchange` handling is verified on real-device only.
- [ ] **Touch-target audit E2E** (`e2e/touch-targets.spec.mjs`): enumerate the Phase 1 data-testid registry verbatim and assert each selector's bounding rect `width >= 48 && height >= 48` CSS px on the `mobile-safari` project viewport. For elements that are only visible in certain states (level-won Next, pause overlay, settings modal, farm screen, deep-link overlay), the test drives the game to each state via the dev level-skip backdoor (`?dev=1&level=5`) + programmatic state transitions, then asserts. All 17 testids from the Phase 1 convention block are enumerated. If a testid is missing from the DOM when expected, the test fails with a clear "missing testid: <id> in state <state>" message pointing to the owning phase for the fix.
- [ ] **Mobile performance check** (closes R-1 / R-8 / DA-1): add a NEW Playwright project `chromium-mobile` configured as `{ name: 'chromium-mobile', use: { ...devices['Pixel 5'] } }` in `playwright.config.mjs` (patch, not rewrite). CDP is Chromium-only -- verified via `/usr/local/share/nvm/versions/node/v22.22.2/lib/node_modules/@playwright/cli/node_modules/playwright-core/lib/coreBundle.js:47800-47802` which throws `CDP session is only available in Chromium` from WebKit contexts -- so the throttled-perf test runs under the `chromium-mobile` project. The `mobile-safari` (WebKit) project continues to exist for touch-event + CSS behavior verification; it is NOT used for CPU throttling. E2E test `e2e/perf.spec.mjs`:
  ```js
  test.skip(({ project }) => project.name !== 'chromium-mobile');
  test('mobile perf under 4x CPU throttling, level 15', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page); // correct Playwright API
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/?dev=1&level=15'); // largest grid: 36x36 irregular octagon, 1176 valid cells
    await page.waitForFunction(() => window.__game?.grid?.valid);
    // 10-second synthetic sweep across the canvas
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.down();
    for (let t = 0; t < 10000; t += 50) {
      const x = box.x + (box.width - 20) * (Math.sin(t / 400) * 0.5 + 0.5) + 10;
      const y = box.y + (box.height - 20) * (Math.cos(t / 300) * 0.5 + 0.5) + 10;
      await page.mouse.move(x, y);
      await page.waitForTimeout(50);
    }
    await page.mouse.up();
    const avgFrameMs = await page.evaluate(() => window.__game.loop.getAvgFrameMs(2000));
    // >= 45fps = avgFrameMs <= 22; allow Phase 6 perf-mode to recover if first read fails
    if (avgFrameMs > 22) {
      await page.waitForTimeout(2000); // allow perf-mode to kick in (particle cap 200 -> 50)
      const avgFrameMs2 = await page.evaluate(() => window.__game.loop.getAvgFrameMs(2000));
      expect(avgFrameMs2).toBeLessThan(22);
      expect(await page.evaluate(() => window.__perfMode)).toBe('reduced');
    } else {
      expect(avgFrameMs).toBeLessThan(22);
    }
  });
  ```
  Level 15 (not 10) is the largest grid per Phase 3 progression table (L15: 36x36 irregular octagon, 1176 valid cells; L10 is 29x29 / 841 cells -- closes R-3 / DA-2). The `chromium-mobile` project is gated by `test.skip(project.name !== 'chromium-mobile')` so the test does not run on the WebKit `mobile-safari` project (which lacks CDP) or on desktop `chromium`. Note: because all E2E tests are shared across projects unless skipped, ALL existing E2E tests need either a `test.skip(project.name === 'chromium-mobile', ...)` gate OR must be project-agnostic. Phase 8 audits existing e2e specs and adds the gate where mobile emulation would cause flakiness.
- [ ] **Full playthrough via playwright-cli** (manual, real events only): play through levels 1, 5, 10, and 15 end-to-end using `playwright-cli` with real `mousedown`/`mousemove`/`mouseup` (or touch equivalents via `page.touchscreen` when on `mobile-safari`). NO `page.evaluate` shortcuts for gameplay INPUT -- per `/manual-testing` discipline. Level navigation MAY use the `?dev=1&level=N` backdoor (the backdoor only bypasses title->playing; all gameplay interaction must be real pointer events). At each level: (a) screenshot the title/pre-game, (b) screenshot mid-sweep, (c) screenshot the level-won overlay. Save all screenshots to `reports/playtest-<yyyy-mm-dd>/levels/L<N>/`. Expected wall-clock: ~8 minutes total (par times L1=45s + L5=80s + L10=120s + L15=175s = 420s plus overhead).
- [ ] **Screenshot gallery (all 15 levels)**: a scripted helper `e2e/screenshot-gallery.spec.mjs` that opens `?dev=1&level=N` for each N in 1..15, runs a 5-second synthetic sweep for visual variety, takes a screenshot to `reports/playtest-<yyyy-mm-dd>/levels/L<NN>.png`, and moves to the next. Total wall-clock: ~2-3 minutes (15 * ~10s each). This replaces the earlier "contiguous playthrough" requirement (infeasible at ~26 minutes of real events, per R-7 / DA-12). Each screenshot is reviewed manually for visual bugs: polygon shape matches mini-map, grass types render distinctly (TALL vs SHORT vs STIFF vs FLOWERED), HUD readable, no clipping. Document failures in `reports/playtest-<yyyy-mm-dd>/gallery-review.md`.
- [ ] **Aesthetic review of imagegen assets** (concrete rubric; closes DA-11): for every file under `assets/sprites/`, `assets/tiles/`, `assets/ui/`, `assets/backgrounds/`, use the Read tool (multimodal LLM reads the PNG as an image) and evaluate against this explicit pass/fail checklist:
  1. **Subject correctness**: sprite species has correct anatomy (ladybug = 6 legs + 2 antennae, not 8; butterfly = 4 wings; snail = 1 shell; ant = 3 segments + 6 legs; bee/wasp = stripes + wings).
  2. **No text garbage**: unless the asset is the `og-image.png` (which intentionally contains the title text), there is NO embedded text, numbers, or watermarks anywhere in the image.
  3. **No rendering artifacts**: no extra limbs, no cursed faces (eyes not pointing in wildly different directions, no melted features), no physically-impossible asymmetries.
  4. **Correct transparency**: for sprites/tiles/icons, the background IS transparent (alpha channel present; visible as checkerboard when opened in an image viewer; corner pixels have alpha=0).
  5. **Style consistency**: the asset visually matches `assets/sprites/ladybug.png` (the style reference) in line weight, color saturation, and painterliness. Outliers (e.g., a photorealistic sprite in a cartoon set) fail.
  6. **Readable at final downsampled size**: open the post-resize 128x128 PNG and verify the subject is still recognizable (not mushy, not aliased into unreadability). Test: if a user cannot identify the species from the 128x128 in <2 seconds, it fails.
  For each asset, record PASS/FAIL per criterion + one-line rationale in `reports/playtest-<yyyy-mm-dd>/asset-review.md`. Any FAIL triggers a regeneration (`/imagegen try again` on that specific path) with optional prompt refinement. Re-verify. Note: visual-regression baselines (comparing new rolls to a committed prior-accepted state) are deferred to future work -- the v1 bar is the rubric above, not pixel diffs.
- [ ] **Audio review** (concrete rubric): for every file under `assets/music/` and `assets/sfx/`, the reviewer plays through the asset (manually or via `aplay`/`afplay`/a browser tab) and evaluates:
  1. **Clips and pops**: no audible clicks at the start or end of the clip.
  2. **Seamless loop (music only)**: `music/title.mp3` and `music/gameplay.mp3` should loop imperceptibly when `AudioBufferSourceNode.loop = true` (test: loop for 30 seconds, listen for a discontinuity at the seam -- there should be none or a nearly-imperceptible one).
  3. **Tonal fit**: grass-touch SFX = soft, not shrill; bite SFX = gentle "oof", not harsh; pet SFX = friendly chirp, cute; level-won = uplifting, short.
  4. **Volume consistency**: no one clip is dramatically louder or quieter than the rest at default `settings.sfx = 80`.
  Record PASS/FAIL per criterion in `reports/playtest-<yyyy-mm-dd>/audio-review.md`; regenerate via `/audiogen music/sfx <prompt> <flags>` on any FAIL.
- [ ] **Real-device best-effort**: start a LAN-accessible dev server (`python3 -m http.server $DEV_PORT` already listens on all interfaces by default -- no `--bind` needed, per `python3 -m http.server --help`, which defaults `--bind ADDRESS = all interfaces` -- closes R-15), and discover the host's LAN IP using a portable command: Linux `hostname -I`, macOS `ipconfig getifaddr en0`, Windows `ipconfig | findstr IPv4`. Open `http://<LAN-IP>:$DEV_PORT` on an actual iOS or Android phone and complete level 1. Verify safe-area insets render non-zero on the notched device (the one test the Playwright emulation cannot do). If no device is available, write `reports/playtest-<yyyy-mm-dd>/real-device.md` with "real-device test skipped: no device available" + the LAN URL + the portable-command incantation for whichever platform the tester is on. The artifact file MUST exist; test completion is best-effort. Note (closes DA-17): the Phase 1 zskills-config `dev_server.cmd` is `python3 -m http.server $DEV_PORT` -- no `--bind` override, no port-conflict risk. If the dev server from a previous agent session is still up, reuse it (Playwright's `reuseExistingServer: true` already does this for E2E); the real-device test just points the phone's browser at the existing port.
- [ ] **Commit + status flip**: once all acceptance criteria below pass, commit the Phase 8 artifacts (E2E test files, review markdown files) and flip the plan's frontmatter `status: active` -> `status: complete`. Document any pre-release issues found and deferred in `reports/playtest-<yyyy-mm-dd>/deferred.md`.

### Design & Constraints

**Phase 8 authors no `src/` changes.** It only adds `e2e/*.spec.mjs` tests, `reports/playtest-<date>/*.md` review artifacts, and a one-line project addition to `playwright.config.mjs` (the `chromium-mobile` project).

**New Playwright project in `playwright.config.mjs`** (patch, not rewrite):
```js
projects: [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'mobile-safari', use: devices['iPhone 12'] },
  { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },  // Phase 8 addition for CDP-throttled perf tests
],
```
Audit existing E2E tests for project-skip compatibility: any test that uses Playwright's `page.touchscreen` tap+touch APIs in a way that breaks on `Pixel 5` should add `test.skip(project.name === 'chromium-mobile', '<reason>')`. The haptics test from Phase 6 already has `test.skip(project.name !== 'chromium', ...)` and therefore trivially skips on `chromium-mobile` too; verify and document (closes R-13).

**`window.__game.loop.getAvgFrameMs(windowMs)`**: returns rolling average frame time over the last `windowMs` milliseconds; already wired in Phase 1 `src/loop.mjs` FPS sampler -- Phase 8 just consumes it.

**Real-device LAN-IP portable commands** (pick one per platform):
- Linux (this dev container): `hostname -I` (verified works: `172.17.0.5`)
- macOS: `ipconfig getifaddr en0` (or `en1` for Wi-Fi on older setups; `ifconfig | grep inet` as fallback)
- Windows: `ipconfig | findstr IPv4` (or `Get-NetIPAddress -AddressFamily IPv4` in PowerShell)

**Data-testid registry** (reference; authored in Phase 1 Design & Constraints): Phase 8 enumerates exactly the testids listed in that table (17 entries) and asserts each. No Phase 8 authoring of new testids.

**Aesthetic-review rubric** (reference): 6 criteria per asset -- subject correctness, no-text-garbage, no-rendering-artifacts, transparency, style consistency, readable-at-final-size. All 6 must PASS for an asset to be accepted.

### Acceptance Criteria

- [ ] `e2e/safe-area.spec.mjs` passes on chromium + mobile-safari projects; confirms `#app` uses `env(safe-area-inset-*)` declarations. (Source-level check; real-device inset rendering is in the real-device.md artifact.)
- [ ] `e2e/orientation.spec.mjs` passes: viewport dim-swap from portrait (390x844) to landscape (844x390) triggers resize; canvas + HUD layout metrics update; no document overflow.
- [ ] `e2e/touch-targets.spec.mjs` passes: all 17 data-testids from the Phase 1 registry are present in their respective DOM states and each has bounding-rect width >= 48 && height >= 48 on the `mobile-safari` viewport.
- [ ] `e2e/perf.spec.mjs` passes on the `chromium-mobile` project: level 15 (36x36 irregular octagon, 1176 valid cells) under 4x CPU throttle sustains `avgFrameMs < 22` either immediately OR after Phase 6 perf-mode kicks in within 2 seconds (in which case `window.__perfMode === 'reduced'`).
- [ ] Playwright-cli playthrough of levels 1, 5, 10, 15 completed with real mouse/touch events; screenshots exist under `reports/playtest-<yyyy-mm-dd>/levels/L<N>/`.
- [ ] `e2e/screenshot-gallery.spec.mjs` produces `reports/playtest-<yyyy-mm-dd>/levels/L01.png` through `L15.png`; each reviewed manually; `reports/playtest-<yyyy-mm-dd>/gallery-review.md` records any visual failures + regeneration actions.
- [ ] `reports/playtest-<yyyy-mm-dd>/asset-review.md` exists; every generated asset is listed with 6-criterion PASS/FAIL; all final assets PASS (regenerated if needed).
- [ ] `reports/playtest-<yyyy-mm-dd>/audio-review.md` exists; every generated audio clip is listed with 4-criterion PASS/FAIL; all final clips PASS.
- [ ] `reports/playtest-<yyyy-mm-dd>/real-device.md` exists (either with a completed level-1-on-device log or a skip notice + LAN URL + portable-command reference).
- [ ] `playwright.config.mjs` has a third project `chromium-mobile` with `devices['Pixel 5']`; existing tests are audited for project-skip compatibility with a note per skip.
- [ ] Plan frontmatter `status: active` is flipped to `status: complete` in the final Phase 8 commit.

### Dependencies

Phase 7 (score, farm, share, deep-link, CI all exist -- Phase 8 only verifies). Phase 1-6 provide the authored source behaviors that Phase 8 checks. The dev level-skip from Phase 1 + Phase 3 is required for the screenshot gallery and perf test.

## Plan Quality

**Drafting process:** /draft-plan with 3 max rounds; converged in round 1.
**Convergence:** Converged at round 1 -- refiner verified every finding's evidence, applied 38 fixes and 1 justified-not-fix (R-19 retracted by reviewer), and self-reports 0 substantive issues remaining. No round-2 review was dispatched because every finding had either a `Verified` anchor now addressed in the plan or a documented Not-reproduced justification.
**Remaining concerns:** None. Two items to note for execution rather than planning: (1) no `origin` remote is configured -- Phase 7 creates the CI workflow file but `gh pr create` will fail until a GitHub remote is attached; (2) imagegen/audiogen cost is bounded by Phase 6's low-quality-first strategy but still requires OPENAI_API_KEY + ELEVENLABS_API_KEY spend -- confirm budget before running Phase 6.

### Round History

| Round | Reviewer Findings | Devil's Advocate Findings | Resolved |
|-------|-------------------|---------------------------|----------|
| 1     | 22 (18 substantive) | 17 (14 substantive)     | 38/39 fixed; 1/39 justified (R-19 retracted); 0 deferred |

### Round 1 Disposition

| ID | Title | Severity | Evidence | Disposition |
|----|-------|----------|----------|-------------|
| R-1 | Energy-threshold figures don't match formula | critical | Verified | Fixed -- recomputed validCells and avgMult for every level from the canonical polygon vertices using a ray-cast reproducer; threshold column is now the derived value and Phase 3 has a unit test asserting table <-> formula consistency. |
| R-2 | Stiff-grass `hue` conflicts with LUT | major | Verified | Fixed -- dropped the `hue` field from GRASS_TYPES; explicit note in Phase 2 and 3 that grass-type visual differentiation is overlay-only (petals/outline/height); the shared green-to-gold LUT applies to all types. |
| R-3 | `types` array versioning across phases | major | Verified | Fixed -- moved `types: Uint8Array` declaration into the Phase 2 constructor (all zeros = DEFAULT); Phase 3 explicitly states the constructor signature is unchanged; Phase 2 tests pass unchanged. |
| R-4 | CLAUDE.md TODO markers never filled | major | Verified | Fixed -- added a Phase 1 work item to patch all six TODO markers with real commands and an end-of-Phase-7 Architecture update. |
| R-5 | `scripts/test-all.sh` rewrite throws away `has_changed_source_files` gate | major | Verified | Fixed -- Phase 1 now PATCHES the existing scaffold (token substitution + globstar enable) rather than rewriting it; gate is preserved. |
| R-6 | Polygon area 1% tolerance too tight | major | Verified | Fixed -- acceptance criterion changed to "grid.valid count equals computed cell-center count exactly (integer equality)"; Phase 3 unit test computes the canonical count via the same reproducer the progression table uses, so the integer is definitionally achievable. |
| R-7 | Win-condition branch ordering unclear | minor | Verified | Fixed -- added explicit ordering-note comment to the snippet. |
| R-8 | `dt` clamp easy to misread | minor | Verified | Fixed -- added `// clamp at 50ms wall time, convert to seconds` parenthetical in Phase 1 code. |
| R-9 | Move trigger ambiguity between ring and full-clear | minor | Verified | Fixed -- Phase 4 moves all trigger uniformly on `pointerdown`; full-clear executes immediately on downdown, ring executes at downed cell, line starts on downdown and completes on pointerup. |
| R-10 | No asset-budget enforcement | minor | Verified | Fixed -- Phase 6 now includes a `du -sb assets/` acceptance criterion (<= 8 MB), a Pillow-based resize script, and a documented fallback ordering. |
| R-11 | OffscreenCanvas fallback underspecified | minor | Verified | Fixed -- added `src/util/canvas-util.mjs` with explicit `makeOffscreenCanvas` + `canvasToPngBlob` pseudocode in Phase 6 Design & Constraints; Phase 7 scorecard uses it. |
| R-12 | FPS sampler doesn't trigger reduced-particle path | minor | Verified | Fixed -- Phase 6 adds perf-mode wiring with explicit 45/55 fps thresholds, 2s window, particle cap 200->50, LUT-step 11->6, and `window.__perfMode` observable + unit test. |
| R-13 | Storage split keys + Phase 7 migration is accidental complexity | major | Verified | Fixed -- `src/storage.mjs` now lands in Phase 4 as the single gateway; Phases 3/4/5/7 all read/write via it; Phase 7 needs no migration code. |
| R-14 | No `.env.example` | minor | Verified | Fixed -- added Phase 1 work item to write `.env.example`. |
| R-15 | Phase 6 oversized | major | Judgment | Fixed -- kept Phase 6 single-phase but added explicit checkpoint guidance (1-2 hr assets, 2-3 hr engine) and a commit-between-checkpoints note; DA-12's low-quality-first style strategy caps imagegen cost. Not splitting because the A/V dependencies (audio engine needs SFX files; particles use assets) are tightly coupled. |
| R-16 | No lint/format config | minor | Verified | Fixed -- Phase 1 adds `.editorconfig` (2-space, LF, final-newline, trim-trailing-whitespace) and an explicit "no linter in v1" note in CLAUDE.md. Closes the decision without introducing an ESLint dep. |
| R-17 | Phase 5 adjacency rule ambiguous | minor | Verified | Fixed -- Phase 5 now specifies Euclidean distance <= 1.5 cells as the single rule; "or adjacent" alternate removed; unit test covers the boundary. |
| R-18 | No ARIA live region | minor | Verified | Fixed -- Phase 3 HUD now includes `<div role="status" aria-live="polite">` updated on 25/50/75/100% energy milestones and level-won; Phase 6 e2e asserts text content updates. |
| R-19 | `chmod +x` AC missing (retracted) | nitpick | Not reproduced | Justified -- reviewer retracted; AC already present at plan line 218 in the prior draft. Preserved in new draft. |
| R-20 | Toughness not reset at level load | major | Verified | Fixed -- `loadLevel` Work Item now explicitly reinitializes `toughness[i] = GRASS_TYPES[types[i]].toughness` per cell; unit test added. |
| R-21 | Test output copy into repo root | minor | Verified | Fixed -- the test-all.sh patch in Phase 1 does NOT copy output into the repo root (removed); `testing.output_file` in zskills-config is now an absolute `/tmp/zskills-tests/touchgrass/.test-results.txt` path. `.test-results.txt` is also in `.gitignore` as defense in depth. |
| R-22 | Armed move + level-won interaction unspecified | minor | Verified | Fixed -- Phase 4 state machine now refunds and clears `armed` on any transition to `level-won` or `paused`; unit test added. |
| DA-1 | Threshold table arithmetically wrong | critical | Verified | Fixed -- same fix as R-1; all 15 thresholds recomputed from the stated formula using a verified ray-cast reproducer. L8 (515 vC, 309.00), L9 (405 vC, 234.90), L10 (841 vC, 454.14), L11 (792 vC, 471.24), L12 (765 vC, 413.10), L13 (1156 vC, 661.81), L14 (860 vC, 488.05), L15 (1176 vC, 658.56) now match. |
| DA-2 | Two-island polygon cannot be represented | major | Verified | Fixed -- `LevelSpec.polygon` renamed to `polygons: Array<Array<[x,y]>>`; `computeValidCells` unions over all polygons; L14 stored as two-element array; unit test covers island inclusion. |
| DA-3 | playwright webServer `${PORT}` string interpolation bug | major | Verified | Fixed -- `playwright.config.mjs` resolves `PORT` at config-load time using `execSync('bash scripts/port.sh')` and uses backtick template strings for command + URL. |
| DA-4 | `reuseExistingServer: !process.env.CI` conflicts with pre-started CI server | major | Verified | Fixed -- set `reuseExistingServer: true` unconditionally AND removed the CI workflow's "Start dev server" step (Playwright's webServer block starts it). Single source of truth. |
| DA-5 | dt-sensitivity test bound 1e-3 unachievable | major | Verified | Fixed -- unit test replaced with closed-form comparison `|h_step - (1 - exp(-r*dt))| < 1e-6` at `dt=1e-3`; the unachievable doubling-dt test is removed. Plan explicitly notes forward Euler has O(dt^2) local error. |
| DA-6 | Globstar off by default -> no-op unit test pass | minor | Verified | Fixed -- `scripts/test-all.sh` patch adds `shopt -s globstar` at the top; `package.json` script and `zskills-config.unit_cmd` also prefix `shopt -s globstar;`. |
| DA-7 | imagegen cannot output 256x256 | major | Verified | Fixed -- accepted 1024x1024 intermediate output; added `scripts/resize-assets.py` (Pillow) as build-time tool; final sizes documented (128x128 for sprites/tiles/icons); Pillow explicitly called out as build-time, not runtime. |
| DA-8 | Vibration API not on Safari | major | Verified | Fixed -- Phase 4 `src/haptics.mjs` guards with `typeof navigator.vibrate === 'function'`; Phase 6 e2e explicitly gates haptics spy to chromium project and asserts `undefined` on mobile-safari. |
| DA-9 | L1 threshold 72 < CLEAR cost 75 | major | Verified | Fixed -- Phase 4 e2e tests CLEAR on L5 (threshold 176.89, plenty of headroom); Design & Constraints documents "CLEAR first affordable on L4+" so designer has a reference. |
| DA-10 | Tap-vs-sweep retrofit of Phase 2 not specified | major | Verified | Fixed -- Phase 5 adds an explicit work item: `touchCells` accepts a `skipCellPredicate`; pointer module builds per-frame union of insect footprints; unit test asserts heights under a petted ladybug unchanged. |
| DA-11 | Phase 7 migration leaves dangling writes in Phase 4/5 code | minor | Verified | Fixed -- storage consolidation moved to Phase 4; Phase 4/5/7 all write through `src/storage.mjs`; no migration path needed; Phase 7 `migrate` is a no-op for v1. |
| DA-12 | imagegen cost-control vague | minor | Verified | Fixed -- Phase 6 specifies: ONE reference sprite (ladybug) at `quality: high`; remaining 15 at `quality: low --image ladybug.png --input-fidelity high`; fallback to individual `high` re-roll only on visual failure. Documented in Style-consistency strategy work item. |
| DA-13 | Haptics/SFX on bite outside gesture | minor | Verified | Fixed -- AI explicitly transitions to `wander` (not bite) if pointer lifts before the 1.5s angry timer; bite therefore always fires while pointer is held -- within the browser's gesture-grace window. Documented as a Phase 5 comment. |
| DA-14 | "Stiff grass needs two sweeps" ambiguous | minor | Verified | Fixed -- Phase 3 spec is now per-gesture via `_lastDecrementGesture` tracking; zigzag within one gesture cannot double-decrement; unit test covers. |
| DA-15 | Unknown species in farm after schema evolution | minor | Verified | Fixed -- `storage.migrate` drops farm entries whose species id is not in `SPECIES`; `src/ui/farm.mjs` also filters at render time as defense in depth; both paths have unit tests. |
| DA-16 | `npx playwright install` without `--with-deps` | minor | Verified | Fixed -- Phase 1 install command is `npx playwright install --with-deps chromium webkit` (matches CI); fallback note covers the sudo-less dev-container case. |
| DA-17 | Multi-touch policy not tested | nitpick | Verified | Fixed -- Phase 2 unit test adds synthesized `pointerId=1` + `pointerId=2` scenario asserting first-pointer-wins. |

## Drift Log

Structural comparison of the plan as originally drafted vs current state after /refine-plan round 1.

**Prior plan state:** /draft-plan output (1009 lines, 7 phases, no completed phases).
**Interim state:** after /draft-plan round 1 (1009 lines), a post-convergence Phase 7 "Pre-release verification (cross-cutting)" subsection of 9 work items + 9 ACs was appended (bringing the plan to 1038 lines) -- this addition was never adversarially reviewed by the draft-plan rounds, which is why /refine-plan ran.
**Current state:** 8 phases (Phase 7 split into Phase 7 meta features + Phase 8 pre-release verification), 1 consolidated data-testid registry in Phase 1, cross-cutting work items relocated to owning source phases (safe-area -> Phase 1, resize handler -> Phase 2, testids -> Phases 1/3/4/7, dev level-skip -> Phase 1/3).

| Phase | Planned (draft) | Actual (after refine r1) | Delta |
|-------|-----------------|--------------------------|-------|
| 1 | Foundation, harness, title | Foundation, harness, title, **safe-area CSS authored**, **data-testid convention authored**, **dev level-skip URL param stub** | Additions pre-empt Phase 8 retrofits |
| 2 | Grass model, rendering, sweep | Grass model, rendering, sweep, **first-class resize/orientation handler with layout-changed event**, **layout.cellPx + hudOffsetPx on window.__game** | Resize handler is now a real work item, not a one-liner |
| 3 | Levels, polygons, energy, win, progression | Same, plus **inline progress-write uses consolidated `touchgrass.v1` key** (no second key), **`window.__game.loadLevel` exposed** for Phase 1 dev-skip + Phase 8 gallery, **HUD/pause/level-won testids + layout-changed subscriptions** | No more split-key risk; dev-skip now functional |
| 4 | Moves, settings, consolidated storage | Same, plus **armed-move + insect-interaction priority rule**, **moves respect skipCellPredicate for insect footprints**, **toolbar/settings testids** | Covers R-16/DA-7/DA-8 specification gaps |
| 5 | Insects AI, hit-test, tap/sweep | Same, plus **tap-vs-sweep `totalPathPx` unit clarified as CSS pixels**, **friendly-pet hit-test latching at pointerdown** | Covers DA-9/DA-14 |
| 6 | A/V polish | Same, plus **imagegen flag shorthand rewritten to match SKILL.md** (`--size`, `--background transparent`, `--quality`, `--image`, `--input-fidelity`), **audiogen subcommands + real flags** (`music --length-ms --output-format`, `sfx --duration`; no `--looping` flag; loop is engine-side), **share flow AbortError distinguished** | Covers R-10/R-11/DA-10 |
| 7 | **Originally:** meta features + 9 pre-release items bundled | **Now:** meta features only (13 work items); testids on farm/share/deep-link buttons added; pre-release items moved to Phase 8 | Phase 7 wall-clock dropped ~2-4 hr to ~2-3 hr (per DA-16 sizing concern) |
| 8 | **NEW** | Pre-release verification & release: 9 work items including safe-area E2E, orientation E2E, touch-target audit E2E, chromium-mobile perf E2E at level 15 (was 10), playwright-cli playthrough L1/5/10/15, 15-level screenshot gallery via dev-skip, aesthetic review with 6-criterion rubric, audio review with 4-criterion rubric, real-device best-effort, commit + status flip | All pre-release items consolidated; one agent session; authoring vs verification cleanly separated |

## Plan Review

**Refinement process:** /refine-plan with 2 max rounds
**Convergence:** Round 1 applied 30 fixes + 6 justified-not-fix across the 36 findings; refiner self-reports 0 substantive issues remaining. No round-2 dispatch needed because all Verified findings have plan-side fixes and all Judgment findings have explicit dispositions.
**Remaining concerns:** None substantive. Two minor execution notes: (1) the `chromium-mobile` Playwright project (Phase 8) uses `devices['Pixel 5']` -- if that descriptor changes in Playwright >=1.48, the test may need `ignoreHTTPSErrors` or similar adjustments; verify at Phase 8 run time. (2) The aesthetic-review rubric relies on the agent's multimodal Read-tool pass to evaluate PNGs; the rubric is explicit enough that "accept-all" bias is bounded, but a future v2 could commit visual-regression baselines for harder tolerances.

### Round History
| Round | Reviewer Findings | Devil's Advocate Findings | Substantive | Resolved |
|-------|-------------------|---------------------------|-------------|----------|
| 1 (draft) | 22 (18 substantive) | 17 (14 substantive) | 32 | 38/39 fixed; 1/39 justified (R-19 retracted); 0 deferred |
| 1 (refine) | 18 (16 substantive) | 18 (16 substantive) | 32 | 30/36 fixed; 6/36 justified; 0 deferred |

### Round 1 Disposition (refine-plan)

| ID | Title | Severity | Evidence | Disposition |
|----|-------|----------|----------|-------------|
| R-1 | Mobile perf CPU throttling on WebKit | critical | Verified -- playwright-core throws `CDP session is only available in Chromium` on non-Chromium contexts | Fixed -- Phase 8 `e2e/perf.spec.mjs` runs under a new `chromium-mobile` Playwright project (`devices['Pixel 5']`) added to `playwright.config.mjs`; uses correct API `const cdp = await context.newCDPSession(page)`; `test.skip(project.name !== 'chromium-mobile')` gates the throttling. WebKit `mobile-safari` retained for touch+CSS verification (no CDP dependency). |
| R-2 | Safe-area-inset E2E asserts nothing on Playwright | major | Verified -- `deviceDescriptorsSource.json` has zero `safe-area` or `viewport-fit` keys; iPhone 13 Pro descriptor only sets viewport/UA/DPR | Fixed -- Phase 8 `e2e/safe-area.spec.mjs` is now a source-level check: asserts `#app` computed style contains `env(safe-area-inset-*)` declarations. Rendered non-zero insets are the domain of the real-device.md artifact. Downgrade documented in the test comment. |
| R-3 | Level 10 vs Level 15 largest grid | major | Verified -- progression table row 10 = 29x29 / 841 validCells; row 15 = 36x36 / 1176 validCells | Fixed -- Phase 8 perf test targets level 15 explicitly; comment notes "largest grid: 36x36 irregular octagon, 1176 valid cells". Matching AC updated. |
| R-4 | Phase 7 retroactively modifies canvas.mjs resize handler | major | Verified -- Phase 2 originally said only "on resize, re-scale"; Phase 7 re-specified it as wiring HUD reflow | Fixed -- Phase 2 `src/render/canvas.mjs` work item rewritten to author a first-class resize+orientation handler with `layout-changed` event emission; Phase 3 HUD + Phase 4 toolbar subscribe; Phase 8 verifies. No cross-phase retrofit. |
| R-5 | Phase 7 retroactively modifies style.css for safe-area | minor | Verified -- Phase 1 style.css spec originally omitted safe-area padding | Fixed -- Phase 1 `src/style.css` work item now includes `#app { padding: env(safe-area-inset-*) ... }` up-front. Phase 8 verifies the declaration exists. |
| R-6 | Touch-target audit has no stable selectors | major | Verified -- `grep -c "data-testid" plans/touch-grass.md` returned 0 | Fixed -- Phase 1 Design & Constraints now defines the full 17-entry `data-testid` registry; Phases 1/3/4/7 UI work items attach the testids when authoring elements; Phase 8 enumerates from the registry. `aria-label` is also required on icon-only buttons. |
| R-7 | 15-level contiguous playthrough infeasible | major | Verified -- par times sum to 1575s ~= 26 min; no dev-skip specified | Fixed -- Phase 1/3 add `?dev=1&level=N` URL parameter (guarded by localhost/LAN hostname check); Phase 3 exposes `window.__game.loadLevel`; Phase 8 screenshot gallery uses the dev-skip (15 * ~10s = ~2-3 min wall-clock). Playthrough of L1/5/10/15 with real events is preserved for gameplay validation. |
| R-8 | `page.context()._client.send(...)` is Puppeteer idiom | major | Verified -- `_client` is not a public Playwright accessor; correct API is `await context.newCDPSession(page)` | Fixed -- Phase 8 perf test uses `const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });` verbatim. |
| R-9 | Phase 3 inline progress write creates split-key | minor | Verified -- Phase 3 line 349 originally said `localStorage.setItem('touchgrass.v1.progress', ...)` | Fixed -- Phase 3 level-won writer now reads+deep-merges the consolidated `touchgrass.v1` key; Phase 4 simply refactors to call `storage.writeState`. No second key ever created; no migration path needed. |
| R-10 | Audiogen "96kbps" / "looping=true" don't map to real flags | minor | Verified -- audiogen SKILL.md exposes `--output-format mp3_44100_{64,96,128,192}` not a bare kbps int; no `--looping` flag on music (loop caveat in SKILL.md:96) | Fixed -- Phase 6 audiogen work items now use `--length-ms`, `--output-format mp3_44100_96`, and explicitly note loop is engine-side via `AudioBufferSourceNode.loop = true`. Fallback to `mp3_44100_64` documented for free-tier. |
| R-11 | Imagegen "transparent" shorthand ambiguous | minor | Verified -- imagegen SKILL.md line 49: `--background transparent|opaque|auto` is the flag form | Fixed -- Phase 6 imagegen work items now use `--background transparent` explicitly, plus `--size`, `--quality`, `--image`, `--input-fidelity`, `--output`, `--prompt` matching SKILL.md. Style-consistency strategy uses `--quality high` / `--quality low` not `quality: high` / `quality: low`. |
| R-12 | Phase 7 size + pre-release pushes ~1400-1700 LOC | major | Verified -- Phase 7 had 22 work items combining meta features + QA | Fixed -- split into Phase 7 (meta features: 13 work items) and Phase 8 (pre-release verification: 9 work items). Progress Tracker updated; Overview explains the split; Dependencies chain corrected. |
| R-13 | Playwright adds iPhone 13 Pro project without spec | minor | Verified -- Phase 1 config has chromium + mobile-safari (iPhone 12) only | Fixed -- Phase 8 adds a THIRD project `chromium-mobile` (Pixel 5) for CDP-throttled perf; iPhone 13 Pro is NOT a separate project (emulated insets don't work anyway, per R-2); existing `mobile-safari` retains iPhone 12 unchanged. Phase 8 Design & Constraints documents the project-skip audit of existing tests. |
| R-14 | `page.setViewportSize` doesn't fire orientationchange | minor | Verified -- Playwright setViewportSize changes viewport only; no screen.orientation transition | Fixed -- Phase 8 orientation test's work item explicitly states it exercises the `resize`-listener path (not `screen.orientation`), and real orientation-API handling is real-device-only. Language updated: "viewport dim-swap" not "orientation swap". |
| R-15 | `hostname -I` Linux-only | nitpick | Verified -- `hostname -I` works on Linux; macOS needs `ipconfig getifaddr en0`; Windows needs `ipconfig` or `Get-NetIPAddress` | Fixed -- Phase 8 real-device work item provides the three portable-command variants (Linux / macOS / Windows). Also removed the redundant `--bind 0.0.0.0` (python3 http.server already defaults to all interfaces, verified via `python3 -m http.server --help`). |
| R-16 | Phase 5 pet vs Phase 4 move trigger overlap | minor | Verified -- Phase 4 executes move on pointerdown; Phase 5 pets on pointerup-tap; no precedence rule | Fixed -- Phase 4 adds explicit "Armed-move + insect-interaction priority" rule: insect interaction wins; move stays armed (no refund, no fire). Unit test covers the case. |
| R-17 | Phase 6 asset/audio review references Phase 7 artifacts | minor | Verified -- Phase 7 line 909-910 reviews Phase 6 outputs | Justified-not-fix -- Phase 8's review block DOES operate on Phase 6 outputs, but because Phase 8 is now a separate phase (runs after Phase 7 meta features are committed), the feedback loop is: Phase 6 ships assets -> Phase 7 uses them -> Phase 8 reviews them -> if FAIL, regenerate via `/imagegen try again` and re-verify. This matches the new phase boundary. Moving the review into Phase 6 ACs would force Phase 6 to gate on subjective rubric evaluation -- out of scope for a single agent session. Keep in Phase 8. |
| R-18 | Plan Quality section stale after post-convergence Phase 7 addition | minor | Judgment -- parsed-state file is the only external attestation; plan doesn't timestamp the addition | Fixed -- this Drift Log + Plan Review section documents the post-draft additions and the refine round 1 dispositions. The original draft-plan Round History + Disposition table is preserved verbatim above for traceability. |
| DA-1 | Phase 7 mobile perf CDP on WebKit | critical | Verified -- same as R-1 | Fixed -- same fix as R-1 (chromium-mobile project; correct API). |
| DA-2 | Phase 7 perf check targets L10 not L15 | major | Verified -- same as R-3 | Fixed -- same fix as R-3 (Phase 8 perf test loads `?dev=1&level=15`). |
| DA-3 | Orientation handler asserted in 7 but not added in 2 | major | Verified -- same as R-4 | Fixed -- same fix as R-4 (Phase 2 authors the handler first-class). |
| DA-4 | Safe-area padding owned by Phase 1 but specified in Phase 7 | major | Verified -- same as R-5; also notes Playwright emulation doesn't produce real insets | Fixed -- Phase 1 authors the CSS; Phase 8 does source-level verification; real-device confirms rendered insets. |
| DA-5 | Touch-target audit no selector convention | major | Verified -- same as R-6 | Fixed -- same fix as R-6 (data-testid registry in Phase 1). |
| DA-6 | AudioContext unlock on title-screen Start not gameplay | minor | Verified -- `once: true` binds to any pointerdown including title cog tap | Fixed (minor doc-only) -- Phase 4 `src/audio.mjs` spec already says "first pointerdown" which correctly covers any gesture including title cog; Phase 4 AC now explicitly reads "Before ANY pointer interaction, `window.__audio.ctx === null`; after ANY pointerdown (including title cog tap), `window.__audio.ctx.state === 'running'`." Applied below. See phase 4 AC update. |
| DA-7 | Armed-move + insect-tap interaction unspecified | major | Verified -- same as R-16 | Fixed -- same fix as R-16 (priority rule: insect wins, move stays armed). |
| DA-8 | Insect-footprint skip doesn't cover moves | minor | Verified -- CLEAR pseudocode zeroes all valid cells unconditionally | Fixed -- Phase 4 MOVES.* `activate` signatures now accept/honor `skipCellPredicate`; CLEAR explicitly excludes insect-footprint cells; RING and LINE filter through the predicate. Unit test added. |
| DA-9 | Tap-vs-sweep `totalPathPx` unit unspecified | minor | Verified -- "10 px" without unit, ambiguous on 3x dpr | Fixed -- Phase 5 work item and Design & Constraints block clarify "integrated CSS-pixel Euclidean distance" (dpr-independent, ~1.6mm physical). Behavior uniform across 12x12 L1 and 36x36 L15. |
| DA-10 | Web Share AbortError silently swallowed | minor | Verified -- `catch {}` in original flow eats all errors including non-AbortErrors that should fall through | Fixed -- Phase 7 share/flow.mjs now distinguishes `AbortError` (user cancelled, returns `'share-aborted'`) from other errors (fall through to next tier). Design note updated. |
| DA-11 | Aesthetic review rubric absent | major | Judgment + verified -- "fits calming meadow style" is subjective; headless agent tends to accept-all | Fixed -- Phase 8 aesthetic-review work item now has a 6-criterion checklist (subject correctness, no-text-garbage, no-artifacts, transparency, style-consistency, readable-at-128px). Audio review has a 4-criterion checklist. Visual-regression baseline explicitly deferred to future work. |
| DA-12 | Screenshot gallery requires 26-min contiguous playthrough | major | Verified -- same as R-7 | Fixed -- same fix as R-7 (dev level-skip makes gallery ~2-3 min). Real-event playthrough of L1/5/10/15 preserved separately. |
| DA-13 | Friendly-tap e2e assumes cell coords match canvas coords | minor | Verified -- Phase 5 test originally hand-coded pixel positions without reading layout | Fixed -- Phase 2 `window.__game.layout.cellPx` + `hudOffsetPx` are now exposed for e2e; Phase 5 e2e test pseudocode (and Phase 8 gallery) compute click coords from `cellPx` + `hudOffsetPx`. |
| DA-14 | Friendly tap-to-pet race: insect moves during 200ms tap | minor | Verified -- tap recognized on pointerup; insect may have wandered off | Fixed -- Phase 5 tap-vs-sweep work item now latches `{ gestureId, insectId, species }` at pointerdown; pointerup-as-tap pets the LATCHED insect regardless of current position (provided entity still exists). |
| DA-15 | Phase 6 oversized (~35 work items) | minor | Judgment | Justified-not-fix -- Phase 6 sizing concern was already raised in draft-plan R-15 and dispositioned as "kept single-phase with checkpoint guidance" because A/V dependencies (audio engine needs SFX files loaded; particles use assets) couple tightly at the interface level. The DA-15 counter-argument (tests can mock the asset loader) is valid but adds mocking scaffolding that disappears after Phase 6 lands. Retaining the draft-plan disposition: checkpoint between (a) 20 imagegen + 9 audiogen + resize + loader and (b) engine wiring. Phase 6 wall-clock budget (3-5 hr) documented; agent compaction risk acknowledged. If Phase 6 times out in practice, Phase 6b can be broken off as a refine-plan round-2 fix -- but breaking it now speculatively is premature. |
| DA-16 | Phase 7 pre-release bundled with meta features | major | Verified -- same as R-12 | Fixed -- same fix as R-12 (split into Phase 7 + Phase 8). |
| DA-17 | zskills `dev_server.cmd` vs Phase 7 `--bind 0.0.0.0` mismatch | minor | Verified -- `python3 -m http.server` defaults to all interfaces; `--bind 0.0.0.0` is redundant and could cause port-conflict if a second server starts | Fixed -- Phase 8 real-device work item drops `--bind 0.0.0.0` and documents that `python3 -m http.server $DEV_PORT` already listens on all interfaces (verified via `python3 -m http.server --help`). Real-device test reuses the existing dev server (per Playwright's `reuseExistingServer: true`), no EADDRINUSE risk. |
| DA-18 | Grass-touch haptics on Firefox Android gesture-grace | nitpick | Judgment -- real user impact is minor; test coverage (chromium + webkit) already misses Firefox Android | Justified-not-fix -- the existing Phase 4 `haptics.mjs` guard (`typeof navigator.vibrate === 'function'` + gated by `settings.haptics`) is a feature-detection no-op on any platform where vibrate is unsupported or gesture-gated-off. Firefox Android's tighter grace window is silently acceptable per the relaxation-game philosophy ("any platform where vibrate is a no-op is silently acceptable"). Phase 6 Design & Constraints notes haptics is best-effort. No code change. |
