import { AlertTriangle, BedDouble, Bell, CalendarClock, ClipboardCheck, Coins, FileWarning, LifeBuoy, LogOut, MessageSquare, ShieldAlert, ShieldCheck, UserCheck, Wrench, type LucideIcon } from 'lucide-react';
import type { InAppNotification } from '@/api/notifications.api';
import type { AppContextKey, PermissionPredicate } from '@/config/route-manifest';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';

interface NotificationKind {
  icon: LucideIcon;
  /** Sentence in the language of the user (`notifications.types.*`). */
  textKey: string;
  /**
   * Where a click goes, given the id of the entity (a booking, a service request for `service-request-*`, a request of help for `assist-requested`) and, when the caller knows it, what the
   * person may do: a page that needs a permission falls back to one the person can open.
   */
  route: (entityId: string, context: AppContextKey | null, hasPermission?: PermissionPredicate) => string;
}

const BOOKINGS = '/app/short-rent/bookings';
const bookingRoute = (id: string) => `${BOOKINGS}/${encodeURIComponent(id)}`;
const bookingTab = (tab: string) => (id: string) => `${bookingRoute(id)}?tab=${tab}`;

/**
 * The tax step of the host wizard of the booking (`/check-in?step=tax`, E25/F01/US02/T01): where the collection of the tourist tax and what is owed back to the guest are told (the page
 * of the booking tells neither). The wizard needs `booking.write`: whoever may not write the booking goes to the page of the booking, as before.
 */
const bookingTaxStep = (id: string, _context: AppContextKey | null, hasPermission?: PermissionPredicate) =>
  hasPermission && !hasPermission('short-rent', 'booking.write') ? bookingRoute(id) : `${bookingRoute(id)}/check-in?step=tax`;

/** A service request: the supplier opens it in the inbox; the host finds it in «Le tue richieste» of «Le mie app» of the marketplace. */
const serviceRequestRoute = (id: string, context: AppContextKey | null) =>
  context === 'supplier' ? `/app/supplier/inbox/${encodeURIComponent(id)}` : '/app/short-rent/marketplace/mine';

const serviceRequest = (textKey: string): NotificationKind => ({ icon: Wrench, textKey, route: serviceRequestRoute });

/** The console of the identity verifications: the bell tells the operators (who hold `verification.decision`) that a guest waits for a person. */
const VERIFICATIONS_ROUTE = '/app/short-rent/verifications';

/** The staff queue of the «Fallo per me» requests (`onboarding-routes.ts`): the bell tells the platform administrators that a host asked CasaZen support to do a step. */
const ASSIST_QUEUE_ROUTE = '/app/admin/onboarding-assist';

/**
 * The push types of the backend (`PushTypes`) the bell knows. A type that is not here is shown with a generic sentence and
 * opens nothing: a newer server must not break an older app.
 */
