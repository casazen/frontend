import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { ticinoDayKey, useTicinoDay } from '@/queries/swissCompliance';
import { useProperty } from '@/queries/use-properties';
import { TicinoDayView } from './ticino-day-view';
import { parseTicinoLayerId } from './ticino-layer-address';

/** The name of the layer: the property it is about, so that a host with two properties in Ticino knows which one is on screen. Until the property arrives, the plain name. */
export function TicinoLayerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const property = useProperty(parseTicinoLayerId(id)?.propertyId ?? '');
  const name = property.data?.name?.trim();
  return <>{name ? t('swiss.layer.titleFor', { property: name }) : t('swiss.layer.title')}</>;
}

/** What a read that was refused says, in words: not found (404), no permission (403), not in Ticino (422). Any other failure (the line, a 5xx) has no words of its own: `null`. */
function refusalTextOf(error: unknown): string | null {
  const status = getHttpStatus(error);
  return status === 404 ? 'swiss.layer.notFound' : status === 403 ? 'swiss.layer.forbidden' : status === 422 ? 'swiss.layer.notInTicino' : null;
}

/** What a day that could not be read is told as: not found, no permission, not in Ticino, or a failure to try again. A 404 is «not found» whatever the cache still holds. */
function TicinoLayerProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const text = refusalTextOf(error);

  if (text) {
    return (
      <p role="alert" className="text-sm text-foreground/70" data-testid="ticino-layer-problem">
        {t(text)}
      </p>
    );
  }
  return <ErrorState title={t('swiss.layer.loadFailed')} error={error} onRetry={onRetry} testId="ticino-layer-error" />;
}

/**
 * The day is on screen and the read that was meant to refresh it failed for a reason that says nothing about the day (the line, a 5xx): the day stays as it was last read, with this
 * line and a way to read it again. What the person is in the middle of (the guests being completed, the file chosen, the step that is open) goes nowhere.
 */
function TicinoLayerStale({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert
      variant="warning"
      className="mb-4"
      data-testid="ticino-layer-stale"
      action={
        <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry} data-testid="ticino-layer-stale-retry">
          {t('shared.errorState.retry')}
        </Button>
      }
    >
      {t('swiss.layer.refreshFailed')}
    </Alert>
  );
}

interface TicinoLayerProps {
  propertyId: string;
  /** The arrival day of the address; without one the server picks the first day still to notify. */
  requestedDay: string | undefined;
  close: () => void;
}

function TicinoLayer({ propertyId, requestedDay, close }: TicinoLayerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pickedDay, setPickedDay] = useState(requestedDay);
  const query = useTicinoDay(propertyId, pickedDay);

  // A refusal comes first: a read that failed still holds the answer before it, and a 404, a 403 or a 422 must not show the day of a moment ago. So does a failure when there is no
  // day to show. A read that fails for another reason (the line, a 5xx) while the day is on screen is not an answer about the day: it stays, with a line to read it again.
  const day = query.data;
  if (query.isError && (!day || refusalTextOf(query.error) !== null)) return <TicinoLayerProblem error={query.error} onRetry={() => void query.refetch()} />;
  if (!day) return <SkeletonLine lines={5} label={t('swiss.layer.loading')} />;

  // The day the server picked is the day on screen from the first action on: the answer is kept under the key of that day, so declaring it does not move the layer
  // on to the next one (a read without a date always answers the oldest day still to notify) and nothing is asked twice.
  const pin = () => {
    if (pickedDay !== undefined) return;
    queryClient.setQueryData(ticinoDayKey(propertyId, day.day), day);
    setPickedDay(day.day);
  };

  return (
    <>
      {query.isError ? <TicinoLayerStale retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}
      <TicinoDayView key={day.day} day={day} asOf={query.dataUpdatedAt} onPin={pin} onPickDay={setPickedDay} close={close} />
    </>
  );
}

/**
 * The layer of the Ticino police notification (E30/F02/US03/T02, casazen/backend#979): a kind of the detail drawer (`?detail=ticino:<property>[:<day>]`), opened over the
 * cockpit by its row, by the bell and by the property page, and by the old address of the page, which leads here. It replaces the page of the notification: the same steps,
 * in a layer the host never has to leave.
 */
export function TicinoLayerContent({ id, close }: DetailContentProps) {
  const { t } = useTranslation();
  const address = parseTicinoLayerId(id);
  if (!address) {
    return (
      <p role="alert" className="text-sm text-foreground/70" data-testid="ticino-layer-problem">
        {t('swiss.layer.notFound')}
      </p>
    );
  }
  return <TicinoLayer key={id} propertyId={address.propertyId} requestedDay={address.day} close={close} />;
}
