import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
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

/**
 * The failure of a write without the request that carried it: the words of a message, the address and the name of a contact are in the body that was sent, and
 * whatever keeps the error (the cache of the mutations) would keep them. The status and the body of the answer stay, which is what a screen turns into words.
 */
async function personal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw withoutRequest(error);
  }
}

// ---------------------------------------------------------------- the numbers and the properties

/**
 * List properties with occupancy and revenue (ADR-011-R8).
 * Always fresh: read from server on mount.
 */
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
 */
export function useOwnerOverview(query: OwnerPortalReportQuery) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'overview', query],
    queryFn: () => ownerPortalApi.getOverview(query),
    placeholderData: keepPreviousData,
    ...PERSONAL,
  });
}

/** The same figures week by week or month by month (NF-96), each bucket next to its days one year earlier when asked. */
export function useOwnerTrend(query: OwnerPortalReportQuery) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'trend', query],
    queryFn: () => ownerPortalApi.getTrend(query),
    placeholderData: keepPreviousData,
    ...PERSONAL,
  });
}

// ---------------------------------------------------------------- calendar and owner stays

/** The runs of nights of a property: dates and a neutral kind, from the server. Not read without a property. */
export function useOwnerCalendar(propertyId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'calendar', propertyId ?? null, from, to],
    queryFn: () => ownerPortalApi.getCalendar(propertyId ?? '', from, to),
    enabled: Boolean(propertyId),
    ...PERSONAL,
  });
}

/** The owner stays of the owner profiles the person follows. */
export function useOwnerStays() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'stays'],
    queryFn: () => ownerPortalApi.listStays(),
    ...PERSONAL,
  });
}

/** The rule a request on the property follows, and the nights already held this year. */
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

/** Asks for an owner stay: a request, never a confirmed stay (the agency, or the rule, approves; the block must be acknowledged before it reads confirmed). */
export function useRequestOwnerStay() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: OwnerStayRequestBody) => personal(() => ownerPortalApi.requestStay(body)),
    onSuccess: () => invalidateStays(client),
  });
}

/** Withdraws an owner stay. */
export function useCancelOwnerStay() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (stayId: string) => personal(() => ownerPortalApi.cancelStay(stayId)),
    onSuccess: () => invalidateStays(client),
  });
}

// ---------------------------------------------------------------- documents and accounting

/** The documents the agency shares and the published statement versions. */
export function useOwnerDocuments() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'documents'],
    queryFn: () => ownerPortalApi.listDocuments(),
    ...PERSONAL,
  });
}

/** The links of the invoices the agency issued elsewhere for the published statement versions of the owner. */
export function useOwnerExternalDocuments() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'external-documents'],
    queryFn: () => ownerPortalApi.listExternalDocuments(),
    ...PERSONAL,
  });
}

// ---------------------------------------------------------------- delegated contacts

/** The contacts of the owner. A 403 `owner_contact_owner_only` is the answer for a person who is itself a contact. */
export function useOwnerContacts() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'contacts'],
    queryFn: () => ownerPortalApi.listContacts(),
    ...PERSONAL,
  });
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

/**
 * The signed-in account accepts the invitation of a contact. The secret of the link is a variable of this mutation: it is not kept after it (`gcTime: 0`, and the page
 * resets the mutation when it is done), and a refusal is kept without the request that carried it.
 */
export function useAcceptOwnerContact() {
  return useMutation({
    gcTime: 0,
    mutationFn: (token: string) => personal(() => ownerPortalApi.acceptContact(token)),
  });
}

// ---------------------------------------------------------------- inbox

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

/** Whether the person gets an e-mail when the agency writes. */
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
