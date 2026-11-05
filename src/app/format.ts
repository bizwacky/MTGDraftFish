const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const fmtUsd = (x: number | null | undefined): string => (x == null || !isFinite(x) ? '–' : usd0.format(x).replace('-', '−'));
export const fmtUsd2 = (x: number | null | undefined): string => (x == null || !isFinite(x) ? '–' : usd2.format(x).replace('-', '−'));
export const fmtInt = (x: number | null | undefined): string => (x == null || !isFinite(x) ? '–' : int.format(x));
export const fmtPct = (x: number | null | undefined, d = 0): string => (x == null || !isFinite(x) ? '–' : (x * 100).toFixed(d) + '%');
export const fmtSigned = (x: number): string => (x > 0 ? '+' : x < 0 ? '−' : '') + fmtUsd(Math.abs(x));

/** "3 in 20" style frequency for a probability. */
export function inTwenty(p: number, n = 20): string {
  const k = Math.round(p * n);
  return `${k === 0 && p > 0 ? 'fewer than 1' : k} in ${n}`;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return n === 1 ? one : many;
}

/** Plural noun phrase for a rarity/finish group label, e.g. "Rare (foil)" → "Foil rares". */
export function groupPhrase(label: string): string {
  const m = /^(\w+)(?: \((\w+)\))?$/.exec(label);
  if (!m) return label;
  const base = m[1].toLowerCase();
  const noun = base === 'special' ? 'timeshifted and special cards' : base === 'bonus' ? 'bonus-sheet cards' : base + 's';
  const fin = m[2] ? (m[2] === 'nonfoil' ? '' : m[2] + ' ') : '';
  const phrase = fin + noun;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
