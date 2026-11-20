import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { OwnerLedgerEntry } from '@/types';
import { isInformational, shownAmount, statementGroupsOf } from '../owner-accounting-model';
import { StatementDetailPage } from '../statement-detail-page';
import { BOOKING_ID, OLD_VERSION_ID, OWNER_ID, VERSION_ID, entry, ownerReadiness, readiness, version } from './owner-accounting-fixtures';

const api = vi.hoisted(() => ({
  listOwners: vi.fn(),
  getReadiness: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  listExternalDocuments: vi.fn(),
  listPayouts: vi.fn(),
  getPayout: vi.fn(),
  downloadVersionPdf: vi.fn(),
  downloadVersionCsv: vi.fn(),
}));
vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Casa Lago' }] }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

// Whole pages with a drawer are rendered here: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

/** Intl writes a no-break space between a figure and its currency: the text of the page is compared with plain spaces. */
const plain = (value: string | null) => (value ?? '').replace(/\s/g, ' ');
const franc = (amount: number, language = 'it-IT') => plain(new Intl.NumberFormat(language, { style: 'currency', currency: 'CHF' }).format(amount));

const CHF = { originalCurrency: 'CHF', statementCurrency: 'CHF' } as const;
const line = (id: number, overrides: Partial<OwnerLedgerEntry>): OwnerLedgerEntry =>
  entry({ id: `e0000000-0000-4000-8000-00000000000${id}`, source: 'Booking', sourceId: BOOKING_ID, sourceReference: null, sharePercent: 100, ...CHF, ...overrides });

/**
 * The Swiss month of an agency that holds the accounts of the portals and does NOT recharge their commissions (decision 1 of 20/11/2026): the owner is not charged the commission of the
 * portal, so the closing is 450 - 90 - 13.77 - 80 = 266.23 and not 198.73. The commission is a line for information only, -67.50 as the ledger holds it, in the part of the channel fees.
 */
const REVENUE = line(1, { type: 'BookingRevenue', amount: 450, sourceAmount: 900, originalAmount: 450, sharePercent: 50, recognitionDate: '2025-01-12' });
const COMMISSION = line(2, { type: 'AgencyCommission', source: 'OwnerInvoice', sourceId: null, amount: -90, sourceAmount: -90, originalAmount: -90, recognitionDate: '2025-01-31' });
const VAT = line(3, { type: 'AgencyVat', source: 'OwnerInvoice', sourceId: null, amount: -13.77, sourceAmount: -13.77, originalAmount: -13.77, recognitionDate: '2025-01-31' });
const CHARGE = line(4, { type: 'OwnerCharge', source: 'OwnerCharge', sourceId: null, amount: -80, sourceAmount: -80, originalAmount: -80, recognitionDate: '2025-01-20' });
const BORNE = line(5, {
  type: 'ChannelFeeBorneByAgency',
  amount: -67.5,
  sourceAmount: -135,
  originalAmount: -67.5,
  sharePercent: 50,
  recognitionDate: '2025-01-14',
  informational: true,
});
const LINES = [REVENUE, COMMISSION, VAT, CHARGE, BORNE];
const VERSION = version({
  currency: 'CHF',
  status: 'Approved',
  publishedAt: null,
  publishedSha256: null,
  supersedesVersionId: null,
  openingBalance: 0,
  revenue: 450,
  channelFees: 0,
  commission: -103.77,
  charges: -80,
  payments: 0,
  corrections: 0,
  closingBalance: 266.23,
  entryCount: 5,
});

