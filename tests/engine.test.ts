import { describe, expect, it } from 'vitest';
import {
  applyTiers,
  boxMoments,
  buildPackModel,
  cardContributions,
  cardValue,
  groupContributions,
  histogram,
  normalCdf,
  normalizeTiers,
  quantileDots,
  rawPrice,
  resolveBox,
  shareAtLeast,
  simulateBoxes,
  summarize,
  type CardRow,
  type RulesSpec,
  type SetData
} from '../src/engine';

const card = (n: string, r: string, mid: number, foilMid: number | null = null, f = 'nf'): CardRow => ({
  u: n,
  n,
  s: 'TST',
  c: n,
  r,
  f,
  t: 1,
  p: { nonfoil: [mid * 0.8, mid, mid * 0.95], ...(foilMid != null ? { foil: [foilMid * 0.8, foilMid, foilMid * 0.95] } : {}) },
  b: { nonfoil: mid * 0.5 }
});

/** A tiny set: 3 rares, 2 uncommons, 2 commons; a pack is 1 rare + 2 uncommons + 3 commons, with a 1-in-4 chance of a foil rare slot. */
function tinySet(): SetData {
  const cards = [card('Chase', 'rare', 40, 120), card('Playable', 'rare', 4), card('Bulk rare', 'rare', 0.5), card('Good unc', 'uncommon', 1.5), card('Bulk unc', 'uncommon', 0.1), card('Common A', 'common', 0.05), card('Common B', 'common', 2)];
  return {
    code: 'TST',
    name: 'Test',
    releaseDate: '2000-01-01',
    type: 'expansion',
    generatedAt: 'now',
    sources: { mtgjson: { version: 'x', date: 'd' }, tcgcsv: { updated: 'd' } },
    cards,
    boosters: {
      draft: {
        totalWeight: 4,
        sourceSetCodes: ['TST'],
        packs: [
          { weight: 3, contents: { rare: 1, uncommon: 2, common: 3 } },
          { weight: 1, contents: { rare: 1, uncommon: 2, common: 2, foilRare: 1 } }
        ],
        sheets: {
          rare: { foil: false, totalWeight: 4, cards: [[0, 1], [1, 1], [2, 2]] },
          foilRare: { foil: true, totalWeight: 3, cards: [[0, 1], [1, 1], [2, 1]] },
          uncommon: { foil: false, totalWeight: 2, cards: [[3, 1], [4, 1]] },
          common: { foil: false, totalWeight: 2, cards: [[5, 1], [6, 1]] }
        }
      }
    },
    boxes: [{ uuid: 'box-1', name: 'Test Booster Box', subtype: 'draft', packs: 36, booster: 'draft', price: [100, 120, 110] }],
    diagnostics: { unpricedCards: 0, sheetCards: 8, notes: [] }
  };
}

const rules: RulesSpec = { basis: 'mid', tiers: [{ min: 1, pct: 0.7 }] };

describe('pricing rules', () => {
  it('applies the threshold and percentage', () => {
    const t = normalizeTiers(rules.tiers);
    expect(applyTiers(0.99, t)).toBe(0);
    expect(applyTiers(1, t)).toBeCloseTo(0.7);
    expect(applyTiers(40, t)).toBeCloseTo(28);
    expect(applyTiers(null, t)).toBe(0);
  });
  it('picks the highest tier the price reaches', () => {
    const t = normalizeTiers([{ min: 1, pct: 0.6 }, { min: 20, pct: 0.8 }]);
    expect(applyTiers(5, t)).toBeCloseTo(3);
    expect(applyTiers(25, t)).toBeCloseTo(20);
  });
  it('reads the basis and falls back across finishes and figures', () => {
    const c = card('X', 'rare', 10, 30);
    expect(rawPrice(c, 'nonfoil', 'mid')).toBe(10);
    expect(rawPrice(c, 'nonfoil', 'low')).toBeCloseTo(8);
    expect(rawPrice(c, 'foil', 'market')).toBeCloseTo(28.5);
    expect(rawPrice(c, 'etched', 'mid')).toBe(30); // no etched price: falls back to foil
    expect(rawPrice(c, 'nonfoil', 'buylist')).toBe(5);
    expect(rawPrice(card('Y', 'rare', 10), 'foil', 'buylist')).toBe(5); // foil buylist missing: nonfoil
    const noMarket: CardRow = { ...c, p: { nonfoil: [1, 2, null] } };
    expect(rawPrice(noMarket, 'nonfoil', 'market')).toBe(2);
    expect(cardValue(c, 'foil', rules)).toBeCloseTo(21);
  });
});

