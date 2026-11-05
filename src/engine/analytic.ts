import type { PackModel, SheetModel } from './model';
import type { Finish, RulesSpec, SetData } from './types';
import { rawPrice } from './value';

export interface BoxMoments {
  packs: number;
  evPack: number;
  sdPack: number;
  evBox: number;
  sdBox: number;
  cardsPerBox: number;
}

/** Exact mean and standard deviation of a box under the model (packs independent, draws with replacement). */
export function boxMoments(model: PackModel, packs: number): BoxMoments {
  const evPack = model.mean;
  const sdPack = Math.sqrt(model.variance);
  return { packs, evPack, sdPack, evBox: packs * evPack, sdBox: Math.sqrt(packs * model.variance), cardsPerBox: packs * model.cardsPerPack };
}

export interface CardContribution {
  card: number;
  name: string;
  set: string;
  number: string;
  rarity: string;
  finish: Finish;
  /** Sheets the card is dealt from */
  sheets: string[];
  /** Price at the chosen basis, before rules */
  price: number | null;
  /** Value after the rules */
  value: number;
  /** Expected copies per box */
  copiesPerBox: number;
  /** Probability of at least one copy in a box */
  pAtLeastOne: number;
  /** Expected contribution to the box's recoup value */
  ev: number;
  /** Share of the box EV */
  share: number;
}

const entryCache = new WeakMap<SheetModel, Map<string, number>>();
function sheetEntry(sh: SheetModel, key: string): number {
  let m = entryCache.get(sh);
  if (!m) {
    m = new Map();
    for (let i = 0; i < sh.n; i++) m.set(sh.cardIdx[i] + ':' + sh.finish[i], i);
    entryCache.set(sh, m);
  }
  return m.get(key) ?? -1;
}

/**
 * Per-(card, finish) expected copies, hit chance and EV contribution for a box.
 * Draws are treated as independent with replacement; `fixed` sheets deal every card every time.
 */
export function cardContributions(model: PackModel, set: SetData, packs: number, rules: RulesSpec): CardContribution[] {
  // Every (card, finish) pair that can appear, with the sheets it sits on.
  const meta = new Map<string, { card: number; finish: Finish; value: number; sheets: Set<string> }>();
  for (const sh of model.sheets) {
    for (let i = 0; i < sh.n; i++) {
      const key = sh.cardIdx[i] + ':' + sh.finish[i];
      let m = meta.get(key);
      if (!m) {
        m = { card: sh.cardIdx[i], finish: sh.finish[i], value: sh.values[i], sheets: new Set() };
        meta.set(key, m);
      }
      m.sheets.add(sh.name);
    }
  }

  const evBox = packs * model.mean;
  const out: CardContribution[] = [];
  for (const [key, m] of meta) {
    let copiesPerPack = 0;
    let missPerPack = 0; // P(card absent from a pack) = Σ_variants p_v Π_slots (1 − p_c)^count
    for (const variant of model.variants) {
      let absent = 1;
      for (const slot of variant.slots) {
        const sh = model.sheets[slot.sheet];
        const idx = sheetEntry(sh, key);
        if (idx < 0) continue;
        if (sh.fixed) {
          copiesPerPack += variant.p * sh.probs[idx] * sh.weightSum;
          absent = 0;
        } else {
          copiesPerPack += variant.p * slot.count * sh.probs[idx];
          absent *= Math.pow(1 - sh.probs[idx], slot.count);
        }
      }
      missPerPack += variant.p * absent;
    }
    const card = set.cards[m.card];
    const copiesPerBox = packs * copiesPerPack;
    const ev = copiesPerBox * m.value;
    out.push({
      card: m.card,
      name: card.n,
      set: card.s,
      number: card.c,
      rarity: card.r,
      finish: m.finish,
      sheets: [...m.sheets],
      price: rawPrice(card, m.finish, rules.basis),
      value: m.value,
      copiesPerBox,
      pAtLeastOne: 1 - Math.pow(missPerPack, packs),
      ev,
      share: evBox > 0 ? ev / evBox : 0
    });
  }
  out.sort((a, b) => b.ev - a.ev || (b.price ?? 0) - (a.price ?? 0));
  return out;
}

export interface GroupContribution {
  group: string;
  ev: number;
  share: number;
}

/** EV of a box split by a card attribute (rarity by default), with foils kept separate. */
export function groupContributions(contribs: CardContribution[], keyOf: (c: CardContribution) => string = rarityFinishKey): GroupContribution[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const c of contribs) {
    const k = keyOf(c);
    map.set(k, (map.get(k) ?? 0) + c.ev);
    total += c.ev;
  }
  return [...map.entries()].map(([group, ev]) => ({ group, ev, share: total > 0 ? ev / total : 0 })).sort((a, b) => b.ev - a.ev);
}

export function rarityFinishKey(c: CardContribution): string {
  const r = c.rarity ? c.rarity.charAt(0).toUpperCase() + c.rarity.slice(1) : 'Unknown';
  return c.finish === 'nonfoil' ? r : `${r} (${c.finish})`;
}
