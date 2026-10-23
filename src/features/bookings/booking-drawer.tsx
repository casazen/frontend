import { useEffect, useId, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone } from 'lucide-react';
import type { DetailContentProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { TabCount } from '@/components/ui/tab-count';
import { useWorkspace } from '@/hooks/use-workspace';
import { getBookingSourceLabel, getBookingStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import { useBookingThread } from '@/queries/use-booking-messages';
import { useBooking } from '@/queries/use-bookings';
import { useRefreshDashboard } from '@/queries/use-dashboard';
import type { Booking } from '@/types';
import { BookingMessagesSection } from './components/booking-messages-section';
import { BookingTimelineSection } from './components/booking-timeline-section';
import { CheckInDialog } from './components/check-in-dialog';
import { bookingHasMessages } from './lib/booking-messages';
import { bookingNights, stayDateOf } from './lib/booking-price';
import { canOpenCheckOut, canRegisterArrival } from './lib/stay-actions';
import { BOOKING_STATUS_VARIANTS } from './schemas/booking.schema';

/** `?focus=messages` on a page with the drawer open: the drawer scrolls to the conversation and focuses its title. */
const DRAWER_FOCUS_PARAM = 'focus';
const DRAWER_FOCUS_MESSAGES = 'messages';

const LINK = 'inline-flex min-h-11 min-w-0 items-center gap-2 break-all text-sm hover:underline';

/** What the booking asks of the host now, as one sentence and one way to do it; nothing when it asks nothing. */
function nextStep(booking: Booking, canWrite: boolean, t: TFunction): { text: string; label: string; to?: string; arrival?: true } | null {
  if (!canWrite) return null;
  if (booking.status === 'Pending' && booking.onSiteRequestState === 'AwaitingHostApproval') {
    return { text: t('detailDrawer.booking.respond'), label: t('detailDrawer.booking.respondCta'), to: `/app/short-rent/bookings/${booking.id}` };
  }
  if (canRegisterArrival(booking)) return { text: t('detailDrawer.booking.arrival'), label: t('booking.arrival.action'), arrival: true };
  if (canOpenCheckOut(booking)) {
    return { text: t('detailDrawer.booking.departure'), label: t('booking.card.checkOutAction'), to: `/app/short-rent/bookings/${booking.id}/checkout` };
  }
  return null;
}

/**
 * The conversation in the drawer: its title with the guest's messages not read yet. Opened with `focus=messages` (the bell, a link
 * that is about a message) it comes into view and takes the focus, so that the host lands on the thread and not on the top.
 */
function DrawerMessages({ booking, titleId }: { booking: Booking; titleId: string }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const wantsFocus = searchParams.get(DRAWER_FOCUS_PARAM) === DRAWER_FOCUS_MESSAGES;
  const unread = useBookingThread(booking.id).data?.unreadCount ?? 0;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!wantsFocus) return;
    const element = heading.current;
    if (!element) return;
    element.scrollIntoView?.({ block: 'start' });
    element.focus({ preventScroll: true });
  }, [wantsFocus, booking.id]);

  return (
    <section aria-labelledby={titleId} className="space-y-3" data-testid="booking-drawer-messages">
      <h3 id={titleId} ref={heading} tabIndex={-1} className="flex items-center gap-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t('booking.messages.title')}
        <TabCount count={unread} label={t('booking.messages.unread', { count: unread })} tone="warning" />
      </h3>
      <BookingMessagesSection booking={booking} />
    </section>
  );
}

/**
 * The booking in the drawer (UI-15): who, where, when, how it stands and, in a block of its own, what to do now; at the end its
 * history (SR-05c). The rest (payments, documents, the guest's data) is on the page of the booking, one press away ("Apri la
 * scheda completa"). Money only in the history, and the server leaves the figures out for whoever may not read payments: that
 * person sees the same drawer as the others, without the amounts.
 */
