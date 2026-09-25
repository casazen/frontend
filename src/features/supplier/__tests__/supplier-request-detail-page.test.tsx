import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { withBrowserTimeZone } from '@/test/clock';
import type { SupplierServiceRequestDetail } from '@/types/service-request';
import { SupplierRequestDetailPage } from '../supplier-request-detail-page';

const supplierApi = vi.hoisted(() => ({ fetchSupplierInboxItem: vi.fn() }));
const requestsApi = vi.hoisted(() => ({
  takeServiceRequest: vi.fn(),
  completeServiceRequest: vi.fn(),
  rejectServiceRequest: vi.fn(),
}));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...supplierApi,
}));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  ...requestsApi,
}));

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

/** A new short-rent request: comune, zone, day and stay dates; no address nor host contact before the take. */
const NEW_REQUEST: SupplierServiceRequestDetail = {
  id: ID,
  rentalContext: 'ShortRent',
  status: 'Richiesto',
  category: 'cleaning',
  urgency: 'High',
  notes: 'Cambio biancheria per 4 persone',
  rejectionReason: null,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  takenAt: null,
  completedAt: null,
  paidAt: null,
  propertyId: 'p-1',
  propertyName: 'Villa Rosa',
  city: 'Roma',
  postalCode: '00184',
  address: null,
  scheduledFor: '2026-10-12',
  stay: { bookingId: 'b-1', checkIn: '2026-10-09', checkOut: '2026-10-12' },
  contactDisclosed: false,
  hostContact: null,
  history: [{ status: 'Richiesto', at: '2026-09-20T08:00:00Z', actor: 'Host', actorName: null, reason: null }],
};

/** The same request once taken: 23:30 UTC of 24 September is 01:30 of 25 September in Rome. */
const TAKEN_REQUEST: SupplierServiceRequestDetail = {
  ...NEW_REQUEST,
  status: 'PresoInCarico',
  takenAt: '2026-09-24T23:30:00Z',
  address: 'Via dei Fori Imperiali 12',
  contactDisclosed: true,
  hostContact: { name: 'Villa Rosa Affitti', email: 'host@example.com', phone: '+39 333 1112223' },
  history: [
    ...NEW_REQUEST.history,
    { status: 'PresoInCarico', at: '2026-09-24T23:30:00Z', actor: 'Supplier', actorName: 'Mario Rossi', reason: null },
  ],
};

