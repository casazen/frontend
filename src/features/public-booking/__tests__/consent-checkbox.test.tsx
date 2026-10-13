import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ConsentCheckbox } from '../components/consent-checkbox';

function renderConsent(onCheckedChange = vi.fn(), checked = false) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ConsentCheckbox checked={checked} onCheckedChange={onCheckedChange} orgSlug="villa-parco" />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return onCheckedChange;
}

describe('ConsentCheckbox (BK-14, A3-21)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('ConsentCheckbox_PrivacyAndTerms_LinkToTheOperatorPagesInANewTab', () => {
    renderConsent();

    const privacy = screen.getByTestId('consent-privacy-link');
    const terms = screen.getByTestId('consent-terms-link');
    expect(privacy).toHaveAttribute('href', '/book/villa-parco/privacy');
    expect(terms).toHaveAttribute('href', '/book/villa-parco/termini');
    for (const link of [privacy, terms]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(privacy).toHaveTextContent("informativa privacy dell'operatore");
  });

  it('ConsentCheckbox_LabelOfTheCheckbox_StillNamesTheConsent', () => {
    renderConsent();

    expect(screen.getByRole('checkbox', { name: /Acconsento al trattamento dei miei dati personali/ })).toBeInTheDocument();
  });

  it('ConsentCheckbox_Click_ReportsTheNewValue', () => {
    const onChange = renderConsent();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ConsentCheckbox_EnglishUi_UsesEnglishTextsAndTheSameLinks', async () => {
    await i18n.changeLanguage('en');
    renderConsent();

    expect(screen.getByTestId('consent-privacy-link')).toHaveTextContent('privacy notice');
    expect(screen.getByTestId('consent-terms-link')).toHaveTextContent('booking terms');
    expect(screen.getByTestId('consent-privacy-link')).toHaveAttribute('href', '/book/villa-parco/privacy');
  });
});
