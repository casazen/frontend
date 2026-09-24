import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { usePublishedSeoPages } from '@/queries/use-public-seo';
import { useSeoMeta } from '@/lib/seo-meta';
import { Button } from '@/components/ui/button';
import type { SeoPublishedPage } from '@/types/seo.types';

/**
 * Hub of the published SEO pages (`/p/affitti-brevi`, SE-02 / A8-02), linked from the public footer. It lists exactly
 * the pages of the sitemap, as returned by the backend: no text is written here besides the headings.
 */
export function SeoHubPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = usePublishedSeoPages();

  useSeoMeta({
    title: t('publicSeo.hub.metaTitle'),
    description: t('publicSeo.hub.metaDescription'),
    canonicalUrl: data?.canonicalUrl,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="seo-hub-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only routes of this app: the backend answers /p/... paths.
  const pages = (data?.pages ?? []).filter((page) => page.path.startsWith('/p/'));
  const guides = pages.filter((page) => page.pageType === 'ComplianceGuide');
  const calculators = pages.filter((page) => page.pageType === 'TouristTaxCalc');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="seo-hub-page">
      <h1 className="text-3xl font-bold">{t('publicSeo.hub.title')}</h1>

      {isError ? (
        <div className="mt-6 rounded-lg border border-destructive/40 p-4" role="alert" data-testid="seo-hub-error">
          <p>{t('publicSeo.hub.loadError')}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
            {t('publicSeo.hub.retry')}
          </Button>
        </div>
      ) : pages.length === 0 ? (
        <p className="mt-6 text-muted-foreground" data-testid="seo-hub-empty">
          {t('publicSeo.hub.empty')}
        </p>
      ) : (
        <>
          <HubSection heading={t('publicSeo.hub.guidesHeading')} pages={guides} testId="seo-hub-guides" />
          <HubSection
            heading={t('publicSeo.hub.calculatorsHeading')}
            pages={calculators}
            testId="seo-hub-calculators"
          />
        </>
      )}
    </main>
  );
}

interface HubSectionProps {
  heading: string;
  pages: SeoPublishedPage[];
  testId: string;
}

function HubSection({ heading, pages, testId }: HubSectionProps) {
  if (pages.length === 0) return null;

  return (
    <section className="mt-8" data-testid={testId}>
      <h2 className="text-xl font-semibold">{heading}</h2>
      <ul className="mt-3 space-y-2">
        {pages.map((page) => (
          <li key={page.path}>
            <Link to={page.path} className="underline hover:text-primary">
              {page.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
