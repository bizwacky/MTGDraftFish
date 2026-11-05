/// <reference lib="webworker" />
import { buildBoxModel } from '../engine/model';
import { simulateBoxes } from '../engine/simulate';
import type { BoxProduct, RulesSpec, SetData } from '../engine/types';

export interface SimRequest {
  id: number;
  set?: SetData;
  setCode: string;
  box: BoxProduct;
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
    const model = buildBoxModel(set, req.box, req.rules);
    const sorted = simulateBoxes(model, { boxes: req.boxes, seed: req.seed });
    const res: SimResponse = { id: req.id, sorted };
    (self as unknown as Worker).postMessage(res, [sorted.buffer]);
  } catch (e) {
    const res: SimResponse = { id: req.id, error: (e as Error).message };
    (self as unknown as Worker).postMessage(res);
  }
};
