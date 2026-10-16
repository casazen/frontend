import type { CalmTone } from '@/components/shared/calm';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import type { Booking } from '@/types';
import type { GuestCheckInSessionStatus } from '@/types/public-checkin.types';
import { stayDateOf } from './booking-price';
import { canOpenCheckOut, canRegisterArrival } from './stay-actions';

/** What the booking page says is going on, and what the host has to do about it ("Cosa succede ora", SR-05). */
type BookingNextStepKind =
  | 'answerRequest'
  | 'confirmManual'
  | 'waitingGuestEmail'
  | 'waitingPayment'
  | 'registerArrival'
  | 'sendLink'
  | 'resendLink'
  | 'waitingDocuments'
  | 'stayInProgress'
  | 'registerDeparture'
  | 'sendAlloggiati'
  | 'allInOrder'
  | 'completed'
  | 'cancelled';

interface BookingNextStep {
  kind: BookingNextStepKind;
  tone: CalmTone;
}

type StayFacts = Pick<Booking, 'status' | 'source' | 'onSiteRequestState' | 'checkInDate' | 'checkOutDate'>;

/** The online check-in link of a stay, as `GET /bookings/{id}/checkin-session` says it. */
interface CheckInFacts {
  /** Null while no link was ever made. */
  status: GuestCheckInSessionStatus | null;
  canIssueLink: boolean;
}

/** The Alloggiati Web communication of a stay, as `GET /alloggiati/{id}/status` says it. */
interface AlloggiatiFacts {
  status: AlloggiatiWebStatus;
  isOverdue: boolean;
}

/** What the host has to do for Alloggiati Web: the communication is ready to be sent by hand, or the portal did not take it. */
const ALLOGGIATI_TO_SEND: readonly AlloggiatiWebStatus[] = ['DaInviareManualmente', 'Rifiutato', 'Errore'];

/**
 * Which read the step of a stay depends on, so that the page asks only for it: the link of the online check-in (a confirmed stay
 * that has not started), Alloggiati Web (a stay in progress, until the day it ends, or over), or nothing (the dates and the status
 * are enough).
 */
export function documentsNeeded(booking: StayFacts, today: string): 'checkIn' | 'alloggiati' | null {
  if (booking.status === 'Confirmed' && today < stayDateOf(booking.checkInDate)) return 'checkIn';
  if (booking.status === 'CheckedIn' && today < stayDateOf(booking.checkOutDate)) return 'alloggiati';
  if (booking.status === 'CheckedOut') return 'alloggiati';
  return null;
}

/**
 * The one thing to do now, from what the booking already says: its status and dates (Europe/Rome), how it is paid, and the
 * documents (the online check-in link, Alloggiati Web). The order is the one a host would follow: the answer that is owed first,
 * then the arrival, the documents, the departure. A read that is not there (still loading, or it failed) never invents a task:
 * the step is then the one the dates give.
 */
export function nextStepOf(
  booking: StayFacts,
  today: string,
  facts: { checkIn?: CheckInFacts; alloggiati?: AlloggiatiFacts } = {},
): BookingNextStep {
  const alloggiati = facts.alloggiati;
  const alloggiatiToSend = alloggiati !== undefined && ALLOGGIATI_TO_SEND.includes(alloggiati.status);

  switch (booking.status) {
    case 'Cancelled':
      return { kind: 'cancelled', tone: 'neutral' };

    case 'Pending':
      if (booking.onSiteRequestState === 'AwaitingHostApproval') return { kind: 'answerRequest', tone: 'warning' };
      if (booking.onSiteRequestState === 'AwaitingGuestEmail') return { kind: 'waitingGuestEmail', tone: 'info' };
      if (booking.source === 'Manual') return { kind: 'confirmManual', tone: 'warning' };
      return { kind: 'waitingPayment', tone: 'info' };

    case 'Confirmed': {
      if (canRegisterArrival(booking, today)) return { kind: 'registerArrival', tone: 'neutral' };
      if (canOpenCheckOut(booking, today)) return { kind: 'registerDeparture', tone: 'neutral' };
      const link = facts.checkIn;
      if (link?.canIssueLink && link.status === null) return { kind: 'sendLink', tone: 'neutral' };
      if (link?.canIssueLink && link.status === 'Scaduto') return { kind: 'resendLink', tone: 'warning' };
      if (link?.status === 'Inviato' || link?.status === 'InCompilazione') return { kind: 'waitingDocuments', tone: 'info' };
      return { kind: 'allInOrder', tone: 'success' };
    }

    case 'CheckedIn':
      // The check-out wizard has its own Alloggiati Web step: on the day the stay ends, it is the one thing to do.
      if (today >= stayDateOf(booking.checkOutDate)) return { kind: 'registerDeparture', tone: 'neutral' };
      if (alloggiatiToSend) return { kind: 'sendAlloggiati', tone: alloggiati.isOverdue ? 'danger' : 'warning' };
      return { kind: 'stayInProgress', tone: 'neutral' };

    case 'CheckedOut':
      if (alloggiatiToSend) return { kind: 'sendAlloggiati', tone: alloggiati.isOverdue ? 'danger' : 'warning' };
      return { kind: 'completed', tone: 'success' };

    default:
      // A status this version of the app does not know (the server is newer): nothing to say, nothing to invent.
      return { kind: 'allInOrder', tone: 'neutral' };
  }
}
