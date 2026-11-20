import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TicinoNotificationDay } from '@/types/swissCompliance.types';
import { knownWarningCodesOf, minorsCountedOf, missingKeysOf } from './ticino-day-model';

interface TicinoGuestsStepProps {
  day: TicinoNotificationDay;
  /** The person may correct the guests of a stay (`booking.write`, what the host form of the guests asks): «Completa i dati» opens it. */
  canEditGuests: boolean;
  /** Any request of the layer is on its way: the buttons wait for it. */
  busy: boolean;
  /** Opens the editor of the guests of a stay, inside the layer. */
  onComplete: (bookingId: string) => void;
  onNext: () => void;
}

/**
 * Step 1 «Ospiti da notificare»: who is in the file of the day, who is left out and what each of them misses, with «Completa i dati» to put it right without
 * leaving the layer; what the file alone does not settle (the authorization of the parents, the sheet of a group) and the letters the file writes without their accent.
 */
export function TicinoGuestsStep({ day, canEditGuests, busy, onComplete, onNext }: TicinoGuestsStepProps) {
  const { t } = useTranslation();
  const minors = minorsCountedOf(day);
  const warnings = knownWarningCodesOf(day);

  return (
    <div className="space-y-4" data-testid="ticino-guests">
      {day.rows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-foreground/70" data-testid="ticino-guests-ready">
            {t('swiss.guests.ready', { count: day.rows.length })}
            {minors > 0 ? ` ${t('swiss.guests.minors', { count: minors })}` : ''}
          </p>
          <ul className="space-y-1 text-sm" data-testid="ticino-guest-rows">
            {day.rows.map((row, index) => (
              <li key={`${row.bookingId}-${index}`} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words font-medium">{row.guestName}</span>
                {row.kind === 'group' ? <Badge variant="outline">{t('swiss.guests.group', { count: row.groupSize })}</Badge> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-foreground/70" data-testid="ticino-guests-none">
          {t('swiss.guests.none')}
        </p>
      )}

      {day.issues.length > 0 ? (
        <div className="space-y-2" role="status" data-testid="ticino-issues">
          <p className="text-sm font-medium">{t('swiss.issues.title', { count: day.issues.length })}</p>
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
                    aria-label={t('swiss.issues.completeFor', { name: issue.guestName })}
                    data-testid="ticino-complete-guest"
                  >
                    {t('swiss.issues.complete')}
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/app/short-rent/bookings/${issue.bookingId}?tab=alloggiati`} aria-label={t('swiss.issues.openBookingFor', { name: issue.guestName })}>
                      {t('swiss.issues.openBooking')}
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-foreground/70">{t('swiss.issues.body')}</p>
        </div>
      ) : null}

      {warnings.map((code) => (
        <Alert key={code} variant="warning" data-testid={`ticino-warning-${code}`}>
          {t(`swiss.warnings.${code}`)}
        </Alert>
      ))}

      {day.transliteratedCount > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="ticino-transliterated">
          {t('swiss.guests.transliterated', { count: day.transliteratedCount })}
        </p>
      ) : null}

      {day.rows.length > 0 ? (
        <Button type="button" onClick={onNext} disabled={busy} data-testid="ticino-guests-next">
          {t('swiss.actions.next')}
        </Button>
      ) : null}
    </div>
  );
}
