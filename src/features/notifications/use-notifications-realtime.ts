import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { ORG_DOMAIN_QUERY_KEY } from '@/features/settings/domain/use-org-domain';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import { COMPLIANCE_HEALTH_KEY } from '@/queries/compliance-health';
import { GUEST_REGISTER_KEY } from '@/queries/guestRegister';
import { ADMIN_ASSIST_KEY } from '@/queries/use-admin-onboarding-assist';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { CHECKIN_SESSION_KEY } from '@/queries/use-checkin';
import { CHECKIN_LINK_DELIVERY_KEY } from '@/queries/use-checkin-link-delivery';
import { TOURIST_TAX_KEY } from '@/queries/use-checkin-wizard';
import { DASHBOARD_KEY } from '@/queries/use-dashboard';
import { INVOICE_DATA_KEY } from '@/queries/use-invoice-data';
import { FISCAL_DOCUMENTS_KEY } from '@/queries/use-fiscal-documents';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import { invalidateReviews } from '@/queries/use-ota-reviews';
import { ASSIST_REQUESTS_KEY } from '@/queries/use-onboarding-assist';
import { invalidateOnboarding } from '@/queries/use-onboarding-plan';
import { PANEL_STEPS_KEY } from '@/queries/use-onboarding-panel-step';
import { PAYMENTS_KEY } from '@/queries/use-payments';
import { PROPERTIES_KEY } from '@/queries/use-properties';
import { SCHEDULED_MESSAGES_KEY } from '@/queries/use-scheduled-messages';
import { SWISS_NOTIFICATION_KEY, TICINO_POLICE_KEY } from '@/queries/swissCompliance';
import { TOURIST_TAX_SUMMARY_KEY } from '@/queries/use-tourist-tax-summary';
import { VERIFICATION_KEY } from '@/queries/verification';
import { ACCOUNTANT_PACKAGE_KEY } from '@/queries/use-accountant-package';
import type { PendingAlert } from '@/types/alert';
import {
  createRealtimeClient,
  createSignalrFactory,
  type NotificationsChange,
  type RealtimeClient,
  type RealtimeState,
} from './realtime-client';

export function isServiceRequestType(type: string | null): boolean {
  return type !== null && type.startsWith('service-request');
}

const GUEST_CHECKIN_COMPLETED = 'guest-checkin-completed';

const VERIFICATION_REQUIRED = 'verification-required';

const ASSIST_REQUESTED = 'assist-requested';

const ASSIST_REOPENED = 'assist-reopened';

const ASSIST_OUTCOME_TYPES: ReadonlySet<string> = new Set(['assist-verified', 'assist-declared']);

function isAssistType(type: string | null): boolean {
  return type === ASSIST_REQUESTED || type === ASSIST_REOPENED || (type !== null && ASSIST_OUTCOME_TYPES.has(type));
}

const GUESTS_QUERY = 'guests';

const CHECKIN_LINK_FAILED = 'checkin-link-failed';

/**
 * What a completed check-in changes on screen, apart from the bell: the booking and its page, the link of the online check-in (the
 * step "Cosa succede ora" reads it) and where it stands on its way to the guest (that delivery ends with the check-in), the guests of the stay and
 * Alloggiati Web, the cockpit and the counter of the menu, the Home, the guests of the organisation and the invoice data of the booking (the guest's
 * «yes» to «Ti serve la fattura?» and what the guest wrote, shown in «Dati di fatturazione» of the tab Pagamento), the arrival day of the Ticino police
 * notification (who is in its file, and who still misses data: `TICINO_POLICE_KEY`), the arrival day of the assisted notification of the other cantons (the guests as data to copy and what they
 * still miss: `SWISS_NOTIFICATION_KEY`) and the count of the guest register (`GUEST_REGISTER_KEY`: a check-in adds the guests of a stay to it). A page open in front of the host shows it
 * without a reload.
 */
