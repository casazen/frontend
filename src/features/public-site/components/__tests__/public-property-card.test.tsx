import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { PublicPropertyDto } from '@/types';
import type { PropertyCardSections } from '@/features/public-site/lib/property-card-sections';
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

  it('PublicPropertyCard_HouseInSwissFrancs_ShowsThePriceInFrancsNotInEuros', () => {
    // CHF-MONEY: the price of a card is in the currency of its house (the euro when the backend does not say).
    const swiss = renderCard({ currency: 'CHF' });

    expect(within(swiss).getByTestId('public-property-card-price')).toHaveTextContent(/120,00/);
    expect(within(swiss).getByTestId('public-property-card-price')).toHaveTextContent(/CHF/);
    expect(within(swiss).getByTestId('public-property-card-price')).not.toHaveTextContent('€');
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

  it('PublicPropertyCard_NoDestination_HasNoLinkAndNoDetailsButton', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PublicPropertyCard property={property()} />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const card = screen.getByTestId('public-property-card');
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Casa del Faro');
    expect(card).not.toHaveTextContent(i18n.t('publicSite.card.details'));
  });

  it('PublicPropertyCard_InvalidCin_IsNotShownToGuests', () => {
    const card = renderCard({ cinStatus: 'Invalid', cinCode: 'XX' });

    expect(within(card).queryByTestId('public-cin')).not.toBeInTheDocument();
  });

  describe('rows of the grid', () => {
    function renderInGrid(overrides: Partial<PublicPropertyDto>, sections?: PropertyCardSections) {
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <PublicPropertyCard property={property(overrides)} to="/book/villa-mare/property/casa-del-faro" sections={sections} />
          </MemoryRouter>
        </I18nextProvider>,
      );
      return screen.getByTestId('public-property-card');
    }

    it('PublicPropertyCard_AllTheParts_HasOneRowForEach', () => {
      const card = renderInGrid({});

      // image, name, place, CIN, description, facts, price line
      expect(card.children).toHaveLength(7);
      expect(card.style.getPropertyValue('--card-rows')).toBe('7');
    });

    it('PublicPropertyCard_AloneWithoutSomeParts_HasNoEmptyRows', () => {
      const card = renderInGrid({ description: '', cinStatus: 'Missing', cinCode: null });

      expect(card.children).toHaveLength(5);
      expect(card.style.getPropertyValue('--card-rows')).toBe('5');
    });

    it('PublicPropertyCard_GridHasPartsThisCardLacks_KeepsTheirRowsEmpty', () => {
      const card = renderInGrid(
        { description: '', cinStatus: 'Missing', cinCode: null },
        { place: true, cin: true, description: true, facts: true },
      );

      // The same 7 rows as the card of a neighbour that has everything: the empty ones keep the others in their place.
      expect(card.children).toHaveLength(7);
      expect(card.style.getPropertyValue('--card-rows')).toBe('7');
      expect(within(card).queryByTestId('public-cin')).not.toBeInTheDocument();
      expect(within(card).getByTestId('public-property-card-facts')).toBeInTheDocument();
      expect(within(card).getByTestId('public-property-card-price')).toBeInTheDocument();
    });

    it('PublicPropertyCard_GridLacksPartsThatThisCardHasNotToo_LeavesThemOut', () => {
      const card = renderInGrid(
        { description: '', cinStatus: 'Missing', cinCode: null },
        { place: true, cin: false, description: false, facts: true },
      );

      expect(card.children).toHaveLength(5);
    });
  });
});
