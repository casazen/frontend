import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { complianceArchiveApi } from '@/api/compliance-archive.api';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { freezeClock } from '@/test/clock';
import { expectNoAxeViolations } from '@/test/axe';
import { useProperties } from '@/queries/use-properties';
import type { ComplianceArchiveEntry, ComplianceArchivePage, CoverageReport, CoverageRow } from '@/types';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import { AlloggiatiPage } from '../AlloggiatiPage';

vi.mock('@/api/compliance-archive.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/compliance-archive.api')>()),
  complianceArchiveApi: {
    listEvidence: vi.fn(),
    getCoverageReport: vi.fn(),
    getBookingCompliance: vi.fn(),
    downloadProof: vi.fn(),
    exportProofs: vi.fn(),
    exportCoverageReport: vi.fn(),
    uploadProof: vi.fn(),
  },
}));
vi.mock('@/api/octorate-compliance-handoff.api', () => ({ octorateComplianceHandoffApi: { start: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/file-download')>()),
  saveBlobAs: vi.fn(),
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, primary }: { title: string; primary?: { label: string; onClick?: () => void; testId?: string } }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      primary ? createElement('button', { type: 'button', onClick: primary.onClick, 'data-testid': primary.testId }, primary.label) : null,
    ),
}));
const workspace = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => context === 'short-rent' && workspace.permissions.includes(permission) }),
}));

const P1 = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const P2 = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const PROPERTIES = [
  { id: P1, name: 'Casa Como' },
  { id: P2, name: 'Villa Rosa' },
];
const PORTAL = 'https://alloggiatiweb.poliziadistato.it/';
const ARCHIVE = '/app/short-rent/alloggiati/reports';

const entry = (id: string, change: Partial<ComplianceArchiveEntry> = {}): ComplianceArchiveEntry => ({
  id,
  kind: 'IstatProof',
  propertyId: P1,
  propertyName: 'Casa Como',
  day: '2026-08-01',
  period: '2026-08',
  source: 'manual_upload',
  receivedAt: '2026-09-02T10:00:00Z',
  retainUntil: '2031-09-02T10:00:00Z',
  contentType: 'application/pdf',
  downloadPath: `/api/compliance/archive/${id}/download`,
  ...change,
});

const page = (items: ComplianceArchiveEntry[], totalCount = items.length, pageNumber = 1): ComplianceArchivePage => ({ items, page: pageNumber, pageSize: 25, totalCount, alloggiatiPortalUrl: PORTAL });

const row = (evidenceClass: CoverageRow['evidenceClass'], change: Partial<CoverageRow> = {}): CoverageRow => ({
  kind: 'Istat',
  propertyId: P1,
  propertyName: 'Casa Como',
  bookingId: null,
  bookingCode: null,
  day: null,
  period: '2026-08',
  evidenceClass,
  evidenceSource: null,
  proofAt: null,
  deadlineAt: null,
  action: null,
  reason: 'evidence_missing',
  handoffTopic: null,
  ...change,
});

/** What the server answers to «Verifica nel tuo Cassetto Compliance» (the compliance drawer of E03/F05/US02 asks it): where to go, what to look at there. */
const handoff = (topic: ComplianceHandoff['topic'], change: Partial<ComplianceHandoff['context']> = {}): ComplianceHandoff => ({
  handoffId: 'hf_5b0e2c9a41d94c63a8d1',
  startedAt: '2026-11-13T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  topic,
  destinationUrl: 'https://panel.example.com/home',
  destinationKind: 'Home',
  returnPath: ARCHIVE,
  context: { propertyId: P1, propertyName: 'Casa Como', octorateListingName: null, bookingId: null, bookingCode: null, period: null, ...change },
  guide: { code: topic === 'Istat' ? 'istat_period' : 'alloggiati_short_stay', menuPath: 'Strutture, poi Questura', check: "Controlla l'invio." },
});

const report = (rows: CoverageRow[], change: Partial<CoverageReport> = {}): CoverageReport => ({
  from: '2026-08-01',
  to: '2026-08-31',
  propertyId: null,
  generatedAt: '2026-11-13T10:00:00Z',
  complete: false,
  officialProof: rows.filter((item) => item.evidenceClass === 'OfficialProof').length,
  externalVerificationRequired: rows.filter((item) => item.evidenceClass === 'ExternalVerificationRequired').length,
  missing: rows.filter((item) => item.evidenceClass === 'Missing').length,
  notApplicable: rows.filter((item) => item.evidenceClass === 'NotApplicable').length,
  rows,
  ...change,
});

function problem(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: code ? { code } : {}, statusText: '', headers: {}, config });
}

/** True when `secret` is anywhere in `value`, in any text of it, however deep. */
function holds(value: unknown, secret: string, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => holds(item, secret, seen));
}

/** A failed call as axios gives it, with the token of the caller in the request it keeps (a test of the cache of the mutations is only a real one if the token is there to be found). */
function problemWithToken(status: number, code: string): AxiosError {
  const failed = problem(status, code);
  failed.config!.headers.set('Authorization', 'Bearer SECRET-TOKEN');
  expect(holds(failed, 'SECRET-TOKEN')).toBe(true);
  return failed;
}

function Where() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

interface Setup {
  flags?: Partial<typeof DEFAULT_FEATURE_FLAGS>;
  flagsLoading?: boolean;
}

function renderPage(initial = ARCHIVE, setup: Setup = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        FeatureFlagsContext.Provider,
        { value: { flags: { ...DEFAULT_FEATURE_FLAGS, ...setup.flags }, isLoading: setup.flagsLoading ?? false } },
        createElement(MemoryRouter, { initialEntries: [initial] }, createElement(AlloggiatiPage), createElement(Where)),
      ),
    ),
  );
  return { ...view, client };
}

const listCall = (index = 0) => vi.mocked(complianceArchiveApi.listEvidence).mock.calls[index][0];

