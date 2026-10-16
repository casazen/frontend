import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useSupplierHours } from '@/queries/use-supplier';
import { formatBands, weekdayOf } from '../lib/supplier-agenda';

/** Where the weekly hours are changed: the profile, until the hours have a page of their own (SP-07b). */
export const HOURS_EDIT_PATH = '/app/supplier/profile';

/** The hours the supplier works in a normal week, one line a day, with the way to change them. Today's line is marked. */
export function WeeklyHoursSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSupplierHours();
  const todayName = weekdayOf(todayInRome());
  const configured = (data?.days ?? []).some((day) => day.bands.length > 0);

  return (
    <PlainSection
      title={t('supplier.agenda.hours.title')}
      actionLabel={t('supplier.agenda.hours.edit')}
      href={HOURS_EDIT_PATH}
      data-testid="supplier-weekly-hours"
    >
      {isError ? (
        <Alert
          variant="warning"
          data-testid="supplier-hours-error"
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              {t('supplier.retry')}
            </Button>
          }
        >
          {t('supplier.hoursLoadError')}
        </Alert>
      ) : isLoading || !data ? (
        <SkeletonLine lines={3} label={t('supplier.hoursLoading')} />
      ) : !configured ? (
        <p className="text-foreground/70">{t('supplier.agenda.hours.empty')}</p>
      ) : (
        <ul role="list" className="divide-y divide-border border-y border-border">
          {data.days.map((day) => (
            <li
              key={day.weekday}
              aria-current={day.weekday === todayName ? 'date' : undefined}
              data-testid={`agenda-hours-${day.weekday}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <span className={cn('font-medium', day.weekday === todayName && 'text-primary-text')}>{t(`supplier.weekday.${day.weekday}`)}</span>
              <span className="break-words tabular-nums text-foreground/80">{day.bands.length > 0 ? formatBands(day.bands) : t('supplier.hoursRestDay')}</span>
            </li>
          ))}
        </ul>
      )}
    </PlainSection>
  );
}
