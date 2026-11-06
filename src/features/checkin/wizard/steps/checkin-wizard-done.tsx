import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Info, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { CheckInDialog } from '@/features/bookings/components/check-in-dialog';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { getProblemMessage } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import { useBooking } from '@/queries/use-bookings';
import { useConfirmCheckIn } from '@/queries/use-checkin-wizard';
import type { CheckInConfirmation } from '@/types/checkin-wizard.types';
import { failedGuestPositions, octorateResultKind } from '../lib/checkin-wizard-model';

/** Why Octorate did not take a guest, in plain words; a code this version does not know still reads as a sentence. */
const OCTORATE_ERROR_KEYS: Readonly<Record<string, string>> = {
  octorate_auth: 'checkin.wizard.done.octorateError.octorate_auth',
  octorate_rate_limited: 'checkin.wizard.done.octorateError.octorate_rate_limited',
  octorate_conflict: 'checkin.wizard.done.octorateError.octorate_conflict',
  octorate_not_found: 'checkin.wizard.done.octorateError.octorate_not_found',
  octorate_server: 'checkin.wizard.done.octorateError.octorate_server',
  octorate_guest_rejected: 'checkin.wizard.done.octorateError.octorate_guest_rejected',
};

/** Why the tourist tax was not saved, in plain words. */
const TAX_REASON_KEYS: Readonly<Record<string, string>> = {
  tax_not_calculable: 'checkin.wizard.done.taxReason.tax_not_calculable',
  booking_not_active: 'checkin.wizard.done.taxReason.booking_not_active',
};

interface CheckInWizardDoneProps {
  bookingId: string;
  guestName: string;
  result: CheckInConfirmation;
}

/**
 * "What happens now" (NF-05): one line per element with its state, from what the server answered to the confirmation and nothing assumed.
 * The guests in Octorate (sent, not sent because the sender is not the channel manager, not connected, or failed with the reason and "Retry
 * now", which confirms again), the tourist tax (saved or why not), the police communication of the sender of the property with what happens
 * next, a warning when data already sent to the police changed, and one next step: "Register arrival" when the stay can be registered. This
 * is the end of the flow: it may link out.
 */
export function CheckInWizardDone({ bookingId, guestName, result }: CheckInWizardDoneProps) {
  const { t, i18n } = useTranslation();
  const confirm = useConfirmCheckIn(bookingId);
  const booking = useBooking(bookingId);
  const [current, setCurrent] = useState(result);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const { octorate, tax, alloggiati, state } = current;
  const kind = octorateResultKind(octorate);
  const failed = failedGuestPositions(octorate);
  const errorCode = octorate.guests.find((guest) => guest.errorCode)?.errorCode ?? octorate.reason ?? null;
  const errorText = errorCode && OCTORATE_ERROR_KEYS[errorCode] ? t(OCTORATE_ERROR_KEYS[errorCode]) : t('checkin.wizard.done.octorateError.unknown');
  const money = (amount: number) => formatCurrency(amount, 'EUR', i18n.language.startsWith('en') ? 'en-GB' : 'it-IT');

  const retry = async () => {
    setRetryError(null);
    try {
      setCurrent(await confirm.mutateAsync());
    } catch (error) {
      setRetryError(getProblemMessage(error, t) ?? t('checkin.wizard.done.retryFailed'));
    }
  };

  const octorateLine =
    kind === 'failed' || kind === 'partlyFailed'
      ? t(`checkin.wizard.done.octorate.${kind}`, { count: failed.length, reason: errorText })
      : t(`checkin.wizard.done.octorate.${kind}`);

  const taxTotal = state.tax?.total;
  const taxLine = tax.saved
    ? taxTotal == null
      ? t('checkin.wizard.done.tax.savedNoAmount')
      : t('checkin.wizard.done.tax.saved', { amount: money(taxTotal) })
    : t('checkin.wizard.done.tax.notSaved', {
        reason: tax.reason && TAX_REASON_KEYS[tax.reason] ? t(TAX_REASON_KEYS[tax.reason]) : t('checkin.wizard.done.taxReason.unknown'),
      });

  const whatNext = [
    { text: octorateLine, icon: kind === 'failed' || kind === 'partlyFailed' ? CircleAlert : Users },
    { text: taxLine, icon: tax.saved ? CheckCircle2 : Info },
    { text: t(`checkin.wizard.done.police.${alloggiati.step}`), icon: Info },
  ];

  const stay = `${BOOKINGS_PATH}/${bookingId}`;

  return (
    <WizardDone
      title={t('checkin.wizard.done.title')}
      description={t('checkin.wizard.done.description', { guest: guestName })}
      whatNext={whatNext}
      primary={{ label: t('checkin.wizard.done.toBooking'), to: stay }}
      secondary={{ label: t('checkin.wizard.done.toCompliance'), to: '/app/short-rent/compliance' }}
    >
      <div className="space-y-4" data-testid="checkin-wizard-done">
        {(kind === 'failed' || kind === 'partlyFailed') && (
          <Alert
            variant="danger"
            title={t('checkin.wizard.done.retryTitle')}
            data-testid="checkin-wizard-done-retry"
            action={
              <Button type="button" size="sm" onClick={() => void retry()} disabled={confirm.isPending} data-testid="checkin-wizard-retry">
                {t('checkin.wizard.done.retryNow')}
              </Button>
            }
          >
            {retryError ?? t('checkin.wizard.done.retryText')}
          </Alert>
        )}

        {alloggiati.step === 'Manual' && (
          <p className="text-sm" data-testid="checkin-wizard-done-manual">
            <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`${stay}?tab=alloggiati`}>
              {t('checkin.wizard.done.manualGuide')}
            </Link>
          </p>
        )}

        {octorate.correctionAfterSend && (
          <Alert variant="warning" icon={AlertTriangle} data-testid="checkin-wizard-done-correction">
            {t('checkin.wizard.done.correctionAfterSend')}
          </Alert>
        )}

        {state.capabilities.canRegisterArrival && (
          <div className="rounded-lg border p-4" data-testid="checkin-wizard-done-next">
            <p className="mb-3 text-sm font-medium">{t('checkin.wizard.done.nextStep')}</p>
            <Button type="button" onClick={() => setArrivalOpen(true)} disabled={!booking.data} data-testid="checkin-wizard-register-arrival">
              {t('checkin.wizard.done.registerArrival')}
            </Button>
            <CheckInDialog booking={booking.data ?? null} open={arrivalOpen} onOpenChange={setArrivalOpen} />
          </div>
        )}
      </div>
    </WizardDone>
  );
}
