import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { PublicPropertyDto } from '@/types';
import { PublicPropertyCard } from '../PublicPropertyCard';

function property(overrides: Partial<PublicPropertyDto> = {}): PublicPropertyDto {
  return {
    id: 'p-1',
    slug: 'casa-del-faro',
    name: 'Casa del Faro',
    description: 'Vista mare',
    city: 'Camogli',
    postalCode: '16032',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 120,
    cleaningFee: 30,
    amenities: [],
    photoUrls: [],
    cinCode: 'IT010009C2ABCDEFGH',
    cinStatus: 'Valid',
    timezone: 'Europe/Rome',
    ...overrides,
  };
}

function renderCard(overrides: Partial<PublicPropertyDto> = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <PublicPropertyCard property={property(overrides)} to="/book/villa-mare/property/casa-del-faro" />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return screen.getByTestId('public-property-card');
}

describe('PublicPropertyCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('PublicPropertyCard_CompleteProperty_ShowsNameLinkPlaceFactsAndPrice', () => {
    const card = renderCard();

    expect(within(card).getByRole('link', { name: 'Casa del Faro' })).toHaveAttribute(
      'href',
      '/book/villa-mare/property/casa-del-faro',
    );
    expect(card).toHaveTextContent('Camogli (16032)');
    expect(within(card).getByTestId('public-property-card-facts')).toHaveTextContent('4 ospiti');
    expect(within(card).getByTestId('public-property-card-facts')).toHaveTextContent('2 camere');
    expect(within(card).getByTestId('public-property-card-facts')).toHaveTextContent('1 bagno');
    expect(within(card).getByTestId('public-property-card-price')).toHaveTextContent(/120,00/);
    // The valid CIN is shown as plain information (guest-facing page).
    expect(within(card).getByTestId('public-cin')).toBeInTheDocument();
  });

  it('PublicPropertyCard_EnglishUi_PluralizesTheFacts', async () => {
    await i18n.changeLanguage('en');
    const card = renderCard({ maxGuests: 1, bedrooms: 1 });

    expect(within(card).getByTestId('public-property-card-facts')).toHaveTextContent('1 guest');
    expect(within(card).getByTestId('public-property-card-facts')).toHaveTextContent('1 bedroom');
    await i18n.changeLanguage('it');
  });

  it.each([
    ['NaN', Number.NaN],
    ['zero', 0],
    ['undefined', undefined],
  ])('PublicPropertyCard_NightlyRate_%s_HidesThePriceInsteadOfShowingNaN', (_label, nightlyRate) => {
    const card = renderCard({ nightlyRate: nightlyRate as unknown as number });

    expect(within(card).queryByTestId('public-property-card-price')).not.toBeInTheDocument();
    expect(card.textContent).not.toMatch(/NaN|undefined/);
  });

  it('PublicPropertyCard_MalformedCounts_AreLeftOutNotShownAsNaN', () => {
    const card = renderCard({
      bedrooms: Number.NaN,
      bathrooms: undefined as unknown as number,
      maxGuests: 0,
    });

    expect(within(card).queryByTestId('public-property-card-facts')).not.toBeInTheDocument();
    expect(card.textContent).not.toMatch(/NaN|undefined/);
  });

  it('PublicPropertyCard_NoPhoto_ShowsAPlaceholderNotABrokenImage', () => {
    const card = renderCard({ photoUrls: [] });

    expect(within(card).getByTestId('public-property-card-no-photo')).toBeInTheDocument();
    expect(card.querySelector('img')).toBeNull();
  });

  it('PublicPropertyCard_InvalidCin_IsNotShownToGuests', () => {
    const card = renderCard({ cinStatus: 'Invalid', cinCode: 'XX' });

    expect(within(card).queryByTestId('public-cin')).not.toBeInTheDocument();
  });
});
