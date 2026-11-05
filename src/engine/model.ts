import type { Finish, RulesSpec, SetData, SheetData } from './types';
import { cardValue, normalizeTiers, sheetFinish } from './value';

/** One sheet of a booster configuration with every card already valued under the rules. */
export interface SheetModel {
  name: string;
  foil: boolean;
  fixed: boolean;
  allowDuplicates: boolean;
  /** Card index into SetData.cards, per entry */
  cardIdx: Int32Array;
  finish: Finish[];
  /** Draw probability per entry (weights normalised) */
  probs: Float64Array;
  /** Recoup value per entry */
  values: Float64Array;
  /** E[value] of one draw */
  mean: number;
  /** E[value^2] of one draw */
  m2: number;
  /** Largest value on the sheet; a sheet with maxValue 0 never changes a total */
  maxValue: number;
  /** For fixed sheets: the value of the whole sheet, dealt every time */
  fixedSum: number;
  /** Distinct entries */
  n: number;
  /** Sum of the raw sheet weights (for fixed sheets, the number of cards dealt) */
  weightSum: number;
}

export interface SlotModel {
  sheet: number;
  count: number;
}

export interface VariantModel {
  /** Probability this pack layout is the one opened */
  p: number;
  slots: SlotModel[];
  /** Expected value of a pack of this layout */
  mean: number;
  /** Variance of a pack of this layout (draws treated as independent) */
  variance: number;
  /** Cards in this layout */
  cards: number;
}

export interface PackModel {
  setCode: string;
  boosterKey: string;
  sheets: SheetModel[];
  variants: VariantModel[];
  /** Expected recoup value of one pack */
  mean: number;
  /** Variance of one pack's recoup value */
  variance: number;
  /** Expected number of cards in a pack */
  cardsPerPack: number;
}

function buildSheet(name: string, sheet: SheetData, set: SetData, rules: RulesSpec, tiers: ReturnType<typeof normalizeTiers>): SheetModel {
  const n = sheet.cards.length;
  const cardIdx = new Int32Array(n);
  const probs = new Float64Array(n);
  const values = new Float64Array(n);
  const finish: Finish[] = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) total += sheet.cards[i][1];
  if (!(total > 0)) total = 1;
  let mean = 0;
  let m2 = 0;
  let maxValue = 0;
  let fixedSum = 0;
  for (let i = 0; i < n; i++) {
    const [ci, w] = sheet.cards[i];
    const card = set.cards[ci];
    const fin = sheetFinish(card, sheet.foil);
    const v = card ? cardValue(card, fin, rules, tiers) : 0;
    cardIdx[i] = ci;
    probs[i] = w / total;
    values[i] = v;
    finish[i] = fin;
    mean += probs[i] * v;
    m2 += probs[i] * v * v;
    if (v > maxValue) maxValue = v;
    fixedSum += w * v;
  }
  return { name, foil: sheet.foil, fixed: !!sheet.fixed, allowDuplicates: !!sheet.allowDuplicates, cardIdx, finish, probs, values, mean, m2, maxValue, fixedSum, n, weightSum: total };
}

/**
 * Turn a set's booster configuration into a valued pack model.
 * Sheet draws are modelled as independent draws with replacement; `fixed` sheets are dealt whole.
 */
export function buildPackModel(set: SetData, boosterKey: string, rules: RulesSpec): PackModel {
  const cfg = set.boosters[boosterKey];
  if (!cfg) throw new Error(`Set ${set.code} has no booster configuration "${boosterKey}" (has: ${Object.keys(set.boosters).join(', ')})`);
  const tiers = normalizeTiers(rules.tiers);
  const sheetNames = Object.keys(cfg.sheets);
  const sheetIndex = new Map(sheetNames.map((s, i) => [s, i] as const));
  const sheets = sheetNames.map((s) => buildSheet(s, cfg.sheets[s], set, rules, tiers));

  let totalWeight = 0;
  for (const p of cfg.packs) totalWeight += p.weight;
  if (!(totalWeight > 0)) totalWeight = 1;

  const variants: VariantModel[] = cfg.packs.map((pack) => {
    const slots: SlotModel[] = [];
    let mean = 0;
    let variance = 0;
    let cards = 0;
    for (const [sheetName, count] of Object.entries(pack.contents)) {
      const si = sheetIndex.get(sheetName);
      if (si == null) throw new Error(`Set ${set.code} booster "${boosterKey}": pack refers to unknown sheet "${sheetName}"`);
      const sh = sheets[si];
      slots.push({ sheet: si, count });
      if (sh.fixed) {
        mean += sh.fixedSum;
        cards += sh.weightSum;
      } else {
        mean += count * sh.mean;
        variance += count * (sh.m2 - sh.mean * sh.mean);
        cards += count;
      }
    }
    return { p: pack.weight / totalWeight, slots, mean, variance, cards };
  });

  // Mixture over pack layouts: E = Σ p_i μ_i ; Var = Σ p_i (σ_i² + μ_i²) − E²
  let mean = 0;
  let second = 0;
  let cardsPerPack = 0;
  for (const v of variants) {
    mean += v.p * v.mean;
    second += v.p * (v.variance + v.mean * v.mean);
    cardsPerPack += v.p * v.cards;
  }
  const variance = Math.max(0, second - mean * mean);
  return { setCode: set.code, boosterKey, sheets, variants, mean, variance, cardsPerPack };
}
