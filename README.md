# MTGDraftFish

Expected value, spread and break-even odds for the Magic: The Gathering booster boxes on your draft list.

Opening a booster box is a lottery with published odds. MTGJSON records which print sheets fill each
slot of a pack and how heavily each card sits on its sheet. Price every card, weight it by those odds,
and a box's value becomes a distribution instead of a guess. MTGDraftFish keeps a target list of boxes,
prices every card they can deal at today's TCGplayer prices, and shows for each box:

- the **expected recoup value** and its **standard deviation** (exact under the sheet model),
- the **distribution** of box values from a seeded Monte Carlo simulation, as 20 equally likely
  outcomes and as a histogram,
- the **chance of breaking even** at a purchase price you type in,
- where the value sits (by rarity and finish) and which cards carry it.

Boxes that deal a box-topper pack (Ultimate Masters, Aetherdrift, …) include it.

The visual identity is the [Halftone](https://claude.ai/artifact/YQSMapRzAbrvnJ7AoivnMQ) design system:
paper, ink and one signal blue, with every figure carrying its own title, source, table view and CSV.

## Quick start

```bash
npm install
npm run refresh      # fetch MTGJSON + TCGCSV for the sets in targets.json → public/data/
npm run dev          # open the site
npm run ev -- MH2    # the same numbers in the terminal
npm run buylist:todo # lookup list of the cards that carry the EV → buylist/todo.csv
npm test             # engine unit tests
```

Node 20 or newer. The refresh keeps a `.cache/` of downloads so repeated local runs are instant and
polite to the sources. A snapshot of `public/data/` is committed, so the site works before the first
refresh; the published site refreshes itself daily (see Deployment).

## The target list

`targets.json` is the watch list and the source of truth for which sets get data:

```json
{
  "defaults": { "basis": "mid", "tiers": [{ "min": 1, "pct": 0.7 }], "boxes": 20000 },
  "targets": [
    { "set": "UMA", "box": "draft", "note": "Ultimate Masters, 2018. 24 draft boosters plus one box-topper pack." },
    { "set": "MH2", "box": "set", "price": 450 }
  ]
}
```

| field   | meaning |
|---------|---------|
| `set`   | MTGJSON set code |
| `box`   | optional: `draft`, `play`, `set`, `collector`, `default`, or a sealed-product uuid. Defaults to the most draft-like box. |
| `price` | optional purchase price to test; defaults to the box's own TCGplayer market price. Overridable on the page. |
| `note`  | optional, shown on the box page |

The **Add a set** search on the target list covers every set with a draftable booster box in MTGJSON
(182 at the time of writing) and hands you the line to paste. Run `npm run refresh` afterwards; a
full run also prunes set files that left the list. Purchase prices typed on the page and the
valuation rules are remembered in the browser.

## Valuation rules

A card's recoup value is its basis price passed through the rules you set on the page:

- **Price basis**: TCGplayer **Low**, **Mid** (default) or **Market**, or a **buylist** cash price.
- **Recoup tiers**: cards priced at or above a threshold count at a percentage of the basis price;
  cards under every threshold count as $0. Default: 70% of Mid for cards at $1 or more. Add tiers for
  "80% over $20" style schedules.

Foil sheets use the foil price. A finish with no price falls back to the other finish; a missing
figure falls back along Market → Mid → Low. "Sticker value" (every card at 100%, no floor) is shown
next to the recoup EV for context.

## Data sources and how they are used

| source | what | how |
|--------|------|-----|
| [MTGJSON](https://mtgjson.com/) | set files (booster configurations, print sheets, sealed products), `SetList.json`, `AllPricesToday.json.gz` | one request per set and per source set (e.g. Time Spiral draws its timeshifted sheet from TSB), cached 20 hours |
| [TCGCSV](https://tcgcsv.com/) | daily export of TCGplayer Low / Mid / Market per product and finish, including sealed boxes | `last-updated.txt` is read first and keys the cache, so each day's files are fetched once; custom `User-Agent`; 120 ms between requests; never requested from the browser. This follows TCGCSV's [usage guidelines](https://tcgcsv.com/docs#usage-guidelines). |
| Card Kingdom buylist (via MTGJSON) | cash buy prices per finish | the automatic `buylist` price basis; public data, merged into the committed set files |
| `buylist/*.csv` | buylist quotes you (or a supervised agent) read off a store | compiled into `public/data/local/buylist.json`; both gitignored, never committed or published; overlay the Card Kingdom quote card by card |

### Buylist quotes from GameNerdz

GameNerdz's buylist is readable in a browser without an account, but it has no documented API or
export, and the store's terms of use prohibit "any collection and use of any product listings,
descriptions, or prices" and "any use of data mining, robots, or similar data gathering and
extraction tools". Nothing in this repository fetches it, and the deployed site only ever carries
the Card Kingdom quotes.

For personal use on your own machine, the intended workflow is a person, or an AI agent with a
browser tool that the person is supervising, reading the prices of the few dozen cards that
actually carry a box's expected value and typing them into a CSV:

```bash
npm run refresh                     # today's prices
npm run buylist:todo -- --top 30    # buylist/todo.csv: the cards to look up, with coverage per box
# look up prices on buylist.gamenerdz.com, fill price/source/date, save as buylist/gamenerdz.csv
npm run refresh -- --no-catalog     # compiles public/data/local/buylist.json (gitignored)
npm run ev -- MH2 --basis buylist   # or the site with price basis "Buylist"
```

`docs/gamenerdz-buylist-workflow.md` is the step-by-step procedure for an agent, with the ground
rules that keep it as close as an agent can get to a person reading the site: one tab, one search at
a time, human pace, only the todo list, never the internal endpoints, never logged in, data stays
local, stop on any block. Whether that sits within the letter of the terms is the owner's call; it
is personal, supervised and tiny in volume, which is what the ground rules protect. `CLAUDE.md` is
the project guide an agent reads first.

The top-cards table on a box page shows a *Quote* column (source and date) when the basis is
Buylist, and the box notes say how many quotes are hand-gathered; buylists move daily, so the date
is the staleness signal.

## Method

For a sheet, one draw has mean μ = Σ pᵢvᵢ and variance σ² = Σ pᵢvᵢ² − μ², where pᵢ is a card's share
of the sheet weight and vᵢ its recoup value. A pack layout with n draws from each sheet has mean Σ nμ
and variance Σ nσ²; `fixed` sheets (Jumpstart-style) are dealt whole. A set's packs come in several
layouts with weights, so a pack is a mixture: E = Σ wₖμₖ and Var = Σ wₖ(σₖ² + μₖ²) − E². A box of P
packs has mean P·E and standard deviation √(P·Var); a box-topper pack is one more pack model added to
both. These are exact under the model.

The distribution of a box is right-skewed (a few boxes carry a chase foil), so break-even odds come
from simulation: each pack picks a layout by weight, each slot draws from its sheet by weight (without
replacement inside a slot unless MTGJSON allows duplicates), 20,000 boxes by default, with a fixed
seed so the same inputs reproduce the same picture. The chance is reported as a count in 20 so it
reads as a frequency, with the exact percentage beside it. A normal approximation is printed as a
cross-check; it understates the skew.

Not modelled: colour balancing of commons, print-run collation (real boxes are a little less spread
than 36 independent packs), inserts outside MTGJSON's booster data, condition, fees, and the time it
takes to sell a few hundred cards. TCGplayer Low can reflect a single damaged copy; Mid and Market
are steadier, and sealed box prices use Market where it exists.

`tests/engine.test.ts` checks the exact moments against a brute-force enumeration of a small pack,
the simulation against the exact mean and standard deviation, the recoup tiers and the fallbacks.

## Deployment

`.github/workflows/refresh-and-deploy.yml` runs daily at 21:37 UTC (after TCGCSV publishes), on
every push to `main`, and on demand: tests, refresh, build, deploy to GitHub Pages. Enable it once
under **Settings → Pages → Source: GitHub Actions**. If a source is unreachable the committed data
snapshot deploys instead. The site is static: all EV maths and simulation run in the browser
(simulation in a Web Worker), reading the JSON the refresh wrote.

## Layout

```
targets.json            the watch list
scripts/refresh.ts      data pipeline → public/data/{index,catalog}.json, public/data/sets/*.json
scripts/ev.ts           terminal summary for one box
scripts/buylist-todo.ts lookup list of the cards that carry each box's EV
buylist/                hand-gathered quotes (CSV, gitignored) and the format guide
docs/                   the supervised GameNerdz lookup procedure for an agent
CLAUDE.md, AGENTS.md    project guide for AI agents
src/engine/             pricing rules, pack model, exact moments, simulation, statistics (shared)
src/pipeline/           MTGJSON, TCGCSV and buylist loaders, set builder, disk cache
src/app/                the site: state, data loading, simulation worker, views
public/data/local/      compiled hand-gathered quotes (gitignored)
public/halftone/        the Halftone bundle, tokens and fonts (fonts under the SIL Open Font License)
tests/                  engine unit tests (vitest)
```
