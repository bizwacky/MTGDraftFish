import type { Basis } from '../../engine/types';
import { BASIS_LABEL } from '../../engine/value';
import { clear, h } from '../dom';
import type { Store } from '../state';

const BOX_COUNTS = [5000, 20000, 50000, 100000];

/** The valuation controls shared by every page: price basis, recoup tiers, boxes simulated. */
export function mountSettings(root: HTMLElement, store: Store, opts: { buylistAvailable: boolean }): () => void {
  const render = () => {
    clear(root);
    const s = store.state.settings;
    const basisSel = h('select', { 'aria-label': 'Price basis', onchange: () => store.setSettings({ basis: basisSel.value as Basis }) },
      (Object.keys(BASIS_LABEL) as Basis[]).filter((b) => b !== 'buylist' || opts.buylistAvailable).map((b) => h('option', { value: b, selected: b === s.basis }, BASIS_LABEL[b]))
    );
    const tiersEl = h('div', { class: 'tiers' },
      s.tiers.map((t, i) =>
        h('div', { class: 'field-row' },
          'Cards priced at least $',
          h('input', { type: 'number', class: 'in-money', min: 0, step: 0.25, value: String(t.min), 'aria-label': `Tier ${i + 1} minimum price`, onchange: (e: Event) => updateTier(i, { min: num((e.target as HTMLInputElement).value, t.min) }) }),
          ' count at ',
          h('input', { type: 'number', class: 'in-pct', min: 0, max: 200, step: 1, value: String(Math.round(t.pct * 100)), 'aria-label': `Tier ${i + 1} percentage`, onchange: (e: Event) => updateTier(i, { pct: num((e.target as HTMLInputElement).value, t.pct * 100) / 100 }) }),
          '% of the price',
          s.tiers.length > 1 ? h('button', { type: 'button', class: 'ht-btn ht-btn--small', 'aria-label': `Remove tier ${i + 1}`, onclick: () => store.setSettings({ tiers: s.tiers.filter((_, j) => j !== i) }) }, 'Remove') : null
        )
      ),
      h('div', { class: 'field-row' },
        h('button', { type: 'button', class: 'ht-btn ht-btn--small', onclick: () => store.setSettings({ tiers: [...s.tiers, { min: Math.max(...s.tiers.map((t) => t.min)) * 5 || 5, pct: Math.min(1, Math.max(...s.tiers.map((t) => t.pct)) + 0.1) }] }) }, '+ Add a tier'),
        h('span', { class: 'hint t-source' }, 'Cards below the lowest threshold count as $0. A higher tier wins where its threshold is met.')
      )
    );
    const updateTier = (i: number, patch: { min?: number; pct?: number }) => {
      const tiers = s.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t));
      store.setSettings({ tiers });
    };
    const boxesSel = h('select', { 'aria-label': 'Boxes simulated', onchange: () => store.setSettings({ boxes: parseInt(boxesSel.value, 10) }) },
      BOX_COUNTS.map((n) => h('option', { value: String(n), selected: n === s.boxes }, n.toLocaleString('en-US')))
    );
    root.append(
      h('p', { class: 'panel-title t-kicker' }, 'Valuation rules'),
      h('label', { class: 'field' }, h('span', { class: 'field-label t-label' }, 'Price basis'), basisSel),
      h('div', { class: 'field' }, h('span', { class: 'field-label t-label' }, 'Recoup rules'), tiersEl),
      h('label', { class: 'field' }, h('span', { class: 'field-label t-label' }, 'Boxes simulated'), boxesSel),
      h('div', { class: 'field' }, h('span', { class: 'field-label t-label' }, ' '), h('div', { class: 'panel-actions' }, h('button', { type: 'button', class: 'ht-btn', onclick: () => store.resetSettings() }, 'Reset to defaults')))
    );
  };
  render();
  return store.subscribe((_, change) => {
    if (change === 'settings') render();
  });
}

function num(v: string, fallback: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
