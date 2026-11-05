import type { BoxModel, PackModel } from './model';
import { buildAlias, makeRng, sampleAlias, type AliasTable, type Rng } from './random';

export interface SimulationOptions {
  /** Boxes to open */
  boxes: number;
  /** Seed for a repeatable run */
  seed?: number;
  /** Progress callback every `progressEvery` boxes */
  onProgress?: (done: number, total: number) => void;
  progressEvery?: number;
}

interface PackSampler {
  model: PackModel;
  count: number;
  variantAlias: AliasTable;
  sheetAlias: (AliasTable | null)[];
}

function sampler(model: PackModel, count: number): PackSampler {
  return {
    model,
    count,
    variantAlias: buildAlias(model.variants.map((v) => v.p)),
    // Sheets whose best card is worth 0 under the rules are skipped: they cannot change a total.
    sheetAlias: model.sheets.map((s) => (s.fixed || s.maxValue <= 0 ? null : buildAlias(s.probs)))
  };
}

const scratch = new Int32Array(64);

/** Open one pack and return its recoup value. Sheets without `allowDuplicates` are drawn without replacement within a slot. */
function openPack(ps: PackSampler, rng: Rng): number {
  const model = ps.model;
  const v = model.variants[model.variants.length === 1 ? 0 : sampleAlias(ps.variantAlias, rng)];
  let total = 0;
  for (let s = 0; s < v.slots.length; s++) {
    const slot = v.slots[s];
    const sh = model.sheets[slot.sheet];
    if (sh.fixed) {
      total += sh.fixedSum;
      continue;
    }
    const alias = ps.sheetAlias[slot.sheet];
    if (!alias) continue;
    const count = slot.count;
    if (count === 1 || sh.allowDuplicates || sh.n <= count || count > scratch.length) {
      for (let k = 0; k < count; k++) total += sh.values[sampleAlias(alias, rng)];
    } else {
      for (let k = 0; k < count; k++) {
        let idx = sampleAlias(alias, rng);
        let tries = 0;
        while (tries < 16) {
          let dup = false;
          for (let j = 0; j < k; j++) if (scratch[j] === idx) { dup = true; break; }
          if (!dup) break;
          idx = sampleAlias(alias, rng);
          tries++;
        }
        scratch[k] = idx;
        total += sh.values[idx];
      }
    }
  }
  return total;
}

/** Open `boxes` boxes (main packs plus extras) and return every box's recoup value, sorted ascending. */
export function simulateBoxes(box: BoxModel, opts: SimulationOptions): Float64Array {
  const rng = makeRng(opts.seed ?? 0x5eed);
  const samplers = box.components.map((c) => sampler(c.model, c.count));
  const out = new Float64Array(opts.boxes);
  const every = opts.progressEvery ?? 2000;
  for (let b = 0; b < opts.boxes; b++) {
    let total = 0;
    for (const ps of samplers) for (let p = 0; p < ps.count; p++) total += openPack(ps, rng);
    out[b] = total;
    if (opts.onProgress && (b + 1) % every === 0) opts.onProgress(b + 1, opts.boxes);
  }
  out.sort();
  return out;
}
