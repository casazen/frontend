import { useTranslation } from 'react-i18next';
import { PropertyCard } from './property-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Home } from 'lucide-react';
import type { Property } from '@/types';

interface PropertiesListProps {
  properties: Property[];
  isLoading?: boolean;
  onEdit?: (property: Property) => void;
  onDelete?: (property: Property) => void;
  onView?: (property: Property) => void;
  onAdd?: () => void;
}

export function PropertiesList({
  properties,
  isLoading,
  onEdit,
  onDelete,
  onView,
  onAdd,
}: PropertiesListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <EmptyState
        icon={Home}
        title={t('property.page.emptyTitle')}
        description={t('property.page.emptyDescription')}
        action={onAdd ? { label: t('property.page.emptyCta'), onClick: onAdd } : undefined}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  );
}
