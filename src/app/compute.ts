import { boxMoments, cardContributions, groupContributions, type BoxMoments, type CardContribution, type GroupContribution } from '../engine/analytic';
import { buildBoxModel, type BoxModel } from '../engine/model';
import { simulateBoxes } from '../engine/simulate';
import { histogram, niceBinWidth, quantileDots, shareAtLeast, summarize, type HistogramBin, type Summary } from '../engine/stats';
import type { BoxProduct, RulesSpec, SetData } from '../engine/types';
import { STICKER_RULES } from '../engine/value';
import type { SimRequest, SimResponse } from './sim.worker';

export const rulesKey = (rules: RulesSpec) => JSON.stringify({ b: rules.basis, t: rules.tiers.map((t) => [t.min, t.pct]) });

export interface Analytic {
  model: BoxModel;
  moments: BoxMoments;
  /** Box EV with every card at 100% of the basis price and no floor */
  stickerEv: number;
}

const analyticMemo = new Map<string, Analytic>();
export function analytic(set: SetData, box: BoxProduct, rules: RulesSpec): Analytic {
  const key = box.uuid + '|' + rulesKey(rules);
  let a = analyticMemo.get(key);
  if (!a) {
    const model = buildBoxModel(set, box, rules);
    const sticker = buildBoxModel(set, box, { ...STICKER_RULES, basis: rules.basis });
    a = { model, moments: boxMoments(model), stickerEv: boxMoments(sticker).evBox };
    analyticMemo.set(key, a);
  }
  return a;
}

const contribMemo = new Map<string, { cards: CardContribution[]; groups: GroupContribution[] }>();
export function contributions(set: SetData, box: BoxProduct, rules: RulesSpec) {
  const key = box.uuid + '|' + rulesKey(rules);
  let c = contribMemo.get(key);
  if (!c) {
    const cards = cardContributions(analytic(set, box, rules).model, set, rules);
    c = { cards, groups: groupContributions(cards) };
    contribMemo.set(key, c);
  }
  return c;
}

export interface SimResult {
  sorted: Float64Array;
  summary: Summary;
  dots20: number[];
  dots100: number[];
  bins: HistogramBin[];
  binWidth: number;
  pAtLeast(x: number): number;
}

function wrap(sorted: Float64Array): SimResult {
  const binWidth = niceBinWidth(sorted, 22);
  return { sorted, summary: summarize(sorted), dots20: quantileDots(sorted, 20), dots100: quantileDots(sorted, 100), bins: histogram(sorted, binWidth), binWidth, pAtLeast: (x) => shareAtLeast(sorted, x) };
}

/** One worker, requests queued in order; falls back to the main thread where workers are unavailable. */
class SimPool {
  private worker: Worker | null = null;
  private pending = new Map<number, { resolve: (r: Float64Array) => void; reject: (e: Error) => void }>();
  private loaded = new Set<string>();
  private nextId = 1;

  constructor() {
    try {
      this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev: MessageEvent<SimResponse>) => {
        const p = this.pending.get(ev.data.id);
        if (!p) return;
        this.pending.delete(ev.data.id);
        if (ev.data.sorted) p.resolve(ev.data.sorted);
        else p.reject(new Error(ev.data.error ?? 'simulation failed'));
      };
      this.worker.onerror = () => {
        for (const p of this.pending.values()) p.reject(new Error('simulation worker crashed'));
        this.pending.clear();
        this.worker = null;
        this.loaded.clear();
      };
    } catch {
      this.worker = null;
    }
  }

  run(set: SetData, box: BoxProduct, rules: RulesSpec, boxes: number, seed: number): Promise<Float64Array> {
    if (!this.worker) {
      const model = buildBoxModel(set, box, rules);
      return Promise.resolve(simulateBoxes(model, { boxes, seed }));
    }
    const id = this.nextId++;
    const req: SimRequest = { id, setCode: set.code, box: { uuid: box.uuid, name: box.name, packs: box.packs, booster: box.booster, extras: box.extras }, rules, boxes, seed };
    if (!this.loaded.has(set.code)) {
      req.set = set;
      this.loaded.add(set.code);
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage(req);
    });
  }
}

const pool = new SimPool();
const simMemo = new Map<string, Promise<SimResult>>();

/** Simulated box values for a box under the rules, memoised by (box, rules, count). Deterministic seed per key. */
export function simulate(set: SetData, box: BoxProduct, rules: RulesSpec, boxes: number): Promise<SimResult> {
  const key = box.uuid + '|' + rulesKey(rules) + '|' + boxes;
  let p = simMemo.get(key);
  if (!p) {
    const seed = 20261105 ^ hash(key);
    p = pool.run(set, box, rules, boxes, seed).then(wrap);
    p.catch(() => simMemo.delete(key));
    simMemo.set(key, p);
  }
  return p;
}

/** A simulation result that is already available, or undefined while it runs. */
const ready = new WeakMap<Promise<SimResult>, SimResult>();
export function simulateSync(set: SetData, box: BoxProduct, rules: RulesSpec, boxes: number): SimResult | undefined {
  const p = simulate(set, box, rules, boxes);
  const r = ready.get(p);
  if (r) return r;
  p.then((res) => ready.set(p, res)).catch(() => undefined);
  return undefined;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