beforeEach(async () => {
  vi.clearAllMocks();
  freezeClock('2026-11-13T12:00:00Z');
  workspace.permissions = ['booking.read', 'alloggiati.submit', 'payment.read', 'payment.write'];
  await i18n.changeLanguage('it');
  vi.mocked(useProperties).mockReturnValue({ data: PROPERTIES, isLoading: false, isError: false } as unknown as ReturnType<typeof useProperties>);
  vi.mocked(complianceArchiveApi.listEvidence).mockResolvedValue(page([entry('e1')]));
  vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([]));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// E03/F03/US02/T02 (NF-47, NF-52, CHK-08, CHK-12 point 8).
describe('the archive of the proofs: the address and the filters', () => {
  // AC 5 and the links of the cockpit (S061): the page opens already filtered.
  it('AlloggiatiPage_LinkOfTheCockpitWithoutTheSummary_OpensTheProofsOfThatKindPropertyAndMonth', async () => {
    renderPage(`${ARCHIVE}?kind=IstatProof&property=${P1}&period=2026-08`);

    await screen.findByTestId('proof-archive-table');
    expect(listCall()).toEqual({ propertyId: P1, from: '2026-08-01', to: '2026-08-31', kind: 'IstatProof', page: 1, pageSize: 25 });
    expect(screen.getByTestId('archive-filter-property')).toHaveValue(P1);
    expect(screen.getByTestId('archive-filter-kind')).toHaveValue('IstatProof');
    expect(screen.getByTestId('archive-filter-period')).toHaveValue('2026-08');
    // No summary without the traffic light: no tabs and no call to the report.
    expect(screen.queryByTestId('archive-tab-summary')).not.toBeInTheDocument();
    expect(complianceArchiveApi.getCoverageReport).not.toHaveBeenCalled();
  });

  it('AlloggiatiPage_LinkOfTheCockpitWithTheSummary_NarrowsTheSummaryToTheSameFilters', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('Missing'), row('Missing', { kind: 'Alloggiati', bookingId: 'b1', bookingCode: 'AB123-CD456', day: '2026-08-15', period: null })]),
    );
    renderPage(`${ARCHIVE}?kind=IstatProof&property=${P1}&period=2026-08`, { flags: { complianceTrafficLight: true } });

    await screen.findByTestId('coverage-report');
    expect(vi.mocked(complianceArchiveApi.getCoverageReport).mock.calls[0][0]).toEqual({ from: '2026-08-01', to: '2026-08-31', propertyId: P1 });
    // The report has no filter by kind: the rows are narrowed here, and the page says so.
    expect(screen.getAllByTestId('coverage-row')).toHaveLength(1);
    expect(screen.getByTestId('coverage-narrowed')).toHaveTextContent('Prova ISTAT');
  });

  it('AlloggiatiPage_Day_FiltersThatDayAndCanBeCleared', async () => {
    renderPage(`${ARCHIVE}?day=2026-08-15&kind=AlloggiatiReceipt`);

    await screen.findByTestId('proof-archive-table');
    expect(listCall()).toMatchObject({ from: '2026-08-15', to: '2026-08-15', kind: 'AlloggiatiReceipt' });
    expect(screen.getByTestId('archive-day-filter')).toHaveTextContent('15 agosto 2026');

    fireEvent.click(within(screen.getByTestId('archive-day-filter')).getByRole('button'));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`${ARCHIVE}?kind=AlloggiatiReceipt`));
    expect(screen.getByTestId('where')).not.toHaveTextContent('day=');
  });

  it.each([
    ['a property that is not an id', 'property=../../x'],
    ['a kind that is not one of the four', 'kind=Everything'],
    ['a month that is not a month', 'period=2026-13'],
  ])('AlloggiatiPage_AddressWith%s_IsNotAFilterAndNothingElseIsAskedInItsPlace', async (_what, query) => {
    renderPage(`${ARCHIVE}?${query}`);

    await screen.findByTestId('proof-archive-table');
    expect(listCall()).toEqual({ propertyId: undefined, from: '2026-08-01', to: '2026-11-30', kind: undefined, page: 1, pageSize: 25 });
  });

  it('AlloggiatiPage_PropertyThatIsNotOneOfTheCallers_IsNoFilter', async () => {
    renderPage(`${ARCHIVE}?property=11111111-1111-4111-8111-111111111111`);

    await screen.findByTestId('proof-archive-table');
    expect(listCall().propertyId).toBeUndefined();
  });

  it('AlloggiatiPage_ChangingAFilter_IsWrittenInTheAddressAndStartsFromTheFirstPage', async () => {
    renderPage(`${ARCHIVE}?page=2`);
    await screen.findByTestId('proof-archive-table');

    fireEvent.change(screen.getByTestId('archive-filter-kind'), { target: { value: 'TouristTaxPayment' } });

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`${ARCHIVE}?kind=TouristTaxPayment`));
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=');
  });

  // Before the flags are read the page cannot know whether it has a summary: it asks nothing and shows no tab, instead of showing the proofs and then the summary.
  it('AlloggiatiPage_WhileTheFlagsLoad_AsksNothingAndShowsTheListLoading', () => {
    renderPage(ARCHIVE, { flagsLoading: true, flags: { complianceTrafficLight: true } });

    expect(screen.getByTestId('archive-loading')).toBeInTheDocument();
    expect(complianceArchiveApi.listEvidence).not.toHaveBeenCalled();
    expect(complianceArchiveApi.getCoverageReport).not.toHaveBeenCalled();
  });

  // A proof is kept five years from its upload: the period list reaches back as far, so the oldest proofs that can still be there are in the reach of the page,
  // for the list and for the ZIP of that year.
  it('AlloggiatiPage_Period_OffersTheYearsAProofIsKeptAndAnOldYearFiltersTheListAndTheZip', async () => {
    vi.mocked(complianceArchiveApi.exportProofs).mockResolvedValue({ blob: new Blob(['zip'], { type: 'application/zip' }), contentDisposition: null });
    renderPage();
    await screen.findByTestId('proof-archive-table');
    const periods = within(screen.getByTestId('archive-filter-period'));
    expect(periods.getAllByRole('option').map((option) => option.textContent).filter((text) => text?.startsWith('Tutto il'))).toEqual([
      'Tutto il 2026',
      'Tutto il 2025',
      'Tutto il 2024',
      'Tutto il 2023',
      'Tutto il 2022',
      'Tutto il 2021',
    ]);

    fireEvent.change(screen.getByTestId('archive-filter-period'), { target: { value: '2021' } });

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`${ARCHIVE}?period=2021`));
    await waitFor(() => expect(complianceArchiveApi.listEvidence).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2021-01-01', to: '2021-12-31' })));
    fireEvent.click(screen.getByTestId('archive-export-zip'));
    await waitFor(() => expect(complianceArchiveApi.exportProofs).toHaveBeenCalledWith('2021-01-01', '2021-12-31', undefined));
  });

  it('AlloggiatiPage_ByDefault_LooksAtTheThreeWholeMonthsBeforeAndTheCurrentOne', async () => {
    renderPage();

    await screen.findByTestId('proof-archive-table');
    expect(listCall()).toMatchObject({ from: '2026-08-01', to: '2026-11-30' });
  });
});

