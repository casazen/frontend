import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import type { ReportView } from './money-model';

interface ReportNotReadyProps {
  /** What the read stands for, anything but data. */
  view: Exclude<ReportView<unknown>, { kind: 'ready' }>;
  /** What failed to load, already translated ("Impossibile caricare gli incassi."). */
  errorTitle: string;
  onRetry: () => void;
  /** Offered with a 404 when a property is chosen: back to the whole scope. */
  onShowAllProperties?: () => void;
  testId: string;
}

/**
 * What a money report shows while it has no figures to show, each state said as it is: loading, "not found" (a 404: the property is not
 * one of the person's, whatever an earlier answer left in the cache), "not open to you" (a 403, in the page and not as the page of the
 * missing access) and a failure with a retry. A failure is never an empty report and never "nothing to collect".
 */
export function ReportNotReady({ view, errorTitle, onRetry, onShowAllProperties, testId }: ReportNotReadyProps) {
  const { t } = useTranslation();

  switch (view.kind) {
    case 'loading':
      return <SkeletonLine lines={4} />;
    case 'notFound':
      return (
        <Alert variant="warning" data-testid={`${testId}-not-found`}>
          <p>{t('reports.money.notFound')}</p>
          {onShowAllProperties ? (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onShowAllProperties} data-testid={`${testId}-all-properties`}>
              {t('reports.overview.filters.allProperties')}
            </Button>
          ) : null}
        </Alert>
      );
    case 'forbidden':
      return (
        <Alert variant="info" data-testid={`${testId}-forbidden`}>
          {t('reports.money.noAccess')}
        </Alert>
      );
    case 'error':
      return <ErrorState title={errorTitle} error={view.error} onRetry={onRetry} testId={`${testId}-error`} />;
  }
}