function renderStatement() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`/app/account/owner-close/versions/${VERSION_ID}`] },
        createElement(Routes, null, createElement(Route, { path: '/app/account/owner-close/versions/:versionId', element: createElement(StatementDetailPage) })),
      ),
    ),
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ latestStatus: 'Approved' })]));
  api.listVersions.mockResolvedValue([VERSION]);
  api.getVersion.mockResolvedValue({ version: VERSION, entries: LINES });
  api.listExternalDocuments.mockResolvedValue([]);
  api.listPayouts.mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('an informational line is in its group and in no total of the statement of the agency (FIX/FE-V2-INFORMATIONAL-WAIVER)', () => {
  // Money rule: the commission of a portal that the agency bears is shown with its amount, and is in NO total: not the part of the channel fees, not the total of the period. Every figure of
  // the page equals the sum WITHOUT the line of -67.50, and the closing is the one the server stores.
  it('StatementDetail_AnInformationalLineOfMinus6750_IsShownInItsGroup_AndEveryTotalIsTheSumWithoutIt', async () => {
    renderStatement();

    const groups = await screen.findByTestId('statement-groups');
    const cell = (key: string) => plain(within(groups).getByTestId(`statement-group-${key}`).textContent);
    expect(cell('stays')).toContain(franc(450));
    expect(cell('commission')).toContain(franc(-103.77));
    expect(cell('recharges')).toContain(franc(-80));
    // The part of the channel fees holds nothing that counts: 0, and no «1 riga» under its name.
    expect(cell('channelFees')).toContain(franc(0));
    expect(cell('channelFees')).not.toMatch(/riga|righe|67/);
    // The total of the period is the parts added up WITHOUT the line (450 - 103.77 - 80), the net is the closing the version stores: the two are the same, and neither is 198.73.
    expect(cell('period')).toContain(franc(266.23));
    expect(cell('net')).toContain(franc(266.23));
    expect(groups.textContent).not.toContain('198,73');
    expect(groups.textContent).not.toMatch(/-\s*67,50/);

    // The line is there, in its group, under the part of the channel fees: its amount as the PDF writes it (a positive figure), the words that say what it is, and that it is in no total.
    const informational = within(groups).getByTestId('statement-group-channelFees-informational');
    expect(informational).toHaveAttribute('data-informational', 'true');
    expect(plain(informational.textContent)).toContain(franc(67.5));
    expect(informational).toHaveTextContent(i18n.t('ownerAccounting.summary.informational.label'));
    expect(informational).toHaveTextContent(i18n.t('ownerAccounting.summary.informational.note', { count: 1 }));
    const rows = within(groups).getAllByTestId(/^statement-group-/);
    const order = rows.map((row) => row.getAttribute('data-testid'));
    expect(order.indexOf('statement-group-channelFees-informational')).toBe(order.indexOf('statement-group-channelFees') + 1);

    // The figures above the table are the server's: the line is in none of them (and not in the formula).
    expect(screen.getByTestId('version-formula').textContent).not.toMatch(/67,50|198,73/);
    expect(plain(screen.getByTestId('statement-focus').textContent)).toContain(franc(266.23));
  });

  it('StatementDetail_TheLinesTable_ShowsTheInformationalLineQuiet_WithItsAmountAsAPositiveFigure_AndTheOthersAsTheLedgerHasThem', async () => {
    renderStatement();

    const table = await screen.findByTestId('statement-lines');
    const rows = within(table).getAllByTestId('statement-line');
    expect(rows).toHaveLength(5);
    const amountOf = (type: string) => plain(within(rows.find((row) => row.getAttribute('data-type') === type) as HTMLElement).getByTestId('statement-line-amount').textContent);

    // Every line that counts keeps its sign: a commission and a recharge are deductions.
    expect(amountOf('BookingRevenue')).toBe(franc(450));
    expect(amountOf('AgencyCommission')).toBe(franc(-90));
    expect(amountOf('AgencyVat')).toBe(franc(-13.77));
    expect(amountOf('OwnerCharge')).toBe(franc(-80));
    // The informational line is not a deduction: no minus, nothing bold, and a badge that says it counts in nothing.
    const borne = rows.find((row) => row.getAttribute('data-type') === 'ChannelFeeBorneByAgency') as HTMLElement;
    expect(borne).toHaveAttribute('data-informational', 'true');
    expect(amountOf('ChannelFeeBorneByAgency')).toBe(franc(67.5));
    expect(within(borne).getByTestId('statement-line-amount')).toHaveClass('text-foreground/70');
    expect(within(rows[0]).getByTestId('statement-line-amount')).not.toHaveClass('text-foreground/70');
    expect(borne).toHaveTextContent(i18n.t('ownerAccounting.line.informational'));
    expect(borne).toHaveTextContent(i18n.t('ownerAccounting.line.type.ChannelFeeBorneByAgency'));
    // Its one line under the name does not say «-135,00» either: the source is written as the commission, a positive figure.
    expect(plain(borne.textContent)).toContain(franc(135));
    expect(plain(borne.textContent)).not.toMatch(/-\s*(135|67)/);
    // The other rows do not carry the badge.
    for (const row of rows.filter((candidate) => candidate !== borne)) expect(row).not.toHaveAttribute('data-informational');

    // What counts in the table adds up to the closing of the version, the informational line apart: the page and the server say the same.
    const counted = LINES.filter((candidate) => !isInformational(candidate)).reduce((sum, candidate) => sum + Math.round(candidate.amount * 100), 0);
    expect(counted).toBe(Math.round(VERSION.closingBalance * 100));
  });

  it('StatementDetail_TheDrawerOfTheInformationalLine_IsNotADebit_AndSaysTheCommissionIsTheAgencys', async () => {
    renderStatement();
    const table = await screen.findByTestId('statement-lines');
    const borne = within(table)
      .getAllByTestId('statement-line')
      .find((row) => row.getAttribute('data-type') === 'ChannelFeeBorneByAgency') as HTMLElement;

    fireEvent.click(within(borne).getByTestId('statement-line-explain'));

    const drawer = await screen.findByTestId('ledger-line-drawer');
    expect(plain(within(drawer).getByTestId('line-amount').textContent)).toBe(franc(67.5));
    expect(within(drawer).getByTestId('line-informational')).toHaveTextContent(i18n.t('ownerAccounting.line.informational'));
    // Neither a credit nor a debit of the owner, and the steps say what the figures are: the commission, not an amount of the statement.
    expect(drawer).not.toHaveTextContent(i18n.t('ownerAccounting.line.debit'));
    expect(drawer).not.toHaveTextContent(i18n.t('ownerAccounting.line.credit'));
    expect(drawer).toHaveTextContent(i18n.t('ownerAccounting.line.steps.informationalResult'));
    expect(drawer).not.toHaveTextContent(i18n.t('ownerAccounting.line.steps.result'));
    expect(within(drawer).getByTestId('line-steps').textContent).not.toMatch(/-\s*(135|67)/);
  });

  it('StatementDetail_TheLinesAddedSinceThePreviousVersion_NameTheInformationalLineAsTheCommission_NeverWithAMinus', async () => {
    // This version replaces one made BEFORE the rule (the commission was deducted: channel fees -67.50, closing 198.73) and was cut after it: the commission the agency bears was posted after the
    // cut-off of the previous version, so the list of what is new in this one names it. It is written as the rest of the page writes it, the commission as a positive figure: nothing is deducted.
    const previous = version({
      id: OLD_VERSION_ID,
      version: 1,
      status: 'Superseded',
      currency: 'CHF',
      cutoffAt: '2025-01-20T08:00:00Z',
      openingBalance: 0,
      revenue: 450,
      channelFees: -67.5,
      commission: -103.77,
      charges: -80,
      closingBalance: 198.73,
      supersedesVersionId: null,
      supersededByVersionId: VERSION_ID,
    });
    const current = { ...VERSION, supersedesVersionId: OLD_VERSION_ID };
    // The lines the previous version already held were posted before its cut-off; the commission, after it.
    const olderLine = (candidate: OwnerLedgerEntry): OwnerLedgerEntry => ({ ...candidate, postedAt: '2025-01-10T08:00:00Z' });
    api.listVersions.mockResolvedValue([current, previous]);
    api.getVersion.mockResolvedValue({ version: current, entries: [olderLine(REVENUE), olderLine(COMMISSION), olderLine(VAT), olderLine(CHARGE), { ...BORNE, postedAt: '2025-02-01T08:00:00Z' }] });
    renderStatement();

    const changes = await screen.findByTestId('statement-changes');
    // The only line that is new is the commission, and the list writes it with the commission as a positive figure, as the table, the drawer and the groups do.
    const type = i18n.t('ownerAccounting.line.type.ChannelFeeBorneByAgency');
    const added = await within(changes).findByText((content) => content.startsWith(type));
    expect(plain(added.textContent)).toBe(i18n.t('ownerAccounting.changes.addedLine', { type, amount: franc(67.5) }));
    expect(plain(added.textContent)).not.toMatch(/-\s*67,50/);
    expect(within(changes).queryByText((content) => content.startsWith(i18n.t('ownerAccounting.line.type.BookingRevenue')))).toBeNull();
    // The figures that moved are the stored ones of the two versions (the channel fees from -67.50 to 0, the closing from 198.73 to 266.23): nothing is worked out from the lines.
    const moved = within(changes).getAllByTestId('statement-change-figure').map((figure) => plain(figure.textContent));
    expect(moved).toHaveLength(2);
    expect(moved.some((text) => text.includes(franc(198.73)) && text.includes(franc(266.23)))).toBe(true);
  });

  it('StatementDetail_AnOlderServer_WithNoInformationalMember_ShowsTheLinesAndTheTotalsAsToday', async () => {
    // A server that does not know the rule: a channel fee the owner is charged, in the totals as it always was (the closing 198.73).
    const fee = line(5, { type: 'ChannelFee', amount: -67.5, sourceAmount: -135, originalAmount: -67.5, sharePercent: 50, recognitionDate: '2025-01-14' });
    api.getVersion.mockResolvedValue({ version: { ...VERSION, channelFees: -67.5, closingBalance: 198.73 }, entries: [REVENUE, COMMISSION, VAT, CHARGE, fee] });
    renderStatement();

    const groups = await screen.findByTestId('statement-groups');
    const cell = (key: string) => plain(within(groups).getByTestId(`statement-group-${key}`).textContent);
    expect(cell('channelFees')).toContain(franc(-67.5));
    expect(cell('period')).toContain(franc(198.73));
    expect(within(groups).queryByTestId('statement-group-channelFees-informational')).toBeNull();
    expect(within(screen.getByTestId('statement-lines')).getAllByTestId('statement-line').some((row) => row.hasAttribute('data-informational'))).toBe(false);
  });

  it('StatementDetail_TheTextsOfTheInformationalLine_AreInBothLanguages', async () => {
    await i18n.changeLanguage('en');
    renderStatement();

    const groups = await screen.findByTestId('statement-groups');
    const informational = within(groups).getByTestId('statement-group-channelFees-informational');
    expect(informational).toHaveTextContent('Portal commission paid by the agency, not charged to the owner');
    expect(plain(informational.textContent)).toContain(franc(67.5, 'en-GB'));
    expect(informational).toHaveTextContent('1 line for information only, outside the total');
  });
});

