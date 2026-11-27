import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { OwnerInvoicePanel } from '@/features/owner-accounting/components/owner-invoice-panel';
import { OWNER_ID, version } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import type { OwnerInvoiceListItem } from '@/types';
import { OwnerInvoicesPage } from '../owner-invoices-page';
import { issuedItem, listItem } from './owner-invoice-fixtures';

const api = vi.hoisted(() => ({ list: vi.fn(), createDraft: vi.fn(), issue: vi.fn(), downloadPdf: vi.fn() }));
const owners = vi.hoisted(() => ({ listOwners: vi.fn() }));
const files = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/api/owner-invoices.api', () => ({ ownerInvoicesApi: api }));
vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: owners }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: files.save }));
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
/** Intl writes a no-break space between a figure and its currency: the page text is compared with plain spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));

function renderList(path = '/app/account/owner-invoices') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: [path] }, createElement(Routes, null, createElement(Route, { path: '/app/account/owner-invoices', element: createElement(OwnerInvoicesPage) }))),
    ),
  );
}

const CHF_ID = 'ab000000-0000-4000-8000-0000000000c1';
const EUR_ID = 'ab000000-0000-4000-8000-0000000000e1';
const NONE_ID = 'ab000000-0000-4000-8000-0000000000f1';

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  owners.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.downloadPdf.mockResolvedValue({ blob: new Blob(['%PDF']), contentDisposition: null });
});

afterEach(() => cleanup());

describe('the invoices to the owners are written in their own currency (E13/F02/US01/T03)', () => {
  it('OwnerInvoiceList_EveryInvoiceShowsItsTotalAndWhatIsToPayInItsOwnCurrency_NeverAssumedEuro', async () => {
    const invoices: OwnerInvoiceListItem[] = [
      issuedItem({ id: CHF_ID, number: 'FPM-2025-0001', total: 1081, currency: 'CHF', payment: { state: 'to_pay', amountDue: 81 } }),
      issuedItem({ id: EUR_ID, number: 'FPM-2025-0002', total: 1220, currency: 'EUR', payment: { state: 'offset', amountDue: 0 } }),
      // A draft that comes with no currency: written without a symbol, and the page says why.
      listItem({ id: NONE_ID, total: 10, currency: '' }),
    ];
    api.list.mockResolvedValue(invoices);
    renderList();

    const rows = await screen.findAllByTestId('owner-invoice-row');
    const byId = (id: string) => rows.find((row) => row.getAttribute('data-invoice') === id) as HTMLElement;
    const totalOf = (id: string) => plain(within(byId(id)).getByTestId('owner-invoice-row-total').textContent ?? '');

    expect(totalOf(CHF_ID)).toBe(money(1081, 'CHF'));
    expect(totalOf(EUR_ID)).toBe(money(1220, 'EUR'));
    // What the owner has to pay is in the currency of the invoice too.
    expect(plain(within(byId(CHF_ID)).getByTestId('invoice-settlement').textContent ?? '')).toContain(money(81, 'CHF'));
    expect(within(byId(EUR_ID)).getByTestId('invoice-settlement')).toHaveTextContent(text('ownerInvoice.settlement.offset'));
    expect(byId(CHF_ID).textContent).not.toContain('€');
    expect(byId(EUR_ID).textContent).not.toContain('CHF');
    // No currency, no symbol, and a sentence that says it.
    expect(totalOf(NONE_ID)).toBe(plain(new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(10)));
    expect(screen.getByTestId('owner-invoices-currency-missing')).toHaveTextContent(text('ownerInvoice.currencyMissing'));
  });

  it('OwnerInvoiceList_TheAddressIsTheFilter_AndAPdfIsOnlyForAnIssuedInvoice', async () => {
    api.list.mockResolvedValue([issuedItem({ id: CHF_ID }), listItem({ id: NONE_ID })]);
    renderList(`/app/account/owner-invoices?period=2025-01&owner=${OWNER_ID}`);

    await screen.findAllByTestId('owner-invoice-row');
    // The month and the owner of the address are what the list was asked for, and what the filters show.
    expect(api.list).toHaveBeenCalledWith({ period: '2025-01', ownerId: OWNER_ID });
    expect(screen.getByTestId('owner-invoices-filter-period')).toHaveValue('2025-01');
    expect(screen.getByTestId('owner-invoices-filter-owner')).toHaveValue(OWNER_ID);

    const rows = screen.getAllByTestId('owner-invoice-row');
    expect(within(rows[0] as HTMLElement).getByTestId('owner-invoice-row-pdf')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByTestId('owner-invoice-row-pdf')).toBeNull();
    const pdf = within(rows[0] as HTMLElement).getByTestId('owner-invoice-row-pdf');
    await waitFor(() => expect(pdf).toBeEnabled());
    fireEvent.click(pdf);
    await waitFor(() => expect(api.downloadPdf).toHaveBeenCalledWith(CHF_ID));
    await waitFor(() => expect(files.save).toHaveBeenCalledTimes(1));
  });

  it('OwnerInvoicePanel_AnIssuedChfInvoiceToPay_ShowsTheTotalsAndTheAmountDueInChf', async () => {
    api.list.mockResolvedValue([issuedItem({ total: 1239.1, taxableBase: 1150, vatAmount: 89.1, payment: { state: 'to_pay', amountDue: 89.1 } })]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    const { container } = render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(OwnerInvoicePanel, { version: version({ status: 'Approved', currency: 'CHF' }) }))));

    const issued = await screen.findByTestId('owner-invoice-issued');
    expect(plain(within(issued).getByTestId('owner-invoice-total').textContent ?? '')).toBe(money(1239.1, 'CHF'));
    expect(plain(within(issued).getByTestId('owner-invoice-payment').textContent ?? '')).toContain(money(89.1, 'CHF'));
    // The PDF of a Swiss invoice that leaves an amount to pay carries the QR-bill, said in words; nothing is in euro.
    expect(issued).toHaveTextContent(text('ownerInvoice.settlement.qrBill'));
    expect(container.textContent).not.toContain('€');
  });
});
