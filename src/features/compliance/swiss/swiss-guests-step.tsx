import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { SwissDocumentKind, SwissNotificationDay, SwissNotificationGuest } from '@/types/swissCompliance.types';
import { copyAllTextOf, fieldsOf, guestNameOf, missingKeysOf } from './swiss-day-model';

/** One toast for every copy: a second copy replaces the first instead of piling up a toast for each field. */
const COPY_TOAST_ID = 'swiss-notification-copied';

interface CopyButtonProps {
  value: string;
  label: string;
  testId: string;
  children?: string;
}

function CopyButton({ value, label, testId, children }: CopyButtonProps) {
  const { t } = useTranslation();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('swissNotification.copy.done'), { id: COPY_TOAST_ID });
    } catch {
      toast.error(t('swissNotification.copy.failed'), { id: COPY_TOAST_ID });
    }
  };

  return children ? (
    <Button type="button" variant="outline" size="sm" onClick={() => void copy()} aria-label={label} iconRight={<Copy />} data-testid={testId}>
      {children}
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="icon" onClick={() => void copy()} aria-label={label} title={label} data-testid={testId}>
      <Copy aria-hidden="true" className="size-4" />
    </Button>
  );
}

interface SwissGuestBlockProps {
  guest: SwissNotificationGuest;
  number: number;
}

function SwissGuestBlock({ guest, number }: SwissGuestBlockProps) {
  const { t } = useTranslation();
  const name = guestNameOf(guest, t('swissNotification.guests.unnamed', { number }));
  const fields = fieldsOf(guest, (kind: SwissDocumentKind) => t(`swissNotification.documentType.${kind}`));

  return (
    <section aria-label={name} className="space-y-2 rounded-lg border border-border p-3" data-testid="swiss-guest">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="min-w-0 break-words text-sm font-semibold">{name}</h4>
        <CopyButton
          value={copyAllTextOf(fields, (id) => t(`swissNotification.field.${id}`))}
          label={t('swissNotification.copy.allFor', { name })}
          testId="swiss-copy-all"
        >
          {t('swissNotification.copy.all')}
        </CopyButton>
      </div>
      <dl className="divide-y divide-border">
        {fields.map((field) => {
          const label = t(`swissNotification.field.${field.id}`);
          return (
            <div key={field.id} className="grid min-w-0 grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-x-3" data-testid={`swiss-field-${field.id}`}>
              <dt className="break-words text-sm text-foreground/70">{label}</dt>
              <dd className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-medium" data-testid={`swiss-field-${field.id}-value`}>
                  {field.value}
                </span>
                <CopyButton value={field.value} label={t('swissNotification.copy.fieldFor', { field: label, name })} testId={`swiss-copy-${field.id}`} />
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

interface SwissGuestsStepProps {
  day: SwissNotificationDay;
  canEditGuests: boolean;
  busy: boolean;
  onComplete: (bookingId: string) => void;
  onNext: () => void;
}

export function SwissGuestsStep({ day, canEditGuests, busy, onComplete, onNext }: SwissGuestsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="swiss-guests">
      <p className="text-sm text-foreground/70">{t('swissNotification.guests.intro')}</p>

      {day.guests.length > 0 ? (
        <ul className="space-y-3" data-testid="swiss-guest-list">
          {day.guests.map((guest, index) => (
            <li key={`${guest.bookingId}-${guest.position}`}>
              <SwissGuestBlock guest={guest} number={index + 1} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/70" data-testid="swiss-guests-none">
          {t('swissNotification.guests.none')}
        </p>
      )}

      {day.issues.length > 0 ? (
        <div className="space-y-2" role="status" data-testid="swiss-issues">
          <p className="text-sm font-medium">{t('swissNotification.issues.title', { count: day.issues.length })}</p>
          <ul className="space-y-2 text-sm">
            {day.issues.map((issue) => (
              <li key={`${issue.bookingId}-${issue.position ?? 'stay'}`} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  {issue.guestName}
                  {`: ${missingKeysOf(issue.missing).map((key) => t(key)).join(', ')}`}
                </span>
                {canEditGuests ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onComplete(issue.bookingId)}
                    aria-label={t('swissNotification.issues.completeFor', { name: issue.guestName })}
                    data-testid="swiss-complete-guest"
                  >
                    {t('swissNotification.issues.complete')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-sm text-foreground/70" data-testid="swiss-issues-body">
            {canEditGuests ? t('swissNotification.issues.body') : t('swissNotification.issues.bodyNoEdit')}
          </p>
        </div>
      ) : null}

      {day.guests.length > 0 ? (
        <Button type="button" onClick={onNext} disabled={busy} data-testid="swiss-guests-next">
          {t('swissNotification.actions.next')}
        </Button>
      ) : null}
    </div>
  );
}
