import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { issuedDocumentsFileName } from '@/api/owner-issuer-profiles.api';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { ownerReadStateOf } from '@/features/owner-portal/owner-portal-model';
import { saveDownload } from './save-download';
import type {
  InviteOwnerContactBody,
  OwnerInboxPreferences,
  OwnerPortalPermission,
  OwnerPortalReportQuery,
  OwnerStayRequestBody,
  StartOwnerConversationBody,
} from '@/types';

export const OWNER_PORTAL_KEY = 'owner-portal';

/**
 * Everything the owner portal reads is personal data of the owner (the name of a contact, the words of a message, the documents, the statements, the stays): it is
 * kept only while a page that shows it is on screen (`gcTime: 0`), read again at every visit (`refetchOnMount: 'always'`), and gone from the cache when the person
 * leaves the portal (`clearOwnerPortalCache`). Nothing is polled: a page is read when it opens and when the window comes back.
 */
const PERSONAL = {
  gcTime: 0,
  staleTime: 30_000,
  refetchOnMount: 'always' as const,
};

/**
 * Drops everything of the portal from the cache of the queries: called when the person leaves the portal (the shell unmounts) and before the sign-out, so that
 * nothing of an owner stays in memory for the next person of this browser.
 */
export function clearOwnerPortalCache(client: QueryClient): void {
  void client.cancelQueries({ queryKey: [OWNER_PORTAL_KEY] });
  client.removeQueries({ queryKey: [OWNER_PORTAL_KEY] });
}

async function personal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw withoutRequest(error);
  }
}

export function useOwnerProperties() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'properties'],
    queryFn: () => ownerPortalApi.getProperties(),
    ...PERSONAL,
  });
}

/**
 * The owner's properties on the Home's numbers for the days of `query` (NF-96): occupancy, revenue, ADR and RevPAR, next to the same
 * days one year earlier when it asks. Read again at every visit; the previous numbers stay on screen while the next load.
 * NO page reads it today: the Home's service behind it answers nothing for an owner (S101 follow-up), so the portal says the numbers are not available yet (`OwnerDashboard`)
 * instead of drawing zeros. The page that draws them comes back with the answer.
 */
export function useOwnerOverview(query: OwnerPortalReportQuery) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'overview', query],
    queryFn: () => ownerPortalApi.getOverview(query),
    placeholderData: keepPreviousData,
    ...PERSONAL,
  });
}

export function useOwnerTrend(query: OwnerPortalReportQuery) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'trend', query],
    queryFn: () => ownerPortalApi.getTrend(query),
    placeholderData: keepPreviousData,
    ...PERSONAL,
  });
}

export function useOwnerCalendar(propertyId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'calendar', propertyId ?? null, from, to],
    queryFn: () => ownerPortalApi.getCalendar(propertyId ?? '', from, to),
    enabled: Boolean(propertyId),
    ...PERSONAL,
  });
}

export function useOwnerStays() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'stays'],
    queryFn: () => ownerPortalApi.listStays(),
    ...PERSONAL,
  });
}

export function useOwnerStayRule(propertyId: string | undefined) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'stay-rule', propertyId ?? null],
    queryFn: () => ownerPortalApi.getStayRule(propertyId ?? ''),
    enabled: Boolean(propertyId),
    ...PERSONAL,
  });
}

function invalidateStays(client: QueryClient) {
  void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'stays'] });
  void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'calendar'] });
  void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'stay-rule'] });
}

export function useRequestOwnerStay() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: OwnerStayRequestBody) => personal(() => ownerPortalApi.requestStay(body)),
    onSuccess: () => invalidateStays(client),
  });
}

export function useCancelOwnerStay() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (stayId: string) => personal(() => ownerPortalApi.cancelStay(stayId)),
    onSuccess: () => invalidateStays(client),
  });
}

export function useOwnerDocuments() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'documents'],
    queryFn: () => ownerPortalApi.listDocuments(),
    ...PERSONAL,
  });
}

export function useOwnerExternalDocuments() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'external-documents'],
    queryFn: () => ownerPortalApi.listExternalDocuments(),
    ...PERSONAL,
  });
}

export function useOwnerStatements() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'statements'],
    queryFn: () => ownerPortalApi.listStatements(),
    ...PERSONAL,
  });
}

export function useOwnerWithholding(year: number, enabled: boolean) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'withholding', year],
    queryFn: () => ownerPortalApi.getWithholding(year),
    enabled,
    ...PERSONAL,
  });
}

export function useOwnerStatement(statementId: string | undefined) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'statement', statementId ?? null],
    queryFn: () => ownerPortalApi.getStatement(statementId ?? ''),
    enabled: Boolean(statementId),
    ...PERSONAL,
  });
}