const KINDS: Record<string, NotificationKind> = {
  'new-booking': { icon: BedDouble, textKey: 'notifications.types.newBooking', route: bookingRoute },
  'guest-message': { icon: MessageSquare, textKey: 'notifications.types.guestMessage', route: bookingTab('messages') },
  // The guest finished the online check-in: Documenti shows the link's state and the guests registered.
  'guest-checkin-completed': { icon: UserCheck, textKey: 'notifications.types.guestCheckinCompleted', route: bookingTab('guest') },
  'guest-data-missing': { icon: ClipboardCheck, textKey: 'notifications.types.guestDataMissing', route: bookingTab('guest') },
  // E23/F01/US01/T01: the check-in link of a stay from a portal did not reach the guest and the host carries it; Documenti shows why and has «Copia link».
  'checkin-link-failed': { icon: AlertTriangle, textKey: 'notifications.types.checkinLinkFailed', route: bookingTab('guest') },
  // E03/F04/US02/T03: a guest handed the verification of the identity to a person; the operators open the console.
  'verification-required': { icon: ShieldCheck, textKey: 'notifications.types.verificationRequired', route: () => VERIFICATIONS_ROUTE },
  // E10/F03/US03/T03: a host asked CasaZen support to do a step («Fallo per me»); the entity is the request, and the staff open the queue of the requests.
  'assist-requested': { icon: LifeBuoy, textKey: 'notifications.types.assistRequested', route: () => ASSIST_QUEUE_ROUTE },
  // E20/F03/US01/T02: the host reopened a request support had closed («Non funziona»); the entity is the request, and the staff open the same queue.
  'assist-reopened': { icon: LifeBuoy, textKey: 'notifications.types.assistReopened', route: () => ASSIST_QUEUE_ROUTE },
  // E20/F03/US01/T02: support closed a request of the host: «Il collegamento è attivo» (CasaZen read it on the panel) or «Il supporto dichiara di aver collegato ...» (it could not). The
  // entity is the request, which carries neither the property nor the person, so the click opens the plan of the activation, where the part shows where it stands.
  'assist-verified': { icon: ShieldCheck, textKey: 'notifications.types.assistVerified', route: () => ONBOARDING_PLAN_PATH },
  'assist-declared': { icon: LifeBuoy, textKey: 'notifications.types.assistDeclared', route: () => ONBOARDING_PLAN_PATH },
  'alloggiati-deadline': { icon: CalendarClock, textKey: 'notifications.types.alloggiatiDeadline', route: bookingTab('alloggiati') },
  'alloggiati-overdue': { icon: ShieldAlert, textKey: 'notifications.types.alloggiatiOverdue', route: bookingTab('alloggiati') },
  'alloggiati-failed': { icon: AlertTriangle, textKey: 'notifications.types.alloggiatiFailed', route: bookingTab('alloggiati') },
  // E17/F01/US02/T03: the SDI rejected an invoice of the booking; the booking's tab Pagamento holds its documents, and the «Da fare» item "Correggi la fattura" opens the correction from the documents page.
  'fiscal-document-sdi-rejected': { icon: FileWarning, textKey: 'notifications.types.fiscalDocumentSdiRejected', route: bookingTab('payment') },
  'checkout-reminder': { icon: LogOut, textKey: 'notifications.types.checkoutReminder', route: bookingRoute },
  // E25/F01/US01/T01: a guest paid the tourist tax of a stay online; the entity is the booking, which the pages that show the state of the collection read again. The state is in the tax
  // step of the check-in wizard of the booking, so the click opens it there.
  'tourist-tax-paid': { icon: Coins, textKey: 'notifications.types.touristTaxPaid', route: bookingTaxStep },
  'ota-stay-review': { icon: AlertTriangle, textKey: 'notifications.types.otaStayReview', route: bookingRoute },
  'service-request-created': serviceRequest('notifications.types.serviceRequestCreated'),
  'service-request-auto-accepted': serviceRequest('notifications.types.serviceRequestAutoAccepted'),
  'service-request-taken': serviceRequest('notifications.types.serviceRequestTaken'),
  'service-request-started': serviceRequest('notifications.types.serviceRequestStarted'),
  'service-request-completed': serviceRequest('notifications.types.serviceRequestCompleted'),
  'service-request-rejected': serviceRequest('notifications.types.serviceRequestRejected'),
  'service-request-paid': serviceRequest('notifications.types.serviceRequestPaid'),
  'service-request-cancelled': serviceRequest('notifications.types.serviceRequestCancelled'),
  'service-request-reminder': serviceRequest('notifications.types.serviceRequestReminder'),
  'service-request-time-proposed': serviceRequest('notifications.types.serviceRequestTimeProposed'),
  'service-request-proposal-accepted': serviceRequest('notifications.types.serviceRequestProposalAccepted'),
  'service-request-proposal-rejected': serviceRequest('notifications.types.serviceRequestProposalRejected'),
  'service-request-rescheduled': serviceRequest('notifications.types.serviceRequestRescheduled'),
  'service-request-quote-sent': serviceRequest('notifications.types.serviceRequestQuoteSent'),
  'service-request-quote-accepted': serviceRequest('notifications.types.serviceRequestQuoteAccepted'),
  'service-request-quote-rejected': serviceRequest('notifications.types.serviceRequestQuoteRejected'),
  'service-request-quote-expired': serviceRequest('notifications.types.serviceRequestQuoteExpired'),
  'service-request-day-before': serviceRequest('notifications.types.serviceRequestDayBefore'),
  // SP-BKP: the notices of a supplier that has a request as a backup.
  'service-request-backup-invited': serviceRequest('notifications.types.serviceRequestBackupInvited'),
  'service-request-backup-active': serviceRequest('notifications.types.serviceRequestBackupActive'),
  'service-request-backup-won': serviceRequest('notifications.types.serviceRequestBackupWon'),
  'service-request-backup-closed': serviceRequest('notifications.types.serviceRequestBackupClosed'),
  'service-payment-received': serviceRequest('notifications.types.servicePaymentReceived'),
};

const GENERIC_KIND = { icon: Bell, textKey: 'notifications.types.generic' } as const;

/** Icon and sentence key of a notification; the generic ones for a type the app does not know. */
export function notificationKind(type: string): { icon: LucideIcon; textKey: string } {
  return KINDS[type] ?? GENERIC_KIND;
}

/** Where a click on the notification goes; `null` when it has nowhere to go (unknown type, or no entity). `hasPermission` is what the person may do, when the caller knows it. */
export function notificationRoute(
  notification: Pick<InAppNotification, 'type' | 'entityId'>,
  context: AppContextKey | null,
  hasPermission?: PermissionPredicate,
): string | null {
  const kind = KINDS[notification.type];
  if (!kind || !notification.entityId) return null;
  return kind.route(notification.entityId, context, hasPermission);
}

export const KNOWN_NOTIFICATION_TYPES: readonly string[] = Object.keys(KINDS);

/** The number on a badge: 99+ above that. */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
