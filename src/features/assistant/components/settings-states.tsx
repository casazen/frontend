import { useTranslation } from 'react-i18next';
import { AlertCircle, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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

export function SettingsNotFound({ title, hint, testId = 'assistant-not-found' }: { title: string; hint: string; testId?: string }) {
  return (
    <div data-testid={testId}>
      <EmptyState icon={SearchX} title={title} description={hint} />
    </div>
  );
}

export function SettingsNoAccess({ message, testId = 'assistant-no-access' }: { message: string; testId?: string }) {
  return (
    <Alert variant="info" data-testid={testId}>
      {message}
    </Alert>
  );
}
