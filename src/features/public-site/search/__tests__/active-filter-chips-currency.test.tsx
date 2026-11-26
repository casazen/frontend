import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { ActiveFilterChips } from '../active-filter-chips';
import type { FacetsCurrency } from '../search-facets';
import { NO_FILTERS } from '../search-state';

/**
 * CHF-MONEY, the chip of the price range: it is written in the currency the facets of the homes say (francs in Switzerland); when the data say none (no
 * currency, or something that is not a code) with no symbol and the phrase that says so; when the homes say two currencies, the numbers alone (the currency is
 * not missing, a chip has no one to name); and until the homes are in (the currency is not known yet, which is not «none») the chip of the price is not drawn.
 * It never turns the amount into euros.
 */
const PRICE_RANGE = { ...NO_FILTERS, minPrice: 100, maxPrice: 300 };

const one = (currency: string): FacetsCurrency => ({ currency, currencyState: 'one' });
const NONE: FacetsCurrency = { currency: null, currencyState: 'none' };
const MIXED: FacetsCurrency = { currency: null, currencyState: 'mixed' };
const PENDING: FacetsCurrency = { currency: null, currencyState: 'pending' };

function renderChips(facets: FacetsCurrency, filters = PRICE_RANGE) {
  return render(<ActiveFilterChips filters={filters} facets={facets} onChange={vi.fn()} />);
}

describe('ActiveFilterChips price', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('ActiveFilterChips_DataSayNoCurrency_WritesTheRangeWithNoSymbolAndSaysTheCurrencyIsNotAvailable', () => {
    renderChips(NONE);

    const chips = screen.getByTestId('search-active-filters');
    expect(chips).toHaveTextContent('da 100 (valuta non disponibile) a 300 (valuta non disponibile)');
    expect(chips).not.toHaveTextContent(/EUR|€/);
  });

  it('ActiveFilterChips_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderChips(NONE);

    expect(screen.getByTestId('search-active-filters')).toHaveTextContent('from 100 (currency not available) to 300 (currency not available)');
  });

  it('ActiveFilterChips_HomesOfTwoCurrencies_WritesTheNumbersAloneWithNoSymbolAndNoPhrase', () => {
    renderChips(MIXED);

    const chips = screen.getByTestId('search-active-filters');
    expect(chips).toHaveTextContent('da 100 a 300');
    expect(chips).not.toHaveTextContent(/EUR|CHF|€|disponibile/);
  });

  it('ActiveFilterChips_HomesOfTwoCurrenciesInEnglish_WritesTheNumbersAlone', async () => {
    await i18n.changeLanguage('en');
    renderChips(MIXED);

    const chips = screen.getByTestId('search-active-filters');
    expect(chips).toHaveTextContent('from 100 to 300');
    expect(chips).not.toHaveTextContent(/EUR|CHF|€|available/);
  });

  it('ActiveFilterChips_HomesNotInYet_DrawsNoChipOfThePriceAndSaysNothingAboutTheCurrency', () => {
    // The answer with the homes is on its way: the currency is not known yet, so the chip waits, instead of saying that the currency is not available.
    const { container } = renderChips(PENDING);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('search-active-filters')).not.toBeInTheDocument();
  });

  it('ActiveFilterChips_HomesNotInYet_StillDrawsTheOtherFilters', () => {
    renderChips(PENDING, { ...PRICE_RANGE, bedrooms: 2 });

    const chips = screen.getByTestId('search-active-filters');
    expect(chips.querySelectorAll('button')).toHaveLength(1);
    expect(chips).not.toHaveTextContent(/100|300|disponibile/);
  });

  it('ActiveFilterChips_CurrencyOfTheHomes_IsTheOneWritten', () => {
    renderChips(one('CHF'));

    const chips = screen.getByTestId('search-active-filters');
    expect(chips).toHaveTextContent('CHF');
    expect(chips).not.toHaveTextContent('€');
    expect(chips).not.toHaveTextContent('valuta non disponibile');
  });
});
