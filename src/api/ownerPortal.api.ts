import { AxiosError } from 'axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import axios from '@/lib/axios';
import { acceptsRefusal } from './accept-refusal';
import { ApiClient } from './client';
import type { DownloadedFile } from './file.api';
import type {
  InviteOwnerContactBody,
  OwnerCalendar,
  OwnerContact,
  OwnerContactAccepted,
  OwnerConversation,
  OwnerInboxPreferences,
  OwnerMessage,
  OwnerPortalCu,
  OwnerPortalDocuments,
  OwnerPortalExternalDocument,
  OwnerPortalInvoice,
  OwnerPortalIssuedDocument,
  OwnerPortalOverview,
  OwnerPortalProperty,
  OwnerPortalReportQuery,
  OwnerPortalStatement,
  OwnerPortalStatementDetail,
  OwnerPortalTrend,
  OwnerPortalWithholding,
  OwnerPortalWithholdingDetail,
  OwnerPortalPermission,
  OwnerStay,
  OwnerStayRequestBody,
  OwnerStayRuleSummary,
  StartOwnerConversationBody,
} from '@/types';
import { asReport, headerOf } from '@/api/response-helpers';

const BASE = '/owner-portal';
const OVERVIEW_PATH = `${BASE}/overview`;
const TREND_PATH = `${BASE}/trend`;

function reportParams(query: OwnerPortalReportQuery): Record<string, string> {
  const params: Record<string, string> = {
    from: query.from,
    to: query.to,
    groupBy: query.groupBy,
    compare: query.compare ? 'previousYear' : 'none',
  };
  if (query.propertyId) params.propertyId = query.propertyId;
  return params;
}

function asList<T>(url: string, data: unknown): T[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T[];
}

function asDocuments(url: string, data: unknown): OwnerPortalDocuments {
  const report = asReport<Partial<OwnerPortalDocuments>>(url, data);
  if (!Array.isArray(report.documents) || !Array.isArray(report.statements)) throw new UnexpectedApiResponseError(url);
  return { documents: report.documents, statements: report.statements };
}

function asStatements(url: string, data: unknown): OwnerPortalStatement[] {
  const list = asList<Partial<OwnerPortalStatement> | null>(url, data);
  if (!list.every((item) => typeof item === 'object' && item !== null && typeof item.statementId === 'string' && typeof item.totals === 'object' && item.totals !== null)) {
    throw new UnexpectedApiResponseError(url);
  }
  return list as OwnerPortalStatement[];
}

function asStatementDetail(url: string, data: unknown): OwnerPortalStatementDetail {
  const detail = asReport<Partial<OwnerPortalStatementDetail>>(url, data);
  const { statement, sections, touristTax } = detail;
  if (typeof statement !== 'object' || statement === null || typeof statement.totals !== 'object' || statement.totals === null) throw new UnexpectedApiResponseError(url);
  if (!Array.isArray(sections) || !Array.isArray(touristTax)) throw new UnexpectedApiResponseError(url);
  if (!sections.every((section: { lines?: unknown } | null) => typeof section === 'object' && section !== null && Array.isArray(section.lines))) throw new UnexpectedApiResponseError(url);
  return detail as OwnerPortalStatementDetail;
}

const EXPORT_TIMEOUT_MS = 10 * 60_000;

const NOT_A_FILE = /^(text\/html|application\/(json|problem\+json))/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The documents issued in the name of the owner, reduced to what the page shows (E17/F03/US01/T03, NF-116): the number, the day, the kind, the total with its currency, the state towards the SDI and whether
 * there is an XML. NOTHING of a guest is kept, whatever the answer carries: the member that is not in the list below never reaches the state of the page, the cache of the queries or a log. A member that is
 * not one of the right type is a load error for the whole answer, never a row left out: a list that silently misses a document could be read as one that is in order.
 */
