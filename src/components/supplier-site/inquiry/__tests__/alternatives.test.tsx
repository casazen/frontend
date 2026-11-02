import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PublicAlternative } from '@/api/public-supplier-booking.api';
import { Alternatives } from '../alternatives';

/**
 * «Altri professionisti per te» (SP-10c, SP-12c): what the server offers to a customer whose supplier did not answer. It shows the
 * showcase of each (the link is the only way on), never a contact, and says plainly when there is nobody to suggest, with no promise.
 */
const rossi: PublicAlternative = {
  name: 'Rossi Servizi',
  slug: 'rossi-servizi',
  verified: true,
  medianResponseMinutes: 40,
  service: { slug: 'pulizia-vetri', name: 'Pulizia vetri', fromPriceCents: 4500, priceUnit: 'PerHour', requiresQuote: false },
};
const bianchi: PublicAlternative = { name: 'Bianchi Pulizie', slug: 'bianchi-pulizie', verified: false };

function renderList(alternatives: PublicAlternative[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Alternatives alternatives={alternatives} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => cleanup());

describe('the other professionals offered to the customer', () => {
  it('Alternatives_EachCardLinksToTheShowcase_AndSaysOnlyWhatTheServerGave', () => {
    const { container } = renderList([rossi, bianchi]);

    expect(screen.getByRole('link', { name: 'Rossi Servizi' })).toHaveAttribute('href', '/fornitori/rossi-servizi');
    expect(screen.getByRole('link', { name: 'Bianchi Pulizie' })).toHaveAttribute('href', '/fornitori/bianchi-pulizie');
    // «Verificato» only for the one the server says is; the typical time only where it was measured.
    expect(screen.getAllByText('Verificato')).toHaveLength(1);
    expect(screen.getAllByText(/Di solito risponde in circa/)).toHaveLength(1);
    // No way to reach anybody outside CasaZen.
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  });

  it('Alternatives_NobodyToSuggest_SaysSoPlainlyAndPromisesNothing', () => {
    renderList([]);

    const none = screen.getByTestId('supplier-request-alternatives-none');
    expect(none).toHaveTextContent('Per ora non abbiamo altri professionisti');
    expect(none.textContent ?? '').not.toMatch(/ti richiam|ti contatt|ti chiam/i);
  });

  it('Alternatives_MoreThanThree_ShowsTheFirstThree', () => {
    const many = ['a', 'b', 'c', 'd'].map((slug): PublicAlternative => ({ name: `Pro ${slug}`, slug: `pro-${slug}`, verified: false }));

    renderList(many);

    expect(screen.getAllByRole('link')).toHaveLength(3);
  });
});