export function useOwnerInvoices() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'invoices'],
    queryFn: () => ownerPortalApi.listInvoices(),
    ...PERSONAL,
  });
}

/**
 * The documents CasaZen issued in the name of the owner (the receipts of a private owner, the invoices of a company, their credit notes): the number, the day, the kind, the total in its currency and the
 * state towards the SDI, nothing of a guest. Like everything the portal reads it is kept only while the page is on screen, read again at every visit and gone when the person leaves the portal (`PERSONAL`).
 * `period` (`yyyy-MM` or `yyyy`) narrows the list. A 404 is the part not being open, whatever an earlier answer left (the page asks `isError` first).
 */
export function useOwnerIssuedDocuments(period?: string) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'issued-documents', period ?? null],
    queryFn: () => ownerPortalApi.listIssuedDocuments(period),
    ...PERSONAL,
  });
}

interface IssuedExportRequest {
  period: string;
  signal?: AbortSignal;
}

export function useOwnerIssuedDocumentsExport() {
  return useMutation({
    gcTime: 0,
    mutationFn: ({ period, signal }: IssuedExportRequest): Promise<void> => saveDownload(ownerPortalApi.exportIssuedDocuments(period, { signal }), issuedDocumentsFileName(period)),
  });
}

export function useOwnerContacts() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'contacts'],
    queryFn: () => ownerPortalApi.listContacts(),
    ...PERSONAL,
  });
}

/**
 * Whether the person may manage the contacts, found by asking for them once: the list is read and thrown away (the answer kept is only «yes»), so that the names and the addresses of
 * the contacts are in memory only on the page that shows them. Only an owner manages contacts (403 `owner_contact_owner_only` for a contact it let in); a part of the portal that is
 * not open (404) or a refusal of any other kind shows no entry either. A read that failed for a reason that passes (no answer, a 5xx) keeps the entry, and the page says what happened
 * and lets the person try again.
 */
export function useCanManageOwnerContacts(): boolean {
  const query = useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'contacts-access'],
    queryFn: async () => {
      await ownerPortalApi.listContacts();
      return true;
    },
    gcTime: 0,
    staleTime: 60_000,
    refetchOnMount: 'always',
    retry: false,
  });
  if (query.isSuccess) return true;
  return query.isError && ownerReadStateOf(query.error) === 'failed';
}

function invalidateContacts(client: QueryClient) {
  void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'contacts'] });
}

export function useInviteOwnerContact() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: InviteOwnerContactBody) => personal(() => ownerPortalApi.inviteContact(body)),
    onSuccess: () => invalidateContacts(client),
  });
}

export function useSetOwnerContactPermissions() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (variables: { contactId: string; permissions: OwnerPortalPermission[] }) =>
      personal(() => ownerPortalApi.setContactPermissions(variables.contactId, variables.permissions)),
    onSuccess: () => invalidateContacts(client),
  });
}

export function useRevokeOwnerContact() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (contactId: string) => personal(() => ownerPortalApi.revokeContact(contactId)),
    onSuccess: () => invalidateContacts(client),
  });
}

export function useAcceptOwnerContact() {
  return useMutation({
    gcTime: 0,
    mutationFn: (token: string) => personal(() => ownerPortalApi.acceptContact(token)),
  });
}

export function useOwnerConversations() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'conversations'],
    queryFn: () => ownerPortalApi.listConversations(),
    ...PERSONAL,
  });
}

export function useOwnerMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'messages', conversationId ?? null],
    queryFn: () => ownerPortalApi.listMessages(conversationId ?? ''),
    enabled: Boolean(conversationId),
    ...PERSONAL,
  });
}

export function useStartOwnerConversation() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: StartOwnerConversationBody) => personal(() => ownerPortalApi.startConversation(body)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'conversations'] });
    },
  });
}

export function usePostOwnerMessage(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (variables: { body: string; file?: File }) => personal(() => ownerPortalApi.postMessage(conversationId, variables.body, variables.file)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'messages', conversationId] });
      void client.invalidateQueries({ queryKey: [OWNER_PORTAL_KEY, 'conversations'] });
    },
  });
}

export function useOwnerInboxPreferences() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'inbox-preferences'],
    queryFn: () => ownerPortalApi.getInboxPreferences(),
    ...PERSONAL,
  });
}

export function useSetOwnerInboxPreferences() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (emailNotifications: boolean) => personal(() => ownerPortalApi.setInboxPreferences(emailNotifications)),
    onSuccess: (preferences: OwnerInboxPreferences) => {
      client.setQueryData([OWNER_PORTAL_KEY, 'inbox-preferences'], preferences);
    },
  });
}
