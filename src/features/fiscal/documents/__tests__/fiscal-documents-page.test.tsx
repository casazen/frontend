import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import * as api from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { ISSUER_PATH } from '@/features/fiscal/issuer-wizard/issuer-paths';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { SDI_POLL_MS, SDI_WATCH_MS } from '@/queries/use-fiscal-documents';
import type { FiscalDocumentEntry, FiscalDocumentFile, FiscalDocumentsContext } from '@/types';
import { FiscalDocumentsPage } from '../fiscal-documents-page';
import { document, importedDocument } from './document-fixtures';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, listDocuments: vi.fn(), getDocumentsContext: vi.fn(), downloadPdf: vi.fn(), downloadXml: vi.fn(), exportList: vi.fn() };
});
vi.mock('@/lib/file-download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/file-download')>();
  return { ...actual, saveBlobAs: vi.fn() };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => env.permissions.has(permission) }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
}));

const BOOKING_ID = 'b0000000-0000-4000-8000-000000000001';
const CONTEXT: FiscalDocumentsContext = { mode: 'CasaZenDirectOnly', casazenIssuanceEnabled: true, sdiProviderConfigured: true };
const ALL_PERMISSIONS = ['property.read', 'property.write', 'payment.read', 'booking.read'];

const page = (items: FiscalDocumentEntry[], totalCount = items.length) => ({ items, totalCount, page: 1, pageSize: 20 });

function failure(status: number, body?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: body, statusText: '', headers: {}, config });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, createElement(FiscalDocumentsPage))));
}

/** The rows of the table (the same documents are also in the list of cards, for a phone). */
async function tableRows() {
  const table = await screen.findByRole('table');
  return within(table).getAllByTestId('fiscal-document-row');
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.permissions = new Set(ALL_PERMISSIONS);
  env.flags = {};
  await i18n.changeLanguage('it');
  vi.mocked(api.listDocuments).mockResolvedValue(page([document()]));
  vi.mocked(api.getDocumentsContext).mockResolvedValue(CONTEXT);
});

