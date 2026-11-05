# Hand-gathered buylist quotes

Any `.csv` in this folder is read by `npm run refresh` and written to `public/data/local/buylist.json`,
which the site and the CLI lay over the automatic Card Kingdom quotes when the price basis is
**Buylist**. Both the CSVs and that JSON are gitignored: quotes you gathered from a store stay on
your machine and are never committed or published.

Columns (header row required; order does not matter; extra columns are ignored):

| column   | required | notes |
|----------|----------|-------|
| `set`    | yes      | MTGJSON set code, e.g. `MH2` |
| `number` | one of number/name | collector number, e.g. `57` |
| `name`   | one of number/name | exact card name (used when `number` is empty) |
| `finish` | no       | `nonfoil` (default), `foil` or `etched` |
| `price`  | yes      | cash price in USD; a row with an empty price is ignored |
| `source` | no       | where you read it, e.g. `GameNerdz` (default `manual`) |
| `date`   | no       | ISO date you read it (default: today) |
| `notes`  | no       | anything, ignored by the loader |

`npm run buylist:todo` writes `buylist/todo.csv`: the cards that carry most of the expected value of
the boxes on the target list, in this format with `price` left blank. Fill in the prices you read,
move the filled rows to `buylist/gamenerdz.csv` (any name works), and run `npm run refresh`.

See `docs/gamenerdz-buylist-workflow.md` for the supervised lookup procedure.
