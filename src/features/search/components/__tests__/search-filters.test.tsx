import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { SearchFilters } from '../search-filters';
import type { SearchFiltersFormValues } from '../../schemas/search.schema';

function renderFilters(values: SearchFiltersFormValues = {}) {
  const onSearch = vi.fn();
  const onReset = vi.fn();
  const view = render(
    <I18nextProvider i18n={i18n}>
      <SearchFilters values={values} onSearch={onSearch} onReset={onReset} />
    </I18nextProvider>,
  );
  return { onSearch, onReset, ...view };
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

describe('SearchFilters (BK-20, A8-13)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('SearchFilters_OnlyTheCityFilled_SearchesWithOnlyTheCityNotNaN', async () => {
    // The reported scenario: write "Como", press "Cerca": it did nothing while the number fields were empty.
    const { onSearch } = renderFilters();

    fireEvent.change(input('city'), { target: { value: 'Como' } });
    fireEvent.click(screen.getByTestId('search-submit'));

    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    const filters = onSearch.mock.calls[0][0] as SearchFiltersFormValues;
    expect(filters).toEqual({
      city: 'Como',
      minPrice: undefined,
      maxPrice: undefined,
      minBedrooms: undefined,
      minBathrooms: undefined,
      guests: undefined,
    });
    expect(Object.values(filters).some((value) => typeof value === 'number' && Number.isNaN(value))).toBe(false);
  });

  it('SearchFilters_NothingFilled_StillSearchesForEverything', async () => {
    const { onSearch } = renderFilters();

    fireEvent.click(screen.getByTestId('search-submit'));

    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
  });

  it('SearchFilters_EveryFilterFilled_IsPassedAsNumbers', async () => {
    const { onSearch } = renderFilters();

    fireEvent.change(input('city'), { target: { value: 'Roma' } });
    fireEvent.change(input('minPrice'), { target: { value: '50' } });
    fireEvent.change(input('maxPrice'), { target: { value: '150.5' } });
    fireEvent.change(input('minBedrooms'), { target: { value: '2' } });
    fireEvent.change(input('minBathrooms'), { target: { value: '1' } });
    fireEvent.change(input('guests'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('search-submit'));

    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    expect(onSearch.mock.calls[0][0]).toEqual({
      city: 'Roma',
      minPrice: 50,
      maxPrice: 150.5,
      minBedrooms: 2,
      minBathrooms: 1,
      guests: 4,
    });
  });

  it('SearchFilters_SeveralWrongFields_ShowsEveryErrorAndDoesNotSearch', async () => {
    const { onSearch } = renderFilters();

    fireEvent.change(input('minPrice'), { target: { value: '-5' } });
    fireEvent.change(input('minBedrooms'), { target: { value: '1.5' } });
    fireEvent.change(input('guests'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('search-submit'));

    expect(await screen.findByText(i18n.t('search.errors.negative'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('search.errors.wholeNumber'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('search.errors.guestsMin'))).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
    expect(input('minPrice')).toHaveAttribute('aria-invalid', 'true');
  });

  it('SearchFilters_MinPriceAboveMaxPrice_ShowsTheErrorOnTheMaxField', async () => {
    const { onSearch } = renderFilters();

    fireEvent.change(input('minPrice'), { target: { value: '300' } });
    fireEvent.change(input('maxPrice'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('search-submit'));

    expect(await screen.findByText(i18n.t('search.errors.priceRange'))).toBeInTheDocument();
    expect(input('maxPrice')).toHaveAttribute('aria-invalid', 'true');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('SearchFilters_StartsFromTheFiltersInForceAndFollowsThemWhenTheyChange', () => {
    const { rerender, onSearch, onReset } = renderFilters({ city: 'Como', guests: 2 });
    expect(input('city')).toHaveValue('Como');
    expect(input('guests')).toHaveValue(2);

    rerender(
      <I18nextProvider i18n={i18n}>
        <SearchFilters values={{ city: 'Lecco', minPrice: 80 }} onSearch={onSearch} onReset={onReset} />
      </I18nextProvider>,
    );

    expect(input('city')).toHaveValue('Lecco');
    expect(input('minPrice')).toHaveValue(80);
    expect(input('guests')).toHaveValue(null);
  });

  it('SearchFilters_Reset_ClearsTheFieldsAndTellsThePage', () => {
    const { onReset } = renderFilters({ city: 'Como', guests: 2 });

    fireEvent.click(screen.getByTestId('search-reset'));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(input('city')).toHaveValue('');
    expect(input('guests')).toHaveValue(null);
  });
});
