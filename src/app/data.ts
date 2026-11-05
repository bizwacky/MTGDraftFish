import { applyBuylistOverlay } from '../engine/overlay';
import type { BuylistOverlay, CatalogEntry, DataIndex, SetData } from '../engine/types';

const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
const memo = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  let p = memo.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(base + path, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status}). Run "npm run refresh" to build the data.`);
      return r.json() as Promise<T>;
    });
    memo.set(path, p);
  }
  return p;
}

export const loadIndex = () => get<DataIndex>('data/index.json');
export const loadCatalog = () => get<CatalogEntry[]>('data/catalog.json');

/** Quotes gathered by hand or by a supervised agent, present only on the machine that gathered them. */
let overlayPromise: Promise<BuylistOverlay | null> | undefined;
export function loadBuylistOverlay(): Promise<BuylistOverlay | null> {
  if (!overlayPromise) {
    overlayPromise = fetch(base + 'data/local/buylist.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<BuylistOverlay>) : null))
      .then((o) => (o && o.quotes && Object.keys(o.quotes).length ? o : null))
      .catch(() => null);
  }
  return overlayPromise;
}

export interface LoadedSet {
  set: SetData;
  /** (card, finish) prices replaced by local quotes */
  localQuotes: number;
}

const setMemo = new Map<string, Promise<LoadedSet>>();
export function loadSet(code: string): Promise<SetData> {
  return loadSetInfo(code).then((x) => x.set);
}
export function loadSetInfo(code: string): Promise<LoadedSet> {
  const key = code.toUpperCase();
  let p = setMemo.get(key);
  if (!p) {
    p = Promise.all([get<SetData>(`data/sets/${key}.json`), loadBuylistOverlay()]).then(([set, overlay]) => ({ set, localQuotes: applyBuylistOverlay(set, overlay) }));
    setMemo.set(key, p);
  }
  return p;
}
