import type { Basis, DataIndex, RulesSpec, Tier } from '../engine/types';
import { DEFAULT_RULES } from '../engine/value';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Settings {
  basis: Basis;
  tiers: Tier[];
  /** Boxes opened per simulation */
  boxes: number;
  theme: ThemeMode;
}

export interface AppState {
  settings: Settings;
  /** Purchase price overrides by box uuid */
  prices: Record<string, number>;
}

const KEY_SETTINGS = 'mtgdraftfish.settings';
const KEY_PRICES = 'mtgdraftfish.prices';

type Listener = (state: AppState, change: 'settings' | 'prices' | 'theme') => void;

export class Store {
  state: AppState;
  private listeners = new Set<Listener>();
  readonly defaults: Settings;

  constructor(index: DataIndex) {
    this.defaults = { basis: index.defaults.basis ?? DEFAULT_RULES.basis, tiers: index.defaults.tiers ?? DEFAULT_RULES.tiers, boxes: index.defaults.boxes ?? 20000, theme: 'auto' };
    this.state = { settings: { ...this.defaults, ...read<Partial<Settings>>(KEY_SETTINGS) }, prices: read<Record<string, number>>(KEY_PRICES) ?? {} };
    if (!Array.isArray(this.state.settings.tiers) || !this.state.settings.tiers.length) this.state.settings.tiers = this.defaults.tiers;
  }

  get rules(): RulesSpec {
    return { basis: this.state.settings.basis, tiers: this.state.settings.tiers };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setSettings(patch: Partial<Settings>): void {
    this.state = { ...this.state, settings: { ...this.state.settings, ...patch } };
    write(KEY_SETTINGS, this.state.settings);
    this.emit(patch.theme !== undefined && Object.keys(patch).length === 1 ? 'theme' : 'settings');
  }

  resetSettings(): void {
    this.setSettings({ basis: this.defaults.basis, tiers: this.defaults.tiers, boxes: this.defaults.boxes });
  }

  setPrice(uuid: string, price: number | null): void {
    const prices = { ...this.state.prices };
    if (price == null || !isFinite(price)) delete prices[uuid];
    else prices[uuid] = price;
    this.state = { ...this.state, prices };
    write(KEY_PRICES, prices);
    this.emit('prices');
  }

  private emit(change: 'settings' | 'prices' | 'theme'): void {
    for (const l of this.listeners) l(this.state, change);
  }
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage: the page still works for this visit */
  }
}
