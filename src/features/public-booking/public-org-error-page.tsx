import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';

interface PublicOrgErrorPageProps {
  onRetry: () => void;
}

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
