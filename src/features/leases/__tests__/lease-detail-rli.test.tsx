import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { formatDate } from '@/lib/utils';
import { RLI_OFFICIAL_INFO_URL } from '@/lib/rli-registration-state';
import { LeaseDetailPage } from '../lease-detail-page';
import { buildDetail, httpError, renderAt } from './lease-test-utils';
import type { LeaseDetail, LeaseRegistration, RliChecklist } from '@/types';

// LT-01 (A7-01): the RLI part of the lease page with the real registration panel, checklist, manual dialog and delega
// dialog. Only the unrelated panels are stubbed.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/cedolare-decision-panel', () => ({ CedolareDecisionPanel: () => null }));
vi.mock('../components/canone-concordato-calculator', () => ({ CanoneConcordatoCalculator: () => null }));
vi.mock('../components/attestation-guidance-panel', () => ({ AttestationGuidancePanel: () => null }));
vi.mock('../components/imu-notification-export-button', () => ({ ImuNotificationExportButton: () => null }));
vi.mock('../components/lease-signing-panel', () => ({ LeaseSigningPanel: () => null }));

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

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

function mockApi(lease: () => LeaseDetail, rliChecklist: RliChecklist = checklist()) {
  get.mockImplementation((url: string) => {
    if (url === '/leases/lease-1') return Promise.resolve({ data: lease() });
    if (url === '/leases/lease-1/rli/checklist') return Promise.resolve({ data: rliChecklist });
    return Promise.reject(httpError(404));
  });
}

function renderPage() {
  return renderAt('/app/long-rent/leases/lease-1', '/app/long-rent/leases/:id', createElement(LeaseDetailPage));
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
    // Nothing says "sent" or "registered" for a lease that is only signed.
    expect(screen.getByTestId('rli-checklist-item-rli_registered')).toHaveAttribute('data-state', 'todo');
    expect(screen.queryByText(/inviat[oa] con successo/i)).not.toBeInTheDocument();
  });

  it('render_SignedBeforeStart_ShowsStipulaAndDeadlineFromTheApi', async () => {
    // LT-04 (A7-04): signed 1/8, start 1/10 → the API computes 31/8; the page shows it, never StartDate + 30.
    mockApi(() =>
      signedLease({ stipulaDate: '2026-08-01T00:00:00Z', registrationDeadline: '2026-08-31T00:00:00Z' }),
    );

    renderPage();

    expect(await screen.findByTestId('lease-stipula-date')).toHaveTextContent(formatDate('2026-08-01T00:00:00Z'));
    expect(screen.getByTestId('lease-registration-deadline')).toHaveTextContent(formatDate('2026-08-31T00:00:00Z'));
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

    renderPage();

    expect(await screen.findByTestId('lease-registration-deadline')).toHaveTextContent('Da determinare');
    expect(screen.getByTestId('lease-stipula-date')).toHaveTextContent('Non ancora disponibile');
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
    expect(screen.getByTestId('rli-checklist-item-rli_registered')).toHaveAttribute('data-state', 'todo');
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

    renderPage();

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
