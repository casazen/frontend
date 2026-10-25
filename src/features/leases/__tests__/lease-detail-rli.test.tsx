import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';
import { formatDate } from '@/lib/utils';
import { RLI_OFFICIAL_INFO_URL } from '@/lib/rli-registration-state';
import { LeaseDetailPage } from '../lease-detail-page';
import { buildDetail, buildSummary, httpError, renderAt } from './lease-test-utils';
import type { LeaseDetail, LeaseNextStep, LeaseRegistration, RliChecklist } from '@/types';

// LT-01 (A7-01): the RLI part of the lease page with the real registration panel, checklist, manual dialog and delega
// dialog. Only the unrelated panels are stubbed.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// A download is a file the browser saves: the test only asks which one and under what name.
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));
vi.mock('../components/cedolare-decision-panel', () => ({ CedolareDecisionPanel: () => null }));
vi.mock('../components/canone-concordato-calculator', () => ({ CanoneConcordatoCalculator: () => null }));
vi.mock('../components/attestation-guidance-panel', () => ({ AttestationGuidancePanel: () => null }));
vi.mock('../components/imu-notification-export-button', () => ({ ImuNotificationExportButton: () => null }));
vi.mock('../components/lease-signing-panel', () => ({ LeaseSigningPanel: () => null }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

const TODAY = '2026-10-11';

function signedLease(overrides: Partial<LeaseDetail> = {}): LeaseDetail {
  return buildDetail({ status: 'Signed', hasSignedPdf: true, registration: null, ...overrides });
}

function checklist(overrides: Partial<RliChecklist> = {}): RliChecklist {
  return {
    registrationDeadline: '2026-10-31T00:00:00Z',
    daysRemaining: 20,
    tosVersion: '2026-08-rli-delega-bozza',
    attestationText: 'Attestazione di test',
    providerFilingAvailable: false,
    items: [
      { key: 'contract_signed', label: 'x', done: true },
      { key: 'rli_exported', label: 'x', done: false },
      { key: 'rli_registered', label: 'x', done: false },
    ],
    ...overrides,
  };
}

function registration(overrides: Partial<LeaseRegistration> = {}): LeaseRegistration {
  return { status: 'Registered', channel: 'Manual', hasReceipt: true, ...overrides };
}

/** A document of the lease as the API lists it (`GET /leases/:id/documents`). */
function leaseDocument(id: string, kind: 'Contract' | 'Attestation' | 'Registration' | 'Other', fileName: string) {
  return { id, leaseId: 'lease-1', kind, fileName, sizeBytes: 2048, uploadedAt: '2026-10-24T10:00:00Z' };
}

/** The documents are asked only when the declaration window opens: without a list the API answers 404 and the window asks for the file. */
function mockApi(lease: () => LeaseDetail, rliChecklist: RliChecklist = checklist(), documents?: ReturnType<typeof leaseDocument>[]) {
  get.mockImplementation((url: string) => {
    if (url === '/leases/lease-1') return Promise.resolve({ data: lease() });
    if (url === '/leases/lease-1/rli/checklist') return Promise.resolve({ data: rliChecklist });
    if (url === '/leases/lease-1/documents' && documents) return Promise.resolve({ data: documents });
    return Promise.reject(httpError(404));
  });
}

// A lease that is signed and not registered opens on the tab of the registration (`scadenze`); its dates are in `dati`.
function renderPage(search = '') {
  return renderAt(`/app/long-rent/leases/lease-1${search}`, '/app/long-rent/leases/:id', createElement(LeaseDetailPage));
}

async function registrationPanel() {
  return within(await screen.findByTestId('rli-registration-panel'));
}

function pdf(name = 'ricevuta.pdf', type = 'application/pdf') {
  return new File(['%PDF-1.4 ricevuta'], name, { type });
}

describe('LeaseDetailPage — RLI registration (LT-01)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T08:00:00Z`));
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('render_SignedLeaseManualOnly_ShowsToRegisterStepsDeadlineAndNoProviderButton', async () => {
    mockApi(() => signedLease());

    renderPage();

    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('Da registrare');
    expect(panel.getByText(`Scadenza per la registrazione: ${formatDate('2026-10-31T00:00:00Z')}`)).toBeInTheDocument();
    const steps = panel.getByTestId('rli-manual-steps');
    expect(within(steps).getByText(/SPID, CIE, CNS o credenziali Entratel\/Fisconline/)).toBeInTheDocument();
    expect(within(steps).getByRole('link')).toHaveAttribute('href', RLI_OFFICIAL_INFO_URL);
    expect(panel.getByRole('button', { name: 'Inserisci estremi di registrazione' })).toBeInTheDocument();
    expect(panel.queryByRole('button', { name: /provider/i })).not.toBeInTheDocument();
    // Nothing says "sent" or "registered" for a lease that is only signed (the checklist loads with its own request).
    expect(await screen.findByTestId('rli-checklist-item-rli_registered')).toHaveAttribute('data-state', 'todo');
    expect(screen.queryByText(/inviat[oa] con successo/i)).not.toBeInTheDocument();
  });

  it('render_SignedBeforeStart_ShowsStipulaAndDeadlineFromTheApi', async () => {
    // LT-04 (A7-04): signed 1/8, start 1/10 → the API computes 31/8; the page shows it, never StartDate + 30.
    mockApi(() =>
      signedLease({ stipulaDate: '2026-08-01T00:00:00Z', registrationDeadline: '2026-08-31T00:00:00Z' }),
    );

    renderPage('?tab=dati');

    expect(await screen.findByTestId('lease-stipula-date')).toHaveTextContent(formatDate('2026-08-01T00:00:00Z'));
    expect(screen.getByTestId('lease-registration-deadline')).toHaveTextContent(formatDate('2026-08-31T00:00:00Z'));
    fireEvent.click(screen.getByRole('tab', { name: 'Scadenze' }));
    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-deadline')).toHaveTextContent(
      `Scadenza per la registrazione: ${formatDate('2026-08-31T00:00:00Z')}`,
    );
  });

  it('render_SignedWithoutStipula_DeadlineToBeDetermined', async () => {
    mockApi(
      () => signedLease({ stipulaDate: null, registrationDeadline: null }),
      checklist({ registrationDeadline: null, daysRemaining: null }),
    );

    renderPage('?tab=dati');

    expect(await screen.findByTestId('lease-registration-deadline')).toHaveTextContent('Da determinare');
    expect(screen.getByTestId('lease-stipula-date')).toHaveTextContent('Non ancora disponibile');
    fireEvent.click(screen.getByRole('tab', { name: 'Scadenze' }));
    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-deadline')).toHaveTextContent(
      'Scadenza per la registrazione: da determinare',
    );
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });

  it('declareManual_CompleteForm_PostsMultipartAndConfirmsHonestly', async () => {
    let current = signedLease();
    mockApi(() => current);
    post.mockImplementation(async () => {
      current = signedLease({
        status: 'Registered',
        registration: registration({ registrationCode: 'PROT-123', registrationDate: `${TODAY}T00:00:00Z` }),
      });
      return { data: current.registration };
    });

    renderPage();
    fireEvent.click((await registrationPanel()).getByRole('button', { name: 'Inserisci estremi di registrazione' }));
    const dialog = within(await screen.findByTestId('rli-manual-dialog'));
    const submit = dialog.getByRole('button', { name: 'Salva registrazione' });
    expect(submit).toBeDisabled();

    fireEvent.change(dialog.getByLabelText('Numero o protocollo di registrazione'), { target: { value: '  PROT-123 ' } });
    fireEvent.change(dialog.getByLabelText('Ricevuta di registrazione (PDF, al massimo 10 MB)'), {
      target: { files: [pdf()] },
    });
    expect(submit).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] as [string, FormData];
    expect(url).toBe('/leases/lease-1/registration/manual');
    expect(body.get('registrationCode')).toBe('PROT-123');
    expect(body.get('registrationDate')).toBe(TODAY);
    expect((body.get('receipt') as File).name).toBe('ricevuta.pdf');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Registrazione salvata: il contratto risulta registrato.'));
    const panel = await registrationPanel();
    await waitFor(() => expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('Registrato'));
    expect(panel.getByText('PROT-123')).toBeInTheDocument();
  });

  it('declareManual_FileNotAPdfOrDateInTheFuture_CannotSubmit', async () => {
    mockApi(() => signedLease());

    renderPage();
    fireEvent.click((await registrationPanel()).getByRole('button', { name: 'Inserisci estremi di registrazione' }));
    const dialog = within(await screen.findByTestId('rli-manual-dialog'));
    fireEvent.change(dialog.getByLabelText('Numero o protocollo di registrazione'), { target: { value: 'PROT-1' } });
    fireEvent.change(dialog.getByLabelText('Ricevuta di registrazione (PDF, al massimo 10 MB)'), {
      target: { files: [pdf('ricevuta.png', 'image/png')] },
    });
    fireEvent.change(dialog.getByLabelText('Data di registrazione'), { target: { value: '2026-10-12' } });
    fireEvent.click(dialog.getByRole('checkbox'));

    expect(dialog.getByText('Carica un file PDF di al massimo 10 MB.')).toBeInTheDocument();
    expect(dialog.getByText(/Inserisci una data non successiva a oggi/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Salva registrazione' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('declareManual_ServerRejects_ShowsTheProblemMessage', async () => {
    mockApi(() => signedLease());
    post.mockRejectedValue(httpError(422, { code: 'rli_receipt_invalid' }));

    renderPage();
    fireEvent.click((await registrationPanel()).getByRole('button', { name: 'Inserisci estremi di registrazione' }));
    const dialog = within(await screen.findByTestId('rli-manual-dialog'));
    fireEvent.change(dialog.getByLabelText('Numero o protocollo di registrazione'), { target: { value: 'PROT-1' } });
    fireEvent.change(dialog.getByLabelText('Ricevuta di registrazione (PDF, al massimo 10 MB)'), {
      target: { files: [pdf()] },
    });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Salva registrazione' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('La ricevuta deve essere un file PDF di al massimo 10 MB.'),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('rli-manual-dialog')).toBeInTheDocument();
  });

  it('render_SignedLeaseOfTheService_SaysWhoRegistersAndOffersOnlyTheDeclaration_NeverTheProviderNorTheStepsOfTheAgenzia', async () => {
    // CF-END: the service that prepared the contract registers it. A second registration (by the provider, or by hand on the site of the
    // Agenzia) would be a double one: even with the provider path available the panel gives neither, only the declaration.
    mockApi(() => signedLease({ origin: 'Imported', isConcordatoFacileSource: true }), checklist({ providerFilingAvailable: true }));

    renderPage();

    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('Da registrare');
    expect(panel.getByTestId('rli-service-note')).toHaveTextContent(
      'La registrazione la esegue il servizio che ha preparato il contratto. Quando ricevi la ricevuta di registrazione, caricala nei Documenti e dichiara qui la registrazione.',
    );
    expect(panel.getByRole('button', { name: 'Dichiara la registrazione' })).toBeInTheDocument();
    expect(panel.queryByTestId('rli-manual-steps')).not.toBeInTheDocument();
    expect(panel.queryByRole('link')).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: /provider/i })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Inserisci estremi di registrazione' })).not.toBeInTheDocument();
  });

  it('declareManual_ReceiptAlreadyUploaded_SendsItsIdAndNotTheFileAgain', async () => {
    // CF-END: the receipt the service sent is among the documents of the lease; the declaration uses it (no second upload). Only a
    // document of kind Registration is offered, and with a single one it is chosen already.
    let current = signedLease({ origin: 'Imported', isConcordatoFacileSource: true });
    mockApi(() => current, checklist(), [
      leaseDocument('doc-contract', 'Contract', 'contratto.pdf'),
      leaseDocument('doc-receipt', 'Registration', 'ricevuta-registrazione.pdf'),
    ]);
    post.mockImplementation(async () => {
      current = signedLease({
        status: 'Registered',
        registration: registration({ registrationCode: 'PROT-123', registrationDate: `${TODAY}T00:00:00Z` }),
      });
      return { data: current.registration };
    });

    renderPage();
    fireEvent.click((await registrationPanel()).getByRole('button', { name: 'Dichiara la registrazione' }));
    const dialog = within(await screen.findByTestId('rli-manual-dialog'));

    const chosen = await dialog.findByTestId('rli-receipt-document');
    expect(chosen).toHaveValue('doc-receipt');
    expect(dialog.getAllByRole('option')).toHaveLength(1);
    expect(dialog.getByRole('radio', { name: /Usa la ricevuta già caricata/ })).toBeChecked();
    expect(dialog.queryByLabelText('Ricevuta di registrazione (PDF, al massimo 10 MB)')).not.toBeInTheDocument();

    fireEvent.change(dialog.getByLabelText('Numero o protocollo di registrazione'), { target: { value: ' PROT-123 ' } });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Salva registrazione' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] as [string, FormData];
    expect(url).toBe('/leases/lease-1/registration/manual');
    expect(body.get('registrationCode')).toBe('PROT-123');
    expect(body.get('registrationDate')).toBe(TODAY);
    expect(body.get('receiptDocumentId')).toBe('doc-receipt');
    expect(body.has('receipt')).toBe(false);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Registrazione salvata: il contratto risulta registrato.'));
  });

  it('declareManual_ReceiptsUploadedButANewFileChosen_SendsTheFile', async () => {
    mockApi(() => signedLease(), checklist(), [leaseDocument('doc-receipt', 'Registration', 'ricevuta-registrazione.pdf')]);
    post.mockResolvedValue({ data: registration({ registrationCode: 'PROT-9' }) });

    renderPage();
    fireEvent.click((await registrationPanel()).getByRole('button', { name: 'Inserisci estremi di registrazione' }));
    const dialog = within(await screen.findByTestId('rli-manual-dialog'));
    fireEvent.click(await dialog.findByRole('radio', { name: /Carica un nuovo file/ }));
    fireEvent.change(dialog.getByLabelText('Numero o protocollo di registrazione'), { target: { value: 'PROT-9' } });
    fireEvent.change(dialog.getByLabelText('Ricevuta di registrazione (PDF, al massimo 10 MB)'), { target: { files: [pdf()] } });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Salva registrazione' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [, body] = post.mock.calls[0] as [string, FormData];
    expect((body.get('receipt') as File).name).toBe('ricevuta.pdf');
    expect(body.has('receiptDocumentId')).toBe(false);
  });

  it('render_ProviderRegistrationFailed_ShowsReasonActionsAndNoTick', async () => {
    mockApi(
      () => signedLease({ registration: registration({ status: 'Failed', channel: 'Provider', hasReceipt: false, failureCode: 'provider_error' }) }),
      checklist({
        providerFilingAvailable: true,
        items: [
          { key: 'contract_signed', label: 'x', done: true },
          { key: 'delega_captured', label: 'x', done: true },
          { key: 'rli_registered', label: 'x', done: false, failed: true },
        ],
      }),
    );

    renderPage();

    const panel = await registrationPanel();
    await waitFor(() => expect(panel.getByRole('button', { name: "Riprova l'invio al provider" })).toBeInTheDocument());
    expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('Registrazione non riuscita');
    const alert = panel.getByRole('alert');
    expect(alert).toHaveTextContent('Il contratto NON è registrato');
    expect(alert).toHaveTextContent('Il provider non ha accettato la pratica');
    expect(panel.getByRole('button', { name: 'Inserisci estremi di registrazione' })).toBeInTheDocument();
    const item = screen.getByTestId('rli-checklist-item-rli_registered');
    expect(item).toHaveAttribute('data-state', 'failed');
    expect(item).toHaveTextContent('✗');
    expect(item).not.toHaveTextContent('✓');
    expect(within(item).getByRole('link', { name: 'Vai alla registrazione' })).toHaveAttribute('href', '#rli-registration');
  });

  it('render_ProviderInProgress_SaysNotRegisteredYetAndOffersNoDeclaration', async () => {
    mockApi(
      () =>
        signedLease({
          status: 'SentToProvider',
          registration: registration({ status: 'SentToProvider', channel: 'Provider', hasReceipt: false, submittedAt: '2026-10-10T09:00:00Z' }),
        }),
      checklist({ providerFilingAvailable: true }),
    );

    renderPage();

    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('Registrazione in corso');
    expect(panel.getByRole('status')).toHaveTextContent('il contratto NON è ancora registrato');
    expect(panel.queryByRole('button', { name: 'Inserisci estremi di registrazione' })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: /Scarica ricevuta/ })).not.toBeInTheDocument();
    expect(await screen.findByTestId('rli-checklist-item-rli_registered')).toHaveAttribute('data-state', 'todo');
  });

  it('render_Registered_ShowsDeclaredDetailsAndReceiptDownload', async () => {
    mockApi(
      () =>
        signedLease({
          status: 'Registered',
          registration: registration({ registrationCode: 'PROT-9', registrationDate: '2026-10-05T00:00:00Z' }),
        }),
      checklist({ items: [{ key: 'rli_registered', label: 'x', done: true }] }),
    );

    renderPage('?tab=scadenze');

    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('Registrato');
    expect(panel.getByText('PROT-9')).toBeInTheDocument();
    expect(panel.getByText(formatDate('2026-10-05T00:00:00Z'))).toBeInTheDocument();
    expect(panel.getByText('Dichiarata dal locatore')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Scarica ricevuta/ })).toBeInTheDocument();
    expect(panel.queryByTestId('rli-manual-steps')).not.toBeInTheDocument();
    expect(await screen.findByTestId('rli-checklist-item-rli_registered')).toHaveAttribute('data-state', 'done');
  });

  it('submitToProvider_ProviderFails_HonestErrorAndLeaseReloaded', async () => {
    mockApi(() => signedLease(), checklist({ providerFilingAvailable: true }));
    post.mockRejectedValue(httpError(502, { code: 'rli_provider_failed' }));

    renderPage();
    const panel = await registrationPanel();
    fireEvent.click(await panel.findByRole('button', { name: 'Invia tramite provider (con delega)' }));
    fireEvent.click(await screen.findByRole('checkbox'));
    const leaseLoadsBefore = get.mock.calls.filter(([url]) => url === '/leases/lease-1').length;
    fireEvent.click(screen.getByRole('button', { name: 'Autorizza e invia' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Il provider non ha accettato la pratica: il contratto NON è registrato. Riprova più tardi o registralo tu sul canale ufficiale.',
      ),
    );
    expect(post).toHaveBeenCalledWith('/leases/lease-1/registration', {
      tosVersion: '2026-08-rli-delega-bozza',
      attestationAccepted: true,
    }, undefined);
    await waitFor(() =>
      expect(get.mock.calls.filter(([url]) => url === '/leases/lease-1').length).toBeGreaterThan(leaseLoadsBefore),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('render_ExtraEuTenantAfterReminder_QuesturaItemNotTickedWithPanelAndBanner', async () => {
    // LT-07 (A7-08): the API keeps the item to do until the landlord declares the communication.
    const tenant = { ...buildDetail().parties[1], isExtraEU: true };
    mockApi(
      () => signedLease({ hasExtraEUTenant: true, parties: [buildDetail().parties[0], tenant] }),
      checklist({
        items: [
          { key: 'contract_signed', label: 'x', done: true },
          { key: 'rli_registered', label: 'x', done: false },
          { key: 'questura_extra_eu', label: 'x', done: false },
        ],
        questura: {
          deliveryDate: '2026-10-01T00:00:00Z',
          deliveryDateDeclared: false,
          deadline: '2026-10-03T00:00:00Z',
          daysRemaining: -8,
          communicationDate: null,
          hasReceipt: false,
        },
      }),
    );

    renderPage();

    const item = await screen.findByTestId('rli-checklist-item-questura_extra_eu');
    expect(item).toHaveAttribute('data-state', 'todo');
    expect(within(item).getByRole('link', { name: 'Vai alla comunicazione' })).toHaveAttribute('href', '#questura-communication');
    expect(await screen.findByTestId('questura-state')).toHaveAttribute('data-state', 'overdue');
    expect(screen.getByText('Conduttore extra-UE: comunicazione alla Questura entro 48 ore dalla consegna')).toBeInTheDocument();
  });

  it('render_EnglishUi_TranslatesTheRegistrationPanel', async () => {
    await i18n.changeLanguage('en');
    mockApi(() => signedLease());

    renderPage();

    const panel = await registrationPanel();
    expect(panel.getByTestId('rli-registration-state')).toHaveTextContent('To register');
    expect(panel.getByRole('button', { name: 'Enter registration details' })).toBeInTheDocument();
    expect(panel.getByText('How to register the contract')).toBeInTheDocument();
  });
});

// CF-END: «Contratto registrato: ora fai valere le agevolazioni», what follows the registration of a canone concordato.
describe('LeaseDetailPage — the follow-up of a registered canone concordato (CF-END)', () => {
  const FOLLOW_UP = 'Contratto registrato: ora fai valere le agevolazioni';

  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  /** A canone concordato registered, whose signed contract and receipt are the lease's own files. */
  function registeredConcordato(overrides: Partial<LeaseDetail> = {}): LeaseDetail {
    return signedLease({
      status: 'Registered',
      contractType: 'Concordato',
      fiscalRegime: 'CanoneConcordato',
      registration: registration({ registrationCode: 'PROT-9', registrationDate: '2026-10-05T00:00:00Z' }),
      ...overrides,
    });
  }

  /** The lease, its documents and the step its row in the list says it waits for (none, by default); a download answers with a file. */
  function mockSheet(lease: LeaseDetail, documents: ReturnType<typeof leaseDocument>[], nextStep?: LeaseNextStep) {
    get.mockImplementation((url: string) => {
      if (url === '/leases/lease-1') return Promise.resolve({ data: lease });
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id: 'lease-1', nextStep })] });
      if (url === '/leases/lease-1/documents') return Promise.resolve({ data: documents });
      if (/^\/leases\/lease-1\/documents\/[\w-]+\/download$/.test(url)) return Promise.resolve({ data: new Blob(['%PDF-1.4']) });
      return Promise.reject(httpError(404));
    });
  }

  it('render_RegisteredConcordatoWithoutAttestation_SaysItIsMissingAndOffersTheUpload', async () => {
    // The signed contract and the receipt are the lease's own files; the attestation is not among its documents.
    mockSheet(registeredConcordato(), []);

    renderPage('?tab=dati');

    const block = await screen.findByTestId('lease-benefits');
    expect(block).toHaveAttribute('data-variant', 'focus');
    expect(within(block).getByRole('heading', { level: 2 })).toHaveTextContent(FOLLOW_UP);
    const attestation = within(block).getByTestId('lease-benefit-attestation');
    await waitFor(() => expect(attestation).toHaveTextContent('Attestazione: ancora da caricare'));
    expect(within(block).getByTestId('lease-benefits-missing')).toHaveTextContent('Te ne manca ancora uno');
    // What exists is there to download, what is missing is there to upload.
    expect(within(block).getAllByRole('button', { name: /^Scarica:/ })).toHaveLength(2);
    fireEvent.click(within(attestation).getByRole('button', { name: "Carica l'attestazione" }));
    expect(await screen.findByTestId('lease-document-upload-dialog')).toHaveTextContent("Carica l'attestazione");
    // The two figures of the rules, the sentence that sends the person to the accountant, and no name of the supplier.
    expect(block).toHaveTextContent('25%');
    expect(block).toHaveTextContent('10%');
    expect(block).toHaveTextContent('Le regole e le aliquote dipendono dal comune e dalla tua situazione: confermale con il tuo commercialista.');
    expect(block.textContent).not.toMatch(/partner|concordato\s*facile/i);
  });

  it('render_RegisteredConcordatoWithTheThreeDocuments_OffersThreeDownloads', async () => {
    // None of them is a file of the lease itself: the three are documents uploaded to it.
    mockSheet(registeredConcordato({ hasSignedPdf: false, registration: registration({ hasReceipt: false }) }), [
      leaseDocument('doc-contract', 'Contract', 'contratto.pdf'),
      leaseDocument('doc-attestation', 'Attestation', 'attestazione.pdf'),
      leaseDocument('doc-receipt', 'Registration', 'ricevuta.pdf'),
    ]);

    renderPage('?tab=dati');

    const block = await screen.findByTestId('lease-benefits');
    expect(await within(block).findAllByRole('button', { name: /^Scarica:/ })).toHaveLength(3);
    expect(within(block).queryByTestId('lease-benefits-missing')).not.toBeInTheDocument();
    expect(within(block).queryByRole('button', { name: /^Carica/ })).not.toBeInTheDocument();
    fireEvent.click(within(block).getByRole('button', { name: 'Scarica: Attestazione' }));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'attestazione.pdf'));
    expect(get).toHaveBeenCalledWith('/leases/lease-1/documents/doc-attestation/download', { responseType: 'blob' });
  });

  it('render_RegisteredLibero_ShowsNoFollowUpAndAsksForNoDocuments', async () => {
    mockSheet(signedLease({ status: 'Registered', registration: registration() }), []);

    renderPage('?tab=dati');

    await screen.findAllByTestId('lease-party');
    expect(screen.queryByTestId('lease-benefits')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).endsWith('/documents'))).toBe(false);
  });

  it('render_RegisteredConcordatoWithAStepToDo_KeepsTheStepAsTheBlockAndTheFollowUpIsQuietUnderIt', async () => {
    mockSheet(registeredConcordato(), [leaseDocument('doc-attestation', 'Attestation', 'attestazione.pdf')], {
      code: 'ActivateRentPlan',
      actor: 'Landlord',
      priority: 4,
      dueOn: null,
      params: {},
    });

    renderPage('?tab=dati');

    expect(await screen.findByTestId('lease-now')).toHaveTextContent('Attiva il piano dei canoni');
    expect(screen.getByTestId('lease-benefits')).toHaveAttribute('data-variant', 'calm');
  });

  it('render_RegisteredConcordatoAllInOrder_TheFollowUpTakesThePlaceOfTheQuietLine', async () => {
    mockSheet(registeredConcordato(), [leaseDocument('doc-attestation', 'Attestation', 'attestazione.pdf')], {
      code: 'AllGood',
      actor: 'System',
      priority: 9,
      dueOn: null,
      params: {},
    });

    renderPage('?tab=dati');

    expect(await screen.findByTestId('lease-benefits')).toHaveAttribute('data-variant', 'focus');
    expect(screen.queryByTestId('lease-now-quiet')).not.toBeInTheDocument();
  });
});
