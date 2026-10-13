import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BedDouble, Home, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFeaturedProperties } from '@/queries/use-public-seo';
import { buildPropertyBookingPath } from '@/lib/booking-url';
import { getProblemMessage } from '@/lib/api-errors';
import type { FeaturedProperty } from '@/types/seo.types';

interface FeaturedPropertiesProps {
  comuneSlug: string;
  comuneName: string;
}

function formatPrice(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
}

function PropertyCard({ property }: { property: FeaturedProperty }) {
  const { t, i18n } = useTranslation();
  const bookingPath = buildPropertyBookingPath(property.orgSlug, property);

  return (
    <li data-testid="featured-property">
      <Card className="h-full overflow-hidden">
        {property.photoUrl ? (
          <img
            src={property.photoUrl}
            alt={property.name}
            loading="lazy"
            className="h-40 w-full object-cover"
            data-testid="featured-property-photo"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground" aria-hidden>
            <Home className="h-8 w-8" />
          </div>
        )}
        <CardContent className="space-y-2 p-4">
          <h3 className="font-semibold">{property.name}</h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BedDouble className="h-4 w-4" aria-hidden />
              {property.bedrooms === 0 ? t('publicSeo.featured.studio') : t('publicSeo.featured.bedrooms', { count: property.bedrooms })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden />
              {t('publicSeo.featured.guests', { count: property.maxGuests })}
            </span>
          </p>
          <p className="text-sm">{t('publicSeo.featured.fromPerNight', { price: formatPrice(property.nightlyRate, i18n.language) })}</p>
          <Button asChild size="sm" className="w-full">
            <Link to={bookingPath} data-testid="featured-property-link">
              {t('publicSeo.featured.viewAndBook')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}

/**
 * Bookable properties of the comune of an SEO page (SE-04, #300 AC2, A8-10): only properties the public site really
 * shows (active, not paused, compliance activated), each linking to its page on the host's booking site. Loading, error
 * (with retry: a failed request is not "no properties") and empty states.
 */
export function FeaturedProperties({ comuneSlug, comuneName }: FeaturedPropertiesProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching } = useFeaturedProperties(comuneSlug);

  return (
    <section className="my-8 space-y-4" aria-labelledby="featured-properties-heading" data-testid="featured-properties">
      <h2 id="featured-properties-heading" className="text-xl font-semibold">
        {t('publicSeo.featured.title', { comuneName })}
      </h2>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="featured-properties-loading" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('publicSeo.featured.loading')}
        </p>
      ) : isError ? (
        <div className="space-y-2" role="alert" data-testid="featured-properties-error">
          <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('publicSeo.featured.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {t('publicSeo.featured.retry')}
          </Button>
        </div>
      ) : !data || data.properties.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="featured-properties-empty">
          {t('publicSeo.featured.empty', { comuneName })}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </ul>
      )}
    </section>
  );
}
