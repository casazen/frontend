import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { FiscalDocumentSdiState, SelfBillingDetail, SelfBillingGeneration, SelfBillingListItem } from '@/types';

/** The TD17 the SDI rejected, the one the correction discards. */
export const REJECTED_ID = 'a0000000-0000-4000-8000-000000000001';

/** The draft that replaces it and holds its number. */
export const REPLACEMENT_ID = 'b0000000-0000-4000-8000-000000000002';

/** The number of the rejected TD17: the replacement holds the same one. */
export const NUMBER = 'AF-2026/1';

/** A TD17 of the list: a draft of October 2026 of the agency, with nothing of the correction on it. */
export const item = (overrides: Partial<SelfBillingListItem> = {}): SelfBillingListItem => ({
  id: 'd0000000-0000-4000-8000-000000000001',
  holderKind: 'Agency',
  holderOwnerId: null,
  holderName: 'Lago Immobiliare Srl',
  portalName: 'Portale Uno BV',
  portalCountry: 'NL',
  periodYear: 2026,
  periodMonth: 10,
  dueDate: '2026-11-15',
  number: null,
  issueDate: null,
  status: 'Draft',
  taxableBase: 100,
  vatAmount: 22,
  total: 122,
  currency: 'EUR',
  sdiStatus: 'not_applicable',
  canCorrect: false,
  replacesDocumentId: null,
  replacedByDocumentId: null,
  keptReason: null,
  ...overrides,
});

/** A TD17 issued and rejected by the SDI, numbered, that the server says can be corrected. */
export const rejected = (overrides: Partial<SelfBillingListItem> = {}): SelfBillingListItem =>
  item({ id: REJECTED_ID, status: 'Issued', number: NUMBER, issueDate: '2026-11-10', sdiStatus: 'rejected', canCorrect: true, ...overrides });

/** The original a correction discarded: history, with its number and its rejection, and the draft that replaces it. */
export const original = (overrides: Partial<SelfBillingListItem> = {}): SelfBillingListItem =>
  rejected({ status: 'Discarded', canCorrect: false, replacedByDocumentId: REPLACEMENT_ID, ...overrides });

/** The draft that replaces the rejected TD17: it holds its number and names it. */
export const replacement = (overrides: Partial<SelfBillingListItem> = {}): SelfBillingListItem =>
  item({ id: REPLACEMENT_ID, number: NUMBER, replacesDocumentId: REJECTED_ID, ...overrides });

export const detail = (invoice: SelfBillingListItem = item(), overrides: Partial<SelfBillingDetail> = {}): SelfBillingDetail => ({
  invoice,
  ruleVersion: null,
  vatRatePercent: 22,
  hasXml: false,
  estimatedAmount: 0,
  lines: [{ lineNumber: 1, description: 'Commissione di ottobre', totalPrice: 100, vatRatePercent: 22, vatAmount: 22 }],
  ...overrides,
});

/** The state towards the SDI the server answers for the rejected TD17, with the reason in plain words. */
export const rejectedState = (overrides: Partial<FiscalDocumentSdiState> = {}): FiscalDocumentSdiState => ({
  documentId: REJECTED_ID,
  status: 'rejected',
  errorCode: '00427',
  reason: 'Il codice destinatario della fattura non è valido.',
  statusUpdatedAt: null,
  providerConfigured: true,
  canSubmit: false,
  canDeclare: false,
  canCorrect: false,
  ...overrides,
});

export const generation = (overrides: Partial<SelfBillingGeneration> = {}): SelfBillingGeneration => ({
  year: 2026,
  month: 10,
  created: 0,
  updated: 0,
  alreadyIssued: 0,
  discarded: 0,
  drafts: [],
  failed: [],
  notDue: [],
  kept: [],
  ledgerPosted: true,
  ...overrides,
});

/** A call the server answers with `status` and, when it has one, the `code` of its RFC 7807 body. */
export function failure(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const data = code ? { code } : {};
  return new AxiosError('Request failed', status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}
