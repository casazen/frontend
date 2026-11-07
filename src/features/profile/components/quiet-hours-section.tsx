import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSaveNotificationPreferences } from '@/queries/use-notification-preferences';
import type { NotificationQuietHours } from '@/types';
import { quietHoursSave, toTimeFieldValue, type QuietHoursFields } from '../notification-preferences-model';

interface QuietHoursSectionProps {
  quietHours: NotificationQuietHours;
}

/**
 * The quiet hours of the caller (E05/F03/US02, NF-65): from when to when the phone and the email wait, in Italian time. The counter of the bell
 * never waits, and a legal deadline alerts anyway (the page says so while the server says so). Two fields and a button: unlike the switches of
 * the matrix, two times are not saved one at a time, a half-typed hour would be sent.
 */
export function QuietHoursSection({ quietHours }: QuietHoursSectionProps) {
  const { t } = useTranslation();
  const save = useSaveNotificationPreferences();
  // `null` until the person types: the fields then show what the server has, read from the props and not copied into state.
  const [draft, setDraft] = useState<QuietHoursFields | null>(null);

  const stored: QuietHoursFields = { start: toTimeFieldValue(quietHours.start), end: toTimeFieldValue(quietHours.end) };
  const fields = draft ?? stored;
  const request = quietHoursSave(fields);
  const changed = fields.start !== stored.start || fields.end !== stored.end;
  const noQuietHours = request !== null && fields.start === fields.end;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changed || !request) return;
    save.mutate(request, { onSuccess: () => setDraft(null) });
  };

  return (
    <PlainSection title={t('notificationPreferences.quietHours.title')} data-testid="quiet-hours">
      <p className="text-sm text-foreground/70">{t('notificationPreferences.quietHours.description')}</p>

      <form onSubmit={submit} noValidate className="space-y-4" data-testid="quiet-hours-form">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('notificationPreferences.quietHours.start')} error={changed && !fields.start ? t('notificationPreferences.quietHours.required') : undefined}>
            <Input
              type="time"
              value={fields.start}
              onChange={(event) => setDraft({ ...fields, start: event.target.value })}
              data-testid="quiet-hours-start"
            />
          </Field>
          <Field label={t('notificationPreferences.quietHours.end')} error={changed && !fields.end ? t('notificationPreferences.quietHours.required') : undefined}>
            <Input
              type="time"
              value={fields.end}
              onChange={(event) => setDraft({ ...fields, end: event.target.value })}
              data-testid="quiet-hours-end"
            />
          </Field>
        </div>

        {noQuietHours ? (
          <p role="status" className="text-sm text-foreground/70" data-testid="quiet-hours-none">
            {t('notificationPreferences.quietHours.none')}
          </p>
        ) : null}
        {quietHours.legalAlertsOverride ? (
          <p className="text-sm font-medium" data-testid="quiet-hours-legal">
            {t('notificationPreferences.quietHours.legalStillAlerts')}
          </p>
        ) : null}

        <Button type="submit" loading={save.isPending} disabled={!changed || request === null} data-testid="quiet-hours-save">
          {t('notificationPreferences.quietHours.save')}
        </Button>
      </form>
    </PlainSection>
  );
}
