// sim/insects.mjs -- the seven bugs (GAME_DESIGN.md "Bugs"): species, the
// seeded spawn table, wander, the hostile anger/bite/flee cycle, petting,
// nudging friendlies aside, and the cells "under a bug". Pure: no DOM, no
// wall clock; time only advances through step(dt), and every random choice
// comes from the field's own RNG, so a solution replays exactly.
//
// Positions are in cells (layout-free); speeds, sizes and radii are in CSS px
// and converted with the layout's cell size, so bugs look and move the same
// on every screen.

import { mulberry32, fieldSeed } from './rng.mjs';

// Speeds in CSS px/s (the plan's cells/s x 30). wander: chance per second of
// picking a new heading. idle: chance per second of stopping for a while.
// chirp: the pet chirp's playback rate (snail low and slow, butterfly high).
export const SPECIES = Object.freeze({
  bee: Object.freeze({ id: 'bee', name: 'Bee', hostile: true, speed: 21, wander: 0.85, idle: 0.08 }),
  wasp: Object.freeze({ id: 'wasp', name: 'Wasp', hostile: true, speed: 33, wander: 0.9, idle: 0.05 }),
  ant: Object.freeze({ id: 'ant', name: 'Ant', hostile: true, speed: 15, wander: 0.8, idle: 0.12 }),
  ladybug: Object.freeze({ id: 'ladybug', name: 'Ladybug', hostile: false, speed: 9, wander: 0.7, idle: 0.15, chirp: 1.0 }),
  butterfly: Object.freeze({ id: 'butterfly', name: 'Butterfly', hostile: false, speed: 24, wander: 0.95, idle: 0.22, chirp: 1.4 }),
  caterpillar: Object.freeze({ id: 'caterpillar', name: 'Caterpillar', hostile: false, speed: 6, wander: 0.6, idle: 0.1, chirp: 0.8, long: 1.4 }),
  snail: Object.freeze({ id: 'snail', name: 'Snail', hostile: false, speed: 4.5, wander: 0.5, idle: 0.06, chirp: 0.6 }),
});
export const SPECIES_ORDER = Object.freeze(['bee', 'wasp', 'ant', 'ladybug', 'butterfly', 'caterpillar', 'snail']);

// The original plan's Phase 5 spawn table, plus a snail on field 7.
export const SPAWNS = Object.freeze({
  1: {}, 2: {},
  3: { ladybug: 1 },
  4: { ladybug: 1 },
  5: { ladybug: 1 },
  6: { ant: 1, ladybug: 1 },
  7: { ant: 1, ladybug: 2, snail: 1 },
  8: { ant: 1, ladybug: 1, butterfly: 1 },
  9: { ant: 2, ladybug: 1, butterfly: 1 },
  10: { bee: 1, ant: 1, ladybug: 1, butterfly: 1 },
  11: { bee: 1, ant: 2, ladybug: 1, butterfly: 1 },
  12: { bee: 1, wasp: 1, ant: 1, ladybug: 1, butterfly: 1 },
  13: { bee: 1, wasp: 1, ant: 2, ladybug: 2, butterfly: 1 },
  14: { bee: 1, wasp: 1, ant: 1, ladybug: 1, butterfly: 1, caterpillar: 1, snail: 1 },
  15: { bee: 2, wasp: 1, ant: 2, ladybug: 2, butterfly: 1, caterpillar: 1, snail: 1 },
});

export const WARN_MIN_S = 1.5;       // the angry glow shows at least this long before a bite
export const CALM_FAR = 1.25;        // x anger radius: farther than this (or not sweeping)...
export const CALM_S = 0.5;           // ...for this long calms an angry bug
export const FLEE_DIST = 1.5;        // x anger radius: a fleeing bug runs until this far away
export const FLEE_MIN_PX = 60;       // flee speed = max(2 x speed, 60 px/s)
export const FLEE_MAX_S = 4;         // a cornered bug stops fleeing after this long
export const COOLDOWN_S = 2;         // after fleeing, can't get angry again for 2 s
export const BITE_FRAC = 0.03;       // a bite takes 3% of the line
export const PET_FRAC = 0.02;        // a first pet gives 2% of the line...
export const PET_SCORE = 25;         // ...and 25 score, once per bug per field
export const UNDER_FRAC = 0.35;      // a cell is under a bug within 0.35 x its drawn size

