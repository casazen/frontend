import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SearchFilters } from './components/search-filters';
import { SearchResults } from './components/search-results';
import { useSearchProperties } from '@/queries/use-properties';
import type { SearchFiltersFormValues } from './schemas/search.schema';
import type { PublicPropertyDto } from '@/types';

export function SearchPage() {
  const [filters, setFilters] = useState<SearchFiltersFormValues>({});
  const { data, isLoading } = useSearchProperties(filters);

  const handleSearch = (newFilters: SearchFiltersFormValues) => {
    setFilters(newFilters);
  };

  const handleReset = () => {
    setFilters({});
  };

  const handleViewDetails = (property: PublicPropertyDto) => {
    // In a real app, this would navigate to a public property detail page
    console.log('View property details:', property);
  };

  const properties = data ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Search Properties"
          description="Find your perfect vacation rental"
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <SearchFilters onSearch={handleSearch} onReset={handleReset} />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                {isLoading ? 'Searching...' : `${properties.length} properties found`}
              </p>
            </div>
            <SearchResults
              properties={properties}
              isLoading={isLoading}
              onViewDetails={handleViewDetails}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
