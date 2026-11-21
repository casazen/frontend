import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import type { BookingFlowMode, BookingFlowSettings, PropertyReadyTrigger } from '@/types/booking-flow.types';
import { useBookingFlowSettings, useUpdateBookingFlowSettings } from './use-booking-flow-settings';

/** The steps the organization can switch between CasaZen and the host, and the member of the settings each one is. */
type SwitchableStep = 'checkInLink' | 'arrival' | 'departure' | 'propertyReady';

const MODE_OF: Record<SwitchableStep, keyof Pick<BookingFlowSettings, 'checkInLinkMode' | 'arrivalMode' | 'departureMode' | 'propertyReadyMode'>> = {
  checkInLink: 'checkInLinkMode',
  arrival: 'arrivalMode',
  departure: 'departureMode',
  propertyReady: 'propertyReadyMode',
};

/**
 * Every step of a booking, in the order a stay goes through them: the ones CasaZen can do by itself carry a switch (and the parameter the step needs), the others say who
 * does them and why. The legal steps (the guest data, Alloggiati Web) are never CasaZen's to do in the host's place.
 */
const STEPS: readonly { key: string; switchable?: SwitchableStep }[] = [
  { key: 'confirmation' },
  { key: 'checkInLink', switchable: 'checkInLink' },
  { key: 'guestData' },
  { key: 'arrival', switchable: 'arrival' },
  { key: 'alloggiati' },
  { key: 'departure', switchable: 'departure' },
  { key: 'cleaning' },
  { key: 'propertyReady', switchable: 'propertyReady' },
];

type Form = Omit<BookingFlowSettings, 'maxCheckInLinkDaysBefore' | 'isDefault'>;

function formOf(settings: BookingFlowSettings): Form {
  return {
    checkInLinkMode: settings.checkInLinkMode,
    checkInLinkDaysBefore: settings.checkInLinkDaysBefore,
    arrivalMode: settings.arrivalMode,
    departureMode: settings.departureMode,
    propertyReadyMode: settings.propertyReadyMode,
    propertyReadyTrigger: settings.propertyReadyTrigger,
  };
}

function isChanged(form: Form, settings: BookingFlowSettings): boolean {
  const saved = formOf(settings);
  return (Object.keys(saved) as (keyof Form)[]).some((key) => saved[key] !== form[key]);
}

/**
 * «Flusso», a tab of Prenotazioni (casazen/backend#978): every step of a booking and, for the ones CasaZen can do by itself, whether it does (the default) or the host does.
 * What is automatic no longer lands in the «Da fare» list. One block, one button: whoever is not the organization administrator reads it and is told who can change it.
 */
export function BookingFlowPage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const canEdit = isOrgBillingAdmin(contexts);
  const settings = useBookingFlowSettings();

  return (
    <div className="space-y-6">
      <PageHeader title={t('bookingFlow.title')} description={t('bookingFlow.intro')} crumbs="auto" />
      {settings.isLoading ? (
        <div className="max-w-3xl space-y-3" data-testid="booking-flow-loading">
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
        </div>
      ) : settings.data ? (
        <BookingFlowForm key={JSON.stringify(settings.data)} settings={settings.data} canEdit={canEdit} />
      ) : (
        <Alert variant="warning" data-testid="booking-flow-error">
          {t('bookingFlow.loadFailed')}
        </Alert>
      )}
    </div>
  );
}

