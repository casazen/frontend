import { isAlloggiatiSent } from '@/features/alloggiati/alloggiati-status.utils';
import type { BookingOctorateSync } from '@/types';
import type { CheckoutResultLine, CheckoutWizardCompleteResult, CheckoutWizardState } from '@/types/compliance.types';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Whether the result tells about the channel manager. When a stay is closed the server passes the departure to it by itself (a job queued after the check-out,
 * for a booking that has a reservation there), and it keeps no outcome of that job that a screen could read: the mirror of the booking (`octorateSync`) follows
 * the creation, the changes, the cancellation and the payments, never the check-out. So the result takes no state from the channel manager and shows none:
 * it has one line, the same whatever the mirror says, and only for a booking that is on the channel manager for sure (`Synced`: the channel manager confirmed an
 * operation on its reservation). Any other state (being created, refused, failed) may mean that there is no reservation, and nothing is said then.
 */
export function channelManagerLinked(sync: BookingOctorateSync | null | undefined): boolean {
  return sync?.state === 'Synced';
}

/** The words of the one line about the channel manager (written out so that a test finds a missing translation). */
export const CHANNEL_MANAGER_LINE_KEY = 'compliance.checkout.done.channelManager.automatic';

/**
 * The Alloggiati communication as the step tells it: the one the server holds now (`live`, read again after the guests were completed) over the wizard's own.
 * An answer that is not a status (nothing read yet, a failed read, a shape this version does not know) leaves the wizard's own.
 */
export function alloggiatiNow(wizard: CheckoutWizardState['alloggiati'], live: AlloggiatiStatusDto | undefined): CheckoutWizardState['alloggiati'] {
  if (!live || typeof live.status !== 'string') return wizard;
  return {
    status: live.status,
    sent: isAlloggiatiSent(live.status),
    deadlineAt: live.deadlineAt,
    isOverdue: live.isOverdue,
    dataComplete: live.dataComplete,
  };
}

/**
 * The lines of "What happens now" (NF-45, NF-05): one for each element with its own state, from what the server answered to the completion and nothing
 * assumed. A line that is not completed (the communication still to send, the cleaning not asked, the property not ready) is said as such, never as done.
 * The channel manager has a line only when `channelManager` says the booking is on it (`channelManagerLinked`): the line is neutral, it says that the
 * departure is passed on by itself and that its outcome is not shown here, and it never wears the tone of a thing that is done.
 */
export function checkoutResultLines(result: CheckoutWizardCompleteResult, channelManager: boolean, t: Translate): CheckoutResultLine[] {
  const { wizard } = result;
  const lines: CheckoutResultLine[] = [{ element: 'departure', tone: 'done', text: t('compliance.checkout.done.stayClosed') }];

  if (channelManager) {
    lines.push({ element: 'channelManager', tone: 'attention', text: t(CHANNEL_MANAGER_LINE_KEY) });
  }

  const alloggiatiFailed = wizard.alloggiati.status === 'Errore' || wizard.alloggiati.status === 'Rifiutato';
  lines.push(
    wizard.alloggiati.sent
      ? { element: 'alloggiati', tone: 'done', text: t('compliance.checkout.done.alloggiatiSent') }
      : { element: 'alloggiati', tone: alloggiatiFailed ? 'problem' : 'attention', text: t('compliance.checkout.done.alloggiatiToSend') },
  );

  // A cleaning the host asked for and that has no request is not a cleaning that was skipped: it is said as not sent.
  if (result.serviceRequestId) {
    lines.push({ element: 'cleaning', tone: 'done', text: t('compliance.checkout.done.cleaningRequested') });
  } else if (wizard.cleaning.choice === 'Request') {
    lines.push({ element: 'cleaning', tone: 'attention', text: t('compliance.checkout.done.cleaningNotSent') });
  } else {
    lines.push({ element: 'cleaning', tone: 'done', text: t('compliance.checkout.done.cleaningSkipped') });
  }

  const collection = wizard.touristTax.collection;
  if (!collection) {
    lines.push({ element: 'touristTax', tone: 'attention', text: t('compliance.checkout.closed.touristTaxNotDeclared') });
  } else if (collection === 'NotCollected') {
    lines.push({ element: 'touristTax', tone: 'attention', text: t('compliance.checkout.done.touristTaxNotCollected') });
  } else {
    lines.push({
      element: 'touristTax',
      tone: 'done',
      text: t('compliance.checkout.done.touristTax', { collection: t(`compliance.checkout.touristTax.collection.${collection}`) }),
    });
  }

  lines.push(
    result.propertyReady
      ? { element: 'propertyReady', tone: 'done', text: t('compliance.checkout.done.propertyReady') }
      : { element: 'propertyReady', tone: 'attention', text: t('compliance.checkout.done.propertyNotReady') },
  );

  return lines;
}

/** The one step the result suggests. */
export type CheckoutNextStep = 'sendAlloggiati' | 'markReady' | 'nothing';

/** The words of each next step, written out so that a missing translation is found by a test. */
export const NEXT_STEP_KEYS: Readonly<Record<CheckoutNextStep, string>> = {
  sendAlloggiati: 'compliance.checkout.done.next.sendAlloggiati',
  markReady: 'compliance.checkout.done.next.markReady',
  nothing: 'compliance.checkout.done.next.nothing',
};

/**
 * The most urgent thing first: the communication to the police (it has a deadline), then the property that is not declared ready. The channel manager is never
 * the next step: the result has no state of it to act on.
 */
export function checkoutNextStepOf(input: { alloggiatiSent: boolean; propertyReady: boolean }): CheckoutNextStep {
  if (!input.alloggiatiSent) return 'sendAlloggiati';
  if (!input.propertyReady) return 'markReady';
  return 'nothing';
}