const STALE_ON_CHECK_IN: readonly string[] = [
  BOOKINGS_KEY,
  CHECKIN_SESSION_KEY,
  CHECKIN_LINK_DELIVERY_KEY,
  ALLOGGIATI_KEY,
  COMPLIANCE_KEY,
  DASHBOARD_KEY,
  GUESTS_QUERY,
  GUEST_REGISTER_KEY,
  INVOICE_DATA_KEY,
  SWISS_NOTIFICATION_KEY,
  TICINO_POLICE_KEY,
];

function refreshStayCompliance(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'booking'] });
}

function refreshCheckInData(queryClient: QueryClient): void {
  STALE_ON_CHECK_IN.forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'report'] });
  refreshStayCompliance(queryClient);
}

function refreshCheckInLinkDelivery(queryClient: QueryClient): void {
  [CHECKIN_LINK_DELIVERY_KEY, CHECKIN_SESSION_KEY, BOOKINGS_KEY, INTERNAL_ACTIVITIES_KEY].forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
}

/**
 * CasaZen did a step of a stay in the host's place (`PushTypes.BookingFlowStep`, casazen/backend#978): registered the arrival or the departure, or declared the property ready once the
 * cleaning was done; its `entityId` is the booking. The booking and its step, Alloggiati Web, the cockpit, the Home and the «To do» list show it without a reload.
 */
const BOOKING_FLOW_STEP = 'booking-flow-step';

function refreshBookingFlowStep(queryClient: QueryClient): void {
  [BOOKINGS_KEY, ALLOGGIATI_KEY, COMPLIANCE_KEY, DASHBOARD_KEY, INTERNAL_ACTIVITIES_KEY].forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
}

/**
 * The notifications that say a light of the compliance cockpit changed (`PushTypes` of the stay alerts and of the alerts about a period or the
 * connection of a property, E03/F02/US02): the guest data missing, the deadline of Alloggiati Web near or past, a communication that failed, the
 * departure to close, the receipt missing, a short stay at risk, a stay over 30 nights, ISTAT and the tourist tax of a month, the police send that is
 * not active. An open page of the adempimenti, a booking or a property shows the new light without a reload. A verification handed to an operator
 * (`verification-required`) is not here: `refreshVerifications` reads the cockpit again together with the queue.
 */
const CONNECTION_INACTIVE = 'connection-inactive';

const COMPLIANCE_ALERT_TYPES: ReadonlySet<string> = new Set([
  'guest-data-missing',
  'alloggiati-deadline',
  'alloggiati-overdue',
  'alloggiati-failed',
  'checkout-reminder',
  'receipt-missing',
  'short-stay-at-risk',
  'over-thirty-nights',
  'istat-deadline',
  'tourist-tax-deadline',
  CONNECTION_INACTIVE,
]);

/**
 * What an alert that changes a light makes stale: the cockpit, the coverage report of the archive of the proofs (it says the same things by obligation:
 * an open page shows the new row without a reload), the Alloggiati status of the stays (a write to the channel manager that failed, a receipt that is missing) with
 * the section of the stay that shows it (E20/F01/US02) and, for a police send that is not active, the connection health of the properties. The list of the
 * files of the archive is not here: no alert adds or removes a file.
 */
function refreshComplianceLights(queryClient: QueryClient, type: string): void {
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'report'] });
  void queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY, 'status'] });
  refreshStayCompliance(queryClient);
  if (type === CONNECTION_INACTIVE) void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_HEALTH_KEY] });
}

function refreshVerifications(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [VERIFICATION_KEY] });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
}

const FISCAL_DOCUMENT_ISSUED = 'fiscal-document-issued';

/**
 * The SDI rejected an electronic invoice of a booking (`PushTypes.FiscalDocumentSdiRejected`, E17/F01/US02/T03, NF-86, sent to the hosts of the booking once the «To do» of its correction is raised); its `entityId` is the booking.
 * Neither the guest, nor an amount, nor the reason is in it: the pages read the document again, and the reason in plain words comes from its SDI state.
 */
const FISCAL_DOCUMENT_SDI_REJECTED = 'fiscal-document-sdi-rejected';

