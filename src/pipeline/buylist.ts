import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BuylistOverlay, Finish } from '../engine/types';
import type { RawPricesToday, RawSet } from './mtgjson';

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
  source: string;
  date: string;
  file: string;
}

/**
 * Hand-gathered buylist quotes from buylist/*.csv (values you or a supervised agent read off a store's buylist).
 * Columns: set, number, name, finish, price, source, date. Rows with an empty price are skipped; a price of 0 means
 * "not buying". Matching is by set + collector number when a number is given, else set + name.
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
    const iSrc = col('source');
    const iDate = col('date');
    const today = new Date().toISOString().slice(0, 10);
    if (iSet < 0 || iPrice < 0 || (iNum < 0 && iName < 0)) {
      process.stderr.write(`  skip   buylist/${f}: needs columns set, price and number or name\n`);
      continue;
    }
    for (const line of lines.slice(1)) {
      const cells = splitCsv(line);
      const price = parseFloat((cells[iPrice] ?? '').trim().replace(/[$,]/g, ''));
      if (!Number.isFinite(price) || price < 0) continue;
      const finRaw = (iFin >= 0 ? cells[iFin] : '').trim().toLowerCase();
      const finish: Finish = finRaw === 'foil' ? 'foil' : finRaw === 'etched' ? 'etched' : 'nonfoil';
      rows.push({
        set: cells[iSet].trim().toUpperCase(),
        number: iNum >= 0 && cells[iNum]?.trim() ? cells[iNum].trim() : undefined,
        name: iName >= 0 && cells[iName]?.trim() ? cells[iName].trim() : undefined,
        finish,
        price,
        source: (iSrc >= 0 && cells[iSrc]?.trim()) || 'manual',
        date: (iDate >= 0 && cells[iDate]?.trim()) || today,
        file: f
      });
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

/** Resolve CSV rows to card uuids against the loaded set files and compile the local overlay. */
export function compileOverlay(rows: CustomBuylistRow[], sets: Iterable<RawSet>): { overlay: BuylistOverlay; unresolved: CustomBuylistRow[] } {
  const byNumber = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of sets) for (const c of s.cards) {
    const code = c.setCode.toUpperCase();
    byNumber.set(code + '|' + c.number, c.uuid);
    const nm = code + '|' + c.name.toLowerCase();
    if (!byName.has(nm)) byName.set(nm, c.uuid);
    const front = c.name.split(' // ')[0].toLowerCase();
    if (!byName.has(code + '|' + front)) byName.set(code + '|' + front, c.uuid);
  }
  const overlay: BuylistOverlay = { generatedAt: new Date().toISOString(), quotes: {} };
  const unresolved: CustomBuylistRow[] = [];
  for (const r of rows) {
    const uuid = r.number ? byNumber.get(r.set + '|' + r.number) : r.name ? byName.get(r.set + '|' + r.name.toLowerCase()) : undefined;
    if (!uuid) {
      unresolved.push(r);
      continue;
    }
    const q = (overlay.quotes[uuid] ??= {});
    q[r.finish] = { price: r.price, source: r.source, date: r.date };
  }
  return { overlay, unresolved };
}
