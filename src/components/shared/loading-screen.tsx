import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  message?: string;
  /** Replaces the full-viewport height, e.g. `flex-1` inside the content region of the shell (it scrolls with the window). */
  className?: string;
}

export function LoadingScreen({ message, className }: LoadingScreenProps) {
  const { t } = useTranslation();
  const displayMessage = message ?? t('shared.loading.defaultMessage');

  return (
    <div className={cn('flex h-screen items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">{displayMessage}</p>
      </div>
    </div>
  );
}
