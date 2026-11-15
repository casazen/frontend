import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import type { OwnerBulkOwnerResult, OwnerBulkRun, OwnerCloseReadiness } from '@/types';
import { BulkCloseDialog } from '../components/bulk-close-dialog';
import { isRunOver, suggestedBulkAction, unansweredOf, verdictOf } from '../bulk-close-model';
import { MonthEndClosePage } from '../month-end-close-page';
import { summarize } from '../owner-accounting-model';
import { MONTH, OTHER_OWNER_ID, OWNER_ID, YEAR, ownerReadiness, readiness, version } from './owner-accounting-fixtures';

const api = vi.hoisted(() => ({
  runBulkStep: vi.fn(),
  getBulkRun: vi.fn(),
  listOwners: vi.fn(),
  getOnboardingReadiness: vi.fn(),
  getReadiness: vi.fn(),
  listVersions: vi.fn(),
  listPayouts: vi.fn(),
}));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));
vi.mock('../components/tax-filing-panel', () => ({ TaxFilingPanel: () => null }));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const THIRD_OWNER_ID = '33333333-3333-4333-8333-333333333333';
const NAMES = new Map([
  [OWNER_ID, 'Marta Rossi'],
  [OTHER_OWNER_ID, 'Luca Bianchi'],
  [THIRD_OWNER_ID, 'Giulia Verdi'],
]);
const nameOf = (ownerId: string) => NAMES.get(ownerId) ?? ownerId;

const row = (ownerId: string, overrides: Partial<OwnerBulkOwnerResult> = {}): OwnerBulkOwnerResult => ({ ownerId, ok: true, code: null, unchanged: false, issues: null, details: null, ...overrides });
const run = (overrides: Partial<OwnerBulkRun> = {}): OwnerBulkRun => ({ jobId: null, action: 'Approve', year: YEAR, month: MONTH, status: 'Completed', total: 3, results: [], errorCode: null, ...overrides });

/** What the server answers to a refusal: the status and the problem with its code. */
const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });
/** What axios throws when there is no answer at all. */
const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });
/** An answer settled from outside: the request that is on its way. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Three owners with a draft each: the month asks for the approval. */
const MONTH_OF_THREE: OwnerCloseReadiness = readiness([
  ownerReadiness({ ownerId: OWNER_ID, latestStatus: 'Draft' }),
  ownerReadiness({ ownerId: OTHER_OWNER_ID, latestStatus: 'Draft' }),
  ownerReadiness({ ownerId: THIRD_OWNER_ID, latestStatus: 'Draft' }),
]);

function renderDialog(options: { monthOver?: boolean; pollMs?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const onOpenChange = vi.fn();
  const onKeepChange = vi.fn();
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        null,
        createElement(BulkCloseDialog, {
          open: true,
          onOpenChange,
          onKeepChange,
          period: { year: YEAR, month: MONTH },
          readiness: MONTH_OF_THREE,
          summary: summarize(MONTH_OF_THREE),
          monthOver: options.monthOver ?? true,
          nameOf,
          pollMs: options.pollMs ?? 10,
        }),
      ),
    ),
  );
  return { onOpenChange, onKeepChange };
}

/** Starts the step that is chosen: the button is waited for until it can be pressed, never a fixed time. */
async function start() {
  const confirm = await screen.findByTestId('bulk-confirm');
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
}

const stepLabel = (action: string) => text(`ownerAccounting.bulk.step.${action}.label`);

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
});

afterEach(() => cleanup());

