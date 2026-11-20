import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
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

/** What a day that could not be read is told as: not found, no permission, not in Ticino, or a failure to try again. A 404 is «not found» whatever the cache still holds. */
function TicinoLayerProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const status = getHttpStatus(error);
  const text = status === 404 ? 'swiss.layer.notFound' : status === 403 ? 'swiss.layer.forbidden' : status === 422 ? 'swiss.layer.notInTicino' : null;

  if (text) {
    return (
      <p role="alert" className="text-sm text-foreground/70" data-testid="ticino-layer-problem">
        {t(text)}
      </p>
    );
  }
  return <ErrorState title={t('swiss.layer.loadFailed')} error={error} onRetry={onRetry} testId="ticino-layer-error" />;
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

  // An error comes first: a read that failed still holds the answer before it, and a 404 or a 403 must not show the day of a moment ago.
  if (query.isError) return <TicinoLayerProblem error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <SkeletonLine lines={5} label={t('swiss.layer.loading')} />;

  const day = query.data;
  // The day the server picked is the day on screen from the first action on: the answer is kept under the key of that day, so declaring it does not move the layer
  // on to the next one (a read without a date always answers the oldest day still to notify) and nothing is asked twice.
  const pin = () => {
    if (pickedDay !== undefined) return;
    queryClient.setQueryData(ticinoDayKey(propertyId, day.day), day);
    setPickedDay(day.day);
  };

  return <TicinoDayView key={day.day} day={day} asOf={query.dataUpdatedAt} onPin={pin} onPickDay={setPickedDay} close={close} />;
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
