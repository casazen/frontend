import { endOfMonth, todayInRome, utcStayDate } from '@/lib/stay-dates';
import type { DashboardOverviewQuery } from '@/types/dashboard.types';

export const HOME_PERIODS = ['month', '30d', '3m', 'year'] as const;
export type HomePeriod = (typeof HOME_PERIODS)[number];

export function parseHomePeriod(value: string | null): HomePeriod {
  return (HOME_PERIODS as readonly string[]).includes(value ?? '') ? (value as HomePeriod) : 'month';
}

function monthStart(date: string, offset: number): string {
  const [year, month] = date.split('-').map(Number);
  return utcStayDate(new Date(Date.UTC(year, month - 1 + offset, 1)));
}

export function overviewQueryFor(period: HomePeriod, propertyId: string, today: string = todayInRome()): DashboardOverviewQuery {
  const scope = propertyId ? { propertyId } : {};
  switch (period) {
    case '30d':
      return { ...scope, period: 'Last30Days' };
    case '3m':
      return { ...scope, period: 'Custom', from: monthStart(today, -2), to: endOfMonth(today) };
    case 'year':
      return { ...scope, period: 'Custom', from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    default:
      return { ...scope, period: 'Month' };
  }
}
