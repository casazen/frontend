import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin } from 'lucide-react';
import { useComplianceGuide } from '@/queries/use-public-seo';
import { useSeoMeta } from '@/lib/seo-meta';
import { BrandEyebrow, BrandHero } from '@/features/public-site/components/brand-hero';
import { SeoDisclaimerFooter } from './components/seo-disclaimer-footer';
import { SeoContentLanguageNote } from './components/seo-content-language-note';
import { SeoCtaBlock } from './components/seo-cta-block';
import { FeaturedProperties } from './components/featured-properties';
import { TouristTaxCalculatorWidget } from './components/tourist-tax-calculator-widget';
import { sanitizeHtml } from '@/lib/sanitize-html';

export function ComplianceGuidePage() {
  const { t } = useTranslation();
  const { region = '', comune = '' } = useParams<{ region: string; comune: string }>();
  const { data: page, isLoading, isError } = useComplianceGuide(region, comune);

  useSeoMeta(
    page
      ? {
          title: page.title,
          description: page.metaDescription,
          canonicalUrl: page.canonicalUrl,
          ogType: 'article',
        }
      : // A page that is not published or failed to load is never indexed (BK-15, A8-09: soft 404).
        isError
        ? { title: t('publicSeo.notFound'), noindex: true }
        : null,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="compliance-guide-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="mx-auto max-w-3xl py-8" data-testid="compliance-guide-not-found">
        <h1 className="text-2xl font-bold">{t('publicSeo.notFound')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('publicSeo.guideNotAvailable')}
        </p>
      </div>
    );
  }

  return (
    // Inside the `<main>` of the public shell: a second one would be a second landmark.
    <div className="mx-auto max-w-3xl" data-testid="compliance-guide-page">
      <div className="mb-6">
        <BrandHero
          eyebrow={
            <BrandEyebrow icon={<MapPin className="h-4 w-4" aria-hidden="true" />}>
              {page.comuneName} · {page.regionCode}
            </BrandEyebrow>
          }
          title={page.title}
        />
      </div>

      <SeoContentLanguageNote contentLanguage={page.contentLanguage} />

      <article
        lang={page.contentLanguage}
        className="prose prose-neutral max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.bodyHtml) }}
        data-testid="compliance-guide-body"
      />

      <TouristTaxCalculatorWidget
        comuneSlug={page.comuneSlug}
        comuneName={page.comuneName}
        rates={page.touristTaxRates ?? []}
      />

      <FeaturedProperties comuneSlug={page.comuneSlug} comuneName={page.comuneName} />

      {page.cta && <SeoCtaBlock cta={page.cta} comuneName={page.comuneName} comuneSlug={page.comuneSlug} />}
      <SeoDisclaimerFooter lastRefreshedAt={page.lastRefreshedAt} aiGenerated={page.aiGenerated} />
    </div>
  );
}
