import { useTranslation } from 'react-i18next';
import { createElement } from 'react';
import { Check } from 'lucide-react';
import { describeAmenity } from '@/lib/public-amenities';
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
      <ul role="list" className="grid gap-x-4 sm:grid-cols-2">
        {amenities.map((amenity) => (
          <li key={amenity} className="flex min-h-12 min-w-0 items-center gap-3 border-b py-2 text-sm">
            {createElement(describeAmenity(amenity)?.icon ?? Check, { 'aria-hidden': true, className: 'size-5 shrink-0 text-foreground' })}
            <span className="min-w-0 break-words">{amenityLabel(amenity)}</span>
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}
