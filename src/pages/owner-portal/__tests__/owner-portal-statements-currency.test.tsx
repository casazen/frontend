import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { formatMoney, touristTaxTotals } from '@/features/owner-portal/owner-statement-model';
import { OWNER_PORTAL_KEY } from '@/queries/ownerPortal';
import { OwnerStatementDetail } from '../OwnerStatementDetail';
import { OwnerStatements } from '../OwnerStatements';
import { CHF_INVOICE, CHF_STATEMENT, EUR_INVOICE, EUR_STATEMENT, statementDetail } from './owner-statement-fixtures';

vi.mock('@/api/ownerPortal.api', () => ({
  ownerPortalApi: {
    listStatements: vi.fn(),
    getStatement: vi.fn(),
    listInvoices: vi.fn(),
    listDocuments: vi.fn(),
    listExternalDocuments: vi.fn(),
    listContacts: vi.fn(),
    downloadStatementPdf: vi.fn(),
    downloadInvoicePdf: vi.fn(),
  },
}));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn(), withJsonErrorBody: vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import { ownerPortalApi } from '@/api/ownerPortal.api';

const api = vi.mocked(ownerPortalApi);

/**
 * The money of the owner portal (E13/F02/US02/T01, NF-111, NF-115): every amount of a statement is written in the currency the data gives it (francs for a Ticino statement, euros for
 * one of Como), never in a currency the code assumes; an amount without a currency has no symbol and the page says so. The figures are distinct, so that a page that draws a wrong one is
 * found out.
 */

