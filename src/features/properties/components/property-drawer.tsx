import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarDays, CircleCheck, Pause, Power, Wrench } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import {
  registerDetail,
  type DetailContentProps,
  type DetailTitleProps,
} from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { StatusExplainer } from '@/components/shared/status/status-explainer';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { displayableMediaUrls } from '@/lib/media-url';
import { propertyStatus } from '@/lib/status-dictionary';
import { formatCurrency } from '@/lib/utils';
import { useActivateProperty, usePauseProperty, useProperties } from '@/queries/use-properties';
import type { Property } from '@/types';
import { formatPropertyLocation } from '../property-location';
import {
  PROPERTY_DRAWER_KIND,
  propertyActivationPath,
  propertyBookingsPath,
  propertyCalendarPath,
  propertyPath,
  propertyServiceRequestPath,
} from '../properties-paths';

/**
 * The property of the drawer, read from the list of the properties of Affitti brevi: it is the same query as the page of the
 * list, so there is no second request, and a property paused or reactivated from the drawer changes in both.
 */
function usePropertyOfTheList(id: string) {
  const query = useProperties({ mode: 'short' });
  return {
    property: query.data?.find((candidate) => candidate.id === id),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function PropertyDrawerTitle({ id }: DetailTitleProps) {
  const { property } = usePropertyOfTheList(id);
  return <>{property?.name ?? ''}</>;
}

function Photos({ property }: { property: Property }) {
  const { t } = useTranslation();
  const urls = displayableMediaUrls(property.photoUrls).slice(0, 3);
  if (urls.length === 0) return null;

  return (
    <div className={urls.length === 1 ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-3 gap-2'}>
      {urls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={t('property.photos.alt', { name: property.name, index: index + 1 })}
          loading="lazy"
          className={urls.length === 1 ? 'aspect-video w-full rounded-md object-cover' : 'aspect-[4/3] w-full rounded-md object-cover'}
        />
      ))}
    </div>
  );
}

function KeyData({ property }: { property: Property }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('property.drawer.keyData')}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/70">{t('property.drawer.address')}</dt>
        <dd className="break-words">{formatPropertyLocation(property)}</dd>
        <dt className="text-foreground/70">{t('property.drawer.spaces')}</dt>
        <dd className="break-words">
          {[
            t('property.table.bedroomsCount', { count: property.bedrooms }),
            t('property.table.bathroomsCount', { count: property.bathrooms }),
            t('property.list.guestsCount', { count: property.maxGuests }),
          ].join(' · ')}
        </dd>
        <dt className="text-foreground/70">{t('property.drawer.price')}</dt>
        <dd className="break-words">
          {property.nightlyRate > 0 ? (
            <>
              <strong>{formatCurrency(property.nightlyRate)}</strong> {t('property.list.perNight')}
            </>
          ) : (
            t('property.table.noRate')
          )}
        </dd>
        <dt className="text-foreground/70">{t('property.drawer.cin')}</dt>
        <dd className="break-words">
          {property.cinCode ? (
            <code>{property.cinCode}</code>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-danger-foreground">
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
              {t('property.drawer.cinMissing')}
            </span>
          )}
        </dd>
      </dl>
    </PlainSection>
  );
}

export function PropertyDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const { property, isLoading, isError, error, refetch } = usePropertyOfTheList(id);
  const pause = usePauseProperty();
  const activate = useActivateProperty();
  // Read without `useWorkspace`, which refuses to run outside its provider: a drawer drawn on its own offers no action.
  const workspace = useContext(WorkspaceContext);
  const canWrite = workspace?.hasPermission('short-rent', 'property.write') ?? false;
  const canReadBookings = workspace?.hasPermission('short-rent', 'booking.read') ?? false;

  if (isLoading) return <SkeletonLine lines={4} />;

  if (isError && !property) {
    return <ErrorState title={t('property.detail.loadError')} error={error} onRetry={() => void refetch()} />;
  }

  if (!property) {
    return (
      <div role="status" className="space-y-1 py-4" data-testid="property-drawer-not-found">
        <p className="font-semibold">{t('property.detail.notFound')}</p>
        <p className="text-sm text-foreground/70">{t('property.detail.notFoundDescription')}</p>
      </div>
    );
  }

  const status = propertyStatus(property);

  // The one thing to do now, by state: complete an activation, put the property back on, or go and see its bookings.
  const mainAction =
    (status === 'Pending' || status === 'Suspended') && canWrite ? (
      <Button asChild>
        <Link to={propertyActivationPath(property.id)}>
          <CircleCheck aria-hidden="true" className="size-4" />
          {t('property.drawer.complete')}
        </Link>
      </Button>
    ) : status === 'Paused' && canWrite ? (
      <Button type="button" onClick={() => activate.mutate(property.id)} loading={activate.isPending}>
        <Power aria-hidden="true" className="size-4" />
        {t('property.list.actions.reactivate')}
      </Button>
    ) : status === 'Active' && canReadBookings ? (
      <Button asChild>
        <Link to={propertyCalendarPath(property.id)}>
          <CalendarDays aria-hidden="true" className="size-4" />
          {t('property.list.actions.calendar')}
        </Link>
      </Button>
    ) : null;

  return (
    <div className="space-y-6 pb-2" data-testid="property-drawer">
      <Photos property={property} />

      <StatusExplainer kind="property" status={status} actions={mainAction} />

      <KeyData property={property} />

      {canReadBookings || (canWrite && status === 'Active') ? (
        <PlainSection title={t('property.drawer.moreActions')}>
          <div className="flex flex-wrap gap-2">
            {canReadBookings ? (
              <Button asChild variant="outline" size="sm">
                <Link to={propertyBookingsPath(property.id)}>{t('property.drawer.bookings')}</Link>
              </Button>
            ) : null}
            {canReadBookings ? (
              <Button asChild variant="outline" size="sm">
                <Link to={propertyServiceRequestPath(property.id)}>
                  <Wrench aria-hidden="true" className="size-4" />
                  {t('property.list.actions.requestService')}
                </Link>
              </Button>
            ) : null}
            {canWrite && status === 'Active' ? (
              <Button type="button" variant="outline" size="sm" onClick={() => pause.mutate(property.id)} loading={pause.isPending}>
                <Pause aria-hidden="true" className="size-4" />
                {t('property.list.actions.pause')}
              </Button>
            ) : null}
          </div>
        </PlainSection>
      ) : null}
    </div>
  );
}

// Registered when this module is loaded, which the list of the properties does (it imports this file): the drawer opens from
// the list and from a shared address (`?detail=property:<id>`) on that page. `pageHref` is the "Apri la scheda completa" of its foot.
registerDetail(PROPERTY_DRAWER_KIND, {
  title: PropertyDrawerTitle,
  Content: PropertyDrawerContent,
  pageHref: propertyPath,
});