describe('the archive of the proofs: the files', () => {
  it('AlloggiatiPage_Proofs_ListWhatCasaZenHoldsWithKindPropertyMonthSourceAndRetention', async () => {
    vi.mocked(complianceArchiveApi.listEvidence).mockResolvedValue(
      page([entry('e1'), entry('e2', { kind: 'AlloggiatiReceipt', day: '2026-08-15', period: null, source: 'casazen_receipt', propertyName: 'Villa Rosa' })]),
    );
    renderPage();

    const table = await screen.findByTestId('proof-archive-table');
    const first = within(screen.getByTestId('proof-row-e1'));
    expect(first.getByText('Prova ISTAT')).toBeInTheDocument();
    expect(screen.getByTestId('proof-row-e1')).toHaveTextContent('Casa Como · agosto 2026');
    expect(screen.getByTestId('proof-row-e1')).toHaveTextContent('Caricata da te');
    expect(screen.getByTestId('proof-row-e1')).toHaveTextContent('Conservata fino al 2 settembre 2031');
    expect(screen.getByTestId('proof-row-e2')).toHaveTextContent('Ricevuta Alloggiati Web');
    expect(screen.getByTestId('proof-row-e2')).toHaveTextContent('Villa Rosa · 15 agosto 2026');
    expect(screen.getByTestId('proof-row-e2')).toHaveTextContent('Scaricata da CasaZen');
    expect(table).not.toHaveTextContent(/octorate/i);
  });

  // AC 2: each proof downloads through the API; the page never builds a storage address.
  it('AlloggiatiPage_Download_GoesThroughTheApiAndSavesTheFileNeverALinkToTheStorage', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.mocked(complianceArchiveApi.downloadProof).mockResolvedValue({ blob, contentDisposition: null });
    const { container } = renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('proof-download-e1'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(vi.mocked(complianceArchiveApi.downloadProof).mock.calls[0][0]).toMatchObject({ id: 'e1' });
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).toBe('prova-istat_2026-08.pdf');
    expect(toast.success).toHaveBeenCalled();
    // No link to a file anywhere: the signed address is the API's business.
    expect(container.querySelector('a[href*="storage"], a[href*="supabase"], a[href*="/download"], a[download]')).toBeNull();
  });

  it('AlloggiatiPage_Download_TakesTheNameTheServerGaveWhenThePageMayReadIt', async () => {
    vi.mocked(complianceArchiveApi.downloadProof).mockResolvedValue({ blob: new Blob(['x'], { type: 'application/pdf' }), contentDisposition: 'attachment; filename="ricevuta-agosto.pdf"' });
    renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('proof-download-e1'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalled());
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).toBe('ricevuta-agosto.pdf');
  });

  it('AlloggiatiPage_WhileAFileIsOnItsWay_EveryButtonOfTheListWaitsAndAnotherClickStartsNothing', async () => {
    let answer: (value: { blob: Blob; contentDisposition: null }) => void = () => undefined;
    vi.mocked(complianceArchiveApi.listEvidence).mockResolvedValue(page([entry('e1'), entry('e2')]));
    vi.mocked(complianceArchiveApi.downloadProof).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('proof-download-e1'));

    await waitFor(() => expect(screen.getByTestId('proof-download-e2')).toBeDisabled());
    expect(screen.getByTestId('proof-download-e1')).toBeDisabled();
    expect(screen.getByTestId('archive-export-zip')).toBeDisabled();
    fireEvent.click(screen.getByTestId('proof-download-e2'));
    expect(complianceArchiveApi.downloadProof).toHaveBeenCalledTimes(1);

    answer({ blob: new Blob(['x'], { type: 'application/pdf' }), contentDisposition: null });
    await waitFor(() => expect(screen.getByTestId('proof-download-e2')).not.toBeDisabled());
  });

  it('AlloggiatiPage_DownloadOfAProofThatIsGone_SaysNotFoundAndReadsTheListAgain', async () => {
    vi.mocked(complianceArchiveApi.downloadProof).mockRejectedValue(problem(404, 'compliance_proof_not_found'));
    renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('proof-download-e1'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Non troviamo questa prova: forse non esiste più o non puoi vederla.'));
    await waitFor(() => expect(complianceArchiveApi.listEvidence).toHaveBeenCalledTimes(2));
  });

  // A proof is the receipt of a communication about guests or of a tax, and the request that fails holds the access token: the cache of the mutations keeps
  // neither, the file goes to the disk inside the mutation (its result is nothing) and not even the mutation stays once the page is left.
  it('AlloggiatiPage_DownloadThatFails_KeepsNeitherTheTokenOfTheRequestNorTheFileInTheCacheOfTheMutations', async () => {
    vi.mocked(complianceArchiveApi.downloadProof)
      .mockRejectedValueOnce(problemWithToken(500, 'boom'))
      .mockResolvedValueOnce({ blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), contentDisposition: null });
    const { client, unmount } = renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('proof-download-e1'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('complianceArchive.download.failed')));
    const failures = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
    expect(failures.length).toBeGreaterThan(0);
    expect(holds(failures, 'SECRET-TOKEN')).toBe(false);

    await waitFor(() => expect(screen.getByTestId('proof-download-e1')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('proof-download-e1'));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(client.getMutationCache().getAll().every((mutation) => mutation.state.data === undefined)).toBe(true);

    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  // A 404 is «not found» even with the older answer in the cache: the rows of the older read are not shown as if they were still there.
  it('AlloggiatiPage_ListThatTurnsIntoA404_IsNotFoundNeverTheOlderRows', async () => {
    vi.mocked(complianceArchiveApi.downloadProof).mockRejectedValue(problem(404, 'compliance_proof_not_found'));
    renderPage();
    await screen.findByTestId('proof-archive-table');
    vi.mocked(complianceArchiveApi.listEvidence).mockRejectedValue(problem(404));

    fireEvent.click(screen.getByTestId('proof-download-e1'));

    const error = await screen.findByTestId('archive-proofs-error');
    expect(error).toHaveTextContent('Non troviamo quello che cerchi');
    expect(screen.queryByTestId('proof-archive-table')).not.toBeInTheDocument();
  });

  it('AlloggiatiPage_ListFails_IsAnErrorWithRetryNeverAnEmptyArchive', async () => {
    vi.mocked(complianceArchiveApi.listEvidence).mockRejectedValueOnce(problem(500));
    renderPage();

    const error = await screen.findByTestId('archive-proofs-error');
    expect(error).toHaveTextContent('Non riusciamo a caricare le prove.');
    expect(screen.queryByText('Nessuna prova in archivio')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: /riprova/i }));
    await screen.findByTestId('proof-archive-table');
  });

  it('AlloggiatiPage_NoFile_SaysNoneIsArchivedForTheFiltersAndNeverThatAllIsFine', async () => {
    vi.mocked(complianceArchiveApi.listEvidence).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('Nessuna prova in archivio')).toBeInTheDocument();
    expect(screen.getByText(/Non c'è nessun file archiviato per questi filtri/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/in regola|tutto in ordine|tutte le prove/i);
  });

  it('AlloggiatiPage_MoreProofsThanAPage_PagesThemInTheAddress', async () => {
    vi.mocked(complianceArchiveApi.listEvidence).mockResolvedValue(page([entry('e1')], 60));
    renderPage();
    await screen.findByTestId('proof-archive-table');
    expect(screen.getByTestId('archive-pager')).toHaveTextContent('Pagina 1 di 3');

    fireEvent.click(within(screen.getByTestId('archive-pager')).getByRole('button', { name: /avanti/i }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('page=2'));
    await waitFor(() => expect(listCall(1)).toMatchObject({ page: 2 }));
  });

  // AC 3: the export button downloads the ZIP of the filtered period.
  it('AlloggiatiPage_Export_DownloadsTheZipOfTheFilteredPeriodAndProperty', async () => {
    vi.mocked(complianceArchiveApi.exportProofs).mockResolvedValue({ blob: new Blob(['zip'], { type: 'application/zip' }), contentDisposition: null });
    renderPage(`${ARCHIVE}?property=${P1}&period=2026-08`);
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('archive-export-zip'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(complianceArchiveApi.exportProofs).toHaveBeenCalledWith('2026-08-01', '2026-08-31', P1);
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).toBe('casazen-prove-2026-08-01-2026-08-31.zip');
  });

  it('AlloggiatiPage_ExportTooLarge_SaysTheRefusalNextToTheButton', async () => {
    vi.mocked(complianceArchiveApi.exportProofs).mockRejectedValue(problem(422, 'compliance_export_too_large'));
    renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('archive-export-zip'));

    expect(await screen.findByTestId('archive-export-error')).toHaveTextContent('più prove di quante ne entrino in un archivio');
    expect(saveBlobAs).not.toHaveBeenCalled();
  });

  // The ZIP holds the receipts of a period: the mutation that builds it keeps nothing of the request that failed, nor of the file, and goes with the page.
  it('AlloggiatiPage_ExportThatFails_KeepsNeitherTheTokenOfTheRequestNorTheZipInTheCacheOfTheMutations', async () => {
    vi.mocked(complianceArchiveApi.exportProofs)
      .mockRejectedValueOnce(problemWithToken(500, 'boom'))
      .mockResolvedValueOnce({ blob: new Blob(['zip'], { type: 'application/zip' }), contentDisposition: null });
    const { client, unmount } = renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('archive-export-zip'));

    await screen.findByTestId('archive-export-error');
    const failures = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
    expect(failures.length).toBeGreaterThan(0);
    expect(holds(failures, 'SECRET-TOKEN')).toBe(false);

    await waitFor(() => expect(screen.getByTestId('archive-export-zip')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('archive-export-zip'));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(client.getMutationCache().getAll().every((mutation) => mutation.state.data === undefined)).toBe(true);

    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});

describe('the archive of the proofs: permissions', () => {
  // The tax receipts are a record of money: seen with payment.read, uploaded with payment.write (what the API asks).
  it('AlloggiatiPage_WithoutPaymentRead_OffersNoTaxKindAndIgnoresItInTheAddress', async () => {
    workspace.permissions = ['booking.read', 'alloggiati.submit'];
    renderPage(`${ARCHIVE}?kind=TouristTaxDeclaration`);

    await screen.findByTestId('proof-archive-table');
    const kinds = within(screen.getByTestId('archive-filter-kind'));
    expect(kinds.getByRole('option', { name: 'Prova ISTAT' })).toBeInTheDocument();
    expect(kinds.queryByRole('option', { name: /imposta di soggiorno/i })).not.toBeInTheDocument();
    expect(listCall().kind).toBeUndefined();
  });

  it('AlloggiatiPage_WithoutAlloggiatiSubmit_HasNoUploadButton', async () => {
    workspace.permissions = ['booking.read', 'payment.read', 'payment.write'];
    renderPage();

    await screen.findByTestId('proof-archive-table');
    expect(screen.queryByTestId('archive-upload-open')).not.toBeInTheDocument();
  });

  it('AlloggiatiPage_WithoutPaymentWrite_UploadsNoTaxProof', async () => {
    workspace.permissions = ['booking.read', 'alloggiati.submit', 'payment.read'];
    renderPage();
    await screen.findByTestId('proof-archive-table');

    fireEvent.click(screen.getByTestId('archive-upload-open'));

    const kinds = within(await screen.findByTestId('proof-upload-kind'));
    expect(kinds.getAllByRole('option').map((option) => option.textContent)).toEqual(['Ricevuta Alloggiati Web', 'Prova ISTAT']);
  });

  it('AlloggiatiPage_Page_AsksTheServerForWhatItNeedsAndNothingWithoutTheSummaryFlag', async () => {
    renderPage();

    await screen.findByTestId('proof-archive-table');
    expect(complianceArchiveApi.getCoverageReport).not.toHaveBeenCalled();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});

describe('the summary of the period', () => {
  const flags = { flags: { complianceTrafficLight: true, octorateConnector: true } };

  // AC 1 and 8: grouped by state, the proofs held, never an inferred result, never «all compliant» while something is missing or only the channel manager can tell.
  it('AlloggiatiPage_SummaryWithMissingAndToVerify_GroupsByStateAndNeverSaysAllIsFine', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([
        row('Missing'),
        row('ExternalVerificationRequired', { kind: 'Alloggiati', bookingId: 'b1', bookingCode: 'AB123-CD456', day: '2026-08-15', period: null, handoffTopic: 'Alloggiati', reason: 'external_verification_required' }),
        row('OfficialProof', { reason: 'receipt_archived', proofAt: '2026-09-02T10:00:00Z' }),
        row('NotApplicable', { kind: 'Alloggiati', bookingId: 'b2', bookingCode: 'ZZ999-YY888', day: '2026-08-20', period: null, reason: 'no_show' }),
      ]),
    );
    renderPage(ARCHIVE, flags);

    await screen.findByTestId('coverage-report');
    const headline = screen.getByTestId('coverage-headline');
    expect(headline).toHaveAttribute('data-tone', 'danger');
    expect(headline).toHaveTextContent('Manca 1 prova');
    expect(document.body.textContent).not.toMatch(/Tutte le prove richieste sono archiviate/);
    expect(screen.getByText('Mancante (1)')).toBeInTheDocument();
    expect(screen.getByText('Da verificare nel Cassetto Compliance (1)')).toBeInTheDocument();
    expect(screen.getByText('Prova disponibile (1)')).toBeInTheDocument();
    expect(screen.getByText('Non applicabile (1)')).toBeInTheDocument();
    // What needs the host is open; what is proven or not owed is behind its count.
    expect(screen.getByTestId('coverage-details-OfficialProof')).not.toHaveAttribute('open');
    expect(screen.getByTestId('coverage-details-NotApplicable')).not.toHaveAttribute('open');
  });

  it('AlloggiatiPage_OnlyTheChannelManagerCanTell_IsToVerifyWithTheSharedVerificationAndTheDisclosureAndNoResult', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('ExternalVerificationRequired', { kind: 'Alloggiati', bookingId: 'b1', bookingCode: 'AB123-CD456', day: '2026-08-15', period: null, handoffTopic: 'Alloggiati' })], { complete: true, officialProof: 4 }),
    );
    renderPage(ARCHIVE, flags);

    const external = await screen.findByTestId('coverage-external');
    expect(screen.getByTestId('coverage-headline')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('coverage-headline')).toHaveTextContent('1 esito da verificare nel Cassetto Compliance');
    // The button is the one of the compliance drawer, named after the row it is on (a screen reader tells the rows apart).
    expect(within(external).getByRole('button', { name: 'Verifica nel tuo Cassetto Compliance: Soggiorno AB123-CD456 · arrivo 15 agosto 2026' })).toBeInTheDocument();
    expect(screen.getByTestId('coverage-consulted')).toHaveTextContent('Dati consultati su Octorate');
    // No result is inferred: no «inviato», no «ok», no green.
    expect(screen.getByTestId('coverage-row').textContent).not.toMatch(/inviato correttamente|esito positivo|prova archiviata il|è in regola/i);
  });

  // The button is the one of the compliance drawer: it asks the server for the stay of the row (its property, the topic the server sent) and the route of this page
  // with its filters, which is what the host comes back to; it opens the dialog and nothing else (no proof, no light).
  it('AlloggiatiPage_VerifyFromARow_AsksTheHandoffOfThatStayAndComesBackToThisPageWithItsFilters', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('ExternalVerificationRequired', { kind: 'Alloggiati', bookingId: 'b1', bookingCode: 'AB123-CD456', day: '2026-08-15', period: null, handoffTopic: 'Alloggiati' })]),
    );
    vi.mocked(octorateComplianceHandoffApi.start).mockResolvedValue(handoff('Alloggiati', { bookingId: 'b1', bookingCode: 'AB123-CD456' }));
    renderPage(`${ARCHIVE}?property=${P1}`, flags);

    fireEvent.click(await screen.findByTestId('coverage-drawer'));

    await waitFor(() => expect(octorateComplianceHandoffApi.start).toHaveBeenCalledTimes(1));
    expect(vi.mocked(octorateComplianceHandoffApi.start).mock.calls[0][0]).toEqual({
      topic: 'Alloggiati',
      propertyId: P1,
      bookingId: 'b1',
      period: null,
      returnPath: `${ARCHIVE}?property=${P1}`,
    });
    expect(await screen.findByTestId('compliance-drawer-ready')).toBeInTheDocument();
  });

  it('AlloggiatiPage_VerifyFromAnIstatRow_AsksTheHandoffOfThatMonthOfThatProperty', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([row('ExternalVerificationRequired', { handoffTopic: 'Istat', period: '2026-08' })]));
    vi.mocked(octorateComplianceHandoffApi.start).mockResolvedValue(handoff('Istat', { period: '2026-08' }));
    renderPage(`${ARCHIVE}?kind=IstatProof&property=${P1}&period=2026-08`, flags);

    fireEvent.click(await screen.findByTestId('coverage-drawer'));

    await waitFor(() => expect(octorateComplianceHandoffApi.start).toHaveBeenCalledTimes(1));
    expect(vi.mocked(octorateComplianceHandoffApi.start).mock.calls[0][0]).toEqual({
      topic: 'Istat',
      propertyId: P1,
      bookingId: null,
      period: '2026-08',
      returnPath: `${ARCHIVE}?kind=IstatProof&property=${P1}&period=2026-08`,
    });
  });

  // The server decides which outcome the channel manager holds (`handoffTopic`): a row that does not carry it is not worked out from its kind, and has no button.
  it('AlloggiatiPage_ToVerifyRowWithoutATopicFromTheServer_OffersNoButtonAndTellsWhereTheOutcomeIs', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([row('ExternalVerificationRequired', { handoffTopic: null })]));
    renderPage(ARCHIVE, flags);

    const external = await screen.findByTestId('coverage-external');
    expect(within(external).queryByRole('button')).not.toBeInTheDocument();
    expect(external).toHaveTextContent("L'esito si trova nell'area del tuo channel manager");
    expect(octorateComplianceHandoffApi.start).not.toHaveBeenCalled();
  });

  it('AlloggiatiPage_ConnectorOff_ToVerifyRowTellsWhereTheOutcomeIsAndOffersNoButton', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('ExternalVerificationRequired', { handoffTopic: 'Istat', reason: 'external_verification_required' })]),
    );
    renderPage(ARCHIVE, { flags: { complianceTrafficLight: true, octorateConnector: false } });

    const external = await screen.findByTestId('coverage-external');
    expect(within(external).queryByRole('button')).not.toBeInTheDocument();
    expect(external).toHaveTextContent("L'esito si trova nell'area del tuo channel manager");
  });

  it('AlloggiatiPage_EverythingProvenAndComplete_IsTheOnlyGreen', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([row('OfficialProof', { reason: 'receipt_archived' })], { complete: true }));
    renderPage(ARCHIVE, flags);

    await screen.findByTestId('coverage-report');
    expect(screen.getByTestId('coverage-headline')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('coverage-headline')).toHaveTextContent('Tutte le prove richieste sono archiviate');
  });

  it('AlloggiatiPage_ReportWithNothingInItAndNotComplete_IsToVerifyNeverGreen', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([], { complete: false }));
    renderPage(ARCHIVE, flags);

    await screen.findByTestId('coverage-report');
    expect(screen.getByTestId('coverage-headline')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByTestId('coverage-headline')).not.toHaveTextContent('archiviate');
  });

  it('AlloggiatiPage_SummaryThatTurnsIntoA404_SaysItIsNotAvailableNeverTheOlderReport', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockRejectedValue(problem(404));
    renderPage(ARCHIVE, flags);

    const error = await screen.findByTestId('archive-summary-error');
    expect(error).toHaveTextContent('Il riepilogo non è disponibile in questo momento.');
    expect(screen.queryByTestId('coverage-report')).not.toBeInTheDocument();
  });

  it('AlloggiatiPage_MissingRow_OffersTheUploadFilledInAndTheStayForAnAlloggiatiOne', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('Missing', { kind: 'Alloggiati', bookingId: 'b1', bookingCode: 'AB123-CD456', day: '2026-08-15', period: null, deadlineAt: '2026-08-16T12:00:00Z', reason: 'receipt_missing' })]),
    );
    renderPage(ARCHIVE, flags);

    const missing = await screen.findByTestId('coverage-row');
    expect(missing).toHaveTextContent('Soggiorno AB123-CD456 · arrivo 15 agosto 2026');
    expect(missing).toHaveTextContent('La comunicazione risulta inviata ma la ricevuta non è in archivio.');
    expect(within(missing).getByTestId('coverage-open-stay')).toHaveAttribute('href', '/app/short-rent/bookings/b1?tab=alloggiati');

    fireEvent.click(within(missing).getByTestId('coverage-upload'));

    const dialog = await screen.findByTestId('proof-upload-dialog');
    expect(within(dialog).getByTestId('proof-upload-property')).toHaveValue(P1);
    expect(within(dialog).getByTestId('proof-upload-kind')).toHaveValue('AlloggiatiReceipt');
    expect(within(dialog).getByTestId('proof-upload-day')).toHaveValue('2026-08-15');
  });

  it('AlloggiatiPage_MissingRowWithoutTheUploadPermission_HasNoUploadButtonButStillSaysWhatIsMissing', async () => {
    workspace.permissions = ['booking.read'];
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([row('Missing')]));
    renderPage(ARCHIVE, flags);

    const missing = await screen.findByTestId('coverage-row');
    expect(missing).toHaveTextContent('ISTAT · agosto 2026');
    expect(within(missing).queryByTestId('coverage-upload')).not.toBeInTheDocument();
  });

  // A stay whose send the channel manager does not make (its police send is off) is red because the host has to send it by hand: the reason of the row is
  // `connection_inactive`, and the row says it in plain words, in both languages, without naming the supplier.
  it.each([
    ['it', 'Il tuo channel manager non invia i dati: questo soggiorno va inviato a mano.'],
    ['en', 'Your channel manager is not sending the data: this stay has to be sent by hand.'],
  ])('AlloggiatiPage_MissingRowOfAStayTheChannelManagerDoesNotSend_SaysItIsToBeSentByHand_%s', async (language, words) => {
    await i18n.changeLanguage(language);
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('Missing', { kind: 'Alloggiati', bookingId: 'b1', bookingCode: 'AB123-CD456', day: '2026-08-15', period: null, reason: 'connection_inactive', action: 'SendAlloggiatiManually' })]),
    );
    renderPage(ARCHIVE, flags);

    const missing = await screen.findByTestId('coverage-row');
    expect(missing).toHaveTextContent(words);
    expect(missing.textContent).not.toMatch(/octorate/i);
  });

  it('AlloggiatiPage_ReportExport_AsksPdfOrCsvOfTheFilteredPeriodOneAtATime', async () => {
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(report([row('Missing')]));
    vi.mocked(complianceArchiveApi.exportCoverageReport).mockResolvedValue({ blob: new Blob(['csv'], { type: 'text/csv' }), contentDisposition: null });
    renderPage(`${ARCHIVE}?property=${P2}&period=2026-08`, flags);
    await screen.findByTestId('coverage-report');

    fireEvent.click(screen.getByTestId('archive-export-report-csv'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(complianceArchiveApi.exportCoverageReport).toHaveBeenCalledWith('csv', { from: '2026-08-01', to: '2026-08-31', propertyId: P2 });
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).toBe('casazen-rapporto-copertura-2026-08-01-2026-08-31.csv');
  });
});

