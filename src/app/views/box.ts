import { boxMarketPrice } from '../../engine/boxes';
import type { BoxProduct, DataIndex, IndexBox, SetData } from '../../engine/types';
import { BASIS_LABEL } from '../../engine/value';
import { normalCdf } from '../../engine/stats';
import { analytic, contributions, simulate, simulateSync } from '../compute';
import { loadSetInfo } from '../data';
import { clear, debounce, h } from '../dom';
import { fmtInt, fmtPct, fmtUsd, groupPhrase, inTwenty, plural } from '../format';
import type { Store } from '../state';
import { mountSettings } from './settings';
import { REPO, priceFor, rulesSentence, sourceLine } from './targets';

export function mountBox(root: HTMLElement, index: DataIndex, store: Store, uuid: string, navigate: (hash: string) => void): () => void {
  const subs: (() => void)[] = [];
  const setEntry = index.sets.find((s) => s.boxes.some((b) => b.uuid === uuid));
  if (!setEntry) {
    root.append(h('p', { class: 'status error t-dek' }, `No box with id ${uuid} is on the list.`), h('p', null, h('a', { href: '#/' }, '← Back to the target list')));
    return () => undefined;
  }
  const indexBox = setEntry.boxes.find((b) => b.uuid === uuid)!;

  const head = h('header');
  const controls = h('div', { class: 'panel' });
  const settingsEl = h('div', { class: 'panel' });
  const status = h('p', { class: 'status t-dek' }, 'Loading set data…');
  const kpis = h('div', { class: 'kpis' });
  const figHero = h('div', { class: 'fig' });
  const figHist = h('div', { class: 'fig' });
  const figGroups = h('div', { class: 'fig' });
  const figCards = h('div', { class: 'fig fig-cards' });
  const notes = h('section', { class: 'section' });
  root.append(head, controls, settingsEl, status, kpis, figHero, figHist, figGroups, figCards, notes);
  subs.push(mountSettings(settingsEl, store, { buylistAvailable: !!index.sources.buylist }));

  let set: SetData | null = null;
  let box: BoxProduct | null = null;
  let localQuotes = 0;
  let disposed = false;
  const refreshSoon = debounce(() => !disposed && refresh(), 60);

  loadSetInfo(setEntry.code)
    .then(({ set: s, localQuotes: n }) => {
      set = s;
      localQuotes = n;
      box = s.boxes.find((b) => b.uuid === uuid) ?? null;
      if (!box) throw new Error(`Box ${uuid} is missing from ${s.code}.json; run npm run refresh.`);
      document.title = `${box.name} · MTGDraftFish`;
      status.remove();
      buildHead();
      refresh();
    })
    .catch((e: Error) => {
      status.textContent = e.message;
      status.classList.add('error');
    });

  subs.push(store.subscribe((_, change) => {
    if (change === 'settings' || change === 'prices') refresh();
  }));

  function buildHead() {
    const b = box!;
    const s = set!;
    clear(head);
    head.append(
      h('p', { class: 'page-kicker t-kicker' }, h('a', { href: '#/', style: { color: 'inherit' } }, 'Target list'), ` · ${s.code} · ${s.releaseDate.slice(0, 4)} · ${s.type.replace('_', ' ')} · ${b.packs} packs${b.extras?.length ? ' + ' + b.extras.map((e) => `${e.count} ${e.name.replace(s.name, '').trim().toLowerCase()}`).join(', ') : ''}`),
      h('h1', { class: 'page-title t-headline' }, b.name)
    );
    if (indexBox.note) head.append(h('p', { class: 'page-dek lede t-dek' }, indexBox.note));
    clear(controls);
    const market = boxMarketPrice(b);
    const input = h('input', { type: 'number', class: 'in-money', min: 0, step: 1, inputmode: 'decimal', 'aria-label': 'Purchase price',
      onchange: () => { const v = parseFloat(input.value); store.setPrice(b.uuid, Number.isFinite(v) && v > 0 ? v : null); if (!(v > 0)) input.value = priceFor(store, indexBox)?.toFixed(0) ?? ''; }
    });
    input.value = priceFor(store, indexBox)?.toFixed(0) ?? '';
    const reset = h('button', { type: 'button', class: 'ht-btn ht-btn--small', disabled: market == null, onclick: () => { store.setPrice(b.uuid, null); input.value = priceFor(store, indexBox)?.toFixed(0) ?? ''; } }, 'Use TCGplayer price');
    controls.append(
      h('p', { class: 'panel-title t-kicker' }, 'This box'),
      h('label', { class: 'field' }, h('span', { class: 'field-label t-label' }, 'Purchase price, $'), h('div', { class: 'field-row' }, input, reset)),
      h('div', { class: 'field' }, h('span', { class: 'field-label t-label' }, 'TCGplayer sealed price'), h('span', { class: 'field-row' }, market != null ? `${fmtUsd(market)} ${b.price?.[2] != null ? 'market' : b.price?.[1] != null ? 'mid' : 'low'}` : 'none listed'))
    );
    if (s.boxes.length > 1) {
      const sel = h('select', { 'aria-label': 'Box product', onchange: () => navigate(`#/box/${sel.value}`) }, s.boxes.map((x) => h('option', { value: x.uuid, selected: x.uuid === b.uuid }, `${x.name} (${x.packs} packs)`)));
      controls.append(h('label', { class: 'field' }, h('span', { class: 'field-label t-label' }, 'Other boxes of this set'), sel));
    }
  }

  function refresh() {
    if (!set || !box) return;
    const s = set;
    const b = box;
    const rules = store.rules;
    const nBoxes = store.state.settings.boxes;
    const price = priceFor(store, indexBox);
    const a = analytic(s, b, rules);
    const sim = simulateSync(s, b, rules, nBoxes);
    if (!sim) simulate(s, b, rules, nBoxes).then(refreshSoon).catch((e: Error) => { status.textContent = e.message; status.classList.add('error'); root.insertBefore(status, kpis); });
    const { cards, groups } = contributions(s, b, rules);
    const pBE = sim && price != null ? sim.pAtLeast(price) : null;
    const ev = a.moments.evBox;
    const sd = a.moments.sdBox;
    const basisName = BASIS_LABEL[rules.basis];
    const setShort = s.name;
    const extrasText = b.extras?.length ? ' plus ' + b.extras.map((e) => `${e.count} ${e.name.replace(s.name, '').trim().toLowerCase()}`).join(' and ') : '';
    const localHere = rules.basis === 'buylist' ? cards.filter((c) => s.cards[c.card].bq?.[c.finish]).length : 0;

    // KPIs
    clear(kpis);
    Halftone.render.StatTile(kpis, { tiles: [
      { label: 'Expected recoup value per box', value: ev, format: '$int', hero: false, note: price != null ? `${fmtPct(ev / price)} of a ${fmtUsd(price)} purchase price` : 'Enter a purchase price to compare' },
      { label: 'Standard deviation', value: sd, format: '$int', note: `${fmtUsd(a.moments.sdPack)} per pack, ${fmtUsd(a.moments.evPack)} expected per pack${a.moments.evExtras ? `, ${fmtUsd(a.moments.evExtras)} from the box topper` : ''}` },
      { label: 'Median box', value: sim ? sim.summary.median : null, format: '$int', note: sim ? `5th–95th percentile ${fmtUsd(sim.summary.p5)}–${fmtUsd(sim.summary.p95)}` : 'Simulating…' },
      { label: 'Recoups the purchase price', value: pBE == null ? (price == null ? '–' : '…') : inTwenty(pBE), note: pBE == null ? `${nBoxes.toLocaleString('en-US')} boxes simulated` : `${fmtPct(pBE, 1)} of ${nBoxes.toLocaleString('en-US')} simulated boxes` },
      { label: 'Sticker value', value: a.stickerEv, format: '$int', note: `every card at 100% of ${basisName}, no floor` }
    ] });

    // Hero: 20 equally likely boxes against the purchase price
    clear(figHero);
    if (sim) {
      const k = price != null ? sim.dots20.filter((d) => d >= price).length : 0;
      const title = price == null ? `${setShort}: 20 equally likely boxes, from ${fmtUsd(sim.dots20[0])} to ${fmtUsd(sim.dots20[19])}` : k === 0 ? `A ${fmtUsd(price)} ${setShort} box recoups its price in none of 20 openings` : k === 20 ? `A ${fmtUsd(price)} ${setShort} box recoups its price in every one of 20 openings` : `A ${fmtUsd(price)} ${setShort} box recoups its price in ${k} of 20 openings`;
      Halftone.render.Figure(figHero, {
        variant: 'signal',
        kicker: 'Fig. 01 · Break-even',
        title,
        dek: `Recoup value of one ${b.name} shown as 20 equally likely outcomes, US dollars, from ${nBoxes.toLocaleString('en-US')} simulated boxes. ${rulesSentence(store)}.`,
        chart: { type: 'QuantileDotPlot', quantiles: sim.dots20, dots: 20, format: '$int', valueLabel: 'Box recoup value, $', ...(price != null ? { threshold: { value: price, direction: 'above', label: `Purchase price ${fmtUsd(price)}`, phrase: 'recoup the purchase price' } } : {}) },
        howToRead: 'Each dot is one of 20 equally likely boxes. Count the bright dots at or to the right of the line to read the chance a box pays for itself.',
        notes: price != null && pBE != null ? `Exact chance from the simulation: ${fmtPct(pBE, 1)}. A normal approximation with the exact mean and standard deviation gives ${fmtPct(1 - normalCdf((price - ev) / sd), 1)}; the true distribution is right-skewed by chase cards, so the simulation is the better guide in the tails.` : undefined,
        source: sourceLine(index),
        codeUrl: REPO,
        filename: `${s.code}-break-even`
      });
    }

    // Distribution histogram
    clear(figHist);
    if (sim) {
      const data = sim.bins.map((bin) => ({ bin: fmtUsd(bin.lo), share: bin.share, lo: bin.lo }));
      const aboveBins = price != null ? data.filter((d) => d.lo + sim.binWidth > price).map((d) => d.bin) : [];
      Halftone.render.Figure(figHist, {
        kicker: 'Fig. 02 · Distribution',
        title: `Half of all ${setShort} boxes land between ${fmtUsd(sim.summary.p25)} and ${fmtUsd(sim.summary.p75)}`,
        dek: `Share of ${nBoxes.toLocaleString('en-US')} simulated boxes by recoup value, in ${fmtUsd(sim.binWidth)} bins (lower edge labelled); the outer 1% of boxes fold into the end bins.${price == null ? '' : aboveBins.length ? ` Bins reaching the ${fmtUsd(price)} purchase price are in blue, the rest in grey.` : ` No bin reaches the ${fmtUsd(price)} purchase price.`}`,
        chart: { type: 'BarChart', data, category: 'bin', value: 'share', orientation: 'vertical', sort: 'none', values: 'axis', format: 'percent1', highlight: aboveBins, name: 'Share of boxes', categoryLabel: 'Box value from, $', valueLabel: 'Share of boxes' },
        notes: `Mean ${fmtUsd(sim.summary.mean)}, standard deviation ${fmtUsd(sim.summary.sd)} in the simulation; exact mean ${fmtUsd(ev)} and standard deviation ${fmtUsd(sd)} under the sheet model. Lowest box ${fmtUsd(sim.summary.min)}, highest ${fmtUsd(sim.summary.max)}.`,
        source: sourceLine(index),
        codeUrl: REPO,
        filename: `${s.code}-distribution`
      });
    }

    // Where the value sits
    clear(figGroups);
    if (groups.length) {
      const top = groups[0];
      Halftone.render.Figure(figGroups, {
        kicker: 'Fig. 03 · Where the value sits',
        title: `${groupPhrase(top.group)} carry ${fmtPct(top.share)} of the box’s expected value`,
        dek: `Expected recoup value per box by rarity and finish, US dollars. ${b.packs} ${plural(b.packs, 'pack')} of ${a.model.main.cardsPerPack.toFixed(1)} cards${extrasText}.`,
        chart: { type: 'BarChart', data: groups.map((g) => ({ group: g.group, ev: g.ev })), category: 'group', value: 'ev', format: '$int', sort: 'desc', name: 'EV per box', categoryLabel: 'Rarity (finish)', valueLabel: 'EV per box, $' },
        notes: `Timeshifted, bonus-sheet and other special printings keep their MTGJSON rarity ("special", "bonus").`,
        source: sourceLine(index),
        codeUrl: REPO,
        filename: `${s.code}-by-rarity`
      });
    }

    // Top cards
    clear(figCards);
    const TOP = 25;
    const topCards = cards.slice(0, TOP);
    const topShare = topCards.reduce((x, c) => x + c.share, 0);
    const unpriced = s.diagnostics.unpricedCards;
    Halftone.render.Figure(figCards, {
      kicker: 'Fig. 04 · The cards that matter',
      title: `The top ${Math.min(TOP, cards.length)} cards account for ${fmtPct(topShare)} of the expected value`,
      dek: `Cards ranked by expected contribution to one box’s recoup value. Price is ${basisName}; “counts as” applies the recoup rules; copies and chances are per ${b.packs}-pack box.`,
      chart: {
        type: 'DataTable',
        caption: `Top ${Math.min(TOP, cards.length)} of ${cards.length} card finishes`,
        columns: [
          { key: 'name', label: 'Card' },
          { key: 'set', label: 'Set' },
          { key: 'rarity', label: 'Rarity' },
          { key: 'finish', label: 'Finish' },
          { key: 'price', label: 'Price, $', format: '$number2', numeric: true },
          ...(rules.basis === 'buylist' ? [{ key: 'quote', label: 'Quote' }] : []),
          { key: 'value', label: 'Counts as, $', format: '$number2', numeric: true },
          { key: 'copies', label: 'Copies per box', format: 'number2', numeric: true },
          { key: 'p1', label: 'Chance of 1+ per box', format: 'percent0', numeric: true },
          { key: 'ev', label: 'EV per box, $', format: '$number2', numeric: true },
          { key: 'share', label: 'Share of EV', format: 'percent1', numeric: true }
        ],
        rows: topCards.map((c) => {
          const card = s.cards[c.card];
          const q = card.bq?.[c.finish];
          const quote = q ? `${q.s} ${q.d}` : card.b?.[c.finish] != null ? 'Card Kingdom' : 'none';
          return { name: c.name, set: c.set, rarity: c.rarity, finish: c.finish, price: c.price, quote, value: c.value, copies: c.copiesPerBox, p1: c.pAtLeastOne, ev: c.ev, share: c.share };
        })
      },
      notes: [
        unpriced ? `Caution: ${unpriced} of ${s.diagnostics.sheetCards} card finishes on the sheets have no TCGplayer price and count as $0.` : `All ${s.diagnostics.sheetCards} card finishes on the sheets have a TCGplayer price.`,
        ...(rules.basis === 'buylist' ? [localHere ? `${localHere} of this box's card finishes use a quote gathered by hand (the Quote column names the source and date); the rest use Card Kingdom's buylist, and cards neither buys count as $0.` : `Buylist quotes are Card Kingdom's via MTGJSON; cards it is not buying count as $0. No hand-gathered quotes are loaded for this box.`] : [])
      ],
      source: sourceLine(index),
      codeUrl: REPO,
      filename: `${s.code}-top-cards`
    });

    // Notes
    clear(notes);
    const cfg = s.boosters[b.booster];
    notes.append(
      h('h2', { class: 'section-title t-title' }, 'How this was computed'),
      h('ul', { class: 'notes-list t-body' },
        h('li', null, `Pack contents come from MTGJSON’s booster data for “${b.booster}” (${cfg.packs.length} ${plural(cfg.packs.length, 'layout')}, ${Object.keys(cfg.sheets).length} print sheets${cfg.sourceSetCodes.length > 1 ? ', cards from ' + cfg.sourceSetCodes.join(', ') : ''}). Each slot draws from its sheet in proportion to the sheet weights.${b.extras?.length ? ` The box also deals ${b.extras.map((e) => `${e.count} ${e.name.replace(s.name, '').trim().toLowerCase()} (“${e.booster}”)`).join(' and ')}, modelled the same way.` : ''}`),
        h('li', null, `Expected value and standard deviation are exact under that model, with packs independent and draws within a slot treated as independent. The simulation draws without replacement inside a slot where MTGJSON does not allow duplicates, and skips colour balancing.`),
        h('li', null, `Prices: ${basisName}, from TCGCSV’s daily export of TCGplayer prices (${s.sources.tcgcsv.updated.slice(0, 10)}). Foil sheets use the foil price; a missing finish falls back to the other finish, a missing figure to the next one (market → mid → low).${s.sources.buylist ? ` Buylist basis: ${s.sources.buylist.provider} (${s.sources.buylist.date})${localQuotes ? `, with ${localQuotes} card finishes in this set overlaid by quotes gathered by hand (local to this machine, never published)` : ''}.` : ''}`),
        h('li', null, `Recoup rules: ${rulesSentence(store)}. Simulation: ${nBoxes.toLocaleString('en-US')} boxes, fixed seed, so the same inputs always give the same picture.`),
        h('li', null, `Not modelled: box toppers and inserts outside MTGJSON’s booster data, print-run collation, condition, shipping and fees, and the time it takes to sell ${fmtInt(a.moments.cardsPerBox)} cards.`)
      ),
      h('p', { class: 't-source', style: { marginTop: 'var(--space-3)' } }, `Data generated ${s.generatedAt.slice(0, 16).replace('T', ' ')} UTC · MTGJSON ${s.sources.mtgjson.version}`)
    );
  }

  return () => {
    disposed = true;
    document.title = 'MTGDraftFish';
    subs.forEach((u) => u());
  };
}
