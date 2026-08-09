export class SeededRandom {
  constructor(seed = 0x5f3759df) {
    this.state = seed >>> 0 || 1;
  }

  next() {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  integer(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }
}