function problem(status: number, code: string, detail: string): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, code, detail },
  } as AxiosResponse;
  return new AxiosError(detail, 'ERR_BAD_REQUEST', undefined, undefined, response);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/app/supplier/inbox/${ID}`]}>
          <Routes>
            <Route path="/app/supplier/inbox/:id" element={<SupplierRequestDetailPage />} />
            <Route path="/app/supplier/inbox" element={<p>inbox</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('SupplierRequestDetailPage (SU-08, A4-14)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(NEW_REQUEST);
    await i18n.changeLanguage('it');
  });

  it('SupplierRequestDetailPage_BeforeTake_ShowsComuneZoneAndDayButNotAddressNorHostContact', async () => {
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(supplierApi.fetchSupplierInboxItem).toHaveBeenCalledWith(ID);
    expect(screen.getByTestId('supplier-request-title')).toHaveTextContent('Pulizie · Villa Rosa');
    expect(screen.getByTestId('supplier-request-city')).toHaveTextContent('Roma');
    expect(screen.getByTestId('supplier-request-postal-code')).toHaveTextContent('00184');
    expect(screen.getByTestId('supplier-request-scheduled-for')).toHaveTextContent('lunedì 12 ottobre 2026');
    expect(screen.getByTestId('supplier-request-stay')).toHaveTextContent('Dal 9 ottobre 2026 al 12 ottobre 2026');
    expect(screen.getByTestId('supplier-request-address-hidden')).toHaveTextContent(
      "L'indirizzo completo è visibile dopo la presa in carico.",
    );
    expect(screen.getByTestId('supplier-request-contact-hidden')).toHaveTextContent(
      "Nome e recapiti dell'host sono visibili dopo la presa in carico.",
    );
    expect(screen.queryByTestId('supplier-request-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('supplier-request-host-phone')).not.toBeInTheDocument();
    expect(screen.getByTestId('supplier-request-notes')).toHaveTextContent('Cambio biancheria per 4 persone');
    expect(screen.getByTestId('supplier-request-urgency')).toHaveTextContent('Urgenza: Alta');
    // Actions of a new request: take or reject, not complete.
    expect(screen.getByTestId('supplier-request-take')).toBeEnabled();
    expect(screen.getByTestId('supplier-request-reject')).toBeEnabled();
    expect(screen.queryByTestId('supplier-request-complete')).not.toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_AfterTake_ShowsAddressAndHostContactWithCompleteAction', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(TAKEN_REQUEST);
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(screen.getByTestId('supplier-request-address')).toHaveTextContent('Via dei Fori Imperiali 12');
    expect(screen.getByTestId('supplier-request-host-name')).toHaveTextContent('Villa Rosa Affitti');
    expect(screen.getByTestId('supplier-request-host-phone')).toHaveAttribute('href', 'tel:+393331112223');
    expect(screen.getByTestId('supplier-request-host-email')).toHaveAttribute('href', 'mailto:host@example.com');
    expect(screen.queryByTestId('supplier-request-contact-hidden')).not.toBeInTheDocument();
    expect(screen.getByTestId('supplier-request-complete')).toBeEnabled();
    expect(screen.queryByTestId('supplier-request-take')).not.toBeInTheDocument();
  });

  describe('in a browser outside Italy', () => {
    withBrowserTimeZone('America/New_York');

    it('SupplierRequestDetailPage_History_ShowsEachTransitionWithRomeDateAndActor', async () => {
      supplierApi.fetchSupplierInboxItem.mockResolvedValue(TAKEN_REQUEST);
      renderPage();

      await screen.findByTestId('supplier-request-history');
      const requested = screen.getByTestId('supplier-request-history-0');
      expect(requested).toHaveTextContent('Richiesto');
      expect(requested).toHaveTextContent('20 settembre 2026');
      expect(requested).toHaveTextContent('10:00');
      expect(requested).toHaveTextContent('Host');
      const taken = screen.getByTestId('supplier-request-history-1');
      expect(taken).toHaveTextContent('Preso in carico');
      // 23:30 UTC of 24 September: 01:30 of 25 September in Rome, whatever the browser's time zone.
      expect(taken).toHaveTextContent('25 settembre 2026');
      expect(taken).toHaveTextContent('01:30');
      expect(taken).toHaveTextContent('Mario Rossi (Il tuo team)');
    });
  });

  it('SupplierRequestDetailPage_Take_CallsTheApiAndShowsTheContactAfterReload', async () => {
    requestsApi.takeServiceRequest.mockResolvedValue({});
    supplierApi.fetchSupplierInboxItem.mockResolvedValueOnce(NEW_REQUEST).mockResolvedValue(TAKEN_REQUEST);
    renderPage();

    fireEvent.click(await screen.findByTestId('supplier-request-take'));

    await waitFor(() => expect(requestsApi.takeServiceRequest).toHaveBeenCalledWith(ID));
    expect(await screen.findByTestId('supplier-request-host-name')).toHaveTextContent('Villa Rosa Affitti');
    expect(screen.getByTestId('supplier-request-status')).toHaveTextContent('Preso in carico');
  });

  it('SupplierRequestDetailPage_TakeConflict_ReloadsTheRequest', async () => {
    requestsApi.takeServiceRequest.mockRejectedValue(
      problem(409, 'service_request_state_changed', 'La richiesta è stata modificata da un altro utente.'),
    );
    supplierApi.fetchSupplierInboxItem
      .mockResolvedValueOnce(NEW_REQUEST)
      .mockResolvedValue({ ...NEW_REQUEST, status: 'Rifiutato', rejectionReason: 'Già occupato' });
    renderPage();

    fireEvent.click(await screen.findByTestId('supplier-request-take'));

    expect(await screen.findByTestId('supplier-request-closed')).toHaveTextContent('Hai rifiutato questa richiesta.');
    expect(screen.getByTestId('supplier-request-rejection-reason')).toHaveTextContent('Già occupato');
    expect(supplierApi.fetchSupplierInboxItem).toHaveBeenCalledTimes(2);
  });

  it('SupplierRequestDetailPage_Reject_NeedsAReasonAndSendsItTrimmed', async () => {
    requestsApi.rejectServiceRequest.mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByTestId('supplier-request-reject'));
    const dialog = await screen.findByTestId('reject-dialog');
    const confirm = within(dialog).getByTestId('reject-confirm');
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByTestId('reject-reason'), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('reject-reason'), { target: { value: '  Non disponibile  ' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(requestsApi.rejectServiceRequest).toHaveBeenCalledWith(ID, 'Non disponibile'));
    await waitFor(() => expect(screen.queryByTestId('reject-dialog')).not.toBeInTheDocument());
  });

  it('SupplierRequestDetailPage_Loading_ShowsSkeletonNotContent', async () => {
    supplierApi.fetchSupplierInboxItem.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByTestId('supplier-request-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-request-detail')).not.toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_ApiError_ShowsErrorWithRetry', async () => {
    supplierApi.fetchSupplierInboxItem.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(NEW_REQUEST);
    renderPage();

    const error = await screen.findByTestId('supplier-request-error');
    expect(error).toHaveTextContent("Impossibile caricare l'incarico.");
    expect(screen.queryByTestId('supplier-request-detail')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('supplier-request-detail')).toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_AnotherSuppliersRequest_ShowsNotFound', async () => {
    supplierApi.fetchSupplierInboxItem.mockRejectedValue(
      problem(404, 'service_request_not_found', 'Richiesta di servizio non trovata.'),
    );
    renderPage();

    expect(await screen.findByTestId('supplier-request-not-found')).toHaveTextContent(
      'Incarico non trovato: non esiste o non è stato inviato a te.',
    );
    expect(screen.getByTestId('supplier-request-back')).toHaveAttribute('href', '/app/supplier/inbox');
  });

  it('SupplierRequestDetailPage_LongRentRequest_ShowsNoDateAndNoStay', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValue({
      ...TAKEN_REQUEST,
      rentalContext: 'LongRent',
      scheduledFor: null,
      stay: null,
    });
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(screen.getByTestId('supplier-request-no-date')).toHaveTextContent('Nessuna data: da concordare con l\'host.');
    expect(screen.getByTestId('supplier-request-long-rent')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-request-stay')).not.toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_EnglishLocale_TranslatesTheLabels', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(screen.getByTestId('supplier-request-scheduled-for')).toHaveTextContent('Monday, October 12, 2026');
    expect(screen.getByTestId('supplier-request-contact-hidden')).toHaveTextContent(
      "The host's name and contact details are shown once you accept the request.",
    );
    expect(screen.getByTestId('supplier-request-back')).toHaveTextContent('Back to assignments');
  });
});
