import { ChevronRight, FileText, Search } from 'lucide-react';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLeases } from '@/queries/use-leases';
import { useCfPracticeLease } from '@/queries/use-concordatofacile';
import type { CfSyncState } from '@/types/concordatofacile.types';
import type { LeaseDetail } from '@/types';
import { CfImportPanel } from './components/cf-import-panel';
import { LeaseDocumentsPanel } from './components/lease-documents-panel';
import { useCfCompletion } from './lib/cf-completion';
import { isCfImportDraft, useCfDeliveredContract } from './lib/cf-import';
import { LEASE_CONFIRMED_STATE, isLeaseConfirmed } from './lib/upload-link';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRACTICE = /^P-[0-9A-Fa-f]{16}$/;

function ChooseLease({ practiceId }: { practiceId?: string }) {
  const { t } = useTranslation();
  const leases = useLeases();
  const [query, setQuery] = useState('');
  if (leases.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (leases.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={leases.error} onRetry={() => void leases.refetch()} />;
  const chosen = (leaseId: string) => `?leaseId=${encodeURIComponent(leaseId)}${practiceId ? `&practice=${encodeURIComponent(practiceId)}` : ''}`;
  const contracts = leases.data ?? [];
  const filtered = contracts.filter((lease) => matchesSearch(`${lease.property?.name ?? ''} ${lease.id}`, query));
  return <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
    <h2 className="text-xl font-semibold tracking-tight">{t('cfDocuments.chooseLease')}</h2>
    {contracts.length > 1 && <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
      <Search className="size-4 text-muted-foreground" aria-hidden="true" />
      <input type="search" aria-label={t('commandPalette.title')} placeholder={t('commandPalette.title')} value={query}
        onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
    </label>}
    <ul className="grid gap-2">{filtered.map((lease) => <li key={lease.id}>
      <Link className="flex min-h-16 items-center gap-3 rounded-xl border p-3 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring" to={chosen(lease.id)} state={LEASE_CONFIRMED_STATE}>
        <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1"><strong className="block break-words">{lease.property?.name ?? t('cfDocuments.leaseLabel')}</strong>
          <span className="break-all font-mono text-xs text-muted-foreground">{lease.id}</span></span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
    </li>)}</ul>
    {contracts.length === 0 && <p>{t('cfDocuments.noLeases')}</p>}
    {contracts.length > 0 && filtered.length === 0 && <p role="status">{t('listView.noResults.title')}</p>}
    <Link className="inline-flex min-h-11 items-center underline underline-offset-4" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>
  </div>;
}

function DeliveredContract({ lease, syncState }: { lease: LeaseDetail; syncState?: CfSyncState }) {
  const reading = useCfDeliveredContract(lease);
  return reading ? <CfImportPanel leaseId={lease.id} reading={reading} syncState={syncState} /> : null;
}

function ServiceOutcome({ lease }: { lease: LeaseDetail }) {
  const { t } = useTranslation();
  if (lease.isConcordatoFacileSource !== true) return null;
  if (lease.status === 'Registered') return <Alert variant="success" data-testid="cf-documents-outcome">{t('cfDocuments.outcome.registered')}</Alert>;
  if (lease.status === 'Signed') return <Alert variant="success" data-testid="cf-documents-outcome">{t('cfDocuments.outcome.signed')}</Alert>;
  return null;
}

function ConfirmLease({ lease, practiceId, onChooseOther }: { lease: LeaseDetail; practiceId?: string; onChooseOther: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const name = [lease.property?.name, lease.property?.city].filter(Boolean).join(' · ') || t('cfDocuments.leaseLabel');
  return <div className="space-y-4" data-testid="cf-documents-confirm">
    <Alert>{practiceId ? t('guidedContract.confirmWithPractice', { practice: practiceId, lease: name }) : t('guidedContract.confirmWithoutPractice', { lease: name })}</Alert>
    <div className="flex flex-wrap gap-2">
      <Button type="button" data-testid="cf-documents-confirm-button" onClick={() => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: LEASE_CONFIRMED_STATE })}>{t('guidedContract.confirmAction')}</Button>
      <Button type="button" variant="outline" data-testid="cf-documents-confirm-other" onClick={onChooseOther}>{t('guidedContract.confirmOther')}</Button>
    </div>
  </div>;
}

function ConfirmedDocuments({ lease, practiceLine }: { lease: LeaseDetail; practiceLine?: string }) {
  const { t } = useTranslation();
  const completion = useCfCompletion(lease);
  const instructions = isCfImportDraft(lease) ? t('cfDocuments.import.instructions') : t('cfDocuments.instructions');
  return <div className="space-y-6">
    <h2 className="text-lg font-semibold">{lease.property?.name ?? t('cfDocuments.house')}</h2>
    <p className="break-all text-sm text-muted-foreground">{t('cfDocuments.reference', { id: lease.id })}</p>
    {practiceLine ? <p className="break-words text-sm text-muted-foreground" data-testid="cf-documents-practice">{practiceLine}</p> : null}
    <Alert>{instructions}</Alert>
    <ServiceOutcome lease={lease} />
    <DeliveredContract lease={lease} syncState={completion.state} />
    <LeaseDocumentsPanel leaseId={lease.id} canUpload />
    <Link className="inline-block underline" to={`/app/long-rent/leases/${lease.id}`}>{t('cfDocuments.openLease')}</Link>
  </div>;
}

function LeaseDocuments({ leaseId, practiceId, practiceLine, confirmed }: { leaseId: string; practiceId?: string; practiceLine?: string; confirmed: boolean }) {
  const { t } = useTranslation();
  const [choosing, setChoosing] = useState(false);
  const lease = useQuery({ queryKey: ['leases', leaseId], queryFn: () => leasesApi.getById(leaseId), refetchOnMount: 'always' });
  if (lease.isPending) return <LoadingScreen message={t('cfDocuments.loading')} className="h-auto" />;
  if (lease.isError) return <ErrorState title={t('cfDocuments.leaseError')} error={lease.error} onRetry={() => void lease.refetch()} />;
  if (!lease.data.propertyId) return <Alert variant="danger">{t('cfDocuments.invalidLease')}</Alert>;
  if (!confirmed) return choosing ? <ChooseLease practiceId={practiceId} /> : <ConfirmLease lease={lease.data} practiceId={practiceId} onChooseOther={() => setChoosing(true)} />;
  return <ConfirmedDocuments lease={lease.data} practiceLine={practiceLine} />;
}

/**
 * The page opened from the button «Carica i dati in CasaZen» of ConcordatoFacile (`?practice=P-…`, CF-FIX): the lease the partner linked
 * the practice to is read from the server and its documents are shown, never a lease the link itself names. A practice that is not
 * linked, that is not the person's or that cannot be read (also while the service is off: the server answers 404) leaves the choice of
 * the contract to the person, who is told why.
 */
function PracticeDocuments({ practiceId, confirmed }: { practiceId: string; confirmed: boolean }) {
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
  return <LeaseDocuments key={leaseId} leaseId={leaseId} practiceId={practiceId} practiceLine={t('cfDocuments.practice.linked', { practice: practiceId })} confirmed={confirmed} />;
}

export function LeaseDocumentsUploadPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const confirmed = isLeaseConfirmed(useLocation().state);
  const ids = params.getAll('leaseId');
  const leaseId = ids[0] ?? '';
  const invalid = ids.length > 1 || (ids.length === 1 && !UUID.test(leaseId)) || (ids.length === 0 && params.has('propertyId'));
  const practices = params.getAll('practice');
  const practiceId = practices.length === 1 && PRACTICE.test(practices[0]) ? practices[0] : '';
  const practiceInvalid = practices.length > 0 && practiceId === '';
  return <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="cf-documents-page">
    <PageHeader title={t('cfDocuments.title')} description={t('cfDocuments.description')} />
    {invalid ? <Alert variant="danger" action={<Link className="underline" to="/app/long-rent/properties">{t('cfDocuments.backToHouses')}</Link>}>{t('cfDocuments.invalidLease')}</Alert>
      : leaseId ? <LeaseDocuments key={leaseId} leaseId={leaseId} practiceId={practiceId || undefined} practiceLine={practiceId ? t('cfDocuments.practice.chosen', { practice: practiceId }) : undefined} confirmed={confirmed} />
      : practiceInvalid ? <div className="space-y-6">
        <Alert variant="warning" data-testid="cf-documents-practice-invalid">{t('cfDocuments.practice.invalid')}</Alert>
        <ChooseLease />
      </div>
      : practiceId ? <PracticeDocuments key={practiceId} practiceId={practiceId} confirmed={confirmed} />
      : <ChooseLease />}
  </div>;
}
