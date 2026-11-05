/**
 * Refresh the data the app reads: public/data/sets/<CODE>.json for every set in targets.json,
 * plus public/data/index.json (the target list) and public/data/catalog.json (every set with a box).
 *
 *   npm run refresh                 # all targets, using the .cache/ copies when fresh enough
 *   npm run refresh -- --force      # ignore the cache
 *   npm run refresh -- --sets INV,RAV
 *   npm run refresh -- --no-buylist # skip the 5.6 MB MTGJSON price file (no Card Kingdom buylist basis)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveBox } from '../src/engine/boxes';
import type { DataIndex, IndexSet, SetData, TargetsFile } from '../src/engine/types';
import { DEFAULT_RULES } from '../src/engine/value';
import { loadCustomBuylist } from '../src/pipeline/buylist';
import { buildCatalog, buildSet, type BuildContext } from '../src/pipeline/build';
import { setForceRefresh } from '../src/pipeline/http';
import { loadPricesToday, loadSetList } from '../src/pipeline/mtgjson';
import { loadLastUpdated } from '../src/pipeline/tcgcsv';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'public', 'data');
  const setsDir = path.join(outDir, 'sets');
  await mkdir(setsDir, { recursive: true });
  setForceRefresh(flag('--force'));

  const targetsFile = JSON.parse(await readFile(path.join(root, 'targets.json'), 'utf8')) as TargetsFile;
  const only = opt('--sets')?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const targets = targetsFile.targets.filter((t) => !only || only.includes(t.set.toUpperCase()));
  if (!targets.length) throw new Error('No targets to build. Check targets.json or --sets.');

  console.error(`Refreshing ${targets.length} target set(s)…`);
  const ctx: BuildContext = { tcgcsvUpdated: '?', customBuylist: [], setCache: new Map(), priceCache: new Map() };
  // TCGCSV publishes once a day around 20:00 UTC; its stamp keys the price cache so each day's files are fetched once.
  ctx.tcgcsvUpdated = await loadLastUpdated();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(ctx.tcgcsvUpdated)) throw new Error(`Unexpected TCGCSV last-updated response: ${ctx.tcgcsvUpdated.slice(0, 200)}`);
  console.error(`  stamp  TCGCSV last updated ${ctx.tcgcsvUpdated}`);
  if (!flag('--no-buylist')) {
    const p = await loadPricesToday();
    ctx.prices = p.data;
    ctx.pricesMeta = p.meta;
  }
  ctx.customBuylist = await loadCustomBuylist();
  if (ctx.customBuylist.length) console.error(`  read   ${ctx.customBuylist.length} hand-entered buylist row(s) from buylist/*.csv`);

  const built: { set: SetData; spec: (typeof targets)[number] }[] = [];
  const codes = [...new Set(targets.map((t) => t.set.toUpperCase()))];
  for (const code of codes) {
    try {
      const set = await buildSet(ctx, code);
      if (!set) continue;
      await writeFile(path.join(setsDir, `${set.code}.json`), JSON.stringify(set));
      for (const spec of targets.filter((t) => t.set.toUpperCase() === code)) built.push({ set, spec });
    } catch (e) {
      console.error(`  FAIL   ${code}: ${(e as Error).message}`);
      if (flag('--strict')) throw e;
    }
  }

  // index.json: one entry per set, every eligible box listed, the targeted one flagged.
  const bySet = new Map<string, IndexSet>();
  for (const { set, spec } of built) {
    let entry = bySet.get(set.code);
    if (!entry) {
      entry = {
        code: set.code,
        name: set.name,
        releaseDate: set.releaseDate,
        type: set.type,
        boxes: set.boxes.map((b) => ({ uuid: b.uuid, name: b.name, subtype: b.subtype, packs: b.packs, booster: b.booster, price: b.price, tcgId: b.tcgId, target: false })),
        unpricedCards: set.diagnostics.unpricedCards,
        sheetCards: set.diagnostics.sheetCards
      };
      bySet.set(set.code, entry);
    }
    const box = resolveBox(set, spec.box);
    if (!box) continue;
    const ib = entry.boxes.find((b) => b.uuid === box.uuid)!;
    ib.target = true;
    if (spec.price != null) ib.targetPrice = spec.price;
    if (spec.note) ib.note = spec.note;
  }
  const sets = [...bySet.values()].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  const defaults = {
    basis: targetsFile.defaults?.basis ?? DEFAULT_RULES.basis,
    tiers: targetsFile.defaults?.tiers ?? DEFAULT_RULES.tiers,
    boxes: targetsFile.defaults?.boxes ?? 20000
  };
  const index: DataIndex = {
    generatedAt: new Date().toISOString(),
    sources: built[0]?.set.sources ?? { mtgjson: { version: '?', date: '?' }, tcgcsv: { updated: ctx.tcgcsvUpdated } },
    defaults,
    sets
  };
  await writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1));

  // catalog.json: every set with a draftable box, for the "add a set" picker.
  if (!flag('--no-catalog')) {
    const setList = await loadSetList();
    const catalog = buildCatalog(setList.data);
    await writeFile(path.join(outDir, 'catalog.json'), JSON.stringify(catalog));
    console.error(`  wrote  catalog.json (${catalog.length} sets with a draftable box)`);
  }
  console.error(`Done: ${sets.length} set(s) in public/data/index.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
