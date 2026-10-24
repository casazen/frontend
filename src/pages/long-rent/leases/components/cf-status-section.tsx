import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CfStatusBadge } from '@/components/cf-status-badge';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useCfStatus } from '@/queries/use-concordatofacile';
import { formatDateTime } from '@/lib/utils';
import type { CfPracticeResponse } from '@/types/concordatofacile.types';

export interface CfStatusSectionProps {
  /** Lease ID to fetch status for. */
  leaseId: string;
}

/**
 * Displays CF practice status for a lease (ADR-008-R15 through ADR-008-R20).
 * Shows all practices with status, dates, and warnings for stale data or municipality mismatch.
 */
export function CfStatusSection({ leaseId }: CfStatusSectionProps) {
  const { t } = useTranslation();
  const statusQuery = useCfStatus(leaseId);

  if (statusQuery.isLoading) {
    return <LoadingScreen message={t('concordatofacile.status.loading')} />;
  }

  if (statusQuery.isError) {
    return (
      <div data-testid="cf-status-error">
        <ErrorState title={t('concordatofacile.status.errorMessage')} error={statusQuery.error} />
      </div>
    );
  }

  if (!statusQuery.data) {
    return <LoadingScreen message={t('concordatofacile.status.loading')} />;
  }

  const { practices, lastCheckedAt, stale } = statusQuery.data;

  return (
    <Card data-testid="cf-status-section">
      <CardHeader>
        <CardTitle>{t('concordatofacile.status.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stale warning (ADR-008-R17) */}
        {stale && (
          <Alert variant="warning" role="alert">
            <AlertTriangle className="size-4" />
            <div>
              <p className="font-semibold">{t('concordatofacile.status.staleWarning')}</p>
              <p className="mt-1 text-sm">{t('concordatofacile.status.staleExplanation')}</p>
            </div>
          </Alert>
        )}

        {/* Last check date (ADR-008-R19) */}
        <div className="text-sm text-muted-foreground" data-testid="cf-last-check">
          {t('concordatofacile.status.lastCheck')}: {formatDateTime(lastCheckedAt)}
        </div>

        {/* Practices list */}
        {practices.length === 0 ? (
          <Alert>
            <Info className="size-4" />
            {t('concordatofacile.status.noPractices')}
          </Alert>
        ) : (
          <div className="space-y-3">
            {practices.map((practice: CfPracticeResponse) => (
              <div
                key={practice.practiceId}
                data-testid="cf-practice-item"
                className="rounded-lg border p-4 space-y-2"
              >
                {/* Practice ID and status */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {t('concordatofacile.status.practiceId')}: {practice.practiceId}
                    </p>
                    {practice.comune && (
                      <p className="text-sm text-muted-foreground">
                        {t('concordatofacile.status.comune')}: {practice.comune}
                      </p>
                    )}
                  </div>
                  <CfStatusBadge status={practice.status} />
                </div>

                {/* Status changed date (ADR-008-R19) */}
                <div className="text-sm text-muted-foreground">
                  {t('concordatofacile.status.statusChangedAt')}: {formatDateTime(practice.statusChangedAt)}
                </div>

                {/* Close reason */}
                {practice.closeReason && (
                  <div className="text-sm">
                    {t('concordatofacile.status.closeReason')}: {practice.closeReason}
                  </div>
                )}

                {/* Municipality mismatch warning (ADR-008-R20) */}
                {practice.comuneDiffersFromLink && (
                  <Alert variant="warning" data-testid="cf-comune-warning">
                    <AlertTriangle className="size-4" />
                    {t('concordatofacile.status.comuneMismatch')}
                  </Alert>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