describe('the groups of a statement keep a line for information only apart (money rule, in cents)', () => {
  const closing = { openingBalance: 0, closingBalance: 266.23 };

  it('statementGroupsOf_AnInformationalLine_IsInItsGroupAsAPositiveFigure_AndInNoAmountNoCountAndNoPeriod', () => {
    const grouped = statementGroupsOf(closing, LINES);

    const fees = grouped.groups.find((group) => group.section === 'channelFees');
    expect(fees).toMatchObject({ amount: 0, count: 0, informational: { amount: 67.5, count: 1 } });
    expect(grouped.groups.find((group) => group.section === 'commission')).toMatchObject({ amount: -103.77, count: 2, informational: { amount: 0, count: 0 } });
    expect(grouped.period).toBe(266.23);
    expect(grouped.closing).toBe(266.23);
    // Without the rule (the line counted, as the screen did before it) the period would be 198.73: the difference is exactly the line.
    expect(Math.round((266.23 - 198.73) * 100)).toBe(6750);
  });

  it('statementGroupsOf_AnInformationalLineAndItsReversal_AreCountedAsTwoLinesThatCancel_AndStayOutOfTheTotals', () => {
    const reversal = line(6, { type: 'ChannelFeeBorneByAgency', amount: 67.5, sourceAmount: 135, originalAmount: 67.5, reversesEntryId: BORNE.id, informational: true });

    const grouped = statementGroupsOf(closing, [...LINES, reversal]);

    expect(grouped.groups.find((group) => group.section === 'channelFees')).toMatchObject({ amount: 0, count: 0, informational: { amount: 0, count: 2 } });
    expect(grouped.period).toBe(266.23);
  });

  it('statementGroupsOf_ALineTheServerSaysIsInformational_WhateverItsType_IsNeverInTheTotal_AndNeverDropped', () => {
    // A type this client has never heard of, flagged by the server: it is shown (in «other») and still out of the total.
    const unknown = line(6, { type: 'SomethingNew' as OwnerLedgerEntry['type'], amount: -10, informational: true });

    const grouped = statementGroupsOf(closing, [...LINES, unknown]);

    expect(grouped.groups.find((group) => group.section === 'other')).toMatchObject({ amount: 0, count: 0, informational: { amount: 10, count: 1 } });
    expect(grouped.period).toBe(266.23);
    // The same line without the flag is a line like the others (the server may be newer: an unknown line is counted, never dropped).
    const counted = statementGroupsOf(closing, [...LINES, { ...unknown, informational: undefined }]);
    expect(counted.groups.find((group) => group.section === 'other')).toMatchObject({ amount: -10, count: 1 });
    expect(counted.period).toBe(256.23);
  });

  it('statementGroupsOf_TheSumIsMadeInCents_NeverAsFloats', () => {
    const cents = [0.1, 0.2].map((amount, index) => line(index + 1, { type: 'OwnerCharge', amount, sourceAmount: amount, originalAmount: amount }));

    expect(statementGroupsOf(closing, cents).groups.find((group) => group.section === 'recharges')?.amount).toBe(0.3);
  });

  it('shownAmount_OnlyAnInformationalLineIsFlipped_AndAZeroNeverHasASign', () => {
    expect(shownAmount(BORNE, BORNE.amount)).toBe(67.5);
    expect(shownAmount(BORNE, 0)).toBe(0);
    expect(Object.is(shownAmount(BORNE, 0), 0)).toBe(true);
    expect(shownAmount(COMMISSION, COMMISSION.amount)).toBe(-90);
    // The type alone says it too, whatever the member of the server.
    expect(isInformational({ type: 'ChannelFeeBorneByAgency' })).toBe(true);
    expect(isInformational({ type: 'ChannelFee' })).toBe(false);
  });
});
