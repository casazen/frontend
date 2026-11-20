import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import { COMPLIANCE_HEALTH_KEY } from '@/queries/compliance-health';
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
import { SCHEDULED_MESSAGES_KEY } from '@/queries/use-scheduled-messages';
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

/** Whether a notification type is about a service request (its `entityId` is not a booking). */
export function isServiceRequestType(type: string | null): boolean {
  return type !== null && type.startsWith('service-request');
}

/** The guest of a booking completed the online check-in (`PushTypes.GuestCheckInCompleted`); its `entityId` is the booking. */
const GUEST_CHECKIN_COMPLETED = 'guest-checkin-completed';

/**
 * A guest handed the verification of the identity to a person (`PushTypes.VerificationRequired`, E03/F04/US02/T03): the operators who hold
 * `verification.decision` are told at once; its `entityId` is the booking.
 */
const VERIFICATION_REQUIRED = 'verification-required';

/**
 * A host asked CasaZen support to do a step (`PushTypes.AssistRequested`, «Fallo per me», E10/F03/US03/T03): the platform administrators are told at
 * once; its `entityId` is the request of help, not a booking.
 */
const ASSIST_REQUESTED = 'assist-requested';

/**
 * A host reopened a request support had closed («Non funziona», `PushTypes.AssistReopened`, E20/F03/US01/T02): the platform administrators are told at once, like for a new request,
 * and the queue open in front of them shows it again, with the note of the host. Its `entityId` is the request of help.
 */
const ASSIST_REOPENED = 'assist-reopened';

/**
 * Support closed a request of the host (`PushTypes.AssistVerified` when CasaZen read the connection on the panel, `PushTypes.AssistDeclared` when it could not, E20/F03/US01/T02): every
 * administrator of the org is told at once, and the page they have open shows where the request stands now. Its `entityId` is the request of help.
 */
const ASSIST_OUTCOME_TYPES: ReadonlySet<string> = new Set(['assist-verified', 'assist-declared']);

/** Whether a notification is about a request of help (its `entityId` is the request, not a booking). */
function isAssistType(type: string | null): boolean {
  return type === ASSIST_REQUESTED || type === ASSIST_REOPENED || (type !== null && ASSIST_OUTCOME_TYPES.has(type));
}

/** The guests list and the guest card (`['guests', …]`, not shared as a constant by the pages that read them). */
const GUESTS_QUERY = 'guests';

/**
 * The automatic delivery of the check-in link of a booking failed for good (`PushTypes.CheckInLinkFailed`, E23/F01/US01/T01, NF-122: sent to the hosts of the
 * booking, once for each link); its `entityId` is the booking.
 */
const CHECKIN_LINK_FAILED = 'checkin-link-failed';

/**
 * What a completed check-in changes on screen, apart from the bell: the booking and its page, the link of the online check-in (the
 * step "Cosa succede ora" reads it) and where it stands on its way to the guest (that delivery ends with the check-in), the guests of the stay and
 * Alloggiati Web, the cockpit and the counter of the menu, the Home, the guests of the organisation and the invoice data of the booking (the guest's
 * «yes» to «Ti serve la fattura?» and what the guest wrote, shown in «Dati di fatturazione» of the tab Pagamento). A page open in front of the host
 * shows it without a reload.
 */
const STALE_ON_CHECK_IN: readonly string[] = [
  BOOKINGS_KEY,
  CHECKIN_SESSION_KEY,
  CHECKIN_LINK_DELIVERY_KEY,
  ALLOGGIATI_KEY,
  COMPLIANCE_KEY,
  DASHBOARD_KEY,
  GUESTS_QUERY,
  INVOICE_DATA_KEY,
];

/**
 * What an event of a stay makes stale in its own section of the booking page (E20/F01/US02): the proofs and the send log of the stay, with the state of its guests on the
 * channel manager that the same read carries (`useBookingCompliance`). Only the reads of a stay: the list and the files of the archive are not touched.
 */
function refreshStayCompliance(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'booking'] });
}

function refreshCheckInData(queryClient: QueryClient): void {
  STALE_ON_CHECK_IN.forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
  // The coverage report of the archive of the proofs (E03/F03/US02) says what the cockpit says, obligation by obligation: the guests of the stay changed,
  // so an open «Riepilogo» reads it again too. The files of the archive are not here: a check-in adds none.
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'report'] });
  // The guests of the stay go to the channel manager after their check-in: the section of the stay shows where they stand without a reload.
  refreshStayCompliance(queryClient);
}

