import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import * as fiscalApi from '@/api/fiscal-documents.api';
import * as api from '@/api/self-billing.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import type { SelfBillingDetail } from '@/types';
import { KEPT_REASONS } from '../self-billing-model';
import { SelfBillingPage } from '../self-billing-page';
import { NUMBER, REJECTED_ID, REPLACEMENT_ID, detail, failure, generation, item, original, rejected, rejectedState, replacement } from './self-billing-fixtures';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

vi.mock('@/api/self-billing.api', () => ({
  listSelfBilling: vi.fn(),
  getSelfBilling: vi.fn(),
  createSelfBillingDrafts: vi.fn(),
  issueSelfBilling: vi.fn(),
  discardSelfBilling: vi.fn(),
  startSelfBillingCorrection: vi.fn(),
}));
vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, getDocumentSdi: vi.fn() };
});
// The administrator of the account (the role that opens the page), and a predicate for the permission of the organization's administrator that each test sets: no hasPermission that says yes to everything.
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: [{ contextKey: 'account', roleKey: 'org_admin' }],
    hasPermission: (_contextKey: string, permission: string) => env.permissions.has(permission),
  }),
}));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, sdiSubmission: true, ...env.flags }, isLoading: false }),
}));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const list = vi.mocked(api.listSelfBilling);
const read = vi.mocked(api.getSelfBilling);
const prepare = vi.mocked(api.createSelfBillingDrafts);
const issue = vi.mocked(api.issueSelfBilling);
const discard = vi.mocked(api.discardSelfBilling);
const correct = vi.mocked(api.startSelfBillingCorrection);
const sdi = vi.mocked(fiscalApi.getDocumentSdi);

const ORG_ADMIN = 'org.billing.admin';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SelfBillingPage))));
}

/** The row of a TD17 once the list is on the page. */
async function rowOf(id: string): Promise<HTMLElement> {
  const rows = await screen.findAllByTestId('self-billing-row');
  const row = rows.find((candidate) => candidate.getAttribute('data-id') === id);
  if (!row) throw new Error(`no row for ${id}`);
  return row;
}

/** Opens the confirmation of «Correggi e rimanda» from a button and gives the dialog back, with its confirm button on. */
async function openCorrection(button: HTMLElement) {
  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.correct.title') });
  const confirm = within(dialog).getByRole('button', { name: i18n.t('selfBilling.correct.confirm') });
  await waitFor(() => expect(confirm).toBeEnabled());
  return { dialog, confirm };
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.permissions = new Set([ORG_ADMIN]);
  env.flags = {};
  await i18n.changeLanguage('it');
  list.mockResolvedValue([rejected()]);
  read.mockResolvedValue(detail(rejected()));
  sdi.mockResolvedValue(rejectedState());
});

afterEach(() => cleanup());

