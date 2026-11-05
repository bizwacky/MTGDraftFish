import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Finish } from '../engine/types';
import type { RawPricesToday } from './mtgjson';

export interface BuylistQuote {
  nonfoil?: number;
  foil?: number;
  etched?: number;
}

/** Card Kingdom's buylist (cash) price per finish, from MTGJSON's daily price file. */
export function cardKingdomBuylist(prices: RawPricesToday, uuid: string): BuylistQuote | undefined {
  const ck = prices[uuid]?.paper?.cardkingdom?.buylist;
  if (!ck) return undefined;
  const q: BuylistQuote = {};
  const latest = (series?: Record<string, number>) => {
    if (!series) return undefined;
    const dates = Object.keys(series).sort();
    const v = dates.length ? series[dates[dates.length - 1]] : undefined;
    return typeof v === 'number' && v > 0 ? v : undefined;
  };
  const n = latest(ck.normal);
  const f = latest(ck.foil);
  const e = latest(ck.etched);
  if (n != null) q.nonfoil = n;
  if (f != null) q.foil = f;
  if (e != null) q.etched = e;
  return Object.keys(q).length ? q : undefined;
}

export interface CustomBuylistRow {
  set: string;
  number?: string;
  name?: string;
  finish: Finish;
  price: number;
}

/**
 * Hand-entered buylist quotes from buylist/*.csv (e.g. values you read off a store's buylist yourself).
 * Columns: set, number, name, finish, price. Matching is by set + collector number when a number is given, else set + name.
 */
export async function loadCustomBuylist(dir = path.resolve(process.cwd(), 'buylist')): Promise<CustomBuylistRow[]> {
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.csv'));
  } catch {
    return [];
  }
  const rows: CustomBuylistRow[] = [];
  for (const f of files) {
    const text = await readFile(path.join(dir, f), 'utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
    if (!lines.length) continue;
    const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const iSet = col('set');
    const iNum = col('number');
    const iName = col('name');
    const iFin = col('finish');
    const iPrice = col('price');
    if (iSet < 0 || iPrice < 0 || (iNum < 0 && iName < 0)) {
      process.stderr.write(`  skip   buylist/${f}: needs columns set, price and number or name\n`);
      continue;
    }
    for (const line of lines.slice(1)) {
      const cells = splitCsv(line);
      const price = parseFloat((cells[iPrice] ?? '').replace(/[$,]/g, ''));
      if (!(price > 0)) continue;
      const finRaw = (iFin >= 0 ? cells[iFin] : '').trim().toLowerCase();
      const finish: Finish = finRaw === 'foil' ? 'foil' : finRaw === 'etched' ? 'etched' : 'nonfoil';
      rows.push({ set: cells[iSet].trim().toUpperCase(), number: iNum >= 0 ? cells[iNum]?.trim() : undefined, name: iName >= 0 ? cells[iName]?.trim() : undefined, finish, price });
    }
  }
  return rows;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
