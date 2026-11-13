import type { FiscalDocumentEntry } from '@/types';

/** An invoice CasaZen issued for a direct booking, as the page reads it: numbered, to send to the SDI, to collect, with its XML. */
export function document(overrides: Partial<FiscalDocumentEntry> = {}): FiscalDocumentEntry {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    bookingId: 'b0000000-0000-4000-8000-000000000001',
    source: 'CasaZen',
    kind: 'Invoice',
    status: 'Issued',
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

/** A document the channel manager issued and CasaZen imported: read-only, with a PDF at the channel manager. */
export function importedDocument(overrides: Partial<FiscalDocumentEntry> = {}): FiscalDocumentEntry {
  return document({
    id: 'd0000000-0000-4000-8000-000000000002',
    source: 'Octorate',
    number: '2026/77',
    sdiStatus: 'unknown',
    paymentState: 'Unknown',
    hasXml: false,
    octoratePdfAvailable: true,
    ...overrides,
  });
}