describe('«Correggi e rimanda» is offered only to who may, with the flags it needs, and only where the server says it can be done (permission rule)', () => {
  it('SelfBillingCorrection_WithoutTheFlagOfTheSending_OrWithoutThePermission_NothingIsOfferedInTheRowNorInTheDetail_AndNothingIsAsked', async () => {
    // The flag of the sending to the SDI is off: the endpoint answers 404, so nothing of the action is drawn.
    env.flags = { sdiSubmission: false };
    renderPage();
    fireEvent.click(within(await rowOf(REJECTED_ID)).getByTestId('self-billing-row-open'));
    await screen.findByTestId('self-billing-detail');
    expect(screen.queryByTestId('self-billing-row-correct')).toBeNull();
    expect(screen.queryByTestId('self-billing-correct')).toBeNull();
    cleanup();

    // The flag is on, and the predicate of the workspace says that the person lacks the permission of the organization's administrator.
    env.flags = {};
    env.permissions = new Set();
    renderPage();
    fireEvent.click(within(await rowOf(REJECTED_ID)).getByTestId('self-billing-row-open'));
    await screen.findByTestId('self-billing-detail');
    expect(screen.queryByTestId('self-billing-row-correct')).toBeNull();
    expect(screen.queryByTestId('self-billing-correct')).toBeNull();

    expect(correct).not.toHaveBeenCalled();
  });

  it('SelfBillingCorrection_ForWhoMayWithTheFlagsOn_IsOnlyOnARowThatSaysCanCorrect_AndTheCallGoesOutOnceAfterTheConfirmationForThatInvoice', async () => {
    const delivered = item({ id: 'c0000000-0000-4000-8000-000000000003', status: 'Issued', number: 'AF-2026/2', issueDate: '2026-11-10', sdiStatus: 'delivered' });
    // Rejected too, but the server says no (it has an issued credit note): the client does not work it out.
    const creditNoted = rejected({ id: 'e0000000-0000-4000-8000-000000000004', number: 'AF-2026/3', canCorrect: false });
    list.mockResolvedValue([rejected(), delivered, creditNoted, item()]);
    correct.mockResolvedValue(detail(replacement()));
    read.mockImplementation(async (id) => detail(id === REPLACEMENT_ID ? replacement() : rejected()));
    renderPage();

    const row = await rowOf(REJECTED_ID);
    expect(screen.getAllByTestId('self-billing-row-correct')).toHaveLength(1);
    expect(within(row).getByTestId('self-billing-row-correct')).toBeEnabled();
    expect(correct).not.toHaveBeenCalled();

    const { dialog, confirm } = await openCorrection(within(row).getByTestId('self-billing-row-correct'));
    // The confirmation says what will happen, in words, and why the SDI refused it when the page can read that.
    expect(within(dialog).getByTestId('confirmation-consequences').querySelectorAll('li')).toHaveLength(3);
    expect(await within(dialog).findByTestId('self-billing-correct-reason')).toHaveTextContent(rejectedState().reason as string);
    expect(sdi).toHaveBeenCalledWith(REJECTED_ID, 'guest');
    expect(correct).not.toHaveBeenCalled();
    fireEvent.click(confirm);

    await waitFor(() => expect(correct).toHaveBeenCalledTimes(1));
    expect(correct).toHaveBeenCalledWith(REJECTED_ID);
    // The replacement is shown at once, in the detail: it says what it replaces, is issued with the issue of the page, and cannot be discarded.
    expect(await screen.findByTestId('self-billing-replaces')).toHaveTextContent(NUMBER);
    expect(screen.getByTestId('self-billing-issue')).toBeEnabled();
    expect(screen.queryByTestId('self-billing-discard')).toBeNull();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(issue).not.toHaveBeenCalled();
  });

  it('SelfBillingCorrection_FromTheDetailOfTheRejectedInvoice_IsTheSameActionAndTheDetailShowsTheReplacement', async () => {
    correct.mockResolvedValue(detail(replacement()));
    read.mockImplementation(async (id) => detail(id === REPLACEMENT_ID ? replacement() : rejected()));
    renderPage();

    fireEvent.click(within(await rowOf(REJECTED_ID)).getByTestId('self-billing-row-open'));
    const { confirm } = await openCorrection(await screen.findByTestId('self-billing-correct'));
    fireEvent.click(confirm);

    await waitFor(() => expect(correct).toHaveBeenCalledTimes(1));
    expect(correct).toHaveBeenCalledWith(REJECTED_ID);
    expect(await screen.findByTestId('self-billing-replaces')).toHaveTextContent(NUMBER);
    expect(screen.getByTestId('self-billing-detail')).toHaveAttribute('data-status', 'Draft');
  });

  it('SelfBillingCorrection_WhileTheCallIsOnItsWay_TheButtonsOfTheCardAreOffAndTheCallIsAskedOnce', async () => {
    let finish: (value: SelfBillingDetail | null) => void = () => undefined;
    correct.mockReturnValue(new Promise<SelfBillingDetail | null>((resolve) => (finish = resolve)));
    read.mockImplementation(async (id) => detail(id === REPLACEMENT_ID ? replacement() : rejected()));
    renderPage();

    const row = await rowOf(REJECTED_ID);
    const { confirm } = await openCorrection(within(row).getByTestId('self-billing-row-correct'));
    fireEvent.click(confirm);

    await waitFor(() => expect(correct).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(row).getByTestId('self-billing-row-correct')).toBeDisabled());
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(correct).toHaveBeenCalledTimes(1);

    finish(detail(replacement()));
    expect(await screen.findByTestId('self-billing-replaces')).toBeInTheDocument();
    expect(correct).toHaveBeenCalledTimes(1);
  });

  it('SelfBillingCorrection_WhenTheReasonOfTheSdiCannotBeRead_TheDialogLeavesItOutAndStillCorrects', async () => {
    sdi.mockRejectedValue(failure(403));
    correct.mockResolvedValue(detail(replacement()));
    read.mockImplementation(async (id) => detail(id === REPLACEMENT_ID ? replacement() : rejected()));
    renderPage();

    const { dialog, confirm } = await openCorrection(within(await rowOf(REJECTED_ID)).getByTestId('self-billing-row-correct'));
    await waitFor(() => expect(sdi).toHaveBeenCalled());
    expect(within(dialog).queryByTestId('self-billing-correct-reason')).toBeNull();
    fireEvent.click(confirm);

    await waitFor(() => expect(correct).toHaveBeenCalledTimes(1));
  });
});

