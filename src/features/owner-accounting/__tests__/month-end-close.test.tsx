import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { todayInRome } from '@/lib/stay-dates';
import type { OwnerExternalDocument } from '@/types';
import { MonthEndClosePage } from '../month-end-close-page';
import { StatementDetailPage } from '../statement-detail-page';
import { TaxFilingPanel } from '../components/tax-filing-panel';
import { forgetPayoutKeys } from '../owner-accounting-model';
import {
  BOOKING_ID,
  MONTH,
  OLD_VERSION_ID,
  OTHER_OWNER_ID,
  OWNER_ID,
  VERSION_ID,
  YEAR,
  dataset,
  entry,
  f24,
  ownerReadiness,
  payout,
  policy,
  profile,
  readiness,
  version,
} from './owner-accounting-fixtures';

const api = vi.hoisted(() => ({
  listOwners: vi.fn(),
  getOnboardingReadiness: vi.fn(),
  getReadiness: vi.fn(),
  postPeriod: vi.fn(),
  listVersions: vi.fn(),
  generateVersion: vi.fn(),
  getVersion: vi.fn(),
  approveVersion: vi.fn(),
  publishVersion: vi.fn(),
  downloadPublishedFile: vi.fn(),
  closeMonth: vi.fn(),
  postCorrection: vi.fn(),
  listExternalDocuments: vi.fn(),
  verifyExternalDocument: vi.fn(),
  listPayouts: vi.fn(),
  getPayout: vi.fn(),
  confirmPayout: vi.fn(),
  listFiscalProfiles: vi.fn(),
  getFiscalReadiness: vi.fn(),
  listPolicies: vi.fn(),
  getTaxReconciliation: vi.fn(),
  getF24: vi.fn(),
  generateF24: vi.fn(),
  setF24FilingState: vi.fn(),
  getAnnualDataset: vi.fn(),
  generateAnnualDataset: vi.fn(),
  setDatasetFilingState: vi.fn(),
  downloadF24Pdf: vi.fn(),
}));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Casa Mare' }] }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, secondary }: { title: string; secondary?: { label?: string; onClick?: () => void; testId?: string }[] }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      ...(secondary ?? []).flatMap((item, index) =>
        item.label ? [createElement('button', { key: index, type: 'button', onClick: item.onClick, 'data-testid': item.testId }, item.label)] : [],
      ),
    ),
}));

// Whole pages with dialogs are rendered here: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

function renderPage(path: string, routePath: string, element: ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })) {
  return render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [path] }, createElement(Routes, null, createElement(Route, { path: routePath, element })))),
  );
}