describe('the upload of a proof', () => {
  const file = (name = 'ricevuta.pdf', type = 'application/pdf') => new File(['%PDF-1.4'], name, { type });

  async function openUpload(initial = ARCHIVE) {
    renderPage(initial);
    await screen.findByTestId('proof-archive-table');
    fireEvent.click(screen.getByTestId('archive-upload-open'));
    return screen.findByTestId('proof-upload-dialog');
  }

  it('AlloggiatiPage_UploadOfAnAlloggiatiReceipt_SendsPropertyKindDayAndFileThenClosesAndReadsTheArchiveAgain', async () => {
    vi.mocked(complianceArchiveApi.uploadProof).mockResolvedValue(entry('new', { kind: 'AlloggiatiReceipt', day: '2026-08-15', period: null }));
    const dialog = await openUpload();
    const upload = file();

    expect(within(dialog).getByTestId('proof-upload-submit')).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P2 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-08-15' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [upload] } });
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));

    await waitFor(() => expect(complianceArchiveApi.uploadProof).toHaveBeenCalledTimes(1));
    expect(complianceArchiveApi.uploadProof).toHaveBeenCalledWith({ propertyId: P2, kind: 'AlloggiatiReceipt', day: '2026-08-15', file: upload });
    await waitFor(() => expect(screen.queryByTestId('proof-upload-dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Prova caricata nell\'archivio.');
    await waitFor(() => expect(complianceArchiveApi.listEvidence).toHaveBeenCalledTimes(2));
  });

  it('AlloggiatiPage_UploadOfAMonthProof_SendsTheFirstDayOfTheMonth', async () => {
    vi.mocked(complianceArchiveApi.uploadProof).mockResolvedValue(entry('new'));
    const dialog = await openUpload(`${ARCHIVE}?kind=IstatProof&property=${P1}&period=2026-08`);

    expect(within(dialog).getByTestId('proof-upload-property')).toHaveValue(P1);
    expect(within(dialog).getByTestId('proof-upload-kind')).toHaveValue('IstatProof');
    expect(within(dialog).getByTestId('proof-upload-month')).toHaveValue('2026-08');
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file('istat.png', 'image/png')] } });
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));

    await waitFor(() => expect(complianceArchiveApi.uploadProof).toHaveBeenCalledTimes(1));
    expect(vi.mocked(complianceArchiveApi.uploadProof).mock.calls[0][0]).toMatchObject({ propertyId: P1, kind: 'IstatProof', day: '2026-08-01' });
  });

  it('AlloggiatiPage_UploadWithADayInTheFuture_CannotBeSent', async () => {
    const dialog = await openUpload();
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P1 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-11-14' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file()] } });

    expect(within(dialog).getByTestId('proof-upload-submit')).toBeDisabled();
    expect(dialog).toHaveTextContent('Scegli un giorno passato, non nel futuro.');
  });

  it('AlloggiatiPage_UploadOfAFileThatIsNotAPdfOrAPhoto_IsToldAtOnceAndCannotBeSent', async () => {
    const dialog = await openUpload();
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P1 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-08-15' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file('foglio.xlsx', 'application/vnd.ms-excel')] } });

    expect(dialog).toHaveTextContent('Il file deve essere un PDF, un JPG o un PNG.');
    expect(within(dialog).getByTestId('proof-upload-submit')).toBeDisabled();
  });

  it('AlloggiatiPage_UploadRefusedByTheServer_StaysOpenWithTheReasonInWords', async () => {
    vi.mocked(complianceArchiveApi.uploadProof).mockRejectedValue(problem(415, 'compliance_proof_type_unsupported'));
    const dialog = await openUpload();
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P1 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-08-15' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file()] } });
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));

    const error = await within(dialog).findByTestId('proof-upload-error');
    expect(error).toHaveTextContent('Il file deve essere un PDF, un JPG o un PNG.');
    expect(screen.getByTestId('proof-upload-dialog')).toBeInTheDocument();
    expect(within(dialog).getByTestId('proof-upload-submit')).not.toBeDisabled();
  });

  // The file is a receipt about guests and the request that fails holds the access token. The upload lives only while the dialog is open: a refusal keeps
  // nothing of the request, and closing the dialog leaves nothing of the upload (the file, the answer, the refusal) in the cache of the mutations; a dialog
  // opened again starts clean, without the refusal of the first one.
  it('AlloggiatiPage_UploadThatFailsAndIsClosed_LeavesNothingInTheCacheOfTheMutationsAndNoOldRefusalOnReopening', async () => {
    vi.mocked(complianceArchiveApi.uploadProof).mockRejectedValueOnce(problemWithToken(415, 'compliance_proof_type_unsupported'));
    const { client } = renderPage();
    await screen.findByTestId('proof-archive-table');
    fireEvent.click(screen.getByTestId('archive-upload-open'));
    const dialog = await screen.findByTestId('proof-upload-dialog');
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P1 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-08-15' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file()] } });
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));

    await within(dialog).findByTestId('proof-upload-error');
    const failures = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
    expect(failures.length).toBeGreaterThan(0);
    expect(holds(failures, 'SECRET-TOKEN')).toBe(false);

    fireEvent.click(within(dialog).getByTestId('proof-upload-cancel'));
    await waitFor(() => expect(screen.queryByTestId('proof-upload-dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));

    fireEvent.click(screen.getByTestId('archive-upload-open'));
    const again = await screen.findByTestId('proof-upload-dialog');
    expect(within(again).queryByTestId('proof-upload-error')).not.toBeInTheDocument();
  });

  it('AlloggiatiPage_UploadThatWorks_LeavesNothingOfTheFileInTheCacheOfTheMutationsOnceTheDialogIsClosed', async () => {
    vi.mocked(complianceArchiveApi.uploadProof).mockResolvedValue(entry('new', { kind: 'AlloggiatiReceipt', day: '2026-08-15', period: null }));
    const { client } = renderPage();
    await screen.findByTestId('proof-archive-table');
    fireEvent.click(screen.getByTestId('archive-upload-open'));
    const dialog = await screen.findByTestId('proof-upload-dialog');
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P1 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-08-15' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file()] } });
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));

    await waitFor(() => expect(screen.queryByTestId('proof-upload-dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('AlloggiatiPage_WhileTheFileIsOnItsWay_EveryControlOfTheDialogWaits', async () => {
    vi.mocked(complianceArchiveApi.uploadProof).mockReturnValue(new Promise(() => undefined));
    const dialog = await openUpload();
    fireEvent.change(within(dialog).getByTestId('proof-upload-property'), { target: { value: P1 } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-day'), { target: { value: '2026-08-15' } });
    fireEvent.change(within(dialog).getByTestId('proof-upload-file'), { target: { files: [file()] } });
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));

    await waitFor(() => expect(within(dialog).getByTestId('proof-upload-submit')).toHaveAttribute('aria-busy', 'true'));
    for (const id of ['proof-upload-property', 'proof-upload-kind', 'proof-upload-day', 'proof-upload-file', 'proof-upload-cancel']) {
      expect(within(dialog).getByTestId(id)).toBeDisabled();
    }
    fireEvent.click(within(dialog).getByTestId('proof-upload-submit'));
    expect(complianceArchiveApi.uploadProof).toHaveBeenCalledTimes(1);
  });

  // NF-43: the guided step «Prendi la ricevuta» only where CasaZen supports the source (the Alloggiati receipt from the portal).
  it('AlloggiatiPage_UploadDialog_GuidesTheAlloggiatiReceiptToThePortalAndNothingElse', async () => {
    const dialog = await openUpload();

    const link = within(dialog).getByTestId('proof-upload-portal-link');
    expect(link).toHaveAttribute('href', PORTAL);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(dialog).toHaveTextContent('Prima prendi la ricevuta');

    fireEvent.change(within(dialog).getByTestId('proof-upload-kind'), { target: { value: 'IstatProof' } });

    expect(within(dialog).queryByTestId('proof-upload-portal-step')).not.toBeInTheDocument();
    // It never asks the person to assert that something succeeded.
    expect(dialog.textContent).not.toMatch(/è stato inviato|confermo|ho inviato/i);
  });
});

