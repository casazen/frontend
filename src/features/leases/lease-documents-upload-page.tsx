import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { useLeases } from '@/queries/use-leases';
import { useCfPracticeLease } from '@/queries/use-concordatofacile';
import type { LeaseDetail } from '@/types';
import { CfImportPanel } from './components/cf-import-panel';
import { LeaseDocumentsPanel } from './components/lease-documents-panel';
import { isCfImportDraft, useCfDeliveredContract } from './lib/cf-import';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Number of a practice of ConcordatoFacile: `P-` and 16 hexadecimal characters (the button «Carica i dati in CasaZen» sends it as `?practice=`). */
const PRACTICE = /^P-[0-9A-Fa-f]{16}$/;

/** The contracts of the person to choose from; with a practice in the link, the choice goes on to `?leaseId=…&practice=…`. */
function ChooseLease({ practiceId }: { practiceId?: string }) {
  const { t } = useTranslation();
  const leases = useLeases();
  if (leases.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (leases.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={leases.error} onRetry={() => void leases.refetch()} />;
  const chosen = (leaseId: string) => `?leaseId=${encodeURIComponent(leaseId)}${practiceId ? `&practice=${encodeURIComponent(practiceId)}` : ''}`;
  return <div className="space-y-4"><p>{t('cfDocuments.chooseLease')}</p>
    <ul className="space-y-3">{leases.data?.map((lease) => <li key={lease.id}><Link className="break-words underline" to={chosen(lease.id)}>{lease.property?.name ?? t('cfDocuments.leaseLabel')} · {lease.id}</Link></li>)}</ul>
    {leases.data?.length === 0 ? <p>{t('cfDocuments.noLeases')}</p> : null}
    <Link className="inline-block underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>
  </div>;
}

/**
 * The contract ConcordatoFacile delivered, once it is uploaded to the draft it was made for (CF-IMPORT): where the reading stands and
 * «Completa e importa il contratto». Nothing for any other lease, and nothing before a contract document is there.
 */
function DeliveredContract({ lease }: { lease: LeaseDetail }) {
  const reading = useCfDeliveredContract(lease);
  return reading ? <CfImportPanel leaseId={lease.id} reading={reading} /> : null;
}

/** The documents of one lease. `practiceLine` says where the practice of the link stands in relation to it (when there is one). */
function LeaseDocuments({ leaseId, practiceLine }: { leaseId: string; practiceLine?: string }) {
  const { t } = useTranslation();
  const lease = useQuery({ queryKey: ['leases', leaseId], queryFn: () => leasesApi.getById(leaseId), refetchOnMount: 'always' });
  if (lease.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (lease.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={lease.error} onRetry={() => void lease.refetch()} />;
  if (!lease.data.propertyId) return <Alert variant="danger">{t('cfDocuments.invalidLease')}</Alert>;
  // On the draft ConcordatoFacile made, the contract uploaded is read and fills in the draft: the generic line («non modifica i dati del contratto») would be untrue.
  const instructions = isCfImportDraft(lease.data) ? t('cfDocuments.import.instructions') : t('cfDocuments.instructions');
  return <div className="space-y-6">
    <h2 className="text-lg font-semibold">{lease.data.property?.name ?? t('cfDocuments.house')}</h2>
    <p className="break-all text-sm text-muted-foreground">{t('cfDocuments.reference', { id: lease.data.id })}</p>
    {practiceLine ? <p className="break-words text-sm text-muted-foreground" data-testid="cf-documents-practice">{practiceLine}</p> : null}
    <Alert>{instructions}</Alert>
    <DeliveredContract lease={lease.data} />
    <LeaseDocumentsPanel leaseId={leaseId} canUpload />
    <Link className="inline-block underline" to={`/app/long-rent/leases/${leaseId}`}>{t('cfDocuments.openLease')}</Link>
  </div>;
}

/**
 * The page opened from the button «Carica i dati in CasaZen» of ConcordatoFacile (`?practice=P-…`, CF-FIX): the lease the partner linked
 * the practice to is read from the server and its documents are shown, never a lease the link itself names. A practice that is not
 * linked, that is not the person's or that cannot be read (also while the service is off: the server answers 404) leaves the choice of
 * the contract to the person, who is told why.
 */
function PracticeDocuments({ practiceId }: { practiceId: string }) {
  const { t } = useTranslation();
  const lookup = useCfPracticeLease(practiceId);
  if (lookup.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  const leaseId = lookup.data?.leaseId;
  if (lookup.isError) {
    return <div className="space-y-6">
      <Alert data-testid="cf-documents-practice-notfound">{t('cfDocuments.practice.notFound')}</Alert>
      <ChooseLease />
    </div>;
  }
  if (!leaseId || !UUID.test(leaseId)) {
    return <div className="space-y-6">
      <Alert data-testid="cf-documents-practice-manual">{t('cfDocuments.practice.manual', { practice: practiceId })}</Alert>
      <ChooseLease practiceId={practiceId} />
    </div>;
  }
  return <LeaseDocuments key={leaseId} leaseId={leaseId} practiceLine={t('cfDocuments.practice.linked', { practice: practiceId })} />;
}

export function LeaseDocumentsUploadPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const ids = params.getAll('leaseId');
  const leaseId = ids[0] ?? '';
  const invalid = ids.length > 1 || (ids.length === 1 && !UUID.test(leaseId)) || (ids.length === 0 && params.has('propertyId'));
  const practices = params.getAll('practice');
  const practiceId = practices.length === 1 && PRACTICE.test(practices[0]) ? practices[0] : '';
  const practiceInvalid = practices.length > 0 && practiceId === '';
  return <div className="mx-auto max-w-3xl space-y-6" data-testid="cf-documents-page">
    <PageHeader title={t('cfDocuments.title')} description={t('cfDocuments.description')} />
    {invalid ? <Alert variant="danger" action={<Link className="underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>}>{t('cfDocuments.invalidLease')}</Alert>
      : leaseId ? <LeaseDocuments key={leaseId} leaseId={leaseId} practiceLine={practiceId ? t('cfDocuments.practice.chosen', { practice: practiceId }) : undefined} />
      : practiceInvalid ? <div className="space-y-6">
        <Alert variant="warning" data-testid="cf-documents-practice-invalid">{t('cfDocuments.practice.invalid')}</Alert>
        <ChooseLease />
      </div>
      : practiceId ? <PracticeDocuments key={practiceId} practiceId={practiceId} />
      : <ChooseLease />}
  </div>;
}
