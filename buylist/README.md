# Hand-entered buylist quotes

Drop one or more `.csv` files in this folder and `npm run refresh` will merge them into the
`buylist` price basis, overriding the automatic Card Kingdom quotes card by card.

This is the place for buylist prices you looked up yourself (for example GameNerdz, which has
no public price feed and whose terms forbid automated collection). Enter only what you read
by hand.

Columns (header row required; order does not matter):

| column   | required | notes |
|----------|----------|-------|
| `set`    | yes      | MTGJSON set code, e.g. `INV` |
| `number` | one of number/name | collector number, e.g. `57` |
| `name`   | one of number/name | exact card name (used when `number` is empty) |
| `finish` | no       | `nonfoil` (default), `foil` or `etched` |
| `price`  | yes      | cash price in USD |

Example:

```csv
set,number,name,finish,price
INV,57,Fact or Fiction,nonfoil,3.50
INV,57,Fact or Fiction,foil,140
TSP,,Ancestral Vision,,22
```