describe('what the page stopped doing', () => {
  // AC 6 (DEB-08): the calls to endpoints that do not exist are gone from the api module and the hooks.
  it('AlloggiatiApi_NoCallToTheReportEndpointsThatDoNotExist', () => {
    expect(Object.keys(alloggiatiApi)).not.toContain('getReports');
    expect(Object.keys(alloggiatiApi)).not.toContain('getReportErrors');
    expect(Object.keys(alloggiatiApi)).toEqual(expect.arrayContaining(['getSummary', 'getStatus', 'getGuestSummary', 'markSentManually']));
  });

  it('AlloggiatiPage_NeverAsksTheOldReportEndpoints', async () => {
    const get = vi.spyOn(alloggiatiApi, 'getSummary');
    renderPage();

    await screen.findByTestId('proof-archive-table');
    expect(get).not.toHaveBeenCalled();
  });
});

describe('accessibility', () => {
  it.each(['it', 'en'])('AlloggiatiPage_WithProofsAndTheSummary_HasNoAccessibilityViolation_%s', async (language) => {
    await i18n.changeLanguage(language);
    vi.mocked(complianceArchiveApi.listEvidence).mockResolvedValue(page([entry('e1'), entry('e2', { kind: 'AlloggiatiReceipt', day: '2026-08-15', period: null })]));
    vi.mocked(complianceArchiveApi.getCoverageReport).mockResolvedValue(
      report([row('Missing'), row('ExternalVerificationRequired', { handoffTopic: 'Istat' }), row('OfficialProof', { reason: 'receipt_archived' })]),
    );
    const { container } = renderPage(`${ARCHIVE}?tab=proofs`, { flags: { complianceTrafficLight: true, octorateConnector: true } });

    await screen.findByTestId('proof-archive-table');
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByTestId('archive-tab-summary'));
    await screen.findByTestId('coverage-report');
    await expectNoAxeViolations(container);
  });
});
