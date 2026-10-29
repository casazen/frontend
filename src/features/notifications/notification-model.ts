import { AlertTriangle, BedDouble, Bell, CalendarClock, ClipboardCheck, LogOut, MessageSquare, ShieldAlert, Wrench, type LucideIcon } from 'lucide-react';
import type { InAppNotification } from '@/api/notifications.api';
import type { AppContextKey } from '@/config/route-manifest';

interface NotificationKind {
  icon: LucideIcon;
  /** Sentence in the language of the user (`notifications.types.*`). */
  textKey: string;
  /** Where a click goes, given the id of the entity (a booking, or a service request for `service-request-*`). */
  route: (entityId: string, context: AppContextKey | null) => string;
}

const BOOKINGS = '/app/short-rent/bookings';
const bookingRoute = (id: string) => `${BOOKINGS}/${encodeURIComponent(id)}`;
const bookingTab = (tab: string) => (id: string) => `${bookingRoute(id)}?tab=${tab}`;

/** A service request: the supplier opens it in the inbox; the host finds it in «Le tue richieste» of the marketplace. */
const serviceRequestRoute = (id: string, context: AppContextKey | null) =>
  context === 'supplier' ? `/app/supplier/inbox/${encodeURIComponent(id)}` : '/app/short-rent/marketplace';

const serviceRequest = (textKey: string): NotificationKind => ({ icon: Wrench, textKey, route: serviceRequestRoute });

/**
 * The push types of the backend (`PushTypes`) the bell knows. A type that is not here is shown with a generic sentence and
 * opens nothing: a newer server must not break an older app.
 */
const KINDS: Record<string, NotificationKind> = {
  'new-booking': { icon: BedDouble, textKey: 'notifications.types.newBooking', route: bookingRoute },
  'guest-message': { icon: MessageSquare, textKey: 'notifications.types.guestMessage', route: bookingTab('messages') },
  'guest-data-missing': { icon: ClipboardCheck, textKey: 'notifications.types.guestDataMissing', route: bookingTab('guest') },
  'alloggiati-deadline': { icon: CalendarClock, textKey: 'notifications.types.alloggiatiDeadline', route: bookingTab('alloggiati') },
  'alloggiati-overdue': { icon: ShieldAlert, textKey: 'notifications.types.alloggiatiOverdue', route: bookingTab('alloggiati') },
  'alloggiati-failed': { icon: AlertTriangle, textKey: 'notifications.types.alloggiatiFailed', route: bookingTab('alloggiati') },
  'checkout-reminder': { icon: LogOut, textKey: 'notifications.types.checkoutReminder', route: bookingRoute },
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
};

const GENERIC_KIND = { icon: Bell, textKey: 'notifications.types.generic' } as const;

/** Icon and sentence key of a notification; the generic ones for a type the app does not know. */
export function notificationKind(type: string): { icon: LucideIcon; textKey: string } {
  return KINDS[type] ?? GENERIC_KIND;
}

/** Where a click on the notification goes; `null` when it has nowhere to go (unknown type, or no entity). */
export function notificationRoute(notification: Pick<InAppNotification, 'type' | 'entityId'>, context: AppContextKey | null): string | null {
  const kind = KINDS[notification.type];
  if (!kind || !notification.entityId) return null;
  return kind.route(notification.entityId, context);
}

export const KNOWN_NOTIFICATION_TYPES: readonly string[] = Object.keys(KINDS);

/** The number on a badge: 99+ above that. */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
