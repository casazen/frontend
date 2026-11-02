import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { usePublicOrg } from '@/queries/use-public-org';
import type { PublicOrgDto } from '@/types';
import { PublicSiteShell } from '../PublicSiteShell';

vi.mock('@/queries/use-public-org', () => ({ usePublicOrg: vi.fn(), useOrgProperties: () => ({ data: undefined }) }));
vi.mock('@/components/shared/cookie-consent-banner', () => ({ CookieConsentBanner: () => null }));
vi.mock('@/features/public-site/components/Footer', () => ({ Footer: () => null }));

type PublicOrgResult = ReturnType<typeof usePublicOrg>;

function renderWith(org: Partial<PublicOrgDto>) {
  vi.mocked(usePublicOrg).mockReturnValue({
    data: { slug: 'villa-mare', displayName: 'Villa Mare', logoUrl: null, themeColor: null, contactEmail: null, ...org },
    isLoading: false,
    isError: false,
  } as unknown as PublicOrgResult);
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/book/villa-mare']}>
        <Routes>
          <Route path="/book/:orgSlug" element={<PublicSiteShell mode="org" />}>
            <Route index element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
  return screen.getByTestId('public-site-shell');
}

// BK-12 (A3-17): the org's color must win over the theme tokens declared on the same element.
describe('PublicSiteShell branding', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('PublicSiteShell_OrgPrimaryColor_IsSetOnTheThemedRoot', () => {
    const root = renderWith({ primaryColor: '#1A6B8F', publicThemeId: 'citta' });

    expect(root).toHaveAttribute('data-theme', 'citta');
    expect(root.style.getPropertyValue('--cz-public-primary')).toBe('#1a6b8f');
    // The three colors derived from it travel with it (DB-01).
    expect(root.style.getPropertyValue('--cz-public-hover')).toMatch(/^#[0-9a-f]{6}$/);
    expect(root.style.getPropertyValue('--cz-public-ink')).toMatch(/^#[0-9a-f]{6}$/);
    expect(root.style.getPropertyValue('--cz-public-soft')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('PublicSiteShell_HostFontPair_IsSetAsDataFontAndAnUnknownOneIsIgnored', () => {
    expect(renderWith({ publicFontId: 'classico' })).toHaveAttribute('data-font', 'classico');
    cleanup();

    expect(renderWith({ publicFontId: 'comic-sans' })).not.toHaveAttribute('data-font');
    cleanup();

    expect(renderWith({ publicFontId: null })).not.toHaveAttribute('data-font');
  });

  it.each([
    ['montagna', 'terra'],
    ['urban', 'citta'],
  ])('PublicSiteShell_ThemeIdFromBeforeDB01_%s_IsReadAs_%s', (stored, expected) => {
    expect(renderWith({ publicThemeId: stored })).toHaveAttribute('data-theme', expected);
  });

  it('PublicSiteShell_OnlyLegacyThemeColor_IsStillApplied', () => {
    const root = renderWith({ themeColor: '#2563eb' });

    expect(root.style.getPropertyValue('--cz-public-primary')).toBe('#2563eb');
  });

  it('PublicSiteShell_NoColorAndUnknownTheme_UsesDefaultThemeTokens', () => {
    const root = renderWith({ publicThemeId: 'collina' });

    expect(root).toHaveAttribute('data-theme', 'terra');
    expect(root.style.getPropertyValue('--cz-public-primary')).toBe('');
  });

  it('PublicSiteShell_ColorThatIsNotHex_IsIgnored', () => {
    const root = renderWith({ primaryColor: 'red;background:url(x)' });

    expect(root.style.getPropertyValue('--cz-public-primary')).toBe('');
  });
});
