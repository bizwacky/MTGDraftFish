import { fetchJson } from './http';

export const MTGJSON = 'https://mtgjson.com/api/v5';

export interface RawMeta {
  date: string;
  version: string;
}
export interface RawSheet {
  cards: Record<string, number>;
  totalWeight: number;
  foil: boolean;
  fixed?: boolean;
  allowDuplicates?: boolean;
  balanceColors?: boolean;
}
export interface RawBoosterConfig {
  name?: string;
  boosters: { contents: Record<string, number>; weight: number }[];
  boostersTotalWeight: number;
  sheets: Record<string, RawSheet>;
  sourceSetCodes: string[];
}
export interface RawCard {
  uuid: string;
  name: string;
  number: string;
  rarity: string;
  setCode: string;
  finishes?: string[];
  identifiers?: { tcgplayerProductId?: string; tcgplayerEtchedProductId?: string };
}
export interface RawSealedProduct {
  uuid: string;
  name: string;
  category?: string;
  subtype?: string;
  cardCount?: number;
  contents?: {
    sealed?: { count: number; name: string; set: string; uuid: string }[];
    pack?: { code: string; set: string }[];
  };
  identifiers?: { tcgplayerProductId?: string };
}
export interface RawSet {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  block?: string;
  isOnlineOnly?: boolean;
  tcgplayerGroupId?: number;
  booster?: Record<string, RawBoosterConfig>;
  cards: RawCard[];
  sealedProduct?: RawSealedProduct[];
}
export interface RawSetListEntry {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  isOnlineOnly?: boolean;
  tcgplayerGroupId?: number;
  sealedProduct?: RawSealedProduct[];
}

export async function loadSet(code: string): Promise<{ meta: RawMeta; data: RawSet }> {
  return fetchJson(`${MTGJSON}/${code.toUpperCase()}.json`, { maxAgeHours: 20, label: `MTGJSON ${code.toUpperCase()}.json` });
}

export async function loadSetList(): Promise<{ meta: RawMeta; data: RawSetListEntry[] }> {
  return fetchJson(`${MTGJSON}/SetList.json`, { maxAgeHours: 20, label: 'MTGJSON SetList.json' });
}

/** Today's prices for every card, keyed by uuid. ~55 MB uncompressed, 5.6 MB over the wire. */
export type RawPricesToday = Record<string, { paper?: Record<string, { buylist?: Record<string, Record<string, number>>; retail?: Record<string, Record<string, number>>; currency?: string }> }>;
export async function loadPricesToday(): Promise<{ meta: RawMeta; data: RawPricesToday }> {
  return fetchJson(`${MTGJSON}/AllPricesToday.json.gz`, { maxAgeHours: 20, gzip: true, label: 'MTGJSON AllPricesToday.json.gz' });
}

export interface EligibleBox {
  product: RawSealedProduct;
  packs: number;
  boosterKey: string;
  packSet: string;
}

/** Box subtypes the calculator treats as draftable sealed product. */
export const ELIGIBLE_SUBTYPES = new Set(['draft', 'play', 'set', 'collector', 'default', 'premium']);

/** Booster boxes whose packs map to a booster configuration key: `box → N × pack → pack.contents.pack[0].code`. */
export function eligibleBoxes(sealed: RawSealedProduct[] | undefined, setCode: string): EligibleBox[] {
  if (!sealed) return [];
  const packs = new Map(sealed.filter((p) => p.category === 'booster_pack').map((p) => [p.uuid, p] as const));
  const out: EligibleBox[] = [];
  for (const box of sealed) {
    if (box.category !== 'booster_box') continue;
    if (!ELIGIBLE_SUBTYPES.has((box.subtype ?? 'default').toLowerCase())) continue;
    const inner = box.contents?.sealed;
    if (!inner || inner.length !== 1) continue;
    const pack = packs.get(inner[0].uuid);
    const spec = pack?.contents?.pack?.[0];
    if (!spec) continue;
    if (spec.set.toLowerCase() !== setCode.toLowerCase()) continue;
    out.push({ product: box, packs: inner[0].count, boosterKey: spec.code, packSet: spec.set.toUpperCase() });
  }
  return out;
}
