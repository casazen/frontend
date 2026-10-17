import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';
import { useSeoMeta } from '@/lib/seo-meta';

/** The booking site does not exist. Inside the frame of the site (`PublicSiteShell`) and, for an unknown address, alone. */
export function PublicOrgNotFoundPage() {
  const { t } = useTranslation();
  // A booking site that does not exist is never indexed (BK-15, A3-20).
  useSeoMeta({ title: t('publicBooking.orgNotFound'), noindex: true });

  return (
    <PublicSiteState
      icon={SearchX}
      testId="public-org-not-found"
      title={t('publicBooking.orgNotFound')}
      description={t('publicBooking.orgNotFoundDescription')}
    >
      <Button asChild>
        <Link to="/search">{t('publicBooking.exploreOtherProperties')}</Link>
      </Button>
    </PublicSiteState>
  );
}
