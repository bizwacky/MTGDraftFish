# MTGDraftFish

Expected value, spread and break-even odds for Magic: The Gathering booster boxes on a draft target
list. Static site (Vite + TypeScript, no framework) over a Node data pipeline. Visual identity: the
Halftone design system, vendored under `public/halftone/`.

## Commands

```bash
npm install
npm run refresh                 # MTGJSON + TCGCSV (+ Card Kingdom buylist) for targets.json → public/data/
npm run refresh -- --force      # ignore the .cache/ copies
npm run refresh -- --sets MH2   # a subset
npm run dev                     # the site at http://localhost:5173
npm run ev -- MH2 --price 250   # terminal summary for one box (flags: --box --basis --min --pct --boxes)
npm run buylist:todo -- --top 30   # lookup list of the cards that carry the EV → buylist/todo.csv
npm test && npm run typecheck && npm run build
```

## Where things are

- `targets.json`: the watch list. `set` (MTGJSON code), optional `box` (draft, play, set, collector,
  default or a sealed-product uuid), `price`, `note`. The pipeline builds only these sets.
- `src/engine/`: pure TypeScript shared by pipeline, CLI and browser. `value.ts` (price basis +
  recoup tiers), `model.ts` (pack and box models from MTGJSON sheets), `analytic.ts` (exact
  moments, per-card contributions), `simulate.ts` (seeded Monte Carlo), `stats.ts`, `overlay.ts`
  (local buylist quotes), `boxes.ts` (box selection).
- `src/pipeline/`: `mtgjson.ts`, `tcgcsv.ts`, `buylist.ts`, `build.ts` (SetData builder), `http.ts`
  (disk cache in `.cache/`, custom User-Agent).
- `scripts/`: `refresh.ts`, `ev.ts`, `buylist-todo.ts`, `build-halftone-css.ts`.
- `src/app/`: `main.ts` (hash router), `state.ts` (localStorage), `compute.ts` (memoised
  analytics + simulation worker), `views/` (targets, box, methods, settings, picker).
- `public/data/`: generated. `index.json` (what the list shows), `catalog.json` (every set with a
  draftable box), `sets/<CODE>.json` (compact per-set data), `local/buylist.json` (gitignored).
- `tests/engine.test.ts`: vitest. Keep the brute-force enumeration check green when touching the
  model.

## Data rules

- TCGCSV: read `last-updated.txt` first, custom `User-Agent`, ~120 ms between requests, cache on
  disk, never request it from the browser. The pipeline does all of this; keep it that way.
- MTGJSON set files are cached 20 hours; source sets (SPG, STA, MUL, TSB, PLST…) are loaded
  because sheets reference their cards.
- Buylist: Card Kingdom via MTGJSON's `AllPricesToday.json.gz` is public and is merged into the
  committed set files. Quotes gathered from a store by hand or by a supervised agent go in
  `buylist/*.csv` and are compiled into `public/data/local/buylist.json`; both are gitignored and
  must never be committed or published. See `docs/gamenerdz-buylist-workflow.md` before touching
  GameNerdz.

## Conventions

- Vanilla DOM via `src/app/dom.ts` (`h()`), Halftone renderers via `Halftone.render.*`. Figures
  carry a finding as title, a dek with metric/unit/period, notes, source and `codeUrl`.
- Money in whole dollars in prose and tiles; two decimals in card tables.
- Titles are findings in sentence case with no full stop; no em dashes in copy.
- Before pushing: `npm test && npm run typecheck && npm run build`. Do not commit `public/data/local/`,
  `buylist/*.csv` or `.cache/`.
