import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { rememberList } from '@/lib/list-return';
import { BackLink } from '../back-link';

function renderLink(to = '/app/short-rent/bookings') {
  return render(
    <MemoryRouter>
      <BackLink to={to} label="Prenotazioni" />
    </MemoryRouter>,
  );
}

describe('BackLink (UI-05)', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('BackLink_Rendered_ReadsAsAnArrowAndTheNameOfThePageAbove', () => {
    renderLink();

    const link = screen.getByRole('link', { name: 'Torna a Prenotazioni' });
    expect(link).toHaveAttribute('href', '/app/short-rent/bookings');
    // What a sighted user reads is part of the accessible name (label in name).
    expect(link).toHaveTextContent('Prenotazioni');
  });

  it('BackLink_EnglishUi_SaysBackTo', async () => {
    await i18n.changeLanguage('en');
    renderLink();

    expect(screen.getByRole('link', { name: 'Back to Prenotazioni' })).toBeInTheDocument();
  });

  it('BackLink_IsForAPhone_AndAFingerCanHitIt', () => {
    renderLink();

    const link = screen.getByTestId('back-link');
    // The breadcrumb takes its place from `md`.
    expect(link).toHaveClass('md:hidden');
    expect(link).toHaveClass('min-h-11');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('BackLink_ListLeftWithFilters_LeadsBackToTheListAsItWasLeft', () => {
    rememberList('/app/short-rent/bookings', '?status=Confirmed&q=rossi');
    renderLink();

    expect(screen.getByRole('link', { name: 'Torna a Prenotazioni' })).toHaveAttribute(
      'href',
      '/app/short-rent/bookings?status=Confirmed&q=rossi',
    );
  });

  it('BackLink_PageThatIsNotARememberedList_LeadsToItsPlainAddress', () => {
    rememberList('/app/short-rent/bookings', '?status=Confirmed');
    renderLink('/app/short-rent/properties');

    expect(screen.getByRole('link', { name: 'Torna a Prenotazioni' })).toHaveAttribute('href', '/app/short-rent/properties');
  });
});
