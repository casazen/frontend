import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, FilePlus2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { LongRentServiceRequests } from '@/features/service-requests/components/long-rent-service-requests';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useLeases } from '@/queries/use-leases';
import { useLongRentPropertyAggregate } from '@/queries/use-long-rent-properties';
import { useProperty, usePropertyDocuments } from '@/queries/use-properties';
import { ScheduledChangeNotice } from '../mode/components/scheduled-change-notice';
import { useModeChangeMenuItems } from '../mode/use-mode-entry';
import { formatPropertyLocation } from '../property-location';
import { leaseOfRow } from './long-rent-property-format';
import { LongRentPropertyNextStep } from './long-rent-property-next-step';
import { ContractsPanel, DataPanel, DocumentsPanel } from './long-rent-property-panels';
import { longRentPropertyPanelOf, longRentPropertyPanels, type LongRentPropertyPanel } from './long-rent-property-sheet';
import { longRentPropertyRows } from './long-rent-property-rows';
import { LONG_RENT_PROPERTIES_PATH, longRentPropertyEditPath, newLeaseForPropertyPath } from './paths';

/** The page while the property loads: the shape of the page, no spinner in the middle of nothing. */
function PropertyDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="long-rent-property-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

/**
 * `/app/long-rent/properties/:id`: one long-term property (LR-07d). The header says what it is and where, with its state and the
 * menu "⋯" of the other actions; under it the one highlighted block, read from its leases (who lives there, for how much and until
 * when, or the lease to make), and then the tabs Contratti, Documenti (the APE the lease needs), Interventi (the requests to
 * suppliers) and Dati (the place and the cadastral ones), each made of sections without a box. The tab is in the address
 * (`?tab=`). The leases are asked of who may read them; without them the page works, has no tab of contracts and says nothing about
 * who lives there.
 */
export function LongRentPropertyDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useWorkspace();
  const { data: property, isLoading, isError, error, refetch } = useProperty(id);
  const documents = usePropertyDocuments(id);
  const canReadLeases = hasPermission('long-rent', 'lease.read');
  const canCreateLease = hasPermission('long-rent', 'lease.create');
  // The leases of this property only: the server narrows them (LR-01). Read again when the page opens, a lease is made elsewhere.
  const leases = useLeases({ propertyId: id }, { enabled: canReadLeases && id !== '', refetchOnMount: 'always' });
  // What the server says of the property that the two lists do not: the lease that holds it even when it renewed by itself (LR-07a).
  const aggregate = useLongRentPropertyAggregate({ fresh: true });
  // "Cambia modalità" in the menu "⋯" (PM-03): none for who may not write the property.
  const modeChangeItems = useModeChangeMenuItems('long-rent', id);

  if (isLoading) return <PropertyDetailSkeleton label={t('longRentProperties.detail.loading')} />;

  // An API error is never shown as "not found" (only a 404 is).
  if (isError && getHttpStatus(error) !== 404) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('longRentProperties.detail.fallbackTitle')} />
        <ErrorState testId="long-rent-property-load-error" title={t('longRentProperties.detail.loadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('longRentProperties.detail.fallbackTitle')} />
        <EmptyState
          icon={Building2}
          title={t('longRentProperties.drawer.notFound')}
          description={t('longRentProperties.drawer.notFoundDescription')}
          action={{ label: t('longRentProperties.detail.backToList'), href: LONG_RENT_PROPERTIES_PATH }}
        />
      </div>
    );
  }

  // A short-rent property lives in the short-rent section only.
  if (property.rentalMode === 'Short') return <Navigate to={`/app/short-rent/properties/${property.id}`} replace />;

  // What the leases say of the property, with the rule of the list: let when a registered lease is in force, free otherwise.
  const row = leases.data ? longRentPropertyRows([property], leases.data, todayInRome(), aggregate.data)[0] : null;
  const leasesFailed = leases.isError && leases.data === undefined;

  // A free property without a lease has its "Crea contratto" in the highlighted block; any other has it here, for another tenant.
  const blockCreatesLease = row?.status === 'Free' && !leaseOfRow(row);
  const menu: PageHeaderMenuItem[] = [
    { label: t('longRentProperties.detail.edit'), icon: Pencil, to: longRentPropertyEditPath(property.id), testId: 'long-rent-property-edit' },
    ...(canCreateLease && !blockCreatesLease
      ? [{ label: t('longRentProperties.detail.newLease'), icon: FilePlus2, to: newLeaseForPropertyPath(property.id), testId: 'long-rent-property-new-lease' }]
      : []),
    ...(modeChangeItems.length > 0 ? [{ separator: true as const }, ...modeChangeItems] : []),
  ];

  const panels = longRentPropertyPanels(canReadLeases);
  const panel = longRentPropertyPanelOf(searchParams.get('tab'), panels);
  const tabs: TabItem<LongRentPropertyPanel>[] = panels.map((value) => ({
    value,
    label: t(`longRentProperties.detail.tabs.${value}`),
    testId: `long-rent-property-tab-${value}`,
  }));

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-property-page">
      {/* The trail (Affitti lunghi › Immobili › this property) and, on a phone, the link back to the list (UI-05). */}
      <PageHeader
        crumbs="auto"
        title={property.name}
        description={formatPropertyLocation(property)}
        action={row?.status ? <StatusBadge kind="longRentProperty" status={row.status} size="lg" data-testid="long-rent-property-status" /> : undefined}
        secondary={menu}
      />

      <ScheduledChangeNotice area="long-rent" propertyId={property.id} />

      {leases.isLoading ? (
        <div role="status" aria-busy="true" data-testid="long-rent-property-next-step-loading">
          <span className="sr-only">{t('longRentProperties.detail.loading')}</span>
          <Skeleton aria-hidden="true" className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        </div>
      ) : leasesFailed ? (
        // The property is there without its leases: it is said, never guessed (a property is not "free" because a list failed).
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-foreground/70" data-testid="long-rent-property-leases-note">
          <p className="min-w-0 break-words">{t('longRentProperties.detail.contractsLoadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void leases.refetch()}>
            {t('longRentProperties.retry')}
          </Button>
        </div>
      ) : row ? (
        <LongRentPropertyNextStep row={row} canCreateLease={canCreateLease} />
      ) : null}

      {/* UI-07 Tabs: links with the tab in the address (`?tab=`), a menu on a phone. */}
      <Tabs label={t('longRentProperties.detail.tabsLabel')} items={tabs} value={panel} selectTestId="long-rent-property-tabs-select">
        {panel === 'contracts' && <ContractsPanel leases={leases.data} />}
        {panel === 'documents' && <DocumentsPanel propertyId={property.id} documents={documents} />}
        {panel === 'requests' && <LongRentServiceRequests propertyId={property.id} />}
        {panel === 'data' && <DataPanel property={property} />}
      </Tabs>
    </div>
  );
}
