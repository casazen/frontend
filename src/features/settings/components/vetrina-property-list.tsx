import { useTranslation } from 'react-i18next';
import { Loader2, Home } from 'lucide-react';
import { VetrinaPropertyRow } from './vetrina-property-row';
import type { Property } from '@/types';

interface VetrinaPropertyListProps {
  properties: Property[];
  isLoading: boolean;
  orgSlug: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VetrinaPropertyList({
  properties,
  isLoading,
  orgSlug,
  selectedId,
  onSelect,
}: VetrinaPropertyListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Home className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('directBooking.noProperties')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="vetrina-property-list">
      {properties.map((property) => (
        <VetrinaPropertyRow
          key={property.id}
          property={property}
          orgSlug={orgSlug}
          isSelected={selectedId === property.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
