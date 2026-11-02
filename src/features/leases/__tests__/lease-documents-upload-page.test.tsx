import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { LeaseDocumentsUploadPage } from '../lease-documents-upload-page';
import { LEASE_CONFIRMED_STATE } from '../lib/upload-link';
import { buildDetail, buildSummary, httpError, renderAt } from './lease-test-utils';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
const id = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const practice = 'P-0123456789ABCDEF';
const lookupUrl = `/concordatofacile/practices/${practice}/lease`;
const path = '/app/long-rent/documents/upload';
const get = vi.mocked(axios.get); const post = vi.mocked(axios.post);
// A link of the app, or a contract the person has confirmed: the documents come at once (CF-FIX-FU4).
function renderPage(query = '') { return renderAt(`${path}${query}`, path, createElement(LeaseDocumentsUploadPage), LEASE_CONFIRMED_STATE); }
// A link from outside (the button of the e-mail, an old link with only the lease): the page asks which contract before anything else.
function renderFromOutside(query = '') { return renderAt(`${path}${query}`, path, createElement(LeaseDocumentsUploadPage)); }

describe('lease-owned partner documents', () => {
  beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('it'); });
  it('guards the upload route with lease read and lease write permissions', () => {
    expect(ROUTE_MANIFEST.find((route) => route.path === path)?.requiredPermissions).toEqual(['lease.read', 'lease.create']);
  });
  it.each(['?leaseId=bad', `?leaseId=${id}&leaseId=${id}`, '?leaseId=', '?propertyId=0f65c27e-0c89-42e1-b0e9-e2e09e73ee79'])('rejects invalid references or a property-only upload: %s', (query) => {
    renderPage(query); expect(screen.getByText(i18n.t('cfDocuments.invalidLease'))).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  });
  it('never reads documents when the lease is forbidden', async () => {
    get.mockRejectedValue(httpError(403)); renderPage(`?leaseId=${id}`);
    expect(await screen.findByText(i18n.t('cfDocuments.leaseError'))).toBeInTheDocument();
    expect(get.mock.calls.every(([url]) => url === `/leases/${id}`)).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });
  it('uploads to the lease, never to the property, and lists the persisted attachment', async () => {
    let saved = false;
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: saved ? [{ id: 'doc-1', leaseId: id, kind: 'Attestation', fileName: 'attestazione.pdf', sizeBytes: 10, uploadedAt: '2026-10-21T10:00:00Z' }] : [] });
      return Promise.reject(httpError(404));
    });
    post.mockImplementation(async () => { saved = true; return { data: { id: 'doc-1' } }; });
    renderPage(`?leaseId=${id}&propertyId=untrusted-house`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(i18n.t('cfDocuments.kind')), { target: { value: 'Attestation' } });
    const file = new File(['%PDF-1.7\nexample'], 'attestazione.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('cfDocuments.upload') }));
    await screen.findByText('attestazione.pdf');
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]; expect(url).toBe(`/leases/${id}/documents`);
    expect((body as FormData).get('kind')).toBe('Attestation'); expect((body as FormData).get('file')).toBe(file);
    expect(get.mock.calls.some(([url]) => String(url).includes('/properties/'))).toBe(false);
  });
  it('retains the selected file and reports a failed upload without a false saved state', async () => {
    get.mockImplementation((url) => Promise.resolve({ data: url === `/leases/${id}` ? buildDetail({ id }) : [] }));
    post.mockRejectedValue(httpError(500)); renderPage(`?leaseId=${id}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    const file = new File(['%PDF-1.7'], 'contratto.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('cfDocuments.upload') }));
    await screen.findByText(i18n.t('cfDocuments.uploadError'));
    expect(screen.queryByText(i18n.t('cfDocuments.saved'))).not.toBeInTheDocument();
    expect(screen.getByText('1. contratto.pdf')).toBeInTheDocument();
  });
  it('rejects another lease document in the server list rather than exposing it', async () => {
    get.mockImplementation((url) => Promise.resolve({ data: url === `/leases/${id}` ? buildDetail({ id }) : [{ id: 'foreign', leaseId: 'other-lease', fileName: 'private.pdf' }] }));
    renderPage(`?leaseId=${id}`);
    await screen.findByText(i18n.t('cfDocuments.documentsError'));
    expect(screen.queryByText('private.pdf')).not.toBeInTheDocument();
  });
  it('a bare link asks for an existing lease and never invents an identifier', async () => {
    get.mockResolvedValue({ data: [] }); renderPage();
    await screen.findByText(i18n.t('cfDocuments.noLeases')); expect(post).not.toHaveBeenCalled();
    await waitFor(() => expect(get).toHaveBeenCalled());
  });

  // CF-FIX: the button «Carica i dati in CasaZen» of ConcordatoFacile opens this page with `?practice=P-…`.
  it('a practice the server links to a lease shows the documents of that lease, never the list of contracts', async () => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.resolve({ data: { leaseId: id, practiceId: practice, status: 'InProgress', manualSelectionRequired: false } });
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?practice=${practice}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByTestId('cf-documents-practice')).toHaveTextContent(i18n.t('cfDocuments.practice.linked', { practice }));
    expect(screen.queryByText(i18n.t('cfDocuments.chooseLease'))).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === '/leases')).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
  it('a practice the server does not find (or while the service is off) loads no contract until the person chooses one', async () => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.reject(httpError(404, { code: 'practice_not_found' }));
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id })] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?practice=${practice}`);
    expect(await screen.findByText(i18n.t('cfDocuments.practice.notFound'))).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('cfDocuments.chooseLease'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('cfDocuments.backToHouses'))).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/leases/'))).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
  it('a practice not linked yet asks for the contract and goes on with the one chosen, keeping the practice in the address', async () => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.resolve({ data: { leaseId: null, practiceId: practice, status: null, manualSelectionRequired: true } });
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id })] });
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?practice=${practice}`);
    expect(await screen.findByTestId('cf-documents-practice-manual')).toHaveTextContent(practice);
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/leases/'))).toBe(false);
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(id) }));
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByTestId('cf-documents-practice')).toHaveTextContent(i18n.t('cfDocuments.practice.chosen', { practice }));
    expect(get.mock.calls.filter(([url]) => url === lookupUrl)).toHaveLength(1);
  });
  it.each(['?practice=P-123', `?practice=${practice}&practice=${practice}`, '?practice='])('a practice number that is not one is an invalid link, never looked up: %s', async (query) => {
    get.mockResolvedValue({ data: [] });
    renderPage(query);
    expect(await screen.findByTestId('cf-documents-practice-invalid')).toHaveTextContent(i18n.t('cfDocuments.practice.invalid'));
    await screen.findByText(i18n.t('cfDocuments.noLeases'));
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
  });
  it('a lease named in the link is the only one shown, whatever the practice says', async () => {
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?leaseId=${id}&practice=${practice}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByTestId('cf-documents-practice')).toHaveTextContent(i18n.t('cfDocuments.practice.chosen', { practice }));
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
  });

  // CF-FIX-FU4: a link from outside says which contract, the person has not: one explicit step before the upload, for the practice of the
  // e-mail and for the old link with only the lease, with the way to another contract.
  it.each([
    ['a practice the server links to a lease', `?practice=${practice}`, 'confirmWithPractice'],
    ['an old link with only the lease', `?leaseId=${id}`, 'confirmWithoutPractice'],
  ] as const)('%s asks to confirm the contract before showing the upload', async (_label, query, key) => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.resolve({ data: { leaseId: id, practiceId: practice, status: 'InProgress', manualSelectionRequired: false } });
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id })] });
      return Promise.reject(httpError(404));
    });
    renderFromOutside(query);

    const confirm = await screen.findByTestId('cf-documents-confirm');
    expect(confirm).toHaveTextContent(i18n.t(`guidedContract.${key}`, { practice, lease: 'Casa Trastevere · Roma' }));
    // Nothing can be uploaded, and the contract is not shown, before the person has said it is the right one.
    expect(screen.queryByLabelText(i18n.t('documentPages.select'))).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === `/leases/${id}/documents`)).toBe(false);

    fireEvent.click(screen.getByTestId('cf-documents-confirm-button'));

    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByLabelText(i18n.t('documentPages.select'))).toBeInTheDocument();
    expect(screen.queryByTestId('cf-documents-confirm')).not.toBeInTheDocument();
  });
  it('«Scegli un altro contratto» lists the contracts, and the one chosen there needs no second confirmation', async () => {
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id })] });
      return Promise.reject(httpError(404));
    });
    renderFromOutside(`?leaseId=${id}`);

    fireEvent.click(await screen.findByTestId('cf-documents-confirm-other'));
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(id) }));

    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.queryByTestId('cf-documents-confirm')).not.toBeInTheDocument();
  });

  // CF-IMPORT: the contract ConcordatoFacile delivers goes on to «Completa e importa il contratto» only from the draft it was made for,
  // once a contract document is there; any other contract is left alone (it does not even ask how a reading stands).
  it.each([
    ['the draft of the partner with the contract uploaded', { origin: 'Imported', isConcordatoFacileSource: true }, 'Done', true, true],
    ['the draft of the partner before any contract is uploaded', { origin: 'Imported', isConcordatoFacileSource: true }, 'None', false, true],
    ['an imported draft that is not the partner’s', { origin: 'Imported', isConcordatoFacileSource: false }, 'Done', false, false],
    ['the contract of the partner once it is signed', { origin: 'Imported', isConcordatoFacileSource: true, status: 'Signed' }, 'Done', false, false],
  ] as const)('offers the import of the contract only for %s', async (_label, detail, state, offered, asked) => {
    const readingUrl = `/leases/${id}/draft/reading`;
    const documents = state === 'None' ? [] : [{ id: 'doc-1', fileName: 'contratto.pdf', status: 'Completed', error: null }];
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id, ...detail }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      if (url === readingUrl) return Promise.resolve({ data: { state, documents, fields: [], stipulaDate: null, contractDocumentId: documents[0]?.id ?? null } });
      return Promise.reject(httpError(404));
    });

    renderPage(`?leaseId=${id}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));

    if (asked) await waitFor(() => expect(get.mock.calls.some(([url]) => url === readingUrl)).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(get.mock.calls.some(([url]) => url === readingUrl)).toBe(asked);
    if (offered) {
      expect(await screen.findByTestId('cf-import-panel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: i18n.t('cfDocuments.import.action') })).toBeEnabled();
    } else {
      expect(screen.queryByTestId('cf-import-panel')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('cfDocuments.import.action') })).not.toBeInTheDocument();
    }
  });
  it('while the contract is being read the import button waits and says so', async () => {
    const documents = [{ id: 'doc-1', fileName: 'contratto.pdf', status: 'Processing', error: null }];
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id, origin: 'Imported', isConcordatoFacileSource: true }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      if (url === `/leases/${id}/draft/reading`) return Promise.resolve({ data: { state: 'Reading', documents, fields: [], stipulaDate: null, contractDocumentId: 'doc-1' } });
      return Promise.reject(httpError(404));
    });

    renderPage(`?leaseId=${id}`);

    const waiting = await screen.findByRole('button', { name: i18n.t('guidedContract.reading') });
    expect(waiting).toBeDisabled();
    expect(screen.queryByRole('button', { name: i18n.t('cfDocuments.import.action') })).not.toBeInTheDocument();
  });

  // CF-DONE: an upload moves the lease of the guided service on without leaving the page. The server reads the file into the draft and,
  // once the practice allows it, imports the contract and declares the registration; the page tells what became of the lease.
  describe('the lease of the guided service follows its practice', () => {
    const syncUrl = `/leases/${id}/concordatofacile/sync`;
    const syncCalls = () => post.mock.calls.filter(([url]) => url === syncUrl);

    /** The same page with the service on (the flags of a person are off without a provider): the sync is asked once the contract is confirmed. */
    function renderWithService(query: string, state: unknown = LEASE_CONFIRMED_STATE) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      return render(
        <QueryClientProvider client={client}>
          <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, concordatoFacile: true }, isLoading: false }}>
            <MemoryRouter initialEntries={[{ pathname: path, search: query, state }]}>
              <Routes>
                <Route path={path} element={<LeaseDocumentsUploadPage />} />
              </Routes>
            </MemoryRouter>
          </FeatureFlagsContext.Provider>
        </QueryClientProvider>,
      );
    }

    /** The lease of the service as the server has it now: `status()` says which, the documents none. */
    function mockServiceLease(status: () => 'Draft' | 'Signed' | 'Registered' = () => 'Draft') {
      get.mockImplementation((url) => {
        if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id, origin: 'Imported', isConcordatoFacileSource: true, status: status() }) });
        if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
        if (url === `/leases/${id}/draft/reading`) return Promise.resolve({ data: { state: 'None', documents: [], fields: [], stipulaDate: null, contractDocumentId: null } });
        return Promise.reject(httpError(404));
      });
    }

    it.each([
      ['Signed', 'WaitingForReceipt', 'signed'],
      ['Registered', 'Completed', 'registered'],
    ] as const)('asks the server to move the lease on once, and says what the documents did to it: %s', async (leaseStatus, state, outcome) => {
      let status: 'Draft' | 'Signed' | 'Registered' = 'Draft';
      mockServiceLease(() => status);
      post.mockImplementation((url) => {
        if (url !== syncUrl) return Promise.reject(httpError(404));
        status = leaseStatus; // the server read the documents and moved the lease on
        return Promise.resolve({ data: { state, leaseStatus } });
      });

      renderWithService(`?leaseId=${id}`);

      expect(await screen.findByTestId('cf-documents-outcome')).toHaveTextContent(i18n.t(`cfDocuments.outcome.${outcome}`));
      expect(syncCalls()).toHaveLength(1);
      expect(screen.getByRole('link', { name: i18n.t('cfDocuments.openLease') })).toHaveAttribute('href', `/app/long-rent/leases/${id}`);
    });

    it('says nothing of an outcome while the lease is still a draft', async () => {
      mockServiceLease();
      post.mockResolvedValue({ data: { state: 'WaitingForContract', leaseStatus: 'Draft' } });

      renderWithService(`?leaseId=${id}`);

      await screen.findByText(i18n.t('cfDocuments.empty'));
      await waitFor(() => expect(syncCalls()).toHaveLength(1));
      expect(screen.queryByTestId('cf-documents-outcome')).not.toBeInTheDocument();
    });

    it('asks nothing before the person has said the contract is the right one, then asks once', async () => {
      mockServiceLease();
      post.mockResolvedValue({ data: { state: 'WaitingForContract', leaseStatus: 'Draft' } });

      // A link from outside: the history entry carries no confirmation (`null`: an explicit `undefined` would take the default one).
      renderWithService(`?leaseId=${id}`, null);

      const confirm = await screen.findByTestId('cf-documents-confirm-button');
      // A link from outside decides nothing on its own: not even the lease is moved on before the person has confirmed it.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(post).not.toHaveBeenCalled();
      fireEvent.click(confirm);
      await screen.findByText(i18n.t('cfDocuments.empty'));
      await waitFor(() => expect(syncCalls()).toHaveLength(1));
    });

    it('asks nothing of the service while it is off, whatever the lease', async () => {
      mockServiceLease();

      renderPage(`?leaseId=${id}`);

      await screen.findByText(i18n.t('cfDocuments.empty'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(post).not.toHaveBeenCalled();
    });

    it('asks again when a document is uploaded, so the lease moves on without leaving the page', async () => {
      mockServiceLease();
      post.mockImplementation((url) => {
        if (url === syncUrl) return Promise.resolve({ data: { state: 'WaitingForContract', leaseStatus: 'Draft' } });
        return Promise.resolve({ data: { id: 'doc-1' } });
      });

      renderWithService(`?leaseId=${id}`);
      await screen.findByText(i18n.t('cfDocuments.empty'));
      await waitFor(() => expect(syncCalls()).toHaveLength(1));

      const file = new File(['%PDF-1.7\nexample'], 'contratto.pdf', { type: 'application/pdf' });
      fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: i18n.t('cfDocuments.upload') }));

      await waitFor(() => expect(post.mock.calls.some(([url]) => url === `/leases/${id}/documents`)).toBe(true));
      await waitFor(() => expect(syncCalls()).toHaveLength(2));
    });
  });
});