describe('pack model and exact moments', () => {
  it('matches a hand computation of the pack EV', () => {
    const set = tinySet();
    const m = buildPackModel(set, 'draft', rules);
    // rare sheet: Chase 1/4 × 28 + Playable 1/4 × 2.8 + Bulk 2/4 × 0 = 7.7
    // uncommon: Good 1/2 × 1.05 + Bulk 0 = 0.525 per draw → 1.05 for 2
    // common: Common B 1/2 × 1.4 = 0.7 per draw → 2.1 for 3 (variant 1) or 1.4 for 2 (variant 2)
    // foilRare: Chase 1/3 × 84 + Playable 1/3 × 2.8 + Bulk 0 = 28.9333
    const v1 = 7.7 + 1.05 + 2.1;
    const v2 = 7.7 + 1.05 + 1.4 + 28.9333333;
    expect(m.variants[0].mean).toBeCloseTo(v1, 5);
    expect(m.variants[1].mean).toBeCloseTo(v2, 4);
    expect(m.mean).toBeCloseTo(0.75 * v1 + 0.25 * v2, 4);
    expect(m.cardsPerPack).toBeCloseTo(6);
    const box = boxMoments(m, 36);
    expect(box.evBox).toBeCloseTo(36 * m.mean, 6);
    expect(box.sdBox).toBeCloseTo(Math.sqrt(36 * m.variance), 6);
  });

  it('agrees with brute-force enumeration of the pack distribution', () => {
    const set = tinySet();
    const m = buildPackModel(set, 'draft', rules);
    // Enumerate every outcome of the pack with replacement and compare mean and variance.
    let mean = 0;
    let second = 0;
    for (const v of m.variants) {
      // distribution of the sum over slots via convolution of discrete distributions
      let dist = new Map<number, number>([[0, 1]]);
      for (const slot of v.slots) {
        const sh = m.sheets[slot.sheet];
        for (let k = 0; k < slot.count; k++) {
          const next = new Map<number, number>();
          for (const [val, p] of dist) for (let i = 0; i < sh.n; i++) {
            const nv = Math.round((val + sh.values[i]) * 1e6) / 1e6;
            next.set(nv, (next.get(nv) ?? 0) + p * sh.probs[i]);
          }
          dist = next;
        }
      }
      for (const [val, p] of dist) {
        mean += v.p * p * val;
        second += v.p * p * val * val;
      }
    }
    expect(m.mean).toBeCloseTo(mean, 6);
    expect(m.variance).toBeCloseTo(second - mean * mean, 5);
  });

  it('attributes EV to cards and groups', () => {
    const set = tinySet();
    const m = buildPackModel(set, 'draft', rules);
    const contribs = cardContributions(m, set, 36, rules);
    const total = contribs.reduce((s, c) => s + c.ev, 0);
    expect(total).toBeCloseTo(36 * m.mean, 6);
    const chase = contribs.find((c) => c.name === 'Chase' && c.finish === 'nonfoil')!;
    expect(chase.copiesPerBox).toBeCloseTo(36 * 0.25);
    expect(chase.pAtLeastOne).toBeCloseTo(1 - Math.pow(0.75, 36));
    const chaseFoil = contribs.find((c) => c.name === 'Chase' && c.finish === 'foil')!;
    expect(chaseFoil.copiesPerBox).toBeCloseTo(36 * 0.25 * (1 / 3));
    expect(chaseFoil.pAtLeastOne).toBeCloseTo(1 - Math.pow(1 - 0.25 / 3, 36));
    const groups = groupContributions(contribs);
    expect(groups.map((g) => g.group)).toContain('Rare (foil)');
    expect(groups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(1);
  });

  it('deals fixed sheets whole', () => {
    const set = tinySet();
    set.boosters.jump = {
      totalWeight: 1,
      sourceSetCodes: ['TST'],
      packs: [{ weight: 1, contents: { theme: 3 } }],
      sheets: { theme: { foil: false, fixed: true, totalWeight: 3, cards: [[0, 1], [1, 1], [6, 1]] } }
    };
    const m = buildPackModel(set, 'jump', rules);
    expect(m.mean).toBeCloseTo(28 + 2.8 + 1.4);
    expect(m.variance).toBe(0);
    const sim = simulateBoxes(m, 10, { boxes: 50, seed: 1 });
    expect(sim[0]).toBeCloseTo(10 * (28 + 2.8 + 1.4));
    expect(sim[49]).toBeCloseTo(10 * (28 + 2.8 + 1.4));
  });
});

describe('simulation', () => {
  it('reproduces the exact mean and SD within sampling error and is repeatable', () => {
    const set = tinySet();
    set.boosters.draft.sheets.rare.allowDuplicates = true;
    set.boosters.draft.sheets.uncommon.allowDuplicates = true;
    set.boosters.draft.sheets.common.allowDuplicates = true;
    const m = buildPackModel(set, 'draft', rules);
    const exact = boxMoments(m, 36);
    const a = simulateBoxes(m, 36, { boxes: 40000, seed: 42 });
    const b = simulateBoxes(m, 36, { boxes: 40000, seed: 42 });
    expect(Array.from(a.subarray(0, 50))).toEqual(Array.from(b.subarray(0, 50)));
    const s = summarize(a);
    const se = exact.sdBox / Math.sqrt(a.length);
    expect(Math.abs(s.mean - exact.evBox)).toBeLessThan(4 * se);
    expect(Math.abs(s.sd - exact.sdBox) / exact.sdBox).toBeLessThan(0.03);
    expect(shareAtLeast(a, s.median)).toBeGreaterThan(0.45);
    expect(shareAtLeast(a, s.median)).toBeLessThan(0.55);
    expect(shareAtLeast(a, -1)).toBe(1);
    expect(shareAtLeast(a, s.max + 1)).toBe(0);
    const dots = quantileDots(a, 20);
    expect(dots).toHaveLength(20);
    expect(dots[0]).toBeLessThanOrEqual(dots[19]);
    const bins = histogram(a);
    expect(bins.reduce((x, bin) => x + bin.count, 0)).toBe(a.length);
  });

  it('draws without replacement when duplicates are not allowed', () => {
    const set = tinySet();
    // A pack of 2 uncommons from a 2-card sheet: without replacement every pack has exactly one Good unc.
    set.boosters.only = {
      totalWeight: 1,
      sourceSetCodes: ['TST'],
      packs: [{ weight: 1, contents: { uncommon: 2 } }],
      sheets: { uncommon: { foil: false, totalWeight: 2, cards: [[3, 1], [4, 1]] } }
    };
    // n <= count falls back to with-replacement, so use a 3-card sheet with 2 draws instead.
    set.boosters.only.sheets.uncommon.cards = [[3, 1], [4, 1], [5, 1]];
    const m = buildPackModel(set, 'only', rules);
    const sim = simulateBoxes(m, 1, { boxes: 5000, seed: 7 });
    // Without replacement, two draws from {1.05, 0, 0} give 1.05 with probability 2/3 and never 2.1.
    expect(sim[sim.length - 1]).toBeCloseTo(1.05);
    const share = shareAtLeast(sim, 1.0);
    expect(share).toBeGreaterThan(0.63);
    expect(share).toBeLessThan(0.70);
  });
});

describe('normal cdf', () => {
  it('matches tabulated values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(0.41)).toBeCloseTo(0.659097, 5);
  });
});

describe('box resolution', () => {
  it('prefers draft, then play, then default', () => {
    const set = { code: 'X', boxes: [
      { uuid: 'c', name: 'Collector', subtype: 'collector', packs: 12, booster: 'collector' },
      { uuid: 'p', name: 'Play', subtype: 'play', packs: 36, booster: 'play' }
    ] } as unknown as SetData;
    expect(resolveBox(set)?.uuid).toBe('p');
    expect(resolveBox(set, 'collector')?.uuid).toBe('c');
    expect(resolveBox(set, 'c')?.uuid).toBe('c');
  });
});
