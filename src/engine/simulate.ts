import type { PackModel } from './model';
import { buildAlias, makeRng, sampleAlias, type AliasTable } from './random';

export interface SimulationOptions {
  /** Boxes to open */
  boxes: number;
  /** Seed for a repeatable run */
  seed?: number;
  /** Progress callback every `progressEvery` boxes */
  onProgress?: (done: number, total: number) => void;
  progressEvery?: number;
}

/**
 * Open `boxes` boxes of `packs` packs each and return every box's recoup value, sorted ascending.
 * Sheets whose best card is worth 0 under the rules are skipped (they cannot change a total).
 * Sheets without `allowDuplicates` are drawn without replacement within a slot.
 */
export function simulateBoxes(model: PackModel, packs: number, opts: SimulationOptions): Float64Array {
  const rng = makeRng(opts.seed ?? 0x5eed);
  const variantAlias = buildAlias(model.variants.map((v) => v.p));
  const sheetAlias: (AliasTable | null)[] = model.sheets.map((s) => (s.fixed || s.maxValue <= 0 ? null : buildAlias(s.probs)));
  const out = new Float64Array(opts.boxes);
  const scratch = new Int32Array(64);
  const every = opts.progressEvery ?? 2000;

  for (let b = 0; b < opts.boxes; b++) {
    let total = 0;
    for (let p = 0; p < packs; p++) {
      const v = model.variants[model.variants.length === 1 ? 0 : sampleAlias(variantAlias, rng)];
      for (let s = 0; s < v.slots.length; s++) {
        const slot = v.slots[s];
        const sh = model.sheets[slot.sheet];
        if (sh.fixed) {
          total += sh.fixedSum;
          continue;
        }
        const alias = sheetAlias[slot.sheet];
        if (!alias) continue; // nothing on this sheet is worth anything under the rules
        const count = slot.count;
        if (count === 1 || sh.allowDuplicates || sh.n <= count || count > scratch.length) {
          for (let k = 0; k < count; k++) total += sh.values[sampleAlias(alias, rng)];
        } else {
          // without replacement: reject repeats within this slot
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
    }
    out[b] = total;
    if (opts.onProgress && (b + 1) % every === 0) opts.onProgress(b + 1, opts.boxes);
  }
  out.sort();
  return out;
}
