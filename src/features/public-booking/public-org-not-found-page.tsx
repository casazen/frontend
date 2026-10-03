import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSeoMeta } from '@/lib/seo-meta';

export function PublicOrgNotFoundPage() {
  const { t } = useTranslation();
  // A booking site that does not exist is never indexed (BK-15, A3-20).
  useSeoMeta({ title: t('publicBooking.orgNotFound'), noindex: true });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t('publicBooking.orgNotFound')}</h1>
      <p className="max-w-md text-muted-foreground">
        {t('publicBooking.orgNotFoundDescription')}
      </p>
      <Button asChild variant="outline">
        <Link to="/search">{t('publicBooking.exploreOtherProperties')}</Link>
      </Button>
    </div>
  );
}