function asIssuedDocuments(url: string, data: unknown): OwnerPortalIssuedDocument[] {
  const list = asList<unknown>(url, data);
  return list.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.documentId !== 'string' ||
      typeof item.number !== 'string' ||
      typeof item.issueDate !== 'string' ||
      typeof item.kind !== 'string' ||
      typeof item.total !== 'number' ||
      !Number.isFinite(item.total) ||
      typeof item.currency !== 'string' ||
      typeof item.sdiStatus !== 'string'
    ) {
      throw new UnexpectedApiResponseError(url);
    }
    return {
      documentId: item.documentId,
      agencyId: typeof item.agencyId === 'string' ? item.agencyId : '',
      agencyName: typeof item.agencyName === 'string' ? item.agencyName : '',
      number: item.number,
      issueDate: item.issueDate,
      kind: item.kind,
      total: item.total,
      currency: item.currency,
      sdiStatus: item.sdiStatus,
      hasXml: item.hasXml === true,
    };
  });
}

function finiteNumber(value: unknown, url: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new UnexpectedApiResponseError(url);
  return value;
}

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * The withholding of the owner in a year and the CU of each agency that reviewed it (E18/F01/US02/T01, E18/F02/US01/T01), reduced to what the page shows. NOTHING that belongs to the agency is kept, whatever the
 * answer carries: the recipient of the CU (name, fiscal code, address), the stays it is made of and the co-owners are not members below, so they never reach the state of the page, the cache of the queries or a log.
 * A member that is not of the right type is a load error for the whole answer, never a line left out: a list that silently misses a withholding could be read as one that is in order. The currency is what the API
 * says; one that is missing stays empty, and the page then writes the amounts without a symbol and says so.
 */
function asWithholding(url: string, data: unknown): OwnerPortalWithholding {
  const answer = asReport<Record<string, unknown>>(url, data);
  if (!Array.isArray(answer.details) || !Array.isArray(answer.cuStatements)) throw new UnexpectedApiResponseError(url);

  const details = answer.details.map((item: unknown): OwnerPortalWithholdingDetail => {
    if (!isRecord(item)) throw new UnexpectedApiResponseError(url);
    return {
      agencyId: textOrEmpty(item.agencyId),
      agencyName: textOrEmpty(item.agencyName),
      propertyId: textOrEmpty(item.propertyId),
      propertyName: textOrEmpty(item.propertyName),
      month: finiteNumber(item.month, url),
      grossBase: finiteNumber(item.grossBase, url),
      amountWithheld: finiteNumber(item.amountWithheld, url),
    };
  });
  const cuStatements = answer.cuStatements.map((item: unknown): OwnerPortalCu => {
    if (!isRecord(item) || typeof item.state !== 'string') throw new UnexpectedApiResponseError(url);
    return {
      agencyId: textOrEmpty(item.agencyId),
      agencyName: textOrEmpty(item.agencyName),
      year: finiteNumber(item.year, url),
      state: item.state as OwnerPortalCu['state'],
      generatedAt: textOrEmpty(item.generatedAt),
      grossBase: finiteNumber(item.grossBase, url),
      withheld: finiteNumber(item.withheld, url),
      taxCode: typeof item.taxCode === 'string' && item.taxCode !== '' ? item.taxCode : null,
      attribution: textOrEmpty(item.attribution),
    };
  });
  return { year: finiteNumber(answer.year, url), currency: textOrEmpty(answer.currency), totalWithheld: finiteNumber(answer.totalWithheld, url), details, cuStatements };
}

/**
 * A file of the documents issued in the name of the owner (the PDF, the XML, the ZIP for the accountant). Its 403 is an answer of the call, not a failure of the app: the body of a file is a Blob, which has no `code` until it is
 * parsed, and the shared client sends the whole app to the page of no access on a 403 for a read whose body has no code. So the call takes the refusal as an answer (`acceptsRefusal`) and throws it again as the error it is,
 * with its body parsed, so that the page says «the owner did not give this permission» (403 `owner_portal_permission_missing`) in words and the person stays in the portal. A page, or a JSON body, is not the file that was asked for.
 */
