import { useTranslation } from 'react-i18next';
import { useAppShell } from '@/components/layout/app-shell-context';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message, className }: LoadingScreenProps) {
  const { t } = useTranslation();
  const displayMessage = message ?? t('shared.loading.defaultMessage');
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
