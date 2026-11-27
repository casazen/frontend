import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PublicStayCard } from '@/types/public-stays.types';
import { zonesOf } from '../home-model';
import { ZonesSection } from '../zones-section';

// The map draws SVG from data loaded on demand: the zones are the list next to it, and that is what these tests read.
vi.mock('@/features/site-maps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/site-maps')>();
  const { createElement } = await import('react');
  return { ...actual, RegionMap: () => createElement('div', { 'data-testid': 'region-map-stub' }) };
});

/**
 * CHF-MONEY, the zones of the home of the site: the lowest night of a zone is written in the currency the homes of the zone say (francs for Lugano), and
 * homes whose data says none leave the zone with none: its price is written with no symbol and the phrase that says so, never in a euro nobody said.
 */
function card(id: string, comune: string, currency: string | undefined, perNightCents = 14500): PublicStayCard {
  return {
    id,
    name: `Casa ${id}`,
    comune,
    latitude: 46.0,
    longitude: 8.95,
    photos: [],
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    amenities: [],
    tags: [],
    availability: { available: true },
    // `currency` is a required text in the answer of the server: what these tests give it is what a malformed answer would carry.
    price: { currency: currency as string, perNightCents },
  };
}

function renderZones(cards: PublicStayCard[]) {
  return render(
    <MemoryRouter>
      <ZonesSection zones={zonesOf(cards, [])} searchPath="/book/villa-rossi/search" />
    </MemoryRouter>,
  );
}

describe('the zones of the home', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('ZonesOf_HomesThatSayNoCurrency_LeaveTheZoneWithNoneAndNeverWithTheEuro', () => {
    const zones = zonesOf([card('a', 'Lugano', ''), card('b', 'Locarno', undefined)], []);

    expect(zones.map((zone) => zone.currency)).toEqual(['', undefined]);
    expect(zones.map((zone) => zone.currency)).not.toContain('EUR');
  });

  it('ZonesOf_HomesInFrancs_KeepTheFrancs', () => {
    expect(zonesOf([card('a', 'Lugano', 'CHF')], [])[0].currency).toBe('CHF');
  });

  it('ZonesSection_ZoneWithNoCurrency_WritesItsLowestNightWithNoSymbolAndThePhrase', () => {
    renderZones([card('a', 'Lugano', ''), card('b', 'Locarno', undefined, 12050)]);

    const [lugano, locarno] = screen.getAllByTestId('home-zone');
    expect(lugano).toHaveTextContent('145 (valuta non disponibile) / notte');
    expect(locarno).toHaveTextContent('120,50 (valuta non disponibile) / notte');
    expect(screen.getByTestId('home-zones')).not.toHaveTextContent(/EUR|€/);
  });

  it('ZonesSection_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderZones([card('a', 'Lugano', '')]);

    expect(screen.getByTestId('home-zone')).toHaveTextContent('145 (currency not available) / night');
  });

  it('ZonesSection_ZoneInFrancs_WritesFrancs', () => {
    renderZones([card('a', 'Lugano', 'CHF')]);

    expect(screen.getByTestId('home-zone')).toHaveTextContent('CHF');
    expect(screen.getByTestId('home-zone')).not.toHaveTextContent('€');
    expect(screen.getByTestId('home-zone')).not.toHaveTextContent('valuta non disponibile');
  });
});
