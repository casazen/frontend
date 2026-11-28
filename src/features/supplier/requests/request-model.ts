import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime, formatStayDate, romeDateOf, todayInRome } from '@/lib/stay-dates';
import type { ServiceRequestStatus, SupplierBackup, SupplierServiceRequest } from '@/types/service-request';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const INBOX_PATH = '/app/supplier/inbox';
export const requestPath = (id: string) => `${INBOX_PATH}/${id}`;

export const REQUEST_DRAWER_KIND = 'supplier-request';

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

function backupPhaseOf(backup: SupplierBackup): RequestPhase {
  if (backup.state === 'accepted') return 'backupAccepted';
  return backup.state === 'active' ? 'backupActive' : 'backupWaiting';
}

export function isBackup(request: PhaseSource): boolean {
  const phase = phaseOf(request);
  return phase === 'backupWaiting' || phase === 'backupAccepted' || phase === 'backupActive';
}

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

export interface RequestPlan {
  primary?: RequestAction;
  secondary?: RequestAction;
  more: RequestAction[];
}

export function hasNoPrice(request: Pick<SupplierServiceRequest, 'price'>): boolean {
  return request.price?.amountCents === null || request.price?.amountCents === undefined;
}

/**
 * What the supplier can do about a request now. A new request without a price puts the quote first ("Accetta senza preventivo" is a quiet
 * button); one with a price keeps the take first and offers the quote as a quiet button. «Rifiuta» is the second action of a new request
 * either way: always in the same place (UX round 3). A quote that waits is a state to wait in: the
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
        ? { primary: 'quote', secondary: 'reject', more: ['take'] }
        : { primary: 'take', secondary: 'reject', more: ['quote'] };
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

export function requestTitle(request: Pick<SupplierServiceRequest, 'serviceName' | 'category'>, t: Translate): string {
  return request.serviceName?.trim() || getServiceCategoryLabel(request.category, t);
}

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const LONG_DAY: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

export function workMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : null;
}

export interface RequestWhen {
  day: string | null;
  time: string | null;
  minutes: number | null;
}

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

function groupDueOf(request: Pick<SupplierServiceRequest, 'backup'>): string | null {
  const backup = request.backup;
  if (!backup) return null;
  return (backup.state === 'active' ? backup.backupDueAt : backup.primaryDueAt) ?? null;
}

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
  PrimaryTookIt: 'supplier.requests.reason.PrimaryTookIt',
  TakenByBackup: 'supplier.requests.reason.TakenByBackup',
  RequestCancelledByHost: 'supplier.requests.reason.RequestCancelledByHost',
  BackupSlotUnavailable: 'supplier.requests.reason.BackupSlotUnavailable',
  // Another backup accepted first and closed the race: the supplier loses nothing, and the text says so.
  BackupRaceClosed: 'supplier.requests.reason.BackupRaceClosed',
};

export function reasonText(reason: string | null | undefined, t: Translate): string | null {
  const text = reason?.trim();
  if (!text) return null;
  return Object.prototype.hasOwnProperty.call(REASON_KEYS, text) ? t(REASON_KEYS[text]) : text;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

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

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function clientNameMatches(request: Pick<SupplierServiceRequest, 'clientName'>, text: string): boolean {
  const wanted = fold(text.trim());
  return wanted.length > 0 && fold(request.clientName ?? '').includes(wanted);
}