/** What the server answers to a refusal: the status and the problem with its code (and what it adds). */
const problem = (status: number, code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code, ...extra } } });
/** What axios throws when there is no answer at all. */
const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });
/** A promise settled from outside: the request that is on its way. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const READINESS = { ready: true, profileId: 'a1000000-0000-4000-8000-000000000001', policyId: 'b1000000-0000-4000-8000-000000000001', ruleCode: 'IT-RULE', ruleVersion: '2025.1', jurisdiction: 'IT' };
const LINK_ID = 'ee000000-0000-4000-8000-000000000001';
const link = (overrides: Partial<OwnerExternalDocument> = {}): OwnerExternalDocument => ({
  id: LINK_ID,
  statementVersionId: VERSION_ID,
  ownerId: OWNER_ID,
  provider: 'Gestionale',
  externalId: 'X-1',
  externalNumber: '12',
  externalDate: '2025-02-10',
  documentUrl: null,
  documentSha256: null,
  status: 'Entered',
  verifiedAt: null,
  verifiedByUserId: null,
  removedAt: null,
  removedByUserId: null,
  removalReason: null,
  createdAt: '2025-02-10T09:00:00Z',
  createdByUserId: null,
  ...overrides,
});

const renderStatement = () => renderPage(`/app/account/owner-close/versions/${VERSION_ID}`, '/app/account/owner-close/versions/:versionId', createElement(StatementDetailPage));
const renderMonth = () => renderPage(`/app/account/owner-close?period=${YEAR}-01`, '/app/account/owner-close', createElement(MonthEndClosePage));
const renderTax = () => renderPage('/tax', '/tax', createElement(TaxFilingPanel, { period: { year: YEAR, month: MONTH } }));

const previous = () => version({ id: OLD_VERSION_ID, version: 1, status: 'Superseded', closingBalance: 700, revenue: 900, cutoffAt: '2025-01-20T08:00:00Z', supersedesVersionId: null, supersededByVersionId: VERSION_ID });

beforeEach(async () => {
  vi.resetAllMocks();
  forgetPayoutKeys();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  await i18n.changeLanguage('it');
  api.getFiscalReadiness.mockResolvedValue(READINESS);
  api.listOwners.mockResolvedValue([
    { id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' },
    { id: OTHER_OWNER_ID, firstName: 'Luca', lastName: 'Bianchi' },
  ]);
  api.getOnboardingReadiness.mockResolvedValue(null);
  api.getReadiness.mockResolvedValue(readiness([ownerReadiness()]));
  api.listVersions.mockResolvedValue([version(), previous()]);
  api.getVersion.mockResolvedValue({ version: version(), entries: [entry()] });
  api.listExternalDocuments.mockResolvedValue([]);
  api.listPayouts.mockResolvedValue([]);
  api.getPayout.mockResolvedValue(payout());
  api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
  api.listPolicies.mockResolvedValue([policy()]);
});

afterEach(() => cleanup());

describe('the month-end close (E06/F05/US02/T04)', () => {
  it('MonthEndClose_PublishedStatementCannotBeEdited_Test', async () => {
    renderStatement();
    expect(await screen.findByTestId('statement-focus')).toBeInTheDocument();
    await screen.findByTestId('statement-file');

    // A published statement has no way to be changed in place: nothing to approve, publish or edit, only its file, and the next steps of the month.
    expect(screen.queryByRole('button', { name: new RegExp(`^(${text('ownerAccounting.actions.approve.label')}|${text('ownerAccounting.actions.publish.label')}|modifica)$`, 'i') })).toBeNull();
    expect(screen.queryByTestId('statement-menu-approve')).toBeNull();
    expect(screen.queryByTestId('statement-menu-publish')).toBeNull();
    expect(screen.queryByTestId('statement-menu-regenerate')).toBeNull();
    expect(screen.getByTestId('statement-file-download')).toBeInTheDocument();
    expect(screen.getByTestId('statement-focus')).toHaveAttribute('data-tone', 'success');
    // Opening the page changed nothing.
    for (const call of [api.approveVersion, api.publishVersion, api.generateVersion, api.closeMonth, api.confirmPayout]) expect(call).not.toHaveBeenCalled();

    cleanup();
    // The ledger changed after the version: the only change on offer is a NEW version, which supersedes the published one, after a confirmation.
    api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ isDirty: true, issues: [{ code: 'period_dirty', ownerId: OWNER_ID, propertyId: null, sourceId: null, blocking: true }], ready: false })]));
    api.generateVersion.mockResolvedValue(version({ id: 'new-version', version: 3, status: 'Draft', supersedesVersionId: VERSION_ID }));
    renderStatement();
    const regenerate = await screen.findByTestId('statement-primary');
    expect(regenerate).toHaveTextContent(text('ownerAccounting.actions.regenerate.label'));
    expect(screen.queryByTestId('statement-menu-approve')).toBeNull();

    fireEvent.click(regenerate);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(text('ownerAccounting.step.regenerate.consequence1', { version: 2 }))).toBeInTheDocument();
    expect(api.generateVersion).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.step.regenerate.confirm') }));

    await waitFor(() => expect(api.generateVersion).toHaveBeenCalledWith(YEAR, MONTH, OWNER_ID));
    // The published version was never approved, published or closed again: it stays as it was.
    for (const call of [api.approveVersion, api.publishVersion, api.closeMonth]) expect(call).not.toHaveBeenCalled();
  });

  it('TaxExport_WithoutReceiptNeverShowsSubmitted_Test', async () => {
    api.getTaxReconciliation.mockResolvedValue({
      year: YEAR,
      obligationsTotal: 120,
      f24Total: 120,
      annualTotal: 120,
      months: [{ month: MONTH, obligations: 120, f24: 120, filingState: 'Generated' }],
      reconciled: true,
    });
    // The F24 was even paid, and the annual data generated: neither was filed, and neither is called so.
    api.getF24.mockResolvedValue(f24({ paidAt: '2025-02-10T09:00:00Z' }));
    api.getAnnualDataset.mockResolvedValue(dataset());
    const view = renderTax();

    await waitFor(() => expect(screen.getAllByTestId('filing-status')).toHaveLength(2));
    for (const status of screen.getAllByTestId('filing-status')) expect(status).toHaveAttribute('data-label', 'generated');
    expect(screen.queryByText(/inviat[oa]/i)).toBeNull();
    expect(screen.queryByText(/accettat[oa]/i)).toBeNull();
    // The only step that can follow a generated file is its review.
    expect(screen.getAllByTestId('filing-step-Reviewed')).toHaveLength(2);
    expect(screen.queryByTestId('filing-step-Submitted')).toBeNull();
    expect(api.setF24FilingState).not.toHaveBeenCalled();
    expect(api.generateF24).not.toHaveBeenCalled();

    view.unmount();
    // A state the server sent without its proof (no handoff, no receipt) is never called by the word.
    api.getF24.mockResolvedValue(f24({ filingState: 'Submitted' }));
    api.getAnnualDataset.mockResolvedValue(dataset({ filingState: 'Accepted', handoffReference: 'Commercialista' }));
    renderTax();
    await waitFor(() => expect(screen.getAllByTestId('filing-status')).toHaveLength(2));
    const labels = screen.getAllByTestId('filing-status').map((status) => status.getAttribute('data-label'));
    expect(labels).toEqual(['submittedWithoutProof', 'acceptedWithoutProof']);
    expect(screen.queryByText(text('ownerAccounting.filing.label.submitted'))).toBeNull();
    expect(screen.queryByText(text('ownerAccounting.filing.label.accepted'))).toBeNull();
    expect(screen.getAllByTestId('filing-missing-proof')).toHaveLength(2);

    cleanup();
    // With the proof the word is allowed, and the evidence is shown.
    api.getF24.mockResolvedValue(f24({ filingState: 'Submitted', handoffReference: 'Commercialista, 16/02' }));
    api.getAnnualDataset.mockResolvedValue(dataset({ filingState: 'Accepted', handoffReference: 'Commercialista', receiptReference: 'RIC-77' }));
    renderTax();
    await waitFor(() => expect(screen.getAllByTestId('filing-status')).toHaveLength(2));
    expect(screen.getAllByTestId('filing-status').map((status) => status.getAttribute('data-label'))).toEqual(['submitted', 'accepted']);
    expect(screen.getByText(text('ownerAccounting.filing.handoff', { reference: 'Commercialista, 16/02' }))).toBeInTheDocument();
    expect(screen.getByText(text('ownerAccounting.filing.receipt', { reference: 'RIC-77' }))).toBeInTheDocument();
  });

  it('OwnerStatementDetail_DoesNotRenderGuestPii_Test', async () => {
    // Even if a payload carried the guest (it must not), the page shows only ids, codes and amounts: nothing of the guest reaches the screen.
    const pii = { guestName: 'Giulia Verdi', guestEmail: 'giulia.verdi@example.com', guestPhone: '+39 333 1234567', guestDocumentNumber: 'AX1234567' };
    api.getVersion.mockResolvedValue({
      version: { ...version(), ...pii },
      entries: [
        { ...entry(), ...pii, booking: { guest: pii.guestName } },
        { ...entry({ id: 'e0000000-0000-4000-8000-000000000002', type: 'ChannelFee', source: 'Booking', sourceId: BOOKING_ID, amount: -100, originalAmount: -100, sourceAmount: -200 }), ...pii },
      ],
    });
    renderStatement();
    await screen.findByTestId('statement-lines');
    const rows = screen.getAllByTestId('statement-line');
    expect(rows).toHaveLength(2);

    fireEvent.click(within(rows[0]).getByTestId('statement-line-explain'));
    const drawer = await screen.findByTestId('ledger-line-drawer');
    // The line opens its booking by id, never by a name.
    expect(within(drawer).getByTestId('line-open-source')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}`);
    expect(within(drawer).getByTestId('line-open-payment')).toHaveAttribute('href', '/app/short-rent/payments/f0000000-0000-4000-8000-000000000001');

    const everything = document.body.innerHTML;
    for (const value of Object.values(pii)) expect(everything).not.toContain(value);
    expect(everything).not.toMatch(/Verdi|verdi@|333 1234567|AX1234567/);
  });

  it('MonthEndClose_Statement_IsNotAFiscalDocument_AndNeverOffersToIssueAnInvoice_Test', async () => {
    renderStatement();
    await screen.findByTestId('external-invoices');

    expect(screen.getByTestId('statement-non-fiscal')).toHaveTextContent(text('ownerAccounting.statement.nonFiscal'));
    // The agency only links the invoice its own fiscal system issued: there is no «emetti» and no «genera fattura» anywhere.
    expect(document.body.textContent).not.toMatch(/emetti|genera (la )?fattura|emissione/i);
    expect(screen.getByTestId('external-add')).toHaveTextContent(text('ownerAccounting.external.add'));
    expect(screen.getByTestId('external-notice')).toHaveTextContent(/non emette fatture ai proprietari/i);
  });

  it('MonthEndClose_OpeningTheMonth_ReadsOnly_AndGroupsTheOwnersByWhatIsNext', async () => {
    const owners = ['01', '02', '03', '04'].map((n) => `${n}000000-0000-4000-8000-000000000000`);
    api.listOwners.mockResolvedValue([
      { id: owners[0], firstName: 'Anna', lastName: 'Alfa' },
      { id: owners[1], firstName: 'Bruno', lastName: 'Beta' },
      { id: owners[2], firstName: 'Carla', lastName: 'Gamma' },
      { id: owners[3], firstName: 'Dario', lastName: 'Delta' },
    ]);
    api.getReadiness.mockResolvedValue(
      readiness([
        ownerReadiness({ ownerId: owners[0], latestVersion: null, latestStatus: null, issues: [{ code: 'statement_missing', ownerId: owners[0], propertyId: null, sourceId: null, blocking: true }], ready: false }),
        ownerReadiness({ ownerId: owners[1], latestVersion: 1, latestStatus: 'Draft', issues: [{ code: 'statement_not_approved', ownerId: owners[1], propertyId: null, sourceId: null, blocking: true }], ready: false }),
        ownerReadiness({ ownerId: owners[2], latestVersion: 1, latestStatus: 'Approved' }),
        ownerReadiness({ ownerId: owners[3], latestVersion: 1, latestStatus: 'Published', issues: [{ code: 'fx_missing', ownerId: owners[3], propertyId: null, sourceId: null, blocking: true }], ready: false }),
      ]),
    );
    const statuses = ['Draft', 'Approved', 'Published'] as const;
    api.listVersions.mockImplementation(async (_y: number, _m: number, ownerId: string) => [version({ id: `v-${ownerId.slice(0, 2)}`, ownerId, version: 1, status: statuses[owners.indexOf(ownerId) - 1] ?? 'Draft', supersedesVersionId: null })]);
    renderMonth();

    await screen.findByTestId('close-readiness');
    // Three of the four statements have no anomaly that blocks them; the statement still to prepare is not an anomaly, it is a group.
    expect(screen.getByTestId('close-readiness-percent')).toHaveTextContent('75%');
    for (const group of ['toPrepare', 'toVerify', 'approved', 'published']) expect(within(screen.getByTestId(`group-${group}`)).getAllByTestId('owner-row')).toHaveLength(1);
    expect(within(screen.getByTestId('group-toPrepare')).getByText('Anna Alfa')).toBeInTheDocument();
    expect(within(screen.getByTestId('group-published')).getByText('Dario Delta')).toBeInTheDocument();
    // The anomaly says what it is and what resolves it.
    const anomalies = screen.getAllByTestId('anomaly');
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toHaveAttribute('data-code', 'fx_missing');
    expect(within(anomalies[0]).getByRole('button', { name: text('ownerAccounting.anomalies.actions.fx') })).toBeInTheDocument();

    // Opening the month read it and nothing else: no posting, no new version, no approval, no publication, no close.
    expect(api.getReadiness).toHaveBeenCalledWith(YEAR, MONTH);
    for (const call of [api.postPeriod, api.generateVersion, api.approveVersion, api.publishVersion, api.closeMonth, api.confirmPayout, api.generateF24]) expect(call).not.toHaveBeenCalled();
  });

  it('MonthEndClose_CheckTheMonth_PostsOnlyWhenThePersonAsks', async () => {
    api.postPeriod.mockResolvedValue({ year: YEAR, month: MONTH, posted: 3, reversed: 0, unchanged: 1, issues: [] });
    renderMonth();
    const check = await screen.findByTestId('close-check');
    expect(api.postPeriod).not.toHaveBeenCalled();

    fireEvent.click(check);

    await waitFor(() => expect(api.postPeriod).toHaveBeenCalledWith(YEAR, MONTH));
    // The readiness is read again after it, so the page shows what the posting changed.
    await waitFor(() => expect(api.getReadiness.mock.calls.length).toBeGreaterThan(1));
  });

  it('MonthEndClose_ClosingAMonthThatDoesNotReconcile_NeedsTheWordAndAReason', async () => {
    api.listPayouts.mockResolvedValue([payout({ grossAmount: 500 })]);
    api.closeMonth.mockResolvedValue({});
    renderStatement();
    fireEvent.click(await screen.findByTestId('statement-close'));

    const dialog = await screen.findByRole('dialog');
    // The reconciliation is on the screen before the person confirms: 800 owed, 500 paid.
    await within(dialog).findByTestId('reconciliation-difference');
    expect(within(dialog).getByTestId('reconciliation-verdict')).toHaveAttribute('data-reconciled', 'false');
    const confirm = within(dialog).getByRole('button', { name: text('ownerAccounting.close.confirm') });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByTestId('confirmation-input'), { target: { value: text('ownerAccounting.close.word') } });
    // The word is not enough with a difference: the reason of the waiver is asked too.
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('close-waiver-reason'), { target: { value: 'Differenza concordata con il proprietario' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(api.closeMonth).toHaveBeenCalledWith(YEAR, MONTH, OWNER_ID, 'Differenza concordata con il proprietario'));
  });

  it('MonthEndClose_ClosingAMonthThatReconciles_AsksNoReason', async () => {
    api.listPayouts.mockResolvedValue([payout({ grossAmount: 800 })]);
    api.closeMonth.mockResolvedValue({});
    renderStatement();
    fireEvent.click(await screen.findByTestId('statement-close'));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByTestId('reconciliation-difference');
    expect(within(dialog).getByTestId('reconciliation-verdict')).toHaveAttribute('data-reconciled', 'true');
    expect(within(dialog).queryByTestId('close-waiver-reason')).toBeNull();
    fireEvent.change(within(dialog).getByTestId('confirmation-input'), { target: { value: text('ownerAccounting.close.word') } });
    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.close.confirm') }));

    await waitFor(() => expect(api.closeMonth).toHaveBeenCalledWith(YEAR, MONTH, OWNER_ID, undefined));
  });

  it('MonthEndClose_Payout_AsksOnlyTheFactsTheApprovedRuleNeeds_AndNeverDecidesTheWithholding', async () => {
    api.listPolicies.mockResolvedValue([
      policy({
        parameters: { withholdingApplies: true, withholdingRatePercent: 21, withholdingTaxCode: 'TC-1', requiresAgencyCollection: true, requiresQualifyingShortLet: false, grossBaseComponents: ['rent'], rounding: 'half_up', retentionYears: 10 },
      }),
    ]);
    api.confirmPayout.mockImplementation(async (command: { grossAmount: number }) =>
      payout({
        grossAmount: command.grossAmount,
        withholdingAmount: 12,
        netAmount: command.grossAmount - 12,
        evidence: [
          {
            id: 'ev-1',
            decision: 'Applicable',
            reasonCode: 'applicable',
            jurisdiction: 'IT',
            ruleCode: 'IT-RULE',
            ruleVersion: '2025.1',
            grossBase: 100,
            ratePercent: 12,
            rounding: 'half_up',
            amount: 12,
            taxCode: 'TC-1',
            paidOn: '2025-02-05',
            periodYear: 2025,
            periodMonth: 2,
            reversesEvidenceId: null,
            createdAt: '2025-02-05T09:00:00Z',
          },
        ],
      }),
    );
    renderStatement();
    fireEvent.click(await screen.findByTestId('statement-payout'));

    const dialog = await screen.findByTestId('payout-form');
    // The rule asks whether the agency collected, and the amount of the rent: nothing about a short-term let, which this rule does not ask.
    await within(dialog).findByTestId('payout-facts');
    // The rule is the one the server names for the day: the profiles of the owner, which come with the identifiers and the bank account in full, are never read for a payment.
    expect(api.getFiscalReadiness).toHaveBeenCalledWith(OWNER_ID, todayInRome());
    expect(api.listFiscalProfiles).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('payout-agency-collected')).toHaveValue('');
    expect(within(dialog).queryByTestId('payout-qualifying')).toBeNull();
    expect(within(dialog).getByTestId('payout-component-rent')).toBeInTheDocument();

    // A question left unanswered is a refusal, never a «no» by default: nothing is sent.
    fireEvent.change(within(dialog).getByTestId('payout-gross'), { target: { value: '800,00' } });
    fireEvent.change(within(dialog).getByTestId('payout-component-rent'), { target: { value: '100' } });
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));
    expect(api.confirmPayout).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByTestId('payout-agency-collected'), { target: { value: 'yes' } });
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));

    await waitFor(() => expect(api.confirmPayout).toHaveBeenCalledTimes(1));
    const sent = api.confirmPayout.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).toMatchObject({ ownerId: OWNER_ID, statementVersionId: VERSION_ID, grossAmount: 800, currency: 'EUR', agencyCollected: true, qualifyingShortLet: null, components: { rent: 100 } });
    // The page sends the facts and no withholding: the amount shown comes from the decision the server recorded.
    expect(sent).not.toHaveProperty('withholdingAmount');
    const evidence = await screen.findByTestId('tax-evidence');
    expect(evidence).toHaveAttribute('data-decision', 'Applicable');
    expect(within(evidence).getByTestId('tax-evidence-amount')).toHaveTextContent('12,00');
  });

  it('MonthEndClose_Payout_WithoutAnApprovedRule_IsNotOffered', async () => {
    // The server says what blocks the owner on the day: the payment is not offered, and the way out is the owner's data.
    api.getFiscalReadiness.mockRejectedValue(problem(422, 'owner_fiscal_policy_not_approved'));
    renderStatement();
    fireEvent.click(await screen.findByTestId('statement-payout'));

    const blocked = await screen.findByTestId('payout-rule-blocked');
    expect(blocked).toHaveTextContent(text('ownerAccounting.payout.blocked.policy_not_approved'));
    expect(screen.getByTestId('payout-confirm')).toBeDisabled();
    expect(within(blocked).getByRole('link')).toHaveAttribute('href', `/app/account/owners/${OWNER_ID}/financial?period=${YEAR}-01`);
    expect(api.confirmPayout).not.toHaveBeenCalled();
  });

  it('MonthEndClose_Payout_AFailureToReadTheRule_IsNotAVerdictOnTheOwner_AndCanBeTriedAgain', async () => {
    api.getFiscalReadiness.mockRejectedValueOnce(networkError());
    renderStatement();
    fireEvent.click(await screen.findByTestId('statement-payout'));

    // A network error says nothing of the owner: it is told as a failure to read, never as a rule that is missing.
    const failed = await screen.findByTestId('payout-rule-error');
    expect(screen.queryByTestId('payout-rule-blocked')).toBeNull();
    expect(screen.getByTestId('payout-confirm')).toBeDisabled();

    fireEvent.click(within(failed).getByRole('button', { name: text('shared.errorState.retry') }));
    await screen.findByTestId('payout-rule');
    expect(screen.queryByTestId('payout-rule-error')).toBeNull();
    expect(screen.getByTestId('payout-confirm')).toBeEnabled();
  });

  it('MonthEndClose_StatementDetail_ExplainsTheFormulaAndWhatChangedSinceThePreviousVersion', async () => {
    api.getVersion.mockResolvedValue({
      version: version(),
      entries: [
        entry({ postedAt: '2025-01-10T08:00:00Z' }),
        entry({ id: 'e0000000-0000-4000-8000-000000000003', type: 'OwnerCharge', source: 'OwnerCharge', amount: -50, originalAmount: -50, sourceAmount: -50, sharePercent: 100, description: 'Pulizia straordinaria', postedAt: '2025-02-01T08:00:00Z' }),
      ],
    });
    renderStatement();
    const formula = await screen.findByTestId('version-formula');
    expect(formula).toHaveTextContent(/saldo di apertura/i);
    // What changed is what was posted after the previous cut-off, and the figures that moved.
    const changes = await screen.findByTestId('statement-changes');
    await within(changes).findAllByTestId('statement-change-figure');
    expect(changes).toHaveTextContent(text('ownerAccounting.line.type.OwnerCharge'));
    expect(within(changes).getByTestId('statement-history')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('statement-line-explain')[0]);
    const drawer = await screen.findByTestId('ledger-line-drawer');
    expect(within(drawer).getByTestId('line-steps')).toBeInTheDocument();
    expect(within(drawer).getByTestId('line-fx')).toHaveTextContent('EUR');
  });

  it('MonthEndClose_NotTheFinanceAdministrator_IsToldWhoToAsk_AndNothingIsRead', async () => {
    // A person who is not the owner or an administrator (an accountant of the org, a collaborator) sees the notice: no endpoint of the money is called.
    workspace.contexts = [{ contextKey: 'account', roleKey: 'org_accountant' }];
    renderMonth();

    expect(await screen.findByTestId('finance-admin-required')).toBeInTheDocument();
    expect(screen.queryByTestId('close-readiness')).toBeNull();
    for (const call of [api.getReadiness, api.listOwners, api.getTaxReconciliation]) expect(call).not.toHaveBeenCalled();

    cleanup();
    renderStatement();
    expect(await screen.findByTestId('finance-admin-required')).toBeInTheDocument();
    expect(api.getVersion).not.toHaveBeenCalled();
  });

  it('MonthEndClose_TheProtectionIsTheRole_NoReadStartsForAnyoneElse_OnAnyPageOfTheAccounting', async () => {
    // The owner accounting spans every property of the org, and a read refused with no code is taken by the global handler of the app (the «nessun accesso» page) before a
    // page could answer: what keeps the others out is the role, checked before anything is read. Not one endpoint of the money is called for a collaborator, an accountant, a manager.
    const everything = Object.values(api);
    for (const roleKey of ['org_accountant', 'org_manager', 'staff', 'accountant', 'property_manager']) {
      workspace.contexts = [{ contextKey: 'account', roleKey }];
      for (const render of [renderMonth, renderStatement]) {
        const view = render();
        expect(await screen.findByTestId('finance-admin-required')).toBeInTheDocument();
        view.unmount();
      }
    }
    for (const call of everything) expect(call).not.toHaveBeenCalled();
  });

  it('MonthEndClose_AFailedRead_IsToldWithTheWayToTryAgain', async () => {
    api.getReadiness.mockRejectedValueOnce(networkError());
    renderMonth();

    const failed = await screen.findByTestId('owner-accounting-error');
    expect(api.getReadiness).toHaveBeenCalledTimes(1);
    fireEvent.click(within(failed).getByRole('button', { name: text('shared.errorState.retry') }));

    await screen.findByTestId('close-readiness');
    expect(api.getReadiness).toHaveBeenCalledTimes(2);
  });

  it('MonthEndClose_TheListOfOwners_IsReadAgainEveryTimeThePageOpens', async () => {
    // The activation adds owners: a list kept fresh for minutes would show «Proprietario 1A2B3C» for one that was just named.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000 }, mutations: { retry: false } } });
    const month = () => renderPage(`/app/account/owner-close?period=${YEAR}-01`, '/app/account/owner-close', createElement(MonthEndClosePage), client);

    const first = month();
    await screen.findByText('Marta Rossi');
    first.unmount();
    expect(api.listOwners).toHaveBeenCalledTimes(1);
    month();
    await screen.findByText('Marta Rossi');
    await waitFor(() => expect(api.listOwners).toHaveBeenCalledTimes(2));
  });
});

describe('the controlled close, step by step (E06/F05/US02/T04)', () => {
  const draft = () => version({ status: 'Draft', version: 1, supersedesVersionId: null, supersededByVersionId: null, approvedAt: null, approvedByUserId: null, publishedAt: null, publishedByUserId: null, publishedSha256: null });

  it('MonthEndClose_Approve_AsksForAConfirmationThatSaysWhatHappens_BeforeAnythingIsSent', async () => {
    api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ latestVersion: 1, latestStatus: 'Draft' })]));
    api.listVersions.mockResolvedValue([draft()]);
    api.approveVersion.mockResolvedValue({ ...draft(), status: 'Approved' });
    renderMonth();

    fireEvent.click(await screen.findByTestId(`row-${OWNER_ID}-approve`));
    const dialog = await screen.findByRole('dialog');
    // What happens and what is not possible afterwards is said before the person confirms; nothing is sent by opening it.
    expect(within(dialog).getByText(text('ownerAccounting.step.approve.consequence1'))).toBeInTheDocument();
    expect(within(dialog).getByText(text('ownerAccounting.step.approve.consequence2'))).toBeInTheDocument();
    expect(api.approveVersion).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.step.approve.confirm') }));
    await waitFor(() => expect(api.approveVersion).toHaveBeenCalledWith(VERSION_ID));
    expect(api.publishVersion).not.toHaveBeenCalled();
  });

  it('MonthEndClose_Publish_AsksForAConfirmationThatSaysTheFileNeverChanges_AndIsAnotherStepThanTheApproval', async () => {
    api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ latestVersion: 1, latestStatus: 'Approved' })]));
    api.listVersions.mockResolvedValue([{ ...draft(), status: 'Approved' }]);
    api.publishVersion.mockResolvedValue(version());
    renderMonth();

    fireEvent.click(await screen.findByTestId(`row-${OWNER_ID}-publish`));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(text('ownerAccounting.step.publish.consequence1'))).toBeInTheDocument();
    expect(api.publishVersion).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.step.publish.confirm') }));
    await waitFor(() => expect(api.publishVersion).toHaveBeenCalledWith(VERSION_ID));
    // Publishing is not approving: the approval is not asked again.
    expect(api.approveVersion).not.toHaveBeenCalled();
  });

  it('MonthEndClose_Correction_SignsTheAmountByWhoItIsInFavourOf', async () => {
    api.postCorrection.mockResolvedValue(entry());
    renderStatement();

    // Charged to the owner: it is taken off the balance, so the line is negative.
    fireEvent.click(await screen.findByTestId('statement-menu-correction'));
    let dialog = await screen.findByTestId('correction-dialog');
    fireEvent.change(within(dialog).getByTestId('correction-direction'), { target: { value: 'fromOwner' } });
    fireEvent.change(within(dialog).getByTestId('correction-amount'), { target: { value: '50,00' } });
    fireEvent.change(within(dialog).getByTestId('correction-reason'), { target: { value: 'Pulizia pagata due volte' } });
    fireEvent.click(within(dialog).getByTestId('correction-dialog-submit'));
    await waitFor(() => expect(api.postCorrection).toHaveBeenCalledTimes(1));
    expect(api.postCorrection.mock.calls[0][0]).toEqual({ ownerId: OWNER_ID, amount: -50, currency: 'EUR', date: todayInRome(), description: 'Pulizia pagata due volte' });
    await waitFor(() => expect(screen.queryByTestId('correction-dialog')).toBeNull());

    // In favour of the owner: it is added to the balance, so the line is positive (the amount is typed without a sign).
    fireEvent.click(await screen.findByTestId('statement-menu-correction'));
    dialog = await screen.findByTestId('correction-dialog');
    fireEvent.change(within(dialog).getByTestId('correction-amount'), { target: { value: '12,50' } });
    fireEvent.change(within(dialog).getByTestId('correction-reason'), { target: { value: 'Rimborso dovuto' } });
    fireEvent.click(within(dialog).getByTestId('correction-dialog-submit'));
    await waitFor(() => expect(api.postCorrection).toHaveBeenCalledTimes(2));
    expect(api.postCorrection.mock.calls[1][0]).toMatchObject({ amount: 12.5, description: 'Rimborso dovuto' });

    // A correction with no reason is not sent: it is the reason that tells whoever checks the month why.
    fireEvent.click(await screen.findByTestId('statement-menu-correction'));
    dialog = await screen.findByTestId('correction-dialog');
    fireEvent.change(within(dialog).getByTestId('correction-amount'), { target: { value: '5' } });
    expect(within(dialog).getByTestId('correction-dialog-submit')).toBeDisabled();
  });
});

describe('what a payment asks, and the payment that was made once (E06/F05/US02/T04)', () => {
  /** Opens the dialog of the payment on the statement and types the amount. */
  async function openPayoutWith(gross: string) {
    fireEvent.click(await screen.findByTestId('statement-payout'));
    const dialog = await screen.findByTestId('payout-form');
    await waitFor(() => expect(within(dialog).getByTestId('payout-confirm')).toBeEnabled());
    fireEvent.change(within(dialog).getByTestId('payout-gross'), { target: { value: gross } });
    return dialog;
  }
  const keyOf = (call: number) => (api.confirmPayout.mock.calls[call][0] as { idempotencyKey: string }).idempotencyKey;

  it('MonthEndClose_Payout_ARetryAfterAFailure_SendsTheSameKey_AndSoDoesTheDialogOpenedAgain_UntilTheServerConfirmed', async () => {
    api.confirmPayout.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError()).mockResolvedValue(payout());
    renderStatement();

    // The answer was lost: the person asks again in the same dialog, and the same request is sent.
    let dialog = await openPayoutWith('800,00');
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));
    await within(dialog).findByTestId('payout-error');
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));
    await waitFor(() => expect(api.confirmPayout).toHaveBeenCalledTimes(2));
    await within(dialog).findByTestId('payout-error');
    expect(keyOf(1)).toBe(keyOf(0));

    // The dialog is closed and opened again with the same facts: still the same request.
    fireEvent.click(within(dialog).getByRole('button', { name: text('shared.cancel') }));
    await waitFor(() => expect(screen.queryByTestId('payout-form')).toBeNull());
    dialog = await openPayoutWith('800,00');
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));
    await screen.findByTestId('payout-done');
    expect(api.confirmPayout).toHaveBeenCalledTimes(3);
    expect(keyOf(2)).toBe(keyOf(0));

    // Confirmed: the same amount on the same day is another payment, and it gets another key (the first one would answer with the payout that already exists).
    fireEvent.click(within(screen.getByTestId('payout-done')).getByRole('button', { name: text('shared.close') }));
    await waitFor(() => expect(screen.queryByTestId('payout-done')).toBeNull());
    dialog = await openPayoutWith('800,00');
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));
    await screen.findByTestId('payout-done');
    expect(api.confirmPayout).toHaveBeenCalledTimes(4);
    expect(keyOf(3)).not.toBe(keyOf(0));
  });

  it('MonthEndClose_Payout_ASecondClick_OrEscapeWhileTheRequestIsOnItsWay_RecordsNothingTwice', async () => {
    const sent = deferred<ReturnType<typeof payout>>();
    api.confirmPayout.mockReturnValue(sent.promise);
    renderStatement();

    const dialog = await openPayoutWith('800,00');
    // Two submits in the same tick (a click and the Enter of the form): the second is stopped before the state of the mutation says a request is on its way.
    fireEvent.submit(dialog);
    fireEvent.submit(dialog);
    await waitFor(() => expect(api.confirmPayout).toHaveBeenCalledTimes(1));
    // A second click once the button is busy does nothing either.
    fireEvent.click(within(dialog).getByTestId('payout-confirm'));
    await new Promise((done) => setTimeout(done, 0));
    expect(api.confirmPayout).toHaveBeenCalledTimes(1);

    // The dialog is not left while the request is on its way (Escape, the cross, a click outside): nobody opens another one for a payment that may be recorded already.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: text('shared.close') }));
    expect(screen.getByTestId('payout-form')).toBeInTheDocument();

    sent.resolve(payout());
    await screen.findByTestId('payout-done');
    expect(api.confirmPayout).toHaveBeenCalledTimes(1);
  });

  it('MonthEndClose_Payout_AnAmountOverWhatIsLeft_IsWarnedBeforeItIsRecorded', async () => {
    // 800 owed, 500 paid: 300 left.
    api.listPayouts.mockResolvedValue([payout({ grossAmount: 500 })]);
    renderStatement();

    const dialog = await openPayoutWith('400,00');
    const warning = await within(dialog).findByTestId('payout-over-left');
    expect(warning).toHaveTextContent('300,00');
    fireEvent.change(within(dialog).getByTestId('payout-gross'), { target: { value: '300,00' } });
    expect(within(dialog).queryByTestId('payout-over-left')).toBeNull();
  });

  it('MonthEndClose_Payout_WhenTheBalanceIsAlreadyPaid_AnyAmountIsWarned', async () => {
    api.listPayouts.mockResolvedValue([payout({ grossAmount: 800 })]);
    renderStatement();

    const dialog = await openPayoutWith('10,00');
    expect(await within(dialog).findByTestId('payout-over-left')).toHaveTextContent(text('ownerAccounting.payout.nothingLeft'));
  });
});

