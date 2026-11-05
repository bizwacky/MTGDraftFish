/** Summary statistics over a sorted Float64Array of simulated box values. */

export function mean(sorted: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < sorted.length; i++) s += sorted[i];
  return sorted.length ? s / sorted.length : NaN;
}

export function stdDev(sorted: ArrayLike<number>, mu = mean(sorted)): number {
  let s = 0;
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i] - mu;
    s += d * d;
  }
  return sorted.length > 1 ? Math.sqrt(s / (sorted.length - 1)) : 0;
}

/** Linear-interpolated quantile of a sorted array, q in [0, 1]. */
export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const pos = (n - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** `dots` equally likely outcomes: the (i + 0.5) / dots quantiles. */
export function quantileDots(sorted: ArrayLike<number>, dots = 20): number[] {
  return Array.from({ length: dots }, (_, i) => quantile(sorted, (i + 0.5) / dots));
}

/** Share of values at or above x (binary search on the sorted array). */
export function shareAtLeast(sorted: ArrayLike<number>, x: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return (n - lo) / n;
}

export interface HistogramBin {
  lo: number;
  hi: number;
  count: number;
  share: number;
}

/** A "nice" bin width (1, 2, 2.5, 5 × 10^k) giving roughly `target` bins over the central 99% of the data. */
export function niceBinWidth(sorted: ArrayLike<number>, target = 20): number {
  const lo = quantile(sorted, 0.005);
  const hi = quantile(sorted, 0.995);
  const span = Math.max(1e-9, hi - lo);
  const raw = span / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const e = raw / p;
  const m = e >= 5 ? 10 : e >= 2.5 ? 5 : e >= 2 ? 2.5 : e >= 1 ? 2 : 1;
  return m * p;
}

/** Fixed-width histogram over the central 99% of the data; the tails fold into the end bins. */
export function histogram(sorted: ArrayLike<number>, binWidth = niceBinWidth(sorted)): HistogramBin[] {
  const n = sorted.length;
  if (!n) return [];
  const lo = Math.floor(quantile(sorted, 0.005) / binWidth) * binWidth;
  const hi = Math.ceil(quantile(sorted, 0.995) / binWidth) * binWidth;
  const bins: HistogramBin[] = [];
  for (let x = lo; x < hi - 1e-9; x += binWidth) bins.push({ lo: x, hi: x + binWidth, count: 0, share: 0 });
  if (!bins.length) bins.push({ lo, hi: lo + binWidth, count: 0, share: 0 });
  for (let i = 0; i < n; i++) {
    let k = Math.floor((sorted[i] - lo) / binWidth);
    if (k < 0) k = 0;
    if (k >= bins.length) k = bins.length - 1;
    bins[k].count++;
  }
  for (const b of bins) b.share = b.count / n;
  return bins;
}

export interface Summary {
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export function summarize(sorted: ArrayLike<number>): Summary {
  const mu = mean(sorted);
  return {
    n: sorted.length,
    mean: mu,
    sd: stdDev(sorted, mu),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: quantile(sorted, 0.05),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95)
  };
}

/** Standard normal CDF via erf (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7), for the normal-approximation cross-check. */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z >= 0 ? erf : -erf));
}
