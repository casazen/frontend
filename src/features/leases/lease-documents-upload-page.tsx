import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { useLeases } from '@/queries/use-leases';
import { usePropertyDocuments } from '@/queries/use-properties';
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

/** A bare email URL is useful too: choose an existing authorized lease, never guess a house. */
function ChooseLease() {
  const { t } = useTranslation();
  const leases = useLeases();
  if (leases.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (leases.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={leases.error} onRetry={() => void leases.refetch()} />;
  return (
    <div className="space-y-4">
      <p>{t('cfDocuments.chooseLease')}</p>
      <ul className="space-y-3">
        {leases.data?.map((lease) => (
          <li key={lease.id}>
            <Link className="break-words underline" to={`?leaseId=${encodeURIComponent(lease.id)}`}>
              {lease.property?.name ?? t('cfDocuments.leaseLabel')} · {lease.id}
            </Link>
          </li>
        ))}
      </ul>
      {leases.data?.length === 0 ? <p>{t('cfDocuments.noLeases')}</p> : null}
      <Link className="inline-block underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>
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
  const invalid = ids.length > 1 || (ids.length === 1 && !UUID.test(leaseId));
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="cf-documents-page">
      <PageHeader title={t('cfDocuments.title')} description={t('cfDocuments.description')} />
      {invalid ? (
        <Alert variant="danger" action={<Link className="underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>}>
          {t('cfDocuments.invalidLease')}
        </Alert>
      ) : leaseId ? <LeaseDocuments key={leaseId} leaseId={leaseId} /> : <ChooseLease />}
    </div>
  );
}
