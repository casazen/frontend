import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { todayInRome } from '@/lib/stay-dates';
import type { DashboardPeriodSelection } from '@/types/dashboard.types';

/** Months offered besides the current one: the last year and the next six months (forward occupancy). */
const PAST_MONTHS = 12;
const FUTURE_MONTHS = 6;

const CURRENT = 'current';
const LAST_30_DAYS = 'last30';
const MONTH_PREFIX = 'month:';

/** `yyyy-MM` of the month `offset` months from the one of `today` (`yyyy-MM-dd`). */
function shiftMonth(today: string, offset: number): string {
  const [year, month] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string, locale: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
}

function toValue(selection: DashboardPeriodSelection): string {
  if (selection.kind === 'Last30Days') return LAST_30_DAYS;
  return selection.month ? `${MONTH_PREFIX}${selection.month}` : CURRENT;
}

function fromValue(value: string): DashboardPeriodSelection {
  if (value === LAST_30_DAYS) return { kind: 'Last30Days' };
  if (value.startsWith(MONTH_PREFIX)) return { kind: 'Month', month: value.slice(MONTH_PREFIX.length) };
  return { kind: 'Month' };
}

interface DashboardPeriodSelectProps {
  value: DashboardPeriodSelection;
  onChange: (value: DashboardPeriodSelection) => void;
}

/** Period of the dashboard KPIs: current month (Europe/Rome), last 30 days, or another month. */
export function DashboardPeriodSelect({ value, onChange }: DashboardPeriodSelectProps) {
  const { t, i18n } = useTranslation();
  const months = useMemo(() => {
    const today = todayInRome();
    const list: string[] = [];
    for (let offset = FUTURE_MONTHS; offset >= -PAST_MONTHS; offset -= 1) {
      if (offset !== 0) list.push(shiftMonth(today, offset));
    }
    return list;
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="dashboard-period" className="text-sm text-muted-foreground">
        {t('dashboard.period.label')}
      </Label>
      <select
        id="dashboard-period"
        data-testid="dashboard-period"
        value={toValue(value)}
        onChange={(event) => onChange(fromValue(event.target.value))}
        className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <option value={CURRENT}>{t('dashboard.period.currentMonth')}</option>
        <option value={LAST_30_DAYS}>{t('dashboard.period.last30Days')}</option>
        <optgroup label={t('dashboard.period.otherMonths')}>
          {months.map((month) => (
            <option key={month} value={`${MONTH_PREFIX}${month}`}>
              {formatMonth(month, i18n.language)}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
