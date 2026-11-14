import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { OwnerInvoicePanel } from '@/features/owner-accounting/components/owner-invoice-panel';
import { OWNER_ID, VERSION_ID, version } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import type { OwnerInvoice, OwnerInvoiceListItem } from '@/types';
import { INVOICE_ID, draft, issuedItem, listItem } from './owner-invoice-fixtures';

const api = vi.hoisted(() => ({ list: vi.fn(), createDraft: vi.fn(), issue: vi.fn(), downloadPdf: vi.fn() }));
vi.mock('@/api/owner-invoices.api', () => ({ ownerInvoicesApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const session = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }], ownerInvoicing: true }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: session.contexts }) }));
vi.mock('@/hooks/use-feature-flags', async () => {
  const { DEFAULT_FEATURE_FLAGS: defaults } = await import('@/config/feature-flags');
  return { useFeatureFlags: () => ({ flags: { ...defaults, ownerInvoicing: session.ownerInvoicing }, isLoading: false }) };
});

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
/** Intl writes a no-break space between a figure and its currency: the page text is compared with plain spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));
/** What the server answers to a refusal: the status and the problem with its code. */
const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });
/** A promise settled from outside: the request that is on its way. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPanel(status: 'Approved' | 'Superseded' = 'Approved') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(OwnerInvoicePanel, { version: version({ status }) }))));
}

/** The invoices the server holds: the writes of the test change them, and the list answers with what is there. */
let held: OwnerInvoiceListItem[] = [];

beforeEach(async () => {
  vi.resetAllMocks();
  session.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  session.ownerInvoicing = true;
  held = [];
  await i18n.changeLanguage('it');
  api.list.mockImplementation(async () => held);
  api.createDraft.mockImplementation(async () => {
    held = [listItem({ taxableBase: 1150, vatAmount: 89.1, total: 1239.1 })];
    return draft();
  });
  api.issue.mockImplementation(async () => {
    held = [issuedItem({ taxableBase: 1150, vatAmount: 89.1, total: 1239.1 })];
    return draft({ status: 'Issued', number: 'FPM-2025-0001', issueDate: '2025-02-05' }) satisfies OwnerInvoice;
  });
});

afterEach(() => cleanup());

