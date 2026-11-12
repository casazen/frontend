import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { MonthEndClosePage } from '../month-end-close-page';
import { StatementDetailPage } from '../statement-detail-page';
import { TaxFilingPanel } from '../components/tax-filing-panel';
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
  listExternalDocuments: vi.fn(),
  listPayouts: vi.fn(),
  getPayout: vi.fn(),
  confirmPayout: vi.fn(),
  listFiscalProfiles: vi.fn(),
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

function renderPage(path: string, routePath: string, element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [path] }, createElement(Routes, null, createElement(Route, { path: routePath, element })))),
  );
}

const renderStatement = () => renderPage(`/app/account/owner-close/versions/${VERSION_ID}`, '/app/account/owner-close/versions/:versionId', createElement(StatementDetailPage));
const renderMonth = () => renderPage(`/app/account/owner-close?period=${YEAR}-01`, '/app/account/owner-close', createElement(MonthEndClosePage));
const renderTax = () => renderPage('/tax', '/tax', createElement(TaxFilingPanel, { period: { year: YEAR, month: MONTH } }));

const previous = () => version({ id: OLD_VERSION_ID, version: 1, status: 'Superseded', closingBalance: 700, revenue: 900, cutoffAt: '2025-01-20T08:00:00Z', supersedesVersionId: null, supersededByVersionId: VERSION_ID });

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  await i18n.changeLanguage('it');
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
    api.listPolicies.mockResolvedValue([policy({ approved: false, approvedAt: null, approvedByName: null })]);
    renderStatement();
    fireEvent.click(await screen.findByTestId('statement-payout'));

    const blocked = await screen.findByTestId('payout-rule-blocked');
    expect(blocked).toHaveTextContent(text('ownerAccounting.payout.blocked.policy_not_approved'));
    expect(screen.getByTestId('payout-confirm')).toBeDisabled();
    expect(api.confirmPayout).not.toHaveBeenCalled();
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

  it('MonthEndClose_ANoReachAnswer_IsToldAsSuch_NotAsAFailureToRetry', async () => {
    // The owner accounting spans every property of the org: a caller restricted to some of them is answered 403 and the page says why.
    api.getReadiness.mockRejectedValue(Object.assign(new Error('forbidden'), { isAxiosError: true, response: { status: 403, data: {} } }));
    renderMonth();

    expect(await screen.findByTestId('owner-accounting-no-access')).toHaveTextContent(text('ownerAccounting.noReach.title'));
    expect(screen.queryByTestId('owner-accounting-error')).toBeNull();
  });
});
