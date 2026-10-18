import { todayInRome } from '@/lib/stay-dates';
import type { StatusIconName, StatusTone } from '@/lib/status-dictionary';
import type { SupplierEarning, SupplierEarningsTab } from '@/types/supplier-earnings';

/** The period of the list, in the address as `?f_period=`: this month, the month before, this year (Europe/Rome). */
export type EarningsPeriod = 'mese' | 'mese-scorso' | 'anno';

export const EARNINGS_PERIODS: readonly EarningsPeriod[] = ['mese', 'mese-scorso', 'anno'];

/** The tabs of the list are the tabs of the server, by the same ids; "Da verificare" is a tab of the server the page does not offer. */
export const EARNINGS_TABS: readonly SupplierEarningsTab[] = ['tutti', 'da-incassare', 'pagati', 'in-ritardo'];

const pad = (value: number) => String(value).padStart(2, '0');
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The Europe/Rome days (`YYYY-MM-DD`, both included) a period stands for, counted from `today` (a day of Europe/Rome). */
export function periodRange(period: EarningsPeriod, today: string = todayInRome()): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number);
  if (period === 'anno') return { from: `${year}-01-01`, to: `${year}-12-31` };
  const [y, m] = period === 'mese' ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1];
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOf(y, m))}` };
}

export function isEarningsPeriod(value: string | undefined): value is EarningsPeriod {
  return value !== undefined && (EARNINGS_PERIODS as readonly string[]).includes(value);
}

/** How a state of the server looks: its tone and icon; the words are `supplier.earnings.state.<state>`. */
const STATE_VIEWS: Record<string, { tone: StatusTone; icon: StatusIconName }> = {
  to_collect: { tone: 'info', icon: 'hourglass' },
  paid: { tone: 'success', icon: 'check-circle' },
  late: { tone: 'danger', icon: 'alert-triangle' },
  in_review: { tone: 'warning', icon: 'alert-circle' },
  refunded: { tone: 'neutral', icon: 'undo' },
  partially_refunded: { tone: 'neutral', icon: 'undo' },
};

const UNKNOWN_STATE = { tone: 'neutral', icon: 'circle-dashed' } as const;

/** The look of a state; one the app does not know (the held payments will add some) is neutral, with a generic word. */
export function stateView(state: string): { key: string; tone: StatusTone; icon: StatusIconName } {
  const view = STATE_VIEWS[state];
  return view ? { key: state, ...view } : { key: 'unknown', ...UNKNOWN_STATE };
}

/** The end of the free period of the commission while it lasts (the instant the server sends); nothing when there is none or it is over. */
export function freePeriodEnd(freeUntil: string | null | undefined, now: number = Date.now()): string | null {
  return freeUntil && Date.parse(freeUntil) > now ? freeUntil : null;
}

/** Whole days since a payment was flagged late (a display matter: the server sends the instant); 0 when it is not late. */
export function daysLate(earning: Pick<SupplierEarning, 'state' | 'lateSince'>, now: number = Date.now()): number {
  if (earning.state !== 'late' || !earning.lateSince) return 0;
  const since = Date.parse(earning.lateSince);
  return Number.isFinite(since) && now > since ? Math.floor((now - since) / 86_400_000) : 0;
}
