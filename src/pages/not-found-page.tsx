import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';

/**
 * Public 404 (A8-03): an unknown address shows this page, it no longer goes to `/` and from there to the login. The
 * visitor chooses: the CasaZen area (sign-in for anonymous visitors) or the public guides.
 */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
      data-testid="not-found-page"
    >
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('notFound.description')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">{t('notFound.home')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={SEO_HUB_PATH}>{t('notFound.guides')}</Link>
        </Button>
      </div>
    </main>
  );
}
