import type { BuylistOverlay, SetData } from './types';

/**
 * Lay hand-gathered buylist quotes over a set's cards: `b[finish]` takes the quote's price and
 * `bq[finish]` records its source and date. Returns the number of (card, finish) prices replaced.
 * The overlay is a local, uncommitted file; the committed data only ever carries public sources.
 */
export function applyBuylistOverlay(set: SetData, overlay: BuylistOverlay | null | undefined): number {
  if (!overlay) return 0;
  let n = 0;
  for (const card of set.cards) {
    const q = overlay.quotes[card.u];
    if (!q) continue;
    for (const finish of ['nonfoil', 'foil', 'etched'] as const) {
      const quote = q[finish];
      if (!quote || !(quote.price >= 0)) continue;
      card.b = { ...(card.b ?? {}), [finish]: quote.price };
      card.bq = { ...(card.bq ?? {}), [finish]: { s: quote.source, d: quote.date } };
      n++;
    }
  }
  return n;
}