function refusal(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

function renderPortal(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portale-proprietari" element={<OwnerPortalShell />}>
            <Route path="contabilita" element={<OwnerStatements />} />
            <Route path="contabilita/:statementId" element={<OwnerStatementDetail />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.listStatements.mockResolvedValue([]);
  api.listInvoices.mockResolvedValue([]);
  api.listDocuments.mockResolvedValue({ documents: [], statements: [] });
  api.listExternalDocuments.mockResolvedValue([]);
  api.listContacts.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('the amounts of a statement are in the currency of the data (NF-115)', () => {
  it.each([
    ['it', /^1234,50\s*CHF$/, /^987,65\s*€$/],
    ['en', /^CHF\s*1,234\.50$/, /^€987\.65$/],
  ])('OwnerPortal_Statements_AChfStatementShowsChf_AnEurStatementShowsEur_%s', async (language, chfNet, eurNet) => {
    await i18n.changeLanguage(language);
    api.listStatements.mockResolvedValue([EUR_STATEMENT, CHF_STATEMENT]);
    renderPortal('/portale-proprietari/contabilita');

    const cards = await screen.findAllByTestId('owner-statement');
    expect(cards).toHaveLength(2);
    // The latest period first: the statement in francs, then the one in euros.
    const [francs, euros] = cards;
    expect(within(francs).getByTestId('owner-statement-net').textContent ?? '').toMatch(chfNet);
    expect(within(euros).getByTestId('owner-statement-net').textContent ?? '').toMatch(eurNet);
    // Each card speaks only its own currency: no euro under the francs, no franc under the euros, every total of the card included.
    expect(francs.textContent).not.toMatch(/€|EUR/);
    expect(euros.textContent).not.toMatch(/CHF/);
    for (const total of within(francs).getAllByTestId(/^owner-statement-total-/)) expect(total.textContent).toMatch(/CHF/);
    for (const total of within(euros).getAllByTestId(/^owner-statement-total-/)) expect(total.textContent).toMatch(/€/);
    // What the page used to say instead of an amount is gone.
    expect(document.body.textContent).not.toMatch(/non sono ancora mostrati|are not shown in the portal yet/);
    expect(screen.queryByTestId('owner-accounting-note')).toBeNull();
  });

  it('OwnerPortal_Statements_TheTotalsKeepTheSignOfTheLedger_AChargeIsNegative', async () => {
    api.listStatements.mockResolvedValue([CHF_STATEMENT]);
    renderPortal('/portale-proprietari/contabilita');

    const card = await screen.findByTestId('owner-statement');
    expect(within(card).getByTestId('owner-statement-total-gross').textContent).toMatch(/^1800,00\s*CHF$/);
    expect(within(card).getByTestId('owner-statement-total-channelFees').textContent).toMatch(/^-270,00\s*CHF$/);
    expect(within(card).getByTestId('owner-statement-total-commission').textContent).toMatch(/^-216,00\s*CHF$/);
    expect(within(card).getByTestId('owner-statement-total-charges').textContent).toMatch(/^-79,50\s*CHF$/);
    // No correction, no row for it.
    expect(within(card).queryByTestId('owner-statement-total-corrections')).toBeNull();
  });

  it('OwnerPortal_StatementDetail_TheLinesAndTheTouristTaxAreInTheCurrencyTheyCarry', async () => {
    api.getStatement.mockResolvedValue(
      statementDetail(CHF_STATEMENT, {
        touristTax: [
          { property: 'Casa Lago', checkIn: '2026-10-10', checkOut: '2026-10-14', channel: 'Airbnb', bookingCode: 'BK-1001', currency: 'CHF', amount: 8 },
          { property: 'Casa Como', checkIn: '2026-10-20', checkOut: '2026-10-22', channel: null, bookingCode: 'BK-2002', currency: 'EUR', amount: 5 },
        ],
      }),
    );
    renderPortal('/portale-proprietari/contabilita/st-chf');

    const detail = await screen.findByTestId('owner-statement-detail');
    // The lines are written in the currency of the statement, each part with its own total, in the order of the PDF.
    expect(within(detail).getByTestId('owner-statement-net').textContent).toMatch(/^1234,50\s*CHF$/);
    const stays = within(detail).getByTestId('owner-statement-section-stays');
    expect(stays.textContent).toMatch(/1800,00\s*CHF/);
    expect(stays.textContent).toContain('Casa Lago');
    expect(within(detail).getByTestId('owner-statement-section-recharges').textContent).toMatch(/-79,50\s*CHF/);
    expect(within(detail).queryByTestId('owner-statement-section-withholding')).toBeNull();
    // The tourist tax is outside the net, and every stay carries the currency it was collected in: a franc row and a euro row, and a sum for each, never one mixed sum.
    const box = within(detail).getByTestId('owner-tourist-tax');
    const rows = within(box).getAllByTestId('owner-tourist-tax-row');
    expect(rows[0].textContent).toMatch(/8,00\s*CHF/);
    expect(rows[1].textContent).toMatch(/5,00\s*€/);
    const sums = within(box).getAllByTestId('owner-tourist-tax-total').map((total) => total.textContent ?? '');
    expect(sums).toHaveLength(2);
    expect(sums[0]).toMatch(/^8,00\s*CHF$/);
    expect(sums[1]).toMatch(/^5,00\s*€$/);
    expect(box.textContent).not.toMatch(/1234|13,00/);
  });

  it('OwnerPortal_Statements_AnAmountWithNoCurrency_HasNoSymbol_AndThePageSaysSo', async () => {
    api.listStatements.mockResolvedValue([{ ...EUR_STATEMENT, statementId: 'st-none', currency: '' }, CHF_STATEMENT]);
    api.listInvoices.mockResolvedValue([{ ...CHF_INVOICE, invoiceId: 'inv-none', currency: '' }]);
    renderPortal('/portale-proprietari/contabilita');

    const cards = await screen.findAllByTestId('owner-statement');
    const withNone = cards.find((card) => card.querySelector('[data-testid="owner-statement-currency-missing"]'));
    expect(withNone).toBeDefined();
    // The figure is there, plain: no euro and no franc invented for it, and the sentence says why.
    expect(within(withNone as HTMLElement).getByTestId('owner-statement-net').textContent).toMatch(/^987,65$/);
    expect(withNone?.textContent).not.toMatch(/€|CHF|EUR|\$/);
    expect(within(withNone as HTMLElement).getByTestId('owner-statement-currency-missing').textContent).toContain('non è indicata');
    // The statement that has a currency says nothing of the kind.
    const withCurrency = cards.find((card) => card !== withNone) as HTMLElement;
    expect(within(withCurrency).queryByTestId('owner-statement-currency-missing')).toBeNull();
    expect(within(withCurrency).getByTestId('owner-statement-net').textContent).toMatch(/CHF/);
    // The same for an invoice of the manager.
    const invoice = await screen.findByTestId('owner-pm-invoice');
    expect(within(invoice).getByTestId('owner-pm-invoice-total').textContent).toMatch(/^233,25$/);
    expect(within(invoice).getByTestId('owner-pm-invoice-currency-missing')).toBeInTheDocument();
  });

  it('OwnerPortal_PmInvoices_EachTotalIsInTheCurrencyOfItsInvoice', async () => {
    api.listStatements.mockResolvedValue([CHF_STATEMENT, EUR_STATEMENT]);
    api.listInvoices.mockResolvedValue([EUR_INVOICE, CHF_INVOICE]);
    renderPortal('/portale-proprietari/contabilita');

    const invoices = await screen.findAllByTestId('owner-pm-invoice');
    expect(invoices).toHaveLength(2);
    // The latest day first, each with its own currency and its own title.
    expect(invoices[0].textContent).toContain('Fattura n. 2026/0042 del 5 nov 2026');
    expect(within(invoices[0]).getByTestId('owner-pm-invoice-total').textContent).toMatch(/^233,25\s*CHF$/);
    expect(within(invoices[1]).getByTestId('owner-pm-invoice-total').textContent).toMatch(/^77,70\s*€$/);
    expect(invoices[0].textContent).not.toMatch(/€|EUR/);
    expect(invoices[1].textContent).not.toMatch(/CHF/);
  });

  it('OwnerPortalStatementModel_TheSumIsMadeInCents_AndAnAmountThatRoundsToNothingHasNoSign', () => {
    const tax = (currency: string, amount: number) => ({ property: null, checkIn: '2026-10-10', checkOut: '2026-10-11', channel: null, bookingCode: null, currency, amount });

    // 0.1 + 0.2 is 0.3, and francs and euros are never one sum.
    expect(touristTaxTotals([tax('CHF', 0.1), tax('chf', 0.2), tax('EUR', 1)])).toEqual([
      { currency: 'CHF', total: 0.3 },
      { currency: 'EUR', total: 1 },
    ]);
    expect(formatMoney(-0.001, 'CHF', 'it')).toMatch(/^0,00\s*CHF$/);
    expect(formatMoney(5, undefined, 'it')).toBe('5,00');
    expect(formatMoney(Number.NaN, 'CHF', 'it')).toBe('—');
  });
});

describe('the PDF of a statement and of an invoice (one at a time, said in words when it fails)', () => {
  it('OwnerPortal_Pdf_OneDownloadAtATime_EveryButtonWaits_AndAFailureIsSaidUnderItsCard', async () => {
    api.listStatements.mockResolvedValue([CHF_STATEMENT]);
    api.listInvoices.mockResolvedValue([CHF_INVOICE]);
    let finish: (blob: Blob) => void = () => {};
    api.downloadStatementPdf.mockReturnValueOnce(new Promise<Blob>((resolve) => (finish = resolve)));
    renderPortal('/portale-proprietari/contabilita');

    const statementButton = await screen.findByTestId('owner-statement-pdf');
    const invoiceButton = await screen.findByTestId('owner-pm-invoice-pdf');
    await waitFor(() => expect(statementButton).toBeEnabled());
    fireEvent.click(statementButton);
    // The button of the invoice waits for the statement that works, and a click on it asks for nothing.
    await waitFor(() => expect(invoiceButton).toBeDisabled());
    fireEvent.click(invoiceButton);
    expect(api.downloadInvoicePdf).not.toHaveBeenCalled();

    const blob = new Blob(['%PDF-1.4']);
    finish(blob);
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(blob, 'rendiconto-2026-10-v1.pdf'));
    expect(api.downloadStatementPdf).toHaveBeenCalledWith('st-chf');
    await waitFor(() => expect(invoiceButton).toBeEnabled());

    // The invoice is asked for in the language of the page, and saved under a name with no slash in it.
    const invoiceBlob = new Blob(['%PDF-1.5']);
    api.downloadInvoicePdf.mockResolvedValueOnce(invoiceBlob);
    fireEvent.click(invoiceButton);
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(invoiceBlob, 'fattura-2026-0042.pdf'));
    expect(api.downloadInvoicePdf).toHaveBeenCalledWith('inv-chf', 'it');

    // A PDF the server does not have is said in words under its statement; nothing is saved and the buttons come back.
    api.downloadStatementPdf.mockRejectedValueOnce(refusal(404, 'owner_statement_pdf_not_available'));
    await waitFor(() => expect(statementButton).toBeEnabled());
    fireEvent.click(statementButton);
    const failed = await screen.findByTestId('owner-statement-download-failed');
    expect(failed.textContent).toContain('Il PDF di questo rendiconto non è disponibile');
    expect(saveBlobAs).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(statementButton).toBeEnabled());
  });

  it('OwnerPortal_Pdf_AnInvoiceIsAskedForInEnglish_WhenThePageIsEnglish', async () => {
    await i18n.changeLanguage('en');
    api.listInvoices.mockResolvedValue([CHF_INVOICE]);
    api.downloadInvoicePdf.mockResolvedValue(new Blob(['%PDF-1.5']));
    renderPortal('/portale-proprietari/contabilita');

    const button = await screen.findByTestId('owner-pm-invoice-pdf');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(api.downloadInvoicePdf).toHaveBeenCalledWith('inv-chf', 'en');
  });

  it('OwnerPortal_Pdf_AStatementWithNoStoredFile_OffersNoButtonThatCouldOnlyFail', async () => {
    api.listStatements.mockResolvedValue([{ ...CHF_STATEMENT, hasPdf: false }]);
    renderPortal('/portale-proprietari/contabilita');

    const card = await screen.findByTestId('owner-statement');
    expect(within(card).queryByTestId('owner-statement-pdf')).toBeNull();
    expect(within(card).getByTestId('owner-statement-no-pdf').textContent).toContain('non è disponibile');
  });
});

describe('a statement that is refused is «not found», whatever an earlier answer left (404)', () => {
  it('OwnerPortal_StatementDetail_A404AfterAGoodRead_IsNotFound_NoLineOfTheEarlierAnswerIsDrawn', async () => {
    api.getStatement.mockResolvedValueOnce(statementDetail(CHF_STATEMENT));
    const { client } = renderPortal('/portale-proprietari/contabilita/st-chf');
    await screen.findByTestId('owner-statement-detail');
    expect(document.body.textContent).toContain('Casa Lago');

    // The statement is no longer one of the owner's (or is gone): TanStack Query keeps the data of the answer before, and the page must not draw it.
    api.getStatement.mockRejectedValue(refusal(404, 'owner_statement_version_not_found'));
    await act(async () => {
      await client.refetchQueries({ queryKey: [OWNER_PORTAL_KEY, 'statement', 'st-chf'] });
    });

    expect(await screen.findByTestId('owner-statement-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-statement-detail')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Casa Lago|1234,50|BK-1001/);
  });
});