/**
 * What a link that did not reach the guest changes on screen, apart from the bell: where the link stands and the «Copia link» of the guest panel
 * (`CHECKIN_LINK_DELIVERY_KEY`), the state of its session, the booking, and the «To do» that tells the host to carry the link (the list and the number of the nav).
 * A booking page open in front of the host shows it without a reload.
 */
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
/** The police send of the channel manager is not active (`PushTypes.ConnectionInactive`): the connection health of the property says so too. */
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

/**
 * What a verification handed to an operator changes on screen: the queue of the verifications and its figures (the console open in front of the
 * operator shows the new guest without a reload), and the red mark of the cockpit and the counter of the menu (`operator_decision_required`).
 */
function refreshVerifications(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [VERIFICATION_KEY] });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
}

/**
 * A fiscal document of a booking was issued (`PushTypes.FiscalDocumentIssued`, E12/F01/US01/T02, sent to the hosts of the booking for a single issue and for what a correction issues by itself);
 * its `entityId` is the booking.
 */
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

/**
 * The guest paid the tourist tax of a stay online (`PushTypes.TouristTaxPaid`, E25/F01/US01/T01, sent to the hosts of the booking once the payment is recorded); its `entityId` is the booking.
 * Neither the guest nor an amount is in it: the pages read what changed from the tax of the booking.
 */
const TOURIST_TAX_PAID = 'tourist-tax-paid';

/**
 * A guest left a review on a channel (`PushTypes.OtaReviewReceived`), or a reply to a review, or the host's own review, did not reach the channel (`PushTypes.OtaReviewActionFailed`),
 * E05/F06/US02, NF-69: sent to the hosts of the booking, whose id is the `entityId`. Neither the guest nor a word of the review is in it: the pages read what changed from the review.
 */
const OTA_REVIEW_TYPES: ReadonlySet<string> = new Set(['ota-review-received', 'ota-review-action-failed']);

/**
 * What a payment of the tourist tax changes on screen: the tax of the booking, whose `collection` block says what the guest paid online and what is still to collect (the step «Tassa di
 * soggiorno» of the host wizard open in front of the host shows «Pagata online il …» without a reload). Without a booking, every tax that is open.
 */
function refreshTouristTax(queryClient: QueryClient, bookingId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: bookingId ? [TOURIST_TAX_KEY, bookingId] : [TOURIST_TAX_KEY] });
}

/**
 * A scheduled message of a booking was held back, failed, skipped (by CasaZen or by a person of the team) or went out outside the send window (`PushTypes.ScheduledMessageIssue`, E05/F07/US01, NF-71: sent to the
 * people who reach the property, through their preferences); its `entityId` is the booking. Neither the words of the message nor the guest are in it: the pages read what happened from the messages of the booking.
 */
const SCHEDULED_MESSAGE_ISSUE = 'scheduled-message-issue';

/**
 * What a scheduled message that needs a look changes on screen, apart from the bell: the timeline of the booking (the section «Messaggi programmati» of its tab Soggiorno, which shows the new state and the reason
 * without a reload) and the «To do» that tells the host to fix it (the list and the number of the nav). Without a booking, every timeline that is open.
 */
function refreshScheduledMessages(queryClient: QueryClient, bookingId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: bookingId ? [SCHEDULED_MESSAGES_KEY, bookingId] : [SCHEDULED_MESSAGES_KEY] });
  void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
}

/**
 * What a request of help from a host changes on screen: the staff queue of the «Fallo per me» requests (`ADMIN_ASSIST_KEY`, the list and its pages): the
 * page open in front of the staff shows the new request without a reload. The queries of anyone who has no such page do not exist, so nothing is read.
 */
function refreshAssistQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ADMIN_ASSIST_KEY });
}

/**
 * What a request that support closed changes on screen, for the host (E20/F03/US02/T01): the list of its requests (the status and the outcome, «Verificato» or «Dichiarato dal supporto», with
 * «Non funziona»), the guided steps, those the page follows too (`PANEL_STEPS_KEY`, the list and the step: the step passes to done), and the plan, the path, the activation checklist and the «Da fare»
 * list, where the request had its item. A page open in front of the host shows it without a reload. The queries of someone who has no such page do not exist, so nothing is read.
 */
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
 * (or a reply that was lost) the reviews: the section of the booking, the review that is open and the list of the hub (`invalidateReviews`), and a scheduled message that needs
 * a look the timeline of its booking and the «To do» list (`refreshScheduledMessages`).
 */
