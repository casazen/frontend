import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as api from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { BookingFiscalDocumentCard } from '@/features/bookings/components/booking-fiscal-document-card';
import { formatMoney } from '@/features/fiscal/fiscal-format';
import i18n from '@/i18n/config';
import type { FiscalDocumentEntry } from '@/types';
import { FiscalDocumentsPage } from '../fiscal-documents-page';
import { bookingDocument, document, draft, swissDetail } from './document-fixtures';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, listDocuments: vi.fn(), getDocumentsContext: vi.fn(), getDocument: vi.fn(), listBookingDocuments: vi.fn() };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => env.permissions.has(permission) }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
}));

const WRITE = ['payment.read', 'property.read', 'booking.read', 'payment.write'];
const CHF_ID = 'd0000000-0000-4000-8000-0000000000c1';

const page = (items: FiscalDocumentEntry[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });
const plain = (text: string | null | undefined) => (text ?? '').replace(/\s/g, ' ');

function renderInProviders(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, element)));
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.permissions = new Set(WRITE);
  env.flags = { fiscalDocumentIssuance: true };
  await i18n.changeLanguage('it');
  // The list the page reads is a Swiss draft in francs; the newest issued documents (what the numbering reads) are the invoices 2026/3 and 2026/4 in the series «2026».
  vi.mocked(api.listDocuments).mockImplementation(async (criteria) =>
    criteria.status === 'Issued'
      ? page([
          document({ id: 'd-4', series: '2026', sequenceNumber: 4, number: '2026/4', currency: 'CHF' }),
          document({ id: 'd-3', series: '2026', sequenceNumber: 3, number: '2026/3', currency: 'CHF' }),
        ])
      : page([draft({ id: CHF_ID, currency: 'CHF', total: 736 })]),
  );
  vi.mocked(api.getDocumentsContext).mockResolvedValue({ mode: 'CasaZen', casazenIssuanceEnabled: true, sdiProviderConfigured: false, guestDocumentSeries: '2026' });
  vi.mocked(api.getDocument).mockResolvedValue(swissDetail({ id: CHF_ID, status: 'Draft', number: null, series: null, sequenceNumber: null, issueDate: null }));
  vi.mocked(api.listBookingDocuments).mockResolvedValue([bookingDocument()]);
});

/** Whatever is drawn for a document in francs says francs and never a euro: no sign, no code, no icon of one. */
function expectFrancsOnly(text: string | null | undefined) {
  expect(text).toContain('CHF');
  expect(text).not.toContain('€');
  expect(text).not.toMatch(/\bEUR\b/);
}

