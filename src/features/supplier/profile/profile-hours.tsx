import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useSaveSupplierHours, useSupplierHours } from '@/queries/use-supplier';
import type { SupplierAgendaHoursDay, SupplierHoursBand } from '@/types/supplier';
import { WEEKDAYS, emptyWeekHours, hmToMinutes, minutesToHm, type WeekdayName } from '../lib/supplier-agenda';
import { HOURS_SECTION_ID } from './hours-section';

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

function hoursPayloadKey(data: { configuredAt?: string | null; days: SupplierAgendaHoursDay[] }): string {
  // Prefer configuredAt when the API sends it; otherwise fingerprint days so mocks / empty weeks still hydrate once.
  return data.configuredAt ?? JSON.stringify(data.days);
}

/**
 * The weekly working hours on the profile: one band per weekday on the Rome clock, one line a day, saved with their own button.
 * An empty week is rest every day until the supplier sets hours.
 */
export function ProfileHours() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierHours();
  const saveHours = useSaveSupplierHours();
  const [draft, setDraft] = useState<Record<WeekdayName, DayDraft>>(() => toDraft(emptyWeekHours()));
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Hydrate once per server payload key (not object identity — query mocks often return a new object each render).
  const payloadKey = data ? hoursPayloadKey(data) : null;
  if (data && payloadKey !== null && payloadKey !== hydratedKey) {
    setHydratedKey(payloadKey);
    setDraft(toDraft(data.days));
  }

  const setDay = (weekday: WeekdayName, patch: Partial<DayDraft>) => {
    setProblem(null);
    setDraft((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...patch } }));
  };

  const save = async () => {
    const days = toPayload(draft);
    if (!days) {
      setProblem(t('supplier.hoursInvalid'));
      return;
    }
    setProblem(null);
    try {
      await saveHours.mutateAsync(days);
      toast.success(t('supplier.hoursUpdated'));
    } catch (saveError) {
      setProblem(getProblemMessage(saveError, t) ?? t('supplier.hoursSaveError'));
    }
  };

  let content: ReactNode;
  if (isLoading) {
    content = <SkeletonLine lines={4} label={t('supplier.hoursLoading')} />;
  } else if (isError) {
    content = <ErrorState testId="supplier-hours-error" title={t('supplier.hoursLoadError')} error={error} onRetry={() => void refetch()} />;
  } else {
    content = (
      <>
        <ul role="list" className="divide-y border-y">
          {WEEKDAYS.map((weekday) => {
            const row = draft[weekday];
            const day = t(`supplier.weekday.${weekday}`);
            return (
              <li key={weekday} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5" data-testid={`hours-day-${weekday}`}>
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm font-medium sm:w-40 sm:flex-none">
                  <Checkbox checked={row.open} onCheckedChange={(checked) => setDay(weekday, { open: checked === true })} aria-label={day} />
                  {day}
                </label>
                {row.open ? (
                  <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-0">
                    <Input
                      id={`hours-start-${weekday}`}
                      type="time"
                      aria-label={t('supplier.profile.hours.start', { day })}
                      value={row.start}
                      className="min-w-0 flex-1 pointer-coarse:h-11"
                      onChange={(e) => setDay(weekday, { start: e.target.value })}
                    />
                    <span aria-hidden="true" className="text-foreground/70">
                      –
                    </span>
                    <Input
                      id={`hours-end-${weekday}`}
                      type="time"
                      aria-label={t('supplier.profile.hours.end', { day })}
                      value={row.end}
                      className="min-w-0 flex-1 pointer-coarse:h-11"
                      onChange={(e) => setDay(weekday, { end: e.target.value })}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-foreground/70">{t('supplier.hoursRestDay')}</p>
                )}
              </li>
            );
          })}
        </ul>
        {problem ? (
          <Alert variant="danger" data-testid="supplier-hours-problem">
            {problem}
          </Alert>
        ) : null}
        <div>
          <Button type="button" loading={saveHours.isPending} className="w-full sm:w-auto" onClick={() => void save()} data-testid="supplier-hours-save">
            {t('supplier.hoursSave')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <PlainSection id={HOURS_SECTION_ID} title={t('supplier.hoursTitle')} data-testid="supplier-working-hours">
      <p className="text-sm text-foreground/70">{t('supplier.hoursDescription')}</p>
      {content}
    </PlainSection>
  );
}
