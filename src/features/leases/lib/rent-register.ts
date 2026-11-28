import type { TFunction } from 'i18next';
import { formatStayDate, nightsBetween, parseStayDate, romeDateOf } from '@/lib/stay-dates';
import type { RentInstallmentStatus, RentRegisterRow, RentRegisterStatus } from '@/types';

const SHORT_DAY = { day: 'numeric', month: 'short' } as const;
const FULL_DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;

const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 3;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isRentMonth(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && MONTH.test(value);
}

export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + by;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthChoices(current: string, selected: string): string[] {
  const months = Array.from({ length: MONTHS_BEFORE + 1 + MONTHS_AFTER }, (_, index) => shiftMonth(current, index - MONTHS_BEFORE));
  return months.includes(selected) ? months : [...months, selected].sort();
}

export function trackFromMonths(startMonth: string, currentMonth: string, selected: string): string[] {
  const last = selected > currentMonth ? selected : currentMonth;
  const months: string[] = [];
  for (let month = shiftMonth(startMonth, 1); month <= last && months.length < 600; month = shiftMonth(month, 1)) months.push(month);
  return months;
}

export function monthName(month: string, language: string, withYear = true): string {
  return formatStayDate(`${month}-01`, language, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });
}

const STATUS_OF_CHIP: Readonly<Record<string, RentRegisterStatus>> = {
  all: 'All',
  overdue: 'Overdue',
  pending: 'Pending',
  paid: 'Paid',
};

export function rentStatusOfChip(chip: string): RentRegisterStatus {
  return STATUS_OF_CHIP[chip] ?? 'All';
}

export function isOpenInstallment(status: RentInstallmentStatus): boolean {
  return status === 'Scheduled' || status === 'Failed';
}

export function rentLeasePath(leaseId: string): string {
  return `/app/long-rent/leases/${encodeURIComponent(leaseId)}?tab=pagamenti`;
}

const RENT_REGISTER_PATH = '/app/long-rent/rents';

export function rentRegisterPath(month: string, currentMonth: string, chip?: string): string {
  const params = new URLSearchParams();
  if (month !== currentMonth) params.set('mese', month);
  if (chip) params.set('chip', chip);
  const query = params.toString();
  return query ? `${RENT_REGISTER_PATH}?${query}` : RENT_REGISTER_PATH;
}

export const reminderKey = (installmentId: string) => `reminder:${installmentId}`;
export const paymentKey = (installmentId: string) => `payment:${installmentId}`;

export function shortDay(date: string, language: string): string {
  return formatStayDate(parseStayDate(date), language, SHORT_DAY);
}

export function fullDay(date: string, language: string): string {
  return formatStayDate(parseStayDate(date), language, FULL_DAY);
}

export function rentPeriodText(row: Pick<RentRegisterRow, 'periodStart' | 'periodEnd'>, t: TFunction, language: string): string {
  return t('longRentRents.row.period', { from: shortDay(row.periodStart, language), to: shortDay(row.periodEnd, language) });
}

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

export function lastReminderText(row: RentRegisterRow, t: TFunction, language: string, today: string): string | null {
  if (!row.lastReminderAt || row.reminderCount <= 0) return null;
  const day = romeDateOf(row.lastReminderAt);
  if (!day) return null;
  const ago = nightsBetween(day, today);
  const when =
    ago === 0 ? t('longRentRents.row.today') : ago === 1 ? t('longRentRents.row.yesterday') : t('longRentRents.row.on', { date: shortDay(day, language) });
  return t('longRentRents.row.lastReminder', { count: row.reminderCount, when });
}
