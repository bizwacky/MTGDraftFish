import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

export interface FetchOptions {
  /** Reuse a cached copy younger than this many hours (0 = always refetch, Infinity = immutable) */
  maxAgeHours?: number;
  /** Extra text mixed into the cache key, e.g. the source's publication stamp, so a new day never reuses old data */
  cacheKey?: string;
  /** Pause after a network fetch (polite rate limiting), in ms */
  pauseMs?: number;
  /** The body is gzip-compressed JSON */
  gzip?: boolean;
  label?: string;
}

export const CACHE_DIR = path.resolve(process.cwd(), '.cache');
/** TCGCSV asks every client to identify itself as Application/X.Y.Z. */
export const USER_AGENT = 'MTGDraftFish/0.1.0 (+https://github.com/bizwacky/MTGDraftFish)';

/** Plain-text GET with the same User-Agent (no cache). */
export async function fetchText(url: string): Promise<string> {
  const res = await fetchWithRetry(url);
  return (await res.text()).trim();
}
let force = false;
export function setForceRefresh(on: boolean): void {
  force = on;
}

const log = (msg: string) => process.stderr.write(msg + '\n');

/** GET a JSON document with a small on-disk cache under .cache/, so repeated local runs don't hammer the sources. */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const buf = await fetchBytes(url, opts);
  return JSON.parse(buf.toString('utf8')) as T;
}

export async function fetchBytes(url: string, opts: FetchOptions = {}): Promise<Buffer> {
  const key = createHash('sha1').update(url + '\n' + (opts.cacheKey ?? '')).digest('hex');
  const file = path.join(CACHE_DIR, key + (opts.gzip ? '.gz' : '.bin'));
  const maxAge = (opts.maxAgeHours ?? 12) * 3600 * 1000;
  if (!force && maxAge > 0) {
    try {
      const st = await stat(file);
      if (Date.now() - st.mtimeMs < maxAge) {
        const cached = await readFile(file);
        log(`  cache  ${opts.label ?? url} (${fmtBytes(cached.length)})`);
        return opts.gzip ? gunzipSync(cached) : cached;
      }
    } catch {
      /* no cache */
    }
  }
  const t0 = Date.now();
  const res = await fetchWithRetry(url);
  const raw = Buffer.from(await res.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, raw);
  log(`  fetch  ${opts.label ?? url} (${fmtBytes(raw.length)}, ${Date.now() - t0} ms)`);
  if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
  return opts.gzip ? gunzipSync(raw) : raw;
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json, text/plain, */*' } });
      if (res.status === 404) throw new NotFound(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (e) {
      if (e instanceof NotFound) throw e;
      lastErr = e;
      const wait = 1000 * Math.pow(2, i);
      log(`  retry  ${url} in ${wait} ms: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export class NotFound extends Error {
  constructor(url: string) {
    super(`Not found: ${url}`);
  }
}

export function fmtBytes(n: number): string {
  return n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n > 1e3 ? (n / 1e3).toFixed(0) + ' kB' : n + ' B';
}
