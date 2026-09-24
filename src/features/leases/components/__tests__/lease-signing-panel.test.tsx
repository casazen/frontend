import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { formatDate } from '@/lib/utils';
import { LeaseSigningPanel } from '../lease-signing-panel';
import { httpError } from '../../__tests__/lease-test-utils';
import type { LeaseDetail, LeaseSigner, LeaseSigningState } from '@/types';

// LT-02 (A7-02, A7-16): the signature panel with the real API client and query hooks; only axios is mocked.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

const TODAY = '2026-09-24';
const SIGNERS_URL = '/leases/lease-1/signers';

type PanelLease = Pick<LeaseDetail, 'id' | 'status' | 'stipulaDate' | 'hasSignedPdf'>;

function lease(overrides: Partial<PanelLease> = {}): PanelLease {
  return { id: 'lease-1', status: 'Draft', stipulaDate: null, hasSignedPdf: false, ...overrides };
}

function signer(overrides: Partial<LeaseSigner> = {}): LeaseSigner {
  return {
    partyId: 'party-landlord',
    role: 'Landlord',
    firstName: 'Mario',
    lastName: 'Rossi',
    method: 'Offline',
    status: 'Pending',
    signingUrl: null,
    signingUrlExpiresAt: null,
    signingUrlExpired: false,
    signedAt: null,
    ...overrides,
  };
}

function state(overrides: Partial<LeaseSigningState> = {}): LeaseSigningState {
  return {
    providerSigningAvailable: false,
    contractAvailable: true,
    contractUnavailableCode: null,
    signers: [
      signer(),
      signer({ partyId: 'party-tenant', role: 'Tenant', firstName: 'Giulia', lastName: 'Verdi' }),
    ],
    ...overrides,
  };
}

function mockSigning(response: () => Promise<unknown>) {
  get.mockImplementation((url: string) => (url === SIGNERS_URL ? response() : Promise.reject(httpError(404))));
}

function renderPanel(panelLease: PanelLease = lease()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(LeaseSigningPanel, { lease: panelLease })));
}

async function panel() {
  const element = await screen.findByTestId('lease-signing-panel');
  await waitFor(() => expect(within(element).queryByTestId('lease-signing-loading')).not.toBeInTheDocument());
  return within(element);
}

function pdf(name = 'contratto-firmato.pdf', type = 'application/pdf') {
  return new File(['%PDF-1.4 firmato'], name, { type });
}

/** A 422 as axios rejects it for a `responseType: 'blob'` request: the JSON ProblemDetails arrives as a Blob. */
function blobProblem(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data: new Blob([JSON.stringify({ status, code })], { type: 'application/problem+json' }),
    statusText: '',
    headers: {},
    config,
  });
}