// Drawn size: clamp(1.8 cells, 32 px, 64 px). The caterpillar is 1.4x longer.
export function bugSizePx(cellPx) {
  return Math.max(32, Math.min(64, 1.8 * cellPx));
}
// Anger radius (hostiles): max(1.5 cells, 40 px), bug centre to a sweeping pointer.
export function angerRadiusPx(cellPx) {
  return Math.max(1.5 * cellPx, 40);
}
// The pulsing warning ring shows past a finger.
export function warnRingPx(cellPx) {
  return Math.max(angerRadiusPx(cellPx) + 8, 48);
}
// Pet area: a circle of max(24 px, half the drawn size + 6 px).
export function petRadiusPx(cellPx, species) {
  const s = bugSizePx(cellPx) * (SPECIES[species].long ? 1.2 : 1);
  return Math.max(24, s / 2 + 6);
}

let nextId = 1;

function makeBug(sp, x, y, hd) {
  const s = SPECIES[sp];
  return {
    id: nextId++, sp, hostile: s.hostile, x, y, hd, tgt: hd,
    state: 'wander',     // 'wander' | 'idle' | 'angry' | 'flee'
    t: 0,                // idle time left
    cool: 0,             // can't get angry while > 0
    angerT: 0,           // seconds angry so far
    calmT: 0,            // seconds the pointer has been away / still while angry
    fleeX: 0, fleeY: 0,  // where it flees from (cells) when no pointer is down
    fleeT: 0,
    petted: false,       // petted this field (energy and score paid)
    pets: 0,             // taps this field (each one hops)
    moving: 0,           // 0..1, eased speed (render: crawl cycle)
    slideX: 0, slideY: 0,  // render-only: offset left by a nudge, eased back to 0
  };
}

export class Bugs {
  // world: the World that owns them (grid, layout, pointer, energy).
  constructor(world, seed) {
    this.world = world;
    this.rng = mulberry32(seed ?? fieldSeed(world.n, 7));
    this.list = [];
    this.blockedIdx = [];
    this.events = [];      // ['angry'|'calm'|'bite'|'flee'|'pet', bug, extra]
    this.spawnAll(SPAWNS[world.n] || {});
  }

  get cell() { return this.world.layout.cell; }

  // Size of a bug in cells (drawn size; the caterpillar's length is 1.4x).
  sizeCells() { return bugSizePx(this.cell) / this.cell; }
  angerCells() { return angerRadiusPx(this.cell) / this.cell; }
  underCells(b) { return UNDER_FRAC * this.sizeCells() * (SPECIES[b.sp].long ? 1.2 : 1); }

  _validAt(x, y) {
    const g = this.world.grid;
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return false;
    return g.valid[Math.floor(y) * g.W + Math.floor(x)] === 1;
  }

  // Can a bug's centre be here? Its centre and four points a margin away
  // must be on the field, so the sprite doesn't hang off the edge.
  canBe(x, y, margin) {
    const m = margin ?? Math.min(1.2, 0.3 * this.sizeCells());
    return this._validAt(x, y) && this._validAt(x - m, y) && this._validAt(x + m, y) &&
      this._validAt(x, y - m) && this._validAt(x, y + m);
  }

