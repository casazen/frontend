import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { useAmenityLabels } from '@/queries/use-amenity-catalog';

interface PropertyAmenitiesGridProps {
  amenities: string[];
}

/**
 * What the property has, as a plain section: a title and the list, without a box. Nothing when the property has nothing listed. The
 * names are the labels of the catalog of the amenities (NF-33), the one source of them.
 */
export function PropertyAmenitiesGrid({ amenities }: PropertyAmenitiesGridProps) {
  const { t } = useTranslation();
  const amenityLabel = useAmenityLabels();

  if (!amenities.length) return null;

  return (
    <PlainSection title={t('property.form.amenities.title')}>
      <ul role="list" className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {amenities.map((amenity) => (
          <li key={amenity} className="flex min-w-0 items-center gap-2 text-sm">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
            <span className="min-w-0 break-words">{amenityLabel(amenity)}</span>
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}
