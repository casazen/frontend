import type { CalmTone } from '@/components/shared/calm';
import { pendingLines, type ComplianceLine } from '@/features/compliance/lib/compliance-lines';
import { romeDateOf } from '@/lib/stay-dates';
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
  | 'completeGuestData'
  | 'stayInProgress'
  | 'registerDeparture'
  | 'sendAlloggiati'
  | 'allInOrder'
  | 'completed'
  | 'cancelled'
  // A compliance item of the stay that is not in order while the step has nothing else to ask (NF-52): `line` is the one.
  | 'compliance';

interface BookingNextStep {
  kind: BookingNextStepKind;
  tone: CalmTone;
  /** For `compliance`: the item that is the step, the worst of the stay's. */
  line?: ComplianceLine;
}

type StayFacts = Pick<Booking, 'status' | 'source' | 'onSiteRequestState' | 'checkInDate' | 'checkOutDate'>;

/** The online check-in link of a stay, as `GET /bookings/{id}/checkin-session` says it. */
interface CheckInFacts {
  /** Null while no link was ever made. */
  status: GuestCheckInSessionStatus | null;
  canIssueLink: boolean;
}

/** Whether the guest data of the stay are complete for Alloggiati Web, as `GET /alloggiati/{id}/status` says it (`dataComplete`). */
interface GuestDataFacts {
  complete: boolean;
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

/** The steps that have nothing to ask of the host: a compliance item that is not in order is worth more than their «tutto in ordine». */
const QUIET_STEPS: readonly BookingNextStepKind[] = ['stayInProgress', 'allInOrder', 'completed'];

/**
 * Whether the step says that all is well («tutto in ordine», «concluso»): until the compliance lights of the stay are read the page does not say it,
 * because a light that is not green would take it back a moment later.
 */
export function claimsAllInOrder(step: Pick<BookingNextStep, 'kind'>): boolean {
  return step.kind === 'allInOrder' || step.kind === 'completed';
}

/**
 * The compliance items of the stay (identity, Alloggiati Web, the receipt: NF-52, AC-NF52-9) and the step. They never take a step that asks
 * something (the answer, the arrival, the documents, the departure) from the host, but when the step has nothing to ask the worst of them is the
 * next step: red when the host has to act (red as the deadline when it has passed), blue when it is in hand. `lines` are worst first.
 */
function withCompliance(step: BookingNextStep, today: string, lines: readonly ComplianceLine[] | undefined): BookingNextStep {
  const line = pendingLines(lines ?? [])[0];
  if (!line || !QUIET_STEPS.includes(step.kind)) return step;
  const dueDay = romeDateOf(line.dueAt);
  const overdue = dueDay !== '' && dueDay < today;
  return { kind: 'compliance', tone: line.state === 'red' ? (overdue ? 'danger' : 'warning') : 'info', line };
}

/**
 * The one thing to do now, from what the booking already says: its status and dates (Europe/Rome), how it is paid, the
 * documents (the online check-in link, Alloggiati Web) and, when the step has nothing to ask, the compliance items of the stay
 * with their lights. The order is the one a host would follow: the answer that is owed first,
 * then the arrival, the documents, the departure. A read that is not there (still loading, or it failed) never invents a task:
 * the step is then the one the dates give.
 */
export function nextStepOf(
  booking: StayFacts,
  today: string,
  facts: { checkIn?: CheckInFacts; alloggiati?: AlloggiatiFacts; guestData?: GuestDataFacts; compliance?: readonly ComplianceLine[] } = {},
): BookingNextStep {
  return withCompliance(stepOf(booking, today, facts), today, facts.compliance);
}

function stepOf(
  booking: StayFacts,
  today: string,
  facts: { checkIn?: CheckInFacts; alloggiati?: AlloggiatiFacts; guestData?: GuestDataFacts },
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
      // Nothing is owed by the guest, and the data are still incomplete: the host fills them in the wizard "Guest check-in".
      if (facts.guestData?.complete === false) return { kind: 'completeGuestData', tone: 'warning' };
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
