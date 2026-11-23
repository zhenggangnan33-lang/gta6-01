// Seeded randomness for VERDE BAY v2. mulberry32 — a tiny, fast
// generator with a clean uniform distribution. One seeded stream drives
// every random choice in the game (map layout, traffic, pedestrians,
// mission spawns), so a fixed seed replays the same city every time.

export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = {
    next() {
      // mulberry32 step.
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