describe('what a bulk run comes to (E13/F02/US03/T01)', () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => row(`owner-${index}`));

  it('BulkVerdict_FromTheRowsOnly_NeverAllDoneWhileOneRowSaysOtherwise_Test', () => {
    expect(verdictOf(run({ total: 3, results: rows(3) }))).toBe('allDone');
    expect(verdictOf(run({ total: 3, results: [...rows(2), row('x', { ok: false, code: 'fx_missing' })] }))).toBe('someNotDone');
    // The server's own `allDone` is never read: the rows say.
    expect(verdictOf({ ...run({ total: 3, results: [...rows(2), row('x', { ok: false, code: 'fx_missing' })] }), allDone: true } as OwnerBulkRun)).toBe('someNotDone');
    // A run that is over without a row for every owner it was asked for is not «fatto».
    expect(verdictOf(run({ total: 3, results: rows(2) }))).toBe('incomplete');
    // A run that failed itself is not either, even when every row it has is fine.
    expect(verdictOf(run({ status: 'Failed', total: 3, results: rows(3), errorCode: 'owner_bulk_failed' }))).toBe('runFailed');
    // A status a later server adds is over (nobody waits for it for ever) and is not a success.
    const unknown = { ...run({ total: 1, results: rows(1) }), status: 'Paused' } as unknown as OwnerBulkRun;
    expect(isRunOver(unknown)).toBe(true);
    expect(verdictOf(unknown)).toBe('runFailed');
    // A version made with anomalies is a statement made, and a line of its own.
    expect(verdictOf(run({ action: 'Generate', total: 2, results: [row('a'), row('b', { code: 'owner_statement_flagged', issues: ['fx_missing'] })] }))).toBe('doneWithFlags');
    expect(verdictOf(run({ total: 0, results: [] }))).toBe('empty');
    expect(verdictOf(run({ jobId: 'job', status: 'Running', total: 3, results: rows(1) }))).toBe('running');
    expect(verdictOf(run({ jobId: 'job', status: 'Queued', total: 3, results: [] }))).toBe('running');
  });

  it('UnansweredOf_TheOwnersAskedForThatHaveNoRow_WhateverTheVerdictSays', () => {
    expect(unansweredOf(run({ total: 5, results: rows(3) }))).toBe(2);
    // A failure does not hide them: the verdict is «someNotDone» and two owners still have no answer.
    const failedWithGaps = run({ total: 5, results: [...rows(2), row('x', { ok: false, code: 'fx_missing' })] });
    expect(verdictOf(failedWithGaps)).toBe('someNotDone');
    expect(unansweredOf(failedWithGaps)).toBe(2);
    expect(unansweredOf(run({ total: 3, results: rows(3) }))).toBe(0);
    expect(unansweredOf(run({ total: 0, results: [] }))).toBe(0);
  });

  it('SuggestedStep_FollowsTheMonth_PostThenGenerateApprovePublishClose', () => {
    const suggest = (month: OwnerCloseReadiness, monthOver = true) => suggestedBulkAction(month, summarize(month), monthOver);
    const unposted = { code: 'unposted_source', ownerId: null, propertyId: null, sourceId: null, blocking: false };

    expect(suggest(readiness([ownerReadiness({ latestStatus: null, latestVersion: null })], [unposted]))).toBe('Post');
    expect(suggest(readiness([ownerReadiness({ latestStatus: null, latestVersion: null })]))).toBe('Generate');
    expect(suggest(readiness([ownerReadiness({ latestStatus: 'Draft' })]))).toBe('Approve');
    expect(suggest(readiness([ownerReadiness({ latestStatus: 'Approved' })]))).toBe('Publish');
    expect(suggest(readiness([ownerReadiness({ latestStatus: 'Published' })]))).toBe('Close');
    // The close is not suggested for a month that is not over, nor for one that is closed.
    expect(suggest(readiness([ownerReadiness({ latestStatus: 'Published' })]), false)).toBe('Post');
    expect(suggest(readiness([ownerReadiness({ latestStatus: 'Published', status: 'Closed' })]))).toBe('Post');
  });
});