export function applyNotificationsChange(queryClient: QueryClient, change: NotificationsChange): void {
  queryClient.setQueryData(UNREAD_COUNT_KEY, change.unreadCount);
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY], predicate: (query) => query.queryKey[1] !== UNREAD_COUNT_KEY[1] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  // The entity is a booking, except for a service request and for a request of help.
  const entityIsBooking = !isServiceRequestType(change.type) && !isAssistType(change.type);
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
  // What a review that appeared, or a reply that was lost, changes: the section «Recensioni» of the open booking, the review that is open and the list of the reviews of the hub, without a reload.
  if (change.type !== null && OTA_REVIEW_TYPES.has(change.type)) invalidateReviews(queryClient);
  if (change.type === SCHEDULED_MESSAGE_ISSUE) refreshScheduledMessages(queryClient, change.entityId);
}

/** After a gap in the channel events may have been missed: everything the channel feeds is read again, the count included. */
export function refreshAfterGap(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  // A check-in completed while the channel was down sent no message: the pages that show its data read it again.
  refreshCheckInData(queryClient);
  // The same for a link that failed while it was down: the guest panel and the «To do» list.
  refreshCheckInLinkDelivery(queryClient);
  // The same for a verification handed to an operator, for a request of help that reached the staff, and for a request support closed (or the host reopened) in the meantime.
  refreshVerifications(queryClient);
  refreshAssistQueue(queryClient);
  refreshAssistOutcome(queryClient);
  // And for a document issued while the channel was down.
  refreshFiscalDocuments(queryClient);
  // And for a tourist tax paid while the channel was down.
  refreshTouristTax(queryClient);
  // And for a review that appeared, or a reply that was lost, while the channel was down.
  invalidateReviews(queryClient);
  // And for a scheduled message that was held back, failed or skipped while it was down: the timelines that are open, and the «To do» list.
  refreshScheduledMessages(queryClient);
}

// One connection per tab: every user of the hook shares this client, and the channel closes with the last one.
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
  /** False for a guest, a public page, the demo or a signed-out user: no channel is opened. */
  enabled: boolean;
  /** The channel is bound to a user: another user (or none) closes it and opens a new one. */
  userId: string | null;
  getAccessToken: () => Promise<string | undefined>;
  /** For tests: a client other than the shared SignalR one (it is then connected and disconnected by this hook alone). */
  client?: RealtimeClient;
  /**
   * Called when a NEW notification arrives (the bell shows a pop-up from it), after the cache is updated. Not for a notification
   * that was read: the server also sends the type and the booking when the host reads a guest thread, but then the count falls.
   * The latest function is the one called, a new one does not reopen the channel.
   */
  onNewNotification?: (change: NotificationsChange) => void;
  /**
   * Called when a popup alert arrives (`alertReceived`, ADR-025), as the server sent it. The latest function is the one called, a
   * new one does not reopen the channel.
   */
  onAlert?: (alert: PendingAlert) => void;
  /**
   * For a second user of the shared channel that wants only the alerts (the popup): the notifications cache is fed, and read again
   * after a gap, by the bell's own use of this hook, once. Fed twice, the change would be applied by whichever of the two comes first,
   * and the other would see the count already grown and miss that a notification is new (the pop-up of the bell would depend on the
   * order in which the two were mounted).
   */
  alertsOnly?: boolean;
}

/**
 * Keeps the real-time channel of the notifications open while `enabled` and feeds the query cache from it (`applyNotificationsChange`).
 * Returns its state, which the bell uses to poll only while the socket is down.
 */
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
          // A new notification makes the count grow; reading one makes it fall. Without a count to compare with (still loading) it
          // cannot be told, and a missing pop-up costs less than a wrong one: the badge shows the count either way.
          if (change.type !== null && typeof before === 'number' && change.unreadCount > before) onNewRef.current?.(change);
        });
    const offState = alertsOnly
      ? undefined
      : channel.onState((state) => {
          if (state === 'connected') {
            // Events sent while it was down are lost: a reconnect (not the first connection) reads everything again.
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
