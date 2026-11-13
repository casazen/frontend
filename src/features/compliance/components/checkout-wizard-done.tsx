import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, RotateCw, type LucideIcon } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { guestDataCompletionPath } from '@/features/bookings/lib/stay-actions';
import { MIRROR_WATCH_MS, RETRY_GRACE_MS, mirrorLineOf, mirrorReadOf, shouldWatchMirror } from '@/features/bookings/lib/new-booking-result';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useNow } from '@/hooks/use-now';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useBookingMirror, useRetryOctorateSync } from '@/queries/use-bookings';
import type { CheckoutResultTone, CheckoutWizardCompleteResult } from '@/types/compliance.types';
import { NEXT_STEP_KEYS, checkoutNextStepOf, checkoutResultLines, syncAfterCheckout } from '../lib/checkout-result';

/** The icon of a point that is not done: the check mark is for what is done (the default of the screen). */
const TONE_ICON: Record<Exclude<CheckoutResultTone, 'done'>, LucideIcon> = {
  attention: Clock,
  problem: AlertTriangle,
};

/**
 * "What happens now" after the check-out (CO-17, NF-45, NF-05): one line for each element with its own state, and one suggested next step. Every line
 * comes from what the server answered to the completion, never from an assumption: the departure, the check-out on the channel manager (only for a
 * booking that is mirrored there: it is sent after the stay is closed, so the line goes from "being sent" to its outcome by itself, with "Retry now" when
 * it failed), the Alloggiati communication, the cleaning, the tourist tax and the property. A line that is not completed is said as such, never as done.
 * It is the end of the flow, so it may link out: back to the booking, to the compliance summary and, when the communication is still to send, to its tab.
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
  // With the connector of the channel manager off nothing is pushed or asked: nothing is read and nothing is said about it.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const closedAt = result.wizard.completedAt;

  const now = useNow(5_000);
  const [watch, setWatch] = useState(() => ({ since: Date.now(), retried: false }));
  const watchOver = now - watch.since >= MIRROR_WATCH_MS;
  // After "Retry now" the sync keeps its old state until the push really starts: for a moment the line says it is on its way.
  const retrying = watch.retried && now - watch.since < RETRY_GRACE_MS;
  const detail = useBookingMirror(bookingId, {
    enabled: connectorOn,
    keepWatching: (latest) => shouldWatchMirror({ sync: syncAfterCheckout(latest?.octorateSync, closedAt), expected: false, watchOver, retrying }),
  });
  const read = mirrorReadOf({
    enabled: connectorOn,
    isError: detail.isError,
    notFound: getHttpStatus(detail.error) === 404,
    hasData: detail.data !== undefined,
  });
  // `expected: false`: the booking has a line only when its own mirror says it is on the channel manager (a booking that is not has none).
  const mirror = mirrorLineOf({ expected: false, sync: syncAfterCheckout(detail.data?.octorateSync, closedAt), read, watchOver, retrying });

  const retry = useRetryOctorateSync();
  const askAgain = () => retry.mutate({ id: bookingId }, { onSuccess: () => setWatch({ since: Date.now(), retried: true }) });
  const checkAgain = () => {
    setWatch({ since: Date.now(), retried: false });
    void detail.refetch();
  };

  const lines = checkoutResultLines(result, mirror, t);
  const next = checkoutNextStepOf({ mirror, alloggiatiSent: result.wizard.alloggiati.sent, propertyReady: result.propertyReady });
  const needsNotice =
    mirror !== null &&
    (mirror.kind === 'failed' ||
      mirror.kind === 'conflict' ||
      mirror.kind === 'datesTaken' ||
      mirror.kind === 'blocked' ||
      mirror.kind === 'waiting' ||
      mirror.kind === 'unreadable');
  const noAnswer = mirror?.kind === 'waiting' || mirror?.kind === 'unreadable';
  const reason = mirror?.reasonKey ? t(mirror.reasonKey) : noAnswer ? t('compliance.checkout.done.channelManager.waitingText') : null;

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
        {needsNotice && (
          <Alert
            variant={noAnswer ? 'warning' : 'danger'}
            title={t('compliance.checkout.done.channelManager.title')}
            data-testid="checkout-done-channel-manager"
            action={
              noAnswer ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  loading={detail.isFetching}
                  onClick={checkAgain}
                  data-testid="checkout-done-channel-manager-refresh"
                >
                  {t('compliance.checkout.done.channelManager.checkAgain')}
                </Button>
              ) : mirror?.canRetry ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={retry.isPending}
                  loading={retry.isPending}
                  onClick={askAgain}
                  data-testid="checkout-done-channel-manager-retry"
                >
                  <RotateCw aria-hidden="true" className="size-4" />
                  {t('compliance.checkout.done.channelManager.retry')}
                </Button>
              ) : undefined
            }
          >
            {reason ? <p data-testid="checkout-done-channel-manager-reason">{reason}</p> : null}
            {/* The refusal of the last "Retry now", while there is still something to retry: once the state has moved on it is no longer the news. */}
            {retry.isError && !noAnswer ? (
              <p role="alert" className="text-destructive" data-testid="checkout-done-channel-manager-error">
                {getProblemMessage(retry.error, t) ?? t('compliance.checkout.done.channelManager.retryFailed')}
              </p>
            ) : null}
          </Alert>
        )}

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
