import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { MapLink, RegionMapProps } from '@/features/site-maps';
import type { PublicStayCard } from '@/types/public-stays.types';
import { ResultsMapPane } from '../results-map-pane';

const map = vi.hoisted(() => ({ props: null as RegionMapProps | null }));
vi.mock('@/features/site-maps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/site-maps')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    RegionMap: (props: RegionMapProps) => {
      map.props = props;
      return createElement('div', { 'data-testid': 'region-map-stub' });
    },
  };
});

function card(id: string, currency: string | undefined, price: Partial<PublicStayCard['price']> = {}): PublicStayCard {
  return {
    id,
    slug: id,
    name: `Casa ${id}`,
    comune: 'Lugano',
    latitude: 46.0,
    longitude: 8.95,
    photos: [],
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: currency as string, perNightCents: 14500, ...price },
  };
}

const LINK: MapLink = { activeId: null, setActiveId: vi.fn(), bind: () => ({}) as ReturnType<MapLink['bind']> };

function renderPane(cards: PublicStayCard[], nights: number | null = null) {
  return render(
    <MemoryRouter>
      <ResultsMapPane cards={cards} orgSlug="villa-rossi" nights={nights} stay={null} link={LINK} />
    </MemoryRouter>,
  );
}

const labels = () => (map.props?.pins ?? []).map((pin) => pin.label);

describe('ResultsMapPane pins', () => {
  beforeEach(async () => {
    map.props = null;
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('ResultsMapPane_HomesWithNoCurrency_HavePinsWithNoSymbolAndThePhraseThatSaysSo', () => {
    renderPane([card('a', ''), card('b', undefined, { perNightCents: 12050 })]);

    expect(screen.getByTestId('results-map')).toBeInTheDocument();
    expect(labels()).toEqual(['145 (valuta non disponibile)', '120,50 (valuta non disponibile)']);
    expect(labels().join(' ')).not.toMatch(/EUR|€/);
  });

  it('ResultsMapPane_StayChosenWithNoCurrency_SaysTheTotalOfTheStayTheSameWay', () => {
    renderPane([card('a', '', { totalCents: 43500 })], 3);

    expect(labels()).toEqual(['435 (valuta non disponibile)']);
  });

  it('ResultsMapPane_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderPane([card('a', '')]);

    expect(labels()).toEqual(['145 (currency not available)']);
  });

  it('ResultsMapPane_HomesOfTwoCurrencies_EachPinIsInTheCurrencyOfItsHome', () => {
    renderPane([card('a', 'EUR'), card('b', 'CHF')]);

    const [euro, franc] = labels();
    expect(euro).toContain('€');
    expect(franc).toContain('CHF');
    expect(franc).not.toContain('€');
    expect(labels().join(' ')).not.toContain('valuta non disponibile');
  });
});