  spawnAll(table) {
    const g = this.world.grid;
    const spec = this.world.spec;
    const rng = this.rng;
    // Candidate spots: cell centres a bug can stand on, a fixed margin in
    // from the edge (layout-free, so a field spawns the same everywhere).
    const spots = [];
    for (let i = 0; i < g.N; i++) {
      if (!g.valid[i]) continue;
      const x = (i % g.W) + 0.5, y = Math.floor(i / g.W) + 0.5;
      if (this.canBe(x, y, 1.2)) spots.push([x, y]);
    }
    if (!spots.length) for (let i = 0; i < g.N; i++) if (g.valid[i]) spots.push([(i % g.W) + 0.5, Math.floor(i / g.W) + 0.5]);
    const taken = [];
    const farEnough = (x, y) => taken.every(([tx, ty]) => Math.hypot(tx - x, ty - y) >= 3);
    for (const sp of SPECIES_ORDER) {
      const count = table[sp] || 0;
      for (let k = 0; k < count; k++) {
        let pick = null;
        if (spec.hedge && SPECIES[sp].hostile) {
          // Field 11: the bee and the ants start at the L's inner corner.
          const cx = 16, cy = 16;
          const near = spots.filter(([x, y]) => Math.hypot(x - cx, y - cy) < 4 && farEnough(x, y));
          if (near.length) pick = near[Math.floor(rng() * near.length)];
        }
        for (let tries = 0; !pick && tries < 40; tries++) {
          const s = spots[Math.floor(rng() * spots.length)];
          if (farEnough(s[0], s[1])) pick = s;
        }
        if (!pick) pick = spots[Math.floor(rng() * spots.length)];
        taken.push(pick);
        const hd = rng() * Math.PI * 2;
        this.list.push(makeBug(sp, pick[0] + (rng() - 0.5) * 0.4, pick[1] + (rng() - 0.5) * 0.4, hd));
      }
    }
    this.updateBlocked();
  }

  // Add one bug (debug hook / tests). Returns it.
  spawn(sp, x, y, hd = 0) {
    if (!SPECIES[sp]) throw new Error(`No species ${sp}`);
    const b = makeBug(sp, x, y, hd);
    this.list.push(b);
    this.updateBlocked();
    return b;
  }

  clear() {
    this.list.length = 0;
    this.updateBlocked();
  }

  // Mark the cells under bugs (grid.blocked): strokes and moves skip them.
  updateBlocked() {
    const g = this.world.grid;
    for (const i of this.blockedIdx) g.blocked[i] = 0;
    this.blockedIdx.length = 0;
    for (const b of this.list) {
      const r = this.underCells(b);
      const r2 = r * r;
      const c0 = Math.max(0, Math.floor(b.x - r)), c1 = Math.min(g.W - 1, Math.floor(b.x + r));
      const r0 = Math.max(0, Math.floor(b.y - r)), r1 = Math.min(g.H - 1, Math.floor(b.y + r));
      for (let rr = r0; rr <= r1; rr++) {
        for (let c = c0; c <= c1; c++) {
          const dx = c + 0.5 - b.x, dy = rr + 0.5 - b.y;
          if (dx * dx + dy * dy > r2) continue;
          const i = rr * g.W + c;
          if (!g.valid[i] || g.blocked[i]) continue;
          g.blocked[i] = 1;
          this.blockedIdx.push(i);
        }
      }
    }
  }

  // Distance (CSS px) from a field-px point to a bug's centre.
  distPx(b, px, py) {
    const c = this.cell;
    return Math.hypot(px - b.x * c, py - b.y * c);
  }

  // The friendly bug whose pet area holds a field-px point (nearest), or null.
  friendAt(px, py) {
    let best = null, bd = Infinity;
    for (const b of this.list) {
      if (b.hostile) continue;
      const d = this.distPx(b, px, py);
      if (d <= petRadiusPx(this.cell, b.sp) && d < bd) { best = b; bd = d; }
    }
    return best;
  }

  // Move a bug one step along its heading; bounce off the field's edges.
  _move(b, distCells) {
    if (distCells <= 0) return;
    let nx = b.x + Math.cos(b.hd) * distCells, ny = b.y + Math.sin(b.hd) * distCells;
    if (this.canBe(nx, ny)) { b.x = nx; b.y = ny; return; }
    // Bounce: reflect across x, then y, then turn round, then anywhere.
    const tries = [Math.PI - b.hd, -b.hd, b.hd + Math.PI];
    for (let k = 0; k < 4; k++) tries.push(this.rng() * Math.PI * 2);
    for (const a of tries) {
      const tx = b.x + Math.cos(a) * distCells, ty = b.y + Math.sin(a) * distCells;
      if (this.canBe(tx, ty)) { b.hd = a; b.tgt = a; b.x = tx; b.y = ty; return; }
    }
    // Off its margin (after a resize, say): walk anywhere still on the field.
    if (this._validAt(nx, ny) && !this.canBe(b.x, b.y)) { b.x = nx; b.y = ny; return; }
    b.tgt = this.rng() * Math.PI * 2;
  }

