import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
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
const files = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: files.save }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Casa Lago' }] }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

/** Intl writes a no-break space between a figure and its currency: the page text is compared with plain spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));
/** A promise settled from outside: the request that is on its way. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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

/** A Swiss statement, made of lines in francs: 100 opening, 1000 of stays, 100 kept by the channels, a commission of 150 and its VAT of 12.15, 50 of recharges. */
const FRANCS = { statementCurrency: 'CHF', originalCurrency: 'CHF' } as const;
const swissLines = () => [
  entry({ id: 'e0000000-0000-4000-8000-000000000001', type: 'BookingRevenue', amount: 1000, ...FRANCS }),
  entry({ id: 'e0000000-0000-4000-8000-000000000002', type: 'ChannelFee', amount: -100, ...FRANCS }),
  entry({ id: 'e0000000-0000-4000-8000-000000000003', type: 'AgencyCommission', source: 'Payment', amount: -150, ...FRANCS }),
  entry({ id: 'e0000000-0000-4000-8000-000000000004', type: 'AgencyVat', source: 'OwnerInvoice', amount: -12.15, ...FRANCS }),
  entry({ id: 'e0000000-0000-4000-8000-000000000005', type: 'OwnerCharge', source: 'MandateFlatFee', amount: -50, ...FRANCS }),
];
const swissVersion = () =>
  version({ currency: 'CHF', status: 'Approved', publishedAt: null, publishedSha256: null, openingBalance: 100, revenue: 1000, channelFees: -100, commission: -162.15, charges: -50, closingBalance: 787.85, entryCount: 5 });

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getReadiness.mockResolvedValue(readiness([ownerReadiness({ latestStatus: 'Approved' })]));
  api.listVersions.mockResolvedValue([swissVersion()]);
  api.getVersion.mockResolvedValue({ version: swissVersion(), entries: swissLines() });
  api.listExternalDocuments.mockResolvedValue([]);
  api.listPayouts.mockResolvedValue([]);
  api.downloadVersionPdf.mockResolvedValue({ blob: new Blob(['%PDF']), contentDisposition: null });
  api.downloadVersionCsv.mockResolvedValue({ blob: new Blob(['a;b']), contentDisposition: null });
});

afterEach(() => cleanup());

describe('the statement of a version, grouped as its PDF is (E13/F02/US01/T02)', () => {
  it('StatementDetail_ACHFVersion_ShowsEveryAmountInCHF_AndNeverInEuro', async () => {
    const { container } = renderStatement();
    const groups = await screen.findByTestId('statement-groups');

    // The parts of the PDF, in the currency of the version: the VAT of the invoice is counted with the commission, as the PDF counts it.
    const cell = (key: string) => plain(within(groups).getByTestId(`statement-group-${key}`).textContent ?? '');
    expect(cell('stays')).toContain(money(1000, 'CHF'));
    expect(cell('channelFees')).toContain(money(-100, 'CHF'));
    expect(cell('commission')).toContain(money(-162.15, 'CHF'));
    expect(cell('recharges')).toContain(money(-50, 'CHF'));
    // The net is what the version stores, and the total of the period adds the parts up to the cent.
    expect(cell('period')).toContain(money(687.85, 'CHF'));
    expect(cell('opening')).toContain(money(100, 'CHF'));
    expect(cell('net')).toContain(money(787.85, 'CHF'));
    // Nothing on the page is in euro: not the summary, not the figures, not the lines.
    expect(container.textContent).not.toContain('€');
    expect(plain(screen.getByTestId('statement-lines').textContent ?? '')).toContain(money(1000, 'CHF'));
    // The tourist tax is in a box of its own that says it is not part of the net.
    expect(screen.getByTestId('statement-tourist-tax')).toHaveTextContent(i18n.t('ownerAccounting.summary.touristTax.body'));
  });

  it('StatementDetail_AEuroVersion_ShowsEuro', async () => {
    api.getVersion.mockResolvedValue({ version: version(), entries: [entry()] });
    api.listVersions.mockResolvedValue([version()]);
    renderStatement();
    const groups = await screen.findByTestId('statement-groups');

    expect(plain(within(groups).getByTestId('statement-group-stays').textContent ?? '')).toContain(money(1000, 'EUR'));
    expect(groups.textContent).not.toContain('CHF');
  });

  it('StatementDetail_TheFilesAreTheOnesOfTheVersion_AndOneWaitsForTheOther', async () => {
    const pending = deferred<{ blob: Blob; contentDisposition: string | null }>();
    api.downloadVersionPdf.mockReturnValue(pending.promise);
    renderStatement();
    const groups = await screen.findByTestId('statement-groups');
    const pdf = within(groups).getByTestId('statement-download-pdf');
    const csv = within(groups).getByTestId('statement-download-csv');

    fireEvent.click(pdf);
    await waitFor(() => expect(api.downloadVersionPdf).toHaveBeenCalledWith(VERSION_ID, 'it'));
    // While the PDF is made the other file waits, and the pressed button says it works.
    await waitFor(() => expect(csv).toBeDisabled());
    expect(pdf).toHaveAttribute('aria-busy', 'true');
    pending.resolve({ blob: new Blob(['%PDF']), contentDisposition: null });
    await waitFor(() => expect(files.save).toHaveBeenCalledTimes(1));
    expect(files.save.mock.calls[0]?.[1]).toBe('rendiconto-2025-01-v2.pdf');

    await waitFor(() => expect(csv).toBeEnabled());
    fireEvent.click(csv);
    await waitFor(() => expect(api.downloadVersionCsv).toHaveBeenCalledWith(VERSION_ID, 'it'));
    await waitFor(() => expect(files.save).toHaveBeenCalledTimes(2));
    expect(files.save.mock.calls[1]?.[1]).toBe('rendiconto-2025-01-v2.csv');
  });
});