describe('the original a correction discarded is history, and the draft that replaces it holds its number (data rule: a number is never lost)', () => {
  it('SelfBillingCorrection_TheDiscardedOriginal_IsHistoryWithAReferenceToItsReplacement_AndNoAction', async () => {
    list.mockResolvedValue([original(), replacement()]);
    read.mockResolvedValue(detail(replacement()));
    renderPage();

    const history = await rowOf(REJECTED_ID);
    expect(within(history).getByTestId('self-billing-row-corrected')).toHaveTextContent(NUMBER);
    expect(within(history).getByTestId('self-billing-row-sdi')).toHaveAttribute('data-state', 'rejected');
    expect(within(history).getByTestId('self-billing-status')).toHaveAttribute('data-status', 'Replaced');
    for (const testId of ['self-billing-row-correct', 'self-billing-row-open']) expect(within(history).queryByTestId(testId)).toBeNull();

    // The draft says which invoice it replaces, and the reference of the original leads to it.
    expect(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-replaces')).toHaveTextContent(NUMBER);
    fireEvent.click(within(history).getByTestId('self-billing-row-replacement'));
    expect(await screen.findByTestId('self-billing-detail')).toBeInTheDocument();
    expect(read).toHaveBeenCalledWith(REPLACEMENT_ID);
    expect(screen.getByTestId('self-billing-replaces')).toHaveTextContent(NUMBER);
  });

  it('SelfBillingCorrection_TheDetailOfTheDiscardedOriginal_SaysItWasReplaced_HasNoActionButTheWayToItsReplacement', async () => {
    // The answer of the correction cannot be read, so the detail stays on the invoice, which the server now holds as the original that was replaced (the same happens when another administrator corrected it).
    let corrected = false;
    list.mockImplementation(async () => (corrected ? [original(), replacement()] : [rejected()]));
    read.mockImplementation(async (id) => detail(id === REPLACEMENT_ID ? replacement() : corrected ? original() : rejected()));
    correct.mockImplementation(async () => {
      corrected = true;
      return null;
    });
    renderPage();

    fireEvent.click(within(await rowOf(REJECTED_ID)).getByTestId('self-billing-row-open'));
    const { confirm } = await openCorrection(await screen.findByTestId('self-billing-correct'));
    fireEvent.click(confirm);

    const replaced = await screen.findByTestId('self-billing-replaced');
    expect(toast.warning).toHaveBeenCalledWith(i18n.t('selfBilling.correct.unreadable'));
    expect(replaced).toHaveTextContent(i18n.t('selfBilling.detail.replaced.title'));
    // History, as in its row: «Sostituita», its rejection, and no action but the way to its replacement.
    const body = screen.getByTestId('self-billing-detail');
    expect(body).toHaveAttribute('data-status', 'Discarded');
    expect(within(body).getByTestId('self-billing-status')).toHaveAttribute('data-status', 'Replaced');
    expect(within(body).getByTestId('self-billing-detail-sdi')).toHaveAttribute('data-state', 'rejected');
    for (const testId of ['self-billing-issue', 'self-billing-discard', 'self-billing-correct', 'self-billing-pdf', 'self-billing-xml']) expect(screen.queryByTestId(testId)).toBeNull();

    fireEvent.click(within(replaced).getByTestId('self-billing-replacement-open'));
    expect(await screen.findByTestId('self-billing-replaces')).toHaveTextContent(NUMBER);
    expect(read).toHaveBeenCalledWith(REPLACEMENT_ID);
    expect(screen.getByTestId('self-billing-detail')).toHaveAttribute('data-status', 'Draft');
    expect(screen.queryByTestId('self-billing-replaced')).toBeNull();
  });

  it('SelfBillingCorrection_TheReplacementDraft_IsIssuedWithTheIssueOfThePageAndNeverOfferedForTheDiscard', async () => {
    list.mockResolvedValue([original(), replacement()]);
    read.mockResolvedValue(detail(replacement()));
    issue.mockResolvedValue(detail(replacement({ status: 'Issued', issueDate: '2026-11-12', sdiStatus: 'to_send' })));
    renderPage();

    fireEvent.click(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-open'));
    expect(await screen.findByTestId('self-billing-issue')).toBeEnabled();
    expect(screen.queryByTestId('self-billing-discard')).toBeNull();

    fireEvent.click(screen.getByTestId('self-billing-issue'));
    const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.detail.issue.title') });
    const confirm = within(dialog).getByRole('button', { name: i18n.t('selfBilling.detail.issue.confirm') });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    expect(issue).toHaveBeenCalledWith(REPLACEMENT_ID, { acceptEstimate: false });
    expect(discard).not.toHaveBeenCalled();
  });

  it('SelfBillingCorrection_AnOrdinaryDraft_StillHasItsDiscard', async () => {
    list.mockResolvedValue([item()]);
    read.mockResolvedValue(detail(item()));
    renderPage();

    fireEvent.click(await screen.findByTestId('self-billing-row-open'));
    expect(await screen.findByTestId('self-billing-issue')).toBeEnabled();
    expect(screen.getByTestId('self-billing-discard')).toBeEnabled();
    expect(screen.queryByTestId('self-billing-replaces')).toBeNull();
    expect(screen.queryByTestId('self-billing-kept')).toBeNull();
  });
});

describe('a kept draft says why, in words, for each of the four reasons (and is never offered for the issue or the discard)', () => {
  it.each(KEPT_REASONS)('SelfBillingCorrection_AKeptDraft_%s_SaysWhyInItsRowAndInItsDetail_AndOffersNeitherIssueNorDiscard', async (code) => {
    const kept = replacement({ keptReason: code });
    list.mockResolvedValue([original(), kept]);
    read.mockResolvedValue(detail(kept));
    renderPage();

    const row = await rowOf(REPLACEMENT_ID);
    const sentence = i18n.t(`selfBilling.kept.${code}`);
    expect(within(row).getByTestId('self-billing-row-kept')).toHaveTextContent(sentence);
    // It cannot be issued: the row opens it («Apri»), it does not invite to review and issue.
    expect(within(row).getByTestId('self-billing-row-open')).toHaveTextContent(i18n.t('selfBilling.row.open'));

    fireEvent.click(within(row).getByTestId('self-billing-row-open'));
    expect(await screen.findByTestId('self-billing-kept')).toHaveTextContent(sentence);
    expect(screen.queryByTestId('self-billing-issue')).toBeNull();
    expect(screen.queryByTestId('self-billing-discard')).toBeNull();
    expect(issue).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });

  it('SelfBillingCorrection_AKeptDraftWithAReasonOfTheFuture_ShowsTheCodeAsItCame_NeverABlank', async () => {
    list.mockResolvedValue([replacement({ keptReason: 'a_reason_of_the_future' })]);
    renderPage();

    expect(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-kept')).toHaveTextContent('a_reason_of_the_future');
  });

  it('SelfBillingCorrection_TheDraftsOfAMonth_TellWhichNumbersAreHeldAndWhy_NeverNothingToDo', async () => {
    prepare.mockResolvedValue(
      generation({
        kept: [
          { documentId: REPLACEMENT_ID, holderKind: 'Agency', holderOwnerId: null, portalName: 'Portale Uno BV', number: NUMBER, reason: 'ledger_gives_no_td17' },
          { documentId: 'f0000000-0000-4000-8000-000000000005', holderKind: 'Owner', holderOwnerId: 'o1', portalName: 'Portale Due Ltd', number: 'AF-2026/2', reason: 'a_reason_of_the_future' },
        ],
      }),
    );
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    const button = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const report = await screen.findByTestId('self-billing-report');
    const rows = within(within(report).getByTestId('self-billing-report-kept')).getAllByTestId('self-billing-report-kept-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(NUMBER);
    expect(rows[0]).toHaveTextContent('Portale Uno BV');
    expect(rows[0]).toHaveTextContent(i18n.t('selfBilling.kept.ledger_gives_no_td17'));
    expect(rows[1]).toHaveTextContent('AF-2026/2');
    expect(rows[1]).toHaveTextContent('a_reason_of_the_future');
    // A month with a held number is not told as «all done»: the report is the warning one.
    expect(report.className).toContain('color-warning');
    expect(report.className).not.toContain('color-success');
  });

  it('SelfBillingCorrection_TheDraftsOfAMonthWithNothingKept_HaveNoBlockForIt', async () => {
    prepare.mockResolvedValue(generation({ created: 1 }));
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    const button = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const report = await screen.findByTestId('self-billing-report');
    expect(within(report).queryByTestId('self-billing-report-kept')).toBeNull();
    expect(report.className).toContain('color-success');
  });
});

describe('a draft refused as outdated (409) is told as «rifai le bozze del mese», with the action that makes them', () => {
  it('SelfBillingCorrection_ADraftRefusedAsOutdated_OffersToMakeTheDraftsOfItsMonthAgain_AndNotToIssueAgainBeforeThat', async () => {
    const draft = replacement();
    list.mockResolvedValue([original(), draft]);
    read.mockResolvedValue(detail(draft));
    issue.mockRejectedValue(failure(409, 'document_draft_outdated'));
    prepare.mockResolvedValue(generation({ updated: 1 }));
    renderPage();

    fireEvent.click(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-open'));
    fireEvent.click(await screen.findByTestId('self-billing-issue'));
    const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.detail.issue.title') });
    const confirm = within(dialog).getByRole('button', { name: i18n.t('selfBilling.detail.issue.confirm') });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    // Told with its own words (not the sentence of the guest documents), and the issue is not offered again: it would be refused in the same way.
    expect(await within(dialog).findByTestId('self-billing-issue-problem')).toHaveTextContent(i18n.t('selfBilling.detail.issue.outdated'));
    expect(within(dialog).getByRole('button', { name: i18n.t('selfBilling.detail.issue.confirm') })).toBeDisabled();
    expect(prepare).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByTestId('self-billing-redo-drafts'));
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    // The drafts of the month of THAT draft, whatever the month the page was on, and the person lands on the report.
    expect(prepare).toHaveBeenCalledWith('2026-10');
    expect(await screen.findByTestId('self-billing-report')).toBeInTheDocument();
    expect(screen.getByTestId('self-billing-period')).toHaveValue('2026-10');
    expect(issue).toHaveBeenCalledTimes(1);
  });
});
