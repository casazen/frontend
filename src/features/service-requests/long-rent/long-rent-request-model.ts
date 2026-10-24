import type { TFunction } from 'i18next';
import type { TimelineEvent, TimelineTone } from '@/components/shared/timeline/timeline';
import { requestWhen } from '@/features/supplier/requests/request-model';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { formatWorkDuration } from '@/lib/work-duration';
import type { ServiceRequest, ServiceRequestHostView, ServiceRequestStatus } from '@/types/service-request';

/**
 * What the landlord sees of a request to a supplier (LR-08b), worked out from what the API sends and nothing more: the tabs of
 * the list, the phase of a request (what the landlord has to do about it), and the little pieces of text of a row and of a page.
 */

/** The tabs of the list. `open` and `closed` are the two views of the API (`?view=`, LR-08a), `all` is the plain list. */
export const REQUEST_TABS = ['open', 'closed', 'all'] as const;
export type RequestTab = (typeof REQUEST_TABS)[number];

/** The tab the list opens on: the requests still to follow. */
export const DEFAULT_REQUEST_TAB: RequestTab = 'open';

/** The tab an address asks for; a value that is not a tab is the default one. */
export function tabOfParam(value: string | null): RequestTab {
  return REQUEST_TABS.find((tab) => tab === value) ?? DEFAULT_REQUEST_TAB;
}

export function viewOfTab(tab: RequestTab): ServiceRequestHostView | undefined {
  return tab === 'all' ? undefined : tab;
}

/**
 * Where a request is for the landlord. The server decides the state (`status`) and the details that change what is asked of the
 * landlord (a time proposed, an amount to confirm, how it is paid); the phase only names the combination.
 */
export type HostPhase =
  | 'proposal'
  | 'waiting'
  | 'scheduled'
  | 'inProgress'
  | 'confirmAmount'
  | 'payOnline'
  | 'payManual'
  | 'paid'
  | 'rejected'
  | 'cancelled'
  | 'unknown';

