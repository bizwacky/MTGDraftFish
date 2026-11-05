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

The visual identity is the [Halftone](https://claude.ai/artifact/YQSMapRzAbrvnJ7AoivnMQ) design system:
paper, ink and one signal blue, with every figure carrying its own title, source, table view and CSV.

## Quick start

```bash
npm install
npm run refresh      # fetch MTGJSON + TCGCSV for the sets in targets.json → public/data/
npm run dev          # open the site
npm run ev -- INV    # the same numbers in the terminal
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
    { "set": "ROE", "box": "draft", "note": "Rise of the Eldrazi: the slow battlecruiser format." },
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
(173 at the time of writing) and hands you the line to paste. Run `npm run refresh` afterwards.
Purchase prices typed on the page and the valuation rules are remembered in the browser.

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
| Card Kingdom buylist (via MTGJSON) | cash buy prices per finish | the `buylist` price basis |
| `buylist/*.csv` | buylist quotes you entered by hand | override the Card Kingdom quote card by card; see `buylist/README.md` |

**GameNerdz buylist.** The GameNerdz buylist runs on a hosted platform behind a login, has no public
price feed, and the store's terms prohibit automated price collection. MTGDraftFish therefore does
not fetch it. Card Kingdom's published buylist is the automatic buylist basis, and quotes you read
off GameNerdz yourself can be entered in `buylist/*.csv`.

## Method

For a sheet, one draw has mean μ = Σ pᵢvᵢ and variance σ² = Σ pᵢvᵢ² − μ², where pᵢ is a card's share
of the sheet weight and vᵢ its recoup value. A pack layout with n draws from each sheet has mean Σ nμ
and variance Σ nσ²; `fixed` sheets (Jumpstart-style) are dealt whole. A set's packs come in several
layouts with weights, so a pack is a mixture: E = Σ wₖμₖ and Var = Σ wₖ(σₖ² + μₖ²) − E². A box of P
packs has mean P·E and standard deviation √(P·Var). These are exact under the model.

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
src/engine/             pricing rules, pack model, exact moments, simulation, statistics (shared)
src/pipeline/           MTGJSON, TCGCSV and buylist loaders, set builder, disk cache
src/app/                the site: state, data loading, simulation worker, views
public/halftone/        the Halftone bundle, tokens and fonts (fonts under the SIL Open Font License)
tests/                  engine unit tests (vitest)
```
