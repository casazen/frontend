import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function StaleReadNotice({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert
      variant="warning"
      data-testid="read-not-updated"
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('shared.errorState.retry')}
        </Button>
      }
    >
      {t('agencyFinance.notUpdated')}
    </Alert>
  );
}
