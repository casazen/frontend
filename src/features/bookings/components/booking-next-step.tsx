import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction } from '@/components/shared/calm';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRomeDateTime, formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { useBookingCheckInSession, useSendCheckInLink } from '@/queries/use-checkin';
import type { Booking } from '@/types';
import { BOOKINGS_PATH } from '../lib/booking-list-query';
import { documentsNeeded, nextStepOf } from '../lib/booking-next-step';
import { stayDateOf } from '../lib/booking-price';
import { canOpenCheckOut } from '../lib/stay-actions';

interface BookingNextStepProps {
  booking: Booking;
  /** The host may act on the booking (`booking.write`): without it the block says what is going on and leads back to the list. */
  canWrite: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  onArrival: () => void;
}

/** What the block says and offers for one step. */
interface StepView {
  title: string;
  body?: ReactNode;
  who?: string;
  when?: string;
  primary: CalmAction;
  secondary?: CalmAction;
}

/**
 * "Cosa succede ora" (SR-05): the one highlighted block of the booking page. It reads what the booking already says (status,
 * dates, how it is paid) and, where the status alone is not enough, the documents: the online check-in link for a stay that has
 * not started, Alloggiati Web for one in progress or over. It says what is going on, whose turn it is, and gives the one
 * button that does it, with the actions and the permissions the page always had.
 */
export function BookingNextStep({ booking, canWrite, onConfirm, onDecline, onArrival }: BookingNextStepProps) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const needs = documentsNeeded(booking, today);
  const session = useBookingCheckInSession(needs === 'checkIn' ? booking.id : '');
  const alloggiati = useAlloggiatiStatus(booking.id, needs === 'alloggiati');
  const sendLink = useSendCheckInLink();

  // The documents change the step: wait for them rather than show a block that changes a moment later.
  if ((needs === 'checkIn' && session.isLoading) || (needs === 'alloggiati' && alloggiati.isLoading)) {
    return (
      <div role="status" aria-busy="true" data-testid="booking-next-step-loading">
        <span className="sr-only">{t('shared.loading.srOnly')}</span>
        <Skeleton aria-hidden="true" className="h-36 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  const link = needs === 'checkIn' ? session.data : undefined;
  const communication = needs === 'alloggiati' ? alloggiati.data : undefined;
  const step = nextStepOf(booking, today, {
    checkIn: link ? { status: link.status ?? null, canIssueLink: link.canIssueLink } : undefined,
    alloggiati: communication ? { status: communication.status, isOverdue: communication.isOverdue } : undefined,
  });

  const language = i18n.language;
  const guest = `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback');
  const arrival = formatStayDate(stayDateOf(booking.checkInDate), language);
  const departure = formatStayDate(stayDateOf(booking.checkOutDate), language);
  const myTurn = canWrite ? t('booking.next.whoHost') : undefined;
  const guestTurn = t('booking.next.whoGuest');

  // What a person who may not write is offered: the way back to the list, which every block has.
  const toBookings: CalmAction = { label: t('booking.next.toBookings'), href: BOOKINGS_PATH };
  const confirm: CalmAction = { label: t('booking.confirm.action'), onClick: onConfirm, testId: 'open-confirm-booking' };
  const checkOut: CalmAction | null =
    canWrite && canOpenCheckOut(booking, today)
      ? { label: t('booking.list.actions.departure'), href: `${BOOKINGS_PATH}/${booking.id}/checkout`, testId: 'open-checkout-wizard' }
      : null;
  const sendCheckInLink: CalmAction | null =
    canWrite && link?.canIssueLink
      ? { label: t('booking.list.actions.sendLink'), onClick: () => sendLink.mutate(booking.id), loading: sendLink.isPending, testId: 'booking-next-send-link' }
      : null;

  const viewOfStep = (): StepView => {
    switch (step.kind) {
      case 'answerRequest':
        return {
          title: t('booking.next.answerRequest.title', { guest }),
          body: t('booking.next.answerRequest.body'),
          who: myTurn,
          when: booking.requestExpiresAt ? t('booking.requests.respondBy', { date: formatRomeDateTime(booking.requestExpiresAt, language) }) : undefined,
          primary: canWrite ? confirm : toBookings,
          secondary: canWrite ? { label: t('booking.list.actions.decline'), onClick: onDecline, testId: 'open-decline-booking' } : undefined,
        };
      case 'confirmManual':
        return {
          title: t('booking.next.confirmManual.title'),
          body: <span data-testid="booking-pending-manual">{t('booking.confirm.pendingNotice')}</span>,
          who: myTurn,
          primary: canWrite ? confirm : toBookings,
        };
      case 'waitingGuestEmail':
        return { title: t('booking.next.waitingGuestEmail.title'), body: t('booking.next.waitingGuestEmail.body'), who: guestTurn, primary: toBookings };
      case 'waitingPayment':
        return { title: t('booking.next.waitingPayment.title'), body: t('booking.next.waitingPayment.body'), who: guestTurn, primary: toBookings };
      case 'registerArrival':
        return {
          title: t('booking.next.registerArrival.title', { guest }),
          body: t('booking.next.registerArrival.body', { date: arrival }),
          who: myTurn,
          primary: canWrite ? { label: t('booking.arrival.action'), onClick: onArrival, testId: 'open-register-arrival' } : toBookings,
          secondary: checkOut ?? undefined,
        };
      case 'sendLink':
        return { title: t('booking.next.sendLink.title'), body: t('booking.next.sendLink.body'), who: myTurn, primary: sendCheckInLink ?? toBookings };
      case 'resendLink':
        return { title: t('booking.next.resendLink.title'), body: t('booking.next.resendLink.body'), who: myTurn, primary: sendCheckInLink ?? toBookings };
      case 'waitingDocuments':
        return { title: t('booking.next.waitingDocuments.title'), body: t('booking.next.waitingDocuments.body'), who: guestTurn, primary: sendCheckInLink ?? toBookings };
      case 'stayInProgress':
        return {
          title: t('booking.next.stayInProgress.title', { guest }),
          body: t('booking.next.stayInProgress.body', { date: departure }),
          primary: checkOut ?? toBookings,
        };
      case 'registerDeparture':
        return {
          title: t('booking.next.registerDeparture.title', { guest }),
          body: t('booking.next.registerDeparture.body'),
          who: myTurn,
          primary: checkOut ?? toBookings,
        };
      case 'sendAlloggiati':
        return {
          title: t('booking.next.sendAlloggiati.title'),
          body: communication ? t(`status.alloggiati.${communication.status}.explain`) : undefined,
          who: myTurn,
          when: communication
            ? communication.isOverdue
              ? t('alloggiati.overdue')
              : `${t('alloggiati.deadline')}: ${formatRomeDateTime(communication.deadlineAt, language)}`
            : undefined,
          primary: { label: t('booking.next.sendAlloggiati.action'), href: `${BOOKINGS_PATH}/${booking.id}?tab=alloggiati`, testId: 'booking-next-alloggiati' },
        };
      case 'completed':
        return { title: t('booking.next.completed.title'), body: t('status.booking.CheckedOut.explain'), primary: toBookings };
      case 'cancelled':
        return { title: t('booking.next.cancelled.title'), body: t('status.booking.Cancelled.explain'), primary: toBookings };
      case 'allInOrder':
        return { title: t('booking.next.allInOrder.title'), body: t('booking.next.allInOrder.body', { guest, date: arrival }), primary: toBookings };
    }
  };

  return <FocusBlock data-testid="booking-next-step" data-next-step={step.kind} tone={step.tone} kicker={t('booking.next.heading')} {...viewOfStep()} />;
}