describe('the next step of an owner whose statement is published (E06/F05/US02/T04)', () => {
  it('MonthEndClose_AStatementAlreadyPaid_PutsTheCloseFirst_NotAnotherPayment', async () => {
    // 800 owed, 800 paid: the one highlighted step of the row is the close; the payment stays in the menu.
    api.listPayouts.mockResolvedValue([payout({ grossAmount: 800 })]);
    renderMonth();

    expect(await screen.findByTestId(`row-${OWNER_ID}-close`)).toBeInTheDocument();
    expect(screen.queryByTestId(`row-${OWNER_ID}-payout`)).toBeNull();
    // The payment is still there for an extra one, in the menu of the row.
    expect(screen.getByTestId(`row-${OWNER_ID}-more`)).toBeInTheDocument();
  });

  it('MonthEndClose_AStatementNotPaidYet_StillAsksForThePayment', async () => {
    api.listPayouts.mockResolvedValue([payout({ grossAmount: 500 })]);
    renderMonth();

    expect(await screen.findByTestId(`row-${OWNER_ID}-payout`)).toBeInTheDocument();
    expect(screen.queryByTestId(`row-${OWNER_ID}-close`)).toBeNull();
  });

  it('MonthEndClose_TheRowWaitsForThePayments_AndSaysWhenTheyCannotBeRead', async () => {
    api.listPayouts.mockRejectedValue(networkError());
    renderMonth();

    // Not known: the payments are not read, so the row says so with the way to try again, and the step it can still offer is the one it always offered.
    expect(await screen.findByTestId(`row-${OWNER_ID}-payments-error`)).toBeInTheDocument();
    expect(screen.getByTestId(`row-${OWNER_ID}-payout`)).toBeInTheDocument();
  });
});

