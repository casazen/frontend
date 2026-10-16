import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileSignature, FileText } from 'lucide-react';
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
import { getLeaseStatusLabel } from '@/lib/i18n-labels';
import { formatCurrency } from '@/lib/utils';
import { formatPropertyLocation } from '../property-location';
import { leaseDay, leaseOfRow, tenantNameOf } from './long-rent-property-format';
import { useLongRentPropertyRows, type LongRentPropertyRow } from './long-rent-property-rows';
import { LONG_RENT_PROPERTY_DRAWER_KIND, longRentLeasePath, longRentPropertyPath, newLeaseForPropertyPath } from './paths';

/**
 * The property of the drawer, read from the list of the properties of Affitti lunghi: the same queries as the page of the list, so
 * there is no second request, and what changes in one changes in both.
 */
function useRowOfTheList(id: string) {
  const { rows, isLoading, isError, error, refetch } = useLongRentPropertyRows();
  return { row: rows?.find((candidate) => candidate.property.id === id), isLoading, isError, error, refetch };
}

export function LongRentPropertyDrawerTitle({ id }: DetailTitleProps) {
  const { row } = useRowOfTheList(id);
  return <>{row?.property.name ?? ''}</>;
}

/** Who lives there, with what lease, until when and for how much: or who is coming. The way to the lease is the button above. */
function LeaseSection({ row }: { row: LongRentPropertyRow }) {
  const { t, i18n } = useTranslation();
  const lease = leaseOfRow(row);
  if (!lease) return null;

  const from = leaseDay(lease.startDate, i18n.language);
  const to = leaseDay(lease.endDate, i18n.language);

  return (
    <PlainSection title={t('longRentProperties.drawer.leaseSection')}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/70">{t('longRentProperties.drawer.tenant')}</dt>
        <dd className="break-words font-medium">{tenantNameOf(lease, t)}</dd>
        <dt className="text-foreground/70">{t('longRentProperties.drawer.leaseStatus')}</dt>
        <dd className="break-words">{getLeaseStatusLabel(lease.status, t)}</dd>
        {from && to ? (
          <>
            <dt className="text-foreground/70">{t('longRentProperties.drawer.term')}</dt>
            <dd className="break-words">{t('longRentProperties.drawer.termValue', { from, to })}</dd>
          </>
        ) : null}
        <dt className="text-foreground/70">{t('longRentProperties.drawer.rent')}</dt>
        <dd className="break-words">
          <strong>{formatCurrency(lease.monthlyRent)}</strong> {t('longRentProperties.list.perMonth')}
        </dd>
      </dl>
    </PlainSection>
  );
}

function KeyData({ row }: { row: LongRentPropertyRow }) {
  const { t } = useTranslation();
  const { property } = row;

  return (
    <PlainSection title={t('longRentProperties.drawer.keyData')}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/70">{t('longRentProperties.detail.address')}</dt>
        <dd className="break-words">{formatPropertyLocation(property)}</dd>
        <dt className="text-foreground/70">{t('longRentProperties.detail.rooms')}</dt>
        <dd className="break-words">{[t('property.table.bedroomsCount', { count: property.bedrooms }), t('property.table.bathroomsCount', { count: property.bathrooms })].join(' · ')}</dd>
      </dl>
    </PlainSection>
  );
}

export function LongRentPropertyDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const { row, isLoading, isError, error, refetch } = useRowOfTheList(id);
  // Read without `useWorkspace`, which refuses to run outside its provider: a drawer drawn on its own offers no action.
  const workspace = useContext(WorkspaceContext);
  const canCreateLease = workspace?.hasPermission('long-rent', 'lease.create') ?? false;
  const canReadLease = workspace?.hasPermission('long-rent', 'lease.read') ?? false;

  if (isLoading) return <SkeletonLine lines={4} />;

  if (isError && !row) {
    return <ErrorState title={t('longRentProperties.detail.loadError')} error={error} onRetry={refetch} />;
  }

  if (!row) {
    return (
      <div role="status" className="space-y-1 py-4" data-testid="long-rent-property-drawer-not-found">
        <p className="font-semibold">{t('longRentProperties.drawer.notFound')}</p>
        <p className="text-sm text-foreground/70">{t('longRentProperties.drawer.notFoundDescription')}</p>
      </div>
    );
  }

  const lease = leaseOfRow(row);
  // The one thing to do now: open the lease the property has, or make the first one.
  const mainAction = lease ? (
    canReadLease ? (
      <Button asChild>
        <Link to={longRentLeasePath(lease.id)}>
          <FileText aria-hidden="true" className="size-4" />
          {t('longRentProperties.list.actions.openLease')}
        </Link>
      </Button>
    ) : null
  ) : row.status === 'Free' && canCreateLease ? (
    <Button asChild>
      <Link to={newLeaseForPropertyPath(row.property.id)}>
        <FileSignature aria-hidden="true" className="size-4" />
        {t('longRentProperties.list.actions.createLease')}
      </Link>
    </Button>
  ) : null;

  return (
    <div className="space-y-6 pb-2" data-testid="long-rent-property-drawer">
      {row.status ? <StatusExplainer kind="longRentProperty" status={row.status} actions={mainAction} /> : null}

      <LeaseSection row={row} />

      <KeyData row={row} />
    </div>
  );
}

// Registered when this module is loaded, which the list of the properties does (it imports this file): the drawer opens from the
// list and from a shared address (`?detail=long-rent-property:<id>`) on that page. `pageHref` is the "Apri la scheda completa" of its foot.
registerDetail(LONG_RENT_PROPERTY_DRAWER_KIND, {
  title: LongRentPropertyDrawerTitle,
  Content: LongRentPropertyDrawerContent,
  pageHref: longRentPropertyPath,
});
