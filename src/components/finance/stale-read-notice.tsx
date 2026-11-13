import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Over a page of the agency's money that could not refresh what it shows: the old figures stay on screen (a failed read keeps the last answer), so they say they may
 * be out of date, with a way to read again. A read that failed is never drawn as if it were in order.
 */
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
