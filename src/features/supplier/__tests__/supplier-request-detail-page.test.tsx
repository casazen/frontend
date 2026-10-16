import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { withBrowserTimeZone } from '@/test/clock';
import type { SupplierServiceRequestDetail } from '@/types/service-request';
import type { SupplierProfile } from '@/types/supplier';
import { SupplierRequestDetailPage } from '../supplier-request-detail-page';

const supplierApi = vi.hoisted(() => ({ fetchSupplierInboxItem: vi.fn(), fetchSupplierProfile: vi.fn() }));
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
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
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

/** The supplier profile the console reads its status from (SU-12): an admin may suspend it. */
const PROFILE: SupplierProfile = {
  orgId: 'org-1',
  status: 'Active',
  legalName: 'Pulizie Rossi Srl',
  phone: '+39 06 111111',
  email: 'rossi@example.it',
  categories: ['cleaning'],
  comuni: ['H501'],
  photoUrls: [],
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

describe('SupplierRequestDetailPage (SU-08, SP-08c)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(NEW_REQUEST);
    supplierApi.fetchSupplierProfile.mockResolvedValue(PROFILE);
    await i18n.changeLanguage('it');
  });

  it('SupplierRequestDetailPage_BeforeTake_ShowsComuneZoneAndDayButNotAddressNorHostContact', async () => {
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(supplierApi.fetchSupplierInboxItem).toHaveBeenCalledWith(ID);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pulizie');
    expect(screen.getByTestId('supplier-request-where')).toHaveTextContent('Roma (00184)');
    expect(screen.getByTestId('supplier-request-where')).toHaveTextContent('Indirizzo dopo che accetti');
    expect(screen.getByTestId('supplier-request-when')).toHaveTextContent('lunedì 12 ottobre 2026');
    expect(screen.getByTestId('supplier-request-when')).toHaveTextContent('Urgenza: Alta');
    expect(screen.getByTestId('supplier-request-stay')).toHaveTextContent('Dal 9 ottobre 2026 al 12 ottobre 2026');
    expect(screen.getByTestId('supplier-request-notes')).toHaveTextContent('Cambio biancheria per 4 persone');
    expect(screen.getByTestId('supplier-request-contact-hidden')).toHaveTextContent(
      'Indirizzo e contatti del cliente compaiono dopo che accetti.',
    );
    expect(screen.queryByTestId('supplier-request-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('supplier-request-host-phone')).not.toBeInTheDocument();
    // What to do now: take or reject, not complete.
    expect(screen.getByTestId('supplier-request-now')).toHaveTextContent('Rispondi alla richiesta');
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

    it('SupplierRequestDetailPage_History_ShowsEachStepWithRomeDateAndActor', async () => {
      supplierApi.fetchSupplierInboxItem.mockResolvedValue(TAKEN_REQUEST);
      renderPage();

      const history = await screen.findByTestId('supplier-request-history');
      const [taken, requested] = within(history).getAllByRole('listitem');
      expect(requested).toHaveTextContent('Richiesta ricevuta');
      expect(requested).toHaveTextContent('20 set');
      expect(requested).toHaveTextContent('10:00');
      expect(requested).toHaveTextContent('Il cliente');
      expect(taken).toHaveTextContent('Hai accettato la richiesta');
      // 23:30 UTC of 24 September: 01:30 of 25 September in Rome, whatever the browser's time zone.
      expect(taken).toHaveTextContent('25 set');
      expect(taken).toHaveTextContent('01:30');
      expect(taken).toHaveTextContent('Mario Rossi');
    });
  });

  it('SupplierRequestDetailPage_Take_CallsTheApiAndShowsTheContactAfterReload', async () => {
    requestsApi.takeServiceRequest.mockResolvedValue({});
    supplierApi.fetchSupplierInboxItem.mockResolvedValueOnce(NEW_REQUEST).mockResolvedValue(TAKEN_REQUEST);
    renderPage();

    fireEvent.click(await screen.findByTestId('supplier-request-take'));

    await waitFor(() => expect(requestsApi.takeServiceRequest).toHaveBeenCalledWith(ID));
    expect(await screen.findByTestId('supplier-request-host-name')).toHaveTextContent('Villa Rosa Affitti');
    expect(screen.getByTestId('supplier-request-now')).toHaveTextContent('Il lavoro è in programma');
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

    await waitFor(() => expect(screen.getByTestId('supplier-request-now')).toHaveTextContent('Hai rifiutato la richiesta'));
    expect(screen.getByTestId('supplier-request-now')).toHaveTextContent('Motivo: Già occupato');
    expect(screen.queryByTestId('supplier-request-take')).not.toBeInTheDocument();
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
    expect(error).toHaveTextContent('Impossibile caricare la richiesta.');
    expect(screen.queryByTestId('supplier-request-detail')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('supplier-request-detail')).toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_AnotherSuppliersRequest_ShowsNotFound', async () => {
    supplierApi.fetchSupplierInboxItem.mockRejectedValue(
      problem(404, 'service_request_not_found', 'Richiesta di servizio non trovata.'),
    );
    renderPage();

    const notFound = await screen.findByTestId('supplier-request-not-found');
    expect(notFound).toHaveTextContent('Non troviamo questa richiesta');
    expect(within(notFound).getByRole('link', { name: 'Vai alle richieste' })).toHaveAttribute('href', '/app/supplier/inbox');
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
    expect(screen.getByTestId('supplier-request-when')).toHaveTextContent('Da concordare');
    expect(screen.getByTestId('supplier-request-job')).toHaveTextContent('Affitto lungo');
    expect(screen.queryByTestId('supplier-request-stay')).not.toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_EnglishLocale_TranslatesTheLabels', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(screen.getByTestId('supplier-request-when')).toHaveTextContent('Monday, October 12, 2026');
    expect(screen.getByTestId('supplier-request-contact-hidden')).toHaveTextContent(/appear once you accept/);
    expect(screen.getByTestId('supplier-request-take')).toHaveTextContent('Accept');
  });

  // ─── SU-12: a suspended supplier performs no action ───

  it('SupplierRequestDetailPage_SuspendedSupplierNewRequest_DisablesTakeAndRejectAndExplainsWhy', async () => {
    supplierApi.fetchSupplierProfile.mockResolvedValue({ ...PROFILE, status: 'Suspended' });
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    await waitFor(() => expect(screen.getByTestId('supplier-request-take')).toBeDisabled());
    expect(screen.getByTestId('supplier-request-reject')).toBeDisabled();
    expect(screen.getByTestId('supplier-request-actions-suspended')).toHaveTextContent(/Azioni non disponibili/);
    fireEvent.click(screen.getByTestId('supplier-request-take'));
    expect(requestsApi.takeServiceRequest).not.toHaveBeenCalled();
  });

  it('SupplierRequestDetailPage_SuspendedSupplierTakenRequest_DisablesComplete', async () => {
    supplierApi.fetchSupplierProfile.mockResolvedValue({ ...PROFILE, status: 'Suspended' });
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(TAKEN_REQUEST);
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    await waitFor(() => expect(screen.getByTestId('supplier-request-complete')).toBeDisabled());
    expect(screen.getByTestId('supplier-request-actions-suspended')).toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_ClosedRequestOfASuspendedSupplier_ShowsNoSuspensionHintOnTheActions', async () => {
    supplierApi.fetchSupplierProfile.mockResolvedValue({ ...PROFILE, status: 'Suspended' });
    supplierApi.fetchSupplierInboxItem.mockResolvedValue({ ...TAKEN_REQUEST, status: 'Completato' });
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    expect(screen.queryByTestId('supplier-request-actions-suspended')).not.toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_ActionRefusedBecauseSuspendedMeanwhile_ReloadsTheStatusAndDisablesTheActions', async () => {
    requestsApi.takeServiceRequest.mockRejectedValue(
      problem(
        422,
        'service_request_supplier_not_active',
        'Il tuo account fornitore non è attivo (è sospeso o non ancora attivato): non puoi eseguire azioni sulle richieste. Contatta il supporto CasaZen.',
      ),
    );
    renderPage();
    const take = await screen.findByTestId('supplier-request-take');
    expect(take).toBeEnabled();
    // An admin suspends the supplier while the page is open.
    supplierApi.fetchSupplierProfile.mockResolvedValue({ ...PROFILE, status: 'Suspended' });

    fireEvent.click(take);

    await waitFor(() => expect(screen.getByTestId('supplier-request-take')).toBeDisabled());
    expect(screen.getByTestId('supplier-request-actions-suspended')).toBeInTheDocument();
  });
});
