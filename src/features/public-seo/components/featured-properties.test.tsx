import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import type { FeaturedProperty } from '@/types/seo.types';
import { FeaturedProperties } from './featured-properties';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock('@/queries/use-public-seo', () => ({
  useFeaturedProperties: () => ({ isFetching: false, refetch: state.refetch, ...state.query }),
}));

function property(overrides: Partial<FeaturedProperty> = {}): FeaturedProperty {
  return {
    id: 'prop-1',
    slug: 'villa-lago',
    orgSlug: 'casa-rossi',
    name: 'Villa Lago',
    city: 'Como',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 120,
    photoUrl: 'https://cdn.example.test/villa.jpg',
    ...overrides,
  };
}

function problemError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status },
  });
}

function renderSection() {
  return render(
    <MemoryRouter>
      <FeaturedProperties comuneSlug="como" comuneName="Como" />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  state.refetch.mockReset();
});

afterEach(() => cleanup());

describe('FeaturedProperties (SE-04, #300 AC2, A8-10)', () => {
  it('FeaturedProperties_Loading_ShowsTheLoadingStateNotTheEmptyOne', () => {
    state.query = { isLoading: true, isError: false, data: undefined };

    renderSection();

    expect(screen.getByTestId('featured-properties-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('featured-properties-empty')).not.toBeInTheDocument();
  });

  it('FeaturedProperties_RequestFails_ShowsTheErrorWithRetryNeverTheEmptyState', () => {
    state.query = { isLoading: false, isError: true, error: problemError(500), data: undefined };

    renderSection();

    const alert = screen.getByTestId('featured-properties-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('featured-properties-empty')).not.toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it('FeaturedProperties_NoPublishedProperty_SaysThereAreNoneYet', () => {
    state.query = { isLoading: false, isError: false, data: { comuneSlug: 'como', comuneName: 'Como', properties: [] } };

    renderSection();

    expect(screen.getByTestId('featured-properties-empty')).toHaveTextContent('Non ci sono ancora case prenotabili a Como');
  });

  it('FeaturedProperties_Properties_LinkEachToItsPageOnTheHostBookingSite', () => {
    state.query = {
      isLoading: false,
      isError: false,
      data: {
        comuneSlug: 'como',
        comuneName: 'Como',
        properties: [property(), property({ id: 'prop-2', slug: null, orgSlug: 'altro-host', name: 'Monolocale Centro', bedrooms: 0, maxGuests: 1, nightlyRate: 60, photoUrl: null })],
      },
    };

    renderSection();

    const cards = screen.getAllByTestId('featured-property');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByTestId('featured-property-link')).toHaveAttribute('href', '/book/casa-rossi/property/villa-lago');
    expect(within(cards[0]).getByTestId('featured-property-photo')).toHaveAttribute('src', 'https://cdn.example.test/villa.jpg');
    expect(cards[0]).toHaveTextContent('2 camere');
    expect(cards[0]).toHaveTextContent('4 ospiti');
    // A legacy property without a slug links by its id; no photo: no image, a placeholder.
    expect(within(cards[1]).getByTestId('featured-property-link')).toHaveAttribute('href', '/book/altro-host/property/prop-2');
    expect(within(cards[1]).queryByTestId('featured-property-photo')).not.toBeInTheDocument();
    expect(cards[1]).toHaveTextContent('Monolocale');
    expect(cards[1]).toHaveTextContent('1 ospite');
  });

  it('FeaturedProperties_English_ShowsTheTextsInEnglish', async () => {
    await i18n.changeLanguage('en');
    state.query = {
      isLoading: false,
      isError: false,
      data: { comuneSlug: 'como', comuneName: 'Como', properties: [property()] },
    };

    renderSection();

    expect(screen.getByRole('heading', { name: 'Homes available in Como' })).toBeInTheDocument();
    expect(screen.getByTestId('featured-property')).toHaveTextContent('2 bedrooms');
    expect(screen.getByTestId('featured-property-link')).toHaveTextContent('View and book');
  });
});
