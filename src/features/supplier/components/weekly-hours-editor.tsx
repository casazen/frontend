import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useSaveSupplierHours, useSupplierHours } from '@/queries/use-supplier';
import { WEEKDAYS, emptyWeekHours, type WeekdayName } from '../lib/supplier-agenda';
import {
  MAX_BANDS_PER_DAY,
  bandAfter,
  toDraft,
  toPayload,
  type BandDraft,
  type DayDraft,
  type DayProblem,
  type WeekDraft,
} from '../lib/weekly-hours';

interface WeeklyHoursEditorProps {
  /** The hours were saved. */
  onSaved?: () => void;
  /** Shows "Annulla" beside the save button and calls this: what was changed is dropped. */
  onCancel?: () => void;
}

function hoursPayloadKey(data: { configuredAt?: string | null; days: unknown }): string {
  // Prefer configuredAt when the API sends it; otherwise fingerprint days so mocks / empty weeks still hydrate once.
  return data.configuredAt ?? JSON.stringify(data.days);
}

/**
 * The weekly working hours as they are changed (SP-07b): one line a day with its bands, up to three (a morning, a lunch break and an
 * afternoon), on the Rome clock. A day is open or a rest day; a band is two times and can be taken away; a day gets another with "Aggiungi
 * una fascia". Saving sends the whole week (`PUT api/supplier/availability/hours` replaces it), after checking what the API checks: every end
 * after its start and no two bands of a day over each other, said under the day that has the problem. An empty week is rest every day.
 */
export function WeeklyHoursEditor({ onSaved, onCancel }: WeeklyHoursEditorProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierHours();
  const saveHours = useSaveSupplierHours();
  const [draft, setDraft] = useState<WeekDraft>(() => toDraft(emptyWeekHours()));
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [problems, setProblems] = useState<Partial<Record<WeekdayName, DayProblem>>>({});
  const [saveProblem, setSaveProblem] = useState<string | null>(null);

  // Hydrate once per server payload key (not object identity — query mocks often return a new object each render).
  const payloadKey = data ? hoursPayloadKey(data) : null;
  if (data && payloadKey !== null && payloadKey !== hydratedKey) {
    setHydratedKey(payloadKey);
    setDraft(toDraft(data.days));
  }

  const changeDay = (weekday: WeekdayName, update: (day: DayDraft) => DayDraft) => {
    setProblems({});
    setSaveProblem(null);
    setDraft((previous) => ({ ...previous, [weekday]: update(previous[weekday]) }));
  };
  const changeBand = (weekday: WeekdayName, key: number, patch: Partial<Pick<BandDraft, 'start' | 'end'>>) =>
    changeDay(weekday, (day) => ({ ...day, bands: day.bands.map((band) => (band.key === key ? { ...band, ...patch } : band)) }));
  const addBand = (weekday: WeekdayName) =>
    changeDay(weekday, (day) => ({ ...day, bands: [...day.bands, bandAfter(day.bands[day.bands.length - 1])] }));
  const removeBand = (weekday: WeekdayName, key: number) =>
    changeDay(weekday, (day) => ({ ...day, bands: day.bands.filter((band) => band.key !== key) }));

  const save = async () => {
    const { days, problems: found } = toPayload(draft);
    setSaveProblem(null);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    try {
      await saveHours.mutateAsync(days);
      toast.success(t('supplier.hoursUpdated'));
      onSaved?.();
    } catch (saveError) {
      setSaveProblem(getProblemMessage(saveError, t) ?? t('supplier.hoursSaveError'));
    }
  };

  if (isLoading) return <SkeletonLine lines={4} label={t('supplier.hoursLoading')} />;
  if (isError) {
    return <ErrorState testId="supplier-hours-error" title={t('supplier.hoursLoadError')} error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-3" data-testid="supplier-hours-editor">
      <ul role="list" className="divide-y border-y">
        {WEEKDAYS.map((weekday) => {
          const day = draft[weekday];
          const dayName = t(`supplier.weekday.${weekday}`);
          const problem = problems[weekday];
          return (
            <li key={weekday} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-1.5" data-testid={`hours-day-${weekday}`}>
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm font-medium sm:w-40 sm:flex-none">
                <Checkbox
                  checked={day.open}
                  onCheckedChange={(checked) => changeDay(weekday, (current) => ({ ...current, open: checked === true }))}
                  aria-label={dayName}
                />
                {dayName}
              </label>
              {day.open ? (
                <div className="min-w-0 basis-full space-y-2 sm:flex-1 sm:basis-0">
                  {day.bands.map((band, index) => (
                    <div key={band.key} className="flex min-w-0 items-center gap-2" data-testid={`hours-band-${weekday}-${index}`}>
                      <Input
                        type="time"
                        aria-label={t('supplier.agenda.hours.bandStart', { day: dayName, n: index + 1 })}
                        value={band.start}
                        className="min-w-0 flex-1 pointer-coarse:h-11"
                        onChange={(event) => changeBand(weekday, band.key, { start: event.target.value })}
                      />
                      <span aria-hidden="true" className="text-foreground/70">
                        –
                      </span>
                      <Input
                        type="time"
                        aria-label={t('supplier.agenda.hours.bandEnd', { day: dayName, n: index + 1 })}
                        value={band.end}
                        className="min-w-0 flex-1 pointer-coarse:h-11"
                        onChange={(event) => changeBand(weekday, band.key, { end: event.target.value })}
                      />
                      {day.bands.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          aria-label={t('supplier.agenda.hours.removeBand', { day: dayName, n: index + 1 })}
                          onClick={() => removeBand(weekday, band.key)}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {day.bands.length < MAX_BANDS_PER_DAY ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => addBand(weekday)}>
                      <Plus aria-hidden="true" className="size-4" />
                      {t('supplier.agenda.hours.addBand')}
                    </Button>
                  ) : (
                    <p className="text-xs text-foreground/70">{t('supplier.agenda.hours.maxBands', { max: MAX_BANDS_PER_DAY })}</p>
                  )}
                  {problem ? (
                    <p role="alert" className="break-words text-sm font-medium text-danger-foreground" data-testid={`hours-problem-${weekday}`}>
                      {problem === 'overlap'
                        ? t('supplier.agenda.hours.problem.overlap', { day: dayName })
                        : t('supplier.agenda.hours.problem.order', { day: dayName })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="flex min-h-11 items-center text-sm text-foreground/70">{t('supplier.hoursRestDay')}</p>
              )}
            </li>
          );
        })}
      </ul>
      {saveProblem ? (
        <Alert variant="danger" data-testid="supplier-hours-problem">
          {saveProblem}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={saveHours.isPending} className="w-full sm:w-auto" onClick={() => void save()} data-testid="supplier-hours-save">
          {t('supplier.hoursSave')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel} data-testid="supplier-hours-cancel">
            {t('shared.cancel')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
