import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { usePublicOrg } from '@/queries/use-public-org';
import type { PublicOrgDto } from '@/types';
import { PublicSiteShell } from '../PublicSiteShell';

vi.mock('@/queries/use-public-org', () => ({ usePublicOrg: vi.fn() }));
vi.mock('@/hooks/use-custom-host-redirect', () => ({ useCustomHostRedirect: vi.fn() }));
vi.mock('@/components/shared/cookie-consent-banner', () => ({ CookieConsentBanner: () => null }));
vi.mock('@/features/public-site/components/Footer', () => ({ Footer: () => null }));

type PublicOrgResult = ReturnType<typeof usePublicOrg>;

function org(slug: string): PublicOrgDto {
  return { slug, displayName: 'Villa Mare', logoUrl: null, themeColor: null, contactEmail: null };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderAt(path: string) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<PublicSiteShell mode="org" />}>
            <Route path="*" element={<LocationProbe />} />
            <Route index element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PublicSiteShell canonical org slug (PL-04)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('PublicSiteShell_PreviousSlugOfTheOrg_RedirectsToTheCurrentSlugKeepingPathAndQuery', async () => {
    vi.mocked(usePublicOrg).mockReturnValue({
      data: org('villa-mare'),
      isLoading: false,
      isError: false,
    } as unknown as PublicOrgResult);

    renderAt('/book/org-abcd2345/booking/b-1?token=t1');

    expect(await screen.findByTestId('location')).toHaveTextContent('/book/villa-mare/booking/b-1?token=t1');
  });

  it('PublicSiteShell_CurrentSlug_StaysOnThePage', async () => {
    vi.mocked(usePublicOrg).mockReturnValue({
      data: org('villa-mare'),
      isLoading: false,
      isError: false,
    } as unknown as PublicOrgResult);

    renderAt('/book/villa-mare/my-bookings');

    expect(await screen.findByTestId('location')).toHaveTextContent('/book/villa-mare/my-bookings');
  });
});
