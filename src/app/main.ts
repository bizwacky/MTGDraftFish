import './app.css';
import type { DataIndex } from '../engine/types';
import { loadIndex } from './data';
import { clear, h } from './dom';
import { Store, type ThemeMode } from './state';
import { mountBox } from './views/box';
import { mountMethods } from './views/methods';
import { mountTargets } from './views/targets';

async function boot() {
  const app = document.getElementById('app')!;
  let index: DataIndex;
  try {
    index = await loadIndex();
  } catch (e) {
    app.append(h('p', { class: 'status error t-dek' }, (e as Error).message));
    return;
  }
  const store = new Store(index);
  Halftone.theme.set(store.state.settings.theme);

  const nav = h('nav', { class: 'mast-nav t-label', 'aria-label': 'Site' });
  const mast = h('header', { class: 'mast' },
    h('div', { class: 'mast-words' },
      h('a', { class: 'mast-name', href: '#/' }, 'MTGDraftFish'),
      h('p', { class: 'mast-tag' }, 'Expected value, spread and break-even odds for the booster boxes on your draft list.')
    ),
    h('div', { class: 'mast-side' }, h('div', { class: 'mast-plate ht-screen--signal', 'aria-hidden': 'true' }), nav)
  );
  const outlet = h('main');
  app.append(mast, outlet);

  let dispose: (() => void) | null = null;
  const navigate = (hash: string) => {
    location.hash = hash;
  };
  const renderNav = () => {
    clear(nav);
    const route = location.hash || '#/';
    const link = (href: string, label: string, current: boolean) => h('a', { href, 'aria-current': current ? 'page' : null }, label);
    const themeBtn = (mode: ThemeMode, label: string) => h('button', { type: 'button', class: 'ht-btn ht-btn--small', 'aria-pressed': String(store.state.settings.theme === mode), onclick: () => { store.setSettings({ theme: mode }); Halftone.theme.set(mode); renderNav(); } }, label);
    nav.append(
      link('#/', 'Target list', route === '#/' || route.startsWith('#/box/')),
      h('span', { class: 'sep' }, '·'),
      link('#/methods', 'Methods', route === '#/methods'),
      h('span', { class: 'sep' }, '·'),
      h('span', { class: 'theme-group', role: 'group', 'aria-label': 'Theme' }, themeBtn('light', 'Paper'), themeBtn('dark', 'Ink'), themeBtn('auto', 'Auto'))
    );
  };

  const route = () => {
    if (dispose) dispose();
    clear(outlet);
    window.scrollTo(0, 0);
    const hash = location.hash || '#/';
    const m = /^#\/box\/([^/?#]+)/.exec(hash);
    if (m) dispose = mountBox(outlet, index, store, decodeURIComponent(m[1]), navigate);
    else if (hash.startsWith('#/methods')) dispose = mountMethods(outlet, index);
    else dispose = mountTargets(outlet, index, store);
    renderNav();
  };
  window.addEventListener('hashchange', route);
  route();
}

boot();
