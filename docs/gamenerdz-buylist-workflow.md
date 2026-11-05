# Gathering GameNerdz buylist quotes with a supervised agent

This is the procedure for an AI agent running in a terminal on the owner's machine, with a browser
tool, to look up GameNerdz buylist prices for the cards that matter and feed them into
MTGDraftFish. The owner is present and has asked for this. Read the ground rules first; they are
not optional.

## Ground rules

1. **You are standing in for the owner reading the site.** Use a real browser the way a person
   would: one tab, one search at a time, read the number, move on. Pause a few seconds between
   lookups. Never run lookups in parallel.
2. **Only the cards that matter.** Work from `buylist/todo.csv`, which lists the top contributors
   to each box's expected value. Do not crawl sets, pages of results, or "all cards". A session is
   a few dozen to at most ~150 lookups.
3. **Never call GameNerdz's internal endpoints directly** (the site is driven by `/saas/search`
   requests; do not script them with `fetch`, `curl` or a JSON client). Never log in. Never
   bypass a captcha or block: if the site challenges or blocks you, stop and tell the owner.
4. **The data stays local.** Quotes go in `buylist/*.csv`, which is gitignored, and surface only
   in `public/data/local/buylist.json`, also gitignored. Do not commit, publish or paste them into
   a PR, an issue or a public page. The deployed site uses the Card Kingdom buylist only.
5. **Say what you did.** When finished, report how many cards you looked up, how many had a quote,
   how many you could not match, and the date.

GameNerdz's terms of use prohibit "any collection and use of any product listings, descriptions,
or prices" and "any use of data mining, robots, or similar data gathering and extraction tools".
A supervised, human-paced, personal lookup of a few dozen prices is the owner's call to make; the
rules above keep it as close to a person reading the site as an agent can get. If you cannot
follow them (no browser tool, or the owner is not present), fall back to printing the todo list
and asking the owner to read the prices.

## Procedure

1. **Fresh data first.** `npm run refresh` so TCGplayer prices and the Card Kingdom quotes are
   today's.
2. **Make the lookup list.** `npm run buylist:todo -- --top 30` writes `buylist/todo.csv` with one
   row per (card, finish), sorted by how much of the box EV it carries, across every box on the
   target list. Options: `--sets MH2,UMA`, `--top N` per box, `--basis mid|market|low`,
   `--out <file>`. The script refuses to overwrite a todo file that already has prices filled in.
   Read the printed coverage line: e.g. "MH2 draft: top 30 cards carry 71% of recoup EV".
3. **Open the buylist.** Go to `https://buylist.gamenerdz.com/retailer/buylist` and choose
   *Magic: The Gathering*. No account is needed. The header has a Cash / Credit toggle: make sure
   **Cash** is selected. Credit prices include a trade-in bonus and are not comparable with the
   Card Kingdom cash quotes.
4. **Look up each row.** Type the card name in the search box. Results read like
   `Foil Woodland Cemetery (PRE-248S) - Dominaria Promos · Near Mint · Buy Price: $2.66`.
   Match three things before you take a number:
   - the **set code and collector number in parentheses** against the row's `set` and `number`
     (GameNerdz uses the usual set codes; promo and "The List" printings have their own codes and
     are *not* the card you want unless the row says so);
   - the **finish**: a leading "Foil" in the name is the foil printing; `finish=nonfoil` rows want
     the line without it;
   - the **condition**: record the **Near Mint** buy price.
   If the printing is not listed, or is listed as not being bought, leave `price` empty (the Card
   Kingdom quote then stands in). Do not substitute another printing's price.
5. **Record.** Write the price into the row's `price` column, `source=GameNerdz`, and today's date
   in `date`. Put anything odd in `notes` ("only credit price shown", "listed as Lightly Played").
6. **Save and load.** Move the filled rows to `buylist/gamenerdz.csv` (or leave them in
   `todo.csv`; rows with a blank price are ignored either way), then run
   `npm run refresh -- --no-catalog`. It reports how many quotes it resolved to card ids and warns
   about rows it could not match (wrong set code or collector number).
7. **Check.** `npm run ev -- MH2 --basis buylist` prints the top cards with their quote source.
   In the site (`npm run dev`), set the price basis to *Buylist*; the box page's top-cards table
   shows a *Quote* column naming the source and date for each card, and the notes list how many
   quotes are hand-gathered.

## Matching pitfalls

- Double-faced cards appear under the front face name. Adventure and split cards use the full
  `A // B` name on MTGJSON's side; GameNerdz may show only the first half.
- Masters and Horizons sets reprint cards from many sets: the collector number is the only
  reliable key. `(MH2-273)` is not `(MH2-497)` (the retro-frame or showcase version).
- Timeshifted, Mystical Archive, Multiverse Legends and Special Guests cards belong to their own
  set codes (TSB, STA, MUL, SPG) and the todo rows say so.
- Etched foils are a separate finish; GameNerdz may not list them at all.
- If a card's buylist price is far above its TCGplayer market price, re-read it: it is usually a
  different printing.

## When it is done

Report: lookups attempted, quotes recorded, rows left blank and why, date, and the refresh
output's resolved-quote count. Remind the owner that buylists move daily and that the
`date` column is how the site shows staleness.
