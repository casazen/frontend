import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import { COMPLIANCE_HEALTH_KEY } from '@/queries/compliance-health';
import { ADMIN_ASSIST_KEY } from '@/queries/use-admin-onboarding-assist';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { CHECKIN_SESSION_KEY } from '@/queries/use-checkin';
import { DASHBOARD_KEY } from '@/queries/use-dashboard';
import { INVOICE_DATA_KEY } from '@/queries/use-invoice-data';
import { FISCAL_DOCUMENTS_KEY } from '@/queries/use-fiscal-documents';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import { PAYMENTS_KEY } from '@/queries/use-payments';
import { VERIFICATION_KEY } from '@/queries/verification';
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

/** The guests list and the guest card (`['guests', …]`, not shared as a constant by the pages that read them). */
const GUESTS_QUERY = 'guests';

/**
 * What a completed check-in changes on screen, apart from the bell: the booking and its page, the link of the online check-in (the
 * step "Cosa succede ora" reads it), the guests of the stay and Alloggiati Web, the cockpit and the counter of the menu, the Home,
 * the guests of the organisation and the invoice data of the booking (the guest's «yes» to «Ti serve la fattura?» and what the guest wrote,
 * shown in «Dati di fatturazione» of the tab Pagamento). A page open in front of the host shows it without a reload.
 */
const STALE_ON_CHECK_IN: readonly string[] = [
  BOOKINGS_KEY,
  CHECKIN_SESSION_KEY,
  ALLOGGIATI_KEY,
  COMPLIANCE_KEY,
  DASHBOARD_KEY,
  GUESTS_QUERY,
  INVOICE_DATA_KEY,
];

function refreshCheckInData(queryClient: QueryClient): void {
  STALE_ON_CHECK_IN.forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
  // The coverage report of the archive of the proofs (E03/F03/US02) says what the cockpit says, obligation by obligation: the guests of the stay changed,
  // so an open «Riepilogo» reads it again too. The files of the archive are not here: a check-in adds none.
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'report'] });
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
 * an open page shows the new row without a reload) and, for a police send that is not active, the connection health of the properties. The list of the
 * files of the archive is not here: no alert adds or removes a file.
 */
function refreshComplianceLights(queryClient: QueryClient, type: string): void {
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'report'] });
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
 * What an issued document changes on screen: the list of the fiscal documents, the detail of a document, the documents of a booking (the card of its tab Pagamento) and the numbers the next
 * confirmation reads, all under `FISCAL_DOCUMENTS_KEY`, and the payment ledger, which shows the fiscal document of a booking. A page open in front of the host shows the new number and state
 * without a reload. The bulk issue and the daily run send nothing (one message per document would flood the bell): the page that asked for the bulk issue reads its own answer.
 */
function refreshFiscalDocuments(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_KEY });
  void queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
}

/**
 * What a request of help from a host changes on screen: the staff queue of the «Fallo per me» requests (`ADMIN_ASSIST_KEY`, the list and its pages): the
 * page open in front of the staff shows the new request without a reload. The queries of anyone who has no such page do not exist, so nothing is read.
 */
function refreshAssistQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ADMIN_ASSIST_KEY });
}

/**
 * What a change makes stale. The count is written as the server sent it (no extra request); the list, the threads of the Home and
 * the per-booking counters are read again; the thread of the booking in the change is read again too (an open tab shows the new
 * message at once). A change without an entity (read on another device, unknown type) refreshes every open thread. A completed
 * check-in also refreshes the data it changes (`STALE_ON_CHECK_IN`), and a request of help from a host the staff queue.
 */
export function applyNotificationsChange(queryClient: QueryClient, change: NotificationsChange): void {
  queryClient.setQueryData(UNREAD_COUNT_KEY, change.unreadCount);
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY], predicate: (query) => query.queryKey[1] !== UNREAD_COUNT_KEY[1] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  // The entity is a booking, except for a service request and for a request of help.
  const entityIsBooking = !isServiceRequestType(change.type) && change.type !== ASSIST_REQUESTED;
  if (change.entityId && entityIsBooking) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY, change.entityId] });
  } else if (!change.entityId) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  }
  if (change.type === GUEST_CHECKIN_COMPLETED) refreshCheckInData(queryClient);
  else if (change.type !== null && COMPLIANCE_ALERT_TYPES.has(change.type)) refreshComplianceLights(queryClient, change.type);
  if (change.type === VERIFICATION_REQUIRED) refreshVerifications(queryClient);
  if (change.type === ASSIST_REQUESTED) refreshAssistQueue(queryClient);
  if (change.type === FISCAL_DOCUMENT_ISSUED) refreshFiscalDocuments(queryClient);
}

/** After a gap in the channel events may have been missed: everything the channel feeds is read again, the count included. */
export function refreshAfterGap(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  // A check-in completed while the channel was down sent no message: the pages that show its data read it again.
  refreshCheckInData(queryClient);
  // The same for a verification handed to an operator, and for a request of help that reached the staff.
  refreshVerifications(queryClient);
  refreshAssistQueue(queryClient);
  // And for a document issued while the channel was down.
  refreshFiscalDocuments(queryClient);
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
