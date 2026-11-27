import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { romeWallTimeToUtc } from '@/lib/stay-dates';
import type { ServiceRequest, ServiceRequestHistoryEntry } from '@/types/service-request';
import { ServiceRequestTimeline } from '../service-request-timeline';

const api = vi.hoisted(() => ({
  markServiceRequestPaid: vi.fn(),
  markLongRentServiceRequestPaid: vi.fn(),
  createServiceRequest: vi.fn(),
  createLongRentServiceRequest: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  fetchLongRentSuppliers: vi.fn(),
  fetchServiceCategories: vi.fn(),
  getBookings: vi.fn(),
}));

// The drawer of the app is on the shell, not in this list: its door is a mock, to see when the list uses it.
const drawer = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(), current: null }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/shared/detail-drawer/use-detail-drawer', () => ({ useDetailDrawer: () => drawer }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/api/service-requests.api', () => ({
  markServiceRequestPaid: api.markServiceRequestPaid,
  markLongRentServiceRequestPaid: api.markLongRentServiceRequestPaid,
  createServiceRequest: api.createServiceRequest,
  createLongRentServiceRequest: api.createLongRentServiceRequest,
  fetchSuppliersByProperty: api.fetchSuppliersByProperty,
  fetchLongRentSuppliers: api.fetchLongRentSuppliers,
}));
vi.mock('@/api/bookings.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/bookings.api')>();
  return { ...actual, bookingsApi: { ...actual.bookingsApi, getAll: api.getBookings } };
});

const STEP = {
  requested: { status: 'Richiesto', at: '2026-09-20T08:00:00Z', actor: 'Host' },
  // 23:30 UTC of 24 September is 01:30 of 25 September in Rome.
  taken: { status: 'PresoInCarico', at: '2026-09-24T23:30:00Z', actor: 'Supplier' },
  completed: { status: 'Completato', at: '2026-09-26T10:15:00Z', actor: 'Supplier' },
  paid: { status: 'Pagato', at: '2026-09-27T09:00:00Z', actor: 'Host' },
} satisfies Record<string, ServiceRequestHistoryEntry>;

const BASE: ServiceRequest = {
  id: 'sr-1',
  orgId: 'org-1',
  bookingId: 'b-1',
  rentalContext: 'ShortRent',
  propertyId: 'prop-1',
  propertyName: 'Villa Rosa',
  supplierOrgId: 'sup-1',
  supplierName: 'Pulizie Express Srl',
  category: 'cleaning',
  urgency: 'Normal',
  notes: 'Chiavi in portineria',
  status: 'Richiesto',
  chargeToGuest: false,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  history: [STEP.requested],
};

const COMPLETED: ServiceRequest = {
  ...BASE,
  status: 'Completato',
  takenAt: STEP.taken.at,
  completedAt: STEP.completed.at,
  history: [STEP.requested, STEP.taken, STEP.completed],
};

const PAID: ServiceRequest = { ...COMPLETED, status: 'Pagato', paidAt: STEP.paid.at, history: [...COMPLETED.history!, STEP.paid] };

const REJECTED: ServiceRequest = {
  ...BASE,
  id: 'sr-rejected',
  status: 'Rifiutato',
  rejectionReason: 'Siamo chiusi per ferie',
  updatedAt: '2026-09-21T10:00:00Z',
  history: [
    STEP.requested,
    { status: 'Rifiutato', at: '2026-09-21T10:00:00Z', actor: 'Supplier', reason: 'Siamo chiusi per ferie' },
  ],
};

/** A request cancelled by `actor` on the day `day` of October (the ones of an automatic test run, or of a host who changed its mind). */
function cancelled(id: string, day: number, actor: 'Host' | 'Supplier' | 'System' = 'Supplier', reason: string | null = 'E2E cleanup'): ServiceRequest {
  const at = `2026-10-${String(day).padStart(2, '0')}T18:21:46Z`;
  return {
    ...BASE,
    id,
    status: 'Annullato',
    cancelledAt: at,
    cancelledBy: actor,
    cancellationReason: reason,
    updatedAt: at,
    history: [STEP.requested, { status: 'Annullato', at, actor, reason }],
  };
}

