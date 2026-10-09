import { useTranslation } from 'react-i18next';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import type { CheckoutWizardCompleteResult } from '@/types/compliance.types';

/**
 * "What happens now" after the check-out (CO-17): the stay is closed, and what is still up to the host. Every point comes
 * from what the server answered to the completion, never from an assumption: the property ready or not, the cleaning
 * request that was created with the check-out, the Alloggiati communication that is still to send. Two ways on: back to
 * the booking, or to the compliance summary where what is left is listed.
 */
export function CheckoutDone({
  bookingId,
  guestName,
  result,
}: {
  bookingId: string;
  guestName: string;
  result: CheckoutWizardCompleteResult;
}) {
  const { t } = useTranslation();

  const whatNext = [
    { text: t('compliance.checkout.done.stayClosed') },
    { text: t(result.propertyReady ? 'compliance.checkout.done.propertyReady' : 'compliance.checkout.done.propertyNotReady') },
  ];
  // A third point only when there is something to say: the cleaning that was asked for, or the communication to send.
  if (result.serviceRequestId) {
    whatNext.push({ text: t('compliance.checkout.done.cleaningRequested') });
  } else if (!result.wizard.alloggiati.sent) {
    whatNext.push({ text: t('compliance.checkout.done.alloggiatiToSend') });
  }

  return (
    <WizardDone
      title={t('compliance.checkout.done.title')}
      description={t('compliance.checkout.done.description', { guest: guestName })}
      whatNext={whatNext}
      primary={{ label: t('compliance.checkout.backToBooking'), to: `/app/short-rent/bookings/${bookingId}` }}
      secondary={{ label: t('compliance.checkout.done.compliance'), to: '/app/short-rent/compliance' }}
    />
  );
}
