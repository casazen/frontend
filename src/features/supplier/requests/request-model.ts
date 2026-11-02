import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime, formatStayDate, romeDateOf, todayInRome } from '@/lib/stay-dates';
import type { ServiceRequestStatus, SupplierBackup, SupplierServiceRequest } from '@/types/service-request';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Where the list of the requests is, and where each request is (`/app/supplier/inbox/:id`). */
export const INBOX_PATH = '/app/supplier/inbox';
export const requestPath = (id: string) => `${INBOX_PATH}/${id}`;

/** The kind of the global drawer (UI-15) that shows one request of the supplier. */
export const REQUEST_DRAWER_KIND = 'supplier-request';

/**
 * Where a request is for the supplier, in the words the locale files use (`supplier.requests.now.<phase>`). The server works it out
 * (`phase`, SP-04e); a value this version does not know is read from the status, and a status it does not know is `unknown`.
 *
 * A request that reaches the supplier **as a backup** (SP-BKP, `backup.role` `backup`) is still `to_answer` for the server, but it is not
 * the same thing for the supplier: `backupWaiting` (the primary supplier has its hour: the backup can say it would take the job),
 * `backupAccepted` (it said so: nothing more to do) and `backupActive` (the second window: the job is free, the first to accept has it).
 */
export type RequestPhase =
  | 'toAnswer'
  | 'backupWaiting'
  | 'backupAccepted'
  | 'backupActive'
  | 'proposalPending'
  | 'quotePending'
  | 'scheduled'
  | 'inProgress'
  | 'completed'
  | 'paid'
  | 'rejected'
  | 'cancelled'
  | 'unknown';

const PHASE_OF_SERVER = new Map<string, RequestPhase>([
  ['to_answer', 'toAnswer'],
  ['proposal_pending', 'proposalPending'],
  ['quote_pending', 'quotePending'],
  ['scheduled', 'scheduled'],
  ['in_progress', 'inProgress'],
  ['completed', 'completed'],
  ['paid', 'paid'],
  ['rejected', 'rejected'],
  ['cancelled', 'cancelled'],
]);

const PHASE_OF_STATUS: Record<ServiceRequestStatus, RequestPhase> = {
  Richiesto: 'toAnswer',
  PresoInCarico: 'scheduled',
  InCorso: 'inProgress',
  Completato: 'completed',
  Pagato: 'paid',
  Rifiutato: 'rejected',
  Annullato: 'cancelled',
};

type PhaseSource = Pick<SupplierServiceRequest, 'phase' | 'status'> & Partial<Pick<SupplierServiceRequest, 'backup'>>;

export function phaseOf(request: PhaseSource): RequestPhase {
  const phase = (request.phase ? PHASE_OF_SERVER.get(request.phase) : undefined) ?? PHASE_OF_STATUS[request.status] ?? 'unknown';
  return phase === 'toAnswer' && request.backup?.role === 'backup' ? backupPhaseOf(request.backup) : phase;
}

/** A backup's request while it waits for an answer, by the state the server gives; a state this version does not know is read as `waiting`. */
function backupPhaseOf(backup: SupplierBackup): RequestPhase {
  if (backup.state === 'accepted') return 'backupAccepted';
  return backup.state === 'active' ? 'backupActive' : 'backupWaiting';
}

/** The request is one the supplier has as a backup and has not been given the job yet. */
export function isBackup(request: PhaseSource): boolean {
  const phase = phaseOf(request);
  return phase === 'backupWaiting' || phase === 'backupAccepted' || phase === 'backupActive';
}

/**
 * What the supplier can do about a request. `take` and `reject` answer a new request; `quote` answers it with a quote (SP-04b), and while
 * the quote waits the supplier can change it (`editQuote`) or take it back (`withdrawQuote`); a taken job is completed (`complete`) or, until
 * it starts, cancelled (`cancel`, with a reason: the way out of a job accepted automatically, SP-04d); a completed job paid inside CasaZen
 * can be asked for again (`remindPayment`, SP-15a) and one that was paid outside CasaZen is recorded (`recordPayment`). A backup says it
 * would take the job if the primary does not (`acceptBackup`, SP-BKP): it holds nothing of the agenda.
 */
export type RequestAction =
  | 'take'
  | 'acceptBackup'
  | 'reject'
  | 'complete'
  | 'cancel'
  | 'quote'
  | 'editQuote'
  | 'withdrawQuote'
  | 'remindPayment'
  | 'recordPayment';

/** The one thing to do (`primary`), quieter another (`secondary`), and the rest as quiet buttons (`more`): none of them takes the place of the block. */
export interface RequestPlan {
  primary?: RequestAction;
  secondary?: RequestAction;
  more: RequestAction[];
}

