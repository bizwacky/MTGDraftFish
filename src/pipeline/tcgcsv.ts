import type { PriceTriple } from '../engine/types';
import { fetchJson, fetchText } from './http';

export const TCGCSV = 'https://tcgcsv.com/tcgplayer';
export const MAGIC_CATEGORY = 1;

interface PriceRow {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
  subTypeName: string;
}

export interface ProductPrices {
  normal?: PriceTriple;
  foil?: PriceTriple;
}

export type PriceTable = Map<number, ProductPrices>;

/**
 * Every price row of one TCGplayer group (a set), keyed by productId with Normal and Foil split.
 * TCGCSV publishes once a day; `stamp` (from last-updated.txt) keys the cache so a day's file is fetched once.
 */
export async function loadGroupPrices(groupId: number, stamp: string): Promise<PriceTable> {
  const res = await fetchJson<{ results: PriceRow[] }>(`${TCGCSV}/${MAGIC_CATEGORY}/${groupId}/prices`, { maxAgeHours: Infinity, cacheKey: stamp, pauseMs: 120, label: `TCGCSV prices group ${groupId}` });
  const table: PriceTable = new Map();
  for (const r of res.results) {
    const triple: PriceTriple = [num(r.lowPrice), num(r.midPrice), num(r.marketPrice)];
    if (triple.every((x) => x == null)) continue;
    const entry = table.get(r.productId) ?? {};
    if (r.subTypeName === 'Foil') entry.foil = triple;
    else entry.normal = triple;
    table.set(r.productId, entry);
  }
  return table;
}

/** The daily publication stamp, e.g. 2026-11-04T20:06:16+0000. Check it before syncing, as the usage guidelines ask. */
export async function loadLastUpdated(): Promise<string> {
  return fetchText('https://tcgcsv.com/last-updated.txt');
}

function num(x: number | null | undefined): number | null {
  return typeof x === 'number' && x > 0 ? x : null;
}

/** Merge several group tables; later tables win only where earlier ones have nothing. */
export function mergeTables(tables: PriceTable[]): PriceTable {
  const out: PriceTable = new Map();
  for (const t of tables) for (const [id, p] of t) {
    const cur = out.get(id);
    if (!cur) out.set(id, { ...p });
    else {
      if (!cur.normal && p.normal) cur.normal = p.normal;
      if (!cur.foil && p.foil) cur.foil = p.foil;
    }
  }
  return out;
}
