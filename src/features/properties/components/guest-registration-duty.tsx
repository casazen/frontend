import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { GuestNotificationOverride, GuestRegistrationDuty } from '@/types/guest-registration.types';
import { DUTY_ANSWERS } from '../lib/guest-registration-model';

interface GuestRegistrationDutyProps {
  duty: GuestRegistrationDuty | string;
  override: GuestNotificationOverride | null;
  canWrite: boolean;
  saving: boolean;
  savingValue?: GuestNotificationOverride | null;
  busy: boolean;
  error: string | null;
  placeKnown: boolean;
  onAnswer: (override: GuestNotificationOverride | null) => void;
}

/**
 * Whether the guests of the property must be notified, as CasaZen treats it (E29/F02/US02/T01, NF-125, decision D5). A duty the sources settle is told as such. A duty
 * they do not settle for a private home (`Ask`) is the host's to decide, with two plain answers and nothing in red: the answer is saved on the property, changes nothing
 * that was already done and can be taken back at any time, so it never blocks anything. The buttons wait while any change of the card is on its way. The question is asked
 * only where the place is known: for a property whose municipality is missing «Indica il comune» comes first, and an answer given for no canton would later win over the duty of
 * the one the property turns out to be in.
 */
export function GuestRegistrationDuty({ duty, override, canWrite, saving, savingValue, busy, error, placeKnown, onAnswer }: GuestRegistrationDutyProps) {
  const { t } = useTranslation();
  const answered = override === 'Required' || override === 'NotRequired' ? override : duty === 'NotRequired' ? 'NotRequired' : null;

  let content;
  if (answered) {
    content = (
      <>
        <p className="text-sm" data-testid="guest-registration-duty-answered">
          {t(answered === 'Required' ? 'guestRegistration.duty.answeredRequired' : 'guestRegistration.duty.answeredNotRequired')}
        </p>
        {canWrite && override !== null ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy && !saving}
              loading={saving}
              onClick={() => onAnswer(null)}
              data-testid="guest-registration-duty-change"
            >
              {t('guestRegistration.duty.change')}
            </Button>
          </div>
        ) : null}
      </>
    );
  } else if (duty === 'Ask' && !placeKnown) {
    content = null;
  } else if (duty === 'Ask') {
    content = (
      <>
        <p className="text-sm" data-testid="guest-registration-duty-ask">
          {t('guestRegistration.duty.askTitle')}
        </p>
        {canWrite ? (
          <>
            <p className="text-sm font-medium">{t('guestRegistration.duty.askQuestion')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('guestRegistration.duty.askQuestion')}>
              {DUTY_ANSWERS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  disabled={busy && !(saving && savingValue === value)}
                  loading={saving && savingValue === value}
                  onClick={() => onAnswer(value)}
                  data-testid={`guest-registration-answer-${value}`}
                >
                  {t(value === 'Required' ? 'guestRegistration.duty.mustNotify' : 'guestRegistration.duty.mustNotNotify')}
                </Button>
              ))}
            </div>
            <p className="text-sm text-foreground/70">{t('guestRegistration.duty.reversible')}</p>
          </>
        ) : null}
      </>
    );
  } else if (duty === 'Required') {
    content = (
      <p className="text-sm" data-testid="guest-registration-duty-required">
        {t('guestRegistration.duty.required')}
      </p>
    );
  } else {
    content = null;
  }

  if (content === null && !error) return null;

  return (
    <div className="space-y-2" aria-live="polite" data-testid="guest-registration-duty" data-duty={duty}>
      {content}
      {error ? (
        <p className="text-sm text-destructive" role="alert" data-testid="guest-registration-duty-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
