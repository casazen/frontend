import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { AxiosError, type AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CrmApi } from '@/api/crm.api';
import type { CrmProfileDetail } from '@/types/crm.types';
import GuestDetail from '../GuestDetail';

vi.mock('@/api/crm.api', () => ({
  CrmApi: { getGuest: vi.fn(), setTags: vi.fn(), sendConfirmation: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const permissions = vi.hoisted(() => ({ canWrite: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permissions.canWrite || permission !== 'guest.write' }),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', { 'data-testid': 'header-description' }, description) : null, action),
}));

const PROFILE = '0b8f5d6e-1111-4a22-8333-aaaaaaaaaaa1';
const GUEST = '3c1d7e9a-5555-4666-8777-bbbbbbbbbbb1';

function detail(overrides: Partial<CrmProfileDetail> = {}): CrmProfileDetail {
  return {
    id: PROFILE,
    displayName: 'Mario Rossi',
    primaryGuestId: GUEST,
    country: 'IT',
    language: 'it',
    firstStayAt: '2025-06-10T00:00:00Z',
    lastStayAt: '2026-09-14T00:00:00Z',
    tags: ['vip'],
    stays: [
      {
        bookingId: 'b1',
        propertyId: 'p1',
        propertyName: 'Casa Mare',
        checkInDate: '2026-09-11T00:00:00Z',
        checkOutDate: '2026-09-14T00:00:00Z',
        nights: 3,
        channel: 'Airbnb',
        channelLabel: null,
        status: 'CheckedOut',
        total: 480,
        adults: 2,
        children: 0,
        advanceDays: 20,
      },
      {
        bookingId: 'b2',
        propertyId: 'p2',
        propertyName: 'Trullo Verde',
        checkInDate: '2025-06-10T00:00:00Z',
        checkOutDate: '2025-06-12T00:00:00Z',
        nights: 2,
        channel: 'OtherChannel',
        channelLabel: 'Hotels.com',
        status: 'Cancelled',
        total: 200,
        adults: 2,
        children: 1,
        advanceDays: null,
      },
    ],
    staysTruncated: false,
    totals: {
      stays: 3,
      spend: 1240,
      averageSpend: 413.33,
      averageAdvanceDays: 21.4,
      byChannel: [
        { channel: 'Airbnb', stays: 2, spend: 900 },
        { channel: 'Direct', stays: 1, spend: 340 },
      ],
      byProperty: [{ propertyId: 'p1', propertyName: 'Casa Mare', stays: 3 }],
      averageAdults: 2,
      averageChildren: 0.5,
      typicalGroup: 'Couple',
    },
    reviews: { count: 2, averageRating: 4.5, latest: [{ rating: 5, publishedAt: '2026-09-20T10:00:00Z' }, { rating: 4, publishedAt: '2025-06-20T10:00:00Z' }] },
    contacts: [
      {
        id: 'c-email',
        channel: 'Email',
        origin: 'DirectBooking',
        confirmation: 'Confirmed',
        legalBasis: 'Consent',
        basisVersion: '2026-10',
        basisRecordedAt: '2026-10-12T09:30:00Z',
        isSuppressed: false,
        isOtaForward: false,
        value: 'mario.rossi@example.it',
        marketable: true,
        reachabilityReason: null,
      },
    ],
    mergeProposalCount: 0,
    ...overrides,
  };
}

function problem(status: number, code?: string): AxiosError {
  const response = { status, statusText: String(status), data: code ? { code } : {}, headers: {}, config: {} } as unknown as AxiosResponse;
  return new AxiosError(code ?? 'error', String(status), undefined, undefined, response);
}

function renderDetail(id = PROFILE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/app/short-rent/crm/guests/${id}`]}>
          <Routes>
            <Route path="/app/short-rent/crm/guests/:id" element={<GuestDetail />} />
            <Route path="/app/short-rent/crm/guests" element={<p>list</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('GuestDetail: one CRM profile read by its id (E07/F01/US04/T02)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    permissions.canWrite = true;
    vi.mocked(CrmApi.getGuest).mockResolvedValue(detail());
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('GuestDetail_Opened_ReadsTheProfileByItsOwnIdSoAReloadWorks', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mario Rossi' })).toBeInTheDocument();
    expect(CrmApi.getGuest).toHaveBeenCalledWith(PROFILE);
    expect(screen.getByTestId('header-description')).toHaveTextContent('Ospite dal 10 giu 2025 · IT · Italiano');
    expect(screen.getByRole('link', { name: i18n.t('crm.detail.guestRecord') })).toHaveAttribute('href', `/app/short-rent/guests/${GUEST}`);
  });

  it('GuestDetail_Opened_ShowsTotalsGroupChannelsPropertiesAndReviews', async () => {
    renderDetail();
    await screen.findByTestId('crm-profile');

    const totals = within(screen.getByRole('group', { name: i18n.t('crm.detail.totals.label') }));
    expect(totals.getByText('3')).toBeInTheDocument();
    expect(totals.getByText(/1\.?240,00/)).toBeInTheDocument();
    expect(totals.getByText(/413,33/)).toBeInTheDocument();
    expect(totals.getByText('21 giorni di anticipo')).toBeInTheDocument();

    expect(within(screen.getByTestId('crm-group-section')).getByText(/in coppia/)).toBeInTheDocument();
    expect(within(screen.getByTestId('crm-group-section')).getByText(/In media 2 adulti e 0,5 bambini/)).toBeInTheDocument();

    const channels = within(screen.getByTestId('crm-channels-section'));
    expect(channels.getByText('Airbnb')).toBeInTheDocument();
    expect(channels.getByText(/2 soggiorni · .*900,00/)).toBeInTheDocument();
    expect(channels.getByText('Sito diretto')).toBeInTheDocument();

    expect(within(screen.getByTestId('crm-properties-section')).getByText('Casa Mare')).toBeInTheDocument();

    const reviews = within(screen.getByTestId('crm-reviews-section'));
    expect(reviews.getByText(/Voto medio 4,5 su 5/)).toBeInTheDocument();
    expect(reviews.getByText(/2 recensioni/)).toBeInTheDocument();
    expect(reviews.getByText('5 su 5')).toBeInTheDocument();
  });

  it('GuestDetail_TheHistory_ListsEachStayWithPropertyDatesChannelStatusAndAmount', async () => {
    renderDetail();

    const table = within(await screen.findByRole('table', { name: i18n.t('crm.detail.history.title') }));
    const first = within(table.getByText('Casa Mare').closest('tr')!);
    expect(first.getByText('3 notti')).toBeInTheDocument();
    expect(first.getByText('11 set 2026 – 14 set 2026')).toBeInTheDocument();
    expect(first.getByText('Airbnb')).toBeInTheDocument();
    expect(first.getByText('Check-out effettuato')).toBeInTheDocument();
    expect(first.getByText(/480,00/)).toBeInTheDocument();

    // A portal with no value of its own is named as the channel manager named it.
    const second = within(table.getByText('Trullo Verde').closest('tr')!);
    expect(second.getByText('Hotels.com')).toBeInTheDocument();
    expect(second.getByText('Annullata')).toBeInTheDocument();
  });

  it('GuestDetail_MoreStaysThanTheListHolds_SaysTheTotalsCountThemAll', async () => {
    vi.mocked(CrmApi.getGuest).mockResolvedValue(detail({ staysTruncated: true }));

    renderDetail();

    expect(await screen.findByTestId('crm-history-truncated')).toHaveTextContent('Mostriamo gli ultimi 2 soggiorni');
  });

  it('GuestDetail_Opened_NeverShowsNorAsksForAnythingOfTheAlloggiatiRegistration', async () => {
    renderDetail();
    await screen.findByTestId('crm-profile');

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/document|nascita|birth|passaporto|passport|accompagnatori|co-?guest/i);
    for (const control of screen.getAllByRole('textbox')) {
      expect(control.getAttribute('name') ?? '').not.toMatch(/document|birth|nascita/i);
    }
  });

  it('GuestDetail_AProfileOfAnotherOrgOrOutOfReach_IsNotFoundLikeAMissingOne', async () => {
    vi.mocked(CrmApi.getGuest).mockRejectedValue(problem(404, 'crm_profile_not_found'));

    renderDetail();

    expect(await screen.findByText(i18n.t('crm.detail.notFound.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('crm.detail.notFound.description'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('crm.detail.backToList') })).toHaveAttribute('href', '/app/short-rent/crm/guests');
    expect(screen.queryByTestId('crm-profile')).not.toBeInTheDocument();
  });

  it('GuestDetail_AServerError_IsNeverShownAsNotFoundAndCanBeRetried', async () => {
    vi.mocked(CrmApi.getGuest).mockRejectedValueOnce(problem(500)).mockResolvedValue(detail());

    renderDetail();

    expect(await screen.findByText(i18n.t('crm.detail.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('crm.detail.notFound.title'))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await screen.findByTestId('crm-profile')).toBeInTheDocument();
  });

  it('GuestDetail_ACallerWhoCannotWrite_ReadsTheProfileButChangesNothing', async () => {
    permissions.canWrite = false;
    vi.mocked(CrmApi.getGuest).mockResolvedValue(
      detail({
        mergeProposalCount: 1,
        contacts: [
          {
            id: 'c-email',
            channel: 'Email',
            origin: 'CheckIn',
            confirmation: 'Unconfirmed',
            legalBasis: 'Consent',
            basisVersion: '',
            basisRecordedAt: null,
            isSuppressed: false,
            isOtaForward: false,
            value: 'mario.rossi@example.it',
            marketable: false,
            reachabilityReason: 'not_confirmed',
          },
        ],
      }),
    );

    renderDetail();

    await screen.findByTestId('crm-profile');
    expect(screen.getByText('vip')).toBeInTheDocument();
    expect(screen.queryByTestId('crm-tags-form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('crm.tags.remove', { tag: 'vip' }) })).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-contact-send-confirmation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crm-profile-merge-note')).not.toBeInTheDocument();
  });

  it('GuestDetail_AMergeProposalWaiting_PointsToTheDuplicatesOfACallerWhoMayDecide', async () => {
    vi.mocked(CrmApi.getGuest).mockResolvedValue(detail({ mergeProposalCount: 2 }));

    renderDetail();

    const note = within(await screen.findByTestId('crm-profile-merge-note'));
    expect(note.getByText(/2 possibili duplicati/)).toBeInTheDocument();
    expect(note.getByRole('link', { name: i18n.t('crm.detail.mergeLink') })).toHaveAttribute('href', '/app/short-rent/crm/merge');
  });

  it('GuestDetail_ALeadWithNoNameAndNoGuestRecord_HasAFallbackTitleAndNoLink', async () => {
    vi.mocked(CrmApi.getGuest).mockResolvedValue(detail({ displayName: '', primaryGuestId: null, firstStayAt: null, lastStayAt: null, stays: [] }));

    renderDetail();

    expect(await screen.findByRole('heading', { level: 1, name: i18n.t('crm.detail.unnamed') })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: i18n.t('crm.detail.guestRecord') })).not.toBeInTheDocument();
    expect(screen.getByTestId('header-description')).toHaveTextContent(i18n.t('crm.detail.noStayYet'));
    await waitFor(() => expect(screen.getByText(i18n.t('crm.detail.history.empty.title'))).toBeInTheDocument());
  });
});
