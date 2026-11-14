import type { BookingFiscalDocument, FiscalDocumentDetail, FiscalDocumentEntry } from '@/types';

/** An invoice CasaZen issued for a direct booking, as the page reads it: numbered, to send to the SDI, to collect, with its XML. */
export function document(overrides: Partial<FiscalDocumentEntry> = {}): FiscalDocumentEntry {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    bookingId: 'b0000000-0000-4000-8000-000000000001',
    source: 'CasaZen',
    kind: 'Invoice',
    status: 'Issued',
    series: 'A',
    sequenceNumber: 12,
    number: 'A/12',
    issueDate: '2026-11-05',
    currency: 'EUR',
    recipientName: 'Mario Rossi',
    total: 122.1,
    paymentState: 'ToCollect',
    sdiStatus: 'to_send',
    sdiErrorCode: null,
    hasXml: true,
    octoratePdfAvailable: false,
    ...overrides,
  };
}

/** A draft of a stay CasaZen can issue: no number and no day, nothing to download. */
export function draft(overrides: Partial<FiscalDocumentEntry> = {}): FiscalDocumentEntry {
  return document({
    id: 'd0000000-0000-4000-8000-000000000003',
    status: 'Draft',
    series: null,
    sequenceNumber: null,
    number: null,
    issueDate: null,
    sdiStatus: 'not_applicable',
    hasXml: false,
    ...overrides,
  });
}

/** A document the channel manager issued and CasaZen imported: read-only, with a PDF at the channel manager. */
export function importedDocument(overrides: Partial<FiscalDocumentEntry> = {}): FiscalDocumentEntry {
  return document({
    id: 'd0000000-0000-4000-8000-000000000002',
    source: 'Octorate',
    series: null,
    sequenceNumber: null,
    number: '2026/77',
    sdiStatus: 'unknown',
    paymentState: 'Unknown',
    hasXml: false,
    octoratePdfAvailable: true,
    ...overrides,
  });
}

/**
 * A Swiss invoice in francs with its lines as the server stores them (net of VAT): the stay and the cleaning at 3.8 %, an extra at 8.1 % and the tourist tax out of VAT. The figures add up as the
 * server adds them: 655.11 at 3.8 % is 24.89 of VAT, 37.00 at 8.1 % is 3.00, the taxable base is 708.11, the VAT 27.89 and the total 736.00.
 */
export function swissDetail(overrides: Partial<FiscalDocumentDetail> = {}): FiscalDocumentDetail {
  return {
    ...document({ currency: 'CHF', total: 736, number: '2026/5', series: '2026', sequenceNumber: 5, sdiStatus: 'not_applicable', hasXml: false, paymentState: 'ToCollect' }),
    taxableBase: 708.11,
    vatAmount: 27.89,
    stampDuty: 0,
    paymentChannel: null,
    issuer: null,
    lines: [
      { lineNumber: 1, description: 'Soggiorno', quantity: 1, unitPrice: 578.04, totalPrice: 578.04, vatRatePercent: 3.8, vatNatureCode: null, lineType: null, vatAmount: null },
      { lineNumber: 2, description: 'Pulizie finali', quantity: 1, unitPrice: 77.07, totalPrice: 77.07, vatRatePercent: 3.8, vatNatureCode: null, lineType: null, vatAmount: null },
      { lineNumber: 3, description: 'Servizio extra', quantity: 1, unitPrice: 37, totalPrice: 37, vatRatePercent: 8.1, vatNatureCode: null, lineType: null, vatAmount: null },
      { lineNumber: 4, description: 'Tassa di soggiorno', quantity: 8, unitPrice: 2, totalPrice: 16, vatRatePercent: 0, vatNatureCode: null, lineType: null, vatAmount: null },
    ],
    ...overrides,
  };
}

/** One document of the card of a booking, in francs. */
export function bookingDocument(overrides: Partial<BookingFiscalDocument> = {}): BookingFiscalDocument {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    kind: 'Invoice',
    status: 'Issued',
    number: '2026/5',
    total: 736,
    currency: 'CHF',
    paymentState: 'ToCollect',
    issueDate: '2026-11-05',
    ...overrides,
  };
}
