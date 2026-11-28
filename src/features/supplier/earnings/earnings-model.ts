import { todayInRome } from '@/lib/stay-dates';
import type { SupplierEarning, SupplierEarningsTab } from '@/types/supplier-earnings';

export type EarningsPeriod = 'mese' | 'mese-scorso' | 'anno';

export const EARNINGS_PERIODS: readonly EarningsPeriod[] = ['mese', 'mese-scorso', 'anno'];

export const EARNINGS_TABS: readonly SupplierEarningsTab[] = ['tutti', 'da-incassare', 'pagati', 'in-ritardo'];

const pad = (value: number) => String(value).padStart(2, '0');
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function periodRange(period: EarningsPeriod, today: string = todayInRome()): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number);
  if (period === 'anno') return { from: `${year}-01-01`, to: `${year}-12-31` };
  const [y, m] = period === 'mese' ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1];
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOf(y, m))}` };
}

export function isEarningsPeriod(value: string | undefined): value is EarningsPeriod {
  return value !== undefined && (EARNINGS_PERIODS as readonly string[]).includes(value);
}

export function freePeriodEnd(freeUntil: string | null | undefined, now: number = Date.now()): string | null {
  return freeUntil && Date.parse(freeUntil) > now ? freeUntil : null;
}

/** Whole days since a payment was flagged late (a display matter: the server sends the instant); 0 when it is not late. */
export function daysLate(earning: Pick<SupplierEarning, 'state' | 'lateSince'>, now: number = Date.now()): number {
  if (earning.state !== 'late' || !earning.lateSince) return 0;
  const since = Date.parse(earning.lateSince);
  return Number.isFinite(since) && now > since ? Math.floor((now - since) / 86_400_000) : 0;
}