  _turn(b, rate, dt) {
    let d = b.tgt - b.hd;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const m = rate * dt;
    b.hd += Math.abs(d) <= m ? d : Math.sign(d) * m;
  }

  _wander(b, dt) {
    const s = SPECIES[b.sp];
    const rng = this.rng;
    if (b.state === 'idle') {
      b.t -= dt;
      b.moving = Math.max(0, b.moving - dt * 4);
      if (b.t <= 0) { b.state = 'wander'; b.tgt = b.hd + (rng() - 0.5) * 2; }
      return;
    }
    if (rng() < s.wander * dt) b.tgt = b.hd + (rng() - 0.5) * 2.4;
    if (rng() < s.idle * dt) {
      b.state = 'idle';
      b.t = b.sp === 'butterfly' ? 1.5 + 2 * rng() : 0.6 + 1.6 * rng();
      return;
    }
    this._turn(b, b.sp === 'snail' || b.sp === 'caterpillar' ? 1.2 : 3, dt);
    b.moving = Math.min(1, b.moving + dt * 4);
    this._move(b, (s.speed / this.cell) * b.moving * dt);
  }

  _flee(b, dt, pointer) {
    const s = SPECIES[b.sp];
    const c = this.cell;
    const fx = pointer ? pointer.x / c : b.fleeX, fy = pointer ? pointer.y / c : b.fleeY;
    b.fleeT += dt;
    const d = Math.hypot(b.x - fx, b.y - fy);
    if (d * c >= FLEE_DIST * angerRadiusPx(c) || b.fleeT >= FLEE_MAX_S) {
      b.state = 'wander';
      b.cool = COOLDOWN_S;
      this.events.push(['safe', b]);
      return;
    }
    const away = d > 1e-6 ? Math.atan2(b.y - fy, b.x - fx) : this.rng() * Math.PI * 2;
    const v = Math.max(2 * s.speed, FLEE_MIN_PX) / c * dt;
    // Run straight away, or as close to it as the field's edge allows.
    let best = null;
    for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6]) {
      const a = away + off;
      const tx = b.x + Math.cos(a) * v, ty = b.y + Math.sin(a) * v;
      if (this.canBe(tx, ty)) { best = a; break; }
    }
    b.moving = 1;
    if (best === null) { b.fleeT += dt * 2; return; }    // cornered: give up sooner
    b.hd = best; b.tgt = best;
    b.x += Math.cos(best) * v; b.y += Math.sin(best) * v;
  }

  // Start fleeing from (fx, fy) in cells (after a bite, or calmed by a move).
  scare(b, fx, fy) {
    if (!b.hostile) return;
    const was = b.state;
    b.state = 'flee';
    b.fleeX = fx; b.fleeY = fy;
    b.fleeT = 0; b.angerT = 0; b.calmT = 0;
    this.events.push(['flee', b, was]);
  }

  step(dt) {
    const w = this.world;
    const p = w.pointer;
    const sweeping = w.sweeping;
    const Ra = angerRadiusPx(this.cell);
    for (const b of this.list) {
      if (b.slideX || b.slideY) {
        const k = Math.exp(-dt / 0.08);
        b.slideX *= k; b.slideY *= k;
        if (Math.abs(b.slideX) < 1e-3 && Math.abs(b.slideY) < 1e-3) { b.slideX = 0; b.slideY = 0; }
      }
      if (!b.hostile) { this._wander(b, dt); continue; }
      const d = p ? this.distPx(b, p.x, p.y) : Infinity;
      if (b.state === 'flee') { this._flee(b, dt, p); continue; }
      if (b.state === 'angry') {
        b.angerT += dt;
        b.moving = Math.max(0, b.moving - dt * 6);
        if (p) b.tgt = Math.atan2(p.y / this.cell - b.y, p.x / this.cell - b.x);
        this._turn(b, 6, dt);
        if (sweeping && d <= Ra && b.angerT >= WARN_MIN_S) {
          // Bite: 3% of the line (never below 0), then flee.
          const loss = Math.min(w.energy.value, BITE_FRAC * w.energy.line);
          w.energy.add(-BITE_FRAC * w.energy.line);
          w.bites++;
          this.events.push(['bite', b, loss]);
          this.scare(b, p.x / this.cell, p.y / this.cell);
          continue;
        }
        if (!sweeping || d > CALM_FAR * Ra) {
          b.calmT += dt;
          if (b.calmT >= CALM_S) {
            b.state = 'wander';
            b.angerT = 0; b.calmT = 0;
            this.events.push(['calm', b]);
          }
        } else b.calmT = 0;
        continue;
      }
      if (b.cool > 0) b.cool = Math.max(0, b.cool - dt);
      if (sweeping && d <= Ra && b.cool <= 0) {
        b.state = 'angry';
        b.angerT = 0; b.calmT = 0;
        this.events.push(['angry', b]);
        continue;
      }
      this._wander(b, dt);
    }
    this.updateBlocked();
  }

  // A stroke segment (cells) with brush radius R passed by: friendlies in its
  // way are nudged one brush-width aside (never harmed).
  nudge(x0, y0, x1, y1, R) {
    const half = 0.5 * this.sizeCells();
    let moved = false;
    for (const b of this.list) {
      if (b.hostile) continue;
      const dx = x1 - x0, dy = y1 - y0;
      const L2 = dx * dx + dy * dy;
      let u = L2 > 0 ? ((b.x - x0) * dx + (b.y - y0) * dy) / L2 : 0;
      u = Math.max(0, Math.min(1, u));
      const qx = x0 + u * dx, qy = y0 + u * dy;
      let nx = b.x - qx, ny = b.y - qy;
      const d = Math.hypot(nx, ny);
      const reach = R + 0.6 * half;
      if (d >= reach) continue;
      if (d > 1e-4) { nx /= d; ny /= d; } else {
        const L = Math.sqrt(L2) || 1;
        nx = -dy / L; ny = dx / L;
        if (L2 === 0) { nx = 1; ny = 0; }
      }
      // Out to one brush-width (plus half the bug) from the path.
      const target = 2 * R + half;
      const L = Math.sqrt(L2);
      // Aside (the near side first), then the far side, then on ahead.
      const tries = [[qx + nx * target, qy + ny * target], [qx - nx * target, qy - ny * target]];
      if (L > 0) tries.push([b.x + (dx / L) * target, b.y + (dy / L) * target]);
      for (const [tx, ty] of tries) {
        if (this.canBe(tx, ty)) {
          b.slideX += b.x - tx; b.slideY += b.y - ty;
          b.x = tx; b.y = ty;
          if (b.state === 'idle') b.state = 'wander';
          this.events.push(['nudge', b]);
          moved = true;
          break;
        }
      }
    }
    if (moved) this.updateBlocked();
  }

  // Pet a friendly bug. Energy (2% of the line) and score (25) are paid once
  // per bug per field; every pet still hops, floats hearts and chirps.
  pet(b) {
    if (!b || b.hostile || !this.list.includes(b)) return null;
    const w = this.world;
    b.pets++;
    let first = false;
    if (!b.petted) {
      b.petted = true;
      first = true;
      w.energy.add(PET_FRAC * w.energy.line);
      w.petScore += PET_SCORE;
    }
    if (b.state === 'idle') b.t = Math.max(b.t, 0.8);
    this.events.push(['pet', b, first]);
    return { first, species: b.sp };
  }

  get anyAngry() {
    return this.list.some((b) => b.state === 'angry');
  }
}
