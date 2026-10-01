import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
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

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/api/service-requests.api', () => ({
  markServiceRequestPaid: api.markServiceRequestPaid,
  markLongRentServiceRequestPaid: api.markLongRentServiceRequestPaid,
  createServiceRequest: api.createServiceRequest,
  createLongRentServiceRequest: api.createLongRentServiceRequest,
  fetchSuppliersByProperty: api.fetchSuppliersByProperty,
  fetchLongRentSuppliers: api.fetchLongRentSuppliers,
}));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getAll: api.getBookings } }));

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

const SUPPLIERS = {
  items: [
    { orgId: 'sup-1', legalName: 'Pulizie Express Srl', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
    { orgId: 'sup-2', legalName: 'Pulizie Rapide Snc', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 2,
};

function renderTimeline(props: Partial<React.ComponentProps<typeof ServiceRequestTimeline>> & { requests: ServiceRequest[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ServiceRequestTimeline {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function problem(status: number, code: string, detail: string) {
  return Object.assign(new Error(detail), { isAxiosError: true, response: { status, data: { code, detail } } });
}

describe('ServiceRequestTimeline (SU-09, A4-28)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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

  // ─── The real timeline ───

  it('ServiceRequestTimeline_PaidRequest_ShowsEveryStepWithItsDateInRomeAndWho', () => {
    renderTimeline({ requests: [PAID] });

    const steps = within(screen.getByTestId('service-request-history-sr-1')).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent('Richiesto');
    expect(steps[0]).toHaveTextContent('20 settembre 2026');
    expect(steps[0]).toHaveTextContent('Il tuo team');
    expect(steps[1]).toHaveTextContent('Preso in carico');
    expect(steps[1]).toHaveTextContent('25 settembre 2026');
    expect(steps[1]).toHaveTextContent('01:30');
    expect(steps[1]).toHaveTextContent('Pulizie Express Srl');
    expect(steps[2]).toHaveTextContent('Completato');
    expect(steps[2]).toHaveTextContent('Pulizie Express Srl');
    expect(steps[3]).toHaveTextContent('Pagato');
    expect(steps[3]).toHaveTextContent('27 settembre 2026');
    expect(steps[3]).toHaveTextContent('Il tuo team');
    // Nothing left to wait for once it is paid.
    expect(screen.queryByTestId('service-request-waiting-sr-1')).not.toBeInTheDocument();
  });

  it.each([
    ['Richiesto', BASE, 'In attesa che il fornitore accetti o rifiuti.'],
    ['PresoInCarico', { ...BASE, status: 'PresoInCarico' as const, history: [STEP.requested, STEP.taken] }, 'In attesa che il fornitore completi il lavoro.'],
    ['Completato', COMPLETED, 'Lavoro completato: segna pagato quando hai pagato il fornitore.'],
  ])('ServiceRequestTimeline_%sRequest_SaysWhatItWaitsFor', (_status, request, hint) => {
    renderTimeline({ requests: [request] });

    expect(screen.getByTestId('service-request-waiting-sr-1')).toHaveTextContent(hint);
  });

  it('ServiceRequestTimeline_RejectedRequest_ShowsTheReasonAndTheRejectionDate', () => {
    renderTimeline({ requests: [REJECTED] });

    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toHaveTextContent('Motivo del rifiuto: Siamo chiusi per ferie');
    expect(screen.getByTestId('service-request-step-sr-rejected-Rifiutato')).toHaveTextContent('21 settembre 2026');
    expect(screen.getByTestId('service-request-step-sr-rejected-Rifiutato')).toHaveTextContent('Pulizie Express Srl');
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

  it('ServiceRequestTimeline_RequestWithoutHistory_ShowsTheStatusAndNoSteps', () => {
    renderTimeline({ requests: [{ ...BASE, history: undefined }] });

    expect(screen.getByTestId('service-request-sr-1')).toHaveTextContent('Richiesto');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('ServiceRequestTimeline_NoSupplierName_NamesTheSupplierGenerically', () => {
    renderTimeline({ requests: [{ ...COMPLETED, supplierName: null }] });

    expect(screen.getByTestId('service-request-step-sr-1-PresoInCarico')).toHaveTextContent('Il fornitore');
  });

  it('ServiceRequestTimeline_English_ShowsTranslatedSteps', async () => {
    await i18n.changeLanguage('en');
    renderTimeline({ requests: [REJECTED] });

    expect(screen.getByTestId('service-request-step-sr-rejected-Richiesto')).toHaveTextContent('Your team');
    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toHaveTextContent('Reason for the rejection: Siamo chiusi per ferie');
    expect(screen.getByTestId('request-other-supplier-sr-rejected')).toHaveTextContent('Request another supplier');
  });

  it('ServiceRequestTimeline_ShowPropertyAndStay_NamesThePropertyAndLinksTheStay', () => {
    renderTimeline({ requests: [BASE, { ...BASE, id: 'sr-legacy', bookingId: null }], showProperty: true, showStay: true });

    expect(screen.getAllByText('· Villa Rosa')).toHaveLength(2);
    expect(screen.getByTestId('service-request-stay-sr-1')).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(screen.getByTestId('service-request-no-stay-sr-legacy')).toBeInTheDocument();
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
    // The timeline itself is still readable.
    expect(screen.getByTestId('service-request-rejection-sr-rejected')).toBeInTheDocument();
  });

  // ─── Ask another supplier after a rejection ───

  it('ServiceRequestTimeline_RequestAnotherSupplier_OpensTheFormForTheSameStayWithoutTheSupplierThatRejected', async () => {
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
    fireEvent.click(within(dialog).getByTestId('submit-service-request'));

    await waitFor(() =>
      expect(api.createServiceRequest).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        bookingId: 'b-1',
        supplierOrgId: 'sup-2',
        category: 'cleaning',
        urgency: 'Normal',
        notes: 'Chiavi in portineria',
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
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() =>
      expect(api.createLongRentServiceRequest).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        supplierOrgId: 'sup-2',
        category: 'cleaning',
        urgency: 'Normal',
        notes: 'Chiavi in portineria',
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
