import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { ActiveFilterChips } from '../active-filter-chips';
import { NO_FILTERS } from '../search-state';

/**
 * CHF-MONEY, the chip of the price range: it is written in the currency the facets of the homes say (francs in Switzerland), and when they say none (no
 * currency, or homes of two) with no symbol and the phrase that says so: the chip never turns the amount into euros.
 */
const PRICE_RANGE = { ...NO_FILTERS, minPrice: 100, maxPrice: 300 };

function renderChips(currency?: string | null) {
  return render(<ActiveFilterChips filters={PRICE_RANGE} currency={currency} onChange={vi.fn()} />);
}

describe('ActiveFilterChips price', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it.each([
    ['not given', undefined],
    ['null', null],
    ['empty', ''],
  ] as const)('ActiveFilterChips_Currency%s_WritesTheRangeWithNoSymbolAndSaysTheCurrencyIsNotAvailable', (_name, currency) => {
    renderChips(currency);

    const chips = screen.getByTestId('search-active-filters');
    expect(chips).toHaveTextContent('da 100 (valuta non disponibile) a 300 (valuta non disponibile)');
    expect(chips).not.toHaveTextContent(/EUR|€/);
  });

  it('ActiveFilterChips_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderChips(null);

    expect(screen.getByTestId('search-active-filters')).toHaveTextContent('from 100 (currency not available) to 300 (currency not available)');
  });

  it('ActiveFilterChips_CurrencyOfTheHomes_IsTheOneWritten', () => {
    renderChips('CHF');

    const chips = screen.getByTestId('search-active-filters');
    expect(chips).toHaveTextContent('CHF');
    expect(chips).not.toHaveTextContent('€');
    expect(chips).not.toHaveTextContent('valuta non disponibile');
  });
});
