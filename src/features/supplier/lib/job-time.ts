import { formatRomeDateTime, formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { formatWorkDuration } from '@/lib/work-duration';
import type { SupplierServiceRequest } from '@/types/service-request';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const BLOCKING_STATUSES = new Set(['PresoInCarico', 'InCorso']);

export function workDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/** The line the supplier reads: day, hours and duration. Legacy rows without a time show a short missing-time note. */
export function formatJobWhen(
  item: Pick<SupplierServiceRequest, 'scheduledFor' | 'scheduledStart' | 'scheduledEnd'>,
  locale: string,
  t: Translate,
): string {
  const minutes = workDurationMinutes(item.scheduledStart, item.scheduledEnd);
  if (item.scheduledStart && item.scheduledEnd && minutes) {
    const date = formatStayDate(item.scheduledFor || romeDateOf(item.scheduledStart), locale);
    return t('supplier.inbox.slot', {
      date,
      from: formatRomeDateTime(item.scheduledStart, locale, TIME),
      to: formatRomeDateTime(item.scheduledEnd, locale, TIME),
      duration: formatWorkDuration(minutes, t),
    });
  }
  if (item.scheduledFor) {
    return `${t('supplier.inbox.dayOf', { date: formatStayDate(item.scheduledFor, locale) })} · ${t('supplier.inbox.noTime')}`;
  }
  return t('supplier.inbox.noDate');
}

type Span = { start: number; end: number };

function spanOf(item: Pick<SupplierServiceRequest, 'scheduledStart' | 'scheduledEnd'>): Span | null {
  if (!item.scheduledStart || !item.scheduledEnd) return null;
  const start = Date.parse(item.scheduledStart);
  const end = Date.parse(item.scheduledEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/** True when both jobs have intervals and those half-open intervals overlap. Missing times do not block the whole day. */
export function commitmentsOverlap(
  left: Pick<SupplierServiceRequest, 'scheduledStart' | 'scheduledEnd'>,
  right: Pick<SupplierServiceRequest, 'scheduledStart' | 'scheduledEnd'>,
): boolean {
  const a = spanOf(left);
  const b = spanOf(right);
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

/** A new request the supplier should not take, because a job already accepted on this page overlaps it. */
export function takeBlockedBy(item: SupplierServiceRequest, others: SupplierServiceRequest[]): boolean {
  if (item.status !== 'Richiesto') return false;
  return others.some(
    (other) => other.id !== item.id && BLOCKING_STATUSES.has(other.status) && commitmentsOverlap(item, other),
  );
}
