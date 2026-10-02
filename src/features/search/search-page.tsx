import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSearchProperties } from '@/queries/use-properties';
import { useSeoMeta } from '@/lib/seo-meta';
import { SearchFilters } from './components/search-filters';
import { SearchResults } from './components/search-results';
import { filtersFromSearchParams, filtersToSearchParams } from './search-params';
import type { SearchFiltersFormValues } from './schemas/search.schema';

/**
 * Public search across the booking sites (BK-20, A8-13), inside the public site shell: a guest never sees the host
 * console. The filters are in the URL, every result links to the property page of its org's booking site.
 */
export function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const { data, isLoading, isError, isFetching, refetch } = useSearchProperties({
    city: filters.city,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minBedrooms: filters.minBedrooms,
    minBathrooms: filters.minBathrooms,
    guests: filters.guests,
  });

  useSeoMeta({ title: t('search.page.title'), description: t('search.page.description') });

  const handleSearch = (next: SearchFiltersFormValues) => setSearchParams(filtersToSearchParams(next));
  const handleReset = () => setSearchParams(new URLSearchParams());

  const properties = data ?? [];

  return (
    <div className="space-y-6" data-testid="search-page">
      <header className="space-y-1">
        <h1 className="public-display text-3xl">{t('search.page.title')}</h1>
        <p className="text-[var(--cz-public-muted)]">{t('search.page.description')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <SearchFilters values={filters} onSearch={handleSearch} onReset={handleReset} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <p className="text-sm text-[var(--cz-public-muted)]" role="status" data-testid="search-count">
            {isLoading
              ? t('search.page.searching')
              : isError
                ? ''
                : t('search.page.results', { count: properties.length })}
          </p>
          <SearchResults
            properties={properties}
            isLoading={isLoading}
            isError={isError}
            isFetching={isFetching}
            onRetry={() => void refetch()}
            onReset={handleReset}
            guests={filters.guests}
          />
        </div>
      </div>
    </div>
  );
}