describe('the tax year, told for what it is (E06/F05/US02/T04, AC-NF110-5)', () => {
  const reconciliation = (overrides: Record<string, unknown>) => ({ year: YEAR, obligationsTotal: 0, f24Total: 0, annualTotal: null, months: [], reconciled: true, ...overrides });
  const checked = () => screen.findByTestId('tax-year-check');

  it('TaxYear_AYearWithNoWithholding_SaysThereIsNothingToReconcile_NotThatItMatches', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation({}));
    api.getAnnualDataset.mockResolvedValue(null);
    renderTax();

    const year = await checked();
    expect(year).toHaveAttribute('data-verdict', 'empty');
    expect(year).toHaveTextContent(text('ownerAccounting.tax.yearEmpty', { year: YEAR }));
    expect(year).not.toHaveTextContent(/coincid/i);
  });

  it('TaxYear_F24ThatMatchAndNoAnnualDataYet_SaysOnlyTheF24Match', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation({ obligationsTotal: 120, f24Total: 120, months: [{ month: MONTH, obligations: 120, f24: 120, filingState: 'Generated' }] }));
    api.getF24.mockResolvedValue(f24());
    api.getAnnualDataset.mockResolvedValue(null);
    renderTax();

    const year = await checked();
    expect(year).toHaveAttribute('data-verdict', 'f24Matches');
    expect(year).toHaveTextContent(/F24/);
    // The annual data do not exist: they are not said to match.
    expect(year).not.toHaveTextContent(/annual/i);
  });

  it('TaxYear_AnnualDataThatDoNotMatch_AreTheOnesToldApart_NotTheF24', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation({ obligationsTotal: 500, f24Total: 500, annualTotal: 400, months: [{ month: MONTH, obligations: 500, f24: 500, filingState: 'Generated' }] }));
    api.getF24.mockResolvedValue(f24({ totalAmount: 500 }));
    api.getAnnualDataset.mockResolvedValue(dataset({ totalWithheld: 400 }));
    renderTax();

    const year = await checked();
    expect(year).toHaveAttribute('data-verdict', 'differs');
    const annual = within(year).getByTestId('tax-year-annual-differs');
    expect(annual).toHaveTextContent('400,00');
    expect(annual).toHaveTextContent('500,00');
    expect(within(year).queryByTestId('tax-year-f24-differs')).toBeNull();
  });

  it('TaxYear_AnF24ThatIsNotWhatTheWithholdingsSay_IsToldMonthByMonth', async () => {
    api.getTaxReconciliation.mockResolvedValue(
      reconciliation({
        obligationsTotal: 200,
        f24Total: 90,
        months: [
          { month: 1, obligations: 100, f24: 90, filingState: 'Generated' },
          { month: 2, obligations: 100, f24: null, filingState: null },
        ],
      }),
    );
    api.getF24.mockResolvedValue(f24({ totalAmount: 90 }));
    api.getAnnualDataset.mockResolvedValue(null);
    renderTax();

    const year = await checked();
    expect(year).toHaveAttribute('data-verdict', 'differs');
    const lines = within(within(year).getByTestId('tax-year-f24-differs')).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('100,00');
    expect(lines[0]).toHaveTextContent('90,00');
    expect(lines[1]).toHaveTextContent('F24 non ancora generato');
    expect(year).not.toHaveTextContent(/coincidono con gli F24 e/i);
  });

  it('TaxYear_ReconciledIsSaidOnlyWithAnF24AndAnnualDataThatMatch', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation({ obligationsTotal: 120, f24Total: 120, annualTotal: 120, months: [{ month: MONTH, obligations: 120, f24: 120, filingState: 'Generated' }] }));
    api.getF24.mockResolvedValue(f24());
    api.getAnnualDataset.mockResolvedValue(dataset());
    renderTax();

    const year = await checked();
    expect(year).toHaveAttribute('data-verdict', 'reconciled');
    expect(year).toHaveTextContent(/coincidono con gli F24 e con i dati annuali/);
  });

  it('TaxFiling_MovingAFile_SendsTheProofTheStateIsCalledBy', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation({ obligationsTotal: 120, f24Total: 120, annualTotal: 120, months: [{ month: MONTH, obligations: 120, f24: 120, filingState: 'Reviewed' }] }));
    api.getF24.mockResolvedValue(f24({ filingState: 'Reviewed' }));
    api.getAnnualDataset.mockResolvedValue(dataset({ filingState: 'Submitted', handoffReference: 'Commercialista' }));
    api.setF24FilingState.mockResolvedValue(f24({ filingState: 'Submitted', handoffReference: 'x' }));
    api.setDatasetFilingState.mockResolvedValue(dataset());
    renderTax();

    // The handoff of the F24: «inviato» needs who sent it and how, and nothing is sent without it.
    fireEvent.click(await screen.findByTestId('filing-step-Submitted'));
    let dialog = await screen.findByRole('dialog');
    const confirmSubmitted = within(dialog).getByRole('button', { name: text('ownerAccounting.filing.dialog.Submitted.confirm') });
    expect(confirmSubmitted).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('filing-text'), { target: { value: ' Commercialista, 16/02 ' } });
    fireEvent.click(confirmSubmitted);
    await waitFor(() => expect(api.setF24FilingState).toHaveBeenCalledWith(f24().id, { state: 'Submitted', handoffReference: 'Commercialista, 16/02' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The receipt of the annual data: «accettato» needs the receipt of the authority.
    fireEvent.click(await screen.findByTestId('filing-step-Accepted'));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: text('ownerAccounting.filing.dialog.Accepted.confirm') })).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('filing-text'), { target: { value: 'RIC-77' } });
    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.filing.dialog.Accepted.confirm') }));
    await waitFor(() => expect(api.setDatasetFilingState).toHaveBeenCalledWith(dataset().id, { state: 'Accepted', receiptReference: 'RIC-77' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // A rejection needs its reason.
    fireEvent.click(await screen.findByTestId('filing-step-Rejected'));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: text('ownerAccounting.filing.dialog.Rejected.confirm') })).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('filing-text'), { target: { value: 'Dati non validi' } });
    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.filing.dialog.Rejected.confirm') }));
    await waitFor(() => expect(api.setDatasetFilingState).toHaveBeenCalledWith(dataset().id, { state: 'Rejected', reason: 'Dati non validi' }));
  });

  it('TaxFiling_TheReviewOfAGeneratedFile_NeedsNoText_AndSendsNone', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation({ obligationsTotal: 120, f24Total: 120, months: [{ month: MONTH, obligations: 120, f24: 120, filingState: 'Generated' }] }));
    api.getF24.mockResolvedValue(f24());
    api.getAnnualDataset.mockResolvedValue(null);
    api.setF24FilingState.mockResolvedValue(f24({ filingState: 'Reviewed' }));
    renderTax();

    fireEvent.click(await screen.findByTestId('filing-step-Reviewed'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByTestId('filing-text')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: text('ownerAccounting.filing.dialog.Reviewed.confirm') }));
    await waitFor(() => expect(api.setF24FilingState).toHaveBeenCalledWith(f24().id, { state: 'Reviewed' }));
  });
});