describe('a document in francs is shown in francs wherever it is drawn (money rule)', () => {
  it('FiscalDocumentsPage_ACHFDocument_ShowsCHFInTheListAndInEveryFigureOfTheDetail', async () => {
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    expectFrancsOnly(plain(within(row).getByTestId('fiscal-document-total').textContent));

    fireEvent.click(within(row).getByTestId('fiscal-document-open'));
    const drawer = await screen.findByTestId('fiscal-document-drawer');
    expectFrancsOnly(plain((await within(drawer).findByTestId('fiscal-document-detail-total')).textContent));
    // Every line, every total and every row of the VAT summary is in the currency of the document.
    const figures = [
      ...within(drawer).getAllByTestId('fiscal-document-line-amount'),
      ...within(drawer).getAllByTestId('fiscal-document-vat-row'),
      within(drawer).getByTestId('fiscal-document-taxable-base'),
      within(drawer).getByTestId('fiscal-document-vat-total'),
      within(drawer).getByTestId('fiscal-document-total-line'),
    ];
    expect(figures.length).toBeGreaterThan(8);
    for (const figure of figures) expectFrancsOnly(plain(figure.textContent));
    // The whole detail: not a euro anywhere (the icon of «pagato» is a check, not a euro sign).
    expect(drawer.textContent).not.toContain('€');
  });

  it('FiscalDocumentsPage_TheConfirmationOfTheIssueOfACHFDraft_SaysTheTotalInFrancsWithTheSeriesAndTheNumberExpected', async () => {
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(row).getByTestId('fiscal-document-issue'));

    const summary = await screen.findByTestId('fiscal-document-issue-summary');
    expectFrancsOnly(plain(within(summary).getByTestId('fiscal-document-issue-total').textContent));
    expect(plain(within(summary).getByTestId('fiscal-document-issue-total').textContent)).toBe('736,00 CHF');
    expect(within(summary).getByTestId('fiscal-document-issue-series')).toHaveTextContent('2026');
    // The next number is the one after the highest of the series, and it says it is an expectation.
    expect(await within(summary).findByText(i18n.t('fiscalDocuments.issue.numberExpected', { number: '2026/5' }))).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-document-issue-last')).toHaveTextContent('2026/4');
    // The number comes from the documents the person sees, which may be only some of them: the confirmation says it is an indication.
    expect(screen.getByTestId('fiscal-document-issue-note')).toHaveTextContent(i18n.t('fiscalDocuments.issue.numberNote'));
  });

  it('FiscalDocumentsPage_TheConfirmationOfTheIssueOfACreditNoteDraft_TellsNoSeriesOfTodayAndNoNumberAndReadsNone', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([draft({ id: CHF_ID, kind: 'CreditNote', currency: 'CHF', total: 100 })]));
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(row).getByTestId('fiscal-document-issue'));

    // A credit note is issued in the series of the document it corrects, which may be another year's: no series of today and no number are told.
    const summary = await screen.findByTestId('fiscal-document-issue-summary');
    expect(within(summary).getByTestId('fiscal-document-issue-series')).toHaveTextContent(i18n.t('fiscalDocuments.issue.seriesOfOriginal'));
    expect(within(summary).getByTestId('fiscal-document-issue-number')).toHaveTextContent(i18n.t('fiscalDocuments.issue.numberUnknown'));
    expect(screen.queryByTestId('fiscal-document-issue-note')).not.toBeInTheDocument();
    expectFrancsOnly(plain(within(summary).getByTestId('fiscal-document-issue-total').textContent));
    // The issued documents are not even read for it.
    expect(api.listDocuments).not.toHaveBeenCalledWith({ status: 'Issued', source: 'CasaZen' }, 1, 100);
  });

  it('FiscalDocumentsPage_TheCreditNoteOfACHFInvoice_AsksForTheAmountInFrancs', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page([document({ currency: 'CHF', total: 736, number: '2026/5' })]));
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(row).getByTestId('fiscal-document-credit'));

    const dialog = await screen.findByTestId('fiscal-credit-note-dialog');
    expectFrancsOnly(plain(dialog.textContent));
    fireEvent.click(within(dialog).getByTestId('fiscal-credit-part'));
    expect(within(dialog).getByText(i18n.t('fiscalDocuments.credit.amount.label', { currency: 'CHF' }))).toBeInTheDocument();
  });

  it('BookingFiscalDocumentCard_ACHFDocument_ShowsItsTotalAndItsCollectionInFrancs', async () => {
    renderInProviders(createElement(BookingFiscalDocumentCard, { bookingId: 'b0000000-0000-4000-8000-000000000001' }));

    const card = await screen.findByTestId('booking-fiscal-document');
    expectFrancsOnly(plain((await within(card).findByTestId('booking-fiscal-document-total')).textContent));
    expect(card.textContent).not.toContain('€');
  });

  it('FormatMoney_ACurrency_IsAskedForAndNeverAssumedToBeTheEuro', () => {
    expect(plain(formatMoney(1234.5, 'it', 'CHF'))).toContain('CHF');
    expect(formatMoney(1234.5, 'it', 'CHF')).not.toContain('€');
    expect(plain(formatMoney(1234.5, 'it', 'EUR'))).toContain('€');
  });
});
