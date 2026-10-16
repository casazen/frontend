import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime, formatStayDate, romeDateOf, todayInRome } from '@/lib/stay-dates';
import type { ServiceRequestStatus, SupplierServiceRequest } from '@/types/service-request';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Where the list of the requests is, and where each request is (`/app/supplier/inbox/:id`). */
export const INBOX_PATH = '/app/supplier/inbox';
export const requestPath = (id: string) => `${INBOX_PATH}/${id}`;

/** The kind of the global drawer (UI-15) that shows one request of the supplier. */
export const REQUEST_DRAWER_KIND = 'supplier-request';

/**
 * Where a request is for the supplier, in the words the locale files use (`supplier.requests.now.<phase>`). The server works it out
 * (`phase`, SP-04e); a value this version does not know is read from the status, and a status it does not know is `unknown`.
 */
export type RequestPhase =
  | 'toAnswer'
  | 'proposalPending'
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

export function phaseOf(request: Pick<SupplierServiceRequest, 'phase' | 'status'>): RequestPhase {
  return (request.phase ? PHASE_OF_SERVER.get(request.phase) : undefined) ?? PHASE_OF_STATUS[request.status] ?? 'unknown';
}

/** What the supplier can do about a request in a phase: the one thing (`primary`) and, quieter, another (`secondary`). */
export type RequestAction = 'take' | 'reject' | 'complete';

export function actionsOf(phase: RequestPhase): { primary?: RequestAction; secondary?: RequestAction } {
  switch (phase) {
    case 'toAnswer':
      return { primary: 'take', secondary: 'reject' };
    case 'scheduled':
    case 'inProgress':
      return { primary: 'complete' };
    default:
      return {};
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

/** "Rispondi entro le 14:30" while a new request waits for the answer and its deadline has not passed; nothing otherwise. */
export function respondByText(request: Pick<SupplierServiceRequest, 'respondBy' | 'phase' | 'status'>, locale: string, t: Translate): string | null {
  const by = request.respondBy;
  if (!by || phaseOf(request) !== 'toAnswer' || Date.parse(by) <= Date.now()) return null;
  const time = formatRomeDateTime(by, locale, TIME);
  if (romeDateOf(by) === todayInRome()) return t('supplier.requests.respondByToday', { time });
  return t('supplier.requests.respondByDay', { day: formatRomeDateTime(by, locale, { day: 'numeric', month: 'short' }), time });
}

const REASON_KEYS: Record<string, string> = {
  NoResponse: 'supplier.requests.reason.NoResponse',
  ProposalNotAnswered: 'supplier.requests.reason.ProposalNotAnswered',
  CancelledByCustomer: 'supplier.requests.reason.CancelledByCustomer',
};

/** A reason as a sentence: the text a person wrote as it is, a code of the server (`NoResponse`...) in words. */
export function reasonText(reason: string | null | undefined, t: Translate): string | null {
  const text = reason?.trim();
  if (!text) return null;
  return Object.prototype.hasOwnProperty.call(REASON_KEYS, text) ? t(REASON_KEYS[text]) : text;
}
