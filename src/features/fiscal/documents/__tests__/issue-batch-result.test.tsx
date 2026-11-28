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
  return {
    ...actual,
    listDocuments: vi.fn(),
    getDocumentsContext: vi.fn(),
    issueBatch: vi.fn(),
    issueDocument: vi.fn(),
    discardDraft: vi.fn(),
    listDraftsForBatch: vi.fn(),
    refreshDraft: vi.fn(),
  };
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
    expect(within(dialog).getByTestId('fiscal-documents-batch-summary')).toHaveTextContent(i18n.t('fiscalDocuments.batch.result.some', { issued: 2, asked: 3, failed: 1 }));
    const failures = within(dialog).getAllByTestId('fiscal-documents-batch-failure');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toHaveTextContent('Bruno Neri');
    expect(within(failures[0]).getByTestId('fiscal-documents-batch-failure-reason')).toHaveTextContent(i18n.t('apiErrors.codes.documentDraftOutdated'));
    expect(failures[0].textContent).not.toContain('document_draft_outdated');
    expect(dialog.textContent).not.toContain(i18n.t('fiscalDocuments.batch.result.all', { count: 3 }));
    expect(dialog.textContent).not.toMatch(/tutti/i);
  });

  it('IssueBatch_OneDocumentFailed_StaysTickedSoItCanBeMendedAndAskedAgain', async () => {
    vi.mocked(api.issueBatch).mockResolvedValue(result([issuedRow(A, '2026/6'), failedRow(B, 'document_draft_outdated'), issuedRow(C, '2026/7')]));

    const dialog = await issueAll();
    fireEvent.click(within(dialog).getByTestId('fiscal-documents-batch-close'));

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
    fireEvent.change(screen.getByTestId('fiscal-documents-kind'), { target: { value: 'Receipt' } });
    await act(async () => {
      answerTheSearch({ drafts: DRAFTS, more: false });
    });

    await waitFor(() => expect(screen.getByTestId('fiscal-documents-select-period')).toBeEnabled());
    expect(screen.queryByTestId('fiscal-documents-batch-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-select-note')).not.toBeInTheDocument();
  });
});

describe('a bulk issue never starts a second write on a draft that is being written (data rule)', () => {
  it('IssueSelected_ADraftTickedIsBeingMadeAgain_IsOfferedOnlyOnceThatWriteIsDone', async () => {
    let finishTheRefresh: () => void = () => undefined;
    vi.mocked(api.refreshDraft).mockReturnValue(
      new Promise((resolve) => {
        finishTheRefresh = () => resolve({ id: A, number: null });
      }),
    );
    renderPage();
    const table = await screen.findByRole('table');
    fireEvent.click(screen.getByTestId('fiscal-documents-select-page'));
    const [firstRow] = within(table).getAllByTestId('fiscal-document-row');

    fireEvent.click(within(firstRow).getByTestId('fiscal-document-refresh'));

    await waitFor(() => expect(screen.getByTestId('fiscal-documents-issue-selected')).toBeDisabled());
    expect(within(firstRow).getByTestId('fiscal-document-issue')).toBeDisabled();

    await act(async () => {
      finishTheRefresh();
    });
    await waitFor(() => expect(screen.getByTestId('fiscal-documents-issue-selected')).toBeEnabled());
    expect(api.issueBatch).not.toHaveBeenCalled();
  });
});

describe('a correction is issued one by one, never ticked for the host (data rule)', () => {
  it('SelectThePage_ACreditNoteDraftOnThePage_IsNotTickedByTheHeadAndIsTickedByHand', async () => {
    const stay = [draft({ id: A, recipientName: 'Anna Verdi' }), draft({ id: B, recipientName: 'Bruno Neri' })];
    vi.mocked(api.listDocuments).mockResolvedValue(page([...stay, draft({ id: C, kind: 'CreditNote', recipientName: 'Carla Gialli' })]));
    renderPage();
    const table = await screen.findByRole('table');

    fireEvent.click(screen.getByTestId('fiscal-documents-select-page'));

    expect(screen.getByTestId('fiscal-documents-batch-count')).toHaveTextContent(i18n.t('fiscalDocuments.batch.selected', { count: 2 }));
    const boxes = within(table).getAllByTestId('fiscal-document-select');
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, true, false]);

    fireEvent.click(boxes[2] as HTMLElement);
    expect(screen.getByTestId('fiscal-documents-batch-count')).toHaveTextContent(i18n.t('fiscalDocuments.batch.selected', { count: 3 }));
    fireEvent.click(screen.getByTestId('fiscal-documents-select-page'));
    expect(screen.queryByTestId('fiscal-documents-batch-bar')).not.toBeInTheDocument();
  });
});

describe('a call that is on its way keeps its confirmation open, so that a failure is always told (data rule)', () => {
  const offline = () => Object.assign(new Error('offline'), { isAxiosError: true, code: 'ERR_NETWORK' });

  it('IssueDocument_TheCallIsOnItsWay_TheDialogStaysOnEscapeAndTellsItsFailure', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    vi.mocked(api.issueDocument).mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    renderPage();
    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(row).getByTestId('fiscal-document-issue'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('fiscalDocuments.issue.confirm') }));
    await waitFor(() => expect(api.issueDocument).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => {
      refuse(offline());
    });

    expect(await screen.findByTestId('fiscal-document-issue-problem')).toBeInTheDocument();
  });

  it.each([
    ['IssueDocument', 'fiscal-document-issue', 'fiscalDocuments.issue.confirm'],
    ['DiscardDraft', 'fiscal-document-discard', 'fiscalDocuments.discard.confirm'],
  ])('%s_TheCallSucceeds_TheDialogClosesByItself', async (_case, buttonTestId, confirmKey) => {
    vi.mocked(api.issueDocument).mockResolvedValue({ id: A, number: '2026/6' });
    vi.mocked(api.discardDraft).mockResolvedValue(undefined);
    renderPage();
    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(row).getByTestId(buttonTestId));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t(confirmKey) }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('IssueBatch_TheCallIsOnItsWay_TheConfirmationStaysOnEscapeAndTellsItsFailure', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    vi.mocked(api.issueBatch).mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByTestId('fiscal-documents-select-page'));
    fireEvent.click(screen.getByTestId('fiscal-documents-issue-selected'));
    const confirm = await screen.findByRole('dialog');
    fireEvent.click(within(confirm).getByRole('button', { name: i18n.t('fiscalDocuments.batch.confirm.confirm', { count: 3 }) }));
    await waitFor(() => expect(api.issueBatch).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(confirm, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => {
      refuse(offline());
    });

    expect(await screen.findByTestId('fiscal-documents-batch-problem')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-batch-result')).not.toBeInTheDocument();
  });
});

describe('batchOutcomeOf (the verdict is read from the rows)', () => {
  it.each([
    ['every row issued, nothing left over', result([issuedRow(A, '1'), issuedRow(B, '2')]), 'all'],
    ['one row failed', result([issuedRow(A, '1'), failedRow(B, 'x')]), 'some'],
    ['every row issued but drafts left over', result([issuedRow(A, '1'), issuedRow(B, '2')], 5), 'some'],
    ['every row failed', result([failedRow(A, 'x'), failedRow(B, 'y')]), 'none'],
    ['no row at all', result([]), 'none'],
    ['a count that says all over a failed row', { ...result([issuedRow(A, '1'), failedRow(B, 'x')]), issued: 2, failed: 0 }, 'some'],
  ] as const)('BatchOutcomeOf_%s_IsTold_%s', (_case, answer, verdict) => {
    expect(batchOutcomeOf(answer).verdict).toBe(verdict);
  });
});
