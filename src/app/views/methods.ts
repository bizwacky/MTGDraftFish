import type { DataIndex } from '../../engine/types';
import { h } from '../dom';
import { REPO } from './targets';

export function mountMethods(root: HTMLElement, index: DataIndex): () => void {
  const s = index.sources;
  root.append(
    h('p', { class: 'page-kicker t-kicker' }, 'Methods'),
    h('h1', { class: 'page-title t-headline' }, 'How a box becomes a number'),
    h('div', { class: 'prose t-body' },
      h('p', null, 'Opening a booster box is a lottery with published odds. MTGJSON records, for most sets, which print sheets fill each slot of a pack and how heavily each card sits on its sheet. Price every card, weight it by those odds, and the box’s value is a distribution rather than a guess.'),
      h('h2', { class: 't-title' }, 'Data'),
      h('ul', null,
        h('li', null, h('strong', null, 'Set and booster data: '), `MTGJSON ${s.mtgjson.version} (`, h('a', { href: 'https://mtgjson.com/' }, 'mtgjson.com'), '). Each set file carries booster configurations: pack layouts with weights, and sheets mapping card ids to weights, with flags for foil, fixed and duplicate-allowed sheets. Sealed-product records give the packs per box and the box’s TCGplayer id.'),
        h('li', null, h('strong', null, 'Card prices: '), 'TCGCSV (', h('a', { href: 'https://tcgcsv.com/' }, 'tcgcsv.com'), `), a daily export of TCGplayer’s Low, Mid and Market prices per product and finish, last published ${s.tcgcsv.updated.slice(0, 19).replace('T', ' ')} UTC. Fetched once a day by the refresh script, never from the browser, as its usage guidelines ask.`),
        h('li', null, h('strong', null, 'Buylist prices: '), s.buylist ? `${s.buylist.provider}, dated ${s.buylist.date}. Card Kingdom publishes its buylist to MTGJSON daily; it stands in for a cash offer. GameNerdz’s buylist is readable in a browser but has no documented API, and the store’s terms prohibit automated price gathering, so it is not fetched; quotes you read there by hand can be entered in buylist/*.csv and override the automatic ones.` : 'not loaded in this build (run the refresh without --no-buylist).')
      ),
      h('h2', { class: 't-title' }, 'Valuing a card'),
      h('p', null, 'A card’s recoup value is its basis price (TCGplayer Low, Mid, Market or the buylist) passed through the recoup rules: a card priced at or above a tier’s threshold counts at that tier’s percentage, and a card under every threshold counts as $0. The default is 70% of TCGplayer Mid for cards at $1 or more, which approximates selling singles into a buylist or at a discount. Foil sheets use the foil price. Where a finish has no price the other finish is used; where a figure is missing the next one is used (Market → Mid → Low).'),
      h('h2', { class: 't-title' }, 'Expected value and spread'),
      h('p', null, 'For a sheet, the value of one draw has mean μ = Σ pᵢvᵢ and variance σ² = Σ pᵢvᵢ² − μ², with pᵢ the card’s share of the sheet weight. A pack layout with n draws from each sheet has mean Σ nμ and variance Σ nσ². A set’s packs come in several layouts with weights, so the pack is a mixture: E = Σ wₖμₖ and Var = Σ wₖ(σₖ² + μₖ²) − E². A box of P packs has mean P·E and standard deviation √(P·Var). These are exact under the model and need no simulation.'),
      h('h2', { class: 't-title' }, 'Break-even odds'),
      h('p', null, 'The distribution of a box is right-skewed: most boxes sit a little under the mean and a few carry a chase foil. A normal curve misstates the tails, so the break-even chance comes from opening many boxes in software. Each pack picks a layout by weight, then each slot draws from its sheet by weight (without replacement inside a slot unless MTGJSON allows duplicates). The share of simulated boxes whose recoup value reaches the purchase price is the break-even chance, shown as a count in 20 so it can be read as a frequency. The seed is fixed, so the same inputs reproduce the same picture.'),
      h('h2', { class: 't-title' }, 'What is left out'),
      h('ul', null,
        h('li', null, 'Colour balancing of commons, which MTGJSON flags but which barely moves value.'),
        h('li', null, 'Print-run collation: real boxes are not 36 independent packs, so the true spread is a little narrower than modelled.'),
        h('li', null, 'Inserts outside the booster data (box toppers, promos), condition, grading, shipping, fees and the time it takes to sell a few hundred cards.'),
        h('li', null, 'TCGplayer Low can reflect a single damaged or mis-listed copy; Mid and Market are steadier. Sealed box prices use Market where it exists for the same reason.')
      ),
      h('h2', { class: 't-title' }, 'Running it'),
      h('pre', { class: 't-code' }, 'npm install\nnpm run refresh        # fetch MTGJSON + TCGCSV for targets.json, write public/data/\nnpm run dev            # the site\nnpm run ev -- INV      # the same numbers in the terminal'),
      h('p', null, 'The watch list is ', h('code', null, 'targets.json'), '. Each entry names a set, optionally a box (draft, play, set, collector, default) and a purchase price. The GitHub Actions workflow refreshes the data once a day after TCGCSV publishes and redeploys the site. Code: ', h('a', { href: REPO }, REPO.replace('https://', '')), '.')
    )
  );
  return () => undefined;
}
