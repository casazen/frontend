import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { OwnerInvoicePanel } from '@/features/owner-accounting/components/owner-invoice-panel';
import { OWNER_ID, version } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import { OwnerInvoiceDrawer } from '../owner-invoice-drawer';
import { OwnerInvoicesPage } from '../owner-invoices-page';
import { INVOICE_ID, draft, issuedItem, listItem } from './owner-invoice-fixtures';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), createDraft: vi.fn(), issue: vi.fn(), downloadPdf: vi.fn() }));
const owners = vi.hoisted(() => ({ listOwners: vi.fn() }));
vi.mock('@/api/owner-invoices.api', () => ({ ownerInvoicesApi: api }));
vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: owners }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/hooks/use-feature-flags', async () => {
  const { DEFAULT_FEATURE_FLAGS: defaults } = await import('@/config/feature-flags');
  return { useFeatureFlags: () => ({ flags: { ...defaults, ownerInvoicing: true }, isLoading: false }) };
});
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const plain = (value: string) => value.replace(/\s/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));
const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });

const keepingClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const drawerOf = (client: QueryClient, invoiceId: string | null) =>
  createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(OwnerInvoiceDrawer, { invoiceId, onClose: vi.fn() })));

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  owners.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
});

afterEach(() => cleanup());

