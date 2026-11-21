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

// 43 -> "0:43", 75.4 -> "1:15": every time in the game reads m:ss.
export function fmtTime(seconds) {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