describe('the invoice of the property manager in the statement: who may write it, and when it exists (E13/F02/US01/T03)', () => {
  it('OwnerInvoicePanel_FlagOff_IsNotDrawn_AndNothingAsksTheServer', () => {
    session.ownerInvoicing = false;
    renderPanel();

    // With `ownerInvoicing` off nothing changes: no panel and no read (a query that was enabled has called the server by the time `render` returns).
    expect(screen.queryByTestId('owner-invoice-panel')).toBeNull();
    for (const call of Object.values(api)) expect(call).not.toHaveBeenCalled();
    // The flag is off until the server says it is on.
    expect(DEFAULT_FEATURE_FLAGS.ownerInvoicing).toBe(false);
  });

  it('OwnerInvoicePanel_WithoutAgencyStatementManage_ShowsTheState_ButOffersNoWrite', async () => {
    // The owner and the administrators hold `agency.statement.manage`; a property manager, a collaborator or an accountant do not.
    session.contexts = [{ contextKey: 'account', roleKey: 'org_manager' }];
    renderPanel();

    expect(await screen.findByTestId('owner-invoice-none')).toHaveTextContent(text('ownerInvoice.panel.readOnly'));
    expect(screen.queryByTestId('owner-invoice-create')).toBeNull();
    expect(api.list).toHaveBeenCalledWith({ period: '2025-01', ownerId: OWNER_ID });

    cleanup();
    held = [listItem()];
    renderPanel();
    expect(await screen.findByTestId('owner-invoice-draft')).toBeInTheDocument();
    // A draft is shown with its total, and neither reviewed nor issued by who may not.
    for (const id of ['owner-invoice-review', 'owner-invoice-issue', 'owner-invoice-create']) expect(screen.queryByTestId(id)).toBeNull();
    for (const write of [api.createDraft, api.issue]) expect(write).not.toHaveBeenCalled();
  });

  it('OwnerInvoicePanel_ASupersededVersion_OffersNoWrite_EvenToAnAdministrator', async () => {
    renderPanel('Superseded');

    expect(await screen.findByTestId('owner-invoice-none')).toHaveTextContent(text('ownerInvoice.panel.superseded'));
    expect(screen.queryByTestId('owner-invoice-create')).toBeNull();
    expect(api.createDraft).not.toHaveBeenCalled();
  });

  it('OwnerInvoicePanel_TheAdministratorMakesReviewsAndIssuesTheInvoice_AndEveryButtonWaitsForTheWriteOnItsWay', async () => {
    const pending = deferred<OwnerInvoice>();
    api.createDraft.mockImplementationOnce(() => pending.promise);
    renderPanel();

    const create = await screen.findByTestId('owner-invoice-create');
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);
    await waitFor(() => expect(api.createDraft).toHaveBeenCalledWith(VERSION_ID));
    // While the draft is made the button says it works and a second click changes nothing.
    expect(create).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(create);
    expect(api.createDraft).toHaveBeenCalledTimes(1);

    held = [listItem({ taxableBase: 1150, vatAmount: 89.1, total: 1239.1 })];
    pending.resolve(draft());
    // The draft with its lines: the commission, the recharge and the expense advanced, the VAT by rate, the totals in francs.
    const lines = await screen.findByTestId('owner-invoice-lines');
    expect(within(lines).getAllByTestId('owner-invoice-line').map((row) => row.getAttribute('data-type'))).toEqual(['Commission', 'Recharge', 'AdvancedExpense']);
    const rates = within(lines).getByTestId('owner-invoice-vat-rates');
    expect(plain(rates.textContent ?? '')).toContain(money(1100, 'CHF'));
    expect(plain(rates.textContent ?? '')).toContain(money(89.1, 'CHF'));
    expect(plain(within(lines).getByTestId('owner-invoice-total').textContent ?? '')).toBe(money(1239.1, 'CHF'));

    // The confirmation shows the series and the total, and says the number is given at the issue.
    const issue = await screen.findByTestId('owner-invoice-issue');
    await waitFor(() => expect(issue).toBeEnabled());
    fireEvent.click(issue);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('owner-invoice-issue-series')).toHaveTextContent('FPM');
    expect(plain(within(dialog).getByTestId('owner-invoice-issue-total').textContent ?? '')).toBe(money(1239.1, 'CHF'));
    expect(within(dialog).getByText(text('ownerInvoice.issue.numberNext'))).toBeInTheDocument();
    expect(api.issue).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerInvoice.issue.confirm') }));
    await waitFor(() => expect(api.issue).toHaveBeenCalledTimes(1));
    expect(api.issue).toHaveBeenCalledWith(INVOICE_ID);

    // Issued: its number and day, the PDF, and that the statement covers it.
    const issued = await screen.findByTestId('owner-invoice-issued');
    expect(within(issued).getByTestId('owner-invoice-number')).toHaveTextContent('FPM-2025-0001');
    expect(within(issued).getByTestId('owner-invoice-payment')).toHaveTextContent(text('ownerInvoice.settlement.offset'));
    expect(within(issued).getByTestId('owner-invoice-pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-invoice-issue')).toBeNull();
  });

  it('OwnerInvoicePanel_ADraftThatIsNotWhatWouldBeIssuedNow_IsToldAndMustBeReviewedAgainBeforeIssuing', async () => {
    held = [listItem({ taxableBase: 1150, vatAmount: 89.1, total: 1239.1 })];
    api.issue.mockRejectedValue(problem(409, 'document_draft_outdated'));
    renderPanel();

    // A page opened later has the totals only: reviewing makes the draft again from the version and the mandate of now.
    fireEvent.click(await screen.findByTestId('owner-invoice-review'));
    await screen.findByTestId('owner-invoice-lines');
    fireEvent.click(await screen.findByTestId('owner-invoice-issue'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerInvoice.issue.confirm') }));

    await waitFor(() => expect(api.issue).toHaveBeenCalledTimes(1));
    // Nothing was issued: the reason is said, the dialog is closed, and the issue is not offered again before the draft is reviewed again.
    expect(await screen.findByTestId('owner-invoice-notice')).toHaveTextContent(text('apiErrors.codes.documentDraftOutdated'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByTestId('owner-invoice-issue')).toBeNull();
    expect(screen.queryByTestId('owner-invoice-issued')).toBeNull();
  });

  it('OwnerInvoicePanel_TheModuleBeingOffAtTheServer_LeavesNoPanel_WhateverTheCacheHolds', async () => {
    api.list.mockRejectedValue(problem(404, 'not_found'));
    renderPanel();

    await waitFor(() => expect(api.list).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('owner-invoice-panel')).toBeNull());
  });
});
