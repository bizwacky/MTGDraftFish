import type * as React from 'react';

/** A colour: a token name ('series-2', 'ink-2', 'mark-context'), a categorical slot number (1–8), or a CSS colour. */
export type ColorRef = string | number;
/** 'number' | 'int' | 'compact' | '$compact' | '$number' | 'percent' (ratio 0–1) | 'pct' (already in %) | 'year', a trailing digit fixes decimals ('pct1'), an options object, or a function. */
export type FormatSpec = string | { decimals?: number; prefix?: string; suffix?: string; signed?: boolean; style?: string } | ((value: number) => string);
type Field<T = any> = string | ((row: T) => any);
export interface Annotation { x: any; y?: number; series?: string; text: string; dx?: number; dy?: number; width?: number }
export interface Reference { y: number; label?: string }
export interface Handle { el: HTMLElement; update(props: object): Handle; replace(props: object): Handle; destroy(): void; table(): { columns: { key: string; label: string; numeric?: boolean }[]; rows: object[] } | null }
interface Common { width?: number; height?: number; ariaLabel?: string; interactive?: boolean; className?: string; style?: React.CSSProperties }

/** The standalone frame every published chart sits in: kicker, takeaway title, dek, optional How-to-read panel, plot, notes, source, table view and CSV. */
export interface FigureProps extends Common {
  /** Mono kicker, e.g. 'Fig. 03 · Pricing'. */
  kicker?: string;
  /** The takeaway as a sentence. Wrap a word as [word](series-1) to key it to a series with a coloured underline. */
  title?: string;
  /** What was measured, in which unit, for whom, when. Say 'Illustrative data' when it is not real. */
  dek?: string;
  /** One or more plain-language lines on how to read an unfamiliar chart (butter panel). */
  howToRead?: string | string[];
  /** The chart: { type: 'LineChart' | 'BarChart' | …, ...that chart's props }. */
  chart: { type: string; [prop: string]: any };
  notes?: string | string[];
  source?: string;
  sourceUrl?: string;
  codeUrl?: string;
  /** 'signal' sets the figure on the electric-blue Signal plate: one series only. */
  variant?: 'plate' | 'signal';
  tableToggle?: boolean;
  download?: boolean;
  filename?: string;
  rule?: boolean;
}
export interface LineChartProps extends Common {
  data: object[];
  x?: Field; y?: Field; series?: Field | false;
  name?: string;
  seriesOrder?: string[];
  /** Series to emphasise (slots 1, 2… in this order); everything else becomes grey context. */
  highlight?: string | string[];
  colors?: Record<string, ColorRef>;
  /** Series drawn dashed: forecasts and projections only. */
  projected?: string[];
  labels?: 'end' | 'legend' | 'none';
  endLabels?: string[];
  endValues?: boolean;
  labelContext?: boolean;
  legend?: boolean;
  /** 'auto' (default) includes zero when the data come near it, otherwise pads above and below. */
  zero?: 'auto' | boolean;
  yDomain?: [number, number]; xDomain?: [any, any];
  format?: FormatSpec; yFormat?: FormatSpec; xFormat?: FormatSpec;
  yUnit?: string; yLabel?: string; xLabel?: string;
  band?: { lower: string; upper: string; label: string };
  area?: boolean;
  curve?: 'linear' | 'step';
  markers?: 'end' | 'none';
  references?: Reference[];
  annotations?: Annotation[];
}
export interface BarChartProps extends Common {
  data: object[];
  category?: Field; value?: Field; series?: Field;
  seriesOrder?: string[]; categoryOrder?: string[];
  orientation?: 'horizontal' | 'vertical';
  stack?: boolean;
  sort?: 'desc' | 'asc' | 'alpha' | 'none';
  highlight?: string | string[];
  color?: ColorRef; colors?: Record<string, ColorRef>;
  values?: 'tip' | 'axis';
  format?: FormatSpec; unit?: string; max?: number; rowHeight?: number;
  name?: string; categoryLabel?: string; valueLabel?: string;
}
export interface DumbbellPlotProps extends Common {
  data: object[];
  category?: Field; from?: Field; to?: Field;
  fromLabel?: string; toLabel?: string; deltaLabel?: string;
  sort?: 'to' | 'from' | 'delta' | 'alpha' | 'none';
  showDelta?: boolean;
  format?: FormatSpec; deltaFormat?: FormatSpec; unit?: string;
  zero?: 'auto' | boolean; domain?: [number, number];
  highlight?: string | string[]; color?: ColorRef; categoryLabel?: string;
}
export interface SlopeChartProps extends Common {
  data: object[];
  category?: Field; start?: Field; end?: Field;
  startLabel?: string; endLabel?: string;
  highlight?: string | string[]; labelAll?: boolean;
  color?: ColorRef; format?: FormatSpec; zero?: 'auto' | boolean; domain?: [number, number]; categoryLabel?: string;
}
export interface SmallMultiplesProps extends Common {
  data: object[];
  facet?: Field; x?: Field; y?: Field;
  panel?: 'line' | 'scatter';
  facetOrder?: string[]; order?: 'none' | 'alpha' | 'last-desc';
  /** Upper bound; fewer columns are used when panels would get too narrow. */
  columns?: number;
  panelHeight?: number;
  context?: boolean; endValues?: boolean;
  trend?: 'none' | 'linear';
  highlight?: string | string[]; color?: ColorRef;
  yDomain?: [number, number]; xDomain?: [any, any]; zero?: 'auto' | boolean; zeroX?: boolean;
  format?: FormatSpec; yFormat?: FormatSpec; xFormat?: FormatSpec;
  xLabel?: string; yLabel?: string; facetLabel?: string;
}
export interface ScatterPlotProps extends Common {
  data: object[];
  x?: Field; y?: Field;
  /** At most four groups keep distinct colours; more fold into 'Other'. */
  group?: Field; groupOrder?: string[];
  /** Area-proportional bubbles. */
  size?: Field; maxRadius?: number;
  label?: Field; labelPoints?: any[] | 'all';
  highlight?: any[];
  trend?: 'none' | 'linear'; trendLabel?: string;
  marginals?: boolean;
  xDomain?: [number, number]; yDomain?: [number, number]; zeroX?: boolean; zeroY?: boolean;
  xFormat?: FormatSpec; yFormat?: FormatSpec; sizeFormat?: FormatSpec;
  xLabel?: string; yLabel?: string; sizeLabel?: string; groupLabel?: string; labelHeader?: string;
  color?: ColorRef; annotations?: Annotation[];
}
export interface HeatmapProps extends Common {
  data: object[];
  x?: Field; y?: Field; value?: Field;
  xOrder?: string[]; yOrder?: string[];
  scale?: 'sequential' | 'diverging';
  midpoint?: number; bins?: number; thresholds?: number[]; domain?: [number, number]; zero?: boolean;
  cellHeight?: number; cellLabels?: boolean;
  format?: FormatSpec; legendTitle?: string; valueLabel?: string; yLabel?: string;
}
export interface DeltaChartProps extends Common {
  data: object[];
  x?: Field; a?: Field; b?: Field; value?: Field;
  aLabel?: string; bLabel?: string; aboveLabel?: string; belowLabel?: string;
  aColor?: ColorRef; bColor?: ColorRef;
  format?: FormatSpec; xFormat?: FormatSpec; yUnit?: string; yDomain?: [number, number]; xDomain?: [any, any]; xLabel?: string;
  annotations?: Annotation[];
}
export interface QuantileDotPlotProps extends Common {
  /** Raw draws; the plot takes `dots` evenly spaced quantiles of them. */
  samples?: number[];
  /** Or the quantiles themselves. */
  quantiles?: number[];
  dots?: number;
  threshold?: { value: number; direction?: 'below' | 'above'; label?: string; phrase?: string; color?: ColorRef };
  caption?: boolean;
  domain?: [number, number]; maxHeight?: number;
  format?: FormatSpec; unit?: string; valueLabel?: string;
}
export interface IconArrayGroup { label: string; count: number; color?: ColorRef }
export interface IconArrayProps extends Common {
  /** One array per comparison, all with the same denominator. */
  arrays?: { title?: string; groups: IconArrayGroup[]; restLabel?: string }[];
  groups?: IconArrayGroup[]; title?: string;
  total?: number; columns?: number;
  icon?: 'person' | 'square' | 'circle';
  iconSize?: number; maxArrayWidth?: number; restLabel?: string;
}
export interface OutcomePlotProps extends Common {
  groups: { label: string; mean?: number; sd?: number; draws?: number[]; color?: ColorRef }[];
  frames?: number; interval?: number; seed?: number;
  trace?: boolean; autoplay?: boolean; compare?: boolean;
  domain?: [number, number]; format?: FormatSpec; unit?: string;
}
export interface StatTileDelta { value: number; format?: FormatSpec; period?: string; good?: 'up' | 'down' | 'none' }
export interface StatTileProps extends Common {
  label?: string; value?: number | string; format?: FormatSpec; unit?: string;
  delta?: StatTileDelta;
  spark?: number[]; sparkWidth?: number; highlightLast?: number;
  note?: string; hero?: boolean;
  /** Render a KPI row instead of one tile. */
  tiles?: Omit<StatTileProps, 'tiles'>[];
}
export interface SparklineProps extends Common {
  data: (number | { x: any; y: number })[];
  highlightLast?: number; band?: [number, number]; color?: ColorRef; format?: FormatSpec;
}
export interface LegendProps extends Common {
  items: { label: string; color?: ColorRef; shape?: 'line' | 'dash' | 'rect' | 'dot' | 'ring' | 'band' }[];
  title?: string; shape?: string; direction?: 'row' | 'column';
}
export interface DataTableProps extends Common {
  columns?: { key: string; label: string; format?: FormatSpec; numeric?: boolean }[];
  rows: object[];
  caption?: string; maxRows?: number;
}

