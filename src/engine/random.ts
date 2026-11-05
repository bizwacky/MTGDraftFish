/** Small, fast, seedable PRNG (xoshiro128**), seeded through splitmix32. Deterministic across platforms. */
export interface Rng {
  /** Uniform in [0, 1) */
  (): number;
}

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t = t ^ (t >>> 15)) >>> 0;
  };
}

export function makeRng(seed: number): Rng {
  const sm = splitmix32(seed);
  let s0 = sm();
  let s1 = sm();
  let s2 = sm();
  let s3 = sm();
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;
  return () => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result / 4294967296;
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** Walker alias table for O(1) sampling from a discrete distribution. */
export interface AliasTable {
  n: number;
  prob: Float64Array;
  alias: Int32Array;
}

export function buildAlias(probs: ArrayLike<number>): AliasTable {
  const n = probs.length;
  const prob = new Float64Array(n);
  const alias = new Int32Array(n);
  if (n === 0) return { n, prob, alias };
  const scaled = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += probs[i];
  const small: number[] = [];
  const large: number[] = [];
  for (let i = 0; i < n; i++) {
    scaled[i] = (probs[i] / sum) * n;
    (scaled[i] < 1 ? small : large).push(i);
  }
  while (small.length && large.length) {
    const l = small.pop()!;
    const g = large.pop()!;
    prob[l] = scaled[l];
    alias[l] = g;
    scaled[g] = scaled[g] + scaled[l] - 1;
    (scaled[g] < 1 ? small : large).push(g);
  }
  while (large.length) prob[large.pop()!] = 1;
  while (small.length) prob[small.pop()!] = 1;
  return { n, prob, alias };
}

export function sampleAlias(t: AliasTable, rng: Rng): number {
  const u = rng() * t.n;
  const i = u | 0;
  return u - i < t.prob[i] ? i : t.alias[i];
}
