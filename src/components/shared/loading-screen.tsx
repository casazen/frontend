import { useTranslation } from 'react-i18next';
import { useAppShell } from '@/components/layout/app-shell-context';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  message?: string;
  /** Replaces the height chosen for the current place (the content region inside the shell, the viewport outside it). */
  className?: string;
}

export function LoadingScreen({ message, className }: LoadingScreenProps) {
  const { t } = useTranslation();
  const displayMessage = message ?? t('shared.loading.defaultMessage');
  // The shell scrolls with the window (UI-03). `h-screen` inside `main` is a full viewport under the header, so the
  // window scrolls during load and the spinner sits below the header. Fill the content region instead.
  const inShell = useAppShell() !== null;

  return (
    <div className={cn('flex items-center justify-center', inShell ? 'h-auto flex-1' : 'h-screen', className)}>
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">{displayMessage}</p>
      </div>
    </div>
  );
}
