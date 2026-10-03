import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';

interface ErrorStateProps {
  /** What failed to load, already translated ("Impossibile caricare ..."). */
  title: string;
  /** The error of the failed query: its server message (localized by the API) is shown under the title when there is one. */
  error?: unknown;
  /** Reloads the data: the "Riprova" button is shown only with it. */
  onRetry?: () => void;
  testId?: string;
}

/**
 * Error of a failed load: an API error is never shown as an empty list or an endless spinner (SU-06, A4-25). Announced to
 * screen readers (`role="alert"`) and offers a retry.
 */
export function ErrorState({ title, error, onRetry, testId = 'error-state' }: ErrorStateProps) {
  const { t } = useTranslation();
  const detail = error === undefined ? undefined : getProblemMessage(error, t);

  return (
    <div
      role="alert"
      data-testid={testId}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 p-8 text-center"
    >
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('shared.errorState.retry')}
        </Button>
      )}
    </div>
  );
}
