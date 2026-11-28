import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import i18n from '@/i18n/config';
import { FiltersPanel } from '../filters-sheet';
import { NO_FACETS, type FacetsCurrency, type SearchFacets } from '../search-facets';
import type { SearchScope } from '../search-scope';
import { useSearchState } from '../use-search-state';

vi.mock('@/api/public-site-search.api', () => ({ publicSiteSearchApi: { getStays: vi.fn() } }));

const SCOPE: SearchScope = { kind: 'org', slug: 'demo', hostName: 'Demo' };

const one = (currency: string): FacetsCurrency => ({ currency, currencyState: 'one' });
const NONE: FacetsCurrency = { currency: null, currencyState: 'none' };
const MIXED: FacetsCurrency = { currency: null, currencyState: 'mixed' };

function Panel({ facets }: { facets: SearchFacets }) {
  const state = useSearchState({ maxGuests: facets.maxGuests });
  return <FiltersPanel scope={SCOPE} state={state} facets={facets} open onClose={() => undefined} />;
}

function renderPanel(currency: FacetsCurrency) {
  const facets: SearchFacets = { ...NO_FACETS, prices: { min: 50, max: 400 }, ...currency };
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/book/demo/search?minPrice=100&maxPrice=300']}>
        <Panel facets={facets} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function written() {
  const form = screen.getByTestId('search-filters-form');
  return {
    form,
    summary: form.querySelector('legend output')?.textContent,
    sliders: Array.from(form.querySelectorAll('.sr-range output')).map((output) => output.textContent),
  };
}

describe('the price sliders of the filters', () => {
  beforeEach(async () => {
    vi.mocked(publicSiteSearchApi.getStays).mockReturnValue(new Promise(() => undefined));
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('FiltersPanel_DataSayNoCurrency_WritesTheRangeWithNoSymbolAndThePhrase', () => {
    renderPanel(NONE);

    const { form, summary, sliders } = written();
    expect(summary).toBe('da 100 (valuta non disponibile) a 300 (valuta non disponibile)');
    expect(sliders).toEqual(['100 (valuta non disponibile)', '300 (valuta non disponibile)']);
    expect(form).not.toHaveTextContent(/EUR|€/);
  });

  it('FiltersPanel_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderPanel(NONE);

    const { summary, sliders } = written();
    expect(summary).toBe('from 100 (currency not available) to 300 (currency not available)');
    expect(sliders).toEqual(['100 (currency not available)', '300 (currency not available)']);
  });

  it('FiltersPanel_HomesOfTwoCurrencies_WritesTheNumbersAloneWithNoSymbolAndNoPhrase', () => {
    renderPanel(MIXED);

    const { form, summary, sliders } = written();
    expect(summary).toBe('da 100 a 300');
    expect(sliders).toEqual(['100', '300']);
    expect(form).not.toHaveTextContent(/EUR|CHF|€|disponibile/);
  });

  it('FiltersPanel_HomesOfTwoCurrenciesInEnglish_WritesTheNumbersAlone', async () => {
    await i18n.changeLanguage('en');
    renderPanel(MIXED);

    const { form, summary, sliders } = written();
    expect(summary).toBe('from 100 to 300');
    expect(sliders).toEqual(['100', '300']);
    expect(form).not.toHaveTextContent(/EUR|CHF|€|available/);
  });

  it('FiltersPanel_HomesInFrancs_WriteTheRangeInFrancsInItalianAndInEnglish', async () => {
    renderPanel(one('CHF'));

    const inItalian = written();
    expect(inItalian.sliders.every((slider) => slider?.includes('CHF'))).toBe(true);
    expect(inItalian.summary).toContain('CHF');
    expect(inItalian.form).not.toHaveTextContent('€');
    expect(inItalian.form).not.toHaveTextContent('valuta non disponibile');
    cleanup();

    await i18n.changeLanguage('en');
    renderPanel(one('CHF'));
    const inEnglish = written();
    expect(inEnglish.sliders.every((slider) => slider?.includes('CHF'))).toBe(true);
    expect(inEnglish.form).not.toHaveTextContent('€');
    expect(inEnglish.form).not.toHaveTextContent('currency not available');
  });

  it('FiltersPanel_HomesInEuros_WriteTheRangeInEurosExactlyAsAlways', () => {
    renderPanel(one('EUR'));

    const { form, sliders } = written();
    expect(sliders).toEqual([
      new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(100),
      new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(300),
    ]);
    expect(form).not.toHaveTextContent('valuta non disponibile');
  });
});
