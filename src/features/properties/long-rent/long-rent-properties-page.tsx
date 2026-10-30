import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { Button } from '@/components/ui/button';
import { LongRentGuide } from '@/features/onboarding/components/long-rent-guide';
import { ServiceRequestForm } from '@/features/service-requests/components/service-request-form';
import { longRentRequestPath } from '@/features/service-requests/long-rent/paths';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { useLongRentPropertiesList } from './long-rent-properties-list';
import { useLongRentPropertyRows } from './long-rent-property-rows';
import { LONG_RENT_PROPERTY_CREATE_PATH } from './paths';

/**
 * Immobili of Affitti lunghi (LR-07): the properties of a long-term landlord in the unified list, one state each (let or free),
 * who lives there until when and the rent, the one thing to do about it and the rest in "⋯". The name opens the drawer of the
 * property; its page, its form and the creation of a new one are the pages they always were. The list is one request for the
 * properties and one for the leases, whatever the number of rows, and it filters and searches them itself.
 */
export function LongRentPropertiesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const viewsScope = useListViewsScope();
  const { rows, isLoading, isError, error, refetch, leasesKnown, leasesFailed, refetchLeases } = useLongRentPropertyRows({ fresh: true });
  const canWrite = hasPermission('long-rent', 'property.write');
  const navigate = useNavigate();
  // "Richiedi intervento" from the row of a property (LR-07b): the window of the request, opened on that property.
  const [requestFor, setRequestFor] = useState<string | null>(null);

  const list = useLongRentPropertiesList({
    canWrite,
    canCreateLease: hasPermission('long-rent', 'lease.create'),
    canReadLease: hasPermission('long-rent', 'lease.read'),
    leasesKnown,
    onRequest: setRequestFor,
  });

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-properties-page">
      <PageHeader
        title={t('longRentProperties.list.title')}
        description={t('longRentProperties.list.description')}
        crumbs="auto"
        primary={
          canWrite ? { label: t('longRentProperties.list.add'), icon: Plus, to: LONG_RENT_PROPERTY_CREATE_PATH, testId: 'long-rent-property-add' } : undefined
        }
      />

      <LongRentGuide />

      {/* The properties are there without their leases: it is said, never guessed (a property is not "free" because a list failed). */}
      {leasesFailed ? (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-foreground/70" data-testid="long-rent-properties-leases-note">
          <p className="min-w-0 break-words">{t('longRentProperties.list.leasesUnavailable')}</p>
          <Button type="button" variant="outline" size="sm" onClick={refetchLeases}>
            {t('longRentProperties.retry')}
          </Button>
        </div>
      ) : null}

      <ListView
        list={list}
        rows={rows ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        errorTitle={t('longRentProperties.list.loadError')}
        onRetry={refetch}
        viewsScope={viewsScope}
        testId="long-rent-properties-list"
      />

      {requestFor ? (
        // Mounted when asked, so it starts from nothing every time; once made, the page of the new request is the way on (as from Interventi).
        <ServiceRequestForm
          propertyId={requestFor}
          context="long-rent"
          open
          hideTrigger
          onOpenChange={(open) => {
            if (!open) setRequestFor(null);
          }}
          onCreated={(request) => {
            setRequestFor(null);
            navigate(longRentRequestPath(request.id));
          }}
        />
      ) : null}
    </div>
  );
}
