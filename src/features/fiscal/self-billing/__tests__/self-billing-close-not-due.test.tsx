import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import * as fiscalApi from '@/api/fiscal-documents.api';
import * as api from '@/api/self-billing.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import type { SelfBillingDetail, SelfBillingKept } from '@/types';
import { CLOSE_NOTE_MAX } from '../self-billing-model';
import { SelfBillingPage } from '../self-billing-page';
import { NUMBER, REJECTED_ID, REPLACEMENT_ID, closed, detail, failure, generation, item, kept, original, rejected, rejectedState, replacement } from './self-billing-fixtures';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

vi.mock('@/api/self-billing.api', () => ({
  listSelfBilling: vi.fn(),
  getSelfBilling: vi.fn(),
  createSelfBillingDrafts: vi.fn(),
  issueSelfBilling: vi.fn(),
  discardSelfBilling: vi.fn(),
  startSelfBillingCorrection: vi.fn(),
  closeSelfBillingNotDue: vi.fn(),
}));
vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, getDocumentSdi: vi.fn() };
});
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
const issue = vi.mocked(api.issueSelfBilling);
const discard = vi.mocked(api.discardSelfBilling);
const correct = vi.mocked(api.startSelfBillingCorrection);
const prepare = vi.mocked(api.createSelfBillingDrafts);
const close = vi.mocked(api.closeSelfBillingNotDue);
const sdi = vi.mocked(fiscalApi.getDocumentSdi);

const ORG_ADMIN = 'org.billing.admin';
const PORTAL_CREDIT_NOTE = 'portal_credit_note';
const ACTIONS_OF_A_DETAIL = ['self-billing-issue', 'self-billing-discard', 'self-billing-correct', 'self-billing-close', 'self-billing-pdf', 'self-billing-xml'];
/** What a screen must never show in place of a value it does not have: the word of an empty value, an unresolved placeholder, or the id of an identity provider (`auth0|…`). */
const RAW_VALUE = /\b(null|undefined|NaN)\b|\{\{|\[object|\|/;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SelfBillingPage))));
  return client;
}

async function rowOf(id: string): Promise<HTMLElement> {
  const rows = await screen.findAllByTestId('self-billing-row');
  const row = rows.find((candidate) => candidate.getAttribute('data-id') === id);
  if (!row) throw new Error(`no row for ${id}`);
  return row;
}

async function openClosing(button: HTMLElement) {
  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.close.title') });
  return { dialog, confirm: within(dialog).getByRole('button', { name: i18n.t('selfBilling.close.confirm') }) };
}

async function chooseReason(dialog: HTMLElement, confirm: HTMLElement, code: string = PORTAL_CREDIT_NOTE) {
  fireEvent.click(within(dialog).getByTestId(`self-billing-close-reason-${code}`));
  await waitFor(() => expect(confirm).toBeEnabled());
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.permissions = new Set([ORG_ADMIN]);
  env.flags = {};
  await i18n.changeLanguage('it');
  list.mockResolvedValue([original(), kept()]);
  read.mockResolvedValue(detail(kept()));
  sdi.mockResolvedValue(rejectedState());
});

afterEach(() => cleanup());

