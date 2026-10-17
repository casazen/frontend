import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { getAmenityLabel } from '@/lib/i18n-labels';

interface PropertyAmenitiesGridProps {
  amenities: string[];
}

/** What the property has, as a plain section: a title and the list, without a box. Nothing when the property has nothing listed. */
export function PropertyAmenitiesGrid({ amenities }: PropertyAmenitiesGridProps) {
  const { t } = useTranslation();

  if (!amenities.length) return null;

  return (
    <PlainSection title={t('property.form.amenities.title')}>
      <ul role="list" className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {amenities.map((amenity) => (
          <li key={amenity} className="flex min-w-0 items-center gap-2 text-sm">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
            <span className="min-w-0 break-words">{getAmenityLabel(amenity, t)}</span>
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}
