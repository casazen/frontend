import type { TFunction } from 'i18next';
import { formatStayDate, nightsBetween, parseStayDate, romeDateOf } from '@/lib/stay-dates';
import type { RentInstallmentStatus, RentRegisterRow, RentRegisterStatus } from '@/types';

/**
 * What the rent register (LR-04b) says in words and in months. It only reads what the API sends for a row (`RentRegisterRow`):
 * the state, what is late, when a reminder went out. Nothing about an installment is worked out from raw fields here.
 */

const SHORT_DAY = { day: 'numeric', month: 'short' } as const;
const FULL_DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;

/** The months the select offers: the last twelve, the current one and the next three. */
const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 3;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `2026-10` is a month the register can be asked for. */
export function isRentMonth(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && MONTH.test(value);
}

/** `yyyy-MM` of a stay date (`yyyy-MM-dd`). */
export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

/** The month `by` months after (before, if negative) `month`. */
export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + by;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The months to choose from around `current`; a month in the address that is outside them is there too, so the select can show it. */
export function monthChoices(current: string, selected: string): string[] {
  const months = Array.from({ length: MONTHS_BEFORE + 1 + MONTHS_AFTER }, (_, index) => shiftMonth(current, index - MONTHS_BEFORE));
  return months.includes(selected) ? months : [...months, selected].sort();
}

/**
 * The months a rent plan can be tracked from (LR-04a): those after the one the lease starts in, up to this one or the one the plan
 * already has. «From the start of the lease» is the choice before them, so the start month itself is not one.
 */
export function trackFromMonths(startMonth: string, currentMonth: string, selected: string): string[] {
  const last = selected > currentMonth ? selected : currentMonth;
  const months: string[] = [];
  for (let month = shiftMonth(startMonth, 1); month <= last && months.length < 600; month = shiftMonth(month, 1)) months.push(month);
  return months;
}

/** "ottobre 2026", or "ottobre" alone, in the language of the app. */
export function monthName(month: string, language: string, withYear = true): string {
  return formatStayDate(`${month}-01`, language, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });
}

/** The quick filters of the register and the status of the API each one asks for. */
const STATUS_OF_CHIP: Readonly<Record<string, RentRegisterStatus>> = {
  all: 'All',
  overdue: 'Overdue',
  pending: 'Pending',
  paid: 'Paid',
};

export function rentStatusOfChip(chip: string): RentRegisterStatus {
  return STATUS_OF_CHIP[chip] ?? 'All';
}

/** Still to be collected: the installments on which the landlord can declare a payment. A payment in flight on Stripe is not one. */
export function isOpenInstallment(status: RentInstallmentStatus): boolean {
  return status === 'Scheduled' || status === 'Failed';
}

/** The page of the lease with its rent plan. */
export function rentLeasePath(leaseId: string): string {
  return `/app/long-rent/leases/${encodeURIComponent(leaseId)}?tab=pagamenti`;
}

/** What the page calls an action that waits for its six seconds (`holdForUndo`): a reminder or a payment of one installment. */
export const reminderKey = (installmentId: string) => `reminder:${installmentId}`;
export const paymentKey = (installmentId: string) => `payment:${installmentId}`;

/** "5 ott". */
export function shortDay(date: string, language: string): string {
  return formatStayDate(parseStayDate(date), language, SHORT_DAY);
}

/** "5 ott 2026". */
export function fullDay(date: string, language: string): string {
  return formatStayDate(parseStayDate(date), language, FULL_DAY);
}

/** "1 ott – 31 ott": the period the installment pays. */
export function rentPeriodText(row: Pick<RentRegisterRow, 'periodStart' | 'periodEnd'>, t: TFunction, language: string): string {
  return t('longRentRents.row.period', { from: shortDay(row.periodStart, language), to: shortDay(row.periodEnd, language) });
}

/** The line under the state: when it was paid, how late it is, or when it is due. `late` is the one thing in red. */
export function rentStatusNote(
  row: RentRegisterRow,
  t: TFunction,
  language: string,
  today: string,
): { text: string; late: boolean } | null {
  if (row.status === 'Paid') {
    return row.paidOn ? { text: t('longRentRents.row.paidOn', { date: fullDay(row.paidOn, language) }), late: false } : null;
  }
  if (row.status === 'Processing') return { text: t('longRentRents.row.processing'), late: false };
  if (row.status === 'Cancelled') return null;

  if (row.isOverdue) {
    const days = row.daysOverdue ?? 0;
    return { text: days > 0 ? t('longRentRents.row.overdue', { count: days }) : t('longRentRents.row.overdueToday'), late: true };
  }
  if (row.status === 'Failed') return { text: t('longRentRents.row.failed'), late: false };

  const days = nightsBetween(today, parseStayDate(row.dueDate));
  return { text: days > 0 ? t('longRentRents.row.dueIn', { count: days }) : t('longRentRents.row.dueToday'), late: false };
}

/** "ieri, 2 volte": when the last reminder went out and how many there were; `null` when none did. */
export function lastReminderText(row: RentRegisterRow, t: TFunction, language: string, today: string): string | null {
  if (!row.lastReminderAt || row.reminderCount <= 0) return null;
  const day = romeDateOf(row.lastReminderAt);
  if (!day) return null;
  const ago = nightsBetween(day, today);
  const when =
    ago === 0 ? t('longRentRents.row.today') : ago === 1 ? t('longRentRents.row.yesterday') : t('longRentRents.row.on', { date: shortDay(day, language) });
  return t('longRentRents.row.lastReminder', { count: row.reminderCount, when });
}
