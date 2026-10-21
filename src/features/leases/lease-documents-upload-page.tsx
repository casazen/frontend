import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { useProperties, useProperty, usePropertyDocuments } from '@/queries/use-properties';
import { PropertyDocumentsSection } from '@/features/properties/components/property-documents-section';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Called only after an authorized lease read has resolved its property. Uploads keep the existing server write checks. */
function HouseDocuments({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const documents = usePropertyDocuments(propertyId);
  if (documents.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (documents.isError) return <ErrorState title={t('cfDocuments.documentsError')} error={documents.error} onRetry={() => void documents.refetch()} />;
  return <PropertyDocumentsSection propertyId={propertyId} documents={documents.data} defaultUploadType="Other" />;
}

/** A bare link lets the user choose an authorized house without requiring a lease. */
function ChooseProperty() {
  const { t } = useTranslation();
  const properties = useProperties({ mode: 'long' });
  if (properties.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (properties.isError) return <ErrorState title={t('cfDocuments.propertyError')} error={properties.error} onRetry={() => void properties.refetch()} />;
  return (
    <div className="space-y-4">
      <p>{t('cfDocuments.chooseProperty')}</p>
      <ul className="space-y-3">
        {properties.data?.map((property) => (
          <li key={property.id}>
            <Link className="break-words underline" to={`?propertyId=${encodeURIComponent(property.id)}`}>
              {property.name}
            </Link>
          </li>
        ))}
      </ul>
      {properties.data?.length === 0 ? <p>{t('cfDocuments.noProperties')}</p> : null}
      <Link className="inline-block underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>
    </div>
  );
}

/** Direct house upload, available before the partner has prepared a lease. */
function PropertyDocuments({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const property = useProperty(propertyId, { fresh: true });
  if (property.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (property.isError) return <ErrorState title={t('cfDocuments.propertyError')} error={property.error} onRetry={() => void property.refetch()} />;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{property.data.name}</h2>
      <Alert>{t('cfDocuments.instructions')}</Alert>
      <HouseDocuments propertyId={property.data.id} />
      <Link className="inline-block underline" to={`/app/long-rent/properties/${property.data.id}`}>{t('cfDocuments.openHouse')}</Link>
    </div>
  );
}

function LeaseDocuments({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  // Fresh authorization check on each visit, without the unrelated RLI polling of the full lease sheet.
  const lease = useQuery({ queryKey: ['leases', leaseId], queryFn: () => leasesApi.getById(leaseId), refetchOnMount: 'always' });
  if (lease.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (lease.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={lease.error} onRetry={() => void lease.refetch()} />;
  if (!lease.data.propertyId) return <Alert variant="danger">{t('cfDocuments.invalidLease')}</Alert>;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{lease.data.property?.name ?? t('cfDocuments.house')}</h2>
        <p className="break-all text-sm text-muted-foreground">{t('cfDocuments.reference', { id: lease.data.id })}</p>
        <Link className="inline-block underline" to={`/app/long-rent/properties/${lease.data.propertyId}`}>{t('cfDocuments.openHouse')}</Link>
      </div>
      <Alert>{t('cfDocuments.instructions')}</Alert>
      <HouseDocuments propertyId={lease.data.propertyId} />
      <Link className="inline-block underline" to={`/app/long-rent/leases/${lease.data.id}`}>{t('cfDocuments.openLease')}</Link>
    </div>
  );
}

/** Email landing page; it never creates a lease, charges the user or changes its registration state. */
export function LeaseDocumentsUploadPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const ids = params.getAll('leaseId');
  const leaseId = ids[0] ?? '';
  const propertyIds = params.getAll('propertyId');
  const propertyId = propertyIds[0] ?? '';
  // A lease, when provided, is authoritative: never override its house from another query parameter.
  const invalid = ids.length > 1 || (ids.length === 1 && !UUID.test(leaseId)) ||
    (ids.length === 0 && (propertyIds.length > 1 || (propertyIds.length === 1 && !UUID.test(propertyId))));
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="cf-documents-page">
      <PageHeader title={t('cfDocuments.title')} description={t('cfDocuments.description')} />
      {invalid ? (
        <Alert variant="danger" action={<Link className="underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>}>
          {t('cfDocuments.invalidLease')}
        </Alert>
      ) : leaseId ? <LeaseDocuments key={leaseId} leaseId={leaseId} /> : propertyId ? <PropertyDocuments key={propertyId} propertyId={propertyId} /> : <ChooseProperty />}
    </div>
  );
}
