/// <reference lib="webworker" />
import { buildPackModel } from '../engine/model';
import { simulateBoxes } from '../engine/simulate';
import type { RulesSpec, SetData } from '../engine/types';

export interface SimRequest {
  id: number;
  set?: SetData;
  setCode: string;
  boosterKey: string;
  packs: number;
  rules: RulesSpec;
  boxes: number;
  seed: number;
}
export interface SimResponse {
  id: number;
  sorted?: Float64Array;
  error?: string;
}

const sets = new Map<string, SetData>();

self.onmessage = (ev: MessageEvent<SimRequest>) => {
  const req = ev.data;
  try {
    if (req.set) sets.set(req.setCode, req.set);
    const set = sets.get(req.setCode);
    if (!set) throw new Error(`Worker has no data for ${req.setCode}`);
    const model = buildPackModel(set, req.boosterKey, req.rules);
    const sorted = simulateBoxes(model, req.packs, { boxes: req.boxes, seed: req.seed });
    const res: SimResponse = { id: req.id, sorted };
    (self as unknown as Worker).postMessage(res, [sorted.buffer]);
  } catch (e) {
    const res: SimResponse = { id: req.id, error: (e as Error).message };
    (self as unknown as Worker).postMessage(res);
  }
};