describe('an invoice to an owner is opened by its id, with its lines and its totals (FIX/FE-OWNERS-ADOPT, S016)', () => {
  it('OwnerInvoiceDrawer_ADraftReadByItsId_ShowsItsLinesAndItsTotalsInItsCurrency', async () => {
    api.get.mockResolvedValue(draft());
    render(drawerOf(keepingClient(), INVOICE_ID));

    const lines = await screen.findByTestId('owner-invoice-lines');
    expect(api.get).toHaveBeenCalledWith(INVOICE_ID);
    expect(within(lines).getAllByTestId('owner-invoice-line').map((row) => row.getAttribute('data-type'))).toEqual(['Commission', 'Recharge', 'AdvancedExpense']);
    expect(plain(within(lines).getByTestId('owner-invoice-total').textContent ?? '')).toBe(money(1239.1, 'CHF'));
    expect(plain(within(lines).getByTestId('owner-invoice-totals').textContent ?? '')).toContain(money(89.1, 'CHF'));
    const drawer = screen.getByTestId('owner-invoice-drawer');
    expect(within(drawer).getByRole('heading', { name: text('ownerInvoice.page.row.draft') })).toBeInTheDocument();
    expect(drawer).toHaveTextContent('Marta Rossi');
    expect(api.createDraft).not.toHaveBeenCalled();
    expect(api.issue).not.toHaveBeenCalled();
  });

  it('OwnerInvoiceDrawer_AnIssuedInvoice_SaysItsNumberAndItsDay_AndAnAmountWithNoCurrencyHasNoSymbol', async () => {
    api.get.mockResolvedValue(draft({ status: 'Issued', number: 'FPM-2025-0001', issueDate: '2025-02-05', currency: '' }));
    render(drawerOf(keepingClient(), INVOICE_ID));

    const lines = await screen.findByTestId('owner-invoice-lines');
    const drawer = screen.getByTestId('owner-invoice-drawer');
    expect(within(drawer).getByRole('heading', { name: text('ownerInvoice.page.row.number', { number: 'FPM-2025-0001' }) })).toBeInTheDocument();
    expect(within(drawer).getByText(text('ownerInvoice.status.Issued'))).toBeInTheDocument();
    expect(drawer.textContent).toMatch(/Emessa il\s.*2025/);
    expect(plain(within(lines).getByTestId('owner-invoice-total').textContent ?? '')).toBe(plain(new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1239.1)));
    expect(drawer.textContent).not.toMatch(/CHF|€/);
    expect(within(drawer).getByTestId('owner-invoice-detail-currency-missing')).toHaveTextContent(text('ownerInvoice.currencyMissing'));
  });

  it('OwnerInvoiceDrawer_AnInvoiceThatIsNoLongerThere_IsToldAsSuch_AndNeverDrawnFromWhatWasReadBefore', async () => {
    const client = keepingClient();
    api.get.mockResolvedValue(draft());
    const view = render(drawerOf(client, INVOICE_ID));
    await screen.findByTestId('owner-invoice-lines');

    view.rerender(drawerOf(client, null));
    await waitFor(() => expect(screen.queryByTestId('owner-invoice-drawer')).toBeNull());
    api.get.mockRejectedValue(problem(404, 'fiscal_document_not_found'));
    view.rerender(drawerOf(client, INVOICE_ID));

    const notFound = await screen.findByTestId('owner-invoice-detail-not-found');
    expect(notFound).toHaveTextContent(text('ownerInvoice.detail.notFound'));
    expect(screen.queryByTestId('owner-invoice-lines')).toBeNull();
    expect(screen.queryByTestId('owner-invoice-totals')).toBeNull();
  });

  it('OwnerInvoiceDrawer_ARefusedRead_SaysTheAccessIsNotThere_AndDrawsNothing', async () => {
    api.get.mockResolvedValue(null);
    render(drawerOf(keepingClient(), INVOICE_ID));

    const refused = await screen.findByTestId('owner-invoice-detail-forbidden');
    expect(refused).toHaveTextContent(text('ownerInvoice.detail.forbidden'));
    expect(screen.queryByTestId('owner-invoice-lines')).toBeNull();
    expect(screen.queryByTestId('owner-invoice-detail-not-found')).toBeNull();
  });

  it('OwnerInvoiceDrawer_AFailedRead_SaysSo_AndReadsAgainOnRequest', async () => {
    api.get.mockRejectedValueOnce(problem(500, 'boom')).mockResolvedValue(draft());
    render(drawerOf(keepingClient(), INVOICE_ID));

    const failed = await screen.findByTestId('owner-accounting-error');
    expect(failed).toHaveTextContent(text('ownerInvoice.panel.loadError'));
    expect(screen.queryByTestId('owner-invoice-lines')).toBeNull();
    fireEvent.click(within(failed).getByRole('button', { name: text('shared.errorState.retry') }));
    expect(await screen.findByTestId('owner-invoice-lines')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('OwnerInvoiceDrawer_Closed_ReadsNothing', () => {
    render(drawerOf(keepingClient(), null));

    expect(screen.queryByTestId('owner-invoice-drawer')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('where the app has the id of an invoice, it can be opened', () => {
  it('OwnerInvoicesPage_EveryRowOpensItsInvoiceByItsId', async () => {
    const OTHER_ID = 'ab000000-0000-4000-8000-0000000000c2';
    api.list.mockResolvedValue([listItem(), issuedItem({ id: OTHER_ID, number: 'FPM-2025-0002' })]);
    api.get.mockImplementation(async (id: string) => (id === OTHER_ID ? draft({ id: OTHER_ID, status: 'Issued', number: 'FPM-2025-0002', issueDate: '2025-02-05' }) : draft()));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, { initialEntries: ['/app/account/owner-invoices'] }, createElement(Routes, null, createElement(Route, { path: '/app/account/owner-invoices', element: createElement(OwnerInvoicesPage) }))),
      ),
    );

    const rows = await screen.findAllByTestId('owner-invoice-row');
    expect(api.get).not.toHaveBeenCalled();
    const open = within(rows[1] as HTMLElement).getByTestId('owner-invoice-row-open');
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);

    await screen.findByTestId('owner-invoice-lines');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith(OTHER_ID);
    expect(within(screen.getByTestId('owner-invoice-drawer')).getByRole('heading', { name: text('ownerInvoice.page.row.number', { number: 'FPM-2025-0002' }) })).toBeInTheDocument();
  });

  it('OwnerInvoicePanel_ADraftOfTheMonthAfterAReload_IsOpenedByItsId_WithoutMakingItAgain', async () => {
    api.list.mockResolvedValue([listItem()]);
    api.get.mockResolvedValue(draft());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(OwnerInvoicePanel, { version: version({ status: 'Approved', currency: 'CHF' }) }))));

    const open = await screen.findByTestId('owner-invoice-open');
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);

    const lines = await screen.findByTestId('owner-invoice-lines');
    expect(within(lines).getAllByTestId('owner-invoice-line')).toHaveLength(3);
    expect(api.get).toHaveBeenCalledWith(INVOICE_ID);
    expect(api.createDraft).not.toHaveBeenCalled();
  });
});
