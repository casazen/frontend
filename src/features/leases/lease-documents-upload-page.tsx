import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { useLeases } from '@/queries/use-leases';
import { LeaseDocumentsPanel } from './components/lease-documents-panel';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ChooseLease() {
  const { t } = useTranslation();
  const leases = useLeases();
  if (leases.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (leases.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={leases.error} onRetry={() => void leases.refetch()} />;
  return <div className="space-y-4"><p>{t('cfDocuments.chooseLease')}</p>
    <ul className="space-y-3">{leases.data?.map((lease) => <li key={lease.id}><Link className="break-words underline" to={`?leaseId=${encodeURIComponent(lease.id)}`}>{lease.property?.name ?? t('cfDocuments.leaseLabel')} · {lease.id}</Link></li>)}</ul>
    {leases.data?.length === 0 ? <p>{t('cfDocuments.noLeases')}</p> : null}
    <Link className="inline-block underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>
  </div>;
}

function LeaseDocuments({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const lease = useQuery({ queryKey: ['leases', leaseId], queryFn: () => leasesApi.getById(leaseId), refetchOnMount: 'always' });
  if (lease.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (lease.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={lease.error} onRetry={() => void lease.refetch()} />;
  if (!lease.data.propertyId) return <Alert variant="danger">{t('cfDocuments.invalidLease')}</Alert>;
  return <div className="space-y-6">
    <h2 className="text-lg font-semibold">{lease.data.property?.name ?? t('cfDocuments.house')}</h2>
    <p className="break-all text-sm text-muted-foreground">{t('cfDocuments.reference', { id: lease.data.id })}</p>
    <Alert>{t('cfDocuments.instructions')}</Alert>
    <LeaseDocumentsPanel leaseId={leaseId} canUpload />
    <Link className="inline-block underline" to={`/app/long-rent/leases/${leaseId}`}>{t('cfDocuments.openLease')}</Link>
  </div>;
}

export function LeaseDocumentsUploadPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const ids = params.getAll('leaseId');
  const leaseId = ids[0] ?? '';
  const invalid = ids.length > 1 || (ids.length === 1 && !UUID.test(leaseId)) || (ids.length === 0 && params.has('propertyId'));
  return <div className="mx-auto max-w-3xl space-y-6" data-testid="cf-documents-page">
    <PageHeader title={t('cfDocuments.title')} description={t('cfDocuments.description')} />
    {invalid ? <Alert variant="danger" action={<Link className="underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>}>{t('cfDocuments.invalidLease')}</Alert>
      : leaseId ? <LeaseDocuments key={leaseId} leaseId={leaseId} /> : <ChooseLease />}
  </div>;
}