describe('the buttons of a card while a step of it is on its way (E06/F05/US02/T04)', () => {
  it('TaxFiling_WhileAFileIsBeingMade_NoOtherButtonOfThePanelCanBePressed', async () => {
    const made = deferred<ReturnType<typeof f24>>();
    api.getTaxReconciliation.mockResolvedValue({ year: YEAR, obligationsTotal: 120, f24Total: 120, annualTotal: null, months: [{ month: MONTH, obligations: 120, f24: 120, filingState: 'Generated' }], reconciled: true });
    api.getF24.mockResolvedValue(f24());
    api.getAnnualDataset.mockResolvedValue(null);
    api.generateAnnualDataset.mockReturnValue(made.promise);
    renderTax();

    const regenerate = await screen.findByTestId('f24-regenerate');
    const review = screen.getByTestId('filing-step-Reviewed');
    expect(regenerate).toBeEnabled();
    fireEvent.click(await screen.findByTestId('tax-generate-annual'));

    // The annual data are being made: the F24 beside them cannot be reviewed, made again or downloaded until the server has answered.
    await waitFor(() => expect(screen.getByTestId('tax-generate-annual')).toBeDisabled());
    expect(regenerate).toBeDisabled();
    expect(review).toBeDisabled();
    expect(screen.getByTestId('f24-pdf')).toBeDisabled();

    made.resolve(dataset());
    await waitFor(() => expect(screen.getByTestId('filing-step-Reviewed')).toBeEnabled());
  });

  it('TaxFiling_WhileTheF24IsBeingMade_TheAnnualDataCannotBeMadeToo', async () => {
    const made = deferred<ReturnType<typeof f24>>();
    api.getTaxReconciliation.mockResolvedValue({ year: YEAR, obligationsTotal: 120, f24Total: 0, annualTotal: null, months: [{ month: MONTH, obligations: 120, f24: null, filingState: null }], reconciled: false });
    api.getAnnualDataset.mockResolvedValue(null);
    api.generateF24.mockReturnValue(made.promise);
    renderTax();

    fireEvent.click(await screen.findByTestId('tax-generate-f24'));
    await waitFor(() => expect(screen.getByTestId('tax-generate-annual')).toBeDisabled());
    expect(screen.getByTestId('tax-generate-f24')).toBeDisabled();

    made.resolve(f24());
    await waitFor(() => expect(screen.getByTestId('tax-generate-annual')).toBeEnabled());
  });

  it('MonthEndClose_WhileALinkIsBeingChecked_TheOtherButtonsOfTheInvoicesCannotBePressed', async () => {
    const checking = deferred<OwnerExternalDocument>();
    api.listExternalDocuments.mockResolvedValue([link()]);
    api.verifyExternalDocument.mockReturnValue(checking.promise);
    renderStatement();

    fireEvent.click(await screen.findByTestId('external-verify'));
    // Unlinking, or linking another invoice, would act on a link that is changing.
    await waitFor(() => expect(screen.getByTestId('external-remove')).toBeDisabled());
    expect(screen.getByTestId('external-add')).toBeDisabled();
    expect(screen.getByTestId('external-verify')).toBeDisabled();

    checking.resolve(link({ status: 'Verified', verifiedAt: '2025-02-11T09:00:00Z' }));
    await waitFor(() => expect(screen.getByTestId('external-add')).toBeEnabled());
    expect(screen.getByTestId('external-remove')).toBeEnabled();
  });
});
