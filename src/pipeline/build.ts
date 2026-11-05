import type { BoxProduct, CardRow, CatalogEntry, Finish, PriceTriple, SetData, SetDiagnostics } from '../engine/types';
import { rawPrice, sheetFinish } from '../engine/value';
import { cardKingdomBuylist } from './buylist';
import { eligibleBoxes, loadSet, type RawCard, type RawMeta, type RawPricesToday, type RawSet, type RawSetListEntry } from './mtgjson';
import { loadGroupPrices, mergeTables, type PriceTable } from './tcgcsv';

const log = (msg: string) => process.stderr.write(msg + '\n');

export interface BuildContext {
  mtgjsonMeta?: RawMeta;
  tcgcsvUpdated: string;
  prices?: RawPricesToday;
  pricesMeta?: RawMeta;
  setCache: Map<string, RawSet>;
  priceCache: Map<number, PriceTable>;
}

async function getSet(ctx: BuildContext, code: string): Promise<RawSet> {
  const key = code.toUpperCase();
  let s = ctx.setCache.get(key);
  if (!s) {
    const res = await loadSet(key);
    s = res.data;
    ctx.mtgjsonMeta ??= res.meta;
    ctx.setCache.set(key, s);
  }
  return s;
}

async function getPrices(ctx: BuildContext, groupId: number): Promise<PriceTable> {
  let t = ctx.priceCache.get(groupId);
  if (!t) {
    t = await loadGroupPrices(groupId, ctx.tcgcsvUpdated);
    ctx.priceCache.set(groupId, t);
  }
  return t;
}

/** Build the compact SetData for one set: its draftable boxes, their booster configurations, and every card they can deal. */
export async function buildSet(ctx: BuildContext, code: string): Promise<SetData | null> {
  const set = await getSet(ctx, code);
  const boxes = eligibleBoxes(set.sealedProduct, set.code).filter((b) => set.booster?.[b.boosterKey]);
  if (!boxes.length) {
    log(`  skip   ${set.code}: no booster box with a known booster configuration`);
    return null;
  }
  const notes: string[] = [];
  for (const b of boxes) {
    const dropped = b.extras.filter((e) => !set.booster?.[e.boosterKey]);
    for (const e of dropped) notes.push(`${b.product.name}: ${e.count}× ${e.name} has no booster configuration "${e.boosterKey}" and is left out.`);
    for (const u of b.unresolved) notes.push(`${b.product.name}: ${u} is not a booster pack of this set and is left out.`);
    b.extras = b.extras.filter((e) => set.booster?.[e.boosterKey]);
  }
  const configKeys = [...new Set(boxes.flatMap((b) => [b.boosterKey, ...b.extras.map((e) => e.boosterKey)]))];

  // Every set whose cards can appear on these sheets.
  const sourceCodes = new Set<string>([set.code]);
  for (const k of configKeys) for (const s of set.booster![k].sourceSetCodes ?? []) sourceCodes.add(s.toUpperCase());
  const cardByUuid = new Map<string, RawCard>();
  const groupIds = new Set<number>();
  for (const sc of sourceCodes) {
    const s = sc === set.code ? set : await getSet(ctx, sc);
    for (const c of s.cards) cardByUuid.set(c.uuid, c);
    if (s.tcgplayerGroupId) groupIds.add(s.tcgplayerGroupId);
  }

  // Prices for every TCGplayer group involved.
  const tables: PriceTable[] = [];
  for (const g of groupIds) tables.push(await getPrices(ctx, g));
  const prices = mergeTables(tables);

  // Cards referenced by the sheets, indexed.
  const index = new Map<string, number>();
  const cards: CardRow[] = [];
  const missingUuids = new Set<string>();
  const addCard = (uuid: string): number => {
    let i = index.get(uuid);
    if (i != null) return i;
    const raw = cardByUuid.get(uuid);
    const row: CardRow = raw ? toCardRow(raw, prices, ctx) : { u: uuid, n: '(unknown card)', s: set.code, c: '', r: 'unknown', f: 'n' };
    if (!raw) missingUuids.add(uuid);
    i = cards.length;
    cards.push(row);
    index.set(uuid, i);
    return i;
  };

  const boosters: SetData['boosters'] = {};
  for (const k of configKeys) {
    const cfg = set.booster![k];
    const sheets: SetData['boosters'][string]['sheets'] = {};
    for (const [name, sh] of Object.entries(cfg.sheets)) {
      sheets[name] = {
        foil: !!sh.foil,
        ...(sh.fixed ? { fixed: true } : {}),
        ...(sh.allowDuplicates ? { allowDuplicates: true } : {}),
        ...(sh.balanceColors ? { balanceColors: true } : {}),
        totalWeight: sh.totalWeight,
        cards: Object.entries(sh.cards).map(([uuid, w]) => [addCard(uuid), w] as [number, number])
      };
    }
    boosters[k] = {
      ...(cfg.name ? { name: cfg.name } : {}),
      totalWeight: cfg.boostersTotalWeight,
      packs: cfg.boosters.map((b) => ({ weight: b.weight, contents: b.contents })),
      sheets,
      sourceSetCodes: cfg.sourceSetCodes ?? [set.code]
    };
  }

  const ownPrices = set.tcgplayerGroupId ? await getPrices(ctx, set.tcgplayerGroupId) : new Map();
  const boxProducts: BoxProduct[] = boxes.map((b) => {
    const tcgId = toInt(b.product.identifiers?.tcgplayerProductId);
    const price = tcgId ? ownPrices.get(tcgId)?.normal ?? null : null;
    return {
      uuid: b.product.uuid,
      name: b.product.name,
      ...(b.product.subtype ? { subtype: b.product.subtype } : {}),
      packs: b.packs,
      booster: b.boosterKey,
      ...(b.extras.length ? { extras: b.extras.map((e) => ({ booster: e.boosterKey, count: e.count, name: e.name })) } : {}),
      ...(tcgId ? { tcgId } : {}),
      price
    };
  });

  // Diagnostics: (card, finish) pairs on sheets that have no TCGplayer price at all.
  const seen = new Set<string>();
  let unpriced = 0;
  for (const cfg of Object.values(boosters)) for (const sh of Object.values(cfg.sheets)) for (const [ci] of sh.cards) {
    const card = cards[ci];
    const fin: Finish = sheetFinish(card, sh.foil);
    const key = ci + ':' + fin;
    if (seen.has(key)) continue;
    seen.add(key);
    if (rawPrice(card, fin, 'mid') == null) unpriced++;
  }
  if (missingUuids.size) notes.push(`${missingUuids.size} sheet entries refer to uuids missing from the source set files.`);
  const diagnostics: SetDiagnostics = { unpricedCards: unpriced, sheetCards: seen.size, notes };

  const data: SetData = {
    code: set.code,
    name: set.name,
    releaseDate: set.releaseDate,
    type: set.type,
    ...(set.block ? { block: set.block } : {}),
    generatedAt: new Date().toISOString(),
    sources: {
      mtgjson: { version: ctx.mtgjsonMeta?.version ?? '?', date: ctx.mtgjsonMeta?.date ?? '?' },
      tcgcsv: { updated: ctx.tcgcsvUpdated },
      ...(ctx.prices ? { buylist: { provider: 'Card Kingdom buylist via MTGJSON', date: ctx.pricesMeta?.date ?? '?' } } : {})
    },
    cards,
    boosters,
    boxes: boxProducts,
    diagnostics
  };
  log(`  built  ${set.code} ${set.name}: ${boxProducts.length} box(es), ${configKeys.length} config(s), ${cards.length} cards, ${unpriced}/${seen.size} unpriced${notes.length ? '; ' + notes.join(' ') : ''}`);
  return data;
}

