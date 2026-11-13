import { isAlloggiatiSent } from '@/features/alloggiati/alloggiati-status.utils';
import type { MirrorLine, MirrorLineKind } from '@/features/bookings/lib/new-booking-result';
import type { BookingOctorateSync } from '@/types';
import type { CheckoutResultLine, CheckoutResultTone, CheckoutWizardCompleteResult, CheckoutWizardState } from '@/types/compliance.types';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The mirror of the booking on the channel manager as the check-out has to read it. A sync that says `Synced` may be the confirmation of an earlier
 * operation (the creation of the booking, a change of its dates): it is the check-out's only when the channel manager confirmed it after the stay was
 * closed. Before that the check-out is still on its way, and the result says so instead of a success the channel manager has not confirmed. Without a
 * moment to compare with (a stay closed before the time was kept) the sync is taken as it is.
 */
export function syncAfterCheckout(
  sync: BookingOctorateSync | null | undefined,
  closedAt: string | null | undefined,
): BookingOctorateSync | null | undefined {
  if (!sync || sync.state !== 'Synced') return sync;
  const closed = closedAt ? Date.parse(closedAt) : Number.NaN;
  if (Number.isNaN(closed)) return sync;
  const confirmed = sync.lastSyncedAt ? Date.parse(sync.lastSyncedAt) : Number.NaN;
  return Number.isNaN(confirmed) || confirmed < closed ? { ...sync, state: 'Pending' } : sync;
}

/** How each state of the channel manager stands on the result: only `synced` is done, `pending` and `waiting` are not completed yet, the rest failed. */
const MIRROR_TONE: Record<MirrorLineKind, CheckoutResultTone> = {
  pending: 'attention',
  synced: 'done',
  failed: 'problem',
  conflict: 'problem',
  datesTaken: 'problem',
  blocked: 'problem',
  waiting: 'attention',
  unreadable: 'attention',
  notFound: 'problem',
};

/** What each state of the channel manager says about the check-out. A refusal for taken nights is a creation's, so for the check-out it reads as a conflict. */
const MIRROR_TEXT_KEYS: Record<MirrorLineKind, string> = {
  pending: 'compliance.checkout.done.channelManager.pending',
  synced: 'compliance.checkout.done.channelManager.synced',
  failed: 'compliance.checkout.done.channelManager.failed',
  conflict: 'compliance.checkout.done.channelManager.conflict',
  datesTaken: 'compliance.checkout.done.channelManager.conflict',
  blocked: 'compliance.checkout.done.channelManager.blocked',
  waiting: 'compliance.checkout.done.channelManager.waiting',
  unreadable: 'compliance.checkout.done.channelManager.unreadable',
  notFound: 'compliance.checkout.done.channelManager.notFound',
};

/** Every key the line of the channel manager can use (for the test that each one is translated). */
export const CHANNEL_MANAGER_TEXT_KEYS: readonly string[] = [...new Set(Object.values(MIRROR_TEXT_KEYS))];

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
 * assumed. A line that is not completed (the communication still to send, the cleaning not asked, the property not ready, the channel manager that has not
 * answered or refused) is said as such, never as done. The channel manager has a line only when the booking is mirrored there (`mirror` is not `null`).
 */
export function checkoutResultLines(result: CheckoutWizardCompleteResult, mirror: MirrorLine | null, t: Translate): CheckoutResultLine[] {
  const { wizard } = result;
  const lines: CheckoutResultLine[] = [{ element: 'departure', tone: 'done', text: t('compliance.checkout.done.stayClosed') }];

  if (mirror) {
    lines.push({ element: 'channelManager', tone: MIRROR_TONE[mirror.kind], text: t(MIRROR_TEXT_KEYS[mirror.kind]) });
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
export type CheckoutNextStep = 'retryChannelManager' | 'checkChannelManager' | 'sendAlloggiati' | 'markReady' | 'nothing';

/** The words of each next step, written out so that a missing translation is found by a test. */
export const NEXT_STEP_KEYS: Readonly<Record<CheckoutNextStep, string>> = {
  retryChannelManager: 'compliance.checkout.done.next.retryChannelManager',
  checkChannelManager: 'compliance.checkout.done.next.checkChannelManager',
  sendAlloggiati: 'compliance.checkout.done.next.sendAlloggiati',
  markReady: 'compliance.checkout.done.next.markReady',
  nothing: 'compliance.checkout.done.next.nothing',
};

/**
 * The most urgent thing first: a channel manager that did not take the check-out (the dates may stay closed elsewhere), then the communication to the
 * police (it has a deadline), then the property that is not declared ready. A check-out still on its way is not urgent: the line says so.
 */
export function checkoutNextStepOf(input: { mirror: MirrorLine | null; alloggiatiSent: boolean; propertyReady: boolean }): CheckoutNextStep {
  const { mirror } = input;
  if (mirror) {
    if (mirror.kind === 'failed' || mirror.kind === 'conflict') return mirror.canRetry ? 'retryChannelManager' : 'checkChannelManager';
    if (mirror.kind === 'datesTaken' || mirror.kind === 'blocked' || mirror.kind === 'waiting' || mirror.kind === 'unreadable' || mirror.kind === 'notFound') {
      return 'checkChannelManager';
    }
  }
  if (!input.alloggiatiSent) return 'sendAlloggiati';
  if (!input.propertyReady) return 'markReady';
  return 'nothing';
}
