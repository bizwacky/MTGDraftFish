/* @ds-bundle: {"format":4,"namespace":"Halftone","components":[{"name":"Figure"},{"name":"LineChart"},{"name":"BarChart"},{"name":"DumbbellPlot"},{"name":"SlopeChart"},{"name":"SmallMultiples"},{"name":"ScatterPlot"},{"name":"Heatmap"},{"name":"DeltaChart"},{"name":"QuantileDotPlot"},{"name":"IconArray"},{"name":"OutcomePlot"},{"name":"StatTile"},{"name":"Sparkline"},{"name":"Legend"},{"name":"DataTable"}]} */
/*
 * Halftone — evidence-led editorial charts. One classic script, no dependencies, no network.
 * Vanilla:  Halftone.render.LineChart(elementOrSelector, props) -> { update(p), replace(p), destroy(), table() }
 *           Halftone.mount(el, { type: 'LineChart', ...props })
 * React:    <Halftone.LineChart {...props} />   (needs window.React 18 on the page)
 * Colours, type and mark sizes come from the system's CSS custom properties (tokens.css).
 */
(() => {
  'use strict';
  const W = window;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MINUS = '−';
  const VERSION = '1.0.0';

  // ------------------------------------------------------------------ utilities
  const isFn = (f) => typeof f === 'function';
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const num = (x) => (x == null || x === '' ? NaN : +x);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const accessor = (k, d) => (isFn(k) ? k : (row) => (row == null ? undefined : row[k == null ? d : k]));
  const uniq = (arr) => { const seen = new Set(), out = []; for (const x of arr) { const key = x instanceof Date ? +x : x; if (!seen.has(key)) { seen.add(key); out.push(x); } } return out; };
  const extent = (arr) => { let lo = Infinity, hi = -Infinity; for (const x of arr) if (isNum(x)) { if (x < lo) lo = x; if (x > hi) hi = x; } return lo === Infinity ? [0, 1] : [lo, hi]; };
  const sum = (arr) => arr.reduce((a, b) => a + (isNum(b) ? b : 0), 0);
  const toSet = (x) => new Set(x == null ? [] : Array.isArray(x) ? x : [x]);
  const cv = (name) => `var(--${name})`;
  const slotVar = (i) => cv('series-' + (((i - 1) % 8) + 1));
  const colorVar = (c, slot) => (c == null ? slotVar(slot || 1) : typeof c === 'number' ? slotVar(c) : /^(#|rgb|hsl|oklch|var\()/.test(c) ? c : cv(c));
  const warn = (m) => { if (W.console) W.console.warn('[Halftone] ' + m); };
  let uidN = 0;
  const uid = (p) => `ht-${p}-${++uidN}`;
  const reducedMotion = () => !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ------------------------------------------------------------------ DOM
  // Text classes pick up the system's type styles (.t-* classes compiled from tokens.json), so type has one source.
  const TYPE = { 'ht-tick': 't-tick', 'ht-axis-title': 't-tick', 'ht-ref-label': 't-tick', 'ht-cell-label': 't-tick', 'ht-tooltip': 't-tick',
    'ht-label': 't-label', 'ht-value': 't-label', 'ht-legend': 't-label', 'ht-hops-status': 't-label', 'ht-caption': 't-label', 'ht-stat-label': 't-label', 'ht-iconarray-row': 't-label',
    'ht-label--strong': 't-label-strong', 'ht-value--strong': 't-label-strong', 'ht-btn': 't-label-strong', 'ht-stat-delta': 't-label-strong', 'ht-iconarray-title': 't-label-strong', 'ht-tick--strong': 't-label-strong',
    'ht-annot': 't-annotation', 'ht-howto-p': 't-annotation', 'ht-kicker': 't-kicker', 'ht-howto-k': 't-kicker', 'ht-tooltip-title': 't-kicker', 'ht-legend-title': 't-kicker', 'ht-table-caption': 't-kicker',
    'ht-title': 't-title', 'ht-dek': 't-dek', 'ht-source': 't-source', 'ht-notes': 't-source', 'ht-stat-note': 't-source', 'ht-error': 't-source',
    'ht-tooltip-v': 't-value', 'ht-table': 't-table', 'ht-stat-value': 't-figure', 'ht-stat-value--hero': 't-hero' };
  const withType = (cls) => { const out = []; for (const c of String(cls).split(/\s+/)) { if (TYPE[c] && !out.includes(TYPE[c])) out.push(TYPE[c]); } return out.length ? out.join(' ') + ' ' + cls : cls; };
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const val = attrs[k];
      if (val == null || val === false) continue;
      if (k === 'class') n.className = withType(val);
      else if (k === 'text') n.textContent = val;
      else if (k === 'style' && typeof val === 'object') { for (const p in val) n.style.setProperty(p, val[p]); }
      else if (k.slice(0, 2) === 'on' && isFn(val)) n.addEventListener(k.slice(2), val);
      else n.setAttribute(k, val === true ? '' : val);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return n;
  }
  function s(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) {
      const val = attrs[k];
      if (val == null) continue;
      if (k === 'text') n.textContent = val;
      else if (k === 'style' && typeof val === 'object') { for (const p in val) n.style.setProperty(p, val[p]); }
      else if (k === 'class') n.setAttribute('class', withType(val));
      else n.setAttribute(k, typeof val === 'number' ? +val.toFixed(2) : val);
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  const f1 = (x) => +(+x).toFixed(1);

  // ------------------------------------------------------------------ number formatting
  const nfCache = {};
  const nf = (o) => { const k = JSON.stringify(o); return nfCache[k] || (nfCache[k] = new Intl.NumberFormat('en-US', o)); };
  const minusSign = (str) => str.replace(/^-/, MINUS).replace(/(\s)-/g, '$1' + MINUS);
  const decimalsFor = (step) => (!(step > 0) ? 0 : clamp(-Math.floor(Math.log10(step) + 1e-9), 0, 6));
  const autoDecimals = (x) => { const a = Math.abs(x); if (Number.isInteger(x) || a >= 1000) return 0; if (a >= 1) return Number.isInteger(+(x * 10).toFixed(6)) ? 1 : a >= 100 ? 0 : 1; return 2; };
  function compact(x, d) {
    const a = Math.abs(x);
    for (const [n, u] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (a >= n) { const y = x / n; return nf({ maximumFractionDigits: d != null ? d : Math.abs(y) < 10 ? 1 : 0 }).format(y) + u; }
    return nf({ maximumFractionDigits: d != null ? d : autoDecimals(x) }).format(x);
  }
  /** spec: 'number' | 'int' | 'compact' | '$compact' | 'percent' (ratio 0–1) | 'pct' (already in %) | 'year' | '$number' | {decimals,prefix,suffix,signed,style} | fn */
  function makeFormat(spec, ctx) {
    if (isFn(spec)) return spec;
    let o = {};
    if (typeof spec === 'string') {
      const m = /^(\$|€|£)?(compact|int|number|percent|pct|year|raw|auto)(\d)?$/.exec(spec);
      if (m) { o.prefix = m[1] || ''; o.style = m[2]; if (m[3] != null) o.decimals = +m[3]; } else o.style = 'auto';
    } else if (spec && typeof spec === 'object') o = Object.assign({}, spec);
    else o.style = 'auto';
    const step = ctx && ctx.step;
    return function (x) {
      if (x == null || (typeof x === 'number' && !isFinite(x))) return '–';
      if (typeof x !== 'number') return String(x);
      let d = o.decimals, out;
      const st = o.style || 'auto';
      if (st === 'year' || st === 'raw') out = String(+x.toFixed(6));
      else if (st === 'percent') { if (d == null) d = step != null ? decimalsFor(step * 100) : autoDecimals(+(x * 100).toFixed(6)); out = nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(x * 100) + '%'; }
      else if (st === 'pct') { if (d == null) d = step != null ? decimalsFor(step) : autoDecimals(x); out = nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(x) + '%'; }
      else if (st === 'compact') out = compact(x, d);
      else if (st === 'int') out = nf({ maximumFractionDigits: 0 }).format(x);
      else {
        if (d == null) d = step != null ? decimalsFor(step) : autoDecimals(x);
        out = st === 'auto' && Math.abs(x) >= 1e6 ? compact(x) : nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
      }
      if (o.prefix) out = out.replace(/^(-?)/, '$1' + o.prefix);
      if (o.suffix) out += o.suffix;
      if (o.signed && x > 0) out = '+' + out;
      return minusSign(out);
    };
  }
  const signedFormat = (spec) => { const f = makeFormat(spec); return (x) => (isNum(x) && x > 0 ? '+' : '') + f(x); };

  // ------------------------------------------------------------------ scales and ticks
  function tickStep(lo, hi, count) {
    const span = hi - lo;
    if (!(span > 0)) return 1;
    const raw = span / Math.max(1, count), p = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / p;
    return (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * p;
  }
  function linTicks(lo, hi, count) {
    const st = tickStep(lo, hi, count), out = [];
    for (let t = Math.ceil(lo / st - 1e-9) * st; t <= hi + st * 1e-9; t += st) out.push(+(Math.round(t / st) * st).toPrecision(12));
    return { values: out, step: st };
  }
  function nice(lo, hi, count) {
    if (lo === hi) { const d = lo === 0 ? 1 : Math.abs(lo) * 0.1; lo -= d; hi += d; }
    const st = tickStep(lo, hi, count);
    return [Math.floor(lo / st + 1e-9) * st, Math.ceil(hi / st - 1e-9) * st];
  }
  function linear(dom, rng) {
    const [d0, d1] = dom, [r0, r1] = rng, k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
    const f = (x) => r0 + (x - d0) * k;
    f.invert = (y) => (k === 0 ? d0 : d0 + (y - r0) / k);
    f.domain = dom; f.range = rng;
    return f;
  }
  /** The y-domain policy: bars always start at zero; elsewhere zero is included when the data come close to it,
   *  otherwise the axis gets headroom above AND below so the lowest point is not read as the lowest possible. */
  function valueDomain(vals, o) {
    o = o || {};
    if (o.domain) return o.domain.slice();
    let [lo, hi] = extent(vals);
    const zero = o.zero == null ? 'auto' : o.zero;
    const span = hi - lo || Math.abs(hi) || 1;
    const near = (lo >= 0 && lo <= span * 0.6) || (hi <= 0 && -hi <= span * 0.6);
    if (zero === true || (zero === 'auto' && near)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    else { const pad = span * 0.12, lo0 = lo; lo -= pad; hi += pad; if (lo0 >= 0 && lo < 0) lo = 0; }
    return nice(lo, hi, o.count || 5);
  }

  // time
  const ISO = /^(\d{4})-(\d{2})(?:-(\d{2}))?/;
  function parseX(x) {
    if (x instanceof Date) return x;
    if (typeof x === 'string') {
      if (/^\d{4}$/.test(x)) return +x;
      const m = ISO.exec(x);
      if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
      if (x.trim() !== '' && isFinite(+x)) return +x;
    }
    return x;
  }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY = 864e5, YEAR = 365.25 * DAY;
  function timeTicks(lo, hi, count) {
    const span = hi - lo, out = [];
    if (span > 2.5 * YEAR) {
      const yrs = span / YEAR, steps = [1, 2, 5, 10, 20, 25, 50, 100];
      let si = steps.findIndex((k) => yrs / k <= count); if (si < 0) si = steps.length - 1;
      const y0 = new Date(lo).getUTCFullYear(), y1 = new Date(hi).getUTCFullYear();
      for (; si >= 0; si--) { out.length = 0; const st = steps[si]; for (let y = Math.ceil(y0 / st) * st; y <= y1; y += st) { const t = Date.UTC(y, 0, 1); if (t >= lo - DAY && t <= hi + DAY) out.push(t); } if (out.length >= 2) break; }
      return { values: out, label: (t) => String(new Date(t).getUTCFullYear()) };
    }
    if (span > 50 * DAY) {
      const months = span / (30.44 * DAY), st = [1, 2, 3, 6, 12].find((k) => months / k <= count) || 12;
      const d0 = new Date(lo);
      let y = d0.getUTCFullYear(), m = d0.getUTCMonth();
      if (Date.UTC(y, m, 1) < lo - DAY) m += 1;
      m = Math.ceil(m / st) * st;
      for (let t = Date.UTC(y, m, 1); t <= hi + DAY; m += st, t = Date.UTC(y, m, 1)) out.push(t);
      return { values: out, label: (t, i) => { const d = new Date(t), mm = d.getUTCMonth(); return i === 0 || mm < st ? `${MON[mm]} ’${String(d.getUTCFullYear()).slice(2)}` : MON[mm]; } };
    }
    const days = span / DAY, st = [1, 2, 7, 14].find((k) => days / k <= count) || 14;
    const d0 = new Date(lo);
    for (let t = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()); t <= hi + 1; t += st * DAY) if (t >= lo - 1) out.push(t);
    return { values: out, label: (t) => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; } };
  }
  function timeLabelFull(t, gran) {
    const d = new Date(t);
    if (gran >= 360 * DAY) return String(d.getUTCFullYear());
    if (gran >= 27 * DAY) return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const isYearLike = (xs) => xs.length > 0 && xs.every((x) => Number.isInteger(x) && x >= 1000 && x <= 2999);
  /** A continuous x axis (time or number) with tick and label helpers. */
  function xAxisModel(xs, range, o) {
    o = o || {};
    const isTime = xs.some((x) => x instanceof Date);
    const vals = xs.map((x) => +x);
    let [lo, hi] = o.domain ? o.domain.map((x) => +parseX(x)) : extent(vals);
    if (lo === hi) { lo -= isTime ? DAY : 1; hi += isTime ? DAY : 1; }
    const f = linear([lo, hi], range);
    const sorted = uniq(vals).sort((a, b) => a - b);
    let gran = Infinity;
    for (let i = 1; i < sorted.length; i++) gran = Math.min(gran, sorted[i] - sorted[i - 1]);
    const yearLike = !isTime && isYearLike(sorted);
    const userFmt = o.format ? makeFormat(o.format) : null;
    return {
      isTime, f, lo, hi, sorted,
      ticks(count) {
        if (isTime) { const t = timeTicks(lo, hi, count); return t.values.map((x, i) => ({ v: x, label: userFmt ? userFmt(x) : t.label(x, i) })); }
        const t = linTicks(lo, hi, count), fm = userFmt || (yearLike ? (x) => String(x) : makeFormat('auto', { step: t.step }));
        return t.values.map((x) => ({ v: x, label: fm(x) }));
      },
      label(x) { if (userFmt) return userFmt(isTime ? new Date(x) : x); return isTime ? timeLabelFull(x, gran) : yearLike ? String(x) : makeFormat('auto')(x); },
    };
  }
  function band(domain, r0, r1, padInner, padOuter) {
    const n = domain.length, step = (r1 - r0) / Math.max(1, n - padInner + padOuter * 2), bw = step * (1 - padInner);
    const idx = new Map(domain.map((d, i) => [d, i]));
    const f = (d) => r0 + step * padOuter + step * idx.get(d);
    f.bw = bw; f.step = step;
    return f;
  }

  // ------------------------------------------------------------------ text measurement
  let mctx = null;
  const FONT = { tick: ['400', 12, 'sans'], label: ['500', 13, 'sans'], strong: ['650', 13, 'sans'], value: ['500', 13, 'sans'], annot: ['italic 400', 14, 'serif'], title: ['650', 13, 'sans'] };
  const stackCache = {};
  function fontStack(key) {
    if (stackCache[key]) return stackCache[key];
    const x = W.getComputedStyle(document.documentElement).getPropertyValue('--font-' + key).trim();
    return (stackCache[key] = x || (key === 'serif' ? 'Georgia, serif' : key === 'mono' ? 'monospace' : 'sans-serif'));
  }
  function textW(str, kind) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    const [w, sz, fam] = FONT[kind || 'label'];
    mctx.font = `${w} ${sz}px ${fontStack(fam)}`;
    return mctx.measureText(String(str)).width;
  }
  function wrapText(str, kind, maxW, maxLines) {
    const words = String(str).split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (!line || textW(t, kind) <= maxW) line = t; else { lines.push(line); line = w; } }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] += '…'; return keep; }
    return lines;
  }
  function svgLines(parent, x, y, lines, attrs, lh) {
    const t = s('text', Object.assign({ x, y }, attrs), parent);
    lines.forEach((ln, i) => s('tspan', { x, dy: i === 0 ? 0 : lh, text: ln }, t));
    return t;
  }

  // ------------------------------------------------------------------ label placement (cluster dodge)
  function dodge(items, gap, lo, hi) {
    const arr = items.slice().sort((a, b) => a.y - b.y);
    const lay = (c) => { const tot = c.items.reduce((a, i) => a + i.h, 0) + gap * (c.items.length - 1); const mean = c.items.reduce((a, i) => a + i.y, 0) / c.items.length; c.size = tot; c.top = clamp(mean - tot / 2, lo, Math.max(lo, hi - tot)); };
    const cl = arr.map((it) => { const c = { items: [it] }; lay(c); return c; });
    for (let merged = true; merged;) {
      merged = false;
      for (let i = 0; i < cl.length - 1; i++) if (cl[i].top + cl[i].size + gap > cl[i + 1].top) { cl[i].items = cl[i].items.concat(cl[i + 1].items); lay(cl[i]); cl.splice(i + 1, 1); merged = true; break; }
    }
    for (const c of cl) { let y = c.top; for (const it of c.items) { it.ly = y + it.h / 2; y += it.h + gap; } }
    return items;
  }

  // ------------------------------------------------------------------ colour assignment
  function assignColors(names, colors, hl) {
    const out = {}, hlOrder = hl && hl.size ? [...hl] : null;
    names.forEach((n, i) => {
      if (colors && colors[n] != null) out[n] = { color: colorVar(colors[n]), context: false };
      else if (hlOrder) { const k = hlOrder.indexOf(n); out[n] = k >= 0 ? { color: slotVar(k + 1), context: false, slot: k + 1 } : { color: cv('mark-context'), context: true }; }
      else if (i < 8) out[n] = { color: slotVar(i + 1), context: false, slot: i + 1 };
      else out[n] = { color: cv('mark-context'), context: true };
    });
    if (!hlOrder && names.length > 8) warn(`${names.length} series: categorical slots stop at 8, so series 9+ are drawn as grey context. Fold the tail into "Other" or use SmallMultiples.`);
    return out;
  }

  // ------------------------------------------------------------------ tooltip
  function Tooltip(root) {
    const node = h('div', { class: 'ht-tooltip', hidden: true, 'aria-hidden': 'true' });
    root.appendChild(node);
    return {
      show(px, py, title, rows) {
        node.textContent = '';
        if (title != null && title !== '') node.appendChild(h('div', { class: 'ht-tooltip-title', text: String(title) }));
        for (const r of rows) node.appendChild(h('div', { class: 'ht-tooltip-row' }, h('span', { class: 'ht-tooltip-key ht-tooltip-key--' + (r.shape || 'line'), style: { 'background-color': r.color || 'transparent', 'border-color': r.color || 'transparent' } }), h('span', { class: 'ht-tooltip-v', text: String(r.value) }), h('span', { class: 'ht-tooltip-l', text: r.label == null ? '' : String(r.label) })));
        node.hidden = false;
        const rw = root.clientWidth, tw = node.offsetWidth, th = node.offsetHeight;
        let x = px + 16, y = py - th - 12;
        if (x + tw > rw) x = px - tw - 16;
        if (x < 0) x = Math.max(0, Math.min(rw - tw, px - tw / 2));
        if (y < 0) y = py + 16;
        node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      },
      hide() { node.hidden = true; },
    };
  }
  /** Pointer + keyboard driver: pick(mx,my) -> index; show(i); hide(). Keyboard steps through indices. */
  function interact(svgEl, area, n, pick, show, hide) {
    let cur = -1;
    const pos = (e) => { const r = svgEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    area.addEventListener('pointermove', (e) => { const [mx, my] = pos(e); const i = pick(mx, my); if (i == null || i < 0) { hide(); cur = -1; } else { cur = i; show(i, true); } });
    area.addEventListener('pointerleave', () => { hide(); cur = -1; });
    svgEl.addEventListener('keydown', (e) => {
      const k = e.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(k)) return;
      e.preventDefault();
      if (k === 'Escape') { hide(); cur = -1; return; }
      if (k === 'Home') cur = 0; else if (k === 'End') cur = n - 1;
      else cur = clamp((cur < 0 ? (k === 'ArrowLeft' || k === 'ArrowUp' ? n : -1) : cur) + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1), 0, n - 1);
      show(cur, false);
    });
    svgEl.addEventListener('blur', () => { hide(); cur = -1; });
  }

  // ------------------------------------------------------------------ mounting
  function mount(el, props, draw, name, opts) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) throw new Error(`[Halftone] ${name}: target element not found`);
    opts = opts || {};
    let cur = props || {}, ctx = null, dead = false, lastW = -1;
    el.textContent = '';
    const root = h('div', { class: 'ht-chart ht-c-' + name.replace(/[A-Z]/g, (m, i) => (i ? '-' : '') + m.toLowerCase()) });
    el.appendChild(root);
    function render(force) {
      if (dead) return;
      const w = Math.max(120, Math.round(cur.width || el.clientWidth || root.clientWidth || 640));
      if (!force && Math.abs(w - lastW) < 2) return;
      lastW = w;
      if (ctx && ctx.cleanup) ctx.cleanup();
      root.textContent = '';
      try { ctx = draw(root, cur, w) || {}; }
      catch (e) { root.textContent = ''; root.appendChild(h('p', { class: 'ht-error', text: `${name}: ${e.message}` })); warn(e.stack || e.message); ctx = {}; }
    }
    render(true);
    let ro = null;
    if (!opts.static && W.ResizeObserver && !cur.width) { ro = new W.ResizeObserver(() => W.requestAnimationFrame(() => render(false))); ro.observe(el); }
    if (!opts.static && document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { for (const k in stackCache) delete stackCache[k]; render(true); });
    return {
      el: root,
      update(p) { cur = Object.assign({}, cur, p); render(true); return this; },
      replace(p) { cur = p || {}; render(true); return this; },
      destroy() { dead = true; if (ro) ro.disconnect(); if (ctx && ctx.cleanup) ctx.cleanup(); el.textContent = ''; },
      table() { return ctx && ctx.table ? (isFn(ctx.table) ? ctx.table() : ctx.table) : null; },
      get props() { return cur; },
    };
  }
  function svgRoot(root, w, hgt, label, focusable) {
    const el = s('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, role: 'img', 'aria-label': label || 'Chart', class: 'ht-svg' });
    if (focusable) el.setAttribute('tabindex', '0');
    root.appendChild(el);
    return el;
  }
  function legendEl(items, extraClass) {
    return h('div', { class: 'ht-legend' + (extraClass ? ' ' + extraClass : ''), role: 'list' }, items.map((it) =>
      h('span', { class: 'ht-legend-item', role: 'listitem' }, h('span', { class: 'ht-swatch ht-swatch--' + (it.shape || 'rect'), style: { 'background-color': it.color, 'border-color': it.color, '--swatch': it.color } }), h('span', { text: it.label }))));
  }
  function ariaSummary(p, fallback) { return p.ariaLabel || [p.title, p.dek].filter(Boolean).join('. ') || fallback; }

  // ------------------------------------------------------------------ axes
  function drawYAxis(g, y, tk, iw, fm, o) {
    o = o || {};
    const ga = s('g', { class: 'ht-axis ht-axis--y' }, g);
    tk.values.forEach((t, i) => {
      const yy = Math.round(y(t)) + 0.5;
      if (!o.noGrid) s('line', { x1: o.x0 || 0, x2: iw, y1: yy, y2: yy, class: t === 0 ? 'ht-baseline' : 'ht-grid' }, ga);
      if (o.noLabels) return;
      let lab = fm(t);
      if (o.unit && i === tk.values.length - 1) lab += o.unit;
      s('text', { x: -8, y: yy + 4, 'text-anchor': 'end', class: 'ht-tick', text: lab }, ga);
    });
    return ga;
  }
  function drawXTicks(g, f, tk, ih, left, right, iw, o) {
    o = o || {};
    const ga = s('g', { class: 'ht-axis ht-axis--x' }, g);
    let lastEnd = -Infinity;
    const placed = [];
    for (const t of tk) {
      const xx = Math.round(f(t.v)) + 0.5, w = textW(t.label, 'tick');
      let anchor = 'middle', x0 = xx - w / 2;
      if (x0 < -left) { anchor = 'start'; x0 = xx; } else if (xx + w / 2 > iw + right) { anchor = 'end'; x0 = xx - w; }
      if (x0 < lastEnd + 8) continue;
      lastEnd = x0 + w;
      placed.push(t);
      if (o.grid) s('line', { x1: xx, x2: xx, y1: 0, y2: ih, class: 'ht-grid' }, ga);
      s('line', { x1: xx, x2: xx, y1: ih, y2: ih + 4, class: 'ht-tickmark' }, ga);
      s('text', { x: xx, y: ih + 17, 'text-anchor': anchor, class: 'ht-tick', text: t.label }, ga);
    }
    return placed;
  }

  // ------------------------------------------------------------------ annotations & references
  function drawAnnotations(g, anns, xf, yf, iw, ih, resolve) {
    if (!anns || !anns.length) return;
    const ga = s('g', { class: 'ht-annotations' }, g);
    for (const a of anns) {
      const pt = resolve(a);
      if (!pt) continue;
      const px = pt[0], py = pt[1];
      const maxW = Math.min(a.width || 170, Math.max(90, iw * 0.45));
      const lines = wrapText(a.text, 'annot', maxW);
      const tw = Math.max(...lines.map((l) => textW(l, 'annot')));
      const left = a.dx != null ? a.dx < 0 : px > iw * 0.6;
      const dx = a.dx != null ? a.dx : left ? -18 : 18;
      const dy = a.dy != null ? a.dy : (py > ih * 0.35 ? -34 : 30);
      let tx = px + dx, ty = py + dy;
      tx = left ? clamp(tx, tw, iw) : clamp(tx, 0, iw - tw);
      const lh = 18, blockH = lh * lines.length;
      ty = clamp(ty, 10, ih - blockH + 12);
      const ly = dy < 0 ? ty + blockH - 12 : ty - 12;
      s('path', { d: `M${f1(px)},${f1(py)}L${f1(tx + (left ? 3 : -3))},${f1(ly)}`, class: 'ht-leader' }, ga);
      s('circle', { cx: px, cy: py, r: 3, class: 'ht-annot-dot' }, ga);
      svgLines(ga, tx, ty, lines, { class: 'ht-annot ht-halo', 'text-anchor': left ? 'end' : 'start' }, lh);
    }
  }
  function drawReferences(g, refs, yf, iw, gutter) {
    if (!refs || !refs.length) return;
    const ga = s('g', { class: 'ht-refs' }, g);
    for (const r of refs) {
      const yy = Math.round(yf(r.y)) + 0.5;
      s('line', { x1: 0, x2: iw, y1: yy, y2: yy, class: 'ht-ref' }, ga);
      if (r.label && !gutter) s('text', { x: iw, y: yy - 5, 'text-anchor': 'end', class: 'ht-ref-label ht-halo', text: r.label }, ga);
    }
  }
  function linePath(pts, X, Y, step) {
    let d = '', pen = false, lastY = 0;
    for (const p of pts) {
      if (!isNum(p.y)) { pen = false; continue; }
      const xx = f1(X(p)), yy = f1(Y(p.y));
      if (step && pen) d += `H${xx}V${yy}`; else d += (pen ? 'L' : 'M') + xx + ',' + yy;
      pen = true; lastY = yy;
    }
    return d;
  }
  function areaPath(pts, X, lo, hi) {
    const ok = pts.filter((p) => isNum(lo(p)) && isNum(hi(p)));
    if (ok.length < 2) return '';
    return 'M' + ok.map((p) => `${f1(X(p))},${f1(hi(p))}`).join('L') + 'L' + ok.slice().reverse().map((p) => `${f1(X(p))},${f1(lo(p))}`).join('L') + 'Z';
  }
  function tableModel(columns, rows) { return { columns, rows }; }

  // ================================================================== LineChart
  function LineChart(root, p, W0) {
    const X = accessor(p.x, 'x'), Y = accessor(p.y, 'y'), S = p.series === false ? null : accessor(p.series, 'series');
    const band = p.band || null;
    const rows = (p.data || []).map((d) => ({ x: parseX(X(d)), y: num(Y(d)), s: S ? S(d) : undefined, lo: band ? num(d[band.lower]) : NaN, hi: band ? num(d[band.upper]) : NaN }));
    if (!rows.some((r) => r.s != null)) rows.forEach((r) => (r.s = p.name || 'Value'));
    const names = p.seriesOrder || uniq(rows.map((r) => r.s));
    const groups = names.map((n) => ({ name: n, pts: rows.filter((r) => r.s === n).sort((a, b) => +a.x - +b.x) }));
    const hl = toSet(p.highlight), col = assignColors(names, p.colors, hl), proj = toSet(p.projected);
    const yFmtUser = p.yFormat || p.format;
    const labelsMode = p.labels || (names.length > 6 && !hl.size ? 'legend' : 'end');
    const legendItems = [];
    const coloured = groups.filter((g) => !col[g.name].context);
    if (p.legend !== false && (labelsMode === 'legend' || coloured.length > 1)) coloured.forEach((g) => legendItems.push({ label: String(g.name), color: col[g.name].color, shape: proj.has(g.name) ? 'dash' : 'line' }));
    if (band && band.label) legendItems.push({ label: band.label, color: col[groups[0].name].color, shape: 'band' });
    if (legendItems.length && !(names.length === 1 && !band)) root.appendChild(legendEl(legendItems));

    const hgt = p.height || clamp(Math.round(W0 * 0.56), 220, 420);
    const yVals = rows.map((r) => r.y).concat(band ? rows.flatMap((r) => [r.lo, r.hi]) : []).concat((p.references || []).map((r) => r.y));
    const top = p.yLabel ? 30 : 12, bottom = 28;
    const ih0 = hgt - top - bottom;
    const tickCount = Math.max(3, Math.round(ih0 / 60));
    const yDom = valueDomain(yVals, { zero: p.zero, domain: p.yDomain, count: tickCount });
    const yTk = linTicks(yDom[0], yDom[1], tickCount);
    const yFmt = makeFormat(yFmtUser || 'auto', { step: yTk.step });
    const left = Math.ceil(Math.max(...yTk.values.map((t, i) => textW(yFmt(t) + (p.yUnit && i === yTk.values.length - 1 ? p.yUnit : ''), 'tick')))) + 12;
    const lastOf = (g) => { for (let i = g.pts.length - 1; i >= 0; i--) if (isNum(g.pts[i].y)) return g.pts[i]; return null; };
    const endLabel = (g) => String(g.name) + (p.endValues ? '  ' + makeFormat(yFmtUser || 'auto')(lastOf(g) ? lastOf(g).y : NaN) : '');
    const xMaxAll = Math.max(...rows.map((r) => +r.x).filter(isNum)), xMinAll = Math.min(...rows.map((r) => +r.x).filter(isNum));
    const reachesEnd = (g) => { const l = lastOf(g); return l && (xMaxAll - +l.x) <= (xMaxAll - xMinAll) * 0.04; };
    const labelled = labelsMode === 'end' ? groups.filter((g) => (p.endLabels ? toSet(p.endLabels).has(g.name) : (!col[g.name].context || p.labelContext) && reachesEnd(g))) : [];
    const refLabs = (p.references || []).filter((r) => r.label);
    const maxLab = labelled.length || refLabs.length ? Math.max(0, ...labelled.map((g) => textW(endLabel(g), hl.has(g.name) ? 'strong' : 'label')), ...refLabs.map((r) => textW(r.label, 'tick'))) : 0;
    const labCap = Math.round(W0 * 0.3);
    const right = labelled.length || refLabs.length ? Math.min(maxLab, labCap) + 22 : 14;
    const iw = Math.max(60, W0 - left - right), ih = ih0;
    const xm = xAxisModel(rows.map((r) => r.x), [0, iw], { domain: p.xDomain, format: p.xFormat });
    const xs = (pt) => xm.f(+pt.x), ys = linear(yDom, [ih, 0]);

    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Line chart'), p.interactive !== false);
    const g = s('g', { transform: `translate(${left},${top})` }, svgEl);
    if (p.yLabel) s('text', { x: -left, y: -16, class: 'ht-axis-title', text: p.yLabel }, g);
    drawYAxis(g, ys, yTk, iw, yFmt, { unit: p.yUnit });
    drawXTicks(g, xm.f, xm.ticks(Math.max(3, Math.round(iw / 90))), ih, left, right, iw);
    if (band) groups.forEach((gr) => { const d = areaPath(gr.pts, xs, (q) => ys(q.lo), (q) => ys(q.hi)); if (d) s('path', { d, class: 'ht-band', style: { fill: col[gr.name].color } }, g); });
    if (p.area && groups.length === 1) { const gr = groups[0], y0 = ys(Math.max(yDom[0], Math.min(0, yDom[1]))); const d = areaPath(gr.pts, xs, () => y0, (q) => ys(q.y)); if (d) s('path', { d, class: 'ht-area', style: { fill: col[gr.name].color } }, g); }
    drawReferences(g, p.references, ys, iw, true);
    const order = groups.slice().sort((a, b) => (col[b.name].context ? 1 : 0) - (col[a.name].context ? 1 : 0));
    for (const gr of order) {
      const c = col[gr.name];
      s('path', { d: linePath(gr.pts, xs, ys, p.curve === 'step'), class: 'ht-line' + (c.context ? ' ht-line--context' : '') + (proj.has(gr.name) ? ' ht-line--projected' : ''), style: c.context ? null : { stroke: c.color } }, g);
    }
    // end markers + labels
    const marks = s('g', { class: 'ht-ends' }, g), labs = [];
    for (const gr of groups) {
      const c = col[gr.name], last = lastOf(gr);
      if (!last) continue;
      if ((p.markers || 'end') !== 'none' && (!c.context || p.labelContext) && (labelled.includes(gr) || !labelled.length && reachesEnd(gr))) s('circle', { cx: xs(last), cy: ys(last.y), r: 4, class: 'ht-dot', style: { fill: c.color } }, marks);
      if (labelled.includes(gr)) labs.push({ g: gr, y: ys(last.y), h: 15, x: xs(last), strong: hl.has(gr.name) || (!hl.size && names.length === 1) });
    }
    refLabs.forEach((r) => labs.push({ ref: r, y: ys(r.y), h: 14, x: iw }));
    dodge(labs, 2, -6, ih + 6);
    for (const L of labs) {
      if (L.ref) { if (Math.abs(L.ly - L.y) > 2) s('path', { d: `M${f1(iw + 2)},${f1(L.y)}L${f1(iw + 7)},${f1(L.ly)}`, class: 'ht-leader' }, marks); s('text', { x: iw + 10, y: L.ly + 4, class: 'ht-ref-label', text: L.ref.label }, marks); continue; }
      const lx = iw + 10, moved = Math.abs(L.ly - L.y) > 2 || lx - L.x > 14;
      if (moved) s('path', { d: `M${f1(L.x + 6)},${f1(L.y)}L${f1(lx - 3)},${f1(L.ly)}`, class: 'ht-leader' }, marks);
      const txt = endLabel(L.g), shown = textW(txt, L.strong ? 'strong' : 'label') > labCap ? wrapText(txt, L.strong ? 'strong' : 'label', labCap, 1) : [txt];
      s('text', { x: lx, y: L.ly + 4.5, class: 'ht-label' + (L.strong ? ' ht-label--strong' : '') + (col[L.g.name].context ? ' ht-label--muted' : ''), text: shown[0] }, marks);
    }
    drawAnnotations(g, p.annotations, xm.f, ys, iw, ih, (a) => {
      const ax = +parseX(a.x);
      let ay = a.y;
      if (ay == null) { const gr = groups.find((q) => q.name === (a.series != null ? a.series : names[0])); const pt = gr && gr.pts.find((q) => +q.x === ax); ay = pt ? pt.y : NaN; }
      return isNum(ax) && isNum(ay) ? [xm.f(ax), ys(ay)] : null;
    });
    // hover
    const cleanup = [];
    if (p.interactive !== false) {
      const tip = Tooltip(root), xsU = xm.sorted;
      const cross = s('g', { class: 'ht-cross', visibility: 'hidden' }, g);
      const cl = s('line', { y1: 0, y2: ih, class: 'ht-crosshair' }, cross), dots = s('g', null, cross);
      const area = s('rect', { x: 0, y: 0, width: iw, height: ih, class: 'ht-hit' }, g);
      const byKey = groups.map((gr) => new Map(gr.pts.map((q) => [+q.x, q])));
      const pick = (mx) => { const v = xm.f.invert(mx - left); let lo = 0, hi = xsU.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xsU[m] < v) lo = m; else hi = m; } return Math.abs(xsU[lo] - v) <= Math.abs(xsU[hi] - v) ? lo : hi; };
      const show = (i) => {
        const xv = xsU[i], xx = xm.f(xv);
        cross.setAttribute('visibility', 'visible'); cl.setAttribute('x1', xx); cl.setAttribute('x2', xx); dots.textContent = '';
        const rr = []; let minY = ih;
        groups.forEach((gr, k) => { const q = byKey[k].get(xv); if (!q || !isNum(q.y)) return; const yy = ys(q.y); minY = Math.min(minY, yy); s('circle', { cx: xx, cy: yy, r: 4, class: 'ht-dot', style: { fill: col[gr.name].color } }, dots); rr.push({ y: q.y, color: col[gr.name].color, label: names.length > 1 ? String(gr.name) : (p.name || ''), value: makeFormat(yFmtUser || 'auto')(q.y) + (p.yUnit && !yFmtUser ? p.yUnit : '') + (band && isNum(q.lo) ? `  (${makeFormat(yFmtUser || 'auto')(q.lo)}–${makeFormat(yFmtUser || 'auto')(q.hi)})` : '') }); });
        rr.sort((a, b) => b.y - a.y);
        tip.show(left + xx, top + minY, xm.label(xv), rr.slice(0, 12));
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hide(); };
      interact(svgEl, area, xsU.length, (mx) => pick(mx), show, hide);
    }
    return {
      cleanup: () => cleanup.forEach((f) => f()),
      table: () => {
        const xsU = xm.sorted, byKey = groups.map((gr) => new Map(gr.pts.map((q) => [+q.x, q])));
        const cols = [{ key: 'x', label: p.xLabel || (xm.isTime ? 'Date' : 'x') }].concat(groups.map((gr, k) => ({ key: 's' + k, label: String(gr.name), numeric: true, format: makeFormat(yFmtUser || 'auto') })));
        return tableModel(cols, xsU.map((xv) => { const r = { x: xm.label(xv) }; groups.forEach((gr, k) => { const q = byKey[k].get(xv); r['s' + k] = q ? q.y : null; }); return r; }));
      },
    };
  }

  // ================================================================== BarChart
  function hbarPath(x0, x1, y, t, r) {
    const len = Math.abs(x1 - x0); if (len < 0.25) return '';
    r = Math.min(r, len, t / 2);
    return x1 >= x0
      ? `M${f1(x0)},${f1(y)}H${f1(x1 - r)}A${r},${r} 0 0 1 ${f1(x1)},${f1(y + r)}V${f1(y + t - r)}A${r},${r} 0 0 1 ${f1(x1 - r)},${f1(y + t)}H${f1(x0)}Z`
      : `M${f1(x0)},${f1(y)}H${f1(x1 + r)}A${r},${r} 0 0 0 ${f1(x1)},${f1(y + r)}V${f1(y + t - r)}A${r},${r} 0 0 0 ${f1(x1 + r)},${f1(y + t)}H${f1(x0)}Z`;
  }
  function vbarPath(y0, y1, x, t, r) {
    const len = Math.abs(y1 - y0); if (len < 0.25) return '';
    r = Math.min(r, len, t / 2);
    return y1 <= y0
      ? `M${f1(x)},${f1(y0)}V${f1(y1 + r)}A${r},${r} 0 0 1 ${f1(x + r)},${f1(y1)}H${f1(x + t - r)}A${r},${r} 0 0 1 ${f1(x + t)},${f1(y1 + r)}V${f1(y0)}Z`
      : `M${f1(x)},${f1(y0)}V${f1(y1 - r)}A${r},${r} 0 0 0 ${f1(x + r)},${f1(y1)}H${f1(x + t - r)}A${r},${r} 0 0 0 ${f1(x + t)},${f1(y1 - r)}V${f1(y0)}Z`;
  }
  function BarChart(root, p, W0) {
    const C = accessor(p.category, 'category'), V = accessor(p.value, 'value'), S = p.series ? accessor(p.series, 'series') : null;
    const horiz = (p.orientation || 'horizontal') !== 'vertical';
    const rows = (p.data || []).map((d) => ({ c: String(C(d)), v: num(V(d)), s: S ? S(d) : null }));
    const sNames = S ? p.seriesOrder || uniq(rows.map((r) => r.s)) : [null];
    const stack = !!(p.stack && S);
    const valOf = new Map(rows.map((r) => [r.c + '\u0000' + r.s, r.v]));
    const val = (c, sn) => { const x = valOf.get(c + '\u0000' + sn); return x == null ? NaN : x; };
    const total = (c) => (stack ? sum(sNames.map((sn) => val(c, sn))) : S ? Math.max(...sNames.map((sn) => val(c, sn)).filter(isNum)) : val(c, null));
    let cats = p.categoryOrder ? p.categoryOrder.slice() : uniq(rows.map((r) => r.c));
    const sort = p.sort || (horiz && !S ? 'desc' : 'none');
    if (!p.categoryOrder) { if (sort === 'desc') cats.sort((a, b) => total(b) - total(a)); else if (sort === 'asc') cats.sort((a, b) => total(a) - total(b)); else if (sort === 'alpha') cats.sort((a, b) => a.localeCompare(b)); }
    const hl = toSet(p.highlight);
    const scol = assignColors(sNames.map((x) => (x == null ? '__single' : x)), p.colors, null);
    const barColor = (c, sn) => (S ? scol[sn].color : hl.size ? (hl.has(c) ? slotVar(1) : cv('mark-context')) : colorVar(p.color, 1));
    if (S && sNames.length > 1) root.appendChild(legendEl(sNames.map((sn) => ({ label: String(sn), color: scol[sn].color, shape: 'rect' }))));
    const valuesMode = p.values || (cats.length <= (horiz ? 14 : 10) && (!S || stack) ? 'tip' : 'axis');
    const fmtUser = p.format;
    const allVals = stack ? cats.map(total) : rows.map((r) => r.v);
    let [lo, hi] = extent(allVals); lo = Math.min(0, lo); hi = Math.max(0, hi);
    if (p.max != null) hi = Math.max(hi, p.max);
    const k = sNames.length;
    const svgParts = {};
    const barMax = 24, gap = 2, r = 2;
    const tip = p.interactive !== false ? Tooltip(root) : null;
    const tipRows = (c) => (S ? sNames.map((sn) => ({ color: scol[sn].color, shape: 'rect', label: String(sn), value: makeFormat(fmtUser || 'auto')(val(c, sn)) })) : [{ color: barColor(c), shape: 'rect', label: p.name || '', value: makeFormat(fmtUser || 'auto')(val(c, null)) }]);
    let svgEl, g, hits = [], hgt;
    if (horiz) {
      const labMax = Math.round(W0 * 0.36);
      const labLines = cats.map((c) => wrapText(c, 'label', labMax, 2));
      const labW = Math.min(labMax, Math.ceil(Math.max(...labLines.map((ls, i) => Math.max(...ls.map((l) => textW(l, hl.has(cats[i]) ? 'strong' : 'label')))))));
      const multi = labLines.some((l) => l.length > 1);
      const rowH = p.rowHeight || (S && !stack ? Math.max(30, k * 12 + 12) : multi ? 38 : 30);
      const tipW = valuesMode === 'tip' ? Math.ceil(Math.max(...cats.map((c) => textW(makeFormat(fmtUser || 'auto')(total(c)), 'value')))) + 10 : 0;
      const left = labW + 14, rightM = valuesMode === 'tip' ? tipW + 6 : 16, top = 4, bottom = valuesMode === 'axis' ? 26 : 4;
      const iw = Math.max(60, W0 - left - rightM), ih = cats.length * rowH;
      hgt = ih + top + bottom;
      let dom = [lo, hi];
      let tk = null;
      if (valuesMode === 'axis') { dom = nice(lo, hi, Math.max(3, Math.round(iw / 110))); tk = linTicks(dom[0], dom[1], Math.max(3, Math.round(iw / 110))); }
      const x = linear(dom, [0, iw]);
      svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Bar chart'), !!tip);
      g = s('g', { transform: `translate(${left},${top})` }, svgEl);
      if (tk) { const fm = makeFormat(fmtUser || 'auto', { step: tk.step }); const ga = s('g', { class: 'ht-axis' }, g); tk.values.forEach((t) => { const xx = Math.round(x(t)) + 0.5; s('line', { x1: xx, x2: xx, y1: 0, y2: ih, class: 'ht-grid' }, ga); s('text', { x: xx, y: ih + 17, 'text-anchor': 'middle', class: 'ht-tick', text: fm(t) + (p.unit && t === tk.values[tk.values.length - 1] ? p.unit : '') }, ga); }); }
      const x0 = x(0);
      cats.forEach((c, i) => {
        const y0 = i * rowH;
        const isH = hl.has(c);
        svgLines(g, -10, y0 + rowH / 2 + 4.5 - (labLines[i].length - 1) * 7.5, labLines[i], { 'text-anchor': 'end', class: 'ht-label' + (isH ? ' ht-label--strong' : '') }, 15);
        if (stack) {
          let cum = 0; const t = Math.min(barMax, rowH * 0.62), yy = y0 + (rowH - t) / 2;
          const segs = sNames.filter((sn) => isNum(val(c, sn)) && val(c, sn) > 0);
          segs.forEach((sn, j) => { const a = x(cum) + (j > 0 ? gap : 0), b = x(cum + val(c, sn)); cum += val(c, sn); const last = j === segs.length - 1; s('path', { d: last ? hbarPath(a, b, yy, t, r) : `M${f1(a)},${f1(yy)}H${f1(Math.max(a, b))}V${f1(yy + t)}H${f1(a)}Z`, class: 'ht-bar', style: { fill: scol[sn].color } }, g); });
          if (valuesMode === 'tip') s('text', { x: x(cum) + 6, y: y0 + rowH / 2 + 4.5, class: 'ht-value', text: makeFormat(fmtUser || 'auto')(cum) }, g);
        } else {
          const sub = S ? Math.min(14, (rowH - 8 - (k - 1) * gap) / k) : Math.min(barMax, rowH * 0.62);
          const blockT = S ? sub * k + gap * (k - 1) : sub;
          sNames.forEach((sn, j) => {
            const vv = val(c, sn); if (!isNum(vv)) return;
            const yy = y0 + (rowH - blockT) / 2 + j * (sub + gap);
            s('path', { d: hbarPath(x0, x(vv), yy, sub, r), class: 'ht-bar', style: { fill: barColor(c, sn) } }, g);
            if (valuesMode === 'tip') s('text', { x: vv >= 0 ? x(vv) + 6 : x(vv) - 6, y: yy + sub / 2 + 4.5, 'text-anchor': vv >= 0 ? 'start' : 'end', class: 'ht-value' + (isH ? ' ht-value--strong' : ''), text: makeFormat(fmtUser || 'auto')(vv) + (p.unit && i === 0 && j === 0 ? p.unit : '') }, g);
          });
        }
        hits.push({ x: -left, y: y0, w: W0, h: rowH, c, cx: left + iw / 2, cy: top + y0 });
      });
      s('line', { x1: Math.round(x0) + 0.5, x2: Math.round(x0) + 0.5, y1: -2, y2: ih + 2, class: 'ht-baseline' }, g);
      svgParts.top = top;
    } else {
      hgt = p.height || clamp(Math.round(W0 * 0.5), 220, 380);
      const top = 16;
      let dom = [lo, hi], tk = null;
      const preTk = linTicks(...nice(lo, hi, 5), 5);
      if (valuesMode === 'axis') { dom = nice(lo, hi, 5); tk = linTicks(dom[0], dom[1], 5); }
      const fm = makeFormat(fmtUser || 'auto', { step: (tk || preTk).step });
      const left = tk ? Math.ceil(Math.max(...tk.values.map((t) => textW(fm(t) + (p.unit || ''), 'tick')))) + 12 : 12;
      const iw = W0 - left - 8;
      const bx = band(cats, 0, iw, 0.3, 0.15);
      const maxLines = 2;
      const labLines = cats.map((c) => wrapText(c, 'tick', Math.max(bx.step - 4, 24), maxLines));
      const nLines = Math.max(...labLines.map((l) => l.length));
      const bottom = 10 + nLines * 14 + 6;
      const ih = hgt - top - bottom;
      const y = linear(dom, [ih, 0]);
      svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Column chart'), !!tip);
      g = s('g', { transform: `translate(${left},${top})` }, svgEl);
      if (tk) drawYAxis(g, y, tk, iw, fm, { unit: p.unit });
      const every = Math.max(1, Math.ceil(Math.max(...labLines.map((ls) => Math.max(...ls.map((l) => textW(l, 'tick'))))) / (bx.step - 2)));
      const y0 = y(0);
      cats.forEach((c, i) => {
        const bx0 = bx(c), isH = hl.has(c);
        if (i % every === 0) svgLines(g, bx0 + bx.bw / 2, ih + 16, labLines[i], { 'text-anchor': 'middle', class: 'ht-tick' + (isH ? ' ht-tick--strong' : '') }, 14);
        if (stack) {
          let cum = 0; const t = Math.min(barMax, bx.bw), xx = bx0 + (bx.bw - t) / 2;
          const segs = sNames.filter((sn) => isNum(val(c, sn)) && val(c, sn) > 0);
          segs.forEach((sn, j) => { const a = y(cum) - (j > 0 ? gap : 0), b = y(cum + val(c, sn)); cum += val(c, sn); const last = j === segs.length - 1; s('path', { d: last ? vbarPath(a, b, xx, t, r) : `M${f1(xx)},${f1(a)}V${f1(Math.min(a, b))}H${f1(xx + t)}V${f1(a)}Z`, class: 'ht-bar', style: { fill: scol[sn].color } }, g); });
          if (valuesMode === 'tip') s('text', { x: bx0 + bx.bw / 2, y: y(cum) - 6, 'text-anchor': 'middle', class: 'ht-value', text: fm(cum) }, g);
        } else {
          const sub = S ? Math.min(barMax, (bx.bw - (k - 1) * gap) / k) : Math.min(barMax, bx.bw);
          const blockT = S ? sub * k + gap * (k - 1) : sub;
          sNames.forEach((sn, j) => {
            const vv = val(c, sn); if (!isNum(vv)) return;
            const xx = bx0 + (bx.bw - blockT) / 2 + j * (sub + gap);
            s('path', { d: vbarPath(y0, y(vv), xx, sub, r), class: 'ht-bar', style: { fill: barColor(c, sn) } }, g);
            if (valuesMode === 'tip') s('text', { x: xx + sub / 2, y: vv >= 0 ? y(vv) - 6 : y(vv) + 14, 'text-anchor': 'middle', class: 'ht-value' + (isH ? ' ht-value--strong' : ''), text: makeFormat(fmtUser || 'auto')(vv) }, g);
          });
        }
        hits.push({ x: bx0 - (bx.step - bx.bw) / 2, y: -top, w: bx.step, h: hgt, c, cx: left + bx0 + bx.bw / 2, cy: top + y(total(c)) });
      });
      s('line', { x1: -2, x2: iw + 2, y1: Math.round(y0) + 0.5, y2: Math.round(y0) + 0.5, class: 'ht-baseline' }, g);
    }
    if (tip) {
      const hitG = s('g', null, g);
      const rects = hits.map((hb) => s('rect', { x: hb.x, y: hb.y, width: hb.w, height: hb.h, class: 'ht-hit' }, hitG));
      let curI = -1;
      const show = (i) => { curI = i; rects.forEach((rc, j) => rc.classList.toggle('is-active', j === i)); tip.show(hits[i].cx, hits[i].cy, hits[i].c, tipRows(hits[i].c)); };
      const hide = () => { rects.forEach((rc) => rc.classList.remove('is-active')); tip.hide(); };
      const pickBar = (mx, my) => { if (horiz) { const yy = my - (svgParts.top || 0); return hits.findIndex((hb) => yy >= hb.y && yy < hb.y + hb.h); } let best = -1, bd = Infinity; hits.forEach((hb, i) => { const d = Math.abs(hb.cx - mx); if (d < bd) { bd = d; best = i; } }); return best; };
      interact(svgEl, hitG, hits.length, pickBar, show, hide);
    }
    return {
      table: () => tableModel([{ key: 'c', label: p.categoryLabel || 'Category' }].concat(sNames.map((sn, j) => ({ key: 's' + j, label: sn == null ? p.name || p.valueLabel || 'Value' : String(sn), numeric: true, format: makeFormat(fmtUser || 'auto') }))).concat(stack ? [{ key: 'tot', label: 'Total', numeric: true, format: makeFormat(fmtUser || 'auto') }] : []),
        cats.map((c) => { const r0 = { c }; sNames.forEach((sn, j) => (r0['s' + j] = val(c, sn))); if (stack) r0.tot = total(c); return r0; })),
    };
  }

  // ================================================================== DumbbellPlot
  function DumbbellPlot(root, p, W0) {
    const C = accessor(p.category, 'category'), A = accessor(p.from, 'from'), B = accessor(p.to, 'to');
    let rows = (p.data || []).map((d) => ({ c: String(C(d)), a: num(A(d)), b: num(B(d)) })).map((r) => Object.assign(r, { d: r.b - r.a }));
    const sort = p.sort || 'to';
    if (sort === 'to') rows.sort((x, y) => y.b - x.b); else if (sort === 'from') rows.sort((x, y) => y.a - x.a); else if (sort === 'delta') rows.sort((x, y) => y.d - x.d); else if (sort === 'alpha') rows.sort((x, y) => x.c.localeCompare(y.c));
    const fmtU = p.format || 'auto', fm = makeFormat(fmtU), fmS = signedFormat(p.deltaFormat || fmtU);
    const hl = toSet(p.highlight);
    const showDelta = p.showDelta !== false;
    const labMax = Math.round(W0 * 0.32);
    const labW = Math.min(labMax, Math.ceil(Math.max(...rows.map((r) => textW(r.c, hl.has(r.c) ? 'strong' : 'label')))));
    const deltaW = showDelta ? Math.ceil(Math.max(textW(p.deltaLabel || 'Change', 'tick'), ...rows.map((r) => textW(fmS(r.d), 'value')))) + 16 : 0;
    const rowH = 28, top = 40, bottom = 8, left = labW + 16, right = 14 + deltaW;
    const iw = Math.max(80, W0 - left - right), ih = rows.length * rowH, hgt = ih + top + bottom;
    const dom = valueDomain(rows.flatMap((r) => [r.a, r.b]), { zero: p.zero == null ? 'auto' : p.zero, domain: p.domain, count: Math.max(3, Math.round(iw / 110)) });
    const x = linear(dom, [0, iw]);
    const tk = linTicks(dom[0], dom[1], Math.max(3, Math.round(iw / 110)));
    const tf = makeFormat(fmtU === 'auto' ? 'auto' : fmtU, { step: tk.step });
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Dumbbell plot'), p.interactive !== false);
    const g = s('g', { transform: `translate(${left},${top})` }, svgEl);
    const ga = s('g', { class: 'ht-axis' }, g);
    tk.values.forEach((t, i) => { const xx = Math.round(x(t)) + 0.5; s('line', { x1: xx, x2: xx, y1: -4, y2: ih, class: t === 0 ? 'ht-baseline' : 'ht-grid' }, ga); s('text', { x: xx, y: -10, 'text-anchor': 'middle', class: 'ht-tick', text: tf(t) + (p.unit && i === tk.values.length - 1 ? p.unit : '') }, ga); });
    if (showDelta) s('text', { x: iw + deltaW + 6, y: -10, 'text-anchor': 'end', class: 'ht-tick', text: p.deltaLabel || 'Change' }, g);
    const fromC = cv('ink-2'), toC = colorVar(p.color, 1);
    rows.forEach((r, i) => {
      const yy = i * rowH + rowH / 2, isH = hl.has(r.c), dim = hl.size && !isH;
      s('line', { x1: 0, x2: iw, y1: Math.round(yy) + 0.5, y2: Math.round(yy) + 0.5, class: 'ht-grid ht-grid--row' }, g);
      s('text', { x: -12, y: yy + 4.5, 'text-anchor': 'end', class: 'ht-label' + (isH ? ' ht-label--strong' : '') + (dim ? ' ht-label--muted' : ''), text: r.c }, g);
      if (isNum(r.a) && isNum(r.b)) s('line', { x1: x(r.a), x2: x(r.b), y1: yy, y2: yy, class: 'ht-connector' + (dim ? ' is-dim' : '') }, g);
      if (isNum(r.a)) s('circle', { cx: x(r.a), cy: yy, r: 4.5, class: 'ht-dot-open', style: { stroke: dim ? cv('mark-context') : fromC } }, g);
      if (isNum(r.b)) s('circle', { cx: x(r.b), cy: yy, r: 5, class: 'ht-dot', style: { fill: dim ? cv('mark-context') : toC } }, g);
      if (showDelta) s('text', { x: iw + deltaW + 6, y: yy + 4.5, 'text-anchor': 'end', class: 'ht-value' + (isH ? ' ht-value--strong' : ''), text: fmS(r.d) }, g);
    });
    // direct legend over the first row
    const r0 = rows[0];
    if (r0 && isNum(r0.a) && isNum(r0.b)) {
      const la = p.fromLabel || 'Before', lb = p.toLabel || 'After';
      const xa = x(r0.a), xb = x(r0.b), wa = textW(la, 'label'), wb = textW(lb, 'label');
      const fits = Math.abs(xb - xa) > (wa + wb) / 2 + 10;
      const ly = -24;
      if (fits) {
        s('text', { x: xa, y: ly, 'text-anchor': 'middle', class: 'ht-label ht-label--muted ht-halo', text: la }, g);
        s('text', { x: xb, y: ly, 'text-anchor': 'middle', class: 'ht-label ht-label--strong ht-halo', text: lb }, g);
      } else {
        const lg = legendEl([{ label: la, color: fromC, shape: 'ring' }, { label: lb, color: toC, shape: 'dot' }]);
        root.insertBefore(lg, svgEl);
      }
    }
    if (p.interactive !== false) {
      const tip = Tooltip(root), hitG = s('g', null, g);
      const rects = rows.map((r, i) => s('rect', { x: -left, y: i * rowH, width: W0, height: rowH, class: 'ht-hit' }, hitG));
      const show = (i) => { const r = rows[i]; rects.forEach((rc, j) => rc.classList.toggle('is-active', j === i)); tip.show(left + x(Math.max(r.a, r.b)), top + i * rowH, r.c, [{ color: fromC, shape: 'ring', label: p.fromLabel || 'Before', value: fm(r.a) }, { color: toC, shape: 'dot', label: p.toLabel || 'After', value: fm(r.b) }, { color: 'transparent', label: p.deltaLabel || 'Change', value: fmS(r.d) }]); };
      const hide = () => { rects.forEach((rc) => rc.classList.remove('is-active')); tip.hide(); };
      interact(svgEl, hitG, rows.length, (mx, my) => { const i = Math.floor((my - top) / rowH); return i >= 0 && i < rows.length ? i : -1; }, show, hide);
    }
    return { table: () => tableModel([{ key: 'c', label: p.categoryLabel || 'Category' }, { key: 'a', label: p.fromLabel || 'Before', numeric: true, format: fm }, { key: 'b', label: p.toLabel || 'After', numeric: true, format: fm }, { key: 'd', label: p.deltaLabel || 'Change', numeric: true, format: fmS }], rows.map((r) => ({ c: r.c, a: r.a, b: r.b, d: r.d }))) };
  }

  // ================================================================== SlopeChart
  function SlopeChart(root, p, W0) {
    const C = accessor(p.category, 'category'), A = accessor(p.start, 'start'), B = accessor(p.end, 'end');
    const rows = (p.data || []).map((d) => ({ c: String(C(d)), a: num(A(d)), b: num(B(d)) }));
    const hl = toSet(p.highlight), fm = makeFormat(p.format || 'auto');
    const hlOrder = [...hl];
    const colOf = (r) => (hl.size ? (hl.has(r.c) ? slotVar(hlOrder.indexOf(r.c) + 1) : cv('mark-context')) : colorVar(p.color, 1));
    const labTxtL = (r) => `${r.c}  ${fm(r.a)}`, labTxtR = (r) => `${fm(r.b)}  ${r.c}`;
    const cap = Math.round(W0 * 0.3);
    const wl = Math.min(cap, Math.ceil(Math.max(...rows.map((r) => textW(labTxtL(r), 'strong'))))), wr = Math.min(cap, Math.ceil(Math.max(...rows.map((r) => textW(labTxtR(r), 'strong')))));
    const top = 34, bottom = 12, left = wl + 18, right = wr + 18;
    const hgt = p.height || clamp(rows.length * 24 + 80, 240, 460);
    const iw = Math.max(80, W0 - left - right), ih = hgt - top - bottom;
    const dom = valueDomain(rows.flatMap((r) => [r.a, r.b]), { zero: p.zero == null ? false : p.zero, domain: p.domain });
    const y = linear(dom, [ih, 0]);
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Slope chart'), p.interactive !== false);
    const g = s('g', { transform: `translate(${left},${top})` }, svgEl);
    s('line', { x1: 0.5, x2: 0.5, y1: -6, y2: ih + 6, class: 'ht-baseline' }, g);
    s('line', { x1: iw - 0.5, x2: iw - 0.5, y1: -6, y2: ih + 6, class: 'ht-baseline' }, g);
    s('text', { x: 0, y: -16, 'text-anchor': 'middle', class: 'ht-label ht-label--strong', text: p.startLabel || 'Start' }, g);
    s('text', { x: iw, y: -16, 'text-anchor': 'middle', class: 'ht-label ht-label--strong', text: p.endLabel || 'End' }, g);
    const ord = rows.slice().sort((a, b) => (hl.has(a.c) ? 1 : 0) - (hl.has(b.c) ? 1 : 0));
    for (const r of ord) {
      const c = colOf(r), ctx = hl.size && !hl.has(r.c);
      s('line', { x1: 0, x2: iw, y1: y(r.a), y2: y(r.b), class: 'ht-line' + (ctx ? ' ht-line--context' : ''), style: ctx ? null : { stroke: c } }, g);
      s('circle', { cx: 0, cy: y(r.a), r: ctx ? 3 : 4, class: 'ht-dot', style: { fill: c } }, g);
      s('circle', { cx: iw, cy: y(r.b), r: ctx ? 3 : 4, class: 'ht-dot', style: { fill: c } }, g);
    }
    const showAll = !hl.size || p.labelAll !== false;
    const labRows = rows.filter((r) => showAll || hl.has(r.c));
    const L = dodge(labRows.map((r) => ({ r, y: y(r.a), h: 15 })), 1, -8, ih + 8), R = dodge(labRows.map((r) => ({ r, y: y(r.b), h: 15 })), 1, -8, ih + 8);
    const lab = (it, side) => {
      const strong = hl.has(it.r.c), muted = hl.size && !strong;
      const xx = side === 'l' ? -12 : iw + 12;
      if (Math.abs(it.ly - it.y) > 2) s('path', { d: `M${side === 'l' ? -5 : iw + 5},${f1(it.y)}L${xx + (side === 'l' ? 2 : -2)},${f1(it.ly)}`, class: 'ht-leader' }, g);
      const t = s('text', { x: xx, y: it.ly + 4.5, 'text-anchor': side === 'l' ? 'end' : 'start', class: 'ht-label' + (strong ? ' ht-label--strong' : '') + (muted ? ' ht-label--muted' : '') }, g);
      if (side === 'l') { s('tspan', { text: it.r.c + '  ' }, t); s('tspan', { class: 'ht-num', text: fm(it.r.a) }, t); } else { s('tspan', { class: 'ht-num', text: fm(it.r.b) }, t); s('tspan', { text: '  ' + it.r.c }, t); }
    };
    L.forEach((it) => lab(it, 'l')); R.forEach((it) => lab(it, 'r'));
    if (p.interactive !== false) {
      const tip = Tooltip(root), hitG = s('g', null, g);
      rows.forEach((r) => s('line', { x1: 0, x2: iw, y1: y(r.a), y2: y(r.b), class: 'ht-hit-line' }, hitG));
      const show = (i) => { const r = rows[i]; tip.show(left + iw / 2, top + (y(r.a) + y(r.b)) / 2, r.c, [{ color: colOf(r), label: p.startLabel || 'Start', value: fm(r.a) }, { color: colOf(r), label: p.endLabel || 'End', value: fm(r.b) }, { color: 'transparent', label: 'Change', value: signedFormat(p.format || 'auto')(r.b - r.a) }]); };
      interact(svgEl, hitG, rows.length, (mx, my) => { const t = clamp((mx - left) / iw, 0, 1); let best = -1, bd = 14; rows.forEach((r, i) => { const yy = top + y(r.a) + (y(r.b) - y(r.a)) * t, d = Math.abs(yy - my); if (d < bd) { bd = d; best = i; } }); return best; }, show, () => tip.hide());
    }
    return { table: () => tableModel([{ key: 'c', label: p.categoryLabel || 'Item' }, { key: 'a', label: p.startLabel || 'Start', numeric: true, format: fm }, { key: 'b', label: p.endLabel || 'End', numeric: true, format: fm }], rows) };
  }

  // ================================================================== SmallMultiples
  function ols(pts) {
    const n = pts.length; if (n < 2) return null;
    const mx = sum(pts.map((q) => q[0])) / n, my = sum(pts.map((q) => q[1])) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [a, b] of pts) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    return { slope, intercept: my - slope * mx, r: syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy) };
  }
  function SmallMultiples(root, p, W0) {
    const type = p.panel === 'scatter' ? 'scatter' : 'line';
    const F = accessor(p.facet, 'facet'), X = accessor(p.x, 'x'), Y = accessor(p.y, 'y');
    const rows = (p.data || []).map((d) => ({ f: String(F(d)), x: parseX(X(d)), y: num(Y(d)) })).filter((r) => isNum(r.y) && (r.x instanceof Date || isNum(r.x)));
    let facets = p.facetOrder || uniq(rows.map((r) => r.f));
    const byF = new Map(facets.map((f) => [f, rows.filter((r) => r.f === f).sort((a, b) => +a.x - +b.x)]));
    const lastY = (f) => { const a = byF.get(f); return a && a.length ? a[a.length - 1].y : -Infinity; };
    if (!p.facetOrder) { if (p.order === 'alpha') facets.sort((a, b) => a.localeCompare(b)); else if (p.order === 'last-desc') facets.sort((a, b) => lastY(b) - lastY(a)); }
    const hl = toSet(p.highlight);
    const fitCols = clamp(Math.floor(W0 / (type === 'scatter' ? 150 : 130)), 1, 6);
    const cols = Math.max(1, Math.min(p.columns || clamp(Math.floor(W0 / (type === 'scatter' ? 210 : 175)), 1, 6), fitCols, facets.length));
    const nRows = Math.ceil(facets.length / cols);
    const fmY = p.yFormat || p.format || 'auto';
    const yDomAll = valueDomain(rows.map((r) => r.y), { zero: p.zero == null ? (type === 'scatter' ? false : 'auto') : p.zero, domain: p.yDomain, count: 3 });
    const yTk = linTicks(yDomAll[0], yDomAll[1], 3);
    const yF = makeFormat(fmY, { step: yTk.step });
    const left = Math.ceil(Math.max(...yTk.values.map((t) => textW(yF(t), 'tick')))) + 10;
    const gx = 22, gy = 30, titleH = 22, xAxisH = 22;
    const pw = Math.max(60, (W0 - left - 8 - gx * (cols - 1)) / cols);
    const ph = p.panelHeight || (type === 'scatter' ? Math.round(pw * 0.72) : clamp(Math.round(pw * 0.55), 80, 150));
    const hgt = nRows * (titleH + ph + xAxisH) + (nRows - 1) * (gy - xAxisH) + 6;
    const xm = xAxisModel(rows.map((r) => r.x), [0, pw], { domain: p.xDomain, format: p.xFormat });
    let xDomS = null;
    if (type === 'scatter') xDomS = valueDomain(rows.map((r) => +r.x), { zero: p.zeroX == null ? false : p.zeroX, domain: p.xDomain, count: 3 });
    const xS = type === 'scatter' ? linear(xDomS, [0, pw]) : (v) => xm.f(v);
    const xTkS = type === 'scatter' ? linTicks(xDomS[0], xDomS[1], 3) : null;
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Small multiples'), p.interactive !== false);
    const y = linear(yDomAll, [ph, 0]);
    const panels = [];
    facets.forEach((f, i) => {
      const cI = i % cols, rI = Math.floor(i / cols);
      const ox = left + cI * (pw + gx), oy = rI * (titleH + ph + gy);
      const g = s('g', { transform: `translate(${f1(ox)},${f1(oy + titleH)})` }, svgEl);
      s('text', { x: 0, y: -8, class: 'ht-label ht-label--strong', text: f }, g);
      drawYAxis(g, y, yTk, pw, yF, { noLabels: cI !== 0 });
      const pts = byF.get(f) || [];
      const isH = !hl.size || hl.has(f);
      const color = isH ? colorVar(p.color, 1) : cv('ink-3');
      if (type === 'line') {
        const ticks = xm.ticks(Math.max(2, Math.round(pw / 80)));
        const tk2 = ticks.length > 3 ? [ticks[0], ticks[ticks.length - 1]] : ticks;
        drawXTicks(g, xm.f, tk2, ph, 6, 6, pw);
        if (p.context !== false) for (const other of facets) if (other !== f) s('path', { d: linePath(byF.get(other) || [], (q) => xm.f(+q.x), y), class: 'ht-line ht-line--context ht-line--faint' }, g);
        s('path', { d: linePath(pts, (q) => xm.f(+q.x), y), class: 'ht-line', style: { stroke: color } }, g);
        const last = pts[pts.length - 1];
        if (last) {
          s('circle', { cx: xm.f(+last.x), cy: y(last.y), r: 3.5, class: 'ht-dot', style: { fill: color } }, g);
          if (p.endValues !== false) s('text', { x: xm.f(+last.x), y: y(last.y) - 9, 'text-anchor': 'end', class: 'ht-value ht-halo', text: makeFormat(fmY)(last.y) }, g);
        }
      } else {
        const ga = s('g', { class: 'ht-axis' }, g);
        xTkS.values.forEach((t) => { const xx = Math.round(xS(t)) + 0.5; s('line', { x1: xx, x2: xx, y1: 0, y2: ph, class: 'ht-grid' }, ga); s('text', { x: xx, y: ph + 16, 'text-anchor': 'middle', class: 'ht-tick', text: makeFormat(p.xFormat || 'auto', { step: xTkS.step })(t) }, ga); });
        if (p.trend === 'linear') { const fit = ols(pts.map((q) => [+q.x, q.y])); if (fit) { const xa = xDomS[0], xb = xDomS[1]; s('line', { x1: xS(xa), x2: xS(xb), y1: y(fit.intercept + fit.slope * xa), y2: y(fit.intercept + fit.slope * xb), class: 'ht-trend' }, g); s('text', { x: 4, y: 12, class: 'ht-value ht-halo', text: `r = ${fit.r.toFixed(2).replace('-', MINUS)}` }, g); } }
        for (const q of pts) s('circle', { cx: xS(+q.x), cy: y(q.y), r: 3.5, class: 'ht-dot', style: { fill: color } }, g);
      }
      panels.push({ f, g, ox, oy: oy + titleH, pts });
    });
    if (p.interactive !== false) {
      const tip = Tooltip(root);
      const flat = [];
      panels.forEach((pn, pi) => pn.pts.forEach((q) => flat.push({ pi, q })));
      const marker = s('circle', { r: 5, class: 'ht-dot ht-hover-dot', visibility: 'hidden' }, svgEl);
      const area = s('rect', { x: 0, y: 0, width: W0, height: hgt, class: 'ht-hit' }, svgEl);
      const show = (i) => { const it = flat[i], pn = panels[it.pi]; const cx = pn.ox + xS(+it.q.x), cy = pn.oy + y(it.q.y); marker.setAttribute('cx', cx); marker.setAttribute('cy', cy); marker.style.fill = colorVar(p.color, 1); marker.setAttribute('visibility', 'visible'); tip.show(cx, cy, pn.f, [{ color: colorVar(p.color, 1), label: type === 'line' ? xm.label(+it.q.x) : `x = ${makeFormat(p.xFormat || 'auto')(+it.q.x)}`, value: makeFormat(fmY)(it.q.y) }]); };
      const hide = () => { marker.setAttribute('visibility', 'hidden'); tip.hide(); };
      interact(svgEl, area, flat.length, (mx, my) => { let best = -1, bd = 30; flat.forEach((it, i) => { const pn = panels[it.pi]; const dx = pn.ox + xS(+it.q.x) - mx, dy = pn.oy + y(it.q.y) - my; const d = type === 'line' ? (Math.abs(dy) < ph && my > pn.oy - 4 && my < pn.oy + ph + 4 ? Math.abs(dx) : Infinity) : Math.hypot(dx, dy); if (d < bd) { bd = d; best = i; } }); return best; }, show, hide);
    }
    return { table: () => tableModel([{ key: 'f', label: p.facetLabel || 'Panel' }, { key: 'x', label: p.xLabel || 'x' }, { key: 'y', label: p.yLabel || 'y', numeric: true, format: makeFormat(fmY) }], rows.map((r) => ({ f: r.f, x: type === 'line' ? xm.label(+r.x) : r.x, y: r.y }))) };
  }

  // ================================================================== ScatterPlot
  function ScatterPlot(root, p, W0) {
    const X = accessor(p.x, 'x'), Y = accessor(p.y, 'y'), G = p.group ? accessor(p.group) : null, Z = p.size ? accessor(p.size) : null, Lb = p.label ? accessor(p.label) : null;
    let rows = (p.data || []).map((d) => ({ x: num(X(d)), y: num(Y(d)), g: G ? String(G(d)) : null, z: Z ? num(Z(d)) : NaN, l: Lb ? Lb(d) : null })).filter((r) => isNum(r.x) && isNum(r.y));
    let gNames = G ? p.groupOrder || uniq(rows.map((r) => r.g)) : [null];
    if (gNames.length > 4) { warn(`ScatterPlot: ${gNames.length} groups; any two dots can sit side by side, so only four colours stay distinguishable. Groups 5+ are folded into "Other".`); const keep = new Set(gNames.slice(0, 3)); rows.forEach((r) => { if (!keep.has(r.g)) r.g = 'Other'; }); gNames = gNames.slice(0, 3).concat(['Other']); }
    const hl = toSet(p.highlight);
    const gcol = (gn) => (gn === 'Other' && G ? cv('mark-context') : G ? slotVar(gNames.indexOf(gn) + 1) : colorVar(p.color, 1));
    const ptColor = (r) => (hl.size ? (hl.has(r.l) || hl.has(r.g) ? gcol(r.g) : cv('mark-context')) : gcol(r.g));
    if (G && gNames.length > 1) root.appendChild(legendEl(gNames.map((gn) => ({ label: gn, color: gcol(gn), shape: 'dot' }))));
    const mg = p.marginals ? 46 : 0;
    const hgt = p.height || clamp(Math.round(W0 * 0.66), 260, 500);
    const yDom = valueDomain(rows.map((r) => r.y), { zero: p.zeroY == null ? false : p.zeroY, domain: p.yDomain, count: 5 });
    const yTk = linTicks(yDom[0], yDom[1], 5), yF = makeFormat(p.yFormat || 'auto', { step: yTk.step });
    const left = Math.ceil(Math.max(...yTk.values.map((t) => textW(yF(t), 'tick')))) + 12;
    const top = 12 + (p.yLabel ? 20 : 0) + mg, bottom = 30 + (p.xLabel ? 18 : 0), right = 16 + mg;
    const iw = W0 - left - right, ih = hgt - top - bottom;
    const xDom = valueDomain(rows.map((r) => r.x), { zero: p.zeroX == null ? false : p.zeroX, domain: p.xDomain, count: Math.max(3, Math.round(iw / 100)) });
    const xTk = linTicks(xDom[0], xDom[1], Math.max(3, Math.round(iw / 100))), xF = makeFormat(p.xFormat || 'auto', { step: xTk.step });
    const x = linear(xDom, [0, iw]), y = linear(yDom, [ih, 0]);
    const zMax = Z ? Math.max(...rows.map((r) => r.z).filter(isNum)) : 1, rMax = p.maxRadius || 18;
    const rad = (r) => (Z ? Math.max(2.5, Math.sqrt(Math.max(0, r.z) / zMax) * rMax) : rows.length > 400 ? 2.5 : 4);
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Scatterplot'), p.interactive !== false);
    const g = s('g', { transform: `translate(${left},${top})` }, svgEl);
    if (p.yLabel) s('text', { x: -left, y: -mg - 14, class: 'ht-axis-title', text: p.yLabel }, g);
    drawYAxis(g, y, yTk, iw, yF);
    const ga = s('g', { class: 'ht-axis' }, g);
    xTk.values.forEach((t) => { const xx = Math.round(x(t)) + 0.5; s('line', { x1: xx, x2: xx, y1: 0, y2: ih, class: 'ht-grid' }, ga); s('text', { x: xx, y: ih + 17, 'text-anchor': 'middle', class: 'ht-tick', text: xF(t) }, ga); });
    if (p.xLabel) s('text', { x: iw, y: ih + 38, 'text-anchor': 'end', class: 'ht-axis-title', text: p.xLabel }, g);
    if (p.marginals) {
      const hist = (vals, dom, nb) => { const st = (dom[1] - dom[0]) / nb, c = new Array(nb).fill(0); vals.forEach((v) => { const i = clamp(Math.floor((v - dom[0]) / st), 0, nb - 1); c[i]++; }); return { c, st }; };
      const nb = clamp(Math.round(iw / 22), 8, 30);
      const hx = hist(rows.map((r) => r.x), xDom, nb), hy = hist(rows.map((r) => r.y), yDom, clamp(Math.round(ih / 22), 8, 30));
      const mx = Math.max(...hx.c), my = Math.max(...hy.c);
      const gm = s('g', { class: 'ht-marginals' }, g);
      hx.c.forEach((c, i) => { if (!c) return; const x0 = x(xDom[0] + i * hx.st) + 1, x1 = x(xDom[0] + (i + 1) * hx.st) - 1, hh = (c / mx) * (mg - 10); s('path', { d: vbarPath(-6, -6 - hh, x0, Math.max(1, x1 - x0), 1.5), class: 'ht-bar ht-bar--context' }, gm); });
      hy.c.forEach((c, i) => { if (!c) return; const y1 = y(yDom[0] + i * hy.st) - 1, y0 = y(yDom[0] + (i + 1) * hy.st) + 1, ww = (c / my) * (mg - 10); s('path', { d: hbarPath(iw + 6, iw + 6 + ww, y0, Math.max(1, y1 - y0), 1.5), class: 'ht-bar ht-bar--context' }, gm); });
      s('line', { x1: 0, x2: iw, y1: -5.5, y2: -5.5, class: 'ht-baseline' }, gm);
      s('line', { x1: iw + 5.5, x2: iw + 5.5, y1: 0, y2: ih, class: 'ht-baseline' }, gm);
    }
    let fit = null;
    if (p.trend === 'linear') { fit = ols(rows.map((r) => [r.x, r.y])); if (fit) { s('line', { x1: 0, x2: iw, y1: y(fit.intercept + fit.slope * xDom[0]), y2: y(fit.intercept + fit.slope * xDom[1]), class: 'ht-trend' }, g); } }
    const order = rows.map((r, i) => i).sort((a, b) => (ptColor(rows[a]) === cv('mark-context') ? -1 : 0) - (ptColor(rows[b]) === cv('mark-context') ? -1 : 0) || rad(rows[b]) - rad(rows[a]));
    const dg = s('g', { class: 'ht-points' }, g);
    for (const i of order) { const r = rows[i]; s('circle', { cx: x(r.x), cy: y(r.y), r: rad(r), class: 'ht-dot' + (Z ? ' ht-dot--bubble' : ''), style: { fill: ptColor(r) } }, dg); }
    if (fit) { const tx = iw - 4, ty = y(fit.intercept + fit.slope * xDom[1]); s('text', { x: tx, y: clamp(ty - 10, 12, ih - 4), 'text-anchor': 'end', class: 'ht-annot ht-halo', text: p.trendLabel || `Linear fit, r = ${fit.r.toFixed(2).replace('-', MINUS)}` }, g); }
    const toLabel = rows.filter((r) => r.l != null && (p.labelPoints === 'all' || toSet(p.labelPoints).has(r.l) || hl.has(r.l)));
    for (const r of toLabel) { const right = x(r.x) < iw - 90; s('text', { x: x(r.x) + (right ? rad(r) + 5 : -rad(r) - 5), y: y(r.y) + 4, 'text-anchor': right ? 'start' : 'end', class: 'ht-label ht-halo' + (hl.has(r.l) ? ' ht-label--strong' : ''), text: String(r.l) }, g); }
    drawAnnotations(g, p.annotations, x, y, iw, ih, (a) => (isNum(a.x) && isNum(a.y) ? [x(a.x), y(a.y)] : null));
    if (p.interactive !== false) {
      const tip = Tooltip(root);
      const ring = s('circle', { r: 7, class: 'ht-hover-ring', visibility: 'hidden' }, g);
      const area = s('rect', { x: -6, y: -6, width: iw + 12, height: ih + 12, class: 'ht-hit' }, g);
      const byX = rows.map((r, i) => i).sort((a, b) => rows[a].x - rows[b].x || rows[a].y - rows[b].y);
      const show = (k) => { const r = rows[byX[k]]; ring.setAttribute('cx', x(r.x)); ring.setAttribute('cy', y(r.y)); ring.setAttribute('r', rad(r) + 4); ring.setAttribute('visibility', 'visible'); const rr = [{ color: ptColor(r), shape: 'dot', label: p.xLabel || 'x', value: makeFormat(p.xFormat || 'auto')(r.x) }, { color: 'transparent', label: p.yLabel || 'y', value: makeFormat(p.yFormat || 'auto')(r.y) }]; if (Z) rr.push({ color: 'transparent', label: p.sizeLabel || 'size', value: makeFormat(p.sizeFormat || 'auto')(r.z) }); tip.show(left + x(r.x), top + y(r.y), [r.l, r.g].filter((q) => q != null).join(' · '), rr); };
      const hide = () => { ring.setAttribute('visibility', 'hidden'); tip.hide(); };
      interact(svgEl, area, byX.length, (mx, my) => { let best = -1, bd = 28; byX.forEach((ri, k) => { const r = rows[ri]; const d = Math.hypot(left + x(r.x) - mx, top + y(r.y) - my) - rad(r); if (d < bd) { bd = d; best = k; } }); return best; }, show, hide);
    }
    return { table: () => { const cols = []; if (Lb) cols.push({ key: 'l', label: p.labelHeader || 'Label' }); if (G) cols.push({ key: 'g', label: p.groupLabel || 'Group' }); cols.push({ key: 'x', label: p.xLabel || 'x', numeric: true, format: makeFormat(p.xFormat || 'auto') }, { key: 'y', label: p.yLabel || 'y', numeric: true, format: makeFormat(p.yFormat || 'auto') }); if (Z) cols.push({ key: 'z', label: p.sizeLabel || 'size', numeric: true, format: makeFormat(p.sizeFormat || 'auto') }); return tableModel(cols, rows); } };
  }

  // ================================================================== Heatmap
  function lum(rgbStr) { const m = /rgba?\(([^)]+)\)/.exec(rgbStr || ''); if (!m) return 1; const [r, g, b] = m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map((x) => +x / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function Heatmap(root, p, W0) {
    const X = accessor(p.x, 'x'), Y = accessor(p.y, 'y'), V = accessor(p.value, 'value');
    const rows = (p.data || []).map((d) => ({ x: String(X(d)), y: String(Y(d)), v: num(V(d)) }));
    const xs = p.xOrder || uniq(rows.map((r) => r.x)), ys = p.yOrder || uniq(rows.map((r) => r.y));
    const cell = new Map(rows.map((r) => [r.x + '\u0000' + r.y, r.v]));
    const vals = rows.map((r) => r.v).filter(isNum);
    const diverging = p.scale === 'diverging';
    const k = diverging ? 7 : clamp(p.bins || 7, 3, 7);
    let [lo, hi] = extent(vals);
    if (p.domain) [lo, hi] = p.domain;
    else if (!diverging && lo >= 0 && p.zero !== false) lo = 0;
    const mid = p.midpoint || 0;
    if (diverging) { const a = Math.max(Math.abs(lo - mid), Math.abs(hi - mid)); lo = mid - a; hi = mid + a; }
    let edges;
    if (p.thresholds) edges = [lo].concat(p.thresholds, [hi]);
    else if (diverging) edges = Array.from({ length: k + 1 }, (_, i) => lo + ((hi - lo) * i) / k);
    else { let st = tickStep(lo, hi, k); if (Math.ceil(hi / st - 1e-9) - Math.floor(lo / st + 1e-9) > k) st = tickStep(lo, hi, k - 2); const a = Math.floor(lo / st + 1e-9) * st, b = Math.ceil(hi / st - 1e-9) * st; edges = []; for (let e = a; e <= b + st * 1e-9; e += st) edges.push(+e.toPrecision(12)); if (edges.length > k + 1) edges = Array.from({ length: k + 1 }, (_, i) => lo + ((hi - lo) * i) / k); lo = edges[0]; hi = edges[edges.length - 1]; }
    const nb = edges.length - 1;
    const seqIdx = (i) => Math.round(1 + (i * 6) / Math.max(1, nb - 1));
    const divNames = ['div-neg-3', 'div-neg-2', 'div-neg-1', 'div-0', 'div-pos-1', 'div-pos-2', 'div-pos-3'];
    const binOf = (v) => { for (let i = 0; i < nb; i++) if (v < edges[i + 1] || i === nb - 1) return i; return nb - 1; };
    const colorOf = (v) => (diverging ? cv(divNames[binOf(v)]) : cv('seq-' + seqIdx(binOf(v))));
    const fm = makeFormat(p.format || 'auto');
    const labW = Math.min(Math.round(W0 * 0.3), Math.ceil(Math.max(...ys.map((t) => textW(t, 'label'))))) + 12;
    const iw = W0 - labW - 8;
    const cw = iw / xs.length;
    const ch = p.cellHeight || clamp(Math.round(cw * 0.75), 14, 30);
    const maxXL = Math.max(...xs.map((t) => textW(t, 'tick')));
    const every = Math.max(1, Math.ceil((maxXL + 8) / cw));
    const top = 24, ih = ys.length * ch, legendH = 52;
    const hgt = top + ih + legendH;
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Heatmap'), p.interactive !== false);
    const g = s('g', { transform: `translate(${labW},${top})` }, svgEl);
    xs.forEach((t, i) => { if (i % every === 0) s('text', { x: i * cw + cw / 2, y: -8, 'text-anchor': 'middle', class: 'ht-tick', text: t }, g); });
    ys.forEach((t, j) => s('text', { x: -10, y: j * ch + ch / 2 + 4.5, 'text-anchor': 'end', class: 'ht-label', text: t }, g));
    const cg = s('g', { class: 'ht-cells' }, g), cells = [];
    ys.forEach((ty, j) => xs.forEach((tx, i) => {
      const v = cell.get(tx + '\u0000' + ty);
      const rc = s('rect', { x: f1(i * cw), y: f1(j * ch), width: Math.max(0.5, cw - 1), height: Math.max(0.5, ch - 1), class: 'ht-cell' + (isNum(v) ? '' : ' ht-cell--missing'), style: isNum(v) ? { fill: colorOf(v) } : null }, cg);
      cells.push({ tx, ty, v, rc, cx: labW + i * cw + cw / 2, cy: top + j * ch });
      if (p.cellLabels && isNum(v) && textW(fm(v), 'tick') + 6 < cw) { const L = lum(W.getComputedStyle(rc).fill); s('text', { x: i * cw + cw / 2 - 0.5, y: j * ch + ch / 2 + 3.5, 'text-anchor': 'middle', class: 'ht-cell-label', style: { fill: L > 0.32 ? cv('ink') : cv('paper') }, text: fm(v) }, cg); }
    }));
    // stepped legend
    const lg = s('g', { transform: `translate(0,${ih + 18})` }, g);
    const sw = Math.min(44, (iw - 8) / nb);
    if (p.legendTitle) s('text', { x: 0, y: 0, class: 'ht-axis-title', text: p.legendTitle }, lg);
    for (let i = 0; i < nb; i++) s('rect', { x: i * sw, y: 8, width: sw - 2, height: 10, style: { fill: diverging ? cv(divNames[i]) : cv('seq-' + seqIdx(i)) } }, lg);
    const ef = makeFormat(p.format || 'auto', { step: (hi - lo) / nb });
    const every2 = Math.max(1, Math.ceil(Math.max(...edges.map((e) => textW(ef(e), 'tick'))) / sw));
    edges.forEach((e, i) => { if (i % every2 === 0 || i === nb) s('text', { x: Math.min(i * sw - (i === nb ? 2 : 1), nb * sw - 2), y: 32, 'text-anchor': i === 0 ? 'start' : i === nb ? 'end' : 'middle', class: 'ht-tick', text: ef(e) }, lg); });
    if (p.interactive !== false) {
      const tip = Tooltip(root);
      const show = (i) => { const c = cells[i]; cells.forEach((q, j) => q.rc.classList.toggle('is-active', j === i)); tip.show(c.cx, c.cy, `${c.ty} · ${c.tx}`, [{ color: isNum(c.v) ? colorOf(c.v) : 'transparent', shape: 'rect', label: p.valueLabel || '', value: isNum(c.v) ? fm(c.v) : 'No data' }]); };
      const hide = () => { cells.forEach((q) => q.rc.classList.remove('is-active')); tip.hide(); };
      interact(svgEl, cg, cells.length, (mx, my) => { const i = Math.floor((mx - labW) / cw), j = Math.floor((my - top) / ch); return i >= 0 && i < xs.length && j >= 0 && j < ys.length ? j * xs.length + i : -1; }, show, hide);
    }
    return { table: () => tableModel([{ key: 'y', label: p.yLabel || 'Row' }].concat(xs.map((t, i) => ({ key: 'c' + i, label: t, numeric: true, format: fm }))), ys.map((ty) => { const r = { y: ty }; xs.forEach((tx, i) => (r['c' + i] = cell.has(tx + '\u0000' + ty) ? cell.get(tx + '\u0000' + ty) : null)); return r; })) };
  }

  // ================================================================== DeltaChart
  function DeltaChart(root, p, W0) {
    const X = accessor(p.x, 'x'), A = accessor(p.a, 'a'), B = accessor(p.b, 'b'), Dv = p.value ? accessor(p.value) : null;
    const pts = (p.data || []).map((d) => { const a = num(A(d)), b = num(B(d)); return { x: parseX(X(d)), a, b, y: Dv ? num(Dv(d)) : a - b }; }).sort((q, r) => +q.x - +r.x);
    const aL = p.aLabel || 'A', bL = p.bLabel || 'B';
    const fmU = p.format || 'auto';
    const hgt = p.height || clamp(Math.round(W0 * 0.5), 220, 380);
    const top = 12, bottom = 28;
    const ih = hgt - top - bottom;
    const dom = valueDomain(pts.map((q) => q.y), { zero: true, domain: p.yDomain, count: Math.max(3, Math.round(ih / 60)) });
    const tk = linTicks(dom[0], dom[1], Math.max(3, Math.round(ih / 60)));
    const yF = signedFormat(fmU);
    const tickF = makeFormat(fmU, { step: tk.step });
    const tickS = (t) => (t > 0 ? '+' : '') + tickF(t);
    const left = Math.ceil(Math.max(...tk.values.map((t, i) => textW(tickS(t) + (p.yUnit && i === tk.values.length - 1 ? p.yUnit : ''), 'tick')))) + 12;
    const iw = W0 - left - 14;
    const xm = xAxisModel(pts.map((q) => q.x), [0, iw], { domain: p.xDomain, format: p.xFormat });
    const y = linear(dom, [ih, 0]), y0 = y(0);
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Difference chart'), p.interactive !== false);
    const g = s('g', { transform: `translate(${left},${top})` }, svgEl);
    drawYAxis(g, y, tk, iw, tickS, { unit: p.yUnit });
    drawXTicks(g, xm.f, xm.ticks(Math.max(2, Math.round(iw / 90))), ih, left, 14, iw);
    const idA = uid('clip'), idB = uid('clip');
    const defs = s('defs', null, svgEl);
    s('rect', { x: -2, y: -2, width: iw + 4, height: Math.max(0, y0 + 2) }, s('clipPath', { id: idA }, defs));
    s('rect', { x: -2, y: y0, width: iw + 4, height: Math.max(0, ih - y0 + 2) }, s('clipPath', { id: idB }, defs));
    const X0 = (q) => xm.f(+q.x);
    const area = areaPath(pts, X0, () => y0, (q) => y(q.y)), line = linePath(pts, X0, y);
    const ca = colorVar(p.aColor, 1), cb = colorVar(p.bColor, 2);
    s('path', { d: area, class: 'ht-area', 'clip-path': `url(#${idA})`, style: { fill: ca } }, g);
    s('path', { d: area, class: 'ht-area', 'clip-path': `url(#${idB})`, style: { fill: cb } }, g);
    s('path', { d: line, class: 'ht-line', 'clip-path': `url(#${idA})`, style: { stroke: ca } }, g);
    s('path', { d: line, class: 'ht-line', 'clip-path': `url(#${idB})`, style: { stroke: cb } }, g);
    s('line', { x1: 0, x2: iw, y1: Math.round(y0) + 0.5, y2: Math.round(y0) + 0.5, class: 'ht-baseline ht-baseline--strong' }, g);
    const zl = (txt, yy, color, glyph) => { const gg = s('g', { transform: `translate(8,${f1(yy)})` }, g); s('rect', { x: 0, y: -9, width: 10, height: 10, rx: 2, style: { fill: color } }, gg); s('text', { x: 16, y: 0, class: 'ht-label ht-label--muted ht-halo', text: `${glyph} ${txt}` }, gg); };
    if (y0 > 30) zl(p.aboveLabel || `${aL} higher`, 16, ca, '↑');
    if (ih - y0 > 30) zl(p.belowLabel || `${bL} higher`, ih - 8, cb, '↓');
    drawAnnotations(g, p.annotations, xm.f, y, iw, ih, (an) => { const ax = +parseX(an.x); const q = pts.find((r) => +r.x === ax); const ay = an.y != null ? an.y : q ? q.y : NaN; return isNum(ax) && isNum(ay) ? [xm.f(ax), y(ay)] : null; });
    if (p.interactive !== false) {
      const tip = Tooltip(root), xsU = pts.map((q) => +q.x);
      const cross = s('g', { visibility: 'hidden' }, g), cl = s('line', { y1: 0, y2: ih, class: 'ht-crosshair' }, cross), dot = s('circle', { r: 4, class: 'ht-dot' }, cross);
      const ar = s('rect', { x: 0, y: 0, width: iw, height: ih, class: 'ht-hit' }, g);
      const fm = makeFormat(fmU);
      const show = (i) => { const q = pts[i], xx = xm.f(+q.x); cross.setAttribute('visibility', 'visible'); cl.setAttribute('x1', xx); cl.setAttribute('x2', xx); dot.setAttribute('cx', xx); dot.setAttribute('cy', y(q.y)); dot.style.fill = q.y >= 0 ? ca : cb; tip.show(left + xx, top + y(q.y), xm.label(+q.x), [{ color: q.y >= 0 ? ca : cb, label: `${aL} − ${bL}`, value: yF(q.y) }].concat(isNum(q.a) ? [{ color: 'transparent', label: aL, value: fm(q.a) }, { color: 'transparent', label: bL, value: fm(q.b) }] : [])); };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hide(); };
      interact(svgEl, ar, pts.length, (mx) => { const v = xm.f.invert(mx - left); let best = 0, bd = Infinity; xsU.forEach((t, i) => { const d = Math.abs(t - v); if (d < bd) { bd = d; best = i; } }); return best; }, show, hide);
    }
    return { table: () => tableModel([{ key: 'x', label: p.xLabel || 'Date' }, { key: 'a', label: aL, numeric: true, format: makeFormat(fmU) }, { key: 'b', label: bL, numeric: true, format: makeFormat(fmU) }, { key: 'y', label: `${aL} − ${bL}`, numeric: true, format: yF }], pts.map((q) => ({ x: xm.label(+q.x), a: q.a, b: q.b, y: q.y }))) };
  }

  // ================================================================== QuantileDotPlot
  function quantile(sorted, q) { if (!sorted.length) return NaN; const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); }
  function QuantileDotPlot(root, p, W0) {
    const n = p.dots || 20;
    let qs;
    if (p.quantiles) qs = p.quantiles.map(num).filter(isNum).sort((a, b) => a - b);
    else { const sm = (p.samples || []).map(num).filter(isNum).sort((a, b) => a - b); qs = Array.from({ length: n }, (_, i) => quantile(sm, (i + 0.5) / n)); }
    const N = qs.length;
    const fm = makeFormat(p.format || 'auto');
    const unit = p.unit || '';
    const th = p.threshold || null;
    const isEvent = (v) => (th ? (th.direction === 'above' ? v >= th.value : v <= th.value) : false);
    const evN = qs.filter(isEvent).length;
    const left = 14, right = 14, top = th ? 30 : 8, bottom = 30;
    const iw = W0 - left - right;
    const dom = p.domain || nice(Math.min(qs[0], th ? th.value : Infinity), Math.max(qs[N - 1], th ? th.value : -Infinity), Math.max(3, Math.round(iw / 90)));
    const x = linear(dom, [0, iw]);
    const maxH = p.maxHeight || 200;
    let d = Math.min(26, Math.max(6, iw / 14)), stacks;
    for (let it = 0; it < 30; it++) {
      stacks = new Map();
      qs.forEach((q) => { const b = Math.round(x(q) / d); stacks.set(b, (stacks.get(b) || 0) + 1); });
      if (Math.max(...stacks.values()) * d <= maxH || d <= 6) break;
      d *= 0.9;
    }
    const maxStack = Math.max(...stacks.values());
    const ih = maxStack * d, hgt = top + ih + bottom;
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, `Quantile dot plot: ${N} equally likely outcomes`), p.interactive !== false);
    const g = s('g', { transform: `translate(${left},${top})` }, svgEl);
    const tk = linTicks(dom[0], dom[1], Math.max(3, Math.round(iw / 90))), tf = makeFormat(p.format || 'auto', { step: tk.step });
    s('line', { x1: 0, x2: iw, y1: ih + 0.5, y2: ih + 0.5, class: 'ht-baseline' }, g);
    drawXTicks(g, x, tk.values.map((t, i) => ({ v: t, label: tf(t) + (i === tk.values.length - 1 ? unit : '') })), ih, left, right, iw);
    const placed = new Map(), dots = [];
    const evC = colorVar(th && th.color, 1);
    qs.forEach((q, i) => { const b = Math.round(x(q) / d); const k = placed.get(b) || 0; placed.set(b, k + 1); const cx = b * d, cy = ih - (k + 0.5) * d; const ev = isEvent(q); dots.push({ cx, cy, q, ev }); s('circle', { cx, cy, r: Math.max(2, d / 2 - 1), class: 'ht-qdot', style: { fill: ev ? evC : cv('mark-context') } }, g); });
    if (th) {
      const tx = Math.round(x(th.value)) + 0.5;
      s('line', { x1: tx, x2: tx, y1: -18, y2: ih, class: 'ht-ref' }, g);
      const anchor = tx > iw * 0.7 ? 'end' : 'start';
      s('text', { x: tx + (anchor === 'start' ? 6 : -6), y: -8, 'text-anchor': anchor, class: 'ht-label ht-label--muted', text: th.label || `${fm(th.value)}${unit}` }, g);
    }
    if (th && p.caption !== false) {
      const pct = Math.round((evN / N) * 100);
      root.appendChild(h('p', { class: 'ht-caption' }, h('span', { class: 'ht-swatch ht-swatch--dot', style: { 'background-color': evC } }), h('strong', { text: `${evN} in ${N}` }), ` equally likely outcomes ${th.phrase || (th.direction === 'above' ? `at or above ${fm(th.value)}${unit}` : `at or below ${fm(th.value)}${unit}`)} (${pct}%). Each dot is one ${N === 20 ? '5%' : N === 10 ? '10%' : N === 50 ? '2%' : N === 100 ? '1%' : (100 / N).toFixed(1) + '%'} chance.`));
    }
    if (p.interactive !== false) {
      const tip = Tooltip(root), ar = s('rect', { x: 0, y: 0, width: iw, height: ih, class: 'ht-hit' }, g);
      const show = (i) => { const dd = dots[i]; tip.show(left + dd.cx, top + dd.cy, `Outcome ${i + 1} of ${N}`, [{ color: dd.ev ? evC : cv('mark-context'), shape: 'dot', label: 'about', value: fm(dd.q) + unit }]); };
      interact(svgEl, ar, dots.length, (mx, my) => { let best = -1, bd = d; dots.forEach((dd, i) => { const dist = Math.hypot(left + dd.cx - mx, top + dd.cy - my); if (dist < bd) { bd = dist; best = i; } }); return best; }, show, () => tip.hide());
    }
    return { table: () => tableModel([{ key: 'i', label: 'Outcome' }, { key: 'q', label: p.valueLabel || 'Value', numeric: true, format: fm }], qs.map((q, i) => ({ i: `${i + 1} of ${N}`, q }))) };
  }

  // ================================================================== IconArray
  const PERSON = { w: 10, h: 20, head: [5, 2.7, 2.5], body: 'M2.4 6.1h5.2a1.9 1.9 0 0 1 1.9 1.9v5.3a.95 .95 0 0 1-1.9 0V9.1h-.45v9.8a1.15 1.15 0 0 1-2.3 0v-5.6h-.5v5.6a1.15 1.15 0 0 1-2.3 0V9.1h-.45v4.2a.95 .95 0 0 1-1.9 0V8a1.9 1.9 0 0 1 1.9-1.9z' };
  function IconArray(root, p, W0) {
    const arrays = p.arrays || [{ title: p.title, groups: p.groups || [] }];
    const total = p.total || 100;
    const cols = p.columns || (total <= 100 ? 10 : total <= 400 ? 20 : 40);
    const icon = p.icon || 'person';
    const nA = arrays.length, gap = W0 < 560 ? 20 : 40;
    const side = (W0 - gap * (nA - 1)) / nA / cols >= 11;
    const wrap = h('div', { class: 'ht-iconarrays' + (side ? ' is-row' : ''), style: { gap: (side ? gap : 24) + 'px' } });
    root.appendChild(wrap);
    const aw = side ? Math.min(p.maxArrayWidth || 360, (W0 - gap * (nA - 1)) / nA) : Math.min(W0, p.maxArrayWidth || 360);
    const cell = Math.min(p.iconSize || 24, aw / cols);
    const ratio = icon === 'person' ? 2 : 1;
    const cw = cell, ch = cell * ratio;
    const rowsN = Math.ceil(total / cols);
    arrays.forEach((arr, ai) => {
      const groups = (arr.groups || []).map((gq, gi) => ({ label: gq.label, count: Math.max(0, Math.round(gq.count)), color: colorVar(gq.color, gi + 1) }));
      const used = sum(groups.map((gq) => gq.count));
      if (used > total) warn(`IconArray: groups add up to ${used}, more than the denominator ${total}.`);
      const rest = { label: arr.restLabel || p.restLabel || '', count: Math.max(0, total - used), color: cv('mark-context'), rest: true };
      const box = h('div', { class: 'ht-iconarray', style: { width: Math.round(cols * cw) + 'px' } });
      if (arr.title) box.appendChild(h('div', { class: 'ht-iconarray-title', text: arr.title }));
      const svgEl = s('svg', { width: f1(cols * cw), height: f1(rowsN * ch), viewBox: `0 0 ${f1(cols * cw)} ${f1(rowsN * ch)}`, role: 'img', 'aria-label': `${arr.title ? arr.title + ': ' : ''}${groups.map((gq) => `${gq.count} out of ${total} ${gq.label}`).join('; ')}` }, null);
      box.appendChild(svgEl);
      let idx = 0;
      for (const gq of groups.concat([rest])) for (let k = 0; k < gq.count && idx < total; k++, idx++) {
        const cx = (idx % cols) * cw, cy = Math.floor(idx / cols) * ch;
        if (icon === 'person') {
          const sc = (cw * 0.86) / PERSON.w, gg = s('g', { transform: `translate(${f1(cx + cw * 0.07)},${f1(cy + (ch - PERSON.h * sc) / 2)}) scale(${sc.toFixed(3)})`, style: { fill: gq.color } }, svgEl);
          s('circle', { cx: PERSON.head[0], cy: PERSON.head[1], r: PERSON.head[2] }, gg);
          s('path', { d: PERSON.body }, gg);
        } else if (icon === 'circle') s('circle', { cx: cx + cw / 2, cy: cy + ch / 2, r: cw / 2 - 1.5, style: { fill: gq.color } }, svgEl);
        else s('rect', { x: cx + 1, y: cy + 1, width: cw - 2, height: ch - 2, rx: 1, style: { fill: gq.color } }, svgEl);
      }
      const key = h('div', { class: 'ht-iconarray-key' });
      for (const gq of groups) key.appendChild(h('div', { class: 'ht-iconarray-row' }, h('span', { class: 'ht-swatch', style: { 'background-color': gq.color } }), h('span', null, h('strong', { class: 'ht-iconarray-count', text: `${gq.count} out of ${nfmt(total)}` }), ' ' + (gq.label || ''))));
      if (rest.label) key.appendChild(h('div', { class: 'ht-iconarray-row' }, h('span', { class: 'ht-swatch', style: { 'background-color': rest.color } }), h('span', null, h('strong', { class: 'ht-iconarray-count', text: `${rest.count} out of ${nfmt(total)}` }), ' ' + rest.label)));
      box.appendChild(key);
      wrap.appendChild(box);
    });
    return { table: () => { const cols2 = [{ key: 'a', label: 'Group' }, { key: 'l', label: 'Outcome' }, { key: 'n', label: `Count (of ${nfmt(total)})`, numeric: true, format: makeFormat('int') }]; const rr = []; arrays.forEach((arr) => { let used = 0; (arr.groups || []).forEach((gq) => { used += gq.count; rr.push({ a: arr.title || '', l: gq.label, n: gq.count }); }); if (arr.restLabel || p.restLabel) rr.push({ a: arr.title || '', l: arr.restLabel || p.restLabel, n: total - used }); }); return tableModel(cols2, rr); } };
  }
  const nfmt = (x) => nf({ maximumFractionDigits: 0 }).format(x);

  // ================================================================== OutcomePlot (hypothetical outcome plot, HOPs)
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function normal(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function OutcomePlot(root, p, W0) {
    const groups = p.groups || [];
    const frames = p.frames || 60, interval = clamp(p.interval || 450, 250, 1500);
    const rng = mulberry32(p.seed || 7);
    const draws = groups.map((gq) => Array.from({ length: frames }, (_, f) => (gq.draws ? num(gq.draws[f % gq.draws.length]) : gq.mean + (gq.sd || 0) * normal(rng))));
    const fm = makeFormat(p.format || 'auto'), unit = p.unit || '';
    const labW = Math.min(Math.round(W0 * 0.3), Math.ceil(Math.max(...groups.map((gq) => textW(gq.label, 'strong'))))) + 16;
    const rowH = 46, top = 10, bottom = 30, iw = W0 - labW - 16, ih = groups.length * rowH, hgt = top + ih + bottom;
    const dom = p.domain || nice(...extent(draws.flat()), Math.max(3, Math.round(iw / 90)));
    const x = linear(dom, [0, iw]);
    const controls = h('div', { class: 'ht-hops-controls' });
    root.appendChild(controls);
    const svgEl = svgRoot(root, W0, hgt, ariaSummary(p, 'Hypothetical outcome plot'), false);
    const g = s('g', { transform: `translate(${labW},${top})` }, svgEl);
    const tk = linTicks(dom[0], dom[1], Math.max(3, Math.round(iw / 90))), tf = makeFormat(p.format || 'auto', { step: tk.step });
    tk.values.forEach((t) => { const xx = Math.round(x(t)) + 0.5; s('line', { x1: xx, x2: xx, y1: 0, y2: ih, class: 'ht-grid' }, g); });
    drawXTicks(g, x, tk.values.map((t, i) => ({ v: t, label: tf(t) + (i === tk.values.length - 1 ? unit : '') })), ih, labW, 16, iw);
    const rowsG = groups.map((gq, i) => {
      const yy = i * rowH;
      s('text', { x: -12, y: yy + rowH / 2 + 4.5, 'text-anchor': 'end', class: 'ht-label ht-label--strong', text: gq.label }, g);
      s('line', { x1: 0, x2: iw, y1: yy + rowH / 2 + 0.5, y2: yy + rowH / 2 + 0.5, class: 'ht-grid' }, g);
      const trace = s('g', { class: 'ht-hops-trace' }, g);
      const cur = s('rect', { y: yy + 8, width: 3, height: rowH - 16, rx: 1, class: 'ht-hops-tick', style: { fill: colorVar(gq.color, i + 1) } }, g);
      const val = s('text', { y: yy + rowH / 2 - 8, class: 'ht-value ht-value--strong ht-halo' }, g);
      return { trace, cur, val, color: colorVar(gq.color, i + 1), yy };
    });
    const status = h('span', { class: 'ht-hops-status' });
    const btn = h('button', { class: 'ht-btn', type: 'button', 'aria-pressed': 'false', text: 'Play' });
    const stepB = h('button', { class: 'ht-btn', type: 'button', text: 'Step' });
    const allB = h('button', { class: 'ht-btn', type: 'button', text: 'Show all draws' });
    controls.append(btn, stepB, allB, status);
    let f = -1, timer = null;
    const cmp = groups.length === 2 && p.compare !== false;
    const statusText = (k) => { if (k < 0) return `${frames} simulated draws. Press Play.`; let wins = 0; for (let i = 0; i <= k; i++) if (draws[0][i] > draws[1][i]) wins++; return cmp ? `Draw ${k + 1} of ${frames}: ${groups[0].label} came out ahead in ${wins} of ${k + 1}` : `Draw ${k + 1} of ${frames}`; };
    function paint(k, traceAll) {
      rowsG.forEach((r, i) => {
        const v = draws[i][k], xx = x(v);
        r.cur.setAttribute('x', f1(xx - 1.5)); r.cur.style.visibility = 'visible';
        const right = xx < iw - 60; r.val.setAttribute('x', f1(xx + (right ? 7 : -7))); r.val.setAttribute('text-anchor', right ? 'start' : 'end'); r.val.textContent = fm(v) + unit;
        if (p.trace !== false) { if (traceAll) { r.trace.textContent = ''; for (let j = 0; j <= k; j++) s('line', { x1: x(draws[i][j]), x2: x(draws[i][j]), y1: r.yy + 12, y2: r.yy + rowH - 12, class: 'ht-hops-past', style: { stroke: r.color } }, r.trace); } else s('line', { x1: xx, x2: xx, y1: r.yy + 12, y2: r.yy + rowH - 12, class: 'ht-hops-past', style: { stroke: r.color } }, r.trace); }
      });
      status.textContent = statusText(k);
    }
    const step = () => { f = (f + 1) % frames; if (f === 0) rowsG.forEach((r) => (r.trace.textContent = '')); paint(f, false); };
    const stop = () => { if (timer) W.clearInterval(timer); timer = null; btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'false'); };
    const play = () => { if (timer) return; timer = W.setInterval(() => { if (document.hidden) return; step(); }, interval); btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true'); };
    btn.addEventListener('click', () => (timer ? stop() : play()));
    stepB.addEventListener('click', () => { stop(); step(); });
    allB.addEventListener('click', () => { stop(); f = frames - 1; paint(f, true); });
    rowsG.forEach((r) => (r.cur.style.visibility = 'hidden'));
    if (reducedMotion() || p.autoplay === false) { f = frames - 1; paint(f, true); }
    else { step(); play(); }
    return { cleanup: stop, table: () => tableModel([{ key: 'i', label: 'Draw' }].concat(groups.map((gq, i) => ({ key: 'g' + i, label: gq.label, numeric: true, format: fm }))), Array.from({ length: frames }, (_, k) => { const r = { i: k + 1 }; groups.forEach((gq, i) => (r['g' + i] = draws[i][k])); return r; })) };
  }

  // ================================================================== Sparkline
  function Sparkline(root, p, W0) {
    const raw = p.data || [];
    const pts = raw.map((d, i) => (typeof d === 'number' ? { x: i, y: d } : { x: +parseX(d.x != null ? d.x : i), y: num(d.y) })).filter((q) => isNum(q.y));
    const w = p.width || Math.min(W0, 160), hgt = p.height || 30;
    const [lo, hi] = extent(pts.map((q) => q.y)), [x0, x1] = extent(pts.map((q) => q.x));
    const x = linear([x0, x1], [3, w - 5]), y = linear(lo === hi ? [lo - 1, hi + 1] : [lo, hi], [hgt - 4, 4]);
    const last = pts[pts.length - 1], first = pts[0];
    const svgEl = svgRoot(root, w, hgt, p.ariaLabel || (first && last ? `Trend from ${makeFormat(p.format || 'auto')(first.y)} to ${makeFormat(p.format || 'auto')(last.y)}` : 'Sparkline'), false);
    if (p.band) s('rect', { x: 0, y: y(p.band[1]), width: w, height: Math.max(0, y(p.band[0]) - y(p.band[1])), class: 'ht-spark-band' }, svgEl);
    const k = p.highlightLast == null ? 1 : p.highlightLast;
    const ctxPts = k ? pts.slice(0, Math.max(1, pts.length - k)) : pts;
    s('path', { d: linePath(ctxPts, (q) => x(q.x), y), class: 'ht-line ht-spark' + (k ? ' ht-line--context' : ''), style: k ? null : { stroke: colorVar(p.color, 1) } }, svgEl);
    if (k && pts.length > 1) s('path', { d: linePath(pts.slice(-k - 1), (q) => x(q.x), y), class: 'ht-line ht-spark', style: { stroke: colorVar(p.color, 1) } }, svgEl);
    if (last) s('circle', { cx: x(last.x), cy: y(last.y), r: 3, class: 'ht-dot', style: { fill: colorVar(p.color, 1) } }, svgEl);
    return { table: () => tableModel([{ key: 'x', label: 'Point' }, { key: 'y', label: 'Value', numeric: true, format: makeFormat(p.format || 'auto') }], pts) };
  }

  // ================================================================== StatTile
  function oneTile(t) {
    const fm = makeFormat(t.format || 'auto');
    const el = h('div', { class: 'ht-stat' });
    el.appendChild(h('div', { class: 'ht-stat-label', text: t.label || '' }));
    const valEl = h('div', { class: 'ht-stat-value' + (t.hero ? ' ht-stat-value--hero' : '') }, isNum(t.value) ? fm(t.value) : String(t.value == null ? '–' : t.value));
    if (t.unit) valEl.appendChild(h('span', { class: 'ht-stat-unit', text: t.unit }));
    el.appendChild(valEl);
    if (t.delta && isNum(t.delta.value)) {
      const dv = t.delta.value, good = t.delta.good || 'up';
      const tone = good === 'none' || dv === 0 ? 'neutral' : (dv > 0) === (good === 'up') ? 'good' : 'bad';
      const glyph = dv > 0 ? '▲' : dv < 0 ? '▼' : '●';
      const dfm = signedFormat(t.delta.format || t.format || 'auto');
      const word = dv > 0 ? 'up' : dv < 0 ? 'down' : 'unchanged';
      el.appendChild(h('div', { class: `ht-stat-delta ht-${tone}`, 'aria-label': `${word} ${dfm(dv)} ${t.delta.period || ''}${tone === 'neutral' ? '' : tone === 'good' ? ', an improvement' : ', a deterioration'}` }, h('span', { class: 'ht-glyph', 'aria-hidden': 'true', text: glyph }), ` ${dfm(dv)}`, t.delta.period ? h('span', { class: 'ht-stat-period', text: ' ' + t.delta.period }) : null));
    }
    if (t.spark && t.spark.length) { const sp = h('div', { class: 'ht-stat-spark' }); el.appendChild(sp); render.Sparkline(sp, { data: t.spark, width: t.sparkWidth || 140, height: 30, format: t.format, highlightLast: t.highlightLast }); }
    if (t.note) el.appendChild(h('div', { class: 'ht-stat-note', text: t.note }));
    return el;
  }
  function StatTile(root, p) {
    if (p.tiles) { const row = h('div', { class: 'ht-kpis' }); p.tiles.forEach((t) => row.appendChild(oneTile(t))); root.appendChild(row); }
    else root.appendChild(oneTile(p));
    const tiles = p.tiles || [p];
    return { table: () => tableModel([{ key: 'l', label: 'Measure' }, { key: 'v', label: 'Value', numeric: true }, { key: 'd', label: 'Change', numeric: true }], tiles.map((t) => ({ l: t.label, v: isNum(t.value) ? makeFormat(t.format || 'auto')(t.value) : t.value, d: t.delta ? signedFormat(t.delta.format || t.format || 'auto')(t.delta.value) + ' ' + (t.delta.period || '') : '' }))) };
  }

  // ================================================================== Legend
  function Legend(root, p) {
    const items = (p.items || []).map((it, i) => ({ label: it.label, color: colorVar(it.color, i + 1), shape: it.shape || p.shape || 'rect' }));
    if (p.title) root.appendChild(h('div', { class: 'ht-legend-title', text: p.title }));
    root.appendChild(legendEl(items, p.direction === 'column' ? 'ht-legend--column' : ''));
    return {};
  }

  // ================================================================== DataTable
  function DataTable(root, p) {
    const rows = p.rows || p.data || [];
    let columns = p.columns;
    if (!columns) { const keys = rows.length ? Object.keys(rows[0]) : []; columns = keys.map((k) => ({ key: k, label: k })); }
    columns = columns.map((c) => Object.assign({}, c, { numeric: c.numeric != null ? c.numeric : rows.every((r) => r[c.key] == null || isNum(r[c.key])) && rows.some((r) => isNum(r[c.key])) }));
    const fmts = columns.map((c) => (c.format ? makeFormat(c.format) : c.numeric ? makeFormat('auto') : (x) => (x == null ? '' : String(x))));
    const tbl = h('table', { class: 'ht-table' });
    if (p.caption) tbl.appendChild(h('caption', { class: 'ht-table-caption', text: p.caption }));
    tbl.appendChild(h('thead', null, h('tr', null, columns.map((c) => h('th', { scope: 'col', class: c.numeric ? 'num' : null, text: c.label })))));
    const tb = h('tbody');
    const max = p.maxRows || Infinity;
    rows.slice(0, max).forEach((r) => tb.appendChild(h('tr', null, columns.map((c, i) => h(i === 0 && !c.numeric ? 'th' : 'td', { scope: i === 0 && !c.numeric ? 'row' : null, class: c.numeric ? 'num' : null, text: r[c.key] == null ? '–' : fmts[i](r[c.key]) })))));
    tbl.appendChild(tb);
    root.appendChild(h('div', { class: 'ht-table-wrap' }, tbl));
    if (rows.length > max) root.appendChild(h('p', { class: 'ht-source', text: `Showing ${max} of ${rows.length} rows.` }));
    return { table: () => tableModel(columns, rows) };
  }

  // ================================================================== Figure
  function richTitle(str) {
    const frag = document.createDocumentFragment(), re = /\[([^\]]+)\]\(((?:series|seq|div)-[\w-]+|good-ink|bad-ink|mark-context)\)/g;
    let last = 0, m;
    while ((m = re.exec(str))) { if (m.index > last) frag.appendChild(document.createTextNode(str.slice(last, m.index))); frag.appendChild(h('span', { class: 'ht-key', style: { '--key': cv(m[2]) }, text: m[1] })); last = re.lastIndex; }
    if (last < str.length) frag.appendChild(document.createTextNode(str.slice(last)));
    return frag;
  }
  function toCsv(model) {
    if (!model) return '';
    const esc = (x) => { const t = x == null ? '' : x instanceof Date ? x.toISOString().slice(0, 10) : String(x); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return [model.columns.map((c) => esc(c.label)).join(',')].concat(model.rows.map((r) => model.columns.map((c) => esc(r[c.key])).join(','))).join('\n');
  }
  function Figure(root, p) {
    const fig = h('figure', { class: 'ht-figure' + (p.variant === 'signal' ? ' ht-figure--signal' : '') + (p.rule === false ? ' ht-figure--norule' : '') });
    root.appendChild(fig);
    const head = h('header', { class: 'ht-fig-head' });
    if (p.kicker) head.appendChild(h('p', { class: 'ht-kicker', text: p.kicker }));
    if (p.title) { const t = h('h3', { class: 'ht-title' }); t.appendChild(richTitle(String(p.title))); head.appendChild(t); }
    if (p.dek) head.appendChild(h('p', { class: 'ht-dek', text: p.dek }));
    if (head.childNodes.length) fig.appendChild(head);
    if (p.howToRead) { const lines = Array.isArray(p.howToRead) ? p.howToRead : [p.howToRead]; fig.appendChild(h('aside', { class: 'ht-howto', 'aria-label': 'How to read this chart' }, h('span', { class: 'ht-howto-k', text: 'How to read this chart' }), lines.map((l) => h('p', { class: 'ht-howto-p', text: l })))); }
    const plot = h('div', { class: 'ht-plot' });
    const tableBox = h('div', { class: 'ht-tableview', hidden: true });
    fig.append(plot, tableBox);
    const spec = p.chart || {};
    const type = spec.type;
    if (!render[type]) throw new Error(`Figure: unknown chart type "${type}". Use one of: ${Object.keys(render).filter((k) => k !== 'Figure').join(', ')}`);
    const chartProps = Object.assign({ ariaLabel: [p.title, p.dek].filter(Boolean).join('. ') }, spec);
    const inst = render[type](plot, chartProps);
    const foot = h('footer', { class: 'ht-foot' });
    const meta = h('div', { class: 'ht-meta' });
    const notes = p.notes ? (Array.isArray(p.notes) ? p.notes : [p.notes]) : [];
    notes.forEach((n) => meta.appendChild(h('p', { class: 'ht-notes', text: n })));
    if (p.source) { const sp = h('p', { class: 'ht-source' }, 'Source: '); if (p.sourceUrl) sp.appendChild(h('a', { href: p.sourceUrl, target: '_blank', rel: 'noopener', text: p.source })); else sp.appendChild(document.createTextNode(p.source)); meta.appendChild(sp); }
    foot.appendChild(meta);
    const acts = h('div', { class: 'ht-actions' });
    let tableShown = false;
    if (p.tableToggle !== false && inst.table()) {
      const b = h('button', { class: 'ht-btn', type: 'button', 'aria-pressed': 'false', text: 'Table' });
      b.addEventListener('click', () => {
        tableShown = !tableShown;
        b.setAttribute('aria-pressed', String(tableShown));
        b.textContent = tableShown ? 'Chart' : 'Table';
        if (tableShown) { tableBox.textContent = ''; const m = inst.table(); render.DataTable(tableBox, { columns: m.columns, rows: m.rows, caption: p.tableCaption || (p.title ? String(p.title).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') : 'Data') }); tableBox.style.minHeight = plot.offsetHeight + 'px'; }
        plot.hidden = tableShown; tableBox.hidden = !tableShown;
      });
      acts.appendChild(b);
    }
    if (p.download !== false && inst.table()) {
      const a = h('a', { class: 'ht-btn ht-btn--link', href: '#', download: (p.filename || 'figure-data') + '.csv', text: 'CSV ↓' });
      a.addEventListener('click', () => { a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(toCsv(inst.table())); });
      acts.appendChild(a);
    }
    if (p.codeUrl) acts.appendChild(h('a', { class: 'ht-btn ht-btn--link', href: p.codeUrl, target: '_blank', rel: 'noopener', text: 'Code' }));
    if (acts.childNodes.length) foot.appendChild(acts);
    if (foot.childNodes.length && (meta.childNodes.length || acts.childNodes.length)) fig.appendChild(foot);
    return { cleanup: () => inst.destroy(), table: () => inst.table(), chart: inst };
  }

  // ------------------------------------------------------------------ registry
  const draws = { Figure, LineChart, BarChart, DumbbellPlot, SlopeChart, SmallMultiples, ScatterPlot, Heatmap, DeltaChart, QuantileDotPlot, IconArray, OutcomePlot, StatTile, Sparkline, Legend, DataTable };
  const STATIC = new Set(['Figure', 'StatTile', 'Legend', 'DataTable']);
  const render = {};
  for (const name in draws) render[name] = (el, props) => mount(el, props, draws[name], name, { static: STATIC.has(name) });

  function reactify(name) {
    const C = function (props) {
      const R = W.React;
      if (!R) throw new Error('[Halftone] React components need window.React; use Halftone.render.' + name + '(el, props) without React.');
      const ref = R.useRef(null), inst = R.useRef(null), first = R.useRef(true);
      R.useEffect(() => { inst.current = render[name](ref.current, props); return () => { if (inst.current) inst.current.destroy(); inst.current = null; }; }, []);
      R.useEffect(() => { if (first.current) { first.current = false; return; } if (inst.current) inst.current.replace(props); });
      return R.createElement('div', { ref, className: props.className, style: props.style });
    };
    C.displayName = 'Halftone.' + name;
    return C;
  }

  // ------------------------------------------------------------------ theme + tokens helpers
  const theme = {
    get: () => document.documentElement.getAttribute('data-theme') || 'light',
    set(mode) {
      const de = document.documentElement;
      if (theme._mq) { theme._mq.removeEventListener('change', theme._fn); theme._mq = null; }
      if (mode === 'auto' && W.matchMedia) { const mq = W.matchMedia('(prefers-color-scheme: dark)'); const fn = () => de.setAttribute('data-theme', mq.matches ? 'dark' : 'light'); fn(); mq.addEventListener('change', fn); theme._mq = mq; theme._fn = fn; }
      else de.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
    },
  };
  /** Build CSS custom properties from a tokens.json object (for pages that cannot load the system's tokens.css). */
  function tokensToCss(t, o) {
    o = o || {};
    const themes = t.color.themes.map((x) => x.id), first = themes[0];
    const ref = (x) => { const m = /^\{(.+)\}$/.exec(x); return m ? `var(--${m[1]})` : x; };
    const pick = (x, th) => (typeof x === 'string' ? x : x[th] != null ? x[th] : x[first]);
    let css = '';
    themes.forEach((th) => {
      css += (th === first ? `:root, [data-theme="${th}"]` : `[data-theme="${th}"]`) + ' {';
      for (const tk of t.color.tokens) css += `--${tk.name}:${ref(pick(tk.value, th))};`;
      for (const tk of (t.shadow && t.shadow.tokens) || []) css += `--${tk.name}:${pick(tk.value, th)};`;
      css += '}\n';
      if (o.autoDark && th !== first) css += `@media (prefers-color-scheme: ${th}) { :root:not([data-theme="${first}"]) {` + t.color.tokens.map((tk) => `--${tk.name}:${ref(pick(tk.value, th))};`).join('') + ((t.shadow && t.shadow.tokens) || []).map((tk) => `--${tk.name}:${pick(tk.value, th)};`).join('') + '} }\n';
    });
    css += ':root {';
    for (const fam of Object.keys(t)) { const v0 = t[fam]; if (fam === 'color' || fam === 'type' || fam === 'shadow' || !v0 || !Array.isArray(v0.tokens)) continue; for (const tk of v0.tokens) css += `--${tk.name}:${tk.value};`; }
    for (const k in t.type.families) css += `--font-${k}:${t.type.families[k]};`;
    css += '}\n';
    for (const gr of t.type.groups || []) for (const st of gr.styles || []) css += `.${st.name}{font-family:var(--font-${st.family || gr.family});font-size:${st.fontSize};line-height:${st.lineHeight};font-weight:${st.fontWeight}${st.letterSpacing ? ';letter-spacing:' + st.letterSpacing : ''}${st.fontStyle ? ';font-style:' + st.fontStyle : ''}${st.opticalSize ? ";font-variation-settings:'opsz' " + st.opticalSize : ''}}\n`;
    if (o.fontBase) for (const f of t.type.fonts || []) css += `@font-face{font-family:"${f.family}";src:url("${o.fontBase}${String(f.file).replace(/^fonts\//, '')}") format("woff2");font-weight:${f.weight};font-style:${f.style || 'normal'};font-display:swap}\n`;
    return css;
  }
  function installTokens(t, o) { let el = document.getElementById('ht-tokens'); if (!el) { el = document.createElement('style'); el.id = 'ht-tokens'; document.head.prepend(el); } el.textContent = tokensToCss(t, o); for (const k in stackCache) delete stackCache[k]; return el; }
  function check() { const ok = !!W.getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(); if (!ok) warn('No Halftone tokens on this page: load the system tokens.css, or call Halftone.installTokens(tokensJson).'); return ok; }

  const api = {
    version: VERSION,
    render,
    mount: (el, spec) => { if (!spec || !render[spec.type]) throw new Error('[Halftone] mount: spec.type must be one of ' + Object.keys(render).join(', ')); return render[spec.type](el, spec); },
    theme, installTokens, tokensToCss, check,
    format: makeFormat,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Sofia+Sans+Semi+Condensed:wght@1..1000&family=Sofia+Sans+Extra+Condensed:wght@1..1000&family=IBM+Plex+Mono:wght@400;500&display=swap',
    util: { valueDomain, nice, linTicks, linear, quantile, ols, toCsv, textWidth: textW, wrapText, seededRandom: mulberry32, normal },
    series: (i) => slotVar(i),
  };
  for (const name in draws) api[name] = reactify(name);
  W.Halftone = Object.assign(W.Halftone || {}, api);
})();
