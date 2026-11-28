import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { publicCheckinApi } from '@/api/checkin.api';
import i18n from '@/i18n/config';
import { setHostSite } from '@/lib/host-site';
import { useCheckInContext } from '@/queries/use-checkin';
import type { PublicCheckInContextDto } from '@/types/public-checkin.types';
import { HostCheckInGuard } from '../host-site-pages';

vi.mock('@/api/checkin.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/checkin.api')>();
  return { ...actual, publicCheckinApi: { ...actual.publicCheckinApi, getContext: vi.fn() } };
});

const OWN = 'villa-rossi';

function context(overrides: Partial<PublicCheckInContextDto> = {}): PublicCheckInContextDto {
  return { completed: false, status: 'InCompilazione', propertyName: 'Casa Mare', privacyNoticeVersion: 'v3', ...overrides };
}

function PageOfTheLink() {
  const { data } = useCheckInContext('tok-1');
  return <p data-testid="checkin-page">{data?.propertyName ?? 'loading'}</p>;
}

function renderGuard(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/checkin/tok-1']}>
        <Routes>
          <Route
            path="/checkin/:token"
            element={
              <HostCheckInGuard>
                <PageOfTheLink />
              </HostCheckInGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe('HostCheckInGuard (NF-140)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: OWN, displayName: 'Villa Rossi' });
    vi.mocked(publicCheckinApi.getContext).mockReset();
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
  });

  it("another org's check-in context is not found", async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeOrgSlug: 'another-agency' }));

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
    expect(screen.queryByText('Casa Mare')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_ContextOfThisAgency_ShowsThePageAndAsksOnce', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeOrgSlug: OWN }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    expect(publicCheckinApi.getContext).toHaveBeenCalledTimes(1);
    expect(publicCheckinApi.getContext).toHaveBeenCalledWith('tok-1');
  });

  it('HostCheckInGuard_SlugOfThisAgencyInAnotherCase_StillShowsThePage', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeOrgSlug: 'Villa-Rossi' }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_OrgSlugOfAnotherAgencyAndNoPrivacyNotice_IsNotFound', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined, orgSlug: 'another-agency' }));

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
    expect(screen.queryByText('Casa Mare')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_CompletedLinkOfAnotherAgency_IsNotFound', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo', orgSlug: 'another-agency' });

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_OrgSlugOfThisAgencyAndNoPrivacyNotice_ShowsThePageAndAsksOnce', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined, orgSlug: OWN }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    expect(publicCheckinApi.getContext).toHaveBeenCalledTimes(1);
  });

  it('HostCheckInGuard_OrgSlugOfThisAgencyInAnotherCase_StillShowsThePage', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined, orgSlug: 'VILLA-Rossi' }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_OrgSlugAndPrivacyNoticeSlugDiffer_TheOrgSlugDecides', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ orgSlug: 'another-agency', privacyNoticeOrgSlug: OWN }));

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_ContextWithoutAnAgencySlug_LeavesThePageToDecide', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_WhileTheContextLoads_ShowsThePageWhichShowsItsOwnLoadingState', () => {
    vi.mocked(publicCheckinApi.getContext).mockReturnValue(new Promise(() => undefined));

    renderGuard();

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_ContextFails_ShowsThePageWhichShowsItsOwnError', async () => {
    vi.mocked(publicCheckinApi.getContext).mockRejectedValue(new Error('network'));

    renderGuard();

    expect(await screen.findByText('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_AnAnswerOfAnotherAgencyInTheCache_StaysNotFoundWhateverALaterFailureSays', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['checkin', 'tok-1'], context({ privacyNoticeOrgSlug: 'another-agency' }));
    vi.mocked(publicCheckinApi.getContext).mockRejectedValue(new Error('network'));

    renderGuard(client);
    await client.refetchQueries({ queryKey: ['checkin', 'tok-1'] });

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_NoHostSite_IsNotFound', async () => {
    setHostSite(null);
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeOrgSlug: OWN }));

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
  });
});
