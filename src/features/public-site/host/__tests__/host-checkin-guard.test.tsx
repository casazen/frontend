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

/**
 * NF-140: a domain never shows another agency's page under its name. The check-in link of a guest of ANOTHER agency, typed or followed on this domain, is «not found» here; the page of the link
 * of this agency is shown as it is. The guard and the page ask the same question with the same hook, so they share one request.
 */
const OWN = 'villa-rossi';

function context(overrides: Partial<PublicCheckInContextDto> = {}): PublicCheckInContextDto {
  return { completed: false, status: 'InCompilazione', propertyName: 'Casa Mare', privacyNoticeVersion: 'v3', ...overrides };
}

/** What the check-in page of the route does with the same hook: it asks for the context of the token and shows the name of the home. */
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
    // Nothing of the other agency's page is shown.
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
    expect(screen.queryByText('Casa Mare')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_ContextOfThisAgency_ShowsThePageAndAsksOnce', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeOrgSlug: OWN }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    // The guard and the page share the request: it is made once.
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
    // The agency of the link has no published privacy notice (or withdrew it): the answer carries no `privacyNoticeOrgSlug`, only the agency of the link. It used to open on this domain.
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined, orgSlug: 'another-agency' }));

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    // Nothing of the other agency's page is shown.
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
    expect(screen.queryByText('Casa Mare')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_CompletedLinkOfAnotherAgency_IsNotFound', async () => {
    // A link that is already completed answers with its status and the agency of the link only (no property, no guests, no privacy notice): that is enough to refuse it on this domain.
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo', orgSlug: 'another-agency' });

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    // Nothing of the other agency's page is shown.
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_OrgSlugOfThisAgencyAndNoPrivacyNotice_ShowsThePageAndAsksOnce', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined, orgSlug: OWN }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    // The guard and the page share the request: it is made once.
    expect(publicCheckinApi.getContext).toHaveBeenCalledTimes(1);
  });

  it('HostCheckInGuard_OrgSlugOfThisAgencyInAnotherCase_StillShowsThePage', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ privacyNoticeVersion: undefined, orgSlug: 'VILLA-Rossi' }));

    renderGuard();

    expect(await screen.findByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_OrgSlugAndPrivacyNoticeSlugDiffer_TheOrgSlugDecides', async () => {
    // `orgSlug` is read first and the slug of the privacy notice only as a fallback: when the two differ, `orgSlug` decides (here it names another agency, so the page is not shown).
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(context({ orgSlug: 'another-agency', privacyNoticeOrgSlug: OWN }));

    renderGuard();

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-page')).not.toBeInTheDocument();
  });

  it('HostCheckInGuard_ContextWithoutAnAgencySlug_LeavesThePageToDecide', async () => {
    // An answer that names no agency at all (a backend that does not send `orgSlug` yet, for a link with no privacy notice) leaves the page to decide what it shows, as it always did.
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
    // The old answer is kept by the query when a new read fails: it must not bring the page of the other agency back.
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