/**
 * What an issued document changes on screen: the list of the fiscal documents, the detail of a document, the documents of a booking (the card of its tab Pagamento) and the numbers the next
 * confirmation reads, all under `FISCAL_DOCUMENTS_KEY`, and the payment ledger, which shows the fiscal document of a booking, and the summary of the agency of the page «Commercialista»
 * (E15/F02/US01/T01), which counts the documents issued to the guests. A page open in front of the host shows the new number and state without a reload. The bulk issue and the daily run send
 * nothing (one message per document would flood the bell): the page that asked for the bulk issue reads its own answer. A rejection of the SDI (E17/F03/US01/T02) reads the same things: the state of the document
 * and its SDI panel (`['fiscal', 'documents', 'sdi', …]` are under the key) and the list «Da fare», which holds the item «Correggi la fattura».
 * The tourist tax summaries are read again too (`TOURIST_TAX_SUMMARY_KEY`, under which the reads of the year end are): the count of the nights in Ticino (E18/F01/US02/T03) is made of the documents issued, so the page
 * of the tourist tax at year end, open in front of the host, shows the new count without a reload.
 */
function refreshFiscalDocuments(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_KEY });
  void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
  void queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
  void queryClient.invalidateQueries({ queryKey: [ACCOUNTANT_PACKAGE_KEY] });
  void queryClient.invalidateQueries({ queryKey: [TOURIST_TAX_SUMMARY_KEY] });
}

const TOURIST_TAX_PAID = 'tourist-tax-paid';

const OTA_REVIEW_TYPES: ReadonlySet<string> = new Set(['ota-review-received', 'ota-review-action-failed']);

function refreshTouristTax(queryClient: QueryClient, bookingId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: bookingId ? [TOURIST_TAX_KEY, bookingId] : [TOURIST_TAX_KEY] });
}

const SCHEDULED_MESSAGE_ISSUE = 'scheduled-message-issue';

function refreshScheduledMessages(queryClient: QueryClient, bookingId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: bookingId ? [SCHEDULED_MESSAGES_KEY, bookingId] : [SCHEDULED_MESSAGES_KEY] });
  void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
}

/**
 * The notifications about the notification of the guests of a Ticino arrival day to the cantonal police (`PushTypes.IsTicinoNotification`, E30/F02/US01/T01 and E30/F02/US02/T01, NF-127, NF-128): the
 * alerts of the 24 hours (`ticino-notification-due`, `ticino-notification-overdue`) and the declaration of a day by a person of the org, or its undo (`ticino-notification-declared`). Their `entityId` is
 * the PROPERTY, never a booking nor the day.
 */
const TICINO_NOTIFICATION_TYPES: ReadonlySet<string> = new Set(['ticino-notification-due', 'ticino-notification-overdue', 'ticino-notification-declared']);

function isTicinoType(type: string | null): boolean {
  return type !== null && TICINO_NOTIFICATION_TYPES.has(type);
}

function refreshTicinoNotification(queryClient: QueryClient, propertyId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
  void queryClient.invalidateQueries({ queryKey: propertyId ? [TICINO_POLICE_KEY, propertyId] : [TICINO_POLICE_KEY] });
  void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
}

/**
 * The notifications about the assisted notification of the guests of an arrival day to the cantonal authority of a canton other than Ticino (`PushTypes.IsSwissNotification`, E31/F02/US01/T01,
 * NF-131): the alerts of the deadline (`swiss-notification-due`, `swiss-notification-overdue`) and the declaration of a day by a person of the org, or its undo (`swiss-notification-declared`).
 * Their `entityId` is the PROPERTY, never a booking nor the day.
 */
const SWISS_NOTIFICATION_TYPES: ReadonlySet<string> = new Set(['swiss-notification-due', 'swiss-notification-overdue', 'swiss-notification-declared']);

function isSwissType(type: string | null): boolean {
  return type !== null && SWISS_NOTIFICATION_TYPES.has(type);
}

