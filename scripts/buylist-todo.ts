/**
 * Write buylist/todo.csv: the (card, finish) pairs that carry most of the expected value of each box on the
 * target list, in the buylist CSV format with the price left blank, for a person or a supervised agent to look up.
 *
 *   npm run buylist:todo                      # top 30 per box, TCGplayer Mid, default tiers
 *   npm run buylist:todo -- --sets MH2,UMA --top 40 --basis market --out buylist/todo-mh2.csv
 *   npm run buylist:todo -- --force           # overwrite a todo file that already has prices in it
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { boxMoments, cardContributions } from '../src/engine/analytic';
import { buildBoxModel } from '../src/engine/model';
import { applyBuylistOverlay } from '../src/engine/overlay';
import type { Basis, BuylistOverlay, DataIndex, RulesSpec, SetData } from '../src/engine/types';
import { rawPrice } from '../src/engine/value';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const root = process.cwd();
  const dataDir = path.join(root, 'public', 'data');
  const index = JSON.parse(await readFile(path.join(dataDir, 'index.json'), 'utf8')) as DataIndex;
  let overlay: BuylistOverlay | null = null;
  try {
    overlay = JSON.parse(await readFile(path.join(dataDir, 'local', 'buylist.json'), 'utf8')) as BuylistOverlay;
  } catch {
    /* none yet */
  }
  const only = opt('--sets')?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const top = parseInt(opt('--top') ?? '30', 10);
  const rules: RulesSpec = { basis: (opt('--basis') as Basis) ?? index.defaults.basis, tiers: index.defaults.tiers };
  const out = path.resolve(root, opt('--out') ?? 'buylist/todo.csv');

  // Refuse to clobber work in progress.
  try {
    const existing = await readFile(out, 'utf8');
    const filled = existing.split(/\r?\n/).slice(1).filter((l) => l.trim() && !l.trim().startsWith('#')).some((l) => l.split(',')[4]?.trim());
    if (filled && !flag('--force')) {
      console.error(`${path.relative(root, out)} already has prices filled in. Move those rows to buylist/gamenerdz.csv (any name works) or pass --force.`);
      process.exit(1);
    }
  } catch {
    /* no file yet */
  }

  const rows: string[] = [];
  const seen = new Set<string>();
  for (const entry of index.sets) {
    if (only && !only.includes(entry.code)) continue;
    const set = JSON.parse(await readFile(path.join(dataDir, 'sets', `${entry.code}.json`), 'utf8')) as SetData;
    applyBuylistOverlay(set, overlay);
    for (const ib of entry.boxes) {
      if (!ib.target) continue;
      const box = set.boxes.find((b) => b.uuid === ib.uuid);
      if (!box) continue;
      const model = buildBoxModel(set, box, rules);
      const ev = boxMoments(model).evBox;
      const contribs = cardContributions(model, set, rules).filter((c) => c.value > 0);
      const picked = contribs.slice(0, top);
      const share = picked.reduce((s, c) => s + c.share, 0);
      let added = 0;
      for (const c of picked) {
        const card = set.cards[c.card];
        const key = card.u + ':' + c.finish;
        if (seen.has(key)) continue;
        seen.add(key);
        added++;
        const ck = card.bq?.[c.finish] ? '' : card.b?.[c.finish];
        const existing = card.bq?.[c.finish];
        rows.push([
          card.s,
          card.c,
          csv(card.n),
          c.finish,
          '', // price: to be filled in
          '',
          '',
          csv(existing ? `already have ${existing.s} ${existing.d}: $${card.b?.[c.finish]}` : ''),
          c.rarity,
          fmt(rawPrice(card, c.finish, 'mid')),
          fmt(typeof ck === 'number' ? ck : null),
          csv(`${entry.code} ${box.subtype ?? box.booster}`),
          (c.share * 100).toFixed(1)
        ].join(','));
      }
      console.error(`${entry.code} ${box.subtype ?? box.booster}: top ${picked.length} card finishes carry ${(share * 100).toFixed(0)}% of ${Math.round(ev)} recoup EV (${added} new rows)`);
    }
  }
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, 'set,number,name,finish,price,source,date,notes,rarity,tcg_mid,ck_buylist,box,ev_share\n' + rows.join('\n') + '\n');
  console.error(`wrote ${path.relative(root, out)}: ${rows.length} rows to look up (fill price, source, date; blank price = not listed)`);
}

function csv(s: string): string {
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function fmt(x: number | null | undefined): string {
  return x == null ? '' : x.toFixed(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
