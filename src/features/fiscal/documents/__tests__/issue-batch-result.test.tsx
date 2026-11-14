import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as api from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import type { FiscalDocumentBatchResult, FiscalDocumentEntry } from '@/types';
import { FiscalDocumentsPage } from '../fiscal-documents-page';
import { batchOutcomeOf } from '../document-model';
import { draft } from './document-fixtures';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, listDocuments: vi.fn(), getDocumentsContext: vi.fn(), issueBatch: vi.fn(), listDraftsForBatch: vi.fn() };
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

const A = 'd0000000-0000-4000-8000-0000000000a1';
const B = 'd0000000-0000-4000-8000-0000000000b2';
const C = 'd0000000-0000-4000-8000-0000000000c3';
const DRAFTS: FiscalDocumentEntry[] = [
  draft({ id: A, recipientName: 'Anna Verdi' }),
  draft({ id: B, recipientName: 'Bruno Neri' }),
  draft({ id: C, recipientName: 'Carla Gialli' }),
];

const page = (items: FiscalDocumentEntry[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });
const issuedRow = (id: string, number: string) => ({ id, issued: true, number, errorCode: null });
const failedRow = (id: string, errorCode: string | null) => ({ id, issued: false, number: null, errorCode });
const result = (rows: FiscalDocumentBatchResult['rows'], remaining = 0): FiscalDocumentBatchResult => ({
  rows,
  issued: rows.filter((row) => row.issued).length,
  failed: rows.filter((row) => !row.issued).length,
  remaining,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, createElement(FiscalDocumentsPage))));
}

/** Ticks the three drafts, asks to issue them and confirms: the dialog of the answer is what comes next. */
async function issueAll() {
  renderPage();
  await screen.findByRole('table');
  fireEvent.click(screen.getByTestId('fiscal-documents-select-page'));
  expect(screen.getByTestId('fiscal-documents-batch-count')).toHaveTextContent(i18n.t('fiscalDocuments.batch.selected', { count: 3 }));
  fireEvent.click(screen.getByTestId('fiscal-documents-issue-selected'));

  const confirm = await screen.findByRole('dialog');
  fireEvent.click(within(confirm).getByRole('button', { name: i18n.t('fiscalDocuments.batch.confirm.confirm', { count: 3 }) }));
  return screen.findByTestId('fiscal-documents-batch-result');
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.permissions = new Set(['payment.read', 'property.read', 'booking.read', 'payment.write']);
  env.flags = { fiscalDocumentIssuance: true };
  await i18n.changeLanguage('it');
  vi.mocked(api.listDocuments).mockResolvedValue(page(DRAFTS));
  vi.mocked(api.getDocumentsContext).mockResolvedValue({ mode: 'CasaZen', casazenIssuanceEnabled: true, sdiProviderConfigured: true, guestDocumentSeries: '' });
});

