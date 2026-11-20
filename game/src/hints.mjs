// src/hints.mjs -- the hint cards (GAME_DESIGN.md "Structure and difficulty"):
// what's new on each field, said once. Pure data + selection, no DOM.
//
// art: what the card's picture is built from (in-game art only):
//   { tuft: key } a grass tuft, { bug: species } a bug sprite,
//   { move: kind } a move icon, { hand: true } the ghost hand over a swatch.

export const HINTS = Object.freeze([
  { id: 'sweep', field: 1, title: 'Touch the grass',
    text: 'Drag across the field to sweep it. Every stroke through standing grass fills the meter. Fill it to the line.',
    art: [{ hand: true }], card: false },
  { id: 'regrow', field: 2, title: 'Grass grows back',
    text: 'When it stands up, sweep it again. The stripe in the middle was just mown: watch it rise.',
    art: [{ tuft: 'flat' }, { arrow: true }, { tuft: 'default' }] },
  { id: 'short-ladybug', field: 3, title: 'Short grass and a ladybug',
    text: 'Short clover grows back fast but gives less. Tap the ladybug to say hello: new friends join your Bug Garden. Touch every blade to fill the leaf badge: do it before the meter fills for a head start on the next field.',
    art: [{ tuft: 'short' }, { bug: 'ladybug' }, { leaf: true }] },
  { id: 'tall', field: 4, title: 'Tall grass',
    text: 'Tall grass is slow to grow back, but it\'s worth more.',
    art: [{ tuft: 'tall' }, { tuft: 'default' }] },
  { id: 'flowered', field: 5, title: 'Flowered grass',
    text: 'Grass with flowers in it gives a little more, and its petals fly.',
    art: [{ tuft: 'flowered' }] },
  { id: 'ant-ring', field: 6, title: 'A grumpy ant, and the Ring',
    text: 'It glows red when your finger comes close: move away, or it nips. New move: a Ring calms a grumpy bug and sweeps the grass around it.',
    art: [{ bug: 'ant', angry: true }, { move: 'ring' }] },
  { id: 'snail', field: 7, title: 'A snail',
    text: 'Slow and friendly. Tap it to say hello. Two ladybugs live here too.',
    art: [{ bug: 'snail' }, { bug: 'ladybug' }] },
  { id: 'butterfly', field: 8, title: 'A butterfly',
    text: 'It flutters about and settles now and then. Tap it to say hello.',
    art: [{ bug: 'butterfly' }] },
  { id: 'stiff-line', field: 9, title: 'Stiff grass, and the Line',
    text: 'Stiff grass needs two strokes: loosen it, lift your finger, sweep again. New move: a Line flattens stiff grass in one go.',
    art: [{ tuft: 'stiff' }, { tuft: 'loosened' }, { move: 'line' }] },
  { id: 'bee', field: 10, title: 'A bee',
    text: 'Bees wander faster than ants. Steer around the red glow. Every kind of grass grows here.',
    art: [{ bug: 'bee' }] },
  { id: 'hedge-clear', field: 11, title: 'A hedge, and Full Clear',
    text: 'Tall grass lines the edges, and a bee and two ants sit in the corner. New move: Full Clear touches every blade at once, even round the grumpy corner.',
    art: [{ tuft: 'tall' }, { bug: 'bee', angry: true }, { move: 'clear' }] },
  { id: 'wasp', field: 12, title: 'A wasp',
    text: 'Quick and wide-roaming. Give it room.',
    art: [{ bug: 'wasp' }] },
  { id: 'stripes', field: 13, title: 'A half-mown lawn',
    text: 'It opens in mown stripes, growing back, so the field is a moving patchwork. The busiest bug field yet.',
    art: [{ tuft: 'flat' }, { tuft: 'default' }, { tuft: 'flat' }, { tuft: 'default' }] },
  { id: 'caterpillar', field: 14, title: 'Two islands, and a caterpillar',
    text: 'Sweep both fields. A caterpillar is slowly crossing one of them: tap it to say hello.',
    art: [{ bug: 'caterpillar' }] },
  { id: 'finale', field: 15, title: 'Sunset Meadow',
    text: 'The last field: every bug and every kind of grass. Take your time.',
    art: [{ bug: 'ladybug' }, { tuft: 'flowered' }, { bug: 'butterfly' }] },
]);

// The hint card to show when field n opens, or null (seen already, or the
// field teaches by doing).
export function hintFor(n, seen) {
  const s = new Set(seen);
  const h = HINTS.find((x) => x.field === n);
  if (!h || h.card === false || s.has(h.id)) return null;
  return h;
}

// "How to play": every hint seen so far, in field order.
export function hintsSeenList(seen) {
  const s = new Set(seen);
  return HINTS.filter((h) => s.has(h.id));
}

// A guest challenge's checklist card: one short line for each new thing up
// to field n (GAME_DESIGN.md "Screens", Challenge links).
export const CHECKLIST = Object.freeze({
  sweep: 'Drag across the grass to sweep it. Fill the meter to the line.',
  regrow: 'Swept grass grows back: sweep it again once it stands.',
  'short-ladybug': 'Tap a friendly bug to say hello.',
  tall: 'Tall grass is worth more.',
  'ant-ring': 'Grumpy bugs glow red: move away. A Ring calms them.',
  'stiff-line': 'Stiff grass needs two strokes. A Line flattens it in one.',
  bee: 'Bees and wasps roam wider: steer around the red glow.',
  'hedge-clear': 'Full Clear touches every blade at once.',
});

export function checklistFor(n) {
  return HINTS.filter((h) => h.field <= n && CHECKLIST[h.id]).map((h) => CHECKLIST[h.id]);
}
