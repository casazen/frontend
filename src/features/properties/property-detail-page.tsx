import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Pause, Pencil, Plus, Power, Trash2, Wrench } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { buildPropertyBookingPath, isPropertyPublishable } from '@/lib/booking-url';
import { propertyStatus } from '@/lib/status-dictionary';
import { useUpdatePropertyCin } from '@/queries/use-cin';
import {
  useActivateProperty,
  useDeleteProperty,
  usePauseProperty,
  useProperty,
  usePropertyDetail,
} from '@/queries/use-properties';
import { useCurrentUser } from '@/queries/use-users';
import { IcalSettings } from './components/ical-settings';
import { PropertyActivityTab } from './components/property-activity-tab';
import { PropertyCinDialog } from './components/property-cin-dialog';
import { PropertyDocumentsTab } from './components/property-documents-tab';
import { PropertyNextStep } from './components/property-next-step';
import { PropertyOtaSummary } from './components/property-ota-summary';
import { PropertyOverviewTab } from './components/property-overview-tab';
import { PropertyPhotoManager } from './components/property-photo-manager';
import { PRICING_SECTION_ID, propertyPanelOf, type PropertyPanel } from './lib/property-sheet';
import { longRentPropertyPath } from './long-rent/paths';
import { ScheduledChangeNotice } from './mode/components/scheduled-change-notice';
import { useModeChangeMenuItems } from './mode/use-mode-entry';
import { PROPERTIES_PATH, propertyEditPath, propertyNewBookingPath, propertyServiceRequestPath } from './properties-paths';

/** The page while the property loads: the shape of the page, no spinner in the middle of nothing. */
function PropertyDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="property-detail-loading">
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
 * `/app/short-rent/properties/:id`: one property (SR-07d, a restyling: the same data, the same endpoints, the same permissions).
 * The header says which property it is and where, with its state and the "⋯" menu of the other actions; under it the one
 * highlighted block, "Cosa fare ora", and then the tabs Panoramica, Foto, Prenotazioni e interventi, Calendari and Documenti
 * e adempimenti, each made of sections without a box. The tab is in the address (`?tab=`): the six values of the old page
 * still open the right place (`pricing` is a section of Panoramica, `cin` one of Documenti e adempimenti).
 */
