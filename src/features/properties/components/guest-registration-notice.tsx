import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface RefreshFailedNoticeProps {
  onRetry: () => void;
  retrying?: boolean;
  testId: string;
}

export function RefreshFailedNotice({ onRetry, retrying = false, testId }: RefreshFailedNoticeProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2" role="alert" data-testid={testId}>
      <p className="text-sm text-foreground/70">{t('guestRegistration.card.refreshFailed')}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} loading={retrying}>
        {t('guestRegistration.card.retry')}
      </Button>
    </div>
  );
}
