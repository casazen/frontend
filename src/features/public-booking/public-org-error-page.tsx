import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface PublicOrgErrorPageProps {
  onRetry: () => void;
}

/**
 * The org of a public site could not be loaded for a reason other than "it does not exist" (server error, no network).
 * Not the "site not found" page: that would tell the guest the site is gone when it is only unreachable (BK-13).
 */
export function PublicOrgErrorPage({ onRetry }: PublicOrgErrorPageProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      data-testid="public-org-error"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 className="text-2xl font-semibold">{t('publicBooking.orgLoadError')}</h1>
      <p className="max-w-md text-muted-foreground">{t('publicBooking.orgLoadErrorDescription')}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {t('shared.errorFallback.tryAgain')}
      </Button>
    </div>
  );
}
