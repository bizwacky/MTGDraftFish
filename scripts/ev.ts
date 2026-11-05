/**
 * Terminal summary for one box, from the data in public/data/sets/ (plus local buylist quotes if present).
 *
 *   npm run ev -- INV
 *   npm run ev -- MH3 --box play --price 250 --basis market --min 2 --pct 0.6 --boxes 50000
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { boxMarketPrice, resolveBox } from '../src/engine/boxes';
import { boxMoments, cardContributions, groupContributions } from '../src/engine/analytic';
import { buildBoxModel } from '../src/engine/model';
import { applyBuylistOverlay } from '../src/engine/overlay';
import { simulateBoxes } from '../src/engine/simulate';
import { normalCdf, quantileDots, shareAtLeast, summarize } from '../src/engine/stats';
import type { Basis, BuylistOverlay, RulesSpec, SetData } from '../src/engine/types';
import { BASIS_LABEL, DEFAULT_RULES, STICKER_RULES } from '../src/engine/value';

const args = process.argv.slice(2);
const code = (args.find((a) => !a.startsWith('--') && !/^\d/.test(a) && args[args.indexOf(a) - 1]?.startsWith('--') !== true) ?? '').toUpperCase();
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!code) {
  console.error('usage: npm run ev -- <SET> [--box draft|play|set|collector|<uuid>] [--price N] [--basis low|mid|market|buylist] [--min 1] [--pct 0.7] [--boxes 20000]');
  process.exit(2);
}

const usd = (x: number) => '$' + x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const usd2 = (x: number) => '$' + x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function loadLocalOverlay(): Promise<BuylistOverlay | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', 'local', 'buylist.json'), 'utf8')) as BuylistOverlay;
  } catch {
    return null;
  }
}

async function main() {
  const set = JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', 'sets', `${code}.json`), 'utf8')) as SetData;
  const localQuotes = applyBuylistOverlay(set, await loadLocalOverlay());
  const box = resolveBox(set, opt('--box'));
  if (!box) throw new Error(`No box found for ${code}`);
  const rules: RulesSpec = {
    basis: (opt('--basis') as Basis) ?? DEFAULT_RULES.basis,
    tiers: [{ min: parseFloat(opt('--min') ?? '1'), pct: parseFloat(opt('--pct') ?? '0.7') }]
  };
  const nBoxes = parseInt(opt('--boxes') ?? '20000', 10);
  const price = opt('--price') ? parseFloat(opt('--price')!) : boxMarketPrice(box);

  const model = buildBoxModel(set, box, rules);
  const sticker = buildBoxModel(set, box, { ...STICKER_RULES, basis: rules.basis });
  const exact = boxMoments(model);
  const stickerEv = boxMoments(sticker).evBox;
  const t0 = Date.now();
  const sim = simulateBoxes(model, { boxes: nBoxes, seed: 20261105 });
  const ms = Date.now() - t0;
  const s = summarize(sim);
  const contribs = cardContributions(model, set, rules);
  const extras = model.extras.map((e) => `${e.count}× ${e.name}`).join(', ');

  console.log(`\n${set.name} (${set.code}) · ${box.name} · ${box.packs} packs × ~${model.main.cardsPerPack.toFixed(1)} cards${extras ? ' + ' + extras : ''}`);
  console.log(`Rules: ${BASIS_LABEL[rules.basis]}, ${Math.round(rules.tiers[0].pct * 100)}% of cards priced ≥ ${usd2(rules.tiers[0].min)}; cards below count as $0`);
  console.log(`Data: MTGJSON ${set.sources.mtgjson.version} · TCGCSV ${set.sources.tcgcsv.updated.slice(0, 10)}${set.sources.buylist ? ' · ' + set.sources.buylist.provider : ''}${localQuotes ? ` · ${localQuotes} local quote(s) overlaid` : ''} · ${set.diagnostics.unpricedCards}/${set.diagnostics.sheetCards} card finishes unpriced`);
  console.log('');
  console.log(`Sticker value (100% of every card):   ${usd(stickerEv)} per box`);
  console.log(`Recoup EV (exact):                    ${usd(exact.evBox)} per box  (${usd2(exact.evPack)} per pack${exact.evExtras ? `, ${usd2(exact.evExtras)} from extras` : ''})`);
  console.log(`Recoup SD (exact):                    ${usd(exact.sdBox)} per box`);
  console.log(`Simulated ${nBoxes.toLocaleString()} boxes in ${ms} ms: mean ${usd(s.mean)}, sd ${usd(s.sd)}, median ${usd(s.median)}, 5th–95th ${usd(s.p5)}–${usd(s.p95)}, min ${usd(s.min)}, max ${usd(s.max)}`);
  if (price != null) {
    const p = shareAtLeast(sim, price);
    const z = (price - exact.evBox) / exact.sdBox;
    console.log(`\nPurchase price ${usd(price)}${opt('--price') ? '' : ' (TCGplayer box price)'}: recoup EV is ${(exact.evBox / price * 100).toFixed(0)}% of price; expected ${exact.evBox - price >= 0 ? 'gain' : 'loss'} ${usd(Math.abs(exact.evBox - price))}`);
    console.log(`Break-even chance: ${Math.round(p * 20)} in 20 boxes (${(p * 100).toFixed(1)}%) by simulation; normal approximation ${((1 - normalCdf(z)) * 100).toFixed(1)}%`);
    const dots = quantileDots(sim, 20).map((d) => usd(d));
    console.log(`20 equally likely boxes: ${dots.join(' ')}`);
  }
  console.log('\nWhere the EV comes from:');
  for (const g of groupContributions(contribs)) console.log(`  ${g.group.padEnd(22)} ${usd(g.ev).padStart(8)}  ${(g.share * 100).toFixed(0).padStart(3)}%`);
  const showQuote = rules.basis === 'buylist';
  console.log('\nTop cards by EV contribution:');
  console.log('  ' + 'Card'.padEnd(34) + 'Set'.padEnd(5) + 'Rarity'.padEnd(10) + 'Finish'.padEnd(9) + 'Price'.padStart(9) + 'Value'.padStart(9) + 'Copies/box'.padStart(12) + 'P(≥1)'.padStart(8) + 'EV'.padStart(9) + (showQuote ? '  Quote' : ''));
  for (const c of contribs.slice(0, 20)) {
    const card = set.cards[c.card];
    const q = card.bq?.[c.finish];
    const quote = showQuote ? '  ' + (q ? `${q.s} ${q.d}` : card.b?.[c.finish] != null ? 'Card Kingdom' : '–') : '';
    console.log('  ' + c.name.slice(0, 33).padEnd(34) + c.set.padEnd(5) + c.rarity.padEnd(10) + c.finish.padEnd(9) + (c.price == null ? '–' : usd2(c.price)).padStart(9) + usd2(c.value).padStart(9) + c.copiesPerBox.toFixed(2).padStart(12) + (c.pAtLeastOne * 100).toFixed(0).padStart(7) + '%' + usd2(c.ev).padStart(9) + quote);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
