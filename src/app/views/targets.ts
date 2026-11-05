import { boxMarketPrice } from '../../engine/boxes';
import type { DataIndex, IndexBox, IndexSet, SetData } from '../../engine/types';
import { BASIS_LABEL } from '../../engine/value';
import { analytic, simulate, simulateSync, type SimResult } from '../compute';
import { loadSet } from '../data';
import { clear, debounce, h } from '../dom';
import { fmtPct, fmtUsd, inTwenty, plural } from '../format';
import type { Store } from '../state';
import { mountPicker } from './picker';
import { mountSettings } from './settings';

interface Row {
  set: IndexSet;
  box: IndexBox;
  data: SetData;
  label: string;
}

interface RowStats {
  price: number | null;
  ev: number;
  sd: number;
  sticker: number;
  sim?: SimResult;
  pBreakEven: number | null;
}

export const REPO = 'https://github.com/bizwacky/MTGDraftFish';

export function rulesSentence(store: Store): string {
  const r = store.rules;
  const tiers = [...r.tiers].sort((a, b) => a.min - b.min);
  const parts = tiers.map((t, i) => {
    const next = tiers[i + 1];
    const range = next ? `from ${fmtUsd(t.min)} to ${fmtUsd(next.min)}` : `${fmtUsd(t.min)} or more`;
    return `${Math.round(t.pct * 100)}% of ${BASIS_LABEL[r.basis]} for cards priced ${range}`;
  });
  return parts.join(', ') + `; cards under ${fmtUsd(tiers[0]?.min ?? 0)} count as $0`;
}

export function sourceLine(index: DataIndex): string {
  const s = index.sources;
  return `MTGJSON ${s.mtgjson.version} (booster sheets, set data) · TCGplayer prices via TCGCSV, ${s.tcgcsv.updated.slice(0, 10)}${s.buylist ? ' · ' + s.buylist.provider : ''}`;
}

/** Purchase price for a box: the reader's override, else targets.json, else the box's own TCGplayer price. */
export function priceFor(store: Store, box: IndexBox): number | null {
  return store.state.prices[box.uuid] ?? box.targetPrice ?? boxMarketPrice(box);
}

