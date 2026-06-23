import { useTranslation } from 'react-i18next';
import { PropertySearchCard } from './property-search-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import type { PublicPropertyDto } from '@/types';

interface SearchResultsProps {
  properties: PublicPropertyDto[];
  isLoading?: boolean;
  onViewDetails: (property: PublicPropertyDto) => void;
}

export function SearchResults({ properties, isLoading, onViewDetails }: SearchResultsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title={t('search.results.noProperties')}
        description={t('search.results.noPropertiesDesc')}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => (
        <PropertySearchCard
          key={property.id}
          property={property}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