describe('«Esegui per tutti»: the result of the run, owner by owner (E13/F02/US03/T01, NF-110)', () => {
  it('BulkResult_AFailedOwnerIsListedWithItsReason_NeverAllDone_Test', async () => {
    api.runBulkStep.mockResolvedValue(
      run({
        total: 3,
        results: [row(OWNER_ID), row(OTHER_OWNER_ID, { ok: false, code: 'owner_statement_flagged', issues: ['fx_missing'] }), row(THIRD_OWNER_ID, { unchanged: true })],
      }),
    );
    renderDialog();

    // The suggestion is the approval (three drafts), and the run is for everyone: no list of owners is sent.
    expect(await screen.findByTestId('bulk-step')).toHaveValue('Approve');
    await start();
    const result = await screen.findByTestId('bulk-result');
    expect(api.runBulkStep).toHaveBeenCalledTimes(1);
    expect(api.runBulkStep).toHaveBeenCalledWith(YEAR, MONTH, { action: 'Approve' });

    // The run says what it comes to, from its rows: one owner did not go through, and «fatto per tutti» is not on the screen.
    expect(result).toHaveAttribute('data-verdict', 'someNotDone');
    const step = stepLabel('Approve');
    expect(screen.getByTestId('bulk-headline')).toHaveTextContent(text('ownerAccounting.bulk.result.headline.someNotDone', { count: 1, total: 3, step }));
    expect(screen.queryByText(text('ownerAccounting.bulk.result.headline.allDone', { count: 3, step }))).toBeNull();

    // The owner that failed is listed, by name, with the reason in words and the anomalies behind it; the others are not in that list.
    const failed = screen.getByTestId('bulk-failed');
    const rowsFailed = within(failed).getAllByTestId('bulk-result-row');
    expect(rowsFailed).toHaveLength(1);
    expect(rowsFailed[0]).toHaveAttribute('data-owner', OTHER_OWNER_ID);
    expect(rowsFailed[0]).toHaveAttribute('data-kind', 'failed');
    expect(rowsFailed[0]).toHaveTextContent('Luca Bianchi');
    expect(within(rowsFailed[0] as HTMLElement).getByTestId('bulk-result-reason')).toHaveTextContent(text('apiErrors.codes.ownerStatementFlagged'));
    expect(within(rowsFailed[0] as HTMLElement).getByTestId('bulk-result-issues')).toHaveTextContent(text('ownerAccounting.issue.fxMissing.title'));
    expect(within(failed).queryByText('Marta Rossi')).toBeNull();
    // The two that did not fail wait under one line, each as what it is.
    expect(screen.getByTestId('bulk-tally-failed')).toHaveTextContent(text('ownerAccounting.bulk.result.tally.failed', { count: 1 }));
    expect(screen.getByTestId('bulk-tally-done')).toHaveTextContent(text('ownerAccounting.bulk.result.tally.done', { count: 1 }));
    expect(screen.getByTestId('bulk-tally-unchanged')).toHaveTextContent(text('ownerAccounting.bulk.result.tally.unchanged', { count: 1 }));
  });

  it('BulkResult_AFailedOwnerWhileOthersHaveNoRow_SaysSoToo_NeverOnlyHowManyFailed', async () => {
    api.runBulkStep.mockResolvedValue(run({ total: 5, results: [row(OWNER_ID), row(OTHER_OWNER_ID), row(THIRD_OWNER_ID, { ok: false, code: 'fx_missing' })] }));
    renderDialog();
    await start();

    // «1 out of 5 did not go through» is not all that is known: two owners have no answer at all, and the screen says it.
    expect(await screen.findByTestId('bulk-result')).toHaveAttribute('data-verdict', 'someNotDone');
    expect(screen.getByTestId('bulk-headline')).toHaveTextContent(text('ownerAccounting.bulk.result.headline.someNotDone', { count: 1, total: 5, step: stepLabel('Approve') }));
    expect(screen.getByTestId('bulk-unanswered')).toHaveTextContent(text('ownerAccounting.bulk.result.unanswered', { count: 2, total: 5 }));
  });

  it('BulkResult_EveryOwnerDone_SaysDoneForAllAndListsNobody', async () => {
    api.runBulkStep.mockResolvedValue(run({ total: 3, results: [row(OWNER_ID), row(OTHER_OWNER_ID), row(THIRD_OWNER_ID, { unchanged: true })] }));
    renderDialog();
    await start();

    const result = await screen.findByTestId('bulk-result');
    expect(result).toHaveAttribute('data-verdict', 'allDone');
    expect(screen.getByTestId('bulk-headline')).toHaveTextContent(text('ownerAccounting.bulk.result.headline.allDone', { count: 3, step: stepLabel('Approve') }));
    expect(screen.queryByTestId('bulk-failed')).toBeNull();
    expect(screen.queryByTestId('bulk-flagged')).toBeNull();
    expect(screen.queryByTestId('bulk-unanswered')).toBeNull();
  });

  it('BulkResult_AStatementMadeWithAnomalies_IsListedWithTheirReasons_AndTheRunIsNotAllDone', async () => {
    api.runBulkStep.mockResolvedValue(
      run({
        action: 'Generate',
        total: 2,
        results: [row(OWNER_ID), row(OTHER_OWNER_ID, { code: 'owner_statement_flagged', issues: ['channel_commission_missing', 'fx_missing'] })],
      }),
    );
    renderDialog();
    fireEvent.change(await screen.findByTestId('bulk-step'), { target: { value: 'Generate' } });
    await start();

    expect(await screen.findByTestId('bulk-result')).toHaveAttribute('data-verdict', 'doneWithFlags');
    const flagged = screen.getByTestId('bulk-flagged');
    const flaggedRow = within(flagged).getByTestId('bulk-result-row');
    expect(flaggedRow).toHaveAttribute('data-owner', OTHER_OWNER_ID);
    expect(flaggedRow).toHaveAttribute('data-kind', 'flagged');
    expect(within(flaggedRow).getByTestId('bulk-result-issues')).toHaveTextContent(text('ownerAccounting.issue.channelCommissionMissing.title'));
    expect(within(flaggedRow).getByTestId('bulk-result-issues')).toHaveTextContent(text('ownerAccounting.issue.fxMissing.title'));
    // A missing commission of a portal is resolved in the channel commissions: the row says where.
    expect(within(flaggedRow).getByTestId('bulk-result-fix')).toHaveAttribute('href', '/app/account/channel-commissions');
    expect(screen.queryByText(text('ownerAccounting.bulk.result.headline.allDone', { count: 2, step: stepLabel('Generate') }))).toBeNull();
  });

  it('BulkResult_ARunThatEndedWithoutARowForEveryOwner_IsNeverDone', async () => {
    api.runBulkStep.mockResolvedValue(run({ total: 3, results: [row(OWNER_ID), row(OTHER_OWNER_ID)] }));
    renderDialog();
    await start();

    const result = await screen.findByTestId('bulk-result');
    expect(result).toHaveAttribute('data-verdict', 'incomplete');
    expect(screen.getByTestId('bulk-headline')).toHaveTextContent(text('ownerAccounting.bulk.result.headline.incomplete', { count: 2, total: 3, step: stepLabel('Approve') }));
    expect(screen.queryByText(text('ownerAccounting.bulk.result.headline.allDone', { count: 3, step: stepLabel('Approve') }))).toBeNull();
    // The headline already says it: no second line for the same owners.
    expect(screen.queryByTestId('bulk-unanswered')).toBeNull();
  });

  it('BulkResult_ARunThatFailedItself_SaysSoWithItsReason_AndKeepsWhatItDid', async () => {
    api.runBulkStep.mockResolvedValue(run({ jobId: 'job-1', status: 'Queued', total: 3, results: [] }));
    api.getBulkRun.mockResolvedValue(run({ jobId: 'job-1', status: 'Failed', total: 3, results: [row(OWNER_ID)], errorCode: 'owner_bulk_failed' }));
    renderDialog();
    await start();

    const result = await screen.findByTestId('bulk-result');
    expect(result).toHaveAttribute('data-verdict', 'runFailed');
    expect(screen.getByTestId('bulk-headline')).toHaveTextContent(text('ownerAccounting.bulk.result.headline.runFailed', { step: stepLabel('Approve') }));
    expect(screen.getByTestId('bulk-headline')).toHaveTextContent(text('ownerAccounting.bulk.reason.ownerBulkFailed'));
    expect(screen.getByTestId('bulk-tally-done')).toBeInTheDocument();
  });

  it('BulkResult_ACloseThatDoesNotReconcile_ShowsItsFiguresWithoutACurrencySymbol_AndSaysSo', async () => {
    const queued = deferred<OwnerBulkRun>();
    const running = deferred<OwnerBulkRun>();
    api.runBulkStep.mockResolvedValue(run({ action: 'Close', jobId: 'job-2', status: 'Queued', total: 3, results: [] }));
    api.getBulkRun
      .mockImplementationOnce(() => queued.promise)
      .mockImplementationOnce(() => running.promise)
      .mockResolvedValue(
        run({
          action: 'Close',
          jobId: 'job-2',
          status: 'Completed',
          total: 3,
          results: [row(OWNER_ID), row(OTHER_OWNER_ID, { ok: false, code: 'owner_close_unreconciled', details: { due: 800, paid: 700, difference: 100 } }), row(THIRD_OWNER_ID)],
        }),
      );
    renderDialog();

    // Closing the months of everybody asks for the word, as the close of one owner does.
    fireEvent.change(await screen.findByTestId('bulk-step'), { target: { value: 'Close' } });
    const confirm = screen.getByTestId('bulk-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('bulk-word'), { target: { value: text('ownerAccounting.close.word').toLowerCase() } });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    // Queued: nothing answered yet, and nothing says «fatto».
    const progress = await screen.findByTestId('bulk-progress');
    expect(progress).toHaveAttribute('data-status', 'Queued');
    expect(screen.getByTestId('bulk-progress-text')).toHaveTextContent(text('ownerAccounting.bulk.progress.queued'));
    expect(screen.queryByTestId('bulk-result')).toBeNull();
    queued.resolve(run({ action: 'Close', jobId: 'job-2', status: 'Running', total: 3, results: [row(OWNER_ID)] }));

    // Running: one owner out of three, as a number and a bar.
    await waitFor(() => expect(screen.getByTestId('bulk-progress-text')).toHaveTextContent(text('ownerAccounting.bulk.progress.text', { count: 1, total: 3 })));
    expect(screen.getByTestId('bulk-progress-bar')).toHaveAttribute('aria-valuenow', '33');
    expect(screen.queryByTestId('bulk-result')).toBeNull();
    running.resolve(run({ action: 'Close', jobId: 'job-2', status: 'Running', total: 3, results: [row(OWNER_ID), row(OTHER_OWNER_ID, { ok: false, code: 'owner_close_unreconciled' })] }));

    // Over: the owner whose balance does not match the payments is listed, with the figures the server gave (no currency: no symbol, and the words say it), and the run is not done.
    const failed = await screen.findByTestId('bulk-failed');
    expect(screen.getByTestId('bulk-result')).toHaveAttribute('data-verdict', 'someNotDone');
    expect(within(failed).getByTestId('bulk-result-row')).toHaveAttribute('data-owner', OTHER_OWNER_ID);
    expect(within(failed).getByTestId('bulk-result-reason')).toHaveTextContent(text('ownerAccounting.bulk.reason.ownerCloseUnreconciled'));
    const figures = within(failed).getByTestId('bulk-result-figures');
    expect(figures).toHaveTextContent(text('ownerAccounting.bulk.result.figures', { due: '800,00', paid: '700,00', difference: '100,00' }));
    expect(figures.textContent).not.toMatch(/€|\$|£|CHF|EUR/);
    expect(within(failed).getByText(text('ownerAccounting.bulk.result.figuresNoCurrency'))).toBeInTheDocument();
    expect(screen.queryByText(text('ownerAccounting.bulk.result.headline.allDone', { count: 3, step: stepLabel('Close') }))).toBeNull();
    expect(api.runBulkStep).toHaveBeenCalledWith(YEAR, MONTH, { action: 'Close' });
  });

  it('BulkRun_AProgressThatCannotBeRead_IsNeverShownAsProgressOrAsDone_AndCanBeAskedAgain', async () => {
    api.runBulkStep.mockResolvedValue(run({ jobId: 'job-3', status: 'Queued', total: 3, results: [] }));
    api.getBulkRun.mockRejectedValueOnce(networkError()).mockResolvedValue(run({ jobId: 'job-3', status: 'Completed', total: 3, results: [row(OWNER_ID), row(OTHER_OWNER_ID), row(THIRD_OWNER_ID)] }));
    renderDialog();
    await start();

    expect(await screen.findByTestId('bulk-read-error')).toHaveTextContent(text('ownerAccounting.bulk.progress.readError'));
    expect(screen.queryByTestId('bulk-result')).toBeNull();
    const retry = screen.getByTestId('bulk-read-retry');
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);

    expect(await screen.findByTestId('bulk-result')).toHaveAttribute('data-verdict', 'allDone');
    expect(screen.queryByTestId('bulk-read-error')).toBeNull();
  });

  it('BulkRun_ARunTheServerHasForgotten_IsNotFound_EvenWithAnswersAlreadyRead', async () => {
    const first = deferred<OwnerBulkRun>();
    api.runBulkStep.mockResolvedValue(run({ jobId: 'job-4', status: 'Queued', total: 3, results: [] }));
    api.getBulkRun.mockImplementationOnce(() => first.promise).mockRejectedValue(problem(404, 'owner_bulk_job_not_found'));
    renderDialog();
    await start();

    await screen.findByTestId('bulk-progress');
    first.resolve(run({ jobId: 'job-4', status: 'Running', total: 3, results: [row(OWNER_ID)] }));

    // The 404 comes after an answer was read: the answer that is still in the cache is not shown as the state of the run.
    const notFound = await screen.findByTestId('bulk-read-error');
    expect(notFound).toHaveTextContent(text('ownerAccounting.bulk.progress.notFound'));
    expect(screen.queryByTestId('bulk-read-retry')).toBeNull();
    expect(screen.queryByTestId('bulk-result')).toBeNull();
  });

  it('BulkRun_AStepTheServerRefuses_StaysOnTheQuestionWithTheReason_AndShowsNoResult', async () => {
    api.runBulkStep.mockRejectedValue(problem(409, 'owner_period_not_ended'));
    renderDialog();
    fireEvent.change(await screen.findByTestId('bulk-step'), { target: { value: 'Close' } });
    fireEvent.change(screen.getByTestId('bulk-word'), { target: { value: text('ownerAccounting.close.word') } });
    await start();

    expect(await screen.findByTestId('bulk-error')).toHaveTextContent(text('apiErrors.codes.ownerPeriodNotEnded'));
    expect(screen.getByTestId('bulk-start')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-result')).toBeNull();
    expect(screen.queryByTestId('bulk-progress')).toBeNull();
  });

  it('BulkStart_TheCloseIsNotOfferedForAMonthThatIsNotOver_AndNothingIsSentWithoutTheWord', async () => {
    renderDialog({ monthOver: false });
    const select = await screen.findByTestId('bulk-step');
    const close = within(select).getByRole('option', { name: text('ownerAccounting.bulk.choose.closedLater', { label: stepLabel('Close') }) });
    expect(close).toBeDisabled();
    expect(within(select).getByRole('option', { name: text('ownerAccounting.bulk.choose.suggested', { label: stepLabel('Approve') }) })).toBeInTheDocument();
    // The consequences of the chosen step are on the screen before anything is asked.
    expect(screen.getByTestId('bulk-consequences')).toHaveTextContent(text('ownerAccounting.bulk.step.Approve.consequence1'));
    expect(screen.getByTestId('bulk-count')).toHaveTextContent(text('ownerAccounting.bulk.count', { count: 3 }));
    expect(api.runBulkStep).not.toHaveBeenCalled();
  });

  it('BulkRun_LeavingWhileItGoesOn_IsToldAndDoesNotPretendItIsOver', async () => {
    const first = deferred<OwnerBulkRun>();
    api.runBulkStep.mockResolvedValue(run({ jobId: 'job-5', status: 'Queued', total: 3, results: [] }));
    api.getBulkRun.mockImplementation(() => first.promise);
    const { onOpenChange, onKeepChange } = renderDialog();
    await start();

    await screen.findByTestId('bulk-progress');
    const close = screen.getByTestId('bulk-close');
    await waitFor(() => expect(close).toBeEnabled());
    fireEvent.click(close);

    // Told, and the page is asked to keep the dialog (closed): the run is still followed from there.
    expect(toast.warning).toHaveBeenCalledWith(text('ownerAccounting.bulk.leftRunning'));
    expect(onKeepChange).toHaveBeenCalledWith(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('BulkRun_LeavingAfterItEnded_IsToldNothing_AndNothingIsKept', async () => {
    api.runBulkStep.mockResolvedValue(run({ total: 3, results: [row(OWNER_ID), row(OTHER_OWNER_ID), row(THIRD_OWNER_ID)] }));
    const { onOpenChange, onKeepChange } = renderDialog();
    await start();

    const close = await screen.findByTestId('bulk-close');
    await waitFor(() => expect(close).toBeEnabled());
    fireEvent.click(close);

    expect(toast.warning).not.toHaveBeenCalled();
    expect(onKeepChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('«Esegui per tutti» on the month-end page (E13/F02/US03/T01)', () => {
  const OWNERS = [
    { id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' },
    { id: OTHER_OWNER_ID, firstName: 'Luca', lastName: 'Bianchi' },
  ];

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    return render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [`/app/account/owner-close?period=${YEAR}-01`] },
          createElement(Routes, null, createElement(Route, { path: '/app/account/owner-close', element: createElement(MonthEndClosePage) })),
        ),
      ),
    );
  }

  beforeEach(() => {
    api.listOwners.mockResolvedValue(OWNERS);
    api.getOnboardingReadiness.mockResolvedValue(null);
    api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ ownerId: OWNER_ID, latestStatus: 'Draft' }), ownerReadiness({ ownerId: OTHER_OWNER_ID, latestStatus: 'Draft' })]));
    api.listVersions.mockResolvedValue([version({ status: 'Draft' })]);
    api.listPayouts.mockResolvedValue([]);
  });

  it('MonthEndPage_RunForEveryone_StartsTheSuggestedStepForTheWholeMonth_AndListsWhoFailedByName', async () => {
    api.runBulkStep.mockResolvedValue(
      run({ total: 2, results: [row(OWNER_ID), row(OTHER_OWNER_ID, { ok: false, code: 'owner_statement_flagged', issues: ['fx_missing'] })] }),
    );
    renderPage();

    const open = await screen.findByTestId('bulk-open');
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    expect(await screen.findByTestId('bulk-step')).toHaveValue('Approve');
    const readings = api.getReadiness.mock.calls.length;
    await start();

    // The step ran for the month on the page, for every owner of it (no list), and the owner that failed is named as the registry names it.
    const failed = await screen.findByTestId('bulk-failed');
    expect(api.runBulkStep).toHaveBeenCalledWith(YEAR, MONTH, { action: 'Approve' });
    expect(within(failed).getByTestId('bulk-result-row')).toHaveTextContent('Luca Bianchi');
    expect(screen.queryByText(text('ownerAccounting.bulk.result.headline.allDone', { count: 2, step: stepLabel('Approve') }))).toBeNull();
    // The month behind the dialog is read again: what the run changed is on the page when the dialog is closed.
    await waitFor(() => expect(api.getReadiness.mock.calls.length).toBeGreaterThan(readings));
  });

  /** Starts the suggested step for the whole month (a queued run, whose first reading is `first`), then leaves the dialog while it goes on. */
  async function startAndLeave(jobId: string, first: { promise: Promise<OwnerBulkRun> }) {
    api.runBulkStep.mockResolvedValue(run({ jobId, status: 'Queued', total: 2, results: [] }));
    api.getBulkRun.mockImplementationOnce(() => first.promise);
    renderPage();

    const open = await screen.findByTestId('bulk-open');
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    await start();
    await screen.findByTestId('bulk-progress');
    const close = screen.getByTestId('bulk-close');
    await waitFor(() => expect(close).toBeEnabled());
    fireEvent.click(close);

    expect(toast.warning).toHaveBeenCalledWith(text('ownerAccounting.bulk.leftRunning'));
    await waitFor(() => expect(screen.queryByTestId('bulk-dialog')).toBeNull());
  }

  // Data: a run the person left while it went on is not lost. The month on the page is read again when it ends, nobody has to reload, and who failed is still to be seen.
  it('MonthEndPage_ARunLeftWhileItGoesOn_IsFollowedToItsEnd_TheMonthIsReadAgain_AndWhoFailedIsStillToBeSeen', async () => {
    const first = deferred<OwnerBulkRun>();
    await startAndLeave('job-9', first);
    const readings = api.getReadiness.mock.calls.length;

    // The run ends while nobody looks at the dialog: the month is read again, and the person is told how it went, with the way back to the result.
    first.resolve(run({ jobId: 'job-9', status: 'Completed', total: 2, results: [row(OWNER_ID), row(OTHER_OWNER_ID, { ok: false, code: 'owner_statement_flagged', issues: ['fx_missing'] })] }));
    await waitFor(() => expect(api.getReadiness.mock.calls.length).toBeGreaterThan(readings));
    const told = text('ownerAccounting.bulk.result.headline.someNotDone', { count: 1, total: 2, step: stepLabel('Approve') });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(told, expect.objectContaining({ action: expect.objectContaining({ label: text('ownerAccounting.bulk.reopen') }) })));
    expect(toast.success).not.toHaveBeenCalled();

    // Coming back, the person finds the result owner by owner, and no question that would start a second run.
    const open = screen.getByTestId('bulk-open');
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const failed = await screen.findByTestId('bulk-failed');
    expect(within(failed).getByTestId('bulk-result-row')).toHaveTextContent('Luca Bianchi');
    expect(screen.queryByTestId('bulk-start')).toBeNull();
    expect(api.runBulkStep).toHaveBeenCalledTimes(1);
  });

  it('MonthEndPage_ARunLeftWhileItGoesOn_ThatTheServerHasForgotten_ReadsTheMonthAgainAndSaysSo_NeverDone', async () => {
    const first = deferred<OwnerBulkRun>();
    await startAndLeave('job-10', first);
    const readings = api.getReadiness.mock.calls.length;

    // The list of the month is where the person is sent to look: it is read again, and what is told is that the run cannot be found, not that it is done.
    first.reject(problem(404, 'owner_bulk_job_not_found'));
    await waitFor(() => expect(api.getReadiness.mock.calls.length).toBeGreaterThan(readings));
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(text('ownerAccounting.bulk.progress.notFound'), expect.objectContaining({ action: expect.objectContaining({ label: text('ownerAccounting.bulk.reopen') }) })),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
