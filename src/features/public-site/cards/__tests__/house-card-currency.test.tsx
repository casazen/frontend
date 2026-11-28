import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PublicStayCard } from '@/types/public-stays.types';
import { HouseCard } from '../house-card';

function card(currency: string | undefined, price: Partial<PublicStayCard['price']> = {}): PublicStayCard {
  return {
    id: 'p-1',
    slug: 'casa-lago',
    name: 'Casa Lago',
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

function renderCard(home: PublicStayCard, nights: number | null = null) {
  return render(
    <MemoryRouter>
      <HouseCard card={home} nights={nights} />
    </MemoryRouter>,
  );
}

const NO_CURRENCY = [
  ['empty', ''],
  ['missing', undefined],
] as const;

describe('HouseCard price', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it.each(NO_CURRENCY)('HouseCard_NightPriceWithCurrency%s_WritesNoSymbolAndSaysTheCurrencyIsNotAvailable', (_name, currency) => {
    renderCard(card(currency));

    const price = screen.getByTestId('house-card-price');
    expect(price).toHaveTextContent('145 (valuta non disponibile)');
    expect(price).not.toHaveTextContent(/EUR|€/);
    expect(screen.getByTestId('house-card')).not.toHaveTextContent(/EUR|€/);
  });

  it.each(NO_CURRENCY)('HouseCard_TotalOfTheStayWithCurrency%s_WritesTheTotalAndTheNightWithTheSamePhrase', (_name, currency) => {
    renderCard(card(currency, { totalCents: 43500 }), 3);

    expect(screen.getByTestId('house-card-price')).toHaveTextContent('435 (valuta non disponibile)');
    expect(screen.getByTestId('house-card')).toHaveTextContent('145 (valuta non disponibile)');
    expect(screen.getByTestId('house-card')).not.toHaveTextContent(/EUR|€/);
  });

  it('HouseCard_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderCard(card(''));

    expect(screen.getByTestId('house-card-price')).toHaveTextContent('145 (currency not available)');
    expect(screen.getByTestId('house-card-price')).not.toHaveTextContent(/EUR|€/);
  });

  it('HouseCard_CurrencyOfTheHome_IsTheOneWritten', () => {
    const { unmount } = renderCard(card('CHF'));
    expect(screen.getByTestId('house-card-price')).toHaveTextContent('CHF');
    expect(screen.getByTestId('house-card-price')).not.toHaveTextContent('€');
    expect(screen.getByTestId('house-card-price')).not.toHaveTextContent('valuta non disponibile');
    unmount();

    renderCard(card('EUR'));
    expect(screen.getByTestId('house-card-price')).toHaveTextContent('€');
    expect(screen.getByTestId('house-card-price')).not.toHaveTextContent('valuta non disponibile');
  });
});