/** A request with no price (a service on quote, or no service): the answer that suits it is a quote, not a take at "da concordare". */
export function hasNoPrice(request: Pick<SupplierServiceRequest, 'price'>): boolean {
  return request.price?.amountCents === null || request.price?.amountCents === undefined;
}

/**
 * What the supplier can do about a request now. A new request without a price puts the quote first and the take second ("Accetta senza
 * preventivo"); one with a price keeps the take first and offers the quote as a quiet button. A quote that waits is a state to wait in: the
 * supplier may change it or take it back, but there is nothing it has to do. The reminder needs `onlinePayments` (the flag of the
 * server, `SupplierOnlinePayments`) and the server's own word (`payment.canRequest`); recording a payment received outside CasaZen needs
 * only the server's (`payment.canRecordOffline`), also with online payments off.
 */
export function actionsOf(
  request: Pick<SupplierServiceRequest, 'phase' | 'status' | 'price' | 'payment'> & Partial<Pick<SupplierServiceRequest, 'backup'>>,
  options: { onlinePayments?: boolean } = {},
): RequestPlan {
  switch (phaseOf(request)) {
    case 'toAnswer':
      return hasNoPrice(request)
        ? { primary: 'quote', secondary: 'take', more: ['reject'] }
        : { primary: 'take', secondary: 'reject', more: ['quote'] };
    // A backup answers the request as it is: it can say it would take the job, or refuse; no quote, no other time (the host did not choose it).
    case 'backupWaiting':
      return { primary: 'acceptBackup', secondary: 'reject', more: [] };
    case 'backupAccepted':
      return { more: ['reject'] };
    case 'backupActive':
      return { primary: 'take', secondary: 'reject', more: [] };
    case 'quotePending':
      return { more: ['editQuote', 'withdrawQuote'] };
    case 'scheduled':
      return { primary: 'complete', secondary: 'cancel', more: [] };
    case 'inProgress':
      return { primary: 'complete', more: [] };
    case 'completed':
      return {
        more: [
          ...(options.onlinePayments && request.payment?.canRequest ? (['remindPayment'] as const) : []),
          ...(request.payment?.canRecordOffline ? (['recordPayment'] as const) : []),
        ],
      };
    default:
      return { more: [] };
  }
}

/** The name of the job: the service of the catalog when the request is for one, else its category. */
export function requestTitle(request: Pick<SupplierServiceRequest, 'serviceName' | 'category'>, t: Translate): string {
  return request.serviceName?.trim() || getServiceCategoryLabel(request.category, t);
}

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const LONG_DAY: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

/** Minutes between two instants, or null when one is missing or they are not in order. */
export function workMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : null;
}

export interface RequestWhen {
  /** The day of the job ("ven 9 ott", or in full), or null when there is none yet. */
  day: string | null;
  /** "10:00–12:30", or null when the request has no time (an old one). */
  time: string | null;
  minutes: number | null;
}

/** The day and the hours of the job, in Europe/Rome whatever the time zone of the browser. */
export function requestWhen(
  request: Pick<SupplierServiceRequest, 'scheduledFor' | 'scheduledStart' | 'scheduledEnd'>,
  locale: string,
  long = false,
): RequestWhen {
  const date = request.scheduledFor || romeDateOf(request.scheduledStart);
  const minutes = workMinutes(request.scheduledStart, request.scheduledEnd);
  const timed = Boolean(request.scheduledStart && request.scheduledEnd && minutes);
  return {
    day: date ? formatStayDate(date, locale, long ? LONG_DAY : SHORT_DAY) || null : null,
    time: timed
      ? `${formatRomeDateTime(request.scheduledStart!, locale, TIME)}–${formatRomeDateTime(request.scheduledEnd!, locale, TIME)}`
      : null,
    minutes,
  };
}

/**
 * The instant the window the request is in ends at (SP-BKP): the hour of the primary supplier for a backup that waits (and for the primary
 * itself), the second window for a backup that can take the job now. Null for a request that is in no group.
 */
function groupDueOf(request: Pick<SupplierServiceRequest, 'backup'>): string | null {
  const backup = request.backup;
  if (!backup) return null;
  return (backup.state === 'active' ? backup.backupDueAt : backup.primaryDueAt) ?? null;
}

/** "14:30", or "9 ott, 14:30" when it is not today: the hour a window of the group ends at, for the sentences that say «entro le …». */
export function groupDueText(request: Pick<SupplierServiceRequest, 'backup'>, locale: string): string | null {
  const due = groupDueOf(request);
  if (!due) return null;
  const time = formatRomeDateTime(due, locale, TIME);
  return romeDateOf(due) === todayInRome() ? time : `${formatRomeDateTime(due, locale, { day: 'numeric', month: 'short' })}, ${time}`;
}