describe('«Chiudi come non più dovuta» is offered only to who may, with the flags it needs, and only for a kept replacement (permission rule)', () => {
  it.each([
    ['the flag of the sending to the SDI is off', { flags: { sdiSubmission: false }, permissions: [ORG_ADMIN] }],
    ['the flag of the issuance is off', { flags: { fiscalDocumentIssuance: false }, permissions: [ORG_ADMIN] }],
    ['the predicate of the workspace says the person lacks the permission of the organization administrators', { flags: {}, permissions: [] }],
  ] as const)('SelfBillingClose_When_%s_NothingIsOfferedInTheRowNorInTheDetail_AndNothingIsAsked', async (_name, setup) => {
    env.flags = { ...setup.flags };
    env.permissions = new Set<string>(setup.permissions);
    renderPage();

    const row = await rowOf(REPLACEMENT_ID);
    expect(within(row).getByTestId('self-billing-row-kept')).toHaveTextContent(i18n.t('selfBilling.kept.ledger_gives_no_td17'));
    expect(within(row).getByTestId('self-billing-row-kept')).not.toHaveTextContent(i18n.t('selfBilling.kept.exit'));
    expect(screen.queryByTestId('self-billing-row-close')).toBeNull();
    fireEvent.click(within(row).getByTestId('self-billing-row-open'));
    await screen.findByTestId('self-billing-detail');
    expect(screen.queryByTestId('self-billing-close')).toBeNull();
    expect(screen.getByTestId('self-billing-kept')).toHaveTextContent(i18n.t('selfBilling.kept.ledger_gives_no_td17'));
    expect(screen.getByTestId('self-billing-kept')).not.toHaveTextContent(i18n.t('selfBilling.kept.exit'));

    expect(close).not.toHaveBeenCalled();
  });

  it('SelfBillingClose_ForWhoMayWithTheFlagsOn_IsOnlyOnAKeptReplacement_AndTheCallGoesOutOnceForThatDraftAfterTheReasonAndTheConfirmation', async () => {
    const supported = replacement({ id: 'c0000000-0000-4000-8000-000000000003', number: 'AF-2026/2' });
    const delivered = item({ id: 'e0000000-0000-4000-8000-000000000004', status: 'Issued', number: 'AF-2026/3', issueDate: '2026-11-10', sdiStatus: 'delivered' });
    const alreadyClosed = closed({ id: 'f0000000-0000-4000-8000-000000000005', number: 'AF-2026/4' });
    list.mockResolvedValue([original(), kept(), supported, item(), delivered, rejected({ id: 'a1000000-0000-4000-8000-000000000006', number: 'AF-2026/5' }), alreadyClosed]);
    close.mockImplementation(async () => {
      list.mockResolvedValue([original(), closed(), supported, item(), delivered, alreadyClosed]);
      return detail(closed());
    });
    renderPage();

    const row = await rowOf(REPLACEMENT_ID);
    expect(screen.getAllByTestId('self-billing-row-close')).toHaveLength(1);
    expect(within(row).getByTestId('self-billing-row-close')).toBeEnabled();
    expect(within(row).getByTestId('self-billing-row-kept')).toHaveTextContent(i18n.t('selfBilling.kept.ledger_gives_no_td17'));
    expect(within(row).getByTestId('self-billing-row-kept')).toHaveTextContent(i18n.t('selfBilling.kept.exit'));
    expect(close).not.toHaveBeenCalled();

    const { dialog, confirm } = await openClosing(within(row).getByTestId('self-billing-row-close'));
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(close).not.toHaveBeenCalled();
    await chooseReason(dialog, confirm, 'duplicate_or_error');
    fireEvent.change(within(dialog).getByTestId('self-billing-close-note'), { target: { value: '  Doppione della bozza di ottobre  ' } });
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(confirm);

    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(close).toHaveBeenCalledWith(REPLACEMENT_ID, { reason: 'duplicate_or_error', note: 'Doppione della bozza di ottobre' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith(i18n.t('selfBilling.close.done', { number: NUMBER }));
    await waitFor(() => expect(within(screen.getByTestId('self-billing-list')).queryAllByTestId('self-billing-row-close')).toHaveLength(0));
    expect(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-closed')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    for (const call of [issue, discard, correct]) expect(call).not.toHaveBeenCalled();
  });

  it('SelfBillingClose_TheDetailOfAKeptDraft_OffersItAndTheDetailOfADraftTheMonthStillSupports_NeverDoes', async () => {
    renderPage();
    fireEvent.click(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-open'));
    expect(await screen.findByTestId('self-billing-close')).toBeEnabled();
    expect(screen.queryByTestId('self-billing-issue')).toBeNull();
    expect(screen.queryByTestId('self-billing-discard')).toBeNull();
    expect(screen.getByTestId('self-billing-kept')).toHaveTextContent(i18n.t('selfBilling.kept.exit'));
    cleanup();

    list.mockResolvedValue([original(), replacement()]);
    read.mockResolvedValue(detail(replacement()));
    renderPage();
    fireEvent.click(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-open'));
    expect(await screen.findByTestId('self-billing-issue')).toBeEnabled();
    expect(screen.queryByTestId('self-billing-close')).toBeNull();
  });
});

describe('the dialog says what the closing does and asks for the reason and the note', () => {
  it('SelfBillingClose_TheDialog_SaysTheNumberStaysReservedAndGoesInTheRegisterAndCannotBeUndone_AndTheNoteHasItsCounter', async () => {
    renderPage();
    const { dialog } = await openClosing(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-close'));

    const consequences = within(dialog).getByTestId('confirmation-consequences');
    expect(consequences.querySelectorAll('li')).toHaveLength(3);
    expect(consequences).toHaveTextContent(i18n.t('selfBilling.close.consequenceClosed'));
    expect(consequences).toHaveTextContent(i18n.t('selfBilling.close.consequenceReserved'));
    expect(consequences).toHaveTextContent(i18n.t('selfBilling.close.consequenceRegister'));
    expect(dialog).toHaveTextContent(i18n.t('selfBilling.close.description', { number: NUMBER }));
    expect(dialog).toHaveClass('sm:max-h-[90dvh]', 'sm:overflow-y-auto');
    const reasons = within(dialog).getByTestId('self-billing-close-reasons');
    expect(within(reasons).getAllByRole('radio')).toHaveLength(3);
    for (const radio of within(reasons).getAllByRole('radio')) expect(radio).not.toBeChecked();
    for (const code of ['portal_credit_note', 'holder_no_longer_subject', 'duplicate_or_error']) expect(reasons).toHaveTextContent(i18n.t(`selfBilling.close.reason.${code}`));
    const note = within(dialog).getByTestId('self-billing-close-note');
    expect(note).toHaveAttribute('maxlength', String(CLOSE_NOTE_MAX));
    expect(dialog).toHaveTextContent(`0/${CLOSE_NOTE_MAX}`);
    fireEvent.change(note, { target: { value: 'Nota di prova' } });
    expect(dialog).toHaveTextContent(`13/${CLOSE_NOTE_MAX}`);
  });

  it('SelfBillingClose_WithNoNote_TheCallCarriesTheReasonAloneAndANoteOfSpacesIsNoNote', async () => {
    close.mockResolvedValue(detail(closed()));
    renderPage();

    const { dialog, confirm } = await openClosing(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm, 'holder_no_longer_subject');
    fireEvent.change(within(dialog).getByTestId('self-billing-close-note'), { target: { value: '   ' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(close).toHaveBeenCalledWith(REPLACEMENT_ID, { reason: 'holder_no_longer_subject' });
  });

  it('SelfBillingClose_EnterOnAReason_NeverConfirmsTheClosingThatCannotBeUndone_OnlyTheButtonDoes', async () => {
    close.mockResolvedValue(detail(closed()));
    renderPage();

    const { dialog, confirm } = await openClosing(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    const radio = within(dialog).getByTestId(`self-billing-close-reason-${PORTAL_CREDIT_NOTE}`);

    expect(fireEvent.keyDown(radio, { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(radio, { key: 'ArrowDown' })).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: i18n.t('selfBilling.close.title') })).toBeInTheDocument();
  });

  it('SelfBillingClose_WhileTheCallIsOnItsWay_TheButtonsOfTheCardAreOffAndTheCallIsAskedOnce', async () => {
    let finish: (value: SelfBillingDetail) => void = () => undefined;
    close.mockReturnValue(new Promise<SelfBillingDetail>((resolve) => (finish = resolve)));
    renderPage();

    const row = await rowOf(REPLACEMENT_ID);
    const { dialog, confirm } = await openClosing(within(row).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(row).getByTestId('self-billing-row-close')).toBeDisabled());
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByTestId('self-billing-close-note')).toBeDisabled();
    fireEvent.click(confirm);
    expect(close).toHaveBeenCalledTimes(1);

    list.mockResolvedValue([original(), closed()]);
    finish(detail(closed()));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('a refusal or a failure is told in the dialog, never as success (data rule)', () => {
  it.each([
    ['close_reason_required', 'reasonRequired'],
    ['close_note_too_long', 'noteTooLong'],
  ] as const)('SelfBillingClose_Answer422_%s_IsToldInItsOwnWords_ItIsPutRightInPlaceAndNothingSaysItWasClosed', async (code, kind) => {
    close.mockRejectedValue(failure(422, code));
    renderPage();

    const { dialog, confirm } = await openClosing(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    fireEvent.click(confirm);

    const problem = await within(dialog).findByTestId('self-billing-close-problem');
    expect(problem).toHaveAttribute('data-problem', kind);
    expect(problem).toHaveTextContent(i18n.t(`selfBilling.close.problem.${kind}`, { max: CLOSE_NOTE_MAX }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: i18n.t('selfBilling.close.confirm') })).toBeEnabled();
    fireEvent.change(within(dialog).getByTestId('self-billing-close-note'), { target: { value: 'Più corta' } });
    expect(within(dialog).queryByTestId('self-billing-close-problem')).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('SelfBillingClose_WhatTheServerRefusedIsNotOfferedAgain_TheConfirmationStaysOffEvenWhenTheFormIsTouched_AndTheDialogCanBeLeft', async () => {
    close.mockRejectedValue(failure(422, 'self_billing_already_closed'));
    renderPage();

    const { dialog, confirm } = await openClosing(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    fireEvent.click(confirm);

    const problem = await within(dialog).findByTestId('self-billing-close-problem');
    expect(problem).toHaveAttribute('data-problem', 'alreadyClosed');
    expect(problem).toHaveTextContent(i18n.t('selfBilling.close.problem.alreadyClosed'));
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(within(dialog).getByTestId('self-billing-close-reason-duplicate_or_error'));
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByTestId('self-billing-close-problem')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: i18n.t('shared.cancel') })).toBeEnabled();
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(close).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SelfBillingClose_ACallThatFailsWith500_IsToldWithRiprova_NothingSaysItWasClosed_AndTryingAgainWorks', async () => {
    close.mockRejectedValueOnce(failure(500)).mockResolvedValueOnce(detail(closed()));
    renderPage();

    const { dialog, confirm } = await openClosing(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    fireEvent.click(confirm);

    const problem = await within(dialog).findByTestId('self-billing-close-problem');
    expect(problem).toHaveAttribute('data-problem', 'failed');
    expect(problem).toHaveTextContent(i18n.t('selfBilling.close.problem.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    const retry = within(dialog).getByRole('button', { name: i18n.t('shared.errorState.retry') });
    await waitFor(() => expect(retry).toBeEnabled());
    list.mockResolvedValue([original(), closed()]);
    fireEvent.click(retry);

    await waitFor(() => expect(close).toHaveBeenCalledTimes(2));
    expect(close).toHaveBeenLastCalledWith(REPLACEMENT_ID, { reason: PORTAL_CREDIT_NOTE });
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('the closed draft is history: the reason, the day, the name and the note, and no action (data rule)', () => {
  it('SelfBillingClose_AClosedDraft_ShowsTheReasonTheDayInRomeTheNameAndTheNote_TheNumberReserved_AndNoAction', async () => {
    list.mockResolvedValue([original(), closed({ closedAt: '2026-11-30T23:30:00Z' })]);
    renderPage();

    const row = await rowOf(REPLACEMENT_ID);
    const block = within(row).getByTestId('self-billing-row-closed');
    expect(within(block).getByTestId('self-billing-row-closed-intro')).toHaveTextContent(i18n.t('selfBilling.closed.intro', { number: NUMBER }));
    expect(within(block).getByTestId('self-billing-row-closed-reason')).toHaveTextContent(i18n.t('selfBilling.close.reason.portal_credit_note'));
    expect(within(block).getByTestId('self-billing-row-closed-at')).toHaveTextContent(/\b1 dic 2026/);
    expect(within(block).getByTestId('self-billing-row-closed-by')).toHaveTextContent('Mario Rossi');
    expect(within(block).getByTestId('self-billing-row-closed-note')).toHaveTextContent('Nota di credito del portale n. 55 del 12 novembre');
    expect(within(row).getByTestId('self-billing-status')).toHaveAttribute('data-status', 'ClosedNotDue');
    expect(within(row).getByTestId('self-billing-status')).toHaveTextContent(i18n.t('selfBilling.status.ClosedNotDue'));
    expect(within(row).queryByTestId('self-billing-row-due')).toBeNull();
    expect(within(row).queryByTestId('self-billing-row-replaces')).toBeNull();
    for (const testId of ['self-billing-row-correct', 'self-billing-row-close', 'self-billing-row-kept']) expect(within(row).queryByTestId(testId)).toBeNull();
    expect(within(row).getByTestId('self-billing-row-open')).toHaveTextContent(i18n.t('selfBilling.row.open'));
  });

  it('SelfBillingClose_AClosedDraftWhoseUserIsGone_ShowsNoNameNoIdAndNoPlaceholderOfARawValue_ButStillTheReasonAndTheNumber', async () => {
    list.mockResolvedValue([original(), closed({ closedBy: null, closedNote: null })]);
    read.mockResolvedValue(detail(closed({ closedBy: null, closedNote: null })));
    renderPage();

    const row = await rowOf(REPLACEMENT_ID);
    const block = within(row).getByTestId('self-billing-row-closed');
    expect(within(block).queryByTestId('self-billing-row-closed-by')).toBeNull();
    expect(within(block).queryByText(i18n.t('selfBilling.closed.by'))).toBeNull();
    expect(within(block).queryByTestId('self-billing-row-closed-note')).toBeNull();
    expect(within(block).getByTestId('self-billing-row-closed-reason')).toHaveTextContent(i18n.t('selfBilling.close.reason.portal_credit_note'));
    expect(within(block).getByTestId('self-billing-row-closed-intro')).toHaveTextContent(NUMBER);
    const rowText = row.textContent ?? '';
    expect(rowText).not.toMatch(RAW_VALUE);
    expect(rowText).not.toContain(REPLACEMENT_ID);

    fireEvent.click(within(row).getByTestId('self-billing-row-open'));
    const detailBlock = await screen.findByTestId('self-billing-closed');
    expect(within(detailBlock).queryByTestId('self-billing-closed-by')).toBeNull();
    expect(within(detailBlock).queryByTestId('self-billing-closed-note')).toBeNull();
    expect(detailBlock.textContent ?? '').not.toMatch(RAW_VALUE);
  });

  it('SelfBillingClose_AClosedDraftWithAReasonOfTheFuture_ShowsTheCodeAsItCame_NeverABlank_AndOneWithNoDayShowsNoDay', async () => {
    list.mockResolvedValue([original(), closed({ closedReason: 'a_reason_of_the_future', closedAt: null })]);
    renderPage();

    const block = within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-closed');
    expect(within(block).getByTestId('self-billing-row-closed-reason')).toHaveTextContent('a_reason_of_the_future');
    expect(within(block).queryByTestId('self-billing-row-closed-at')).toBeNull();
  });

  it('SelfBillingClose_TheDetailOfAClosedDraft_IsHistoryWithTheSameFacts_AndOffersNoActionAtAll', async () => {
    list.mockResolvedValue([original(), closed()]);
    read.mockResolvedValue(detail(closed()));
    renderPage();

    fireEvent.click(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-open'));
    const body = await screen.findByTestId('self-billing-detail');
    expect(body).toHaveAttribute('data-status', 'Discarded');
    expect(within(body).getByTestId('self-billing-status')).toHaveAttribute('data-status', 'ClosedNotDue');
    const block = within(body).getByTestId('self-billing-closed');
    expect(within(block).getByTestId('self-billing-closed-reason')).toHaveTextContent(i18n.t('selfBilling.close.reason.portal_credit_note'));
    expect(within(block).getByTestId('self-billing-closed-by')).toHaveTextContent('Mario Rossi');
    expect(within(block).getByTestId('self-billing-closed-note')).toHaveTextContent('Nota di credito del portale n. 55 del 12 novembre');
    for (const testId of ACTIONS_OF_A_DETAIL) expect(screen.queryByTestId(testId)).toBeNull();
  });

  it('SelfBillingClose_TheRejectedOriginalWhoseReplacementWasClosed_SaysSoInItsRowAndItsDetail_NeverThatAnInvoiceReplacesIt', async () => {
    list.mockResolvedValue([original(), closed()]);
    renderPage();

    const history = await rowOf(REJECTED_ID);
    expect(within(history).getByTestId('self-billing-row-corrected')).toHaveTextContent(i18n.t('selfBilling.row.correctedClosed', { number: NUMBER }));
    expect(within(history).getByTestId('self-billing-row-corrected')).not.toHaveTextContent(i18n.t('selfBilling.row.corrected', { number: NUMBER }));
    expect(within(history).queryByTestId('self-billing-row-correct')).toBeNull();
    // Nor is it «Sostituita»: no invoice replaces it, and what stays is the rejection of the SDI.
    const badge = within(history).getByTestId('self-billing-status');
    expect(badge).toHaveAttribute('data-status', 'RejectedClosed');
    expect(badge).toHaveTextContent(i18n.t('selfBilling.status.RejectedClosed'));
    expect(badge).not.toHaveTextContent(i18n.t('selfBilling.status.Replaced'));
    cleanup();

    list.mockResolvedValue([rejected()]);
    read.mockResolvedValue(detail(rejected()));
    const client = renderPage();
    fireEvent.click(within(await rowOf(REJECTED_ID)).getByTestId('self-billing-row-open'));
    await screen.findByTestId('self-billing-detail');
    list.mockResolvedValue([original(), closed()]);
    read.mockImplementation(async (id) => detail(id === REPLACEMENT_ID ? closed() : original()));
    await act(async () => {
      await client.invalidateQueries();
    });

    const replaced = await screen.findByTestId('self-billing-replaced');
    expect(replaced).toHaveAttribute('data-replacement-closed', 'true');
    expect(replaced).toHaveTextContent(i18n.t('selfBilling.detail.replaced.closedTitle'));
    expect(replaced).toHaveTextContent(i18n.t('selfBilling.detail.replaced.closedBody'));
    const detailBadge = within(screen.getByTestId('self-billing-detail')).getByTestId('self-billing-status');
    expect(detailBadge).toHaveAttribute('data-status', 'RejectedClosed');
    expect(detailBadge).toHaveTextContent(i18n.t('selfBilling.status.RejectedClosed'));
    expect(detailBadge).not.toHaveTextContent(i18n.t('selfBilling.status.Replaced'));
    for (const testId of ACTIONS_OF_A_DETAIL) expect(screen.queryByTestId(testId)).toBeNull();
    fireEvent.click(within(replaced).getByTestId('self-billing-replacement-open'));
    expect(await screen.findByTestId('self-billing-closed')).toBeInTheDocument();
    expect(read).toHaveBeenCalledWith(REPLACEMENT_ID);
  });
});

describe('the report of «Prepara le bozze» never contradicts the list below it (data rule)', () => {
  const held = (): SelfBillingKept => ({ documentId: REPLACEMENT_ID, holderKind: 'Agency', holderOwnerId: null, portalName: 'Portale Uno BV', number: NUMBER, reason: 'ledger_gives_no_td17' });

  async function prepareDrafts() {
    await screen.findAllByTestId('self-billing-row');
    const button = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    return screen.findByTestId('self-billing-report');
  }

  it('SelfBillingClose_AKeptDraftOfTheReport_IsNoLongerListedAsKeptOnceTheListSaysItWasClosed_AndTheRestOfTheReportStays', async () => {
    prepare.mockResolvedValue(generation({ updated: 1, kept: [held()] }));
    close.mockImplementation(async () => {
      list.mockResolvedValue([original(), closed()]);
      return detail(closed());
    });
    renderPage();

    // The run kept the draft: the report says so, in the warning way, with what to do about it (the person may close it).
    const report = await prepareDrafts();
    const heldRows = within(within(report).getByTestId('self-billing-report-kept')).getAllByTestId('self-billing-report-kept-row');
    expect(heldRows).toHaveLength(1);
    expect(heldRows[0]).toHaveTextContent(i18n.t('selfBilling.kept.ledger_gives_no_td17'));
    expect(heldRows[0]).toHaveTextContent(i18n.t('selfBilling.kept.exit'));
    expect(report.className).toContain('color-warning');

    const row = await rowOf(REPLACEMENT_ID);
    await waitFor(() => expect(within(row).getByTestId('self-billing-row-close')).toBeEnabled());
    const { dialog, confirm } = await openClosing(within(row).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(screen.getByTestId('self-billing-report')).queryByTestId('self-billing-report-kept')).toBeNull());
    // What the run did stays (the counts), and with nothing held any more it is not the warning one.
    const after = screen.getByTestId('self-billing-report');
    expect(within(after).getByTestId('self-billing-report-counts')).toBeInTheDocument();
    expect(after.className).toContain('color-success');
    expect(after.className).not.toContain('color-warning');
    expect(within(await rowOf(REPLACEMENT_ID)).getByTestId('self-billing-row-closed')).toBeInTheDocument();
  });

  it('SelfBillingClose_AKeptDraftOfTheReport_WhoseClosingWasRefused_IsStillListedAsKept', async () => {
    prepare.mockResolvedValue(generation({ updated: 1, kept: [held()] }));
    close.mockRejectedValue(failure(422, 'self_billing_not_closable'));
    renderPage();

    const report = await prepareDrafts();
    const row = await rowOf(REPLACEMENT_ID);
    await waitFor(() => expect(within(row).getByTestId('self-billing-row-close')).toBeEnabled());
    const { dialog, confirm } = await openClosing(within(row).getByTestId('self-billing-row-close'));
    await chooseReason(dialog, confirm);
    fireEvent.click(confirm);

    await within(dialog).findByTestId('self-billing-close-problem');
    expect(within(report).getByTestId('self-billing-report-kept')).toHaveTextContent(NUMBER);
    expect(screen.getByTestId('self-billing-report').className).toContain('color-warning');
  });

  it('SelfBillingClose_TheReportOfAPersonWhoMayNotClose_SaysWhyTheDraftIsKeptAndDoesNotInviteToTheClosing', async () => {
    env.flags = { sdiSubmission: false };
    prepare.mockResolvedValue(generation({ updated: 1, kept: [held()] }));
    renderPage();

    const report = await prepareDrafts();
    const heldRow = within(within(report).getByTestId('self-billing-report-kept')).getByTestId('self-billing-report-kept-row');
    expect(heldRow).toHaveTextContent(i18n.t('selfBilling.kept.ledger_gives_no_td17'));
    expect(heldRow).not.toHaveTextContent(i18n.t('selfBilling.kept.exit'));
  });
});
