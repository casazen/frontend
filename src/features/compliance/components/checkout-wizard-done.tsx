import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, type LucideIcon } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { guestDataCompletionPath } from '@/features/bookings/lib/stay-actions';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { CheckoutResultTone, CheckoutWizardCompleteResult } from '@/types/compliance.types';
import { NEXT_STEP_KEYS, checkoutNextStepOf, checkoutResultLines } from '../lib/checkout-result';

/** The icon of a point that is not done: the check mark is for what is done (the default of the screen). */
const TONE_ICON: Record<Exclude<CheckoutResultTone, 'done'>, LucideIcon> = {
  attention: Clock,
  problem: AlertTriangle,
};

/**
 * "What happens now" after the check-out (CO-17, NF-45, NF-05): one line for each element with its own state, and one suggested next step. Every line
 * comes from what the server answered to the completion, never from an assumption: the departure, the Alloggiati communication, the cleaning, the tourist
 * tax and the property. A line that is not completed is said as such, never as done. It is the end of the flow, so it may link out: back to the booking, to
 * the compliance summary and, when the communication is still to send, to its tab.
 *
 * The channel manager has one neutral line, for a booking that is on it (`channelManager`) and only with the connector on: the server passes the departure to
 * it by itself, and nothing that a screen can read says how that went, so the result reads no state of the channel manager, polls nothing, offers no retry and
 * never sends the host there as the next step.
 */
export function CheckoutDone({
  bookingId,
  guestName,
  result,
  channelManager,
}: {
  bookingId: string;
  guestName: string;
  result: CheckoutWizardCompleteResult;
  /** The booking is on the channel manager for sure (`channelManagerLinked` of its mirror). */
  channelManager: boolean;
}) {
  const { t } = useTranslation();
  // With the connector of the channel manager off nothing is passed on to it: nothing is said about it.
  const connectorOn = useFeatureFlags().flags.octorateConnector;

  const lines = checkoutResultLines(result, connectorOn && channelManager, t);
  const next = checkoutNextStepOf({ alloggiatiSent: result.wizard.alloggiati.sent, propertyReady: result.propertyReady });

  return (
    <WizardDone
      title={t('compliance.checkout.done.title')}
      description={t('compliance.checkout.done.description', { guest: guestName })}
      whatNext={lines.map((line) =>
        line.tone === 'done' ? { text: line.text } : { text: line.text, icon: TONE_ICON[line.tone], tone: line.tone },
      )}
      primary={{ label: t('compliance.checkout.backToBooking'), to: `/app/short-rent/bookings/${bookingId}` }}
      secondary={{ label: t('compliance.checkout.done.compliance'), to: '/app/short-rent/compliance' }}
    >
      <div className="space-y-4" data-testid="checkout-done-details">
        <div className="rounded-lg border p-4" data-testid="checkout-done-next">
          <p className="text-sm font-medium">{t('compliance.checkout.done.next.title')}</p>
          <p className="mt-1 text-sm">{t(NEXT_STEP_KEYS[next])}</p>
          {next === 'sendAlloggiati' && (
            <Link
              to={guestDataCompletionPath(bookingId)}
              className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              data-testid="checkout-done-alloggiati-link"
            >
              {t('compliance.checkout.done.next.alloggiatiLink')}
            </Link>
          )}
        </div>
      </div>
    </WizardDone>
  );
}
