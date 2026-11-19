import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { formatMoney, touristTaxTotals } from '@/features/owner-portal/owner-statement-model';
import type { OwnerPortalTouristTax } from '@/types';
import { StatementDetailPage } from '../statement-detail-page';
import { OWNER_ID, VERSION_ID, entry, ownerReadiness, readiness, version } from './owner-accounting-fixtures';

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

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
/** Intl writes a no-break space between a figure and its currency: the text of the page is compared with plain spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');
/** What the server says to a refusal: the status and the problem with its code. */
const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });

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

/** The tourist tax box of a Ticino statement: two stays collected in francs and one in euro, as `touristTax` of the version carries them (the rows of the owner portal). */
const BOX: OwnerPortalTouristTax[] = [
  { property: 'Casa Lago', checkIn: '2025-01-10', checkOut: '2025-01-14', channel: 'Airbnb', bookingCode: 'BK-1001', currency: 'CHF', amount: 8 },
  { property: 'Casa Lago', checkIn: '2025-01-20', checkOut: '2025-01-22', channel: null, bookingCode: 'BK-1002', currency: 'CHF', amount: 4.1 },
  { property: 'Casa Como', checkIn: '2025-01-25', checkOut: '2025-01-27', channel: 'BookingCom', bookingCode: 'BK-2002', currency: 'EUR', amount: 5 },
];

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ latestStatus: 'Approved' })]));
  api.listVersions.mockResolvedValue([version({ status: 'Approved', publishedAt: null, publishedSha256: null })]);
  api.getVersion.mockResolvedValue({ version: version({ status: 'Approved', publishedAt: null, publishedSha256: null }), entries: [entry()], touristTax: BOX });
  api.listExternalDocuments.mockResolvedValue([]);
  api.listPayouts.mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('the tourist tax box of the statement shows the amounts the server carries (FIX/FE-OWNERS-ADOPT, E13/F02/US01/T02)', () => {
  // Money rule: the box of the agency shows every stay with the amount and the currency it was collected in, as the owner portal does for the same version, and sums them for each currency (never francs and
  // euros in one sum). It stays outside the net: the figures of the statement are what they were.
  it('StatementDetail_TheTouristTaxBox_ShowsEveryStayWithItsAmountAndCurrency_AndASumForEachCurrency', async () => {
    renderStatement();

    const box = await screen.findByTestId('statement-tourist-tax');
    const rows = within(box).getAllByTestId('owner-tourist-tax-row');
    expect(rows).toHaveLength(3);
    // Each row is written the way the portal writes it (`formatMoney`), in the currency of the stay.
    BOX.forEach((stay, index) => {
      expect(plain(rows[index].textContent ?? '')).toContain(plain(formatMoney(stay.amount, stay.currency, 'it')));
    });
    expect(rows[0].textContent).toMatch(/8,00\s*CHF/);
    expect(rows[1].textContent).toMatch(/4,10\s*CHF/);
    expect(rows[2].textContent).toMatch(/5,00\s*€/);
    expect(rows[0].textContent).toContain('Casa Lago');
    expect(rows[0].textContent).toContain('BK-1001');
    // The sums are the ones of the portal (worked out in cents, one for each currency): 12,10 francs and 5 euros.
    const sums = within(box).getAllByTestId('owner-tourist-tax-total').map((total) => total.textContent ?? '');
    expect(sums).toHaveLength(2);
    expect(sums[0]).toMatch(/^12,10\s*CHF$/);
    expect(sums[1]).toMatch(/^5,00\s*€$/);
    expect(touristTaxTotals(BOX)).toEqual([
      { currency: 'CHF', total: 12.1 },
      { currency: 'EUR', total: 5 },
    ]);
    // The text of the box is there, and the box says that it is for information (it keeps its words).
    expect(box).toHaveTextContent(text('ownerAccounting.summary.touristTax.body'));
    expect(within(box).queryByTestId('owner-tourist-tax-currency-missing')).toBeNull();
  });

  it('StatementDetail_TheTouristTaxBox_IsOutsideTheNet_TheFiguresOfTheStatementAreWhatTheyWere', async () => {
    renderStatement();

    const groups = await screen.findByTestId('statement-groups');
    const cell = (key: string) => plain(within(groups).getByTestId(`statement-group-${key}`).textContent ?? '');
    const euro = (amount: number) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount));
    // The stay of the lines is 1000, the period is the lines added up and the net the closing balance the version stores (800): no figure of the box (8, 4,10, 5, or their sums) is added to them or
    // taken from them, and none is in the table of the parts.
    expect(cell('stays')).toContain(euro(1000));
    expect(cell('period')).toContain(euro(1000));
    expect(cell('net')).toContain(euro(800));
    expect(groups.querySelector('table')?.textContent).not.toMatch(/CHF|12,10/);
  });

  it('StatementDetail_ARowWithNoCurrency_HasNoSymbol_AndTheBoxSaysSo', async () => {
    api.getVersion.mockResolvedValue({
      version: version({ status: 'Approved', publishedAt: null, publishedSha256: null }),
      entries: [entry()],
      touristTax: [{ property: 'Casa Lago', checkIn: '2025-01-10', checkOut: '2025-01-14', channel: 'Airbnb', bookingCode: 'BK-1001', currency: '', amount: 8 }],
    });
    renderStatement();

    const box = await screen.findByTestId('statement-tourist-tax');
    const row = within(box).getByTestId('owner-tourist-tax-row');
    // The figure is there, plain: no euro and no franc invented for it, and the sentence says why.
    expect(row.textContent).toMatch(/8,00$/);
    expect(row.textContent).not.toMatch(/€|CHF|EUR/);
    expect(within(box).getByTestId('owner-tourist-tax-currency-missing')).toHaveTextContent(text('ownerPortal.accounting.touristTax.currencyMissing'));
  });

  it('StatementDetail_NoStayWithATouristTaxTheAgencyCollects_SaysSo_AndAServerWithoutTheRowsSaysNothingOfThem', async () => {
    api.getVersion.mockResolvedValue({ version: version({ status: 'Approved', publishedAt: null, publishedSha256: null }), entries: [entry()], touristTax: [] });
    const first = renderStatement();
    const box = await screen.findByTestId('statement-tourist-tax');
    expect(within(box).getByTestId('owner-tourist-tax-empty')).toHaveTextContent(text('ownerPortal.accounting.touristTax.empty'));
    first.unmount();

    // A server that does not send the box yet: the text of the box stays and nothing is said of its amounts (an absent list is not «none collected»).
    api.getVersion.mockResolvedValue({ version: version({ status: 'Approved', publishedAt: null, publishedSha256: null }), entries: [entry()] });
    renderStatement();
    const older = await screen.findByTestId('statement-tourist-tax');
    expect(older).toHaveTextContent(text('ownerAccounting.summary.touristTax.body'));
    expect(within(older).queryByTestId('owner-tourist-tax-empty')).toBeNull();
    expect(within(older).queryAllByTestId('owner-tourist-tax-row')).toHaveLength(0);
  });
});

