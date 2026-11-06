import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { MarketplaceCatalogEntry } from '@/types';
import { PartnerCard } from '../partner-card';

// Made up, as the real partners are entered by the administrator and written nowhere in the code.
const PARTNER: MarketplaceCatalogEntry = {
  kind: 'Partner',
  code: 'test-cleaning',
  name: 'TEST Cleaning',
  logoUrl: null,
  benefit: 'Cleaning for short stays.',
  cost: { text: null, invoicedBy: 'Unknown' },
  status: 'NotActive',
  statusScope: 'Org',
  canActivate: true,
  reason: null,
  job: 'Cleaning',
  websiteUrl: 'https://example.com/',
  serviceCategories: ['cleaning', 'maintenance'],
  octoratePortalCode: null,
};

function renderCard(partner: MarketplaceCatalogEntry) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ul>
        <PartnerCard partner={partner} />
      </ul>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('PartnerCard (a partner of the catalog)', () => {
  it('PartnerCard_Partner_ShowsItsNameWhatItDoesAndTheServicesItWorksFor', () => {
    renderCard(PARTNER);

    const card = screen.getByTestId('marketplace-partner-test-cleaning');
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('TEST Cleaning');
    // The line under the name is the benefit the catalog gives, in the language of the interface; nothing is written in the card.
    expect(card).toHaveTextContent('Cleaning for short stays.');
    expect(card).toHaveTextContent('Pulizie');
    expect(card).toHaveTextContent('Manutenzione');
  });

  it('PartnerCard_Site_OpensItsOwnSiteInANewTabAndNothingOfTheHostGoesAlong', () => {
    renderCard(PARTNER);

    const link = screen.getByTestId('marketplace-partner-test-cleaning-link');
    expect(link).toHaveAttribute('href', 'https://example.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    // The address is the one of the catalog as it is: no parameter, no fragment, nothing about the host or its guests.
    expect(link.getAttribute('href')).not.toMatch(/[?#]/);
    expect(link).toHaveAccessibleName('Scopri TEST Cleaning (si apre in una nuova scheda)');
  });

  it.each(['http://example.com/', 'javascript:alert(1)', 'data:text/html,hello', '//example.com/', 'example.com', '', null, undefined])(
    'PartnerCard_Site_%j_IsNotOfferedBecauseItIsNotAnHttpsAddress',
    (websiteUrl) => {
      renderCard({ ...PARTNER, websiteUrl });

      expect(screen.getByTestId('marketplace-partner-test-cleaning')).toBeInTheDocument();
      expect(screen.queryByTestId('marketplace-partner-test-cleaning-link')).not.toBeInTheDocument();
    },
  );

  it('PartnerCard_NoServices_ShowsNoBadgesAndNoBenefitLineWhenThereIsNone', () => {
    renderCard({ ...PARTNER, serviceCategories: null, benefit: '' });

    const card = screen.getByTestId('marketplace-partner-test-cleaning');
    expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    expect(card.querySelectorAll('p')).toHaveLength(0);
  });
});