async function getIssuedFile(url: string, config: { params?: Record<string, string>; timeout?: number; signal?: AbortSignal } = {}): Promise<DownloadedFile> {
  try {
    const response = await axios.get<Blob>(url, { ...config, responseType: 'blob', validateStatus: acceptsRefusal });
    if (response.status === 403) throw new AxiosError('Request failed with status code 403', AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
    if (!(response.data instanceof Blob) || NOT_A_FILE.test(response.data.type)) throw new UnexpectedApiResponseError(url);
    return { blob: response.data, contentDisposition: headerOf(response.headers, 'content-disposition') };
  } catch (error) {
    // With `responseType: 'blob'` a problem body arrives as a Blob: parse it so that its code can be read.
    throw await withJsonErrorBody(error);
  }
}

async function getFile(url: string): Promise<Blob> {
  try {
    const response = await axios.get<Blob>(url, { responseType: 'blob' });
    return response.data;
  } catch (error) {
    // With `responseType: 'blob'` a problem body arrives as a Blob: parse it so that its code can be read.
    throw await withJsonErrorBody(error);
  }
}

export const ownerPortalApi = {
  checkAccess: () => ApiClient.get<unknown>(`${BASE}/properties`, undefined, { localAuthRecovery: true }),

  getProperties: async () => asList<OwnerPortalProperty>(`${BASE}/properties`, await ApiClient.get<unknown>(`${BASE}/properties`)),

  getOverview: async (query: OwnerPortalReportQuery) =>
    asReport<OwnerPortalOverview>(OVERVIEW_PATH, await ApiClient.get<unknown>(OVERVIEW_PATH, reportParams(query))),

  getTrend: async (query: OwnerPortalReportQuery) =>
    asReport<OwnerPortalTrend>(TREND_PATH, await ApiClient.get<unknown>(TREND_PATH, reportParams(query))),

  getCalendar: async (propertyId: string, from?: string, to?: string) =>
    asReport<OwnerCalendar>(
      `${BASE}/calendar`,
      await ApiClient.get<unknown>(`${BASE}/calendar`, { propertyId, ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    ),

  listStays: async () => asList<OwnerStay>(`${BASE}/stays`, await ApiClient.get<unknown>(`${BASE}/stays`)),

  getStayRule: async (propertyId: string) =>
    asReport<OwnerStayRuleSummary>(`${BASE}/stays/rule`, await ApiClient.get<unknown>(`${BASE}/stays/rule`, { propertyId })),

  requestStay: (body: OwnerStayRequestBody) => ApiClient.post<OwnerStay>(`${BASE}/stays`, body),

  cancelStay: (stayId: string) => ApiClient.post<OwnerStay>(`${BASE}/stays/${encodeURIComponent(stayId)}/cancel`),

  listDocuments: async () => asDocuments(`${BASE}/documents`, await ApiClient.get<unknown>(`${BASE}/documents`)),

  downloadDocument: (documentId: string, versionId?: string) =>
    getFile(`${BASE}/documents/${encodeURIComponent(documentId)}/file${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''}`),

  listExternalDocuments: async () =>
    asList<OwnerPortalExternalDocument>(`${BASE}/external-documents`, await ApiClient.get<unknown>(`${BASE}/external-documents`)),

  listStatements: async () => asStatements(`${BASE}/statements`, await ApiClient.get<unknown>(`${BASE}/statements`)),

  getStatement: async (statementId: string) => {
    const url = `${BASE}/statements/${encodeURIComponent(statementId)}`;
    return asStatementDetail(url, await ApiClient.get<unknown>(url));
  },

  downloadStatementPdf: (statementId: string) => getFile(`${BASE}/statements/${encodeURIComponent(statementId)}/pdf`),

  listInvoices: async () => asList<OwnerPortalInvoice>(`${BASE}/invoices`, await ApiClient.get<unknown>(`${BASE}/invoices`)),

  getWithholding: async (year?: number) => {
    const url = `${BASE}/withholding`;
    return asWithholding(url, await ApiClient.get<unknown>(url, year === undefined ? undefined : { year }));
  },

  /** The PDF of one invoice, made from the document as it was issued, in the language of the person (Italian unless it is English). */
  downloadInvoicePdf: (invoiceId: string, language: 'it' | 'en') => getFile(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/pdf?lang=${language}`),

  listIssuedDocuments: async (period?: string) => {
    const url = `${BASE}/issued-documents`;
    return asIssuedDocuments(url, await ApiClient.get<unknown>(url, period ? { period } : undefined));
  },

  /** The PDF of one document issued in the name of the owner, made from the document and the issuer as they were at the issue, in the language of the person (Italian unless it is English). 404 `owner_issued_document_not_found`. */
  downloadIssuedDocumentPdf: async (documentId: string, language: 'it' | 'en') =>
    (await getIssuedFile(`${BASE}/issued-documents/${encodeURIComponent(documentId)}/pdf?lang=${language}`)).blob,

  /** The FatturaPA XML of an invoice or a credit note issued in the name of the owner, as it was stored at the issue (404 `fiscal_document_xml_unavailable` for a receipt). */
  downloadIssuedDocumentXml: async (documentId: string) => (await getIssuedFile(`${BASE}/issued-documents/${encodeURIComponent(documentId)}/xml`)).blob,

  /**
   * The ZIP for the accountant of the owner (`GET .../issued-documents/export?period=2026-10`, or `?period=2026`), through the authenticated client, with the name the server gave it (`Content-Disposition`, `null` when
   * the page cannot read it): the PDF and the XML of the documents of the period, their register and the index with the SHA-256 of every file. The call can be stopped (`signal`). 400
   * `accountant_package_invalid_period`, 404 `owner_issued_documents_not_available`, 403 `owner_portal_permission_missing`, 422 `accountant_package_too_large` before the first byte. A problem body (a JSON Blob) is parsed so that its code can be read,
   * and the 403 is an answer of the call (the person stays in the portal and the page says why: see `getIssuedFile`).
   */
  exportIssuedDocuments: (period: string, options: { signal?: AbortSignal } = {}): Promise<DownloadedFile> =>
    getIssuedFile(`${BASE}/issued-documents/export`, { params: { period }, timeout: EXPORT_TIMEOUT_MS, signal: options.signal }),

  listContacts: async () => asList<OwnerContact>(`${BASE}/contacts`, await ApiClient.get<unknown>(`${BASE}/contacts`)),

  inviteContact: (body: InviteOwnerContactBody) => ApiClient.post<OwnerContact>(`${BASE}/contacts`, body),

  setContactPermissions: (contactId: string, permissions: OwnerPortalPermission[]) =>
    ApiClient.put<OwnerContact>(`${BASE}/contacts/${encodeURIComponent(contactId)}/permissions`, { permissions }),

  revokeContact: (contactId: string) => ApiClient.post<OwnerContact>(`${BASE}/contacts/${encodeURIComponent(contactId)}/revoke`),

  /** The signed-in account accepts the invitation of a contact (the secret goes in the body, never in a URL). */
  acceptContact: (token: string) => ApiClient.post<OwnerContactAccepted>('/owner-contacts/accept', { token }),

  listConversations: async () => asList<OwnerConversation>(`${BASE}/conversations`, await ApiClient.get<unknown>(`${BASE}/conversations`)),

  startConversation: (body: StartOwnerConversationBody) => ApiClient.post<OwnerConversation>(`${BASE}/conversations`, body),

  listMessages: async (conversationId: string) =>
    asList<OwnerMessage>(
      `${BASE}/conversations/${conversationId}/messages`,
      await ApiClient.get<unknown>(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`),
    ),

  postMessage: async (conversationId: string, body: string, file?: File): Promise<OwnerMessage> => {
    const form = new FormData();
    form.append('body', body);
    if (file) form.append('file', file);
    const response = await axios.post<OwnerMessage>(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadAttachment: (conversationId: string, messageId: string) =>
    getFile(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachment`),

  getInboxPreferences: () => ApiClient.get<OwnerInboxPreferences>(`${BASE}/inbox/preferences`),

  setInboxPreferences: (emailNotifications: boolean) => ApiClient.put<OwnerInboxPreferences>(`${BASE}/inbox/preferences`, { emailNotifications }),
};