/**
 * "Rispondi entro le 14:30" while a new request waits for the answer and its deadline has not passed; nothing otherwise. A backup that waits
 * is not asked to answer by the clock: it is told until when the supplier the host chose has the job for itself (SP-BKP); one that can take
 * the job now is told by when.
 */
export function respondByText(
  request: Pick<SupplierServiceRequest, 'respondBy' | 'phase' | 'status'> & Partial<Pick<SupplierServiceRequest, 'backup'>>,
  locale: string,
  t: Translate,
): string | null {
  const phase = phaseOf(request);
  if (phase === 'backupWaiting' || phase === 'backupAccepted') {
    const until = groupDueOf(request);
    return until && Date.parse(until) > Date.now() ? t('supplier.requests.backup.primaryUntil', { time: groupDueText(request, locale) }) : null;
  }

  const by = phase === 'backupActive' ? (groupDueOf(request) ?? request.respondBy) : request.respondBy;
  if (!by || (phase !== 'toAnswer' && phase !== 'backupActive') || Date.parse(by) <= Date.now()) return null;
  const time = formatRomeDateTime(by, locale, TIME);
  if (romeDateOf(by) === todayInRome()) return t('supplier.requests.respondByToday', { time });
  return t('supplier.requests.respondByDay', { day: formatRomeDateTime(by, locale, { day: 'numeric', month: 'short' }), time });
}

const REASON_KEYS: Record<string, string> = {
  NoResponse: 'supplier.requests.reason.NoResponse',
  ProposalNotAnswered: 'supplier.requests.reason.ProposalNotAnswered',
  QuoteNotAnswered: 'supplier.requests.reason.QuoteNotAnswered',
  CancelledByCustomer: 'supplier.requests.reason.CancelledByCustomer',
  // The request of a backup closed by CasaZen (SP-BKP): somebody else has the job, or there is no job any more.
  PrimaryTookIt: 'supplier.requests.reason.PrimaryTookIt',
  TakenByBackup: 'supplier.requests.reason.TakenByBackup',
  RequestCancelledByHost: 'supplier.requests.reason.RequestCancelledByHost',
  BackupSlotUnavailable: 'supplier.requests.reason.BackupSlotUnavailable',
  // Another backup accepted first and closed the race: the supplier loses nothing, and the text says so.
  BackupRaceClosed: 'supplier.requests.reason.BackupRaceClosed',
};

/** A reason as a sentence: the text a person wrote as it is, a code of the server (`NoResponse`...) in words. */
export function reasonText(reason: string | null | undefined, t: Translate): string | null {
  const text = reason?.trim();
  if (!text) return null;
  return Object.prototype.hasOwnProperty.call(REASON_KEYS, text) ? t(REASON_KEYS[text]) : text;
}

/* ------------------------------------------------------------------------------------- Rows of the list (SP-08b) */

/** The phone number as a link that starts a call (`tel:`): digits and a leading plus only. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * Where the job is, on a map: the street address, which the supplier has only after the take (decision D9), searched on a map in another tab.
 * Null while there is no address, so a request not yet taken never offers it.
 */
export function mapHref(request: Pick<SupplierServiceRequest, 'address' | 'postalCode' | 'city'>): string | null {
  const street = request.address?.trim();
  if (!street) return null;
  const place = [street, [request.postalCode, request.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/**
 * A request the supplier can take together with others, in one go: a new one, or one it has as a backup when the job is free. A backup that
 * waits for the primary supplier is not taken: the job is not its yet, it has its own button on the request. Nor is a request on measure
 * of the showcase (SP-10b): it has no time and no price, and is answered with an offer, never taken as it is (422 `supplier_inquiry_needs_offer`).
 */
export function canBulkAccept(request: PhaseSource & Partial<Pick<SupplierServiceRequest, 'kind'>>): boolean {
  const phase = phaseOf(request);
  return request.kind !== 'Custom' && (phase === 'toAnswer' || phase === 'backupActive');
}

/** Capitals and accents do not matter: "José" is found by "jose". */
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Who asks has this text in the name the console shows (any case, accents ignored): the search by name among the rows the console has
 * loaded (SP-D23: the names of private customers are encrypted, so the server cannot search them).
 */
export function clientNameMatches(request: Pick<SupplierServiceRequest, 'clientName'>, text: string): boolean {
  const wanted = fold(text.trim());
  return wanted.length > 0 && fold(request.clientName ?? '').includes(wanted);
}