export function hostPhaseOf(request: Pick<ServiceRequest, 'status' | 'proposal' | 'price' | 'paymentMode'>): HostPhase {
  switch (request.status) {
    case 'Richiesto':
      return request.proposal ? 'proposal' : 'waiting';
    case 'PresoInCarico':
      return 'scheduled';
    case 'InCorso':
      return 'inProgress';
    case 'Completato':
      if (request.price?.needsCustomerConfirmation) return 'confirmAmount';
      return request.paymentMode === 'Online' ? 'payOnline' : 'payManual';
    case 'Pagato':
      return 'paid';
    case 'Rifiutato':
      return 'rejected';
    case 'Annullato':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/** The landlord cancels up to and including the work in progress (`ServiceRequestStateMachine.CanCancel`, SP-04). */
export function canCancelRequest(status: ServiceRequestStatus): boolean {
  return status === 'Richiesto' || status === 'PresoInCarico' || status === 'InCorso';
}

const STATUS_ORDER: Readonly<Record<ServiceRequestStatus, number>> = {
  Richiesto: 0,
  PresoInCarico: 1,
  InCorso: 2,
  Completato: 3,
  Pagato: 4,
  Rifiutato: 5,
  Annullato: 6,
};

/** The place of a state on the way of a request (to sort a list by state); a state this version does not know goes last. */
export function statusRank(status: string): number {
  return Object.prototype.hasOwnProperty.call(STATUS_ORDER, status) ? STATUS_ORDER[status as ServiceRequestStatus] : STATUS_ORDER.Annullato + 1;
}

/** A request that waits for the landlord (an answer to give, an amount to confirm, a payment): the row says so. */
export function waitsForLandlord(phase: HostPhase): boolean {
  return phase === 'proposal' || phase === 'confirmAmount' || phase === 'payOnline' || phase === 'payManual';
}

/** A request that is over: paid, rejected or cancelled. The row is quieter. */
export function isClosedRequest(status: ServiceRequestStatus): boolean {
  return status === 'Pagato' || status === 'Rifiutato' || status === 'Annullato';
}

/** The instant, if it has not passed yet; otherwise `null`. «Ha tempo fino a…» is told only while it is true. */
export function instantToCome(instant: string | null | undefined): string | null {
  if (!instant) return null;
  const time = Date.parse(instant);
  return Number.isFinite(time) && time > Date.now() ? instant : null;
}

/** The first sentence of the notes of a request, for the line under its name in the list. */
export function notesSnippet(notes: string | null | undefined, maxLength = 90): string {
  const text = (notes ?? '').trim().replace(/\s+/g, ' ');
  const end = text.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trimEnd()}…` : sentence;
}

/** The price to show, as the server worked it out (the final amount, else the quote, else the estimate); `null` is "da definire". */
export function priceText(request: Pick<ServiceRequest, 'price'>, locale: string): string | null {
  const cents = request.price?.amountCents;
  return cents === null || cents === undefined ? null : formatMoney(cents, locale);
}

/** The words for which amount the price is, when the server says it: `longRentRequests.detail.priceBasis.*`. */
export const PRICE_BASIS_KEYS: Readonly<Record<string, string>> = {
  final: 'longRentRequests.detail.priceBasis.final',
  quoted: 'longRentRequests.detail.priceBasis.quoted',
  estimated: 'longRentRequests.detail.priceBasis.estimated',
};

export interface WhenText {
  /** The day ("ven 9 ott", or in full), or `null` when the request has no time (an old one). */
  day: string | null;
  /** "10:00–12:30 · 2 ore", or `null` when the request has no time. */
  time: string | null;
}

/** The day and the hours of the job, in Europe/Rome whatever the time zone of the browser. */
export function whenText(
  request: Pick<ServiceRequest, 'scheduledStart' | 'scheduledEnd'>,
  locale: string,
  t: TFunction,
  long = false,
): WhenText {
  const when = requestWhen(request, locale, long);
  const duration = when.minutes ? formatWorkDuration(when.minutes, t) : null;
  return { day: when.day, time: when.time ? [when.time, duration].filter(Boolean).join(' · ') : null };
}

/**
 * The supplier in a sentence: its name, or «il fornitore» when the request has none. Twice, because a sentence that begins with it
 * wants the capital («Il fornitore propone…») and one that has it in the middle does not («Sollecita il fornitore»).
 */
export function supplierRef(request: Pick<ServiceRequest, 'supplierName'>, t: TFunction): { supplier: string; supplierStart: string } {
  const name = request.supplierName?.trim();
  return { supplier: name || t('longRentRequests.supplier.mid'), supplierStart: name || t('longRentRequests.supplier.start') };
}

/** Why a request was cancelled, as a sentence: what a person wrote as it is, and the code of the automatic cancellation in words. */
export function cancellationReasonText(reason: string | null | undefined, t: TFunction): string | null {
  const text = reason?.trim();
  if (!text) return null;
  return text === 'NoResponse' ? t('longRentRequests.reason.noResponse') : text;
}

const HISTORY_KEYS: Readonly<Record<ServiceRequestStatus, { titleKey: string; tone: TimelineTone }>> = {
  Richiesto: { titleKey: 'longRentRequests.history.Richiesto', tone: 'neutral' },
  PresoInCarico: { titleKey: 'longRentRequests.history.PresoInCarico', tone: 'info' },
  InCorso: { titleKey: 'longRentRequests.history.InCorso', tone: 'info' },
  Completato: { titleKey: 'longRentRequests.history.Completato', tone: 'info' },
  Pagato: { titleKey: 'longRentRequests.history.Pagato', tone: 'success' },
  Rifiutato: { titleKey: 'longRentRequests.history.Rifiutato', tone: 'danger' },
  Annullato: { titleKey: 'longRentRequests.history.Annullato', tone: 'neutral' },
};

/**
 * The steps of the request, with their dates and who made them, from the `history` the API sends (it rebuilds it from the dates the
 * request keeps: created, taken, started, completed, paid, rejected, cancelled). The host's steps are «te», the supplier's its
 * name; a member of the supplier's team is never named to the host.
 */
export function historyEvents(request: ServiceRequest, t: TFunction): TimelineEvent[] {
  return (request.history ?? []).map((entry) => {
    const known = Object.prototype.hasOwnProperty.call(HISTORY_KEYS, entry.status) ? HISTORY_KEYS[entry.status] : null;
    const actor =
      entry.actor === 'Host'
        ? t('longRentRequests.history.actor.Host')
        : entry.actor === 'System'
          ? t('longRentRequests.history.actor.System')
          : request.supplierName?.trim() || t('longRentRequests.history.actor.Supplier');
    return {
      id: entry.status,
      at: entry.at,
      title: known ? t(known.titleKey) : getServiceRequestStatusLabel(entry.status, t),
      description:
        entry.status === 'Rifiutato'
          ? (entry.reason?.trim() || t('longRentRequests.history.noReason'))
          : (cancellationReasonText(entry.reason, t) ?? undefined),
      actor,
      tone: known?.tone ?? 'neutral',
    };
  });
}