const SUPPLIERS = {
  items: [
    { orgId: 'sup-1', legalName: 'Pulizie Express Srl', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
    { orgId: 'sup-2', legalName: 'Pulizie Rapide Snc', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 2,
};

/** Where the router is: a click on the name of a request either goes to its page or leaves the address as it was (the drawer opens). */
function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderTimeline(props: Partial<React.ComponentProps<typeof ServiceRequestTimeline>> & { requests: ServiceRequest[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ServiceRequestTimeline {...props} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function problem(status: number, code: string, detail: string) {
  return Object.assign(new Error(detail), { isAxiosError: true, response: { status, data: { code, detail } } });
}

/** The closed requests are kept out of the way: this opens (or closes) them. */
function toggleClosed() {
  fireEvent.click(screen.getByTestId('service-requests-closed-toggle'));
}

describe('ServiceRequestTimeline (SU-09, A4-28)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    drawer.open.mockReturnValue(false);
    api.markServiceRequestPaid.mockResolvedValue({ ...PAID });
    api.markLongRentServiceRequestPaid.mockResolvedValue({ ...PAID });
    api.fetchSuppliersByProperty.mockResolvedValue(SUPPLIERS);
    api.fetchLongRentSuppliers.mockResolvedValue(SUPPLIERS);
    api.fetchServiceCategories.mockResolvedValue(['cleaning', 'plumbing']);
    api.createServiceRequest.mockResolvedValue({ ...BASE, id: 'sr-new', supplierOrgId: 'sup-2' });
    api.createLongRentServiceRequest.mockResolvedValue({ ...BASE, id: 'sr-new', supplierOrgId: 'sup-2' });
    api.getBookings.mockResolvedValue([]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── The requests to follow are the list; the ones that are over are behind a button ───

  it('ServiceRequestTimeline_OpenAndOverRequests_ListsTheOpenOnesAndKeepsTheOthersBehindAButton', () => {
    renderTimeline({ requests: [PAID, BASE, cancelled('sr-old', 3)] });

    expect(within(screen.getByTestId('service-requests-to-follow')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('service-request-sr-1')).toBeInTheDocument();
    expect(screen.queryByTestId('service-requests-closed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-request-sr-old')).not.toBeInTheDocument();
    expect(screen.getByTestId('service-requests-closed-toggle')).toHaveTextContent('Mostra le 2 richieste concluse');
    expect(screen.getByTestId('service-requests-closed-toggle')).toHaveAttribute('aria-expanded', 'false');

    toggleClosed();

    expect(screen.getByTestId('service-requests-closed-toggle')).toHaveTextContent('Nascondi le richieste concluse');
    expect(screen.getByTestId('service-requests-closed-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByTestId('service-requests-closed')).getAllByRole('listitem')).toHaveLength(2);

    toggleClosed();

    expect(screen.queryByTestId('service-requests-closed')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_OnlyOverRequests_SaysNothingIsToFollowAndOffersThem', () => {
    renderTimeline({ requests: [cancelled('sr-old', 3)] });

    expect(screen.getByTestId('service-requests-none-to-follow')).toHaveTextContent('Nessuna richiesta da seguire.');
    expect(screen.getByTestId('service-requests-closed-toggle')).toHaveTextContent('Mostra la richiesta conclusa');
    expect(screen.queryByTestId('service-requests-to-follow')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_OnlyOpenRequests_HasNoButtonForTheClosedOnes', () => {
    renderTimeline({ requests: [BASE] });

    expect(screen.queryByTestId('service-requests-closed-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-requests-none-to-follow')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_ManyClosedRequests_AreShownFiveAtATimeLatestFirst', () => {
    const many = Array.from({ length: 17 }, (_, index) => cancelled(`sr-c${index + 1}`, index + 1));
    renderTimeline({ requests: [BASE, ...many] });

    expect(screen.getByTestId('service-requests-closed-toggle')).toHaveTextContent('Mostra le 17 richieste concluse');
    toggleClosed();

    const shown = () => within(screen.getByTestId('service-requests-closed')).getAllByRole('listitem');
    expect(shown()).toHaveLength(5);
    // The one closed last (the 17th of the month) comes first.
    expect(shown()[0]).toHaveAttribute('data-testid', 'service-request-sr-c17');
    expect(shown()[4]).toHaveAttribute('data-testid', 'service-request-sr-c13');
    expect(screen.getByTestId('service-requests-closed-more')).toHaveTextContent('Mostra altre 10');

    fireEvent.click(screen.getByTestId('service-requests-closed-more'));

    expect(shown()).toHaveLength(15);
    expect(screen.getByTestId('service-requests-closed-more')).toHaveTextContent('Mostra altre 2');

    fireEvent.click(screen.getByTestId('service-requests-closed-more'));

    expect(shown()).toHaveLength(17);
    expect(screen.queryByTestId('service-requests-closed-more')).not.toBeInTheDocument();

    // Hidden and opened again, it starts from five.
    toggleClosed();
    toggleClosed();
    expect(shown()).toHaveLength(5);
  });

  it('ServiceRequestTimeline_ToFollow_NearestJobFirst', () => {
    const later: ServiceRequest = { ...BASE, id: 'sr-later', scheduledStart: '2026-10-20T10:00:00Z', scheduledEnd: '2026-10-20T12:00:00Z' };
    const sooner: ServiceRequest = { ...BASE, id: 'sr-sooner', scheduledStart: '2026-10-05T10:00:00Z', scheduledEnd: '2026-10-05T12:00:00Z' };
    renderTimeline({ requests: [later, sooner] });

    const rows = within(screen.getByTestId('service-requests-to-follow')).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(['service-request-sr-sooner', 'service-request-sr-later']);
  });

  // ─── What a row says ───

  it('ServiceRequestTimeline_RequestWithATime_SaysTheDayTheHoursAndTheSupplier', () => {
    const timed: ServiceRequest = { ...BASE, scheduledStart: '2026-10-05T08:00:00Z', scheduledEnd: '2026-10-05T10:00:00Z' };
    renderTimeline({ requests: [timed] });

    const row = screen.getByTestId('service-request-sr-1');
    expect(row).toHaveTextContent('Pulizie');
    expect(row).toHaveTextContent('Pulizie Express Srl');
    expect(row).toHaveTextContent('5 ott');
    // 08:00Z and 10:00Z are 10:00 and 12:00 in Rome, two hours.
    expect(row).toHaveTextContent('10:00–12:00');
    expect(row).toHaveTextContent('Richiesto');
  });

  it('ServiceRequestTimeline_RequestWithoutATime_SaysItIsToBeAgreed', () => {
    renderTimeline({ requests: [BASE] });

    expect(screen.getByTestId('service-request-sr-1')).toHaveTextContent('Orario da concordare');
  });

  it('ServiceRequestTimeline_RequestOfACatalogService_IsNamedByTheService', () => {
    renderTimeline({ requests: [{ ...BASE, serviceName: 'Pulizia di fine soggiorno' }] });

    expect(screen.getByTestId('service-request-open-sr-1')).toHaveTextContent('Pulizia di fine soggiorno');
  });

  it('ServiceRequestTimeline_PaidRequest_SaysWhoPaidAndWhenInRome', () => {
    renderTimeline({ requests: [PAID] });
    toggleClosed();

    const row = screen.getByTestId('service-request-sr-1');
    expect(row).toHaveTextContent('Pagato');
    expect(row).toHaveTextContent('Da te');
    // 09:00 UTC of 27 September is 11:00 in Rome.
    expect(row).toHaveTextContent('27 set');
    expect(row).toHaveTextContent('11:00');
    // Nothing left to wait for once it is paid.
    expect(screen.queryByTestId('service-request-waiting-sr-1')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_StepOfAnotherYear_SaysTheYear', () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    const { unmount } = renderTimeline({ requests: [PAID] });
    toggleClosed();
    expect(screen.getByTestId('service-request-sr-1')).not.toHaveTextContent('2026');
    unmount();

    vi.setSystemTime(new Date('2027-01-15T10:00:00Z'));
    renderTimeline({ requests: [PAID] });
    toggleClosed();
    expect(screen.getByTestId('service-request-sr-1')).toHaveTextContent('27 set 2026');
  });

  it.each([
    ['Richiesto', BASE, 'In attesa che il fornitore accetti o rifiuti.'],
    ['PresoInCarico', { ...BASE, status: 'PresoInCarico' as const, history: [STEP.requested, STEP.taken] }, 'In attesa che il fornitore completi il lavoro.'],
    ['Completato', COMPLETED, 'Lavoro completato: segna pagato quando hai pagato il fornitore.'],
  ])('ServiceRequestTimeline_%sRequest_SaysWhatItWaitsFor', (_status, request, hint) => {
    renderTimeline({ requests: [request] });

    expect(screen.getByTestId('service-request-waiting-sr-1')).toHaveTextContent(hint);
  });

  it('ServiceRequestTimeline_RejectedRequest_ShowsTheReasonAndWhoRefusedWhen', () => {
    renderTimeline({ requests: [REJECTED] });

    const row = screen.getByTestId('service-request-sr-rejected');
    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toHaveTextContent('Motivo del rifiuto: Siamo chiusi per ferie');
    expect(row).toHaveTextContent('Rifiutato');
    expect(row).toHaveTextContent('Dal fornitore');
    expect(row).toHaveTextContent('21 set');
    expect(screen.queryByTestId('service-request-waiting-sr-rejected')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_RejectedWithoutReason_SaysTheSupplierGaveNone', () => {
    const noReason: ServiceRequest = {
      ...REJECTED,
      rejectionReason: null,
      history: [STEP.requested, { status: 'Rifiutato', at: '2026-09-21T10:00:00Z', actor: 'Supplier', reason: null }],
    };
    renderTimeline({ requests: [noReason] });

    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toHaveTextContent('Il fornitore non ha indicato un motivo.');
  });

  it.each([
    ['Host', 'Da te'],
    ['Supplier', 'Dal fornitore'],
    ['System', 'Da CasaZen, in automatico'],
  ] as const)('ServiceRequestTimeline_CancelledBy%s_Says%s', (actor, by) => {
    renderTimeline({ requests: [cancelled('sr-c', 3, actor)] });
    toggleClosed();

    const row = screen.getByTestId('service-request-sr-c');
    expect(row).toHaveTextContent('Annullato');
    expect(row).toHaveTextContent(by);
    expect(row).toHaveTextContent('3 ott');
    expect(row).toHaveTextContent('Motivo: E2E cleanup');
  });

  it('ServiceRequestTimeline_CancelledForNoAnswer_SaysItInWordsAndNotTheCode', () => {
    renderTimeline({ requests: [cancelled('sr-c', 3, 'System', 'NoResponse')] });
    toggleClosed();

    expect(screen.getByTestId('service-request-cancellation-sr-c')).toHaveTextContent('Motivo: Il fornitore non ha risposto in tempo.');
    expect(screen.getByTestId('service-request-sr-c')).not.toHaveTextContent('NoResponse');
  });

  it('ServiceRequestTimeline_CancelledWithoutReason_SaysNoReason', () => {
    renderTimeline({ requests: [cancelled('sr-c', 3, 'Host', null)] });
    toggleClosed();

    expect(screen.queryByTestId('service-request-cancellation-sr-c')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_RequestWithoutHistory_StillShowsItsStatus', () => {
    renderTimeline({ requests: [{ ...BASE, history: undefined }] });

    expect(screen.getByTestId('service-request-sr-1')).toHaveTextContent('Richiesto');
  });

  it('ServiceRequestTimeline_CancelledWithoutHistory_UsesTheDatesTheRequestKeeps', () => {
    renderTimeline({ requests: [{ ...cancelled('sr-c', 3, 'Host'), history: undefined }] });
    toggleClosed();

    expect(screen.getByTestId('service-request-sr-c')).toHaveTextContent('Da te');
    expect(screen.getByTestId('service-request-sr-c')).toHaveTextContent('3 ott');
  });

  it('ServiceRequestTimeline_NoSupplierName_ShowsTheNameOfTheJobOnly', () => {
    renderTimeline({ requests: [{ ...COMPLETED, supplierName: null }] });

    expect(screen.getByTestId('service-request-open-sr-1')).toHaveTextContent(/^Pulizie\s*Orario da concordare$/);
  });

  it('ServiceRequestTimeline_English_ShowsTranslatedRows', async () => {
    await i18n.changeLanguage('en');
    renderTimeline({ requests: [REJECTED] });

    expect(screen.getByTestId('service-request-sr-rejected')).toHaveTextContent('By the supplier');
    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toHaveTextContent('Reason for the rejection: Siamo chiusi per ferie');
    expect(screen.getByTestId('request-other-supplier-sr-rejected')).toHaveTextContent('Request another supplier');
  });

  it('ServiceRequestTimeline_ShowPropertyAndStay_NamesThePropertyAndLinksTheStay', () => {
    renderTimeline({ requests: [BASE, { ...BASE, id: 'sr-legacy', bookingId: null }], showProperty: true, showStay: true });

    expect(screen.getByTestId('service-request-sr-1')).toHaveTextContent('Villa Rosa');
    expect(screen.getByTestId('service-request-sr-legacy')).toHaveTextContent('Villa Rosa');
    expect(screen.getByTestId('service-request-stay-sr-1')).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(screen.getByTestId('service-request-no-stay-sr-legacy')).toBeInTheDocument();
  });

  it('ServiceRequestTimeline_WithoutShowStay_HasNoStayLink', () => {
    renderTimeline({ requests: [BASE] });

    expect(screen.queryByTestId('service-request-stay-sr-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('service-request-no-stay-sr-1')).not.toBeInTheDocument();
  });

  // ─── The name of a request opens it ───

  it('ServiceRequestTimeline_NameOfARequest_OpensItsDrawerWhenThePageHasOne', () => {
    drawer.open.mockReturnValue(true);
    renderTimeline({ requests: [BASE] });

    const link = screen.getByTestId('service-request-open-sr-1');
    expect(link).toHaveAttribute('href', '/app/short-rent/interventions/sr-1');
    fireEvent.click(link);

    expect(drawer.open).toHaveBeenCalledWith('intervention', 'sr-1', { opener: link });
    // The click is the drawer's: the link does not go to the page as well.
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('ServiceRequestTimeline_NoDrawerOnThePage_TheNameGoesToThePageOfTheRequest', () => {
    drawer.open.mockReturnValue(false);
    renderTimeline({ requests: [BASE] });

    fireEvent.click(screen.getByTestId('service-request-open-sr-1'));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/short-rent/interventions/sr-1');
  });

  it('ServiceRequestTimeline_ClickThatAsksForANewTab_IsTheBrowsers', () => {
    drawer.open.mockReturnValue(true);
    renderTimeline({ requests: [BASE] });
    const link = screen.getByTestId('service-request-open-sr-1');
    // The new tab is the browser's doing: here it only must not be the drawer's.
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });

    fireEvent.click(link, { ctrlKey: true });

    expect(drawer.open).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('ServiceRequestTimeline_LongRent_LinksToThePageOfTheRequestAndNeverOpensTheShortRentDrawer', () => {
    drawer.open.mockReturnValue(true);
    renderTimeline({ requests: [{ ...BASE, rentalContext: 'LongRent', bookingId: null }], context: 'long-rent' });

    const link = screen.getByTestId('service-request-open-sr-1');
    expect(link).toHaveAttribute('href', '/app/long-rent/service-requests/sr-1');
    fireEvent.click(link);

    expect(drawer.open).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/app/long-rent/service-requests/sr-1');
  });

  // ─── "Segna pagato" asks for confirmation ───

  it('ServiceRequestTimeline_MarkPaid_AsksForConfirmationBeforeCallingTheApi', async () => {
    renderTimeline({ requests: [COMPLETED] });

    fireEvent.click(screen.getByTestId('mark-paid-sr-1'));

    const dialog = await screen.findByTestId('mark-paid-dialog');
    expect(api.markServiceRequestPaid).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('Pulizie Express Srl');
    expect(dialog).toHaveTextContent('Pulizie');
    expect(dialog).toHaveTextContent('CasaZen non effettua il pagamento');
    expect(within(dialog).getByTestId('mark-paid-warning')).toHaveTextContent('non si può annullare');

    fireEvent.click(within(dialog).getByTestId('mark-paid-confirm'));

    await waitFor(() => expect(api.markServiceRequestPaid).toHaveBeenCalledTimes(1));
    expect(api.markServiceRequestPaid).toHaveBeenCalledWith('sr-1');
    expect(api.markLongRentServiceRequestPaid).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('mark-paid-dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Segnato come pagato');
  });

  it('ServiceRequestTimeline_MarkPaidCancelled_CallsNothingAndKeepsTheButton', async () => {
    renderTimeline({ requests: [COMPLETED] });
    fireEvent.click(screen.getByTestId('mark-paid-sr-1'));

    fireEvent.click(await screen.findByTestId('mark-paid-cancel'));

    await waitFor(() => expect(screen.queryByTestId('mark-paid-dialog')).not.toBeInTheDocument());
    expect(api.markServiceRequestPaid).not.toHaveBeenCalled();
    expect(screen.getByTestId('mark-paid-sr-1')).toBeEnabled();
  });

  it('ServiceRequestTimeline_MarkPaidLongRent_ConfirmsThenUsesTheLongRentApi', async () => {
    renderTimeline({ requests: [{ ...COMPLETED, rentalContext: 'LongRent', bookingId: null }], context: 'long-rent' });

    fireEvent.click(screen.getByTestId('mark-paid-sr-1'));
    expect(api.markLongRentServiceRequestPaid).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('mark-paid-confirm'));

    await waitFor(() => expect(api.markLongRentServiceRequestPaid).toHaveBeenCalledWith('sr-1'));
    expect(api.markServiceRequestPaid).not.toHaveBeenCalled();
  });

  it('ServiceRequestTimeline_MarkPaidRefused_ShowsTheServerMessageAndKeepsTheDialogOpenForARetry', async () => {
    api.markServiceRequestPaid.mockRejectedValue(
      problem(422, 'service_request_invalid_transition', 'La richiesta non può essere segnata come pagata.'),
    );
    renderTimeline({ requests: [COMPLETED] });
    fireEvent.click(screen.getByTestId('mark-paid-sr-1'));

    fireEvent.click(await screen.findByTestId('mark-paid-confirm'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La richiesta non può essere segnata come pagata.'));
    expect(screen.getByTestId('mark-paid-dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    ['Richiesto', BASE],
    ['Pagato', PAID],
    ['Rifiutato', REJECTED],
  ])('ServiceRequestTimeline_%sRequest_OffersNoMarkPaid', (_status, request) => {
    renderTimeline({ requests: [request] });

    expect(screen.queryByTestId(`mark-paid-${request.id}`)).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_WithoutManagePermission_HidesMarkPaidAndRequestAnotherSupplier', () => {
    renderTimeline({ requests: [COMPLETED, REJECTED], canManage: false });

    expect(screen.queryByTestId('mark-paid-sr-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-other-supplier-sr-rejected')).not.toBeInTheDocument();
    // The list itself is still readable.
    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toBeInTheDocument();
  });

  // ─── Ask another supplier after a rejection ───

  it('ServiceRequestTimeline_RequestAnotherSupplier_OpensTheFormForTheSameStayWithoutTheSupplierThatRejected', async () => {
    api.getBookings.mockResolvedValue([
      {
        id: 'b-1',
        propertyId: 'prop-1',
        checkInDate: '2026-10-01T00:00:00Z',
        checkOutDate: '2026-10-05T00:00:00Z',
        status: 'Confirmed',
        guest: { firstName: 'Mario', lastName: 'Rossi', email: '', phone: '', country: 'IT' },
      },
    ]);
    renderTimeline({ requests: [REJECTED] });

    fireEvent.click(screen.getByTestId('request-other-supplier-sr-rejected'));

    const dialog = await screen.findByTestId('service-request-dialog');
    expect(dialog).toHaveTextContent('Richiedi ad altro fornitore');
    expect(dialog).toHaveTextContent('Il fornitore che ha rifiutato non è nell\'elenco.');
    // The stay is the one of the rejected request: the form does not ask for it again. Same category and notes.
    expect(within(dialog).queryByTestId('service-request-stay')).not.toBeInTheDocument();
    const supplier = await within(dialog).findByTestId('service-request-supplier');
    expect(api.fetchSuppliersByProperty).toHaveBeenCalledWith('prop-1', 'cleaning');
    expect(within(supplier).queryByRole('option', { name: 'Pulizie Express Srl' })).not.toBeInTheDocument();
    expect(within(supplier).getByRole('option', { name: 'Pulizie Rapide Snc' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Note')).toHaveValue('Chiavi in portineria');

    fireEvent.change(supplier, { target: { value: 'sup-2' } });
    await within(dialog).findByTestId('service-request-job-day');
    fireEvent.change(within(dialog).getByTestId('service-request-start-time'), { target: { value: '10:00' } });
    fireEvent.change(within(dialog).getByTestId('service-request-duration'), { target: { value: '120' } });
    fireEvent.click(within(dialog).getByTestId('submit-service-request'));

    await waitFor(() =>
      expect(api.createServiceRequest).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        bookingId: 'b-1',
        supplierOrgId: 'sup-2',
        category: 'cleaning',
        urgency: 'Normal',
        notes: 'Chiavi in portineria',
        scheduledStartUtc: romeWallTimeToUtc('2026-10-05', '10:00'),
        durationMinutes: 120,
      }),
    );
    await waitFor(() => expect(screen.queryByTestId('service-request-dialog')).not.toBeInTheDocument());
  });

  it('ServiceRequestTimeline_OtherSupplierAfterSeveralRejections_LeavesOutEveryOneThatRejected', async () => {
    const second: ServiceRequest = { ...REJECTED, id: 'sr-rejected-2', supplierOrgId: 'sup-2', supplierName: 'Pulizie Rapide Snc' };
    api.fetchSuppliersByProperty.mockResolvedValue({
      ...SUPPLIERS,
      items: [
        ...SUPPLIERS.items,
        { orgId: 'sup-3', legalName: 'Pulizie Verdi', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
      ],
    });
    renderTimeline({ requests: [REJECTED, second] });

    fireEvent.click(screen.getByTestId('request-other-supplier-sr-rejected'));

    const supplier = await screen.findByTestId('service-request-supplier');
    const options = within(supplier).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Seleziona fornitore', 'Pulizie Verdi']);
  });

  it('ServiceRequestTimeline_OnlySuppliersThatRejectedAreLeft_SaysThereIsNoOtherSupplier', async () => {
    api.fetchSuppliersByProperty.mockResolvedValue({ ...SUPPLIERS, items: [SUPPLIERS.items[0]], totalCount: 1 });
    renderTimeline({ requests: [REJECTED] });

    fireEvent.click(screen.getByTestId('request-other-supplier-sr-rejected'));

    expect(await screen.findByTestId('service-request-no-suppliers')).toHaveTextContent('Nessun altro fornitore attivo');
  });

  it('ServiceRequestTimeline_RequestAnotherSupplierLongRent_UsesTheLongRentFormForTheProperty', async () => {
    const lease: ServiceRequest = { ...REJECTED, rentalContext: 'LongRent', bookingId: null };
    renderTimeline({ requests: [lease], context: 'long-rent' });

    fireEvent.click(screen.getByTestId('request-other-supplier-sr-rejected'));

    const supplier = await screen.findByTestId('service-request-supplier');
    expect(api.fetchLongRentSuppliers).toHaveBeenCalledWith('prop-1', 'cleaning');
    expect(api.fetchSuppliersByProperty).not.toHaveBeenCalled();
    fireEvent.change(supplier, { target: { value: 'sup-2' } });
    fireEvent.change(screen.getByTestId('service-request-job-date'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByTestId('service-request-start-time'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByTestId('service-request-duration'), { target: { value: '120' } });
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() =>
      expect(api.createLongRentServiceRequest).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        supplierOrgId: 'sup-2',
        category: 'cleaning',
        urgency: 'Normal',
        notes: 'Chiavi in portineria',
        scheduledStartUtc: romeWallTimeToUtc('2026-10-05', '10:00'),
        durationMinutes: 120,
      }),
    );
    expect(api.createServiceRequest).not.toHaveBeenCalled();
  });

  it('ServiceRequestTimeline_AlreadyRequestedFromAnotherSupplier_SaysSoInsteadOfOfferingItAgain', () => {
    const replacement: ServiceRequest = {
      ...BASE,
      id: 'sr-replacement',
      supplierOrgId: 'sup-2',
      supplierName: 'Pulizie Rapide Snc',
      createdAt: '2026-09-22T08:00:00Z',
    };
    renderTimeline({ requests: [replacement, REJECTED] });

    // The refusal is over once the job was asked of another supplier: it moves to the closed ones, with the note.
    expect(screen.queryByTestId('service-request-sr-rejected')).not.toBeInTheDocument();
    toggleClosed();

    expect(screen.getByTestId('service-request-replaced-sr-rejected')).toHaveTextContent('Già richiesto a un altro fornitore.');
    expect(screen.queryByTestId('request-other-supplier-sr-rejected')).not.toBeInTheDocument();
  });

  it('ServiceRequestTimeline_RequestOfAnotherCategoryAfterTheRejection_DoesNotCountAsAReplacement', () => {
    const otherJob: ServiceRequest = {
      ...BASE,
      id: 'sr-plumbing',
      category: 'plumbing',
      createdAt: '2026-09-22T08:00:00Z',
    };
    renderTimeline({ requests: [otherJob, REJECTED] });

    expect(screen.getByTestId('request-other-supplier-sr-rejected')).toBeInTheDocument();
  });
});
