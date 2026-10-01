import { useEffect } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Loader2, TriangleAlert } from 'lucide-react';
import { useOrgProperties } from '@/queries/use-public-org';
import { Hero } from '@/features/public-site/components/Hero';
import { PublicPropertyCard } from '@/features/public-site/components/PublicPropertyCard';
import { Button } from '@/components/ui/button';
import type { PublicOrgDto } from '@/types';
import { displayableMediaUrls } from '@/lib/media-url';
import { buildPropertyBookingPath } from '@/lib/booking-url';

interface PublicBookingContext {
  org: PublicOrgDto;
}

const SKELETON_CARDS = [0, 1, 2];

/**
 * Landing of an org's public site: cover and property list. The list has its own loading, error and empty states: a
 * failed request is an error with a retry, never "no property published" (BK-13, A3-35).
 */
export function OrgLandingPage() {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: properties = [], isLoading, isError, isFetching, refetch } = useOrgProperties(orgSlug);
  const search = searchParams.toString();

  useEffect(() => {
    if (!isLoading && !isError && properties.length === 1) {
      navigate({ pathname: buildPropertyBookingPath(orgSlug ?? '', properties[0]), search }, { replace: true });
    }
  }, [isLoading, isError, properties, orgSlug, navigate, search]);

  if (!isLoading && !isError && properties.length === 1) {
    return (
      <div className="flex justify-center py-12" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cz-public-primary-text)]" aria-hidden />
        <span className="sr-only">{t('publicSite.loading')}</span>
      </div>
    );
  }

  const heroImage = org.heroImageUrl ?? displayableMediaUrls(properties[0]?.photoUrls)[0] ?? null;
  const hasProperties = properties.length > 0;

  return (
    <div className="space-y-[var(--cz-public-section-y)]">
      <Hero
        imageUrl={heroImage}
        title={org.displayName}
        tagline={org.tagline}
        ctaLabel={hasProperties ? t('publicSite.viewProperties') : undefined}
        onCta={hasProperties ? () => document.getElementById('property-grid')?.scrollIntoView({ behavior: 'smooth' }) : undefined}
      />

      <section id="property-grid" className="space-y-6" aria-labelledby="property-grid-title">
        <h2 id="property-grid-title" className="public-display text-2xl">
          {t('publicSite.ourProperties')}
        </h2>

        {isLoading ? (
          <div
            role="status"
            aria-busy="true"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="landing-properties-loading"
          >
            <span className="sr-only">{t('publicSite.loadingProperties')}</span>
            {SKELETON_CARDS.map((key) => (
              <div key={key} className="public-site-card overflow-hidden" aria-hidden>
                <div className="aspect-[4/3] animate-pulse bg-black/5" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-black/10" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-black/5" />
                  <div className="h-4 w-full animate-pulse rounded bg-black/5" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            data-testid="landing-properties-error"
            className="public-site-card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cz-public-primary-text)]" aria-hidden />
              <div className="space-y-1">
                <p className="font-medium">{t('publicSite.propertiesError.title')}</p>
                <p className="text-sm text-[var(--cz-public-muted)]">{t('publicSite.propertiesError.description')}</p>
              </div>
            </div>
            <Button
              type="button"
              className="public-site-cta shrink-0 border-0"
              disabled={isFetching}
              onClick={() => void refetch()}
              data-testid="landing-properties-retry"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t('shared.errorFallback.tryAgain')}
            </Button>
          </div>
        ) : !hasProperties ? (
          <div
            data-testid="landing-properties-empty"
            className="public-site-card flex flex-col items-center gap-2 px-6 py-12 text-center"
          >
            <Home className="h-8 w-8 text-[var(--cz-public-muted)]" aria-hidden />
            <p className="font-medium">{t('publicBooking.noPropertiesPublished')}</p>
            <p className="max-w-md text-sm text-[var(--cz-public-muted)]">{t('publicSite.emptyProperties.description')}</p>
            {org.contactEmail ? (
              <a href={`mailto:${org.contactEmail}`} className="public-site-link text-sm" data-testid="landing-empty-contact">
                {t('publicSite.emptyProperties.contact', { email: org.contactEmail })}
              </a>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PublicPropertyCard
                key={property.id}
                property={property}
                to={{ pathname: buildPropertyBookingPath(orgSlug ?? '', property), search }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
