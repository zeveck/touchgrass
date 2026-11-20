// sim/types.mjs -- the five grass types (GAME_DESIGN.md "Grass types").
//
// id order is fixed: it indexes typed arrays and the render atlas.

export const T_DEFAULT = 0;
export const T_TALL = 1;
export const T_SHORT = 2;
export const T_FLOWERED = 3;
export const T_STIFF = 4;

export const GRASS_TYPES = Object.freeze([
  Object.freeze({ id: T_DEFAULT, key: 'default', mult: 1.0, r: 0.30 }),
  Object.freeze({ id: T_TALL, key: 'tall', mult: 1.6, r: 0.18 }),
  Object.freeze({ id: T_SHORT, key: 'short', mult: 0.7, r: 0.55 }),
  Object.freeze({ id: T_FLOWERED, key: 'flowered', mult: 1.2, r: 0.30 }),
  Object.freeze({ id: T_STIFF, key: 'stiff', mult: 1.0, r: 0.25 }),
]);

export const TYPE_BY_KEY = Object.freeze(
  Object.fromEntries(GRASS_TYPES.map((t) => [t.key, t.id])),
);

// Pre-built lookup arrays for the hot loops.
export const MULT = Float32Array.from(GRASS_TYPES.map((t) => t.mult));
export const RATE = Float32Array.from(GRASS_TYPES.map((t) => t.r));