describe('FiscalDocumentsPage: who may read (permission rule)', () => {
  it('FiscalDocumentsPage_WithoutPaymentRead_AsksNothingAndTellsItInWords', async () => {
    env.permissions = new Set(['property.read', 'booking.read']);
    renderPage();

    expect(await screen.findByTestId('fiscal-documents-forbidden')).toHaveTextContent(i18n.t('fiscalDocuments.list.forbidden'));
    expect(api.listDocuments).not.toHaveBeenCalled();
    expect(api.getDocumentsContext).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fiscal-documents-export')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_PaymentReadWithoutPropertyRead_AsksTheListAndNotTheSettingOfWhoIssues', async () => {
    env.permissions = new Set(['payment.read']);
    renderPage();

    expect(await tableRows()).toHaveLength(1);
    expect(api.listDocuments).toHaveBeenCalled();
    expect(api.getDocumentsContext).not.toHaveBeenCalled();
  });

  it('FiscalDocumentsPage_ARefusalOfTheServer_IsToldInWordsWithNoRetryAndNoListAndNoStaleRows', async () => {
    vi.mocked(api.listDocuments).mockRejectedValue(failure(403));
    renderPage();

    expect(await screen.findByTestId('fiscal-documents-forbidden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('shared.errorState.retry') })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-export')).not.toBeInTheDocument();
  });
});

describe('FiscalDocumentsPage: the list', () => {
  it('FiscalDocumentsPage_ADocument_ShowsTheNumberTheDayTheRecipientTheTotalAndTheStateAsTheServerSentThem', async () => {
    renderPage();

    const [row] = await tableRows();
    expect(within(row).getByTestId('fiscal-document-name')).toHaveTextContent('Fattura A/12');
    expect(within(row).getByTestId('fiscal-document-date')).toHaveTextContent('2026');
    expect(within(row).getByTestId('fiscal-document-recipient')).toHaveTextContent('Mario Rossi');
    expect(within(row).getByTestId('fiscal-document-total').textContent?.replace(/\s/g, ' ')).toBe('122,10 €');
    expect(within(row).getByTestId('fiscal-document-source')).toHaveTextContent(i18n.t('fiscalDocuments.list.source.CasaZen'));
    expect(within(row).getByTestId('fiscal-document-state')).toHaveAttribute('data-state', 'toSend');
    expect(within(row).getByTestId('fiscal-document-state')).toHaveTextContent('Emessa - da inviare allo SDI');
    expect(within(row).getByTestId('fiscal-document-payment')).toHaveTextContent('Da incassare');
  });

  // Money rule: each total is in the currency of its own document; nothing is added up and no currency is assumed.
  it('FiscalDocumentsPage_DocumentsInTwoCurrencies_KeepEachItsOwnAndTheListAddsNoTotal', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([document(), document({ id: 'd-2', number: 'A/13', currency: 'CHF', total: 55 })]));
    renderPage();

    const rows = await tableRows();
    const totals = rows.map((row) => within(row).getByTestId('fiscal-document-total').textContent?.replace(/\s/g, ' '));
    expect(totals).toEqual(['122,10 €', expect.stringContaining('CHF')]);
    expect(screen.queryByText(/177/)).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_TheStates_AreOnePlainLabelEachWithTheSdiAndThePaymentOnTwoLines', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(
      page([
        document({ id: 'd-1', sdiStatus: 'rejected', sdiErrorCode: '00305', paymentState: 'ToCollect' }),
        document({ id: 'd-2', number: 'A/13', sdiStatus: 'delivered', paymentState: 'Paid' }),
        document({ id: 'd-3', status: 'Draft', number: null, issueDate: null, sdiStatus: 'not_applicable' }),
      ]),
    );
    renderPage();

    const [rejected, delivered, draft] = await tableRows();
    expect(within(rejected).getByTestId('fiscal-document-state')).toHaveTextContent('Scartata dallo SDI');
    expect(within(rejected).getByTestId('fiscal-document-state')).toHaveAttribute('data-tone', 'danger');
    expect(within(rejected).getByTestId('fiscal-document-sdi-code')).toHaveTextContent('00305');
    expect(within(rejected).getByTestId('fiscal-document-payment')).toHaveAttribute('data-tone', 'warning');
    expect(within(delivered).getByTestId('fiscal-document-state')).toHaveTextContent('Consegnata');
    expect(within(delivered).getByTestId('fiscal-document-payment')).toHaveTextContent('Pagata');
    // A draft is a draft, not an issued document: no number, no day, no collection line, nothing to download.
    expect(within(draft).getByTestId('fiscal-document-state')).toHaveTextContent('Bozza');
    expect(within(draft).getByTestId('fiscal-document-name')).toHaveTextContent('senza numero');
    expect(within(draft).getByTestId('fiscal-document-date')).toHaveTextContent('Senza data');
    expect(within(draft).queryByTestId('fiscal-document-payment')).not.toBeInTheDocument();
    expect(within(draft).queryByTestId('fiscal-document-pdf')).not.toBeInTheDocument();
    expect(within(draft).queryByTestId('fiscal-document-xml')).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_ADocumentOfTheChannelManager_IsReadOnlyHasNoXmlAndNamesNoSupplier', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([importedDocument()]));
    env.flags = { octorateConnector: true, octorateDocumentImport: true };
    renderPage();

    const [row] = await tableRows();
    expect(within(row).getByTestId('fiscal-document-readonly')).toHaveTextContent('Sola lettura');
    expect(within(row).getByTestId('fiscal-document-state')).toHaveTextContent('Gestito dal tuo channel manager');
    expect(within(row).getByTestId('fiscal-document-source')).toHaveTextContent('Dal tuo channel manager');
    expect(within(row).getByTestId('fiscal-document-pdf')).toBeInTheDocument();
    expect(within(row).queryByTestId('fiscal-document-xml')).not.toBeInTheDocument();
    // The channel manager is named only as «il tuo channel manager».
    expect(globalThis.document.body.textContent).not.toMatch(/octorate/i);
  });

  // Flag rule: the endpoint of the PDF of the channel manager answers 404 while a flag is off, so no button and no request, and no error.
  it.each([
    ['both flags off', {}],
    ['the connector off', { octorateDocumentImport: true }],
    ['the import off', { octorateConnector: true }],
  ])('FiscalDocumentsPage_AnImportedDocumentWith_%s_HasNoPdfButtonAndSaysTheyAreNotAvailable', async (_case, flags) => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([importedDocument()]));
    env.flags = flags;
    renderPage();

    const [row] = await tableRows();
    expect(within(row).queryByTestId('fiscal-document-pdf')).not.toBeInTheDocument();
    expect(within(row).getByTestId('fiscal-document-pdf-unavailable')).toHaveTextContent('PDF non disponibile');
    expect(within(row).getByTestId('fiscal-document-readonly')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('FiscalDocumentsPage_TheBooking_IsALinkForWhoMayReadBookings', async () => {
    renderPage();

    const [row] = await tableRows();
    expect(within(row).getByTestId('fiscal-document-booking')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}`);
  });

  it('FiscalDocumentsPage_TheBooking_IsWordsAndNoLinkForWhoMayNotReadBookings', async () => {
    env.permissions = new Set(['property.read', 'payment.read']);
    renderPage();

    const [row] = await tableRows();
    expect(within(row).getByTestId('fiscal-document-booking-text')).toHaveTextContent('Prenotazione collegata');
    expect(within(row).queryByTestId('fiscal-document-booking')).not.toBeInTheDocument();
  });

  // Privacy rule: whatever the API also sends of the recipient never reaches the page (the API layer keeps the name and nothing fiscal).
  it('FiscalDocumentsPage_TheRecipient_IsShownByNameAndNoFiscalDataIsOnTheScreen', async () => {
    renderPage();

    await tableRows();
    expect(globalThis.document.body.textContent).toContain('Mario Rossi');
    expect(globalThis.document.body.textContent).not.toMatch(/RSSMRA|IT0123456|pec\.example/);
  });

  it('FiscalDocumentsPage_AFailedRead_IsAFailedReadWithARetryAndNeverAnEmptyListOrAllInOrder', async () => {
    vi.mocked(api.listDocuments).mockRejectedValueOnce(failure(500, undefined));
    renderPage();

    expect(await screen.findByText(i18n.t('fiscalDocuments.list.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('fiscalDocuments.list.empty.title'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-count')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await tableRows()).toHaveLength(1);
  });

  it('FiscalDocumentsPage_ANotFoundList_IsToldAsSuchAndNotAsAFailure', async () => {
    vi.mocked(api.listDocuments).mockRejectedValue(failure(404, undefined));
    renderPage();

    expect(await screen.findByText(i18n.t('fiscalDocuments.list.notFound'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_MoreDocumentsThanAPage_AreCountedAndTheNextPageIsAsked', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([document()], 45));
    renderPage();

    expect(await screen.findByTestId('fiscal-documents-count')).toHaveTextContent('45 documenti');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('listView.pagination.next')) }));

    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith({}, 2, 20));
  });
});

describe('FiscalDocumentsPage: the answer of the SDI is not waited for forever', () => {
  // Cost rule: the page asks by itself for a while and stops; it says so in neutral words (never as a failure) and «Controlla di nuovo» asks again. The first read comes before the clock moves.
  it('FiscalDocumentsPage_ADocumentStillWaitingForTheSdiAfterTheWindow_SaysItNoLongerAsksByItselfAndOffersToCheckAgain', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'submitted' })]));
      renderPage();
      await tableRows();
      expect(screen.queryByTestId('fiscal-documents-watch-over')).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_WATCH_MS + SDI_POLL_MS);
      });
      const note = await screen.findByTestId('fiscal-documents-watch-over');
      expect(note).toHaveTextContent(i18n.t('fiscalDocuments.list.watch.over'));
      expect(note.textContent).not.toMatch(/errore|error|non riuscit/i);
      expect(screen.getByRole('table')).toBeInTheDocument();
      const reads = vi.mocked(api.listDocuments).mock.calls.length;

      fireEvent.click(screen.getByTestId('fiscal-documents-check-again'));
      await waitFor(() => expect(vi.mocked(api.listDocuments).mock.calls.length).toBeGreaterThan(reads));
      await waitFor(() => expect(screen.queryByTestId('fiscal-documents-watch-over')).not.toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });

  it('FiscalDocumentsPage_NoDocumentWaitingForTheSdi_NeverSaysItStoppedAsking', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPage();
      await tableRows();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_WATCH_MS + SDI_POLL_MS);
      });
      expect(screen.queryByTestId('fiscal-documents-watch-over')).not.toBeInTheDocument();
      expect(api.listDocuments).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('FiscalDocumentsPage: the empty list', () => {
  beforeEach(() => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([]));
  });

  it.each([
    ['Octorate', 'fiscalDocuments.list.empty.mode.Octorate'],
    ['CasaZenDirectOnly', 'fiscalDocuments.list.empty.mode.CasaZenDirectOnly'],
    ['Accountant', 'fiscalDocuments.list.empty.mode.Accountant'],
  ])('FiscalDocumentsPage_NoDocumentsWhenTheModeIs_%s_ExplainsWhoIssues', async (mode, key) => {
    vi.mocked(api.getDocumentsContext).mockResolvedValue({ ...CONTEXT, mode });
    renderPage();

    await waitFor(() => expect(screen.getByText(i18n.t(key))).toBeInTheDocument());
    expect(screen.getByText(i18n.t('fiscalDocuments.list.empty.title'))).toBeInTheDocument();
  });

  it('FiscalDocumentsPage_NoDocumentsAndNoChoiceYet_SaysSoAndLeadsToTheIssuerWizardForWhoMayChangeIt', async () => {
    vi.mocked(api.getDocumentsContext).mockResolvedValue({ ...CONTEXT, mode: null });
    renderPage();

    await waitFor(() => expect(screen.getByText(i18n.t('fiscalDocuments.list.empty.mode.unset'))).toBeInTheDocument());
    expect(screen.getByRole('link', { name: i18n.t('fiscalDocuments.list.empty.action') })).toHaveAttribute('href', ISSUER_PATH);
  });

  it('FiscalDocumentsPage_NoDocumentsForWhoMayNotWriteTheSetting_HasNoButtonToTheWizard', async () => {
    env.permissions = new Set(['property.read', 'payment.read']);
    vi.mocked(api.getDocumentsContext).mockResolvedValue({ ...CONTEXT, mode: null });
    renderPage();

    await waitFor(() => expect(screen.getByText(i18n.t('fiscalDocuments.list.empty.mode.unset'))).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: i18n.t('fiscalDocuments.list.empty.action') })).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_NoChannelToTheSdi_SaysSendingIsNotAvailableYetInWordsAnAccountantUnderstands', async () => {
    vi.mocked(api.getDocumentsContext).mockResolvedValue({ ...CONTEXT, sdiProviderConfigured: false });
    renderPage();

    expect(await screen.findByTestId('fiscal-documents-sdi-note')).toHaveTextContent(i18n.t('fiscalDocuments.list.note.sdiNotAvailable'));
    expect(screen.getByTestId('fiscal-documents-sdi-note').textContent).not.toMatch(/errore|error/i);
  });

  it('FiscalDocumentsPage_AChannelToTheSdi_HasNoSuchNote', async () => {
    renderPage();

    await screen.findByText(i18n.t('fiscalDocuments.list.empty.title'));
    await waitFor(() => expect(screen.getByText(i18n.t('fiscalDocuments.list.empty.mode.CasaZenDirectOnly'))).toBeInTheDocument());
    expect(screen.queryByTestId('fiscal-documents-sdi-note')).not.toBeInTheDocument();
  });

  // A read that failed says nothing: not that the channel is there, not that it is not, and not who issues.
  it('FiscalDocumentsPage_ASettingThatCouldNotBeRead_ClaimsNothingAboutTheSdiNorAboutWhoIssues', async () => {
    vi.mocked(api.getDocumentsContext).mockRejectedValue(failure(500, undefined));
    renderPage();

    expect(await screen.findByText(i18n.t('fiscalDocuments.list.empty.mode.unknown'))).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-sdi-note')).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_AnInvoiceThatWaitsToBeSent_HasTheNoteTooWhenThereIsNoChannel', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'to_send' })]));
    vi.mocked(api.getDocumentsContext).mockResolvedValue({ ...CONTEXT, sdiProviderConfigured: false });
    renderPage();

    expect(await screen.findByTestId('fiscal-documents-sdi-note')).toBeInTheDocument();
  });
});

describe('FiscalDocumentsPage: the filters', () => {
  it('FiscalDocumentsPage_AFilter_IsAskedOfTheServerFromTheFirstPageAndCanBeCleared', async () => {
    renderPage();
    await tableRows();

    fireEvent.change(screen.getByTestId('fiscal-documents-kind'), { target: { value: 'Invoice' } });
    fireEvent.change(screen.getByTestId('fiscal-documents-source'), { target: { value: 'Octorate' } });
    fireEvent.change(screen.getByTestId('fiscal-documents-from'), { target: { value: '2026-11-01' } });

    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith({ from: '2026-11-01', kind: 'Invoice', source: 'Octorate' }, 1, 20));

    fireEvent.click(screen.getByTestId('fiscal-documents-reset'));
    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith({}, 1, 20));
  });

  it('FiscalDocumentsPage_NoDocumentWithTheFilters_SaysSoAndOffersToClearThem', async () => {
    renderPage();
    await tableRows();
    vi.mocked(api.listDocuments).mockResolvedValue(page([]));

    fireEvent.change(screen.getByTestId('fiscal-documents-status'), { target: { value: 'Discarded' } });

    expect(await screen.findByText(i18n.t('fiscalDocuments.list.empty.filteredTitle'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('fiscalDocuments.list.empty.title'))).not.toBeInTheDocument();
  });

  it('FiscalDocumentsPage_AFirstDayAfterTheLast_IsNotAskedOfTheServerAndSaysWhy', async () => {
    renderPage();
    await tableRows();
    vi.mocked(api.listDocuments).mockClear();

    fireEvent.change(screen.getByTestId('fiscal-documents-from'), { target: { value: '2026-11-30' } });
    fireEvent.change(screen.getByTestId('fiscal-documents-to'), { target: { value: '2026-11-01' } });

    expect(await screen.findByTestId('fiscal-documents-period-problem')).toHaveAttribute('data-problem', 'order');
    expect(api.listDocuments).not.toHaveBeenCalledWith(expect.objectContaining({ from: '2026-11-30', to: '2026-11-01' }), expect.anything(), expect.anything());
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-documents-export-csv')).toBeDisabled();
    expect(screen.getByTestId('fiscal-documents-export-xlsx')).toBeDisabled();
  });
});

describe('FiscalDocumentsPage: the downloads', () => {
  it('FiscalDocumentsPage_ThePdf_IsReadThroughTheClientAndSavedUnderTheNameOfTheServer', async () => {
    vi.mocked(api.downloadPdf).mockResolvedValue({ blob: new Blob(['%PDF']), contentDisposition: 'attachment; filename=documento-A-12.pdf' });
    renderPage();

    const [row] = await tableRows();
    fireEvent.click(within(row).getByTestId('fiscal-document-pdf'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'documento-A-12.pdf'));
    expect(api.downloadPdf).toHaveBeenCalledWith(expect.objectContaining({ id: document().id, source: 'CasaZen' }));
    expect(toast.success).toHaveBeenCalledWith(i18n.t('fiscalDocuments.list.download.done'));
  });

  it('FiscalDocumentsPage_AFileWhoseNameTheBrowserCannotRead_IsNamedFromTheNumberAndNeverFromTheRecipient', async () => {
    vi.mocked(api.downloadXml).mockResolvedValue({ blob: new Blob(['<x/>']), contentDisposition: null });
    renderPage();

    const [row] = await tableRows();
    fireEvent.click(within(row).getByTestId('fiscal-document-xml'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'documento-A-12.xml'));
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).not.toMatch(/mario|rossi/i);
  });

  it('FiscalDocumentsPage_WhileADownloadIsOnTheWay_EveryButtonOfTheSameCardWaitsAndASecondClickStartsNothing', async () => {
    let release: (file: FiscalDocumentFile) => void = () => undefined;
    vi.mocked(api.downloadPdf).mockImplementation(
      () =>
        new Promise<FiscalDocumentFile>((resolve) => {
          release = resolve;
        }),
    );
    renderPage();

    const [row] = await tableRows();
    const pdf = within(row).getByTestId('fiscal-document-pdf');
    const xml = within(row).getByTestId('fiscal-document-xml');
    fireEvent.click(pdf);

    await waitFor(() => expect(pdf).toBeDisabled());
    expect(xml).toBeDisabled();
    fireEvent.click(pdf);
    fireEvent.click(xml);
    expect(api.downloadPdf).toHaveBeenCalledTimes(1);
    expect(api.downloadXml).not.toHaveBeenCalled();

    await act(async () => release({ blob: new Blob(['%PDF']), contentDisposition: null }));
    await waitFor(() => expect(pdf).toBeEnabled());
    expect(xml).toBeEnabled();
  });

  it('FiscalDocumentsPage_ADocumentThatIsNotFoundAnyMore_IsToldAsSuchWhateverTheListStillHoldsAndTheListIsReadAgain', async () => {
    vi.mocked(api.downloadPdf).mockRejectedValue(failure(404, { code: 'fiscal_document_not_found' }));
    renderPage();

    const [row] = await tableRows();
    fireEvent.click(within(row).getByTestId('fiscal-document-pdf'));

    expect(await within(row).findByTestId('fiscal-document-gone')).toHaveTextContent('Questo documento non c’è più.');
    expect(within(row).queryByTestId('fiscal-document-pdf')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.fiscalDocumentNotFound'));
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledTimes(2));
  });

  it('FiscalDocumentsPage_AnXmlTheDocumentDoesNotHave_IsToldNextToItsPdf', async () => {
    vi.mocked(api.downloadXml).mockRejectedValue(failure(404, { code: 'fiscal_document_xml_unavailable' }));
    renderPage();

    const [row] = await tableRows();
    fireEvent.click(within(row).getByTestId('fiscal-document-xml'));

    expect(await within(row).findByTestId('fiscal-document-xml-unavailable')).toBeInTheDocument();
    expect(within(row).queryByTestId('fiscal-document-xml')).not.toBeInTheDocument();
    expect(within(row).getByTestId('fiscal-document-pdf')).toBeInTheDocument();
  });

  // The FatturaPA schema is not installed yet (S091): a 422 that is neither a generic error nor a success, and the person is told an operator adds it.
  it('FiscalDocumentsPage_TheSchemaOfTheInvoiceNotInstalled_IsToldAsNotAvailableYetNeitherAGenericErrorNorASuccess', async () => {
    vi.mocked(api.downloadXml).mockRejectedValue(failure(422, { code: api.FISCAL_DOCUMENT_ERROR.schemaUnavailable }));
    renderPage();

    const [row] = await tableRows();
    fireEvent.click(within(row).getByTestId('fiscal-document-xml'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.fatturapaSchemaUnavailable')));
    expect(toast.error).not.toHaveBeenCalledWith(i18n.t('fiscalDocuments.list.download.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(i18n.t('apiErrors.codes.fatturapaSchemaUnavailable')).toMatch(/non ancora disponibile.*operatore/i);
    await i18n.changeLanguage('en');
    expect(i18n.t('apiErrors.codes.fatturapaSchemaUnavailable')).toMatch(/not available yet.*operator/i);
    // The row stays as it is: the person may ask again.
    expect(within(row).getByTestId('fiscal-document-xml')).toBeEnabled();
  });

  it('FiscalDocumentsPage_AnImportedPdf_IsAskedThroughTheDocumentOfTheChannelManager', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([importedDocument()]));
    vi.mocked(api.downloadPdf).mockResolvedValue({ blob: new Blob(['%PDF']), contentDisposition: null });
    env.flags = { octorateConnector: true, octorateDocumentImport: true };
    renderPage();

    const [row] = await tableRows();
    fireEvent.click(within(row).getByTestId('fiscal-document-pdf'));

    await waitFor(() => expect(api.downloadPdf).toHaveBeenCalledWith(expect.objectContaining({ source: 'Octorate' })));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'documento-2026-77.pdf'));
  });
});

describe('FiscalDocumentsPage: the files of the list', () => {
  it('FiscalDocumentsPage_TheCsvAndTheExcelFile_AreAskedWithTheFiltersOfTheList', async () => {
    vi.mocked(api.exportList).mockResolvedValue({ blob: new Blob(['x']), contentDisposition: 'attachment; filename=documenti-2026-11.csv' });
    renderPage();
    await tableRows();
    fireEvent.change(screen.getByTestId('fiscal-documents-kind'), { target: { value: 'Invoice' } });
    fireEvent.change(screen.getByTestId('fiscal-documents-from'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByTestId('fiscal-documents-to'), { target: { value: '2026-11-30' } });

    fireEvent.click(screen.getByTestId('fiscal-documents-export-csv'));

    await waitFor(() => expect(api.exportList).toHaveBeenCalledWith('csv', { from: '2026-11-01', to: '2026-11-30', kind: 'Invoice' }));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'documenti-2026-11.csv'));

    fireEvent.click(screen.getByTestId('fiscal-documents-export-xlsx'));
    await waitFor(() => expect(api.exportList).toHaveBeenLastCalledWith('xlsx', { from: '2026-11-01', to: '2026-11-30', kind: 'Invoice' }));
  });

  it('FiscalDocumentsPage_WhileAFileIsOnTheWay_BothButtonsWait', async () => {
    let release: (file: FiscalDocumentFile) => void = () => undefined;
    vi.mocked(api.exportList).mockImplementation(
      () =>
        new Promise<FiscalDocumentFile>((resolve) => {
          release = resolve;
        }),
    );
    renderPage();
    await tableRows();

    const csv = screen.getByTestId('fiscal-documents-export-csv');
    const xlsx = screen.getByTestId('fiscal-documents-export-xlsx');
    fireEvent.click(csv);

    await waitFor(() => expect(csv).toBeDisabled());
    expect(xlsx).toBeDisabled();
    fireEvent.click(xlsx);
    expect(api.exportList).toHaveBeenCalledTimes(1);

    await act(async () => release({ blob: new Blob(['x']), contentDisposition: null }));
    await waitFor(() => expect(csv).toBeEnabled());
    expect(xlsx).toBeEnabled();
  });

  // The files hold the issued documents only: with the filter on drafts there is nothing to put in them, and the page says so instead of giving another list.
  it('FiscalDocumentsPage_TheFilterOnDrafts_HasNoFileToAskForAndSaysWhy', async () => {
    renderPage();
    await tableRows();

    fireEvent.change(screen.getByTestId('fiscal-documents-status'), { target: { value: 'Draft' } });

    expect(screen.getByTestId('fiscal-documents-export-csv')).toBeDisabled();
    expect(screen.getByTestId('fiscal-documents-export-xlsx')).toBeDisabled();
    expect(screen.getByTestId('fiscal-documents-export-hint')).toHaveTextContent(i18n.t('fiscalDocuments.list.export.statusBlocked'));
    expect(api.exportList).not.toHaveBeenCalled();
  });

  it('FiscalDocumentsPage_ATooLongList_IsToldWithTheWordsOfTheServerCode', async () => {
    vi.mocked(api.exportList).mockRejectedValue(failure(422, { code: 'csv_too_many_rows' }));
    renderPage();
    await tableRows();

    fireEvent.click(screen.getByTestId('fiscal-documents-export-csv'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.csvTooManyRows')));
    expect(saveBlobAs).not.toHaveBeenCalled();
  });
});

describe('FiscalDocumentsPage: English', () => {
  it('FiscalDocumentsPage_InEnglish_HasTheSameWords', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'rejected', sdiErrorCode: '00305' })]));
    renderPage();

    const [row] = await tableRows();
    expect(within(row).getByTestId('fiscal-document-state')).toHaveTextContent('Rejected by the SDI');
    expect(within(row).getByTestId('fiscal-document-payment')).toHaveTextContent('To collect');
    expect(within(row).getByTestId('fiscal-document-name')).toHaveTextContent('Invoice A/12');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fiscal documents');
  });
});
