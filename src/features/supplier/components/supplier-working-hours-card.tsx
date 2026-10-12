import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ErrorState } from '@/components/shared/error-state';
import { getProblemMessage } from '@/lib/api-errors';
import { useSaveSupplierHours, useSupplierHours } from '@/queries/use-supplier';
import type { SupplierAgendaHoursDay, SupplierHoursBand } from '@/types/supplier';
import { WEEKDAYS, emptyWeekHours, hmToMinutes, minutesToHm, type WeekdayName } from '../lib/supplier-agenda';

type DayDraft = { open: boolean; start: string; end: string };

function toDraft(days: SupplierAgendaHoursDay[] | undefined): Record<WeekdayName, DayDraft> {
  const base = Object.fromEntries(
    WEEKDAYS.map((weekday) => [weekday, { open: false, start: '09:00', end: '18:00' }]),
  ) as Record<WeekdayName, DayDraft>;

  for (const day of days ?? []) {
    const band = day.bands[0];
    if (!band) continue;
    base[day.weekday as WeekdayName] = {
      open: true,
      start: minutesToHm(band.startMinute) || '09:00',
      end: minutesToHm(band.endMinute) || '18:00',
    };
  }
  return base;
}

function toPayload(draft: Record<WeekdayName, DayDraft>): SupplierAgendaHoursDay[] | null {
  const days: SupplierAgendaHoursDay[] = [];
  for (const weekday of WEEKDAYS) {
    const row = draft[weekday];
    if (!row.open) {
      days.push({ weekday, bands: [] });
      continue;
    }
    const startMinute = hmToMinutes(row.start);
    const endMinute = hmToMinutes(row.end);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) return null;
    const bands: SupplierHoursBand[] = [{ startMinute, endMinute }];
    days.push({ weekday, bands });
  }
  return days;
}

/**
 * Weekly working hours on the supplier profile (and reusable elsewhere): one band per weekday on the Rome clock.
 * Empty week = rest every day until the supplier sets hours.
 */
export function SupplierWorkingHoursCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierHours();
  const saveHours = useSaveSupplierHours();
  const [draft, setDraft] = useState<Record<WeekdayName, DayDraft>>(() => toDraft(emptyWeekHours()));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setDraft(toDraft(data.days));
      setHydrated(true);
    }
  }, [data, hydrated]);

  if (isLoading) {
    return <LoadingScreen message={t('supplier.hoursLoading')} className="h-auto py-8" />;
  }

  if (isError) {
    return (
      <ErrorState
        testId="supplier-hours-error"
        title={t('supplier.hoursLoadError')}
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  const setDay = (weekday: WeekdayName, patch: Partial<DayDraft>) => {
    setDraft((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...patch } }));
  };

  const save = async () => {
    const days = toPayload(draft);
    if (!days) {
      toast.error(t('supplier.hoursInvalid'));
      return;
    }
    try {
      await saveHours.mutateAsync(days);
      toast.success(t('supplier.hoursUpdated'));
      setHydrated(false);
    } catch (saveError) {
      toast.error(getProblemMessage(saveError, t) ?? t('supplier.hoursSaveError'));
    }
  };

  return (
    <Card data-testid="supplier-working-hours">
      <CardHeader>
        <CardTitle>{t('supplier.hoursTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('supplier.hoursDescription')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {WEEKDAYS.map((weekday) => {
          const row = draft[weekday];
          return (
            <div
              key={weekday}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
              data-testid={`hours-day-${weekday}`}
            >
              <label className="flex min-w-[7rem] items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={row.open}
                  onCheckedChange={(checked) => setDay(weekday, { open: checked === true })}
                  aria-label={t(`supplier.weekday.${weekday}`)}
                />
                {t(`supplier.weekday.${weekday}`)}
              </label>
              {row.open ? (
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`hours-start-${weekday}`} className="sr-only">
                      {t('supplier.hoursStart')}
                    </Label>
                    <Input
                      id={`hours-start-${weekday}`}
                      type="time"
                      value={row.start}
                      onChange={(e) => setDay(weekday, { start: e.target.value })}
                    />
                  </div>
                  <span className="text-muted-foreground">–</span>
                  <div className="flex-1">
                    <Label htmlFor={`hours-end-${weekday}`} className="sr-only">
                      {t('supplier.hoursEnd')}
                    </Label>
                    <Input
                      id={`hours-end-${weekday}`}
                      type="time"
                      value={row.end}
                      onChange={(e) => setDay(weekday, { end: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('supplier.hoursRestDay')}</p>
              )}
            </div>
          );
        })}
        <Button onClick={() => void save()} disabled={saveHours.isPending} data-testid="supplier-hours-save">
          {t('supplier.hoursSave')}
        </Button>
      </CardContent>
    </Card>
  );
}
