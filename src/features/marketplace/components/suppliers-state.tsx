import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';

/** The suppliers are on their way. */
export function SuppliersLoading() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
      <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      {t('marketplace.loading')}
    </div>
  );
}

/** The suppliers could not be loaded: said as it is (never as an empty list), with a way to try again. */
export function SuppliersError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 py-4" role="alert" data-testid="marketplace-suppliers-error">
      <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('marketplace.suppliersLoadError')}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        {t('serviceRequest.retry')}
      </Button>
    </div>
  );
}
