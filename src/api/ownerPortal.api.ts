import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import axios from '@/lib/axios';
import { ApiClient } from './client';
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
  OwnerPortalOverview,
  OwnerPortalProperty,
  OwnerPortalReportQuery,
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
