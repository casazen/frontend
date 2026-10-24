import { Navigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { BackLink } from '@/components/shared/back-link';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { useLeaseDraft } from '@/queries/use-lease-draft';
import { LeaseWizard } from './wizard/lease-wizard';

const LEASES_PATH = '/app/long-rent/leases';

/**
 * «Continua il contratto» (LR-06a), `/app/long-rent/leases/:id/edit`: the wizard on a draft that exists on the server. The draft is
 * read when the page opens (the same from any device) and the wizard opens on the first step that is not done. A lease that is not a
 * draft any more (signed, registered) has its sheet instead. The title is the same for every contract: no name of a person is in the
 * title of the tab.
 */
export function LeaseWizardPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const draft = useLeaseDraft(id);

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

  if (draft.isLoading || !draft.data) {
    return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="lease-wizard-page">
      <BackLink to={LEASES_PATH} label={t('nav.leases')} className="md:inline-flex" />
      <PageHeader title={t('leaseWizard.title')} />
      {/* A new key for each reading of the draft: after a conflict, reading it again gives a wizard that starts from what was saved. */}
      <LeaseWizard key={draft.dataUpdatedAt} draft={draft.data} onReload={() => void draft.refetch()} />
    </div>
  );
}
