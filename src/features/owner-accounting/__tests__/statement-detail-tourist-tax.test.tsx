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
const plain = (value: string) => value.replace(/\s/g, ' ');
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
  it('StatementDetail_TheTouristTaxBox_ShowsEveryStayWithItsAmountAndCurrency_AndASumForEachCurrency', async () => {
    renderStatement();

    const box = await screen.findByTestId('statement-tourist-tax');
    const rows = within(box).getAllByTestId('owner-tourist-tax-row');
    expect(rows).toHaveLength(3);
    BOX.forEach((stay, index) => {
      expect(plain(rows[index].textContent ?? '')).toContain(plain(formatMoney(stay.amount, stay.currency, 'it')));
    });
    expect(rows[0].textContent).toMatch(/8,00\s*CHF/);
    expect(rows[1].textContent).toMatch(/4,10\s*CHF/);
    expect(rows[2].textContent).toMatch(/5,00\s*€/);
    expect(rows[0].textContent).toContain('Casa Lago');
    expect(rows[0].textContent).toContain('BK-1001');
    const sums = within(box).getAllByTestId('owner-tourist-tax-total').map((total) => total.textContent ?? '');
    expect(sums).toHaveLength(2);
    expect(sums[0]).toMatch(/^12,10\s*CHF$/);
    expect(sums[1]).toMatch(/^5,00\s*€$/);
    expect(touristTaxTotals(BOX)).toEqual([
      { currency: 'CHF', total: 12.1 },
      { currency: 'EUR', total: 5 },
    ]);
    expect(box).toHaveTextContent(text('ownerAccounting.summary.touristTax.body'));
    expect(within(box).queryByTestId('owner-tourist-tax-currency-missing')).toBeNull();
  });

  it('StatementDetail_TheTouristTaxBox_IsOutsideTheNet_TheFiguresOfTheStatementAreWhatTheyWere', async () => {
    renderStatement();

    const groups = await screen.findByTestId('statement-groups');
    const cell = (key: string) => plain(within(groups).getByTestId(`statement-group-${key}`).textContent ?? '');
    const euro = (amount: number) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount));
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
