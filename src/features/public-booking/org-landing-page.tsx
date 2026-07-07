import { lazy, Suspense, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrgProperties } from '@/queries/use-public-org';
import { PropertySearchCard } from '@/features/search/components/property-search-card';
import type { PublicOrgDto, PublicPropertyDto } from '@/types';
import { Loader2 } from 'lucide-react';

const Hero = lazy(() => import('@/features/public-site/components/Hero').then((m) => ({ default: m.Hero })));

interface PublicBookingContext {
  org: PublicOrgDto;
}

export function OrgLandingPage() {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: properties = [], isLoading } = useOrgProperties(orgSlug);

  useEffect(() => {
    if (!isLoading && properties.length === 1) {
      const query = searchParams.toString();
      const segment = properties[0].slug?.trim() || properties[0].id;
      navigate(`/book/${orgSlug}/property/${segment}${query ? `?${query}` : ''}`, { replace: true });
    }
  }, [isLoading, properties, orgSlug, navigate, searchParams]);

  const handleViewDetails = (property: PublicPropertyDto) => {
    const query = searchParams.toString();
    const segment = property.slug?.trim() || property.id;
    navigate(`/book/${orgSlug}/property/${segment}${query ? `?${query}` : ''}`);
  };

  if (!isLoading && properties.length === 1) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cz-public-primary)]" />
      </div>
    );
  }

  const heroImage = org.heroImageUrl ?? properties[0]?.photoUrls?.[0] ?? null;

  return (
    <div className="space-y-[var(--cz-public-section-y)]">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--cz-public-radius)] bg-black/5" />}>
        <Hero
          imageUrl={heroImage}
          title={org.displayName}
          tagline={org.tagline}
          ctaLabel={properties.length > 0 ? t('publicSite.viewProperties') : undefined}
          onCta={properties.length > 0 ? () => document.getElementById('property-grid')?.scrollIntoView({ behavior: 'smooth' }) : undefined}
        />
      </Suspense>

      <section id="property-grid" className="space-y-6">
        <h2 className="public-display text-2xl font-semibold">{t('publicSite.ourProperties')}</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cz-public-primary)]" />
          </div>
        ) : properties.length === 0 ? (
          <p className="text-[var(--cz-public-muted)]">{t('publicBooking.noPropertiesPublished')}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertySearchCard key={property.id} property={property} onViewDetails={handleViewDetails} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
