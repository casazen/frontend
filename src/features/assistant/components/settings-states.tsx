import { useTranslation } from 'react-i18next';
import { AlertCircle, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** What stands in the place of a block of the settings while the server has not answered yet: never a form filled with defaults the server did not give. */
export function SettingsLoading({ testId = 'assistant-loading' }: { testId?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" data-testid={testId}>
      <span className="sr-only">{t('assistant.settings.loading')}</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg motion-reduce:animate-none" />
        <Skeleton className="h-10 w-full rounded-lg motion-reduce:animate-none" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** A reading that failed is told as a failure, with a way to try again: it is never shown as an empty list or as the default settings. */
export function SettingsError({ message, onRetry, testId = 'assistant-error' }: { message: string; onRetry: () => void; testId?: string }) {
  const { t } = useTranslation();
  return (
    <Alert
      variant="danger"
      icon={AlertCircle}
      data-testid={testId}
      action={
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
          {t('shared.errorFallback.tryAgain')}
        </Button>
      }
    >
      {message}
    </Alert>
  );
}

/** A 404 is «not found» whatever the cache still holds (a property of another organization, out of the person's reach, or gone). */
export function SettingsNotFound({ title, hint, testId = 'assistant-not-found' }: { title: string; hint: string; testId?: string }) {
  return (
    <div data-testid={testId}>
      <EmptyState icon={SearchX} title={title} description={hint} />
    </div>
  );
}

/** A person who may not read a block: the one sentence that says why, and nothing is asked of the server. */
export function SettingsNoAccess({ message, testId = 'assistant-no-access' }: { message: string; testId?: string }) {
  return (
    <Alert variant="info" data-testid={testId}>
      {message}
    </Alert>
  );
}
