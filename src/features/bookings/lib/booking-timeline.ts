import type { i18n as I18nInstance, TFunction } from 'i18next';
import { CalendarPlus, CheckCircle2, Hourglass, IdCard, Inbox, LogIn, LogOut, Send, ShieldCheck, Undo2, Wallet, XCircle, type LucideIcon } from 'lucide-react';
import type { TimelineEvent, TimelineTone } from '@/components/shared/timeline/timeline';
import { getAlloggiatiStatusLabel, getBookingSourceLabel, getPaymentMethodLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { BookingTimelineEvent, BookingTimelineKind } from '@/types';

const ICONS: Record<BookingTimelineKind, LucideIcon> = {
  Created: CalendarPlus,
  RequestReceived: Inbox,
  GuestEmailPending: Hourglass,
  ApprovalPending: Hourglass,
  PaymentPending: Hourglass,
  HostConfirmationPending: Hourglass,
  PaymentReceived: Wallet,
  Confirmed: CheckCircle2,
  CheckInLinkSent: Send,
  GuestDocumentsReceived: IdCard,
  Arrived: LogIn,
  Alloggiati: ShieldCheck,
  CheckedOut: LogOut,
  Cancelled: XCircle,
  Refund: Undo2,
};

/**
 * How an entry weighs. What is past is quiet (grey), except the two milestones, the confirmation and the money that came in; what
 * waits for the host is `warning`, what waits for the guest or the bank is `info`, a communication or a refund that failed is `danger`.
 */
function toneOf({ kind, state, data }: BookingTimelineEvent): TimelineTone {
  switch (kind) {
    case 'ApprovalPending':
    case 'HostConfirmationPending':
      return 'warning';
    case 'GuestEmailPending':
    case 'PaymentPending':
      return 'info';
    case 'Confirmed':
    case 'PaymentReceived':
      return 'success';
    case 'CheckInLinkSent':
      return state === 'Current' ? 'info' : 'neutral';
    case 'Alloggiati':
      if (data.alloggiatiStatus === 'Errore' || data.alloggiatiStatus === 'Rifiutato') return 'danger';
      return state === 'Current' ? 'warning' : 'neutral';
    case 'Refund':
      if (data.refundStatus === 'Failed') return 'danger';
      if (state === 'Done') return 'neutral';
      return data.refundStatus === 'RequiresAction' ? 'warning' : 'info';
    default:
      return 'neutral';
  }
}

function titleOf({ kind, data }: BookingTimelineEvent, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = kind === 'Refund' && data.refundStatus ? `booking.timeline.refund.${data.refundStatus}` : `booking.timeline.kind.${kind}`;
  return i18n.exists(key) ? t(key) : kind;
}

function descriptionOf({ kind, state, data }: BookingTimelineEvent, t: TFunction, language: string, currency: string): string | undefined {
  const date = (instant: string) => formatRomeDateTime(instant, language);
  switch (kind) {
    case 'Created':
    case 'RequestReceived':
      return data.source ? t('booking.timeline.source', { source: getBookingSourceLabel(data.source, t) }) : undefined;
    case 'GuestEmailPending':
      return data.expiresAt ? t('booking.timeline.expiresOn', { date: date(data.expiresAt) }) : undefined;
    case 'ApprovalPending':
      return data.expiresAt ? t('booking.list.respondBy', { date: date(data.expiresAt) }) : undefined;
    case 'PaymentReceived':
    case 'Refund': {
      const amount = typeof data.amount === 'number' ? formatCurrency(data.amount, currency) : '';
      const method = kind === 'PaymentReceived' && data.method ? getPaymentMethodLabel(data.method, t) : '';
      return [amount, method].filter(Boolean).join(' · ') || undefined;
    }
    case 'CheckInLinkSent':
      return data.linkState ? t(`booking.timeline.linkState.${data.linkState}`) : undefined;
    case 'Alloggiati': {
      if (!data.alloggiatiStatus) return undefined;
      const status = getAlloggiatiStatusLabel(data.alloggiatiStatus, t);
      return state === 'Current' && data.deadlineAt ? t('booking.timeline.alloggiatiDeadline', { status, date: date(data.deadlineAt) }) : status;
    }
    case 'Cancelled': {
      const parts = [data.reason ? t(`booking.timeline.cancelReason.${data.reason}`) : '', data.note ? t('booking.timeline.cancelNote', { note: data.note }) : ''];
      return parts.filter(Boolean).join(' ') || undefined;
    }
    default:
      return undefined;
  }
}

export function timelineEventsOf(
  events: readonly BookingTimelineEvent[],
  t: TFunction,
  i18n: Pick<I18nInstance, 'exists' | 'language'>,
  currency: string,
): TimelineEvent[] {
  return events.map((event, index) => ({
    id: `${index}-${event.kind}`,
    at: event.at,
    title: titleOf(event, t, i18n),
    description: descriptionOf(event, t, i18n.language, currency),
    tone: toneOf(event),
    icon: ICONS[event.kind],
  }));
}
