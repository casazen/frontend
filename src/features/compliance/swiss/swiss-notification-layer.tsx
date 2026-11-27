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

function refusalTextOf(error: unknown): string | null {
  const status = getHttpStatus(error);
  return status === 404 ? 'swissNotification.layer.notFound' : status === 403 ? 'swissNotification.layer.forbidden' : status === 422 ? 'swissNotification.layer.notApplicable' : null;
}

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
  requestedDay: string | undefined;
  close: () => void;
}

function SwissLayer({ propertyId, requestedDay, close }: SwissLayerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pickedDay, setPickedDay] = useState(requestedDay);
  const query = useSwissDay(propertyId, pickedDay);

  useEffect(
    () => () => {
      void queryClient.removeQueries({ queryKey: [SWISS_NOTIFICATION_KEY, propertyId] });
    },
    [queryClient, propertyId],
  );

  const day = query.data;
  if (query.isError && (!day || refusalTextOf(query.error) !== null)) return <SwissLayerProblem error={query.error} onRetry={() => void query.refetch()} />;
  if (!day) return <SkeletonLine lines={5} label={t('swissNotification.layer.loading')} />;

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
