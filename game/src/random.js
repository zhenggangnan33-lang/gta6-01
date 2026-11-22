// Seeded randomness for VERDE BAY. sfc32 (Small Fast Chaotic) — a small,
// fast generator with good distribution. Every random choice in the game
// (map layout, traffic, pedestrians, mission spawns) draws from one of
// these, so a fixed seed replays the same city.

export function makeRng(seed) {
  // Hash the seed into four 32-bit words.
  let a = (seed ^ 0x9e3779b9) >>> 0;
  let b = (seed * 2654435761) >>> 0;
  let c = (seed ^ 0x85ebca6b) >>> 0;
  let d = (seed * 40503 + 0x27d4eb2f) >>> 0;
  const rng = {
    next() {
      // sfc32 step.
      let t = (a + b + d) >>> 0;
      d = (d + 1) >>> 0;
      a = b ^ (b >>> 9);
      b = (c + ((c << 3) >>> 0)) >>> 0;
      c = ((c << 21) | (c >>> 11)) >>> 0;
      c = (c + t) >>> 0;
      return t / 4294967296;
    },
    range(lo, hi) { return lo + rng.next() * (hi - lo); },
    int(lo, hi) { return Math.floor(rng.range(lo, hi + 1)); },
    pick(arr) { return arr[Math.floor(rng.next() * arr.length)]; },
    chance(p) { return rng.next() < p; },
    // In-place Fisher-Yates.
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
    // Roughly normal in [-1, 1] (average of three uniforms).
    bell() { return (rng.next() + rng.next() + rng.next() - 1.5) / 1.5; },
  };
  // Warm up so the first draws are well mixed.
  for (let i = 0; i < 16; i++) rng.next();
  return rng;
}

// Deterministic string hash (for seeding sub-systems from a name).
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
