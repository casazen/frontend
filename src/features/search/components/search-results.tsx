import { useTranslation } from 'react-i18next';
import { Loader2, Search, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicPropertyCard } from '@/features/public-site/components/PublicPropertyCard';
import { buildPropertyBookingPath, BOOKING_QUERY_KEYS } from '@/lib/booking-url';
import type { PublicPropertyDto } from '@/types';

interface SearchResultsProps {
  properties: PublicPropertyDto[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  onReset: () => void;
  /** Guests chosen in the filters: carried to the property page, where it is the number of guests of the stay. */
  guests?: number;
}

const SKELETON_CARDS = [0, 1, 2, 3, 4, 5];

/**
 * Where a result goes: the property page of its org's booking site. Without the org slug (an older backend) there is no
 * page to go to, so the card is shown without a link rather than with one that leads nowhere.
 */
export function propertyResultPath(property: PublicPropertyDto, guests?: number) {
  if (!property.orgSlug) return undefined;
  return {
    pathname: buildPropertyBookingPath(property.orgSlug, property),
    search: guests ? new URLSearchParams({ [BOOKING_QUERY_KEYS.guests]: String(guests) }).toString() : '',
  };
}

/** Results of the public search with their own loading, error and empty states: a failed request is never "no results". */
export function SearchResults({ properties, isLoading, isError, isFetching, onRetry, onReset, guests }: SearchResultsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="search-loading">
        <span className="sr-only">{t('search.page.searching')}</span>
        {SKELETON_CARDS.map((key) => (
          <div key={key} className="public-site-card overflow-hidden" aria-hidden>
            <div className="aspect-[4/3] animate-pulse bg-black/5" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-black/10" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-black/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        data-testid="search-error"
        className="public-site-card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cz-public-primary-text)]" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{t('search.results.errorTitle')}</p>
            <p className="text-sm text-[var(--cz-public-muted)]">{t('search.results.errorDescription')}</p>
          </div>
        </div>
        <Button type="button" className="public-site-cta shrink-0 border-0" disabled={isFetching} onClick={onRetry} data-testid="search-retry">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t('shared.errorFallback.tryAgain')}
        </Button>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div
        data-testid="search-empty"
        className="public-site-card flex flex-col items-center gap-3 px-6 py-12 text-center"
      >
        <Search className="h-8 w-8 text-[var(--cz-public-muted)]" aria-hidden />
        <p className="font-medium">{t('search.results.noProperties')}</p>
        <p className="max-w-sm text-sm text-[var(--cz-public-muted)]">{t('search.results.noPropertiesDesc')}</p>
        <Button type="button" variant="outline" onClick={onReset} data-testid="search-empty-reset">
          {t('search.filters.reset')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="search-results">
      {properties.map((property) => (
        <PublicPropertyCard key={property.id} property={property} to={propertyResultPath(property, guests)} />
      ))}
    </div>
  );
}
