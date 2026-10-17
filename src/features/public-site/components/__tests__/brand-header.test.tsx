import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { BrandHeader } from '../brand-header';

function renderHeader() {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrandHeader />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('BrandHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it('BrandHeader_PreviewOrLocalBuild_OffersTheWayInToTheApp', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '');

    renderHeader();

    expect(screen.getByRole('link', { name: i18n.t('site.nav.login') })).toHaveAttribute('href', '/login');
  });

  it('BrandHeader_ProductionBuild_HasNoWayInToTheAppButKeepsTheSearch', () => {
    // Only a production build has the public domain (src/config/login-entry.ts); the app is reached by its address there.
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://www.example.test');

    renderHeader();

    expect(screen.queryByRole('link', { name: i18n.t('site.nav.login') })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('publicSite.explore') })).toHaveAttribute('href', '/search');
  });
});
