import type { BoxProduct, SetData } from './types';

/** Box subtypes the calculator treats as draftable sealed product, in order of preference. */
export const BOX_PREFERENCE = ['draft', 'play', 'default', 'set', 'premium', 'collector'];

/** Pick the box a target refers to: by uuid, by subtype, or the most draft-like one. */
export function resolveBox(set: Pick<SetData, 'boxes' | 'code'>, selector?: string): BoxProduct | undefined {
  if (!set.boxes.length) return undefined;
  if (selector) {
    const byUuid = set.boxes.find((b) => b.uuid === selector);
    if (byUuid) return byUuid;
    const bySub = set.boxes.find((b) => (b.subtype ?? '').toLowerCase() === selector.toLowerCase());
    if (bySub) return bySub;
    const byBooster = set.boxes.find((b) => b.booster.toLowerCase() === selector.toLowerCase());
    if (byBooster) return byBooster;
  }
  for (const pref of BOX_PREFERENCE) {
    const b = set.boxes.find((x) => (x.subtype ?? x.booster) === pref);
    if (b) return b;
  }
  return set.boxes[0];
}

/** The box's own TCGplayer price: market, else mid, else low. */
export function boxMarketPrice(box: Pick<BoxProduct, 'price'>): number | null {
  const p = box.price;
  if (!p) return null;
  return p[2] ?? p[1] ?? p[0] ?? null;
}
