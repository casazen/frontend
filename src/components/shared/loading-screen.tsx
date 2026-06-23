import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { t } = useTranslation();
  const displayMessage = message ?? t('shared.loading.defaultMessage');

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">{displayMessage}</p>
      </div>
    </div>
  );
}