describe('a bulk issue says what happened to every document and never that all went well when one did not (data rule)', () => {
  it('IssueBatch_OneDocumentFailed_ShowsTheFailureWithItsReasonAndNeverSaysAllWereIssued', async () => {
    vi.mocked(api.issueBatch).mockResolvedValue(result([issuedRow(A, '2026/6'), failedRow(B, 'document_draft_outdated'), issuedRow(C, '2026/7')]));

    const dialog = await issueAll();

    expect(api.issueBatch).toHaveBeenCalledWith([A, B, C]);
    expect(dialog).toHaveAttribute('data-verdict', 'some');
    // How many were issued out of how many, and the one that was not.
    expect(within(dialog).getByTestId('fiscal-documents-batch-summary')).toHaveTextContent(i18n.t('fiscalDocuments.batch.result.some', { issued: 2, asked: 3, failed: 1 }));
    const failures = within(dialog).getAllByTestId('fiscal-documents-batch-failure');
    expect(failures).toHaveLength(1);
    // The failure is named by what the person knows of it and told in plain words, never as a bare code.
    expect(failures[0]).toHaveTextContent('Bruno Neri');
    expect(within(failures[0]).getByTestId('fiscal-documents-batch-failure-reason')).toHaveTextContent(i18n.t('apiErrors.codes.documentDraftOutdated'));
    expect(failures[0].textContent).not.toContain('document_draft_outdated');
    // Never the sentence that says it all went well.
    expect(dialog.textContent).not.toContain(i18n.t('fiscalDocuments.batch.result.all', { count: 3 }));
    expect(dialog.textContent).not.toMatch(/tutti/i);
  });

  it('IssueBatch_OneDocumentFailed_StaysTickedSoItCanBeMendedAndAskedAgain', async () => {
    vi.mocked(api.issueBatch).mockResolvedValue(result([issuedRow(A, '2026/6'), failedRow(B, 'document_draft_outdated'), issuedRow(C, '2026/7')]));

    const dialog = await issueAll();
    fireEvent.click(within(dialog).getByTestId('fiscal-documents-batch-close'));

    // What was issued left the selection; what was not is still ticked: one draft is selected.
    await waitFor(() => expect(screen.getByTestId('fiscal-documents-batch-count')).toHaveTextContent(i18n.t('fiscalDocuments.batch.selected', { count: 1 })));
  });

  it('IssueBatch_EveryDocumentIssued_SaysSoOnlyThen', async () => {
    vi.mocked(api.issueBatch).mockResolvedValue(result([issuedRow(A, '2026/6'), issuedRow(B, '2026/7'), issuedRow(C, '2026/8')]));

    const dialog = await issueAll();

    expect(dialog).toHaveAttribute('data-verdict', 'all');
    expect(within(dialog).getByTestId('fiscal-documents-batch-summary')).toHaveTextContent(i18n.t('fiscalDocuments.batch.result.all', { count: 3 }));
    expect(within(dialog).queryByTestId('fiscal-documents-batch-failures')).not.toBeInTheDocument();
  });

  it('IssueBatch_NoDocumentIssued_SaysNoneWasAndListsEachReason', async () => {
    vi.mocked(api.issueBatch).mockResolvedValue(
      result([failedRow(A, 'document_rule_not_configured'), failedRow(B, 'a_code_nobody_has_words_for'), failedRow(C, null)]),
    );

    const dialog = await issueAll();

    expect(dialog).toHaveAttribute('data-verdict', 'none');
    expect(within(dialog).getByTestId('fiscal-documents-batch-summary')).toHaveTextContent(i18n.t('fiscalDocuments.batch.result.none'));
    const reasons = within(dialog).getAllByTestId('fiscal-documents-batch-failure-reason').map((reason) => reason.textContent);
    expect(reasons).toEqual([
      i18n.t('apiErrors.codes.documentRuleNotConfigured'),
      i18n.t('fiscalDocuments.batch.result.reasonUnknown'),
      i18n.t('fiscalDocuments.batch.result.reasonUnknown'),
    ]);
  });

  it('IssueBatch_TheWholeCallFails_IsToldInTheConfirmationAndIsNeverReadAsASuccess', async () => {
    vi.mocked(api.issueBatch).mockRejectedValue(Object.assign(new Error('offline'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByTestId('fiscal-documents-select-page'));
    fireEvent.click(screen.getByTestId('fiscal-documents-issue-selected'));

    const confirm = await screen.findByRole('dialog');
    fireEvent.click(within(confirm).getByRole('button', { name: i18n.t('fiscalDocuments.batch.confirm.confirm', { count: 3 }) }));

    expect(await screen.findByTestId('fiscal-documents-batch-problem')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-batch-result')).not.toBeInTheDocument();
    // Nothing is told as issued and the three drafts stay ticked.
    expect(screen.getByTestId('fiscal-documents-batch-count')).toHaveTextContent(i18n.t('fiscalDocuments.batch.selected', { count: 3 }));
  });
});

describe('what is ticked belongs to the filters it was ticked under (data rule)', () => {
  it('SelectThePeriod_TheFiltersChangeWhileTheSearchRuns_NeverTicksTheDraftsOfTheOldFilters', async () => {
    let answerTheSearch: (found: { drafts: FiscalDocumentEntry[]; more: boolean }) => void = () => undefined;
    vi.mocked(api.listDraftsForBatch).mockReturnValue(
      new Promise((resolve) => {
        answerTheSearch = resolve;
      }),
    );
    renderPage();
    await screen.findByRole('table');

    fireEvent.click(screen.getByTestId('fiscal-documents-select-period'));
    await waitFor(() => expect(api.listDraftsForBatch).toHaveBeenCalledTimes(1));
    // The person changes a filter while the search is still running, and the search of the old filters answers afterwards.
    fireEvent.change(screen.getByTestId('fiscal-documents-kind'), { target: { value: 'Receipt' } });
    await act(async () => {
      answerTheSearch({ drafts: DRAFTS, more: false });
    });

    // Nothing is ticked under the new filters and nothing is told of the old search; the button is free to ask again for the new filters.
    await waitFor(() => expect(screen.getByTestId('fiscal-documents-select-period')).toBeEnabled());
    expect(screen.queryByTestId('fiscal-documents-batch-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-select-note')).not.toBeInTheDocument();
  });
});

describe('batchOutcomeOf (the verdict is read from the rows)', () => {
  it.each([
    ['every row issued, nothing left over', result([issuedRow(A, '1'), issuedRow(B, '2')]), 'all'],
    ['one row failed', result([issuedRow(A, '1'), failedRow(B, 'x')]), 'some'],
    ['every row issued but drafts left over', result([issuedRow(A, '1'), issuedRow(B, '2')], 5), 'some'],
    ['every row failed', result([failedRow(A, 'x'), failedRow(B, 'y')]), 'none'],
    ['no row at all', result([]), 'none'],
    // The counts of the answer are not trusted over its rows: a total that says «all» over a row that failed is still not «all».
    ['a count that says all over a failed row', { ...result([issuedRow(A, '1'), failedRow(B, 'x')]), issued: 2, failed: 0 }, 'some'],
  ] as const)('BatchOutcomeOf_%s_IsTold_%s', (_case, answer, verdict) => {
    expect(batchOutcomeOf(answer).verdict).toBe(verdict);
  });
});
