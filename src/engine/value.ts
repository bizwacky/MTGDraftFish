import type { Basis, CardRow, Finish, RulesSpec, Tier } from './types';

/** Default recoup rules: 70% of TCGplayer Mid for cards worth $1 or more, nothing below. */
export const DEFAULT_RULES: RulesSpec = { basis: 'mid', tiers: [{ min: 1, pct: 0.7 }] };

/** "Sticker" rules: every card at 100% of the basis price, no floor. */
export const STICKER_RULES: RulesSpec = { basis: 'mid', tiers: [{ min: 0, pct: 1 }] };

const TRIPLE_INDEX: Record<Exclude<Basis, 'buylist'>, 0 | 1 | 2> = { low: 0, mid: 1, market: 2 };
/** If the requested TCGplayer figure is missing, fall back along this chain. */
const BASIS_FALLBACK: Record<Exclude<Basis, 'buylist'>, Exclude<Basis, 'buylist'>[]> = {
  low: ['low', 'mid', 'market'],
  mid: ['mid', 'market', 'low'],
  market: ['market', 'mid', 'low']
};
/** If the requested finish has no price, fall back along this chain. */
const FINISH_FALLBACK: Record<Finish, Finish[]> = {
  nonfoil: ['nonfoil', 'foil', 'etched'],
  foil: ['foil', 'etched', 'nonfoil'],
  etched: ['etched', 'foil', 'nonfoil']
};

/**
 * The market price of one printing in one finish, before any recoup rule.
 * Returns null when the source has no price at all for the card.
 */
export function rawPrice(card: CardRow, finish: Finish, basis: Basis): number | null {
  if (basis === 'buylist') {
    if (!card.b) return null;
    for (const f of FINISH_FALLBACK[finish]) {
      const v = card.b[f];
      if (typeof v === 'number' && v > 0) return v;
    }
    return null;
  }
  if (!card.p) return null;
  for (const f of FINISH_FALLBACK[finish]) {
    const triple = card.p[f];
    if (!triple) continue;
    for (const b of BASIS_FALLBACK[basis]) {
      const v = triple[TRIPLE_INDEX[b]];
      if (typeof v === 'number' && v > 0) return v;
    }
  }
  return null;
}

/** Tiers sorted so the highest threshold is tried first. */
export function normalizeTiers(tiers: Tier[]): Tier[] {
  return tiers
    .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.pct))
    .map((t) => ({ min: Math.max(0, t.min), pct: Math.max(0, t.pct) }))
    .sort((a, b) => b.min - a.min);
}

/** Apply recoup tiers to a price: the first tier whose `min` the price reaches sets the percentage; below every tier the card is worth 0. */
export function applyTiers(price: number | null, tiers: Tier[]): number {
  if (price == null || !(price > 0)) return 0;
  for (const t of tiers) if (price >= t.min) return price * t.pct;
  return 0;
}

/** What one card in one finish adds to the recoup total under the rules. */
export function cardValue(card: CardRow, finish: Finish, rules: RulesSpec, sortedTiers = normalizeTiers(rules.tiers)): number {
  return applyTiers(rawPrice(card, finish, rules.basis), sortedTiers);
}

/** The finish a sheet deals a card in: foil sheets deal foils, except for etched-only printings. */
export function sheetFinish(card: CardRow, sheetFoil: boolean): Finish {
  if (!sheetFoil) return card.f.includes('n') ? 'nonfoil' : card.f.includes('f') ? 'foil' : 'etched';
  if (card.f.includes('f')) return 'foil';
  if (card.f.includes('e')) return 'etched';
  return 'nonfoil';
}

export const BASIS_LABEL: Record<Basis, string> = {
  low: 'TCGplayer Low',
  mid: 'TCGplayer Mid',
  market: 'TCGplayer Market',
  buylist: 'Buylist (cash)'
};