describe('the statement a server refuses to show (409 owner_ledger_immutable)', () => {
  it('StatementDetail_ALedgerThatNoLongerGivesTheTotals_IsToldInItsOwnWords_NotAsAFailureToLoad', async () => {
    api.getVersion.mockRejectedValue(problem(409, 'owner_ledger_immutable'));
    renderStatement();

    const refused = await screen.findByTestId('statement-immutable');
    expect(refused).toHaveAttribute('role', 'alert');
    expect(refused).toHaveTextContent(text('ownerAccounting.statement.immutableTitle'));
    expect(refused).toHaveTextContent(text('ownerAccounting.statement.immutableBody'));
    // It is not the failure of a connection: no «Riprova», no generic error of the page, and nothing of the statement is drawn.
    expect(screen.queryByTestId('owner-accounting-error')).toBeNull();
    expect(screen.queryByRole('button', { name: text('shared.errorState.retry') })).toBeNull();
    expect(screen.queryByTestId('statement-groups')).toBeNull();
  });

  it('StatementDetail_AnotherConflictOrAMissingVersion_StaysWhatItWas', async () => {
    api.getVersion.mockRejectedValue(problem(409, 'owner_period_closed'));
    const first = renderStatement();
    expect(await screen.findByTestId('owner-accounting-error')).toHaveTextContent(text('ownerAccounting.statement.loadError'));
    expect(screen.queryByTestId('statement-immutable')).toBeNull();
    first.unmount();

    api.getVersion.mockRejectedValue(problem(404, 'owner_statement_version_not_found'));
    renderStatement();
    expect(await screen.findByTestId('statement-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('statement-immutable')).toBeNull();
  });
});
