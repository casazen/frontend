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
  OwnerPortalPermission,
  OwnerStay,
  OwnerStayRequestBody,
  OwnerStayRuleSummary,
  StartOwnerConversationBody,
} from '@/types';

const BASE = '/owner-portal';
const OVERVIEW_PATH = `${BASE}/overview`;
const TREND_PATH = `${BASE}/trend`;

/** The query string of the overview and of the trend: the days, the cut and whether the year before comes with them. */
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

/** A read that did not come back as an object (the page of another kind an odd proxy sends) is an error to show, not data to draw. */
function asReport<T>(url: string, data: unknown): T {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T;
}

/** A read that did not come back as a list is an error to show, never an empty list: «nothing here» is said only when the server said it. */
function asList<T>(url: string, data: unknown): T[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T[];
}

/** The documents and the statement versions: both lists must be there, or the answer is not the one of the endpoint. */
function asDocuments(url: string, data: unknown): OwnerPortalDocuments {
  const report = asReport<Partial<OwnerPortalDocuments>>(url, data);
  if (!Array.isArray(report.documents) || !Array.isArray(report.statements)) throw new UnexpectedApiResponseError(url);
  return { documents: report.documents, statements: report.statements };
}

/** The published statements: every item must be a statement with its totals, or the answer is not the one of the endpoint (nothing to draw an amount from). */
function asStatements(url: string, data: unknown): OwnerPortalStatement[] {
  const list = asList<Partial<OwnerPortalStatement> | null>(url, data);
  if (!list.every((item) => typeof item === 'object' && item !== null && typeof item.statementId === 'string' && typeof item.totals === 'object' && item.totals !== null)) {
    throw new UnexpectedApiResponseError(url);
  }
  return list as OwnerPortalStatement[];
}

/** A statement with its lines: the statement with its totals and both lists must be there, or the answer is not the one of the endpoint. */
function asStatementDetail(url: string, data: unknown): OwnerPortalStatementDetail {
  const detail = asReport<Partial<OwnerPortalStatementDetail>>(url, data);
  const { statement, sections, touristTax } = detail;
  if (typeof statement !== 'object' || statement === null || typeof statement.totals !== 'object' || statement.totals === null) throw new UnexpectedApiResponseError(url);
  if (!Array.isArray(sections) || !Array.isArray(touristTax)) throw new UnexpectedApiResponseError(url);
  if (!sections.every((section: { lines?: unknown } | null) => typeof section === 'object' && section !== null && Array.isArray(section.lines))) throw new UnexpectedApiResponseError(url);
  return detail as OwnerPortalStatementDetail;
}

/** The ZIP is streamed while the server builds it (the PDF and the XML of every document of the period): it may take minutes, not the 30 s of every other call. */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/** A file answer that says it is a web page or a JSON body is not the ZIP that was asked for (the `index.html` of a wrong rewrite). */
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

/** The value of a header of an answer, whatever the case of its name, or `null` (a browser lets a page read only the headers that the API exposes). */
function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
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

