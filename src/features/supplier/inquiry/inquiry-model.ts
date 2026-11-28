import { formatRomeDateTime, romeDateOf, todayInRome } from '@/lib/stay-dates';
import type { ServiceRequestQuote, SupplierServiceRequest } from '@/types/service-request';
import type { SupplierNegotiation, SupplierOffer } from '@/types/supplier-inquiry';
import { phaseOf } from '../requests/request-model';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function isInquiry(request: Pick<SupplierServiceRequest, 'kind'>): boolean {
  return request.kind === 'Custom';
}

export function isOpenInquiry(request: Pick<SupplierServiceRequest, 'kind' | 'phase' | 'status'> & Partial<Pick<SupplierServiceRequest, 'backup'>>): boolean {
  if (!isInquiry(request)) return false;
  const phase = phaseOf(request);
  return phase === 'toAnswer' || phase === 'quotePending';
}

export type NegotiationView = 'awaiting' | 'conversation' | 'offerSent' | 'offerDeclined';

export function negotiationViewOf(negotiation: SupplierNegotiation | undefined): NegotiationView {
  switch (negotiation) {
    case 'AwaitingSupplier':
      return 'awaiting';
    case 'OfferSent':
      return 'offerSent';
    case 'OfferDeclined':
      return 'offerDeclined';
    default:
      return 'conversation';
  }
}

export function offerAsQuote(offer: SupplierOffer, money: (cents: number) => string): ServiceRequestQuote {
  return {
    sentAt: offer.sentAt,
    lines: offer.lines.map((line) => ({
      label: line.quantity > 1 ? `${line.label} (${line.quantity} × ${money(line.unitAmountCents)})` : line.label,
      amountCents: line.amountCents,
    })),
    totalCents: offer.totalCents,
    note: offer.note ?? null,
    scheduledStart: offer.startUtc,
    scheduledEnd: offer.endUtc,
    answerBy: offer.validUntil ?? null,
  };
}

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

export function minutesLeft(due: string, now: number): number | null {
  const at = Date.parse(due);
  return Number.isFinite(at) ? Math.ceil((at - now) / 60_000) : null;
}

export function respondByLine(due: string, now: number, locale: string, t: Translate): string | null {
  const left = minutesLeft(due, now);
  if (left === null) return null;
  if (left <= 0) return t('supplier.inquiry.now.timeOver');
  const time = formatRomeDateTime(due, locale, TIME);
  const by = romeDateOf(due) === todayInRome(new Date(now))
    ? t('supplier.requests.respondByToday', { time })
    : t('supplier.requests.respondByDay', { day: formatRomeDateTime(due, locale, { day: 'numeric', month: 'short' }), time });
  const remaining = left >= 120 ? t('supplier.inquiry.now.leftHours', { count: Math.floor(left / 60) }) : t('supplier.inquiry.now.leftMinutes', { count: left });
  return `${by} · ${remaining}`;
}