describe('LeaseSigningPanel (LT-02)', () => {
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

  it('render_DraftApprovedTemplateFlagOff_ShowsOfflineStepsAndNoProviderPath', async () => {
    mockSigning(() => Promise.resolve({ data: state() }));

    renderPanel();

    const p = await panel();
    expect(p.getByTestId('lease-signing-state')).toHaveTextContent('Da firmare');
    const signers = p.getAllByTestId('lease-signer');
    expect(signers).toHaveLength(2);
    expect(within(signers[0]).getByText('Mario Rossi')).toBeInTheDocument();
    expect(within(signers[0]).getByTestId('lease-signer-status')).toHaveTextContent('Da firmare');
    expect(within(signers[0]).getByText('Firma su carta o con la propria firma digitale')).toBeInTheDocument();
    const offline = within(p.getByTestId('lease-signing-offline'));
    expect(offline.getByText(/su carta, con firma autografa/)).toBeInTheDocument();
    expect(offline.getByText(/non verifica le firme/)).toBeInTheDocument();
    expect(offline.getByRole('button', { name: 'Scarica contratto da firmare' })).toBeEnabled();
    expect(offline.getByRole('button', { name: 'Carica contratto firmato' })).toBeEnabled();
    expect(offline.getByRole('button', { name: 'Anteprima (non valida per la firma)' })).toBeEnabled();
    // No provider path and no fake link: nothing is sent to anyone.
    expect(p.queryByTestId('lease-signing-provider')).not.toBeInTheDocument();
    expect(p.queryByRole('link')).not.toBeInTheDocument();
    expect(p.queryByText(/example\.com/)).not.toBeInTheDocument();
  });

  it('render_TemplateNotApproved_DisablesDownloadAndUploadAndExplainsOnlyTheBozzaExists', async () => {
    mockSigning(() =>
      Promise.resolve({ data: state({ contractAvailable: false, contractUnavailableCode: 'contract_template_not_approved' }) }),
    );

    renderPanel();

    const p = await panel();
    expect(p.getByTestId('lease-contract-unavailable')).toHaveTextContent(/non è ancora approvato.*BOZZA/);
    expect(p.getByRole('button', { name: 'Scarica contratto da firmare' })).toBeDisabled();
    expect(p.getByRole('button', { name: 'Carica contratto firmato' })).toBeDisabled();
    expect(p.getByRole('button', { name: 'Anteprima (non valida per la firma)' })).toBeEnabled();
  });

  it('render_SignersLoadError_ShowsErrorWithRetryNotAnEmptyList', async () => {
    let calls = 0;
    mockSigning(() => (++calls === 1 ? Promise.reject(httpError(500)) : Promise.resolve({ data: state() })));

    renderPanel();

    const alert = await screen.findByTestId('lease-signing-error');
    expect(alert).toHaveTextContent('Impossibile caricare lo stato della firma. Riprova.');
    expect(screen.queryByText('Nessuna parte registrata nel contratto.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-signer')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findAllByTestId('lease-signer')).toHaveLength(2);
  });

  it('uploadSigned_CompleteForm_PostsPdfAndStipulaDate', async () => {
    mockSigning(() => Promise.resolve({ data: state() }));
    post.mockResolvedValue({ data: { id: 'lease-1', status: 'Signed' } });

    renderPanel();
    fireEvent.click((await panel()).getByRole('button', { name: 'Carica contratto firmato' }));
    const dialog = within(await screen.findByTestId('signed-contract-dialog'));
    const submit = dialog.getByRole('button', { name: 'Salva la firma' });
    expect(submit).toBeDisabled();

    fireEvent.change(dialog.getByLabelText('Contratto firmato (PDF, massimo 20 MB)'), { target: { files: [pdf()] } });
    fireEvent.change(dialog.getByLabelText('Data di stipula'), { target: { value: '2026-08-20' } });
    expect(submit).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] as [string, FormData];
    expect(url).toBe('/leases/lease-1/signed-document');
    expect(body.get('stipulaDate')).toBe('2026-08-20');
    expect((body.get('signedContract') as File).name).toBe('contratto-firmato.pdf');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Contratto firmato salvato'));
    await waitFor(() => expect(screen.queryByTestId('signed-contract-dialog')).not.toBeInTheDocument());
  });

  it('uploadSigned_NotAPdfOrStipulaInTheFuture_CannotSubmit', async () => {
    mockSigning(() => Promise.resolve({ data: state() }));

    renderPanel();
    fireEvent.click((await panel()).getByRole('button', { name: 'Carica contratto firmato' }));
    const dialog = within(await screen.findByTestId('signed-contract-dialog'));
    fireEvent.change(dialog.getByLabelText('Contratto firmato (PDF, massimo 20 MB)'), {
      target: { files: [pdf('contratto.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')] },
    });
    fireEvent.change(dialog.getByLabelText('Data di stipula'), { target: { value: '2026-09-25' } });
    fireEvent.click(dialog.getByRole('checkbox'));

    expect(dialog.getByText('Il file deve essere un PDF di al massimo 20 MB.')).toBeInTheDocument();
    expect(dialog.getByText(`Inserisci una data valida non successiva a oggi (${formatDate(TODAY)}).`)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Salva la firma' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('uploadSigned_ServerRejectsTheFile_ShowsTheTranslatedProblemAndKeepsTheDialog', async () => {
    mockSigning(() => Promise.resolve({ data: state() }));
    post.mockRejectedValue(httpError(422, { code: 'lease_signed_contract_invalid' }));

    renderPanel();
    fireEvent.click((await panel()).getByRole('button', { name: 'Carica contratto firmato' }));
    const dialog = within(await screen.findByTestId('signed-contract-dialog'));
    fireEvent.change(dialog.getByLabelText('Contratto firmato (PDF, massimo 20 MB)'), { target: { files: [pdf()] } });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Salva la firma' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Il contratto firmato deve essere un file PDF di al massimo 20 MB.'),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('signed-contract-dialog')).toBeInTheDocument();
  });

  it('downloadContract_TemplateGateAnswers422_ShowsTheTranslatedReason', async () => {
    mockSigning(() => Promise.resolve({ data: state() }));
    const p = await (async () => {
      renderPanel();
      return panel();
    })();
    get.mockImplementation((url: string) =>
      url === '/leases/lease-1/contract.pdf'
        ? Promise.reject(blobProblem(422, 'contract_template_not_approved'))
        : Promise.resolve({ data: state() }),
    );

    fireEvent.click(p.getByRole('button', { name: 'Scarica contratto da firmare' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Il modello di contratto per questo regime fiscale non è approvato: è disponibile solo l'anteprima BOZZA, non valida per la firma.",
      ),
    );
    expect(get).toHaveBeenCalledWith('/leases/lease-1/contract.pdf', { responseType: 'blob' });
  });

  it('render_ProviderLinksAfterARefresh_ShowsPersistedLinksAndTheExpiredBadge', async () => {
    // A7-16: the links come from the API (persisted signers), not from the state of the page that started the signing.
    mockSigning(() =>
      Promise.resolve({
        data: state({
          providerSigningAvailable: true,
          signers: [
            signer({
              method: 'Provider',
              signingUrl: 'https://sign.provider.test/landlord',
              signingUrlExpiresAt: '2026-10-01T10:00:00Z',
            }),
            signer({
              partyId: 'party-tenant',
              role: 'Tenant',
              firstName: 'Giulia',
              lastName: 'Verdi',
              method: 'Provider',
              signingUrl: 'https://sign.provider.test/tenant',
              signingUrlExpiresAt: '2026-09-20T10:00:00Z',
              signingUrlExpired: true,
            }),
          ],
        }),
      }),
    );

    renderPanel(lease({ status: 'AwaitingSignature' }));

    const p = await panel();
    expect(p.getByTestId('lease-signing-state')).toHaveTextContent('Firma elettronica in corso');
    expect(p.getByTestId('lease-signing-provider-note')).toHaveTextContent(/solo quando il provider comunicherà/);
    const [landlord, tenant] = p.getAllByTestId('lease-signer');
    expect(within(landlord).getByRole('link', { name: 'Apri link di firma' })).toHaveAttribute(
      'href',
      'https://sign.provider.test/landlord',
    );
    expect(within(landlord).queryByTestId('lease-signer-link-expired')).not.toBeInTheDocument();
    expect(within(tenant).getByTestId('lease-signer-link-expired')).toHaveTextContent('Link scaduto');
    // The offline path stays available as an alternative; the provider cannot be started twice.
    expect(p.getByText('In alternativa: firma su carta o con firma digitale')).toBeInTheDocument();
    expect(p.queryByTestId('lease-signing-provider')).not.toBeInTheDocument();
  });

  it('startProvider_ProviderAvailableOnDraft_PostsSigningAndSaysNothingIsSignedYet', async () => {
    mockSigning(() => Promise.resolve({ data: state({ providerSigningAvailable: true }) }));
    post.mockResolvedValue({ data: { leaseId: 'lease-1', status: 'AwaitingSignature', signers: [] } });

    renderPanel();
    const provider = within((await panel()).getByTestId('lease-signing-provider'));
    fireEvent.click(provider.getByRole('button', { name: 'Invia per firma elettronica' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/leases/lease-1/signing', undefined, undefined));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Link di firma creati: il contratto non è ancora firmato'),
    );
  });

  it('render_SignedLegacyWithoutStipula_OffersTheDeclarationAndPostsIt', async () => {
    mockSigning(() =>
      Promise.resolve({
        data: state({
          contractAvailable: false,
          contractUnavailableCode: 'lease_already_signed',
          signers: [signer({ status: 'Signed' })],
        }),
      }),
    );
    post.mockResolvedValue({ data: { id: 'lease-1', status: 'Signed', stipulaDate: '2026-08-10T00:00:00Z' } });

    renderPanel(lease({ status: 'Signed', stipulaDate: null, hasSignedPdf: false }));

    const p = await panel();
    expect(p.getByTestId('lease-signing-state')).toHaveTextContent('Firmato');
    expect(p.getByTestId('lease-stipula-missing')).toHaveTextContent(/resta da determinare/);
    expect(p.getByText('Il contratto firmato non è stato caricato in CasaZen.')).toBeInTheDocument();
    expect(p.queryByTestId('lease-signing-offline')).not.toBeInTheDocument();

    fireEvent.click(p.getByRole('button', { name: 'Dichiara data di stipula' }));
    const dialog = within(await screen.findByTestId('stipula-declaration-dialog'));
    fireEvent.change(dialog.getByLabelText('Data di stipula'), { target: { value: '2026-08-10' } });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Salva la data di stipula' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/leases/lease-1/stipula', { stipulaDate: '2026-08-10' }, undefined),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Data di stipula salvata'));
  });

  it('render_SignedWithPdf_ShowsStipulaAndDownloadsTheSignedContract', async () => {
    mockSigning(() =>
      Promise.resolve({
        data: state({
          contractAvailable: false,
          contractUnavailableCode: 'lease_already_signed',
          signers: [signer({ status: 'Signed', signedAt: '2026-08-20T00:00:00Z' })],
        }),
      }),
    );
    const createObjectURL = vi.fn(() => 'blob:http://localhost/signed');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPanel(lease({ status: 'Registered', stipulaDate: '2026-08-20T00:00:00Z', hasSignedPdf: true }));

    const p = await panel();
    expect(p.getByText(`Data di stipula: ${formatDate('2026-08-20T00:00:00Z')}`)).toBeInTheDocument();
    expect(p.getByText(`Firmato il ${formatDate('2026-08-20T00:00:00Z')}`)).toBeInTheDocument();
    expect(p.queryByTestId('lease-stipula-missing')).not.toBeInTheDocument();
    get.mockImplementation((url: string) =>
      url === '/leases/lease-1/signed-document'
        ? Promise.resolve({ data: new Blob(['%PDF-1.4']) })
        : Promise.resolve({ data: state() }),
    );

    fireEvent.click(p.getByRole('button', { name: 'Scarica contratto firmato' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('contratto-firmato-lease-1.pdf');
    expect(get).toHaveBeenCalledWith('/leases/lease-1/signed-document', { responseType: 'blob' });
    click.mockRestore();
  });

  it('render_EnglishUi_TranslatesTheOfflineFlow', async () => {
    await i18n.changeLanguage('en');
    mockSigning(() => Promise.resolve({ data: state() }));

    renderPanel();

    const p = await panel();
    expect(p.getByText('Contract signature')).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Download contract to sign' })).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Upload signed contract' })).toBeInTheDocument();
  });
});
