import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { usePublicOrg } from '@/queries/use-public-org';
import { contrastRatio } from '@/lib/public-site-colors';
import type { PublicOrgDto } from '@/types';
import { PublicSiteShell } from '../PublicSiteShell';

vi.mock('@/queries/use-public-org', () => ({ usePublicOrg: vi.fn() }));
vi.mock('@/hooks/use-custom-host-redirect', () => ({ useCustomHostRedirect: vi.fn() }));
vi.mock('@/components/shared/cookie-consent-banner', () => ({ CookieConsentBanner: () => null }));
vi.mock('@/features/public-site/components/Footer', () => ({ Footer: () => null }));

type PublicOrgResult = ReturnType<typeof usePublicOrg>;

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  });
}

function mockOrg(result: Partial<PublicOrgResult>) {
  vi.mocked(usePublicOrg).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...result,
  } as unknown as PublicOrgResult);
}

function renderShell() {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/book/villa-mare']}>
        <Routes>
          <Route path="/book/:orgSlug" element={<PublicSiteShell mode="org" />}>
            <Route index element={<div data-testid="page" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

const org: PublicOrgDto = { slug: 'villa-mare', displayName: 'Villa Mare', logoUrl: null, themeColor: null, contactEmail: null };

describe('PublicSiteShell states and colors (BK-13)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    document.documentElement.removeAttribute('style');
  });

  it('PublicSiteShell_OrgRequestFailsWith500_ShowsRetryableErrorNotSiteNotFound', () => {
    const refetch = vi.fn();
    mockOrg({ isError: true, error: httpError(500), refetch });
    renderShell();

    expect(screen.getByTestId('public-org-error')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('publicBooking.orgNotFound'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('PublicSiteShell_OrgRequestFailsWithoutResponse_ShowsRetryableError', () => {
    mockOrg({ isError: true, error: new Error('Network Error') });
    renderShell();

    expect(screen.getByTestId('public-org-error')).toBeInTheDocument();
  });

  it('PublicSiteShell_Org404_ShowsSiteNotFound', () => {
    mockOrg({ isError: true, error: httpError(404) });
    renderShell();

    expect(screen.getByText(i18n.t('publicBooking.orgNotFound'))).toBeInTheDocument();
    expect(screen.queryByTestId('public-org-error')).not.toBeInTheDocument();
  });

  it('PublicSiteShell_Loading_ShowsAnAnnouncedSpinner', () => {
    mockOrg({ isLoading: true });
    renderShell();

    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('publicSite.loading'));
  });

  it('PublicSiteShell_LightHostColor_GetsDarkTextOnItAndAReadableTextVariant', () => {
    mockOrg({ data: { ...org, primaryColor: '#f4d03f', publicThemeId: 'mare' } });
    renderShell();

    const style = screen.getByTestId('public-site-shell').style;
    const onPrimary = style.getPropertyValue('--cz-public-on-primary');
    const primaryText = style.getPropertyValue('--cz-public-primary-text');
    expect(style.getPropertyValue('--cz-public-primary')).toBe('#f4d03f');
    expect(contrastRatio(onPrimary, '#f4d03f')).toBeGreaterThanOrEqual(4.5);
    // The variant of the primary used as text/focus ring must be readable on the mare background and cards.
    expect(contrastRatio(primaryText, '#f6f1e7')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(primaryText, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('PublicSiteShell_HostColor_IsAlsoOnTheDocumentForPortalsAndRemovedOnUnmount', () => {
    mockOrg({ data: { ...org, primaryColor: '#1a6b8f' } });
    renderShell();

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--cz-public-primary')).toBe('#1a6b8f');
    expect(root.getPropertyValue('--cz-public-on-primary')).toBe('#ffffff');
    expect(root.getPropertyValue('--cz-public-primary-text')).toBe('#1a6b8f');

    cleanup();
    expect(root.getPropertyValue('--cz-public-primary')).toBe('');
    expect(root.getPropertyValue('--cz-public-on-primary')).toBe('');
  });

  it('PublicSiteShell_NoHostColor_LeavesTheThemeTokensUntouched', () => {
    mockOrg({ data: { ...org, publicThemeId: 'urban' } });
    renderShell();

    const shell = screen.getByTestId('public-site-shell');
    expect(shell).toHaveAttribute('data-theme', 'urban');
    expect(shell.style.getPropertyValue('--cz-public-on-primary')).toBe('');
    expect(shell.style.getPropertyValue('--cz-public-primary-text')).toBe('');
  });
});
