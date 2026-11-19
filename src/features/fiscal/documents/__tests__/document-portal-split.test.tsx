import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { getDocument } from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import { DocumentDetailDrawer } from '../document-detail-drawer';
import { paymentSplitOf } from '../document-model';
import { swissDetail } from './document-fixtures';

// The whole chain is real: the answer of the API goes through the reduction of `getDocument` and is drawn by the drawer, so a member the reduction dropped could never pass for a drawn one.
vi.mock('@/lib/axios', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/axios')>()), default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [], hasPermission: () => false }) }));

const DOCUMENT_ID = 'd0000000-0000-4000-8000-0000000000a1';

const answer = (data: unknown, status = 200) => ({ status, data, headers: {} });
const plain = (text: string | null | undefined) => (text ?? '').replace(/\s/g, ' ');

const STAY_LINE = { lineNumber: 1, description: 'Soggiorno', quantity: 1, unitPrice: 433.53, totalPrice: 433.53, vatRatePercent: 3.8, vatAmount: 16.47, lineType: 'Accommodation' };
const TAX_LINE = { lineNumber: 2, description: 'Tassa di soggiorno', quantity: 6, unitPrice: 2, totalPrice: 12, vatRatePercent: 0, vatAmount: 0, lineType: 'TouristTax' };

/**
 * The document of the finding of the Swiss scenario as the API sends it: a 462.00 invoice of a booking a portal collected, with 12.00 of tourist tax in it that nobody collected. The server stores the
 * payment as paid through the portal for the whole total and says the split in `amountPaidViaPortal` and `amountToCollectAtProperty`, and the line of the tax with `toCollectAtProperty`.
 */
const split = (overrides: Record<string, unknown> = {}) => ({
  id: DOCUMENT_ID,
  bookingId: 'b0000000-0000-4000-8000-0000000000a1',
  source: 'CasaZen',
  kind: 'Invoice',
  purpose: 'GuestStay',
  status: 'Issued',
  series: '2026',
  sequenceNumber: 7,
  number: '2026/7',
  issueDate: '2026-11-05',
  currency: 'CHF',
  recipientName: 'Mario Rossi',
  taxableBase: 445.53,
  vatAmount: 16.47,
  stampDuty: 0,
  total: 462,
  paymentState: 'Paid',
  paymentChannel: 'Portal',
  amountPaidViaPortal: 450,
  amountToCollectAtProperty: 12,
  sdiStatus: 'not_applicable',
  hasXml: false,
  octoratePdfAvailable: false,
  lines: [STAY_LINE, { ...TAX_LINE, toCollectAtProperty: true }],
  ...overrides,
});

/** The same document when the server says no split, as it does for every other document: the members are left out of the answer and no line carries the mark. */
const notSplit = () => split({ amountPaidViaPortal: undefined, amountToCollectAtProperty: undefined, lines: [STAY_LINE, TAX_LINE] });

function renderDrawer(body: unknown) {
  vi.mocked(axios.get).mockResolvedValue(answer(body));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        QueryClientProvider,
        { client },
        createElement(DocumentDetailDrawer, { documentId: DOCUMENT_ID, onClose: () => undefined, flags: DEFAULT_FEATURE_FLAGS, canWrite: false, canReadBookings: false }),
      ),
    ),
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
});