function toCardRow(raw: RawCard, prices: PriceTable, ctx: BuildContext): CardRow {
  const finishes = raw.finishes ?? ['nonfoil'];
  const f = (finishes.includes('nonfoil') ? 'n' : '') + (finishes.includes('foil') ? 'f' : '') + (finishes.includes('etched') ? 'e' : '') || 'n';
  const t = toInt(raw.identifiers?.tcgplayerProductId);
  const te = toInt(raw.identifiers?.tcgplayerEtchedProductId);
  const row: CardRow = { u: raw.uuid, n: raw.name, s: raw.setCode, c: raw.number, r: raw.rarity, f };
  if (t) row.t = t;
  if (te) row.te = te;
  const p: Partial<Record<Finish, PriceTriple>> = {};
  if (t) {
    const pp = prices.get(t);
    if (pp?.normal) p.nonfoil = pp.normal;
    if (pp?.foil) p.foil = pp.foil;
  }
  if (te) {
    const pe = prices.get(te);
    const triple = pe?.foil ?? pe?.normal;
    if (triple) p.etched = triple;
  }
  if (Object.keys(p).length) row.p = p;
  // Buylist: Card Kingdom via MTGJSON (public). Hand-gathered quotes are a separate, local overlay.
  const b: Partial<Record<Finish, number>> | undefined = ctx.prices ? cardKingdomBuylist(ctx.prices, raw.uuid) : undefined;
  if (b && Object.keys(b).length) row.b = b;
  return row;
}

function toInt(x: string | number | undefined): number | undefined {
  if (x == null) return undefined;
  const n = typeof x === 'number' ? x : parseInt(x, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Every set with a draftable booster box, from SetList.json, for the picker. */
export function buildCatalog(setList: RawSetListEntry[]): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const s of setList) {
    if (s.isOnlineOnly) continue;
    const boxes = eligibleBoxes(s.sealedProduct, s.code);
    if (!boxes.length) continue;
    out.push({
      code: s.code,
      name: s.name,
      releaseDate: s.releaseDate,
      type: s.type,
      boxes: boxes.map((b) => ({
        uuid: b.product.uuid,
        name: b.product.name,
        ...(b.product.subtype ? { subtype: b.product.subtype } : {}),
        packs: b.packs,
        booster: b.boosterKey,
        ...(b.extras.length ? { extras: b.extras.map((e) => `${e.count}× ${e.name}`) } : {}),
        ...(toInt(b.product.identifiers?.tcgplayerProductId) ? { tcgId: toInt(b.product.identifiers?.tcgplayerProductId) } : {})
      }))
    });
  }
  out.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return out;
}
