import type { CatalogEntry, DataIndex } from '../../engine/types';
import { clear, h } from '../dom';
import { loadCatalog } from '../data';

/** "Add a set": search every set with a draftable box and hand back the targets.json line to add. */
export function mountPicker(root: HTMLElement, index: DataIndex): void {
  const built = new Set(index.sets.map((s) => s.code));
  const results = h('ul', { class: 'picker-results' });
  const snippet = h('div', { class: 'snippet' });
  let catalog: CatalogEntry[] | null = null;
  const input = h('input', { type: 'search', class: 'in-wide', placeholder: 'Search by set name or code, e.g. Modern Horizons 2 or MH2', 'aria-label': 'Search sets', autocomplete: 'off',
    onfocus: () => ensureCatalog(),
    oninput: () => { ensureCatalog().then(renderResults); }
  });
  const ensureCatalog = () => (catalog ? Promise.resolve(catalog) : loadCatalog().then((c) => (catalog = c)).catch(() => (catalog = [])));

  const renderResults = () => {
    clear(results);
    clear(snippet);
    const q = input.value.trim().toLowerCase();
    if (!q || !catalog) return;
    const hits = catalog.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q).slice(-12).reverse();
    if (!hits.length) {
      results.append(h('li', { class: 'hint' }, 'No set with a draftable booster box matches.'));
      return;
    }
    for (const s of hits) {
      results.append(
        h('li', null,
          h('span', { class: 't-label-strong' }, s.name),
          h('span', { class: 'code t-source' }, `${s.code} · ${s.releaseDate.slice(0, 4)}`),
          built.has(s.code) ? h('span', { class: 'hint t-source' }, 'already on the list') : null,
          h('span', { class: 'boxes' }, s.boxes.map((b) => h('button', { type: 'button', class: 'ht-btn ht-btn--small', onclick: () => showSnippet(s, b.subtype ?? b.booster, b.name, b.packs) }, `${b.subtype ?? b.booster} · ${b.packs} packs`)))
        )
      );
    }
  };

  const showSnippet = (s: CatalogEntry, box: string, name: string, packs: number) => {
    clear(snippet);
    const line = JSON.stringify({ set: s.code, box, note: '' });
    const pre = h('pre', { class: 't-code' }, line);
    snippet.append(
      h('p', { class: 't-body' }, `${name} (${packs} packs). Add this entry to the "targets" list in `, h('code', null, 'targets.json'), ', then rebuild the data:'),
      pre,
      h('pre', { class: 't-code' }, 'npm run refresh\nnpm run dev'),
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'ht-btn', onclick: () => navigator.clipboard?.writeText(line) }, 'Copy entry'),
        h('span', { class: 'hint t-source' }, 'On the published site, commit the change and push: the daily workflow rebuilds the data.')
      )
    );
  };

  root.append(
    h('h2', { class: 'section-title t-title' }, 'Add a set to the list'),
    h('p', { class: 'lede t-dek' }, `Every set with a draftable booster box in MTGJSON is searchable. The list itself lives in targets.json so it travels with the repository.`),
    input,
    results,
    snippet
  );
}
