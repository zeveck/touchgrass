// sim/score.mjs -- a field's score (GAME_DESIGN.md "Win, lose and progress"):
//   field x 100 + whole field 250 + 2 per second under par (up to 100)
//   + 25 per bug petted.
// Pure: shown only on the field-complete card.

export const SCORE = Object.freeze({ perField: 100, whole: 250, perSecond: 2, speedMax: 100, perPet: 25 });

// n: field number; time: seconds to the win; par: the field's par (s);
// whole: share of the field touched at the win (0..1); petted: bugs petted.
export function fieldScore({ n, time, par, whole, petted = 0 }) {
  const under = Math.max(0, Math.floor(par - time));
  const speed = Math.min(SCORE.speedMax, SCORE.perSecond * under);
  return {
    field: SCORE.perField * n,
    whole: whole >= 1 ? SCORE.whole : 0,
    speed,
    pets: SCORE.perPet * Math.max(0, petted | 0),
    get total() { return this.field + this.whole + this.speed + this.pets; },
  };
}

export function scoreOf(args) {
  return fieldScore(args).total;
}

// 1240 -> "1,240" (the same in every locale, so links and cards read alike).
export function fmtScore(v) {
  return String(Math.max(0, Math.round(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
