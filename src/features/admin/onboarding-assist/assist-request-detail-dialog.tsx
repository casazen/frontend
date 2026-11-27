import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useAssistRequestDetail } from '@/queries/use-admin-onboarding-assist';
import type { AdminAssistRequest } from '@/types/onboarding.types';
import { assistRequestTitle } from '../lib/assist-request-title';
import { AssistChecklist } from './assist-checklist';

interface AssistRequestDetailDialogProps {
  request: AdminAssistRequest;
  onClose: () => void;
}

/**
 * A request of the staff queue, opened (E20/F03/US02/T01): the checklist of what support needs for each property of it, and from there the controlled opening of the credentials
 * and the store of the user of the panel. The dialog reads the request again (`GET /admin/onboarding/assist-requests/{id}`) and decides from that answer, not from the row,
 * whether the request is still open: somebody may have closed it, and the host may have reopened it, since the queue was read. A read that failed is said with a retry, never shown
 * as an empty checklist, and a 404 is «not found» whatever the cache still holds of an older read.
 */
export function AssistRequestDetailDialog({ request, onClose }: AssistRequestDetailDialogProps) {
  const { t } = useTranslation();
  const detail = useAssistRequestDetail(request.id);
  const notFound = detail.isError && getHttpStatus(detail.error) === 404;
  const failed = detail.isError && (!detail.data || notFound);
  const stale = detail.isError && !failed;
  const shown = detail.data?.request ?? request;
  const hostNote = shown.hostNote;

  let body: ReactNode;
  if (detail.isLoading) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="assist-detail-loading">
        <span className="sr-only">{t('onboardingPlan.assist.detail.loading')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (failed || !detail.data) {
    body = notFound ? (
      <ErrorState testId="assist-detail-error" title={t('onboardingPlan.assist.detail.notFound')} />
    ) : (
      <ErrorState testId="assist-detail-error" title={t('onboardingPlan.assist.detail.loadError')} error={detail.error} onRetry={() => void detail.refetch()} showSupport />
    );
  } else {
    body = (
      <>
        {stale ? (
          <p role="alert" className="text-sm text-danger-foreground" data-testid="assist-detail-stale">
            {t('onboardingPlan.assist.detail.stale')}
          </p>
        ) : null}
        <AssistChecklist request={detail.data.request} checklist={detail.data.checklist} />
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:max-w-2xl sm:overflow-y-auto" data-testid="assist-detail-dialog">
        <DialogHeader>
          <DialogTitle className="break-words leading-snug">{assistRequestTitle(shown, t)}</DialogTitle>
          <DialogDescription>{t('onboardingPlan.assist.detail.description')}</DialogDescription>
        </DialogHeader>
        {hostNote ? (
          <p className="break-words rounded-md bg-muted p-3 text-sm" data-testid="assist-detail-host-note">
            <span className="font-medium">{t('onboardingPlan.assist.row.hostNote')}</span> {hostNote}
          </p>
        ) : null}
        {body}
      </DialogContent>
    </Dialog>
  );
}