export function mountTargets(root: HTMLElement, index: DataIndex, store: Store): () => void {
  const subs: (() => void)[] = [];
  const settingsEl = h('div', { class: 'panel' });
  const status = h('p', { class: 'status t-dek' }, 'Loading set data…');
  const kpis = h('div', { class: 'kpis' });
  const figDumbbell = h('div', { class: 'fig' });
  const figBreakEven = h('div', { class: 'fig' });
  const tableSection = h('section', { class: 'section' });
  const pickerSection = h('section', { class: 'section picker' });

  root.append(
    h('p', { class: 'page-kicker t-kicker' }, `Target list · ${index.sets.length} ${plural(index.sets.length, 'set')} · data ${index.sources.tcgcsv.updated.slice(0, 10)}`),
    h('h1', { class: 'page-title t-headline' }, 'What a box on the list is worth once it is opened'),
    h('p', { class: 'page-dek lede t-dek' }, 'Every card a booster box can deal, weighted by its print-sheet odds and priced at today’s market, gives the box’s expected recoup value, its spread, and how often it pays for itself at the price you type in.'),
    settingsEl,
    status,
    kpis,
    figDumbbell,
    figBreakEven,
    tableSection,
    pickerSection
  );
  subs.push(mountSettings(settingsEl, store, { buylistAvailable: !!index.sources.buylist }));
  mountPicker(pickerSection, index);

  const targetBoxes: { set: IndexSet; box: IndexBox }[] = [];
  for (const set of index.sets) for (const box of set.boxes) if (box.target) targetBoxes.push({ set, box });

  let rows: Row[] = [];
  let disposed = false;
  const refreshSoon = debounce(() => !disposed && refresh(), 60);

  Promise.all([...new Set(targetBoxes.map((t) => t.set.code))].map((c) => loadSet(c)))
    .then((sets) => {
      const byCode = new Map(sets.map((s) => [s.code, s]));
      const multi = new Map<string, number>();
      for (const t of targetBoxes) multi.set(t.set.code, (multi.get(t.set.code) ?? 0) + 1);
      rows = targetBoxes.map((t) => ({ set: t.set, box: t.box, data: byCode.get(t.set.code)!, label: (multi.get(t.set.code) ?? 1) > 1 ? `${t.set.name} (${t.box.subtype ?? t.box.booster})` : t.set.name }));
      status.remove();
      buildTable();
      refresh();
    })
    .catch((e: Error) => {
      status.textContent = e.message;
      status.classList.add('error');
    });

  subs.push(store.subscribe((_, change) => {
    if (change === 'settings') refresh();
    else if (change === 'prices') refresh(true);
  }));

  function statsFor(row: Row): RowStats {
    const rules = store.rules;
    const a = analytic(row.data, row.box, rules);
    const price = priceFor(store, row.box);
    const sim = simulateSync(row.data, row.box, rules, store.state.settings.boxes);
    if (!sim) simulate(row.data, row.box, rules, store.state.settings.boxes).then(refreshSoon).catch(refreshSoon);
    return { price, ev: a.moments.evBox, sd: a.moments.sdBox, sticker: a.stickerEv, sim, pBreakEven: sim && price != null ? sim.pAtLeast(price) : null };
  }

  const cells = new Map<string, Record<string, HTMLElement>>();
  const priceInputs = new Map<string, HTMLInputElement>();

  function buildTable() {
    clear(tableSection);
    const thead = h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Box'),
      h('th', { scope: 'col', class: 'num' }, 'Packs'),
      h('th', { scope: 'col', class: 'num' }, 'Purchase price, $'),
      h('th', { scope: 'col', class: 'num' }, 'Sticker value, $'),
      h('th', { scope: 'col', class: 'num' }, 'Recoup EV, $'),
      h('th', { scope: 'col', class: 'num' }, 'EV ÷ price'),
      h('th', { scope: 'col', class: 'num' }, 'Std. dev., $'),
      h('th', { scope: 'col', class: 'num' }, 'Median, $'),
      h('th', { scope: 'col', class: 'num' }, '5th–95th pct., $'),
      h('th', { scope: 'col', class: 'num' }, 'Breaks even')
    ));
    const tbody = h('tbody');
    for (const row of rows) {
      const market = boxMarketPrice(row.box);
      const input = h('input', { type: 'number', class: 'in-money', min: 0, step: 1, inputmode: 'decimal', 'aria-label': `Purchase price for ${row.label}`,
        onchange: () => { const v = parseFloat(input.value); store.setPrice(row.box.uuid, Number.isFinite(v) && v > 0 ? v : null); if (!(v > 0)) input.value = priceFor(store, row.box)?.toString() ?? ''; }
      });
      input.value = priceFor(store, row.box)?.toFixed(0) ?? '';
      priceInputs.set(row.box.uuid, input);
      const c: Record<string, HTMLElement> = {
        sticker: h('td', { class: 'num' }), ev: h('td', { class: 'num' }), ratio: h('td', { class: 'num' }), sd: h('td', { class: 'num' }),
        median: h('td', { class: 'num' }), range: h('td', { class: 'num' }), be: h('td', { class: 'num' })
      };
      cells.set(row.box.uuid, c);
      tbody.append(h('tr', null,
        h('th', { scope: 'row', class: 'cell-box' }, h('a', { href: `#/box/${row.box.uuid}` }, row.label), h('small', { class: 't-source' }, `${row.set.code} · ${row.box.name.replace(row.set.name, '').trim() || row.box.name} · ${row.set.releaseDate.slice(0, 4)}`)),
        h('td', { class: 'num' }, String(row.box.packs)),
        h('td', { class: 'num price' }, input, h('span', { class: 'hint t-source' }, market != null ? `TCGplayer ${fmtUsd(market)}` : 'no TCGplayer box price')),
        c.sticker, c.ev, c.ratio, c.sd, c.median, c.range, c.be
      ));
    }
    tableSection.append(
      h('h2', { class: 'section-title t-title' }, 'Every box on the list'),
      h('p', { class: 'lede t-dek' }, 'Type a purchase price to test it. Sticker value counts every card at 100% of the basis price; recoup EV applies the rules above. Figures update as the simulations finish.'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'ht-table t-table' }, thead, tbody))
    );
  }

  function refresh(pricesOnly = false) {
    if (!rows.length) return;
    const stats = rows.map((r) => ({ row: r, s: statsFor(r) }));
    const simsDone = stats.filter((x) => x.s.sim).length;
    const nBoxes = store.state.settings.boxes;
    const priced = stats.filter((x) => x.s.price != null);

    // table cells
    for (const { row, s } of stats) {
      const c = cells.get(row.box.uuid)!;
      c.sticker.textContent = fmtUsd(s.sticker);
      c.ev.textContent = fmtUsd(s.ev);
      c.ratio.textContent = s.price ? fmtPct(s.ev / s.price) : '–';
      c.ratio.className = 'num ' + (s.price ? (s.ev >= s.price ? 'tone-good' : '') : '');
      c.sd.textContent = fmtUsd(s.sd);
      c.median.textContent = s.sim ? fmtUsd(s.sim.summary.median) : '…';
      c.range.textContent = s.sim ? `${fmtUsd(s.sim.summary.p5)}–${fmtUsd(s.sim.summary.p95)}` : '…';
      c.be.textContent = s.pBreakEven == null ? (s.price == null ? '–' : '…') : `${inTwenty(s.pBreakEven)} (${fmtPct(s.pBreakEven, 1)})`;
      if (!pricesOnly) {
        const inp = priceInputs.get(row.box.uuid)!;
        if (document.activeElement !== inp) inp.value = s.price?.toFixed(0) ?? '';
      }
    }

    // KPI row
    clear(kpis);
    const best = priced.length ? priced.reduce((a, b) => (b.s.ev / b.s.price! > a.s.ev / a.s.price! ? b : a)) : null;
    const nPositive = priced.filter((x) => x.s.ev >= x.s.price!).length;
    const nOneIn20 = priced.filter((x) => x.s.pBreakEven != null && x.s.pBreakEven >= 0.05).length;
    Halftone.render.StatTile(kpis, { tiles: [
      { label: 'Boxes on the list', value: rows.length, format: 'int', note: `${index.sets.length} ${plural(index.sets.length, 'set')}; ${simsDone} of ${rows.length} simulations done` },
      { label: 'Best expected return on price', value: best ? (best.s.ev / best.s.price!) * 100 : null, format: 'pct0', note: best ? `${best.row.label} at ${fmtUsd(best.s.price)}` : 'Enter a purchase price' },
      { label: 'Expected to return more than they cost', value: nPositive, format: 'int', note: `of ${priced.length} priced ${plural(priced.length, 'box', 'boxes')}` },
      { label: 'Recoup the price at least 1 time in 20', value: nOneIn20, format: 'int', note: `by simulation, ${nBoxes.toLocaleString('en-US')} boxes each` }
    ] });

    // Figure 1: price → EV
    clear(figDumbbell);
    if (priced.length) {
      const data = priced.map((x) => ({ box: x.row.label, price: x.s.price!, ev: x.s.ev }));
      const winners = priced.filter((x) => x.s.ev >= x.s.price!).map((x) => x.row.label);
      const title = nPositive === 0 ? `Every box on the list is expected to return less than it costs` : nPositive === priced.length ? `Every box on the list is expected to return more than it costs` : `${nPositive} of ${priced.length} boxes ${nPositive === 1 ? 'is' : 'are'} expected to return more than ${nPositive === 1 ? 'it costs' : 'they cost'}`;
      Halftone.render.Figure(figDumbbell, {
        kicker: 'Fig. 01 · Price against expected value',
        title,
        dek: `Purchase price (open ring) and expected recoup value (filled dot) per box, US dollars; the change column is the expected gain. Recoup value: ${rulesSentence(store)}.`,
        chart: { type: 'DumbbellPlot', data, category: 'box', from: 'price', to: 'ev', fromLabel: 'Purchase price', toLabel: 'Recoup EV', deltaLabel: 'Gain, $', sort: 'delta', format: '$int', deltaFormat: '$int', highlight: winners, zero: true, categoryLabel: 'Box' },
        notes: 'Expected value is exact under the sheet model; it does not depend on the simulation.',
        source: sourceLine(index),
        codeUrl: REPO,
        filename: 'price-vs-ev'
      });
    }

    // Figure 2: break-even chance
    clear(figBreakEven);
    const withBe = stats.filter((x) => x.s.pBreakEven != null);
    if (withBe.length) {
      const data = withBe.map((x) => ({ box: x.row.label, p: x.s.pBreakEven! }));
      const top = withBe.reduce((a, b) => (b.s.pBreakEven! > a.s.pBreakEven! ? b : a));
      const half = withBe.filter((x) => x.s.pBreakEven! >= 0.5);
      const title = top.s.pBreakEven! < 0.05 ? `No box on the list recoups its price even 1 time in 20` : half.length === 0 ? `${top.row.label} recoups its price most often, ${inTwenty(top.s.pBreakEven!)} times` : half.length === withBe.length ? `Every box recoups its price at least half the time` : `${half.length} ${plural(half.length, 'box recoups its', 'boxes recoup their')} price at least half the time`;
      Halftone.render.Figure(figBreakEven, {
        kicker: 'Fig. 02 · Break-even odds',
        title,
        dek: `Share of ${nBoxes.toLocaleString('en-US')} simulated boxes whose recoup value reached the purchase price, percent.${simsDone < rows.length ? ' Some simulations are still running.' : ''}`,
        chart: { type: 'BarChart', data, category: 'box', value: 'p', format: 'percent1', sort: 'desc', max: Math.max(0.05, ...data.map((d) => d.p)), highlight: half.map((x) => x.row.label), name: 'Break-even chance', categoryLabel: 'Box', valueLabel: 'Break-even chance' },
        notes: 'Packs are opened independently; real boxes are collated from print runs, which narrows the spread a little.',
        source: sourceLine(index),
        codeUrl: REPO,
        filename: 'break-even'
      });
    }
  }

  return () => {
    disposed = true;
    subs.forEach((u) => u());
  };
}