export declare function Figure(props: FigureProps): React.ReactElement;
export declare function LineChart(props: LineChartProps): React.ReactElement;
export declare function BarChart(props: BarChartProps): React.ReactElement;
export declare function DumbbellPlot(props: DumbbellPlotProps): React.ReactElement;
export declare function SlopeChart(props: SlopeChartProps): React.ReactElement;
export declare function SmallMultiples(props: SmallMultiplesProps): React.ReactElement;
export declare function ScatterPlot(props: ScatterPlotProps): React.ReactElement;
export declare function Heatmap(props: HeatmapProps): React.ReactElement;
export declare function DeltaChart(props: DeltaChartProps): React.ReactElement;
export declare function QuantileDotPlot(props: QuantileDotPlotProps): React.ReactElement;
export declare function IconArray(props: IconArrayProps): React.ReactElement;
export declare function OutcomePlot(props: OutcomePlotProps): React.ReactElement;
export declare function StatTile(props: StatTileProps): React.ReactElement;
export declare function Sparkline(props: SparklineProps): React.ReactElement;
export declare function Legend(props: LegendProps): React.ReactElement;
export declare function DataTable(props: DataTableProps): React.ReactElement;

type Renderer<P> = (el: Element | string, props: P) => Handle;
export interface HalftoneAPI {
  version: string;
  /** Vanilla renderers: no React needed. */
  render: { Figure: Renderer<FigureProps>; LineChart: Renderer<LineChartProps>; BarChart: Renderer<BarChartProps>; DumbbellPlot: Renderer<DumbbellPlotProps>; SlopeChart: Renderer<SlopeChartProps>; SmallMultiples: Renderer<SmallMultiplesProps>; ScatterPlot: Renderer<ScatterPlotProps>; Heatmap: Renderer<HeatmapProps>; DeltaChart: Renderer<DeltaChartProps>; QuantileDotPlot: Renderer<QuantileDotPlotProps>; IconArray: Renderer<IconArrayProps>; OutcomePlot: Renderer<OutcomePlotProps>; StatTile: Renderer<StatTileProps>; Sparkline: Renderer<SparklineProps>; Legend: Renderer<LegendProps>; DataTable: Renderer<DataTableProps> };
  mount(el: Element | string, spec: { type: string; [prop: string]: any }): Handle;
  theme: { get(): string; set(mode: 'light' | 'dark' | 'auto'): void };
  /** Inject CSS custom properties and type classes built from a tokens.json object. */
  installTokens(tokens: object, options?: { fontBase?: string; autoDark?: boolean }): HTMLStyleElement;
  tokensToCss(tokens: object, options?: { fontBase?: string; autoDark?: boolean }): string;
  check(): boolean;
  format(spec?: FormatSpec): (value: number) => string;
  /** Google Fonts stylesheet URL for the four families. */
  fontsHref: string;
  series(slot: number): string;
  util: Record<string, Function>;
  Figure: typeof Figure; LineChart: typeof LineChart; BarChart: typeof BarChart; DumbbellPlot: typeof DumbbellPlot; SlopeChart: typeof SlopeChart; SmallMultiples: typeof SmallMultiples; ScatterPlot: typeof ScatterPlot; Heatmap: typeof Heatmap; DeltaChart: typeof DeltaChart; QuantileDotPlot: typeof QuantileDotPlot; IconArray: typeof IconArray; OutcomePlot: typeof OutcomePlot; StatTile: typeof StatTile; Sparkline: typeof Sparkline; Legend: typeof Legend; DataTable: typeof DataTable;
}
declare global { interface Window { Halftone: HalftoneAPI } }