export function PropertyDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const panel = propertyPanelOf(tabParam);
  const [cinDialogOpen, setCinDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Read again whenever the page opens: the activation, the CIN or the pause change on other pages, where these are not watched.
  const detail = usePropertyDetail(id, { fresh: true });
  // The record of the property, for what the detail does not carry: the compliance status (activation) and the slug of its page.
  const record = useProperty(id, { fresh: true });
  const { org } = useCurrentUser();
  const updateCin = useUpdatePropertyCin();
  const pauseProperty = usePauseProperty();
  const activateProperty = useActivateProperty();
  const deleteProperty = useDeleteProperty();
  // OTA partner API in freeze (D10): the calendars tab keeps only the iCal calendars while the flag is off.
  const otaEnabled = useFeatureFlags().flags.otaPartnerApi;
  const { hasPermission } = useWorkspace();
  // "Cambia modalità" in the menu "⋯" (PM-03): none for who may not write the property.
  const modeChangeItems = useModeChangeMenuItems('short-rent', id);

  const property = detail.data;
  // `?tab=pricing` (the old tab of the seasonal suggestions) is a section of the overview: scroll to it once the page is there.
  const scrollToPricing = tabParam === 'pricing' && property !== undefined;
  useEffect(() => {
    if (scrollToPricing) document.getElementById(PRICING_SECTION_ID)?.scrollIntoView?.({ block: 'start' });
  }, [scrollToPricing]);

  // The property is gone: leave at once. Its queries were removed with it, and reading them again would say "not found".
  if (deleteProperty.isSuccess) return <Navigate to={PROPERTIES_PATH} replace />;

  if (detail.isLoading || record.isLoading) {
    return <PropertyDetailSkeleton label={t('property.detail.loading')} />;
  }

  // An API error is never shown as "not found" (only a 404 is, A2-36).
  const failed = detail.isError ? detail : record.isError ? record : null;
  if (failed && getHttpStatus(failed.error) !== 404) {
    return (
      <AppShell>
        <div className="min-w-0 space-y-6">
          <PageHeader crumbs="auto" title={t('property.detail.fallbackTitle')} />
          <ErrorState testId="property-load-error" title={t('property.detail.loadError')} error={failed.error} onRetry={() => void failed.refetch()} />
        </div>
      </AppShell>
    );
  }

  // A long-term property lives in the long-rent section only.
  if (property?.rentalMode === 'Long') return <Navigate to={longRentPropertyPath(property.id)} replace />;

  if (!property || !record.data) {
    return (
      <AppShell>
        <div className="min-w-0 space-y-6" data-testid="property-not-found">
          <PageHeader crumbs="auto" title={t('property.detail.fallbackTitle')} />
          <EmptyState
            icon={Building2}
            title={t('property.detail.notFound')}
            description={t('property.detail.notFoundDescription')}
            action={{ label: t('property.next.toProperties'), href: PROPERTIES_PATH }}
          />
        </div>
      </AppShell>
    );
  }

  // The state is one: suspended first, then the pause the host set, then the compliance status (the same as the list and the drawer).
  const status = propertyStatus({ complianceStatus: record.data.complianceStatus, isPaused: property.isPaused });
  const canWrite = hasPermission('short-rent', 'property.write');
  const canReadBookings = hasPermission('short-rent', 'booking.read');
  const canCreateBooking = hasPermission('short-rent', 'booking.write');
  const busy = pauseProperty.isPending || activateProperty.isPending || deleteProperty.isPending;
  // The page of the property on the booking site, when a guest can open it: a paused or unfinished property is not published.
  const publicPath =
    org?.slug && isPropertyPublishable({ isActive: record.data.isActive, isPaused: property.isPaused, complianceStatus: record.data.complianceStatus ?? undefined })
      ? buildPropertyBookingPath(org.slug, record.data)
      : null;

  // The line under the name: what it has and where.
  const summary = [
    t('property.table.bedroomsCount', { count: property.bedrooms }),
    t('property.list.guestsCount', { count: property.maxGuests }),
    property.city,
  ]
    .filter(Boolean)
    .join(' · ');

  // Pausing and activating are dedicated actions (A2-05): reversible (the pause offers "Annulla"), never the generic update.
  const menu: PageHeaderMenuItem[] = [
    ...(canWrite ? [{ label: t('property.list.actions.edit'), icon: Pencil, to: propertyEditPath(property.id), testId: 'property-edit' }] : []),
    ...(canCreateBooking
      ? [{ label: t('property.detail.newBooking'), icon: Plus, to: propertyNewBookingPath(property.id), testId: 'property-new-booking-menu' }]
      : []),
    ...(canReadBookings
      ? [{ label: t('property.list.actions.requestService'), icon: Wrench, to: propertyServiceRequestPath(property.id), testId: 'property-request-service' }]
      : []),
    ...modeChangeItems,
    ...(canWrite && status === 'Active'
      ? [{ label: t('property.list.actions.pause'), icon: Pause, onClick: () => pauseProperty.mutate(property.id), disabled: busy, testId: 'property-pause-toggle' }]
      : []),
    ...(canWrite && status === 'Paused'
      ? [{ label: t('property.list.actions.reactivate'), icon: Power, onClick: () => activateProperty.mutate(property.id), disabled: busy, testId: 'property-pause-toggle' }]
      : []),
    ...(canWrite
      ? [
          { separator: true as const },
          { label: t('property.list.actions.delete'), icon: Trash2, danger: true, onClick: () => setDeleteOpen(true), disabled: busy, testId: 'property-delete' },
        ]
      : []),
  ];

  // The test ids are how the tests reach the tabs.
  const tabs: TabItem<PropertyPanel>[] = [
    { value: 'info', label: t('property.detail.tabs.info'), testId: 'property-tab-info' },
    { value: 'photos', label: t('property.detail.tabs.photos'), testId: 'property-tab-photos' },
    { value: 'activity', label: t('property.detail.tabs.activity'), testId: 'property-tab-activity' },
    { value: 'ical', label: otaEnabled ? t('property.detail.tabs.ota') : t('property.detail.tabs.ical'), testId: 'property-tab-ical' },
    { value: 'documents', label: t('property.detail.tabs.documents'), testId: 'property-tab-documents' },
  ];

  // The backend decides whether it can go (409 with upcoming bookings or active leases): the toast of the mutation says why.
  const confirmDelete = async () => {
    try {
      await deleteProperty.mutateAsync(property.id);
    } catch {
      // Error toast already handled by the mutation
    }
  };

  return (
    <AppShell>
      <div className="min-w-0 space-y-6" data-testid="property-detail-page">
        {/* The trail (Affitti brevi › Immobili › this property) and, on a phone, the link back to the list (UI-05). */}
        <PageHeader
          crumbs="auto"
          title={property.name}
          description={summary}
          action={<StatusBadge kind="property" status={status} size="lg" data-testid="property-status" />}
          secondary={menu}
        />

        <ScheduledChangeNotice area="short-rent" propertyId={property.id} />

        <PropertyNextStep
          property={property}
          status={status}
          canWrite={canWrite}
          canReadBookings={canReadBookings}
          onEditCin={() => setCinDialogOpen(true)}
          onReactivate={() => activateProperty.mutate(property.id)}
          reactivating={activateProperty.isPending}
        />

        {/* UI-07 Tabs: links with the tab in the address (`?tab=`), a menu on a phone. */}
        <Tabs label={t('property.detail.tabsLabel')} items={tabs} defaultValue="info" value={panel} selectTestId="property-tabs-select">
          {panel === 'info' && (
            <PropertyOverviewTab property={property} canWrite={canWrite} publicPath={publicPath} onEditCin={() => setCinDialogOpen(true)} />
          )}
          {panel === 'photos' && <PropertyPhotoManager propertyId={property.id} propertyName={property.name} canEdit={canWrite} />}
          {panel === 'activity' && (
            <PropertyActivityTab property={property} canReadBookings={canReadBookings} canCreateBooking={canCreateBooking} canWrite={canWrite} />
          )}
          {panel === 'ical' && (
            <div className="space-y-6">
              <IcalSettings propertyId={property.id} />
              {otaEnabled && <PropertyOtaSummary integrations={property.otaIntegrations} />}
            </div>
          )}
          {panel === 'documents' && <PropertyDocumentsTab property={property} canWrite={canWrite} onEditCin={() => setCinDialogOpen(true)} />}
        </Tabs>
      </div>

      <PropertyCinDialog
        propertyId={property.id}
        open={cinDialogOpen}
        onOpenChange={setCinDialogOpen}
        cinStatus={property.cinStatus}
        cinCode={property.cinCode}
        isSaving={updateCin.isPending}
        onSave={async (cinCode) => {
          await updateCin.mutateAsync({ propertyId: property.id, cinCode });
        }}
      />

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('property.deleteDialog.title')}
        description={t('property.deleteDialog.description', { name: property.name })}
        confirmLabel={t('property.deleteDialog.confirm')}
        variant="destructive"
        requireText={property.name}
        consequences={[t('property.deleteDialog.consequenceHidden'), t('property.deleteDialog.consequenceBlocked')]}
        onConfirm={confirmDelete}
        isLoading={deleteProperty.isPending}
      />
    </AppShell>
  );
}
