import { AlertTriangle, BedDouble, Bell, CalendarClock, ClipboardCheck, Coins, FileCheck, FileWarning, Globe, LifeBuoy, LogOut, MessageSquare, ShieldAlert, ShieldCheck, Star, UserCheck, Wrench, type LucideIcon } from 'lucide-react';
import type { InAppNotification } from '@/api/notifications.api';
import type { AppContextKey, PermissionPredicate } from '@/config/route-manifest';
import { swissLayerPath } from '@/features/compliance/swiss/swiss-layer-address';
import { ticinoLayerPath } from '@/features/compliance/ticino/ticino-layer-address';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';

interface NotificationKind {
  icon: LucideIcon;
  textKey: string;
  route: (entityId: string, context: AppContextKey | null, hasPermission?: PermissionPredicate) => string;
}

const BOOKINGS = '/app/short-rent/bookings';
const bookingRoute = (id: string) => `${BOOKINGS}/${encodeURIComponent(id)}`;
const bookingTab = (tab: string) => (id: string) => `${bookingRoute(id)}?tab=${tab}`;

const bookingTaxStep = (id: string, _context: AppContextKey | null, hasPermission?: PermissionPredicate) =>
  hasPermission && !hasPermission('short-rent', 'booking.write') ? bookingRoute(id) : `${bookingRoute(id)}/check-in?step=tax`;

const serviceRequestRoute = (id: string, context: AppContextKey | null) =>
  context === 'supplier' ? `/app/supplier/inbox/${encodeURIComponent(id)}` : '/app/short-rent/marketplace/mine';

const serviceRequest = (textKey: string): NotificationKind => ({ icon: Wrench, textKey, route: serviceRequestRoute });

/**
 * The notification of the guests of an arrival day to the cantonal authority (Ticino: E30/F02/US03/T01, NF-127; the other cantons: E31/F02/US02/T02, NF-131): the entity of the bell entry
 * is the PROPERTY (`QueuedInAppNotification.From`), never the day, so the click opens the layer of that property over the cockpit, which opens on its first day still to notify
 * (`ticinoLayerPath`, `swissLayerPath`). The cockpit asks `property.read` and `booking.read` (the day it lists also asks the guests): whoever may not open it goes to the page of the
 * property, as before the layer.
 */
const propertyLayerRoute =
  (layerPath: (propertyId: string) => string) =>
  (id: string, _context: AppContextKey | null, hasPermission?: PermissionPredicate) =>
    hasPermission && !(hasPermission('short-rent', 'property.read') && hasPermission('short-rent', 'booking.read'))
      ? `/app/short-rent/properties/${encodeURIComponent(id)}`
      : layerPath(id);

const ticinoRoute = propertyLayerRoute(ticinoLayerPath);
const swissRoute = propertyLayerRoute(swissLayerPath);

const VERIFICATIONS_ROUTE = '/app/short-rent/verifications';

const ASSIST_QUEUE_ROUTE = '/app/admin/onboarding-assist';

const DOMAIN_SETTINGS_ROUTE = '/app/short-rent/settings/domain';

