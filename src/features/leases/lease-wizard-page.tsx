import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { BackLink } from '@/components/shared/back-link';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { useDraftReading, useLandlordDefaults, useLeaseDraft, useLongRentRules } from '@/queries/use-lease-draft';
import { LeaseWizard } from './wizard/lease-wizard';
import { SignedWizard } from './wizard/signed-wizard';
import { AFTER_STEP, DONE_STEP } from './wizard/wizard-model';

const LEASES_PATH = '/app/long-rent/leases';

/** The wizard on a draft that exists on the server: the draft is read when the page opens, and the wizard opens on the first step not done. */
function DraftWizard({ id }: { id: string }) {
  const { t } = useTranslation();
  const draft = useLeaseDraft(id);
  const rules = useLongRentRules();
  // A draft with no landlord yet starts from the landlord the server suggests (not waiting for it if it cannot be read).
  const needsLandlord = draft.data !== undefined && draft.data.values.landlords.length === 0;
  const landlord = useLandlordDefaults(needsLandlord);
  // The contract the person uploaded to be read (NL-DOCS): asked about while it is being read, then once. When it ends while the wizard is
  // open the draft is NOT read again here: the wizard says so and brings the values in when the person asks (NL-DOCS-FU8).
  const reading = useDraftReading(id, draft.data?.origin === 'Imported');

  if (draft.isError) {
    const status = getHttpStatus(draft.error);
    const code = isAxiosError(draft.error) ? getProblemCode(draft.error.response?.data) : undefined;
    // No longer a draft: the page of the lease is the one to show.
    if (status === 404 && code === 'lease_not_draft') return <Navigate to={`${LEASES_PATH}/${id}`} replace />;
    if (status === 404) {
      return (
        <div data-testid="lease-not-found">
          <EmptyState icon={FileText} title={t('leases.notFound')} description={t('leases.notFoundDescription')} action={{ label: t('leases.backToList'), href: LEASES_PATH }} />
        </div>
      );
    }
    return (
      <div className="min-w-0 space-y-4">
        <BackLink to={LEASES_PATH} label={t('nav.leases')} className="md:inline-flex" />
        <ErrorState testId="lease-load-error" title={t('leases.detailLoadError')} error={draft.error} onRetry={() => void draft.refetch()} />
      </div>
    );
  }

  if (draft.isLoading || rules.isLoading || (needsLandlord && landlord.isLoading)) {
    return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;
  }

  if (rules.isError || !rules.data || !draft.data) {
    return (
      <div className="min-w-0 space-y-4">
        <BackLink to={LEASES_PATH} label={t('nav.leases')} className="md:inline-flex" />
        <ErrorState testId="lease-wizard-error" title={t('leaseWizard.loadError')} error={rules.error} onRetry={() => void rules.refetch()} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="lease-wizard-page">
      <BackLink to={LEASES_PATH} label={t('nav.leases')} className="md:inline-flex" />
      <PageHeader title={t('leaseWizard.title')} />
      {/* A new key for each reading of the draft: after a conflict, reading it again gives a wizard that starts from what was saved. */}
      <LeaseWizard
        key={draft.dataUpdatedAt}
        draft={draft.data}
        defaults={landlord.data ?? null}
        rules={rules.data}
        onReload={() => void draft.refetch()}
        reading={reading.data ?? null}
      />
    </div>
  );
}

/**
 * «Continua il contratto» (LR-06a, LR-06b), `/app/long-rent/leases/:id/edit`: the wizard of a contract. While the lease is a draft it is
 * read from the server and the wizard opens on the first step that is not done, the same from any device; a lease that is not a draft
 * any more (signed, registered) has its sheet instead. The two last parts, «Dopo la firma» (`?step=8`) and the final screen
 * (`?step=done`), belong to a lease that is signed, so they read the lease. The title is the same for every contract: no name of a
 * person is in the title of the tab.
 */
export function LeaseWizardPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const step = searchParams.get('step');

  if (step === String(AFTER_STEP) || step === DONE_STEP) {
    return (
      <div className="min-w-0 space-y-6" data-testid="lease-signed-wizard-page">
        <BackLink to={LEASES_PATH} label={t('nav.leases')} className="md:inline-flex" />
        <PageHeader title={t('leaseWizard.title')} />
        <SignedWizard leaseId={id} view={step === DONE_STEP ? 'done' : 'after'} />
      </div>
    );
  }

  return <DraftWizard id={id} />;
}