function refreshSwissNotification(queryClient: QueryClient, propertyId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
  void queryClient.invalidateQueries({ queryKey: propertyId ? [SWISS_NOTIFICATION_KEY, propertyId] : [SWISS_NOTIFICATION_KEY] });
  void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
}

/**
 * The domain of the agency changed without the agency touching the page (E40/F01/US02, `be-auth0-host-sync`): the domain was verified (`domain-verified`), or the sign-in of the owners on it became
 * active (`owner-login-ready`) or did not (`owner-login-failed`). Sent to the administrators of the org; their `entityId` is the ORG, never a booking.
 */
const DOMAIN_TYPES: ReadonlySet<string> = new Set(['domain-verified', 'owner-login-ready', 'owner-login-failed']);

function isDomainType(type: string | null): boolean {
  return type !== null && DOMAIN_TYPES.has(type);
}

function refreshOrgDomain(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [ORG_DOMAIN_QUERY_KEY] });
}

function refreshAssistQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ADMIN_ASSIST_KEY });
}

function refreshAssistOutcome(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ASSIST_REQUESTS_KEY });
  void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_KEY });
  invalidateOnboarding(queryClient);
}

/**
 * What a change makes stale. The count is written as the server sent it (no extra request); the list, the threads of the Home and
 * the per-booking counters are read again; the thread of the booking in the change is read again too (an open tab shows the new
 * message at once). A change without an entity (read on another device, unknown type) refreshes every open thread. A completed
 * check-in also refreshes the data it changes (`STALE_ON_CHECK_IN`), a link that did not reach the guest the guest panel and the «To do» list
 * (`refreshCheckInLinkDelivery`), a request of help from a host (or reopened by it) the staff queue, a request support closed the requests of the host, a review of a guest that appeared
 * (or a reply that was lost) the reviews: the section of the booking, the review that is open and the list of the hub (`invalidateReviews`), a scheduled message that needs
 * a look the timeline of its booking and the «To do» list (`refreshScheduledMessages`), one about the Ticino police notification of a property the cockpit, the open days
 * of that property and the property queries (`refreshTicinoNotification`), one about the assisted notification of a property of another canton the same (`refreshSwissNotification`),
 * and one about the domain of the agency (verified, owner sign-in active or failed) the domain settings
 * of the org (`refreshOrgDomain`).
 */
export function applyNotificationsChange(queryClient: QueryClient, change: NotificationsChange): void {
  queryClient.setQueryData(UNREAD_COUNT_KEY, change.unreadCount);
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY], predicate: (query) => query.queryKey[1] !== UNREAD_COUNT_KEY[1] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  const entityIsBooking =
    !isServiceRequestType(change.type) && !isAssistType(change.type) && !isTicinoType(change.type) && !isSwissType(change.type) && !isDomainType(change.type);
  if (change.entityId && entityIsBooking) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY, change.entityId] });
  } else if (!change.entityId) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  }
  if (change.type === GUEST_CHECKIN_COMPLETED) refreshCheckInData(queryClient);
  else if (change.type === CHECKIN_LINK_FAILED) refreshCheckInLinkDelivery(queryClient);
  else if (change.type === BOOKING_FLOW_STEP) refreshBookingFlowStep(queryClient);
  else if (change.type !== null && COMPLIANCE_ALERT_TYPES.has(change.type)) refreshComplianceLights(queryClient, change.type);
  if (change.type === VERIFICATION_REQUIRED) refreshVerifications(queryClient);
  if (change.type === ASSIST_REQUESTED || change.type === ASSIST_REOPENED) refreshAssistQueue(queryClient);
  if (change.type !== null && ASSIST_OUTCOME_TYPES.has(change.type)) refreshAssistOutcome(queryClient);
  if (change.type === FISCAL_DOCUMENT_ISSUED || change.type === FISCAL_DOCUMENT_SDI_REJECTED) refreshFiscalDocuments(queryClient);
  if (change.type === TOURIST_TAX_PAID) refreshTouristTax(queryClient, change.entityId);
  if (change.type !== null && OTA_REVIEW_TYPES.has(change.type)) invalidateReviews(queryClient);
  if (change.type === SCHEDULED_MESSAGE_ISSUE) refreshScheduledMessages(queryClient, change.entityId);
  if (isTicinoType(change.type)) refreshTicinoNotification(queryClient, change.entityId);
  if (isSwissType(change.type)) refreshSwissNotification(queryClient, change.entityId);
  if (isDomainType(change.type)) refreshOrgDomain(queryClient);
}

