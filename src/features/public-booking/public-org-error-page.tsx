import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';

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
    <PublicSiteState
      icon={TriangleAlert}
      role="alert"
      testId="public-org-error"
      title={t('publicBooking.orgLoadError')}
      description={t('publicBooking.orgLoadErrorDescription')}
    >
      <Button type="button" onClick={onRetry}>
        {t('shared.errorFallback.tryAgain')}
      </Button>
    </PublicSiteState>
  );
}
