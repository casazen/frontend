import { useMemo } from 'react';
import { Building2, CalendarDays, Check, Clock, DoorClosed, DoorOpen, Globe, House, Pencil, Plug, Send, Users, X, XCircle, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListMenuEntry, ListRowAction } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { getBookingSourceLabel, getBookingStatusLabel } from '@/lib/i18n-labels';
import { addDays, formatRomeDateTime, formatStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { BookingChannel, BookingListItem } from '@/types';
import { bookingNights, stayDateOf } from './lib/booking-price';
import { BOOKINGS_PATH, CHECK_IN_CHOICES, DEFAULT_BOOKING_CHIP } from './lib/booking-list-query';
import { bookingChannelText, needsOtaReview } from './lib/ota-stay';
import { canOpenCheckOut, canRegisterArrival } from './lib/stay-actions';

/** What the actions of a row do. The page owns them: some open a dialog, some call the API. */
export interface BookingRowHandlers {
  accept: (booking: BookingListItem) => void;
  arrival: (booking: BookingListItem) => void;
  decline: (booking: BookingListItem) => void;
  cancel: (booking: BookingListItem) => void;
  sendLink: (booking: BookingListItem) => void;
}

interface BookingsListOptions {
  canWrite: boolean;
  /** The properties of the host, for the filter. */
  properties: readonly { id: string; name: string }[];
  handlers: BookingRowHandlers;
}

const CHANNELS: readonly BookingChannel[] = ['Direct', 'Manual', 'Airbnb', 'BookingCom', 'Other'];
const CHANNEL_ICONS: Record<BookingChannel, LucideIcon> = { Direct: Globe, Manual: Pencil, Airbnb: House, BookingCom: Building2, Other: Plug };

const guestName = (booking: BookingListItem) => `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim();
const bookingPath = (booking: BookingListItem) => `${BOOKINGS_PATH}/${booking.id}`;
const isAwaitingHost = (booking: BookingListItem) => booking.status === 'Pending' && booking.onSiteRequestState === 'AwaitingHostApproval';
/** A pending booking the host can accept: a request waiting for the answer, or one entered by hand and left pending. */
const canAccept = (booking: BookingListItem) => isAwaitingHost(booking) || (booking.status === 'Pending' && booking.source === 'Manual');
const canCancel = (booking: BookingListItem) => booking.status === 'Pending' || booking.status === 'Confirmed' || booking.status === 'CheckedIn';

/**
 * The list of the bookings (SR-04): the unified list in `server` mode, in the words of the host. A server filters it, orders it
 * and pages it (`GET /api/bookings/search`), so the list shows the rows as they come.
 *
 * Five columns: the guest with the property, the dates with the nights, the channel, the state (and, for a request, until when
 * to answer) and the total. The e-mail, the payment and the code are there for who asks for them. The online check-in has no
 * column: the rows do not carry it, and it is not made up (the filter on it exists, the API narrows by it).
 *
 * The chips are the views of the API: their ids travel in the address (`?chip=toConfirm`) and in the request (`view=toConfirm`).
 * The one that waits for an answer carries its number (`counts`).
 */
export function useBookingsList({ canWrite, properties, handlers }: BookingsListOptions) {
  const { t, i18n } = useTranslation();

  return useMemo(() => {
    const language = i18n.language;
    const thisYear = todayInRome().slice(0, 4);
    const day = (value: string) => {
      const stay = stayDateOf(value);
      return formatStayDate(stay, language, stay.startsWith(thisYear) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const range = (booking: BookingListItem) => `${day(booking.checkInDate)} → ${day(booking.checkOutDate)}`;
    const nights = (booking: BookingListItem) => t('booking.list.nights', { count: bookingNights(booking) });
    const respondText = (booking: BookingListItem) =>
      booking.respondBy ? t('booking.list.respondBy', { date: formatRomeDateTime(booking.respondBy, language) }) : t('booking.requests.state.AwaitingHostApproval');

    /** The line under the badge of a request: what the host has to do and by when. */
    const requestLine = (booking: BookingListItem) => {
      if (booking.onSiteRequestState === 'AwaitingHostApproval') {
        return (
          <span data-testid="booking-request-badge" className="text-xs font-medium text-warning-foreground">
            {respondText(booking)}
          </span>
        );
      }
      if (booking.onSiteRequestState === 'AwaitingGuestEmail') {
        return (
          <span data-testid="booking-request-badge" className="text-xs text-foreground/70">
            {t('booking.requests.state.AwaitingGuestEmail')}
          </span>
        );
      }
      return null;
    };

    const channelCell = (booking: BookingListItem) => {
      const Icon = CHANNEL_ICONS[booking.channel] ?? Plug;
      const detail = bookingChannelText(booking, t);
      return (
        <div className="flex min-w-0 items-start gap-2" data-testid="booking-source">
          <Icon className="mt-0.5 size-4 shrink-0 text-foreground/70" aria-hidden="true" />
          <div className="min-w-0">
            <span className="break-words">{getBookingSourceLabel(booking.source, t)}</span>
            {detail ? (
              <span className="block break-words text-xs text-foreground/70" data-testid="booking-channel">
                {detail}
              </span>
            ) : null}
          </div>
        </div>
      );
    };

    const primaryOf = (booking: BookingListItem): ListRowAction | null => {
      if (!canWrite) return null;
      if (canAccept(booking)) {
        return { id: 'accept', label: t('booking.list.actions.accept'), icon: Check, variant: 'default', onSelect: () => handlers.accept(booking) };
      }
      const today = todayInRome();
      if (canRegisterArrival(booking, today)) {
        return { id: 'arrival', label: t('booking.arrival.action'), icon: DoorOpen, testId: 'booking-row-register-arrival', onSelect: () => handlers.arrival(booking) };
      }
      if (canOpenCheckOut(booking, today) && stayDateOf(booking.checkOutDate) <= today) {
        return { id: 'departure', label: t('booking.list.actions.departure'), icon: DoorClosed, href: `${bookingPath(booking)}/checkout`, testId: 'booking-row-checkout' };
      }
      return null;
    };

    const today = todayInRome();

    return defineList<BookingListItem>({
      key: 'bookings',
      title: t('booking.list.title'),
      rowKey: (booking) => booking.id,
      rowLabel: guestName,
      columns: [
        {
          id: 'guest',
          label: t('booking.list.columns.guestAndProperty'),
          default: true,
          always: true,
          rowHeader: true,
          sort: guestName,
          render: (booking, cell) => (
            <div className="min-w-0">
              {cell.open(<span>{guestName(booking) || t('compliance.checkout.guestFallback')}</span>)}
              <span className="mt-0.5 block break-words text-sm text-foreground/70">
                {[booking.propertyName, t('booking.list.guestCount', { count: booking.numberOfGuests })].filter(Boolean).join(' · ')}
              </span>
            </div>
          ),
          csv: (booking) => [guestName(booking), booking.propertyName].filter(Boolean).join(' · '),
        },
        {
          id: 'dates',
          label: t('booking.list.columns.dates'),
          default: true,
          sort: (booking) => stayDateOf(booking.checkInDate),
          render: (booking) => (
            <div className="min-w-0">
              <span className="whitespace-nowrap">{range(booking)}</span>
              <span className="block text-sm text-foreground/70">{nights(booking)}</span>
            </div>
          ),
          csv: (booking) => `${stayDateOf(booking.checkInDate)} → ${stayDateOf(booking.checkOutDate)}`,
        },
        { id: 'channel', label: t('booking.list.columns.channel'), default: true, render: channelCell, csv: (booking) => getBookingSourceLabel(booking.source, t) },
        {
          id: 'status',
          label: t('booking.list.columns.status'),
          default: true,
          sort: (booking) => booking.status,
          render: (booking) => (
            <div className="flex min-w-0 flex-col items-start gap-1">
              <StatusBadge kind="booking" status={booking.status} />
              {requestLine(booking)}
              {needsOtaReview(booking) ? (
                <span data-testid="booking-ota-review-badge" className="text-xs font-semibold text-danger-foreground">
                  {t('booking.otaReview.badge')}
                </span>
              ) : null}
            </div>
          ),
          csv: (booking) => getBookingStatusLabel(booking.status, t),
        },
        {
          id: 'total',
          label: t('booking.list.columns.total'),
          default: true,
          align: 'end',
          sort: (booking) => booking.totalPrice,
          render: (booking) => <span className="whitespace-nowrap font-medium">{formatCurrency(booking.totalPrice, booking.currency)}</span>,
          csv: (booking) => booking.totalPrice,
        },
        { id: 'email', label: t('booking.list.columns.email'), render: (booking) => booking.guest?.email || '—', csv: (booking) => booking.guest?.email },
        {
          id: 'payment',
          label: t('booking.list.columns.payment'),
          render: (booking) => (
            <div className="min-w-0">
              <span>{t(`booking.list.payment.${booking.paymentState}`)}</span>
              {booking.paidAmount ? <span className="block text-sm text-foreground/70">{formatCurrency(booking.paidAmount, booking.currency)}</span> : null}
            </div>
          ),
          csv: (booking) => t(`booking.list.payment.${booking.paymentState}`),
        },
        { id: 'code', label: t('booking.list.columns.code'), render: (booking) => <code className="text-sm">{booking.bookingCode}</code>, csv: (booking) => booking.bookingCode },
      ],

      search: { label: t('booking.list.searchLabel'), placeholder: t('booking.list.searchPlaceholder') },
      chips: [
        { id: 'all', label: t('booking.list.chips.all') },
        { id: 'toConfirm', label: t('booking.list.chips.toConfirm'), urgent: true, hint: t('booking.list.chips.toConfirmHint') },
        { id: 'upcoming', label: t('booking.list.chips.upcoming') },
        { id: 'inProgress', label: t('booking.list.chips.inProgress') },
        { id: 'completed', label: t('booking.list.chips.completed') },
        { id: 'cancelled', label: t('booking.list.chips.cancelled') },
      ],
      defaultChip: DEFAULT_BOOKING_CHIP,
      filters: [
        {
          id: 'property',
          type: 'select',
          label: t('booking.list.filters.property'),
          allLabel: t('booking.list.filters.allProperties'),
          options: properties.map((property) => ({ value: property.id, label: property.name })),
        },
        {
          id: 'channel',
          type: 'multi',
          label: t('booking.list.filters.channel'),
          options: CHANNELS.map((channel) => ({ value: channel, label: t(`booking.list.channels.${channel}`), icon: CHANNEL_ICONS[channel] })),
        },
        { id: 'arrival', type: 'date', label: t('booking.list.filters.arrival') },
        {
          id: 'checkin',
          type: 'select',
          label: t('booking.list.filters.checkIn'),
          allLabel: t('booking.list.filters.checkInAll'),
          options: CHECK_IN_CHOICES.map((choice) => ({ value: choice, label: t(`booking.list.filters.checkInChoices.${choice}`) })),
        },
      ],
      views: [
        // A view keeps dates as they are: "the next 7 days" is worked out when the list is defined.
        { id: 'arrivalsWeek', label: t('booking.list.views.arrivalsWeek'), state: { chip: 'upcoming', filters: { arrival: `${addDays(today, 1)}..${addDays(today, 7)}` } } },
        { id: 'documents', label: t('booking.list.views.documents'), state: { chip: 'all', filters: { checkin: 'waiting' } } },
        { id: 'direct', label: t('booking.list.views.direct'), state: { chip: 'all', filters: { channel: 'Direct' } } },
      ],

      primaryAction: primaryOf,
      menu: (booking) => {
        const entries: ListMenuEntry[] = [];
        if (!canWrite) return entries;
        if (booking.status === 'Confirmed' || booking.status === 'CheckedIn') {
          entries.push({ id: 'sendLink', label: t('booking.list.actions.sendLink'), icon: Send, onSelect: () => handlers.sendLink(booking) });
        }
        if (isAwaitingHost(booking)) {
          entries.push({ id: 'decline', label: t('booking.list.actions.decline'), icon: X, onSelect: () => handlers.decline(booking) });
        }
        if (canCancel(booking)) {
          if (entries.length > 0) entries.push('separator');
          entries.push({ id: 'cancel', label: t('booking.cancel.action'), icon: XCircle, danger: true, onSelect: () => handlers.cancel(booking) });
        }
        return entries;
      },
      bulk: ['export'],

      card: (booking) => ({
        title: guestName(booking) || t('compliance.checkout.guestFallback'),
        sub: booking.propertyName,
        status: <StatusBadge kind="booking" status={booking.status} />,
        meta: [
          { icon: CalendarDays, text: `${range(booking)} · ${nights(booking)}`, label: t('booking.list.columns.dates') },
          { icon: Users, text: String(booking.numberOfGuests), label: t('booking.list.columns.guests') },
          { text: formatCurrency(booking.totalPrice, booking.currency), label: t('booking.list.columns.total') },
          ...(isAwaitingHost(booking) ? [{ icon: Clock, text: respondText(booking) }] : []),
        ],
        foot: channelCell(booking),
      }),
      // The swipe is the main action and nothing else; the menu of the card has it too (a gesture is never the only way).
      swipe: (booking) => {
        const primary = primaryOf(booking);
        return primary ? { left: { id: primary.id, label: primary.label, icon: primary.icon, tone: 'success', href: primary.href, onSelect: primary.onSelect } } : undefined;
      },

      rowHref: bookingPath,
      rowTone: (booking) => (isAwaitingHost(booking) ? 'urgent' : booking.status === 'CheckedOut' || booking.status === 'Cancelled' ? 'done' : undefined),
      // With the sidebar open (from `lg`) five columns and the actions do not fit under 1280 px: cards until then.
      cardsUntil: 'xl',
      csv: { fileName: 'prenotazioni' },

      empty: {
        icon: CalendarDays,
        title: t('booking.list.emptyTitle'),
        description: t('booking.list.emptyDescription'),
        action: canWrite ? { label: t('booking.list.newBooking'), href: `${BOOKINGS_PATH}/create` } : undefined,
      },
      noResults: { title: t('booking.list.noResultsTitle'), description: t('booking.list.noResultsDescription') },
      countLabel: (count) => t('booking.list.count', { count }),
    });
  }, [t, i18n.language, canWrite, properties, handlers]);
}