export function refreshAfterGap(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  refreshCheckInData(queryClient);
  refreshCheckInLinkDelivery(queryClient);
  refreshVerifications(queryClient);
  refreshAssistQueue(queryClient);
  refreshAssistOutcome(queryClient);
  refreshFiscalDocuments(queryClient);
  refreshTouristTax(queryClient);
  invalidateReviews(queryClient);
  refreshScheduledMessages(queryClient);
  refreshTicinoNotification(queryClient);
  refreshSwissNotification(queryClient);
  refreshOrgDomain(queryClient);
}

let sharedClient: RealtimeClient | null = null;
let sharedUsers = 0;
let currentTokenGetter: () => Promise<string | undefined> = async () => undefined;

function getShared(): RealtimeClient {
  sharedClient ??= createRealtimeClient(createSignalrFactory(() => currentTokenGetter()));
  return sharedClient;
}

function acquireShared(getAccessToken: () => Promise<string | undefined>): RealtimeClient {
  currentTokenGetter = getAccessToken;
  sharedUsers += 1;
  return getShared();
}

function releaseShared(): void {
  sharedUsers = Math.max(0, sharedUsers - 1);
  if (sharedUsers === 0) sharedClient?.disconnect();
}

interface Options {
  enabled: boolean;
  userId: string | null;
  getAccessToken: () => Promise<string | undefined>;
  client?: RealtimeClient;
  onNewNotification?: (change: NotificationsChange) => void;
  onAlert?: (alert: PendingAlert) => void;
  alertsOnly?: boolean;
}

export function useNotificationsRealtime({
  enabled,
  userId,
  getAccessToken,
  client,
  onNewNotification,
  onAlert,
  alertsOnly = false,
}: Options): RealtimeState {
  const queryClient = useQueryClient();
  const active = enabled && userId !== null;
  const onNewRef = useRef(onNewNotification);
  const onAlertRef = useRef(onAlert);
  useEffect(() => {
    onNewRef.current = onNewNotification;
    onAlertRef.current = onAlert;
  });

  useEffect(() => {
    if (!active) return;
    const channel = client ?? acquireShared(getAccessToken);
    let wasConnected = channel.getState() === 'connected';
    let hadGap = false;
    const offChange = alertsOnly
      ? undefined
      : channel.onChange((change) => {
          const before = queryClient.getQueryData<number>(UNREAD_COUNT_KEY);
          applyNotificationsChange(queryClient, change);
          if (change.type !== null && typeof before === 'number' && change.unreadCount > before) onNewRef.current?.(change);
        });
    const offState = alertsOnly
      ? undefined
      : channel.onState((state) => {
          if (state === 'connected') {
            if (hadGap) refreshAfterGap(queryClient);
            hadGap = false;
            wasConnected = true;
          } else if (wasConnected) {
            hadGap = true;
          }
        });
    const offAlert = channel.onAlert((alert) => onAlertRef.current?.(alert));
    channel.connect();
    return () => {
      offChange?.();
      offState?.();
      offAlert();
      if (client) client.disconnect();
      else releaseShared();
    };
    // `getAccessToken` is read when a connection opens, through `currentTokenGetter`: a new function must not reopen the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, client, queryClient, alertsOnly]);

  const target = client ?? getShared();
  const subscribe = useCallback((listener: () => void) => target.onState(listener), [target]);
  return useSyncExternalStore(subscribe, () => target.getState(), () => 'disconnected');
}
