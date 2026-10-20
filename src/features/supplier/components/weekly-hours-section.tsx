import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useSupplierHours } from '@/queries/supplier/use-calendar';
import { HOURS_SECTION_ID, focusHoursSection } from '../profile/hours-section';
import { formatBands, weekdayOf } from '../lib/supplier-agenda';
import { WeeklyHoursEditor } from './weekly-hours-editor';

interface WeeklyHoursSectionProps {
  /** The hours are being changed (the block at the top of the page that asks for them opens the editor too). */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

/**
 * The hours the supplier works in a normal week, one line a day (all the bands of the day), with the way to change them: the editor opens in
 * this place, up to three bands a day (SP-07b). Today's line is marked.
 */
export function WeeklyHoursSection({ editing, onEditingChange }: WeeklyHoursSectionProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSupplierHours();
  const todayName = weekdayOf(todayInRome());
  const configured = (data?.days ?? []).some((day) => day.bands.length > 0);

  // The editor opens far from the block that asked for it: bring it into view and put the keyboard on its first day.
  useEffect(() => {
    if (editing) focusHoursSection();
  }, [editing]);

  const action = editing ? {} : { actionLabel: t('supplier.agenda.hours.edit'), onAction: () => onEditingChange(true) };

  return (
    <PlainSection id={HOURS_SECTION_ID} title={t('supplier.agenda.hours.title')} data-testid="supplier-weekly-hours" {...action}>
      {editing ? (
        <>
          <p className="text-sm text-foreground/70">{t('supplier.hoursDescription')}</p>
          <WeeklyHoursEditor onSaved={() => onEditingChange(false)} onCancel={() => onEditingChange(false)} />
        </>
      ) : isError ? (
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
