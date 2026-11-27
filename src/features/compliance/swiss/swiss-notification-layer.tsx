import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { SWISS_NOTIFICATION_KEY, swissDayKey, useSwissDay } from '@/queries/swissCompliance';
import { useProperty } from '@/queries/use-properties';
import { parseSwissLayerId } from './swiss-layer-address';
import { SwissDayView } from './swiss-day-view';
import { LayerNotice } from '@/features/compliance/components/layer-notice';

/** The name of the layer: the property it is about, so that a host with two properties knows which one is on screen. Until the property arrives, the plain name. */
export function SwissLayerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const property = useProperty(parseSwissLayerId(id)?.propertyId ?? '');
  const name = property.data?.name?.trim();
  return <>{name ? t('swissNotification.layer.titleFor', { property: name }) : t('swissNotification.layer.title')}</>;
}

/** What a read that was refused says, in words: not found (404), no permission (403), not a property the notification covers (422). Any other failure (the line, a 5xx) has no words of its own: `null`. */
function refusalTextOf(error: unknown): string | null {
  const status = getHttpStatus(error);
  return status === 404 ? 'swissNotification.layer.notFound' : status === 403 ? 'swissNotification.layer.forbidden' : status === 422 ? 'swissNotification.layer.notApplicable' : null;
}

/** What a day that could not be read is told as: not found, no permission, not covered, or a failure to try again. A 404 is «not found» whatever the cache still holds. */
function SwissLayerProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const text = refusalTextOf(error);

  if (text) {
    return (
      <p role="alert" className="text-sm text-foreground/70" data-testid="swiss-layer-problem">
        {t(text)}
      </p>
    );
  }
  return <ErrorState title={t('swissNotification.layer.loadFailed')} error={error} onRetry={onRetry} testId="swiss-layer-error" />;
}

/**
 * The day is on screen and the read that was meant to refresh it failed for a reason that says nothing about the day (the line, a 5xx): the day stays as it was last read, with this
 * line and a way to read it again. What the person is in the middle of (the step that is open, the guest being completed) goes nowhere.
 */
function SwissLayerStale({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert
      variant="warning"
      className="mb-4"
      data-testid="swiss-layer-stale"
      action={
        <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry} data-testid="swiss-layer-stale-retry">
          {t('shared.errorState.retry')}
        </Button>
      }
    >
      {t('swissNotification.layer.refreshFailed')}
    </Alert>
  );
}

interface SwissLayerProps {
  propertyId: string;
  /** The arrival day of the address; without one the server picks the first day still to notify. */
  requestedDay: string | undefined;
  close: () => void;
}

function SwissLayer({ propertyId, requestedDay, close }: SwissLayerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pickedDay, setPickedDay] = useState(requestedDay);
  const query = useSwissDay(propertyId, pickedDay);

  // The days hold the guests with their documents and addresses: they are not kept once the layer is gone (the next opening reads them again).
  useEffect(
    () => () => {
      void queryClient.removeQueries({ queryKey: [SWISS_NOTIFICATION_KEY, propertyId] });
    },
    [queryClient, propertyId],
  );

  // A refusal comes first: a read that failed still holds the answer before it, and a 404, a 403 or a 422 must not show the day of a moment ago. So does a failure when there is no
  // day to show. A read that fails for another reason (the line, a 5xx) while the day is on screen is not an answer about the day: it stays, with a line to read it again.
  const day = query.data;
  if (query.isError && (!day || refusalTextOf(query.error) !== null)) return <SwissLayerProblem error={query.error} onRetry={() => void query.refetch()} />;
  if (!day) return <SkeletonLine lines={5} label={t('swissNotification.layer.loading')} />;

  // The day the server picked is the day on screen from the first action on: the answer is kept under the key of that day, so declaring it does not move the layer on to the next one
  // (a read without a date always answers the oldest day still to notify) and nothing is asked twice.
  const pin = () => {
    if (pickedDay !== undefined) return;
    queryClient.setQueryData(swissDayKey(propertyId, day.day), day);
    setPickedDay(day.day);
  };

  return (
    <>
      {query.isError ? <SwissLayerStale retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}
      <SwissDayView key={day.day} day={day} asOf={query.dataUpdatedAt} onPin={pin} onPickDay={setPickedDay} close={close} />
    </>
  );
}

/**
 * The layer of the assisted notification of the guests (E31/F02/US02/T02, NF-131, casazen/backend#979): a kind of the detail drawer (`?detail=swiss-notification:<property>[:<day>]`),
 * opened over the cockpit by its row and by the bell, and over the page of the property by the card of the regime. It is hidden while `Features:GuestRegistrationRegimes` is off (the
 * module is off: nothing is asked of the server) and for who may not read the guests (the layer asks what the day asks, `guest.read` and `booking.read`: nothing is asked for them either).
 */
export function SwissLayerContent({ id, close }: DetailContentProps) {
  const { flags, isLoading } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  const address = parseSwissLayerId(id);

  if (!address) return <LayerNotice textKey="swissNotification.layer.notFound" testId="swiss-layer-problem" />;
  if (isLoading) return <SkeletonLine lines={3} />;
  if (!flags.guestRegistrationRegimes) return <LayerNotice textKey="swissNotification.layer.unavailable" testId="swiss-layer-unavailable" />;
  if (!hasPermission('short-rent', 'guest.read') || !hasPermission('short-rent', 'booking.read')) {
    return <LayerNotice textKey="swissNotification.layer.forbidden" testId="swiss-layer-problem" />;
  }
  return <SwissLayer key={id} propertyId={address.propertyId} requestedDay={address.day} close={close} />;
}
