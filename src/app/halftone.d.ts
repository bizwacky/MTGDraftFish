/** Minimal typing for the vendored Halftone bundle (window.Halftone). Full docs: public/halftone/halftone.d.ts */
interface HalftoneHandle {
  el: HTMLElement;
  update(props: Record<string, unknown>): HalftoneHandle;
  replace(props: Record<string, unknown>): HalftoneHandle;
  destroy(): void;
  table(): unknown;
}
type HalftoneRenderer = (el: Element | string, props: Record<string, unknown>) => HalftoneHandle;
interface HalftoneAPI {
  version: string;
  render: Record<string, HalftoneRenderer>;
  mount(el: Element | string, spec: Record<string, unknown>): HalftoneHandle;
  theme: { get(): string; set(mode: 'light' | 'dark' | 'auto'): void };
  format(spec?: unknown): (value: number) => string;
  fontsHref: string;
  util: Record<string, (...args: never[]) => unknown>;
}
declare const Halftone: HalftoneAPI;
interface Window {
  Halftone: HalftoneAPI;
}