function BookingFlowForm({ settings, canEdit }: { settings: BookingFlowSettings; canEdit: boolean }) {
  const { t } = useTranslation();
  const update = useUpdateBookingFlowSettings();
  const [form, setForm] = useState<Form>(() => formOf(settings));
  const edit = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const disabled = !canEdit || update.isPending;
  const max = settings.maxCheckInLinkDaysBefore;
  const daysInvalid = !Number.isInteger(form.checkInLinkDaysBefore) || form.checkInLinkDaysBefore < 0 || form.checkInLinkDaysBefore > max;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || daysInvalid) return;
    update.mutate(form);
  };

  const automatic = (step: SwitchableStep) => form[MODE_OF[step]] === 'Automatic';
  const setMode = (step: SwitchableStep, on: boolean) => edit({ [MODE_OF[step]]: (on ? 'Automatic' : 'Manual') satisfies BookingFlowMode });

  const parameterOf = (step: SwitchableStep) => {
    if (step === 'checkInLink' && automatic('checkInLink')) {
      return (
        <Field
          label={t('bookingFlow.steps.checkInLink.days.label')}
          hint={t('bookingFlow.steps.checkInLink.days.hint', { max })}
          error={daysInvalid ? t('bookingFlow.errors.days', { max }) : undefined}
          className="max-w-xs"
        >
          <Input
            data-testid="booking-flow-days"
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            step={1}
            value={Number.isNaN(form.checkInLinkDaysBefore) ? '' : form.checkInLinkDaysBefore}
            disabled={disabled}
            onChange={(event) => edit({ checkInLinkDaysBefore: event.target.value === '' ? Number.NaN : Number(event.target.value) })}
          />
        </Field>
      );
    }
    if (step === 'propertyReady' && automatic('propertyReady')) {
      return (
        <Field label={t('bookingFlow.steps.propertyReady.trigger.label')} hint={t(`bookingFlow.steps.propertyReady.trigger.hint.${form.propertyReadyTrigger}`)} className="max-w-sm">
          <Select
            data-testid="booking-flow-trigger"
            value={form.propertyReadyTrigger}
            disabled={disabled}
            onChange={(event) => edit({ propertyReadyTrigger: event.target.value as PropertyReadyTrigger })}
          >
            <option value="CleaningDone">{t('bookingFlow.steps.propertyReady.trigger.CleaningDone')}</option>
            <option value="CheckOut">{t('bookingFlow.steps.propertyReady.trigger.CheckOut')}</option>
          </Select>
        </Field>
      );
    }
    return null;
  };

  return (
    <form className="max-w-3xl space-y-6" onSubmit={submit} data-testid="booking-flow-form">
      <ol className="divide-y rounded-xl border">
        {STEPS.map(({ key, switchable }, index) => (
          <li key={key} className="space-y-3 p-4" data-testid={`booking-flow-step-${key}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <h2 className="font-semibold">
                  <span className="mr-2 text-foreground/60">{index + 1}.</span>
                  {switchable ? <Label htmlFor={`booking-flow-${key}`}>{t(`bookingFlow.steps.${key}.title`)}</Label> : t(`bookingFlow.steps.${key}.title`)}
                </h2>
                <p id={`booking-flow-${key}-help`} className="break-words text-sm text-foreground/70">
                  {switchable
                    ? t(`bookingFlow.steps.${key}.${automatic(switchable) ? 'automatic' : 'manual'}`)
                    : t(`bookingFlow.steps.${key}.fixed`)}
                </p>
              </div>
              {switchable ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm text-foreground/70" aria-hidden="true">
                    {t(automatic(switchable) ? 'bookingFlow.mode.Automatic' : 'bookingFlow.mode.Manual')}
                  </span>
                  <Switch
                    id={`booking-flow-${key}`}
                    aria-describedby={`booking-flow-${key}-help`}
                    data-testid={`booking-flow-switch-${key}`}
                    checked={automatic(switchable)}
                    disabled={disabled}
                    onCheckedChange={(checked) => setMode(switchable, checked)}
                  />
                </div>
              ) : (
                <span className="shrink-0 text-sm text-foreground/70">{t(`bookingFlow.steps.${key}.who`)}</span>
              )}
            </div>
            {switchable && parameterOf(switchable)}
          </li>
        ))}
      </ol>

      {update.isError && (
        <Alert variant="danger" data-testid="booking-flow-save-error">
          {getProblemMessage(update.error, t) ?? t('bookingFlow.saveFailed')}
        </Alert>
      )}

      {canEdit ? (
        <Button type="submit" loading={update.isPending} disabled={update.isPending || daysInvalid || !isChanged(form, settings)} data-testid="booking-flow-save">
          {t('bookingFlow.save')}
        </Button>
      ) : (
        <p className="text-sm text-foreground/70" data-testid="booking-flow-read-only">
          {t('bookingFlow.readOnly')}
        </p>
      )}
    </form>
  );
}
