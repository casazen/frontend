import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calculator, Loader2, MapPin, type LucideIcon } from 'lucide-react';
import { usePublishedSeoPages } from '@/queries/use-public-seo';
import { useSeoMeta } from '@/lib/seo-meta';
import { Button } from '@/components/ui/button';
import { BrandHero } from '@/features/public-site/components/brand-hero';
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
    // A hub that failed to load or lists nothing is as thin as the empty guides: not indexed (BK-15, like the sitemap).
    noindex: isError || (data !== undefined && data.pages.length === 0),
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
    // Inside the `<main>` of the public shell: a second one would be a second landmark.
    <div className="mx-auto max-w-4xl space-y-8" data-testid="seo-hub-page">
      <BrandHero title={t('publicSeo.hub.title')} />

      {isError ? (
        <div className="mt-6 rounded-lg border border-destructive/40 p-4" role="alert" data-testid="seo-hub-error">
          <p>{t('publicSeo.hub.loadError')}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
            {t('publicSeo.hub.retry')}
          </Button>
        </div>
      ) : pages.length === 0 ? (
        <p className="text-muted-foreground" data-testid="seo-hub-empty">
          {t('publicSeo.hub.empty')}
        </p>
      ) : (
        <>
          <HubSection heading={t('publicSeo.hub.guidesHeading')} pages={guides} testId="seo-hub-guides" icon={MapPin} />
          <HubSection
            heading={t('publicSeo.hub.calculatorsHeading')}
            pages={calculators}
            testId="seo-hub-calculators"
            icon={Calculator}
          />
        </>
      )}
    </div>
  );
}

interface HubSectionProps {
  heading: string;
  pages: SeoPublishedPage[];
  testId: string;
  icon: LucideIcon;
}

/**
 * The pages of one kind as cards: the title is the link (a whole-card link, so the card opens in a new tab and a screen
 * reader reads the title alone), the comune sits next to it.
 */
function HubSection({ heading, pages, testId, icon: Icon }: HubSectionProps) {
  if (pages.length === 0) return null;

  return (
    <section data-testid={testId}>
      <h2 className="public-display text-xl">{heading}</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <li
            key={page.path}
            // `items-start`: the icon and the title start at the top of the card, so that a title on two lines in one card does not
            // put the text of its neighbour, centered in a taller card, at another height.
            className="public-site-card relative flex items-start gap-3 p-4 transition-shadow focus-within:ring-2 focus-within:ring-[var(--cz-public-primary-text)] hover:shadow-[var(--cz-public-shadow-widget)] motion-reduce:transition-none"
          >
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--cz-brand-tint)] text-[var(--cz-brand-tint-text)]"
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Link
                to={page.path}
                className="font-semibold outline-none after:absolute after:inset-0 hover:text-[var(--cz-public-primary-text)]"
              >
                {page.title}
              </Link>
              <p className="text-sm text-[var(--cz-public-muted)]">{page.comuneName}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
