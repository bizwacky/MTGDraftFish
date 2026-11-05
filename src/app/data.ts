import type { CatalogEntry, DataIndex, SetData } from '../engine/types';

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
export const loadSet = (code: string) => get<SetData>(`data/sets/${code.toUpperCase()}.json`);