const KINDS: Record<string, NotificationKind> = {
  'new-booking': { icon: BedDouble, textKey: 'notifications.types.newBooking', route: bookingRoute },
  'guest-stay-change-requested': { icon: CalendarClock, textKey: 'notifications.types.guestStayChange', route: bookingTab('portal') },
  'guest-portal-request': { icon: ClipboardCheck, textKey: 'notifications.types.guestPortalRequest', route: () => '/app/short-rent/activities' },
  'guest-message': { icon: MessageSquare, textKey: 'notifications.types.guestMessage', route: bookingTab('messages') },
  'guest-checkin-completed': { icon: UserCheck, textKey: 'notifications.types.guestCheckinCompleted', route: bookingTab('guest') },
  'booking-flow-step': { icon: CalendarClock, textKey: 'notifications.types.bookingFlowStep', route: bookingRoute },
  'guest-data-missing': { icon: ClipboardCheck, textKey: 'notifications.types.guestDataMissing', route: bookingTab('guest') },
  'checkin-link-failed': { icon: AlertTriangle, textKey: 'notifications.types.checkinLinkFailed', route: bookingTab('guest') },
  'scheduled-message-issue': { icon: AlertTriangle, textKey: 'notifications.types.scheduledMessageIssue', route: bookingRoute },
  'verification-required': { icon: ShieldCheck, textKey: 'notifications.types.verificationRequired', route: () => VERIFICATIONS_ROUTE },
  'assist-requested': { icon: LifeBuoy, textKey: 'notifications.types.assistRequested', route: () => ASSIST_QUEUE_ROUTE },
  'assist-reopened': { icon: LifeBuoy, textKey: 'notifications.types.assistReopened', route: () => ASSIST_QUEUE_ROUTE },
  'assist-verified': { icon: ShieldCheck, textKey: 'notifications.types.assistVerified', route: () => ONBOARDING_PLAN_PATH },
  'assist-declared': { icon: LifeBuoy, textKey: 'notifications.types.assistDeclared', route: () => ONBOARDING_PLAN_PATH },
  'alloggiati-deadline': { icon: CalendarClock, textKey: 'notifications.types.alloggiatiDeadline', route: bookingTab('alloggiati') },
  'alloggiati-overdue': { icon: ShieldAlert, textKey: 'notifications.types.alloggiatiOverdue', route: bookingTab('alloggiati') },
  'alloggiati-failed': { icon: AlertTriangle, textKey: 'notifications.types.alloggiatiFailed', route: bookingTab('alloggiati') },
  // E12/F01/US01/T02: a fiscal document of the booking was issued (`PushTypes.FiscalDocumentIssued`, sent to the hosts of the booking; the entity is the booking, never the document); the booking's
  // tab Pagamento holds its documents (the card of the booking), as for a document the SDI rejected. The pages that show it read it again as the push arrives (`use-notifications-realtime.ts`).
  'fiscal-document-issued': { icon: FileCheck, textKey: 'notifications.types.fiscalDocumentIssued', route: bookingTab('payment') },
  // E17/F01/US02/T03: the SDI rejected an invoice of the booking; the booking's tab Pagamento holds its documents, and the «Da fare» item "Correggi la fattura" opens the correction from the documents page.
  'fiscal-document-sdi-rejected': { icon: FileWarning, textKey: 'notifications.types.fiscalDocumentSdiRejected', route: bookingTab('payment') },
  'routine-notify-owner': { icon: Bell, textKey: 'notifications.types.routineOwner', route: bookingRoute },
  'routine-notify-staff': { icon: Bell, textKey: 'notifications.types.routineStaff', route: bookingRoute },
  'routine-notify-team': { icon: Bell, textKey: 'notifications.types.routineTeam', route: bookingRoute },
  'checkout-reminder': { icon: LogOut, textKey: 'notifications.types.checkoutReminder', route: bookingRoute },
  'tourist-tax-paid': { icon: Coins, textKey: 'notifications.types.touristTaxPaid', route: bookingTaxStep },
  'ota-stay-review': { icon: AlertTriangle, textKey: 'notifications.types.otaStayReview', route: bookingRoute },
  'ota-review-received': { icon: Star, textKey: 'notifications.types.otaReviewReceived', route: bookingRoute },
  'ota-review-action-failed': { icon: AlertTriangle, textKey: 'notifications.types.otaReviewActionFailed', route: bookingRoute },
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
  'service-request-backup-invited': serviceRequest('notifications.types.serviceRequestBackupInvited'),
  'service-request-backup-active': serviceRequest('notifications.types.serviceRequestBackupActive'),
  'service-request-backup-won': serviceRequest('notifications.types.serviceRequestBackupWon'),
  'service-request-backup-closed': serviceRequest('notifications.types.serviceRequestBackupClosed'),
  'service-payment-received': serviceRequest('notifications.types.servicePaymentReceived'),
  'ticino-notification-due': { icon: CalendarClock, textKey: 'notifications.types.ticinoNotificationDue', route: ticinoRoute },
  'ticino-notification-overdue': { icon: ShieldAlert, textKey: 'notifications.types.ticinoNotificationOverdue', route: ticinoRoute },
  'ticino-notification-declared': { icon: FileCheck, textKey: 'notifications.types.ticinoNotificationDeclared', route: ticinoRoute },
  'swiss-notification-due': { icon: CalendarClock, textKey: 'notifications.types.swissNotificationDue', route: swissRoute },
  'swiss-notification-overdue': { icon: ShieldAlert, textKey: 'notifications.types.swissNotificationOverdue', route: swissRoute },
  'swiss-notification-declared': { icon: FileCheck, textKey: 'notifications.types.swissNotificationDeclared', route: swissRoute },
  'domain-verified': { icon: Globe, textKey: 'notifications.types.domainVerified', route: () => DOMAIN_SETTINGS_ROUTE },
  'owner-login-ready': { icon: ShieldCheck, textKey: 'notifications.types.ownerLoginReady', route: () => DOMAIN_SETTINGS_ROUTE },
  'owner-login-failed': { icon: AlertTriangle, textKey: 'notifications.types.ownerLoginFailed', route: () => DOMAIN_SETTINGS_ROUTE },
};

const GENERIC_KIND = { icon: Bell, textKey: 'notifications.types.generic' } as const;

export function notificationKind(type: string): { icon: LucideIcon; textKey: string } {
  return KINDS[type] ?? GENERIC_KIND;
}

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

export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
