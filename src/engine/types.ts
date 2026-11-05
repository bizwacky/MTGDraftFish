/**
 * Data shapes shared by the pipeline (Node), the CLI and the browser app.
 *
 * A SetData file is written by `npm run refresh` into public/data/sets/<CODE>.json.
 * It is deliberately compact: cards are referenced by array index from the sheets.
 */

export type Finish = 'nonfoil' | 'foil' | 'etched';

/** Which price a card is valued at. Low/Mid/Market are TCGplayer (via TCGCSV); buylist is a cash buy price. */
export type Basis = 'low' | 'mid' | 'market' | 'buylist';

/** [low, mid, market] in USD; null where TCGplayer has no listing of that kind. */
export type PriceTriple = [number | null, number | null, number | null];

export interface CardRow {
  /** MTGJSON uuid */
  u: string;
  /** Card name */
  n: string;
  /** Set code the printing belongs to (may differ from the box's set, e.g. SPG in MH3 play boosters) */
  s: string;
  /** Collector number */
  c: string;
  /** Rarity: common | uncommon | rare | mythic | special | bonus | ... */
  r: string;
  /** Finishes available for this printing, as a string of flags: n = nonfoil, f = foil, e = etched */
  f: string;
  /** TCGplayer product id (nonfoil and foil share one product) */
  t?: number;
  /** TCGplayer product id for the etched printing, when separate */
  te?: number;
  /** TCGplayer prices by finish */
  p?: Partial<Record<Finish, PriceTriple>>;
  /** Buylist cash price by finish (USD) */
  b?: Partial<Record<Finish, number>>;
}

export interface SheetData {
  foil: boolean;
  fixed?: boolean;
  allowDuplicates?: boolean;
  balanceColors?: boolean;
  totalWeight: number;
  /** [card index into SetData.cards, weight] */
  cards: [number, number][];
}

export interface PackVariant {
  weight: number;
  /** sheet name -> number of cards drawn from it */
  contents: Record<string, number>;
}

export interface BoosterConfigData {
  name?: string;
  totalWeight: number;
  packs: PackVariant[];
  sheets: Record<string, SheetData>;
  sourceSetCodes: string[];
}

export interface BoxProduct {
  /** MTGJSON sealed product uuid */
  uuid: string;
  name: string;
  subtype?: string;
  /** Packs per box */
  packs: number;
  /** Key into SetData.boosters */
  booster: string;
  /** TCGplayer product id of the sealed box */
  tcgId?: number;
  /** TCGplayer price of the sealed box [low, mid, market] */
  price?: PriceTriple | null;
}

export interface SetSources {
  mtgjson: { version: string; date: string };
  tcgcsv: { updated: string };
  buylist?: { provider: string; date: string };
}

export interface SetDiagnostics {
  /** Distinct (card, finish) pairs on sheets with no usable TCGplayer price */
  unpricedCards: number;
  /** Distinct (card, finish) pairs on sheets */
  sheetCards: number;
  notes: string[];
}

export interface SetData {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  block?: string;
  generatedAt: string;
  sources: SetSources;
  cards: CardRow[];
  boosters: Record<string, BoosterConfigData>;
  boxes: BoxProduct[];
  diagnostics: SetDiagnostics;
}

/** One row of the watch list, as written in targets.json */
export interface TargetSpec {
  set: string;
  /** Box subtype (draft, play, set, collector, default) or a sealed product uuid. Defaults to the most draft-like box. */
  box?: string;
  /** Purchase price to test break-even against. Defaults to the box's TCGplayer market price. */
  price?: number;
  note?: string;
}

export interface TargetsFile {
  defaults?: Partial<RulesSpec> & { boxes?: number };
  targets: TargetSpec[];
}

/** A recoup rule: cards priced at or above `min` are valued at `pct` of the basis price. */
export interface Tier {
  min: number;
  /** Fraction 0..1 */
  pct: number;
}

export interface RulesSpec {
  basis: Basis;
  tiers: Tier[];
}

/** Written to public/data/index.json: what the app shows on the target list. */
export interface IndexBox {
  uuid: string;
  name: string;
  subtype?: string;
  packs: number;
  booster: string;
  price?: PriceTriple | null;
  tcgId?: number;
  /** True when this box is the one targets.json pointed at */
  target: boolean;
  /** Purchase price from targets.json, if any */
  targetPrice?: number;
  note?: string;
}

export interface IndexSet {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  boxes: IndexBox[];
  unpricedCards: number;
  sheetCards: number;
}

export interface DataIndex {
  generatedAt: string;
  sources: SetSources;
  defaults: { basis: Basis; tiers: Tier[]; boxes: number };
  sets: IndexSet[];
}

/** One entry of public/data/catalog.json: every set with a draftable booster box, for the picker. */
export interface CatalogEntry {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  boxes: { uuid: string; name: string; subtype?: string; packs: number; booster: string; tcgId?: number }[];
}