export function BookingDrawerContent({ id }: DetailContentProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { data: booking, isLoading, isError, error, refetch } = useBooking(id);
  const refresh = useRefreshDashboard();
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const timelineTitleId = useId();
  const messagesTitleId = useId();

  if (isLoading) return <SkeletonLine lines={5} />;
  if (isError || !booking) return <ErrorState title={t('detailDrawer.booking.loadError')} error={error} onRetry={() => void refetch()} />;

  const locale = i18n.language;
  const showMessages = bookingHasMessages(booking) && hasPermission('short-rent', 'booking.read');
  const step = nextStep(booking, hasPermission('short-rent', 'booking.write'), t);
  const nights = bookingNights(booking);
  const guest = booking.guest;
  const date = (value: string) => formatStayDate(stayDateOf(value), locale, { weekday: 'short', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5 pb-2" data-testid="booking-drawer">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-lg font-semibold">{`${guest.firstName} ${guest.lastName}`.trim()}</p>
          <Badge variant={BOOKING_STATUS_VARIANTS[booking.status] ?? 'secondary'}>{getBookingStatusLabel(booking.status, t)}</Badge>
        </div>
        {booking.propertyName ? <p className="break-words text-sm text-foreground/70">{booking.propertyName}</p> : null}
      </div>

      {step ? (
        <div className="space-y-2 rounded-lg bg-primary-soft p-4 ring-1 ring-inset ring-primary/20" data-testid="booking-drawer-next">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{t('detailDrawer.booking.now')}</p>
          <p className="text-sm">{step.text}</p>
          {step.arrival ? (
            <Button type="button" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => setArrivalOpen(true)}>
              {step.label}
            </Button>
          ) : (
            <Button asChild className="h-auto min-h-11 whitespace-normal py-2">
              <Link to={step.to ?? '#'}>{step.label}</Link>
            </Button>
          )}
        </div>
      ) : null}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/70">{t('booking.detail.checkIn')}</dt>
        <dd className="font-medium">{date(booking.checkInDate)}</dd>
        <dt className="text-foreground/70">{t('booking.detail.checkOut')}</dt>
        <dd className="font-medium">{date(booking.checkOutDate)}</dd>
        <dt className="text-foreground/70">{t('booking.detail.nights')}</dt>
        <dd className="font-medium">{nights}</dd>
        <dt className="text-foreground/70">{t('booking.detail.guests')}</dt>
        <dd className="font-medium">{booking.numberOfGuests}</dd>
        {booking.source ? (
          <>
            <dt className="text-foreground/70">{t('booking.detailPage.source')}</dt>
            <dd className="font-medium">{getBookingSourceLabel(booking.source, t)}</dd>
          </>
        ) : null}
      </dl>

      <div className="flex flex-col">
        {guest.email ? (
          <a href={`mailto:${guest.email}`} className={LINK}>
            <Mail aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
            {guest.email}
          </a>
        ) : null}
        {guest.phone ? (
          <a href={`tel:${guest.phone}`} className={LINK}>
            <Phone aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
            {guest.phone}
          </a>
        ) : null}
      </div>

      {/* The conversation with the guest of a booking made through the site (SR-12), the same as the tab Messaggi of the page. */}
      {showMessages ? <DrawerMessages booking={booking} titleId={messagesTitleId} /> : null}

      {/* What happened to the booking and what it waits for (SR-05c), the same list as the tab Cronologia of the page. */}
      <section aria-labelledby={timelineTitleId} className="space-y-3" data-testid="booking-drawer-timeline">
        <h3 id={timelineTitleId} className="text-sm font-semibold">
          {t('booking.timeline.title')}
        </h3>
        <BookingTimelineSection bookingId={booking.id} currency={booking.currency} />
      </section>

      <CheckInDialog
        booking={arrivalOpen ? booking : null}
        open={arrivalOpen}
        onOpenChange={(open) => {
          setArrivalOpen(open);
          // The Home behind the drawer says whether the arrival is still to register.
          if (!open) refresh();
        }}
      />
    </div>
  );
}
