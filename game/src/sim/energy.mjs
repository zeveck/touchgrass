// sim/energy.mjs -- the energy meter, its line, and the head start.
//
// The line = k x one lap, where one lap is the energy of sweeping the whole
// field once at full height (sum of type multipliers over valid cells).
// Head start: the next field starts 15% full (a share of the NEXT field's
// line). Pure.

export const HEAD_START_FRAC = 0.15;

export function meterLine(k, lap) {
  return k * lap;
}

export class Energy {
  constructor(line, { headStart = false } = {}) {
    this.line = line;
    this.headStart = !!headStart;
    this.value = headStart ? HEAD_START_FRAC * line : 0;
  }
  add(x) {
    this.value += x;
    if (this.value < 0) this.value = 0;
  }
  set(x) {
    this.value = Math.max(0, x);
  }
  get frac() {
    return this.line > 0 ? this.value / this.line : 0;
  }
  get full() {
    return this.value >= this.line;
  }
}

// Head start is earned when the whole field was touched when the meter
// reached the line. Field 15 has no next field, so it earns none.
export function earnsHeadStart(fieldN, wholeFieldFrac, fieldCount = 15) {
  return wholeFieldFrac >= 1 && fieldN < fieldCount;
}
