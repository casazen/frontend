import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { AppContextKey } from '@/config/route-manifest';

const support = vi.hoisted(() => ({ email: null as string | null }));

vi.mock('@/config/support.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/support.config')>();
  return {
    ...actual,
    supportConfig: {
      get email() {
        return support.email;
      },
    },
  };
});

import { ReservedPage } from '../reserved-page';

function renderPage(contextKey: AppContextKey, homePath: string, path = `${homePath}/payments`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ReservedPage contextKey={contextKey} homePath={homePath} />
    </MemoryRouter>,
  );
}

describe('ReservedPage (UI-03)', () => {
  beforeEach(async () => {
    support.email = null;
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('ReservedPage_Rendered_SaysThePageIsReservedWithTheTitleAsTheOnlyHeading', () => {
    renderPage('short-rent', '/app/short-rent');

    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Questa pagina è riservata' })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('appShell.reserved.description'))).toBeInTheDocument();
  });

  it.each<[AppContextKey, string, string]>([
    ['short-rent', '/app/short-rent', 'Torna a Oggi'],
    ['supplier', '/app/supplier/dashboard', 'Torna a Oggi'],
    ['long-rent', '/app/long-rent/leases', 'Torna alla Panoramica'],
    ['admin', '/app/admin', 'Torna alla Panoramica'],
  ])('ReservedPage_%s_OffersTheWayBackToItsHome', (contextKey, homePath, label) => {
    renderPage(contextKey, homePath);

    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', homePath);
  });

  it('ReservedPage_English_UsesTheEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    support.email = 'support@casazen.test';
    renderPage('long-rent', '/app/long-rent/leases');

    expect(screen.getByRole('heading', { level: 1, name: 'This page is restricted' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request access' })).toBeInTheDocument();
  });

  it('ReservedPage_SupportEmailConfigured_AsksForAccessByMailToThatAddressOnly', () => {
    support.email = 'assistenza@casazen.test';
    renderPage('short-rent', '/app/short-rent', '/app/short-rent/payments');

    const ask = screen.getByRole('link', { name: 'Chiedi l\'accesso' });
    const href = ask.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:assistenza@casazen.test?')).toBe(true);
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(params.get('subject')).toBe(i18n.t('appShell.reserved.mailSubject'));
    expect(params.get('body')).toContain('/app/short-rent/payments');
    expect(screen.queryByText(i18n.t('appShell.reserved.requestAccessGeneric'))).not.toBeInTheDocument();
  });

  it('ReservedPage_NoSupportEmail_InventsNoChannelAndPointsToWhoAdministersTheAccount', () => {
    renderPage('short-rent', '/app/short-rent');

    expect(screen.queryByRole('link', { name: 'Chiedi l\'accesso' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull();
    expect(screen.getByText(i18n.t('appShell.reserved.requestAccessGeneric'))).toBeInTheDocument();
  });

  it('ReservedPage_OnTheHomeItself_DoesNotOfferAWayBackToThisSamePage', () => {
    support.email = 'assistenza@casazen.test';
    renderPage('admin', '/app/admin', '/app/admin');

    expect(screen.queryByRole('link', { name: 'Torna alla Panoramica' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chiedi l\'accesso' })).toBeInTheDocument();
  });
});