describe('the drawer of a portal document whose tourist tax is still to pay at the property (money rule)', () => {
  it('DocumentDetailDrawer_ADocumentOf462WithTheSplit_ShowsExactlyTheTwoAmountsInTheCurrencyOfTheDocumentAndMarksTheTaxLine', async () => {
    renderDrawer(split());

    const drawer = await screen.findByTestId('fiscal-document-drawer');
    const block = await within(drawer).findByTestId('fiscal-document-payment-block');
    // What the portal collected and the tax still to pay at the property: the figures the server wrote, in francs, and nothing worked out here.
    expect(plain(within(block).getByTestId('fiscal-document-payment-portal-amount').textContent)).toBe('450,00 CHF');
    expect(plain(within(block).getByTestId('fiscal-document-payment-property-amount').textContent)).toBe('12,00 CHF');
    expect(within(block).getByTestId('fiscal-document-payment-portal')).toHaveTextContent('Pagato tramite il portale');
    expect(within(block).getByTestId('fiscal-document-payment-property')).toHaveTextContent('Imposta di soggiorno da pagare in struttura');
    // The tax is a part not yet completed: it is told as such (the tone of «to collect», with an icon) and never as a state that is paid.
    expect(within(block).getByTestId('fiscal-document-payment-property-state')).toHaveAttribute('data-tone', 'warning');
    expect(block.textContent).not.toContain('€');
    // The single «paid» state is not there any more, and the document is still the whole 462.00.
    expect(within(drawer).queryByTestId('fiscal-document-detail-payment')).not.toBeInTheDocument();
    expect(plain(within(drawer).getByTestId('fiscal-document-detail-total').textContent)).toBe('462,00 CHF');
    // The line of the tax, and only that one, carries the mark.
    const lines = within(drawer).getAllByTestId('fiscal-document-line');
    expect(lines).toHaveLength(2);
    expect(within(lines[0]).queryByTestId('fiscal-document-line-at-property')).not.toBeInTheDocument();
    expect(within(lines[1]).getByTestId('fiscal-document-line-at-property')).toHaveTextContent('Da pagare in struttura');
    expect(plain(within(lines[1]).getByTestId('fiscal-document-line-amount').textContent)).toBe('12,00 CHF');
  });

  it('DocumentDetailDrawer_ADocumentWithoutTheSplit_IsShownAsItWasWithTheSinglePaidState', async () => {
    renderDrawer(notSplit());

    const drawer = await screen.findByTestId('fiscal-document-drawer');
    const single = await within(drawer).findByTestId('fiscal-document-detail-payment');
    expect(single).toHaveAttribute('data-state', 'paidPortal');
    expect(single).toHaveAttribute('data-tone', 'success');
    expect(single).toHaveTextContent('Pagato tramite il portale');
    // Nothing of the split is drawn, no line is marked and the figures are the ones they always were.
    expect(within(drawer).queryByTestId('fiscal-document-payment-split')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('fiscal-document-payment-property')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('fiscal-document-line-at-property')).not.toBeInTheDocument();
    expect(plain(within(drawer).getByTestId('fiscal-document-detail-total').textContent)).toBe('462,00 CHF');
  });

  it('DocumentDetailDrawer_ADocumentThatBillsNothingButTheTax_NeverSaysPaidThroughThePortalForNothing', async () => {
    renderDrawer(split({ taxableBase: 12, vatAmount: 0, total: 12, amountPaidViaPortal: 0, amountToCollectAtProperty: 12, lines: [{ ...TAX_LINE, toCollectAtProperty: true }] }));

    const block = await screen.findByTestId('fiscal-document-payment-block');
    // As the PDF does, the screen says nothing of the portal when it collected nothing: only the tax to pay at the property.
    expect(within(block).queryByTestId('fiscal-document-payment-portal')).not.toBeInTheDocument();
    expect(plain(within(block).getByTestId('fiscal-document-payment-property-amount').textContent)).toBe('12,00 CHF');
    expect(block.textContent).not.toMatch(/portale/i);
  });

  it('DocumentDetailDrawer_InEnglishWithADocumentInEuro_UsesTheEnglishWordsAndTheCurrencyOfTheDocument', async () => {
    await i18n.changeLanguage('en');
    renderDrawer(split({ currency: 'EUR' }));

    const block = await screen.findByTestId('fiscal-document-payment-block');
    expect(plain(within(block).getByTestId('fiscal-document-payment-portal-amount').textContent)).toBe('€450.00');
    expect(plain(within(block).getByTestId('fiscal-document-payment-property-amount').textContent)).toBe('€12.00');
    expect(within(block).getByTestId('fiscal-document-payment-portal')).toHaveTextContent('Paid through the portal');
    expect(within(block).getByTestId('fiscal-document-payment-property')).toHaveTextContent('Tourist tax payable at the property');
    expect(screen.getByTestId('fiscal-document-line-at-property')).toHaveTextContent('Payable at the property');
    expect(block.textContent).not.toContain('CHF');
  });

  it('DocumentDetailDrawer_ADocumentWhoseCurrencyIsNotACode_WritesTheAmountsWithoutASymbolAndSaysSo', async () => {
    renderDrawer(split({ currency: 'franchi' }));

    const block = await screen.findByTestId('fiscal-document-payment-block');
    expect(plain(within(block).getByTestId('fiscal-document-payment-property-amount').textContent)).toBe('12 franchi');
    expect(block.textContent).not.toContain('€');
    expect(within(block).getByTestId('fiscal-document-payment-no-currency')).toHaveTextContent('La valuta non è indicata nel documento');
  });
});

describe('what the client reads of the split', () => {
  it.each([
    ['an amount to collect that is a text', { amountToCollectAtProperty: '12.00' }],
    ['an amount paid through the portal that is a text', { amountPaidViaPortal: '450.00' }],
  ])('GetDocument_%s_IsALoadErrorAndNeverADocumentPaidInFull', async (_case, overrides) => {
    vi.mocked(axios.get).mockResolvedValue(answer(split(overrides)));

    await expect(getDocument(DOCUMENT_ID)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('GetDocument_TheMembersTheServerLeavesOut_AreNotInTheDocumentAndNoLineIsMarked', async () => {
    vi.mocked(axios.get).mockResolvedValue(answer(notSplit()));

    const detail = await getDocument(DOCUMENT_ID);

    expect(Object.keys(detail)).not.toContain('amountPaidViaPortal');
    expect(Object.keys(detail)).not.toContain('amountToCollectAtProperty');
    for (const line of detail.lines) expect(Object.keys(line)).not.toContain('toCollectAtProperty');
  });

  it.each([
    ['a document with no split', swissDetail({ paymentChannel: 'Portal' })],
    ['a draft', swissDetail({ status: 'Draft', amountPaidViaPortal: 450, amountToCollectAtProperty: 12 })],
    ['a credit note', swissDetail({ kind: 'CreditNote', amountPaidViaPortal: 450, amountToCollectAtProperty: 12 })],
    ['a split with nothing left to pay at the property', swissDetail({ amountPaidViaPortal: 462, amountToCollectAtProperty: 0 })],
  ])('PaymentSplitOf_%s_IsNoSplit', (_case, detail) => {
    expect(paymentSplitOf(detail)).toBeNull();
  });
});