/** A file the portal hands out, with the name it is saved under chosen by the caller (the name of the server is not trusted for the disk). */
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
  /**
   * List properties with occupancy and revenue (ADR-011-R8).
   * Filtered by PropertyOwnership.OwnerUserId AND period active.
   */
  getProperties: async () => asList<OwnerPortalProperty>(`${BASE}/properties`, await ApiClient.get<unknown>(`${BASE}/properties`)),

  /**
   * The owner's properties on the Home's numbers (NF-96): occupancy, revenue, ADR and RevPAR of the days, with the same days one
   * year earlier and the differences when asked. Money is weighted by the share the owner holds; every number is the server's.
   */
  getOverview: async (query: OwnerPortalReportQuery) =>
    asReport<OwnerPortalOverview>(OVERVIEW_PATH, await ApiClient.get<unknown>(OVERVIEW_PATH, reportParams(query))),

  /** The same figures week by week or month by month, each bucket next to its days one year earlier when asked (NF-96). */
  getTrend: async (query: OwnerPortalReportQuery) =>
    asReport<OwnerPortalTrend>(TREND_PATH, await ApiClient.get<unknown>(TREND_PATH, reportParams(query))),

  // ---------------------------------------------------------------- calendar and owner stays (needs `calendar.read` / `stays.request`)

  /** The runs of nights of a property, dates and a neutral kind only (no guest, no channel, no text), cut to the ownerships of the caller. */
  getCalendar: async (propertyId: string, from?: string, to?: string) =>
    asReport<OwnerCalendar>(
      `${BASE}/calendar`,
      await ApiClient.get<unknown>(`${BASE}/calendar`, { propertyId, ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    ),

  /** The owner stays of the owner profiles the caller follows, newest arrival first. */
  listStays: async () => asList<OwnerStay>(`${BASE}/stays`, await ApiClient.get<unknown>(`${BASE}/stays`)),

  /** The rule a request on the property follows, and the nights already held this year. */
  getStayRule: async (propertyId: string) =>
    asReport<OwnerStayRuleSummary>(`${BASE}/stays/rule`, await ApiClient.get<unknown>(`${BASE}/stays/rule`, { propertyId })),

  /** Asks for an owner stay: a request, which blocks nothing until the agency (or the rule) approves it. */
  requestStay: (body: OwnerStayRequestBody) => ApiClient.post<OwnerStay>(`${BASE}/stays`, body),

  /** Withdraws an owner stay that has not ended; a repeat answers the same. */
  cancelStay: (stayId: string) => ApiClient.post<OwnerStay>(`${BASE}/stays/${encodeURIComponent(stayId)}/cancel`),

  // ---------------------------------------------------------------- documents and accounting (needs `documents.read` / `accounting.read`)

  /** The documents the caller may read, with their versions, and the published statement versions of the owner accounting. */
  listDocuments: async () => asDocuments(`${BASE}/documents`, await ApiClient.get<unknown>(`${BASE}/documents`)),

  /** The file of a document: the version in force, or `versionId`. The server writes the download before it hands the file out (the audit). */
  downloadDocument: (documentId: string, versionId?: string) =>
    getFile(`${BASE}/documents/${encodeURIComponent(documentId)}/file${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''}`),

  /** The links of the invoices the agency issued elsewhere for the owner's published statement versions. */
  listExternalDocuments: async () =>
    asList<OwnerPortalExternalDocument>(`${BASE}/external-documents`, await ApiClient.get<unknown>(`${BASE}/external-documents`)),

  // ---------------------------------------------------------------- statements with their amounts and the invoices of the property manager (needs `accounting.read`)

  /** The published statements of the owner with their totals, the latest first; a version a later one replaced is marked `superseded`. */
  listStatements: async () => asStatements(`${BASE}/statements`, await ApiClient.get<unknown>(`${BASE}/statements`)),

  /** One published statement with its lines grouped as in its PDF and the tourist tax box. A statement that is not the caller's is a 404, the same as one that is not there. */
  getStatement: async (statementId: string) => {
    const url = `${BASE}/statements/${encodeURIComponent(statementId)}`;
    return asStatementDetail(url, await ApiClient.get<unknown>(url));
  },

  /** The PDF stored with a published statement: exactly the file that was published. The server writes the download before it hands the file out. */
  downloadStatementPdf: (statementId: string) => getFile(`${BASE}/statements/${encodeURIComponent(statementId)}/pdf`),

  /** The invoices of the property manager to the owner, the latest first. */
  listInvoices: async () => asList<OwnerPortalInvoice>(`${BASE}/invoices`, await ApiClient.get<unknown>(`${BASE}/invoices`)),

  /** The PDF of one invoice, made from the document as it was issued, in the language of the person (Italian unless it is English). */
  downloadInvoicePdf: (invoiceId: string, language: 'it' | 'en') => getFile(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/pdf?lang=${language}`),

  // ---------------------------------------------------------------- the documents CasaZen issued in the name of the owner (needs `accounting.read`, E17/F03/US01/T03)

  /**
   * The documents CasaZen issued in the name of the owner (the receipts of a private owner, the invoices of a company, their credit notes), the newest first; `period` (`yyyy-MM` or `yyyy`) narrows them (400
   * `accountant_package_invalid_period`). An empty list is what the server says while the part is not open (the flags are off): the page tells it from the answer of the export.
   */
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

  // ---------------------------------------------------------------- delegated contacts (only the owner manages them)

  listContacts: async () => asList<OwnerContact>(`${BASE}/contacts`, await ApiClient.get<unknown>(`${BASE}/contacts`)),

  /** Invites a contact with its own account and the permissions given (at least one: an empty list is never «all»). */
  inviteContact: (body: InviteOwnerContactBody) => ApiClient.post<OwnerContact>(`${BASE}/contacts`, body),

  /** Changes what a contact may do: effective at its next request. */
  setContactPermissions: (contactId: string, permissions: OwnerPortalPermission[]) =>
    ApiClient.put<OwnerContact>(`${BASE}/contacts/${encodeURIComponent(contactId)}/permissions`, { permissions }),

  /** Withdraws a contact: nothing from its next request on. A repeat answers the same. */
  revokeContact: (contactId: string) => ApiClient.post<OwnerContact>(`${BASE}/contacts/${encodeURIComponent(contactId)}/revoke`),

  /** The signed-in account accepts the invitation of a contact (the secret goes in the body, never in a URL). */
  acceptContact: (token: string) => ApiClient.post<OwnerContactAccepted>('/owner-contacts/accept', { token }),

  // ---------------------------------------------------------------- inbox (needs `inbox.use`)

  listConversations: async () => asList<OwnerConversation>(`${BASE}/conversations`, await ApiClient.get<unknown>(`${BASE}/conversations`)),

  /** Opens a conversation with the agency and writes its first message. */
  startConversation: (body: StartOwnerConversationBody) => ApiClient.post<OwnerConversation>(`${BASE}/conversations`, body),

  listMessages: async (conversationId: string) =>
    asList<OwnerMessage>(
      `${BASE}/conversations/${conversationId}/messages`,
      await ApiClient.get<unknown>(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`),
    ),

  /** Writes a message (multipart: the words and an optional file of at most 10 MB, PDF, JPEG or PNG). */
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
