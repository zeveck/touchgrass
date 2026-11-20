// sim/rng.mjs -- seeded RNG (mulberry32). Pure: no DOM, no wall clock.
//
// Every random choice in a field (type placement, later bug spawns and wander)
// comes from one RNG per field, seeded by the field number (or ?seed=N in dev).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Field seed: stable per field number, distinct per purpose.
export function fieldSeed(n, salt = 0) {
  return (Math.imul(n, 7919) + Math.imul(salt, 104729) + 12345) >>> 0;
}

// Fisher-Yates shuffle in place with the given rng.
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
