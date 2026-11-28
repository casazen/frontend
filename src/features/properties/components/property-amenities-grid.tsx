import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ConciergeBell } from 'lucide-react';
import { InfoCard } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { describeAmenity } from '@/lib/public-amenities';
import { useAmenityLabels } from '@/queries/use-amenity-catalog';

interface PropertyAmenitiesGridProps {
  amenities: string[];
}

const SHOWN = 8;
const AMENITY_ICON = 'size-4 shrink-0 text-foreground/70';

export function PropertyAmenitiesGrid({ amenities }: PropertyAmenitiesGridProps) {
  const { t } = useTranslation();
  const amenityLabel = useAmenityLabels();
  const [all, setAll] = useState(false);

  if (!amenities.length) return null;

  const hidden = amenities.length - SHOWN;
  const shown = all ? amenities : amenities.slice(0, SHOWN);

  return (
    <InfoCard icon={ConciergeBell} title={t('property.form.amenities.title')} data-testid="property-amenities">
      <ul role="list" className="flex flex-wrap gap-2">
        {shown.map((amenity) => (
          <li key={amenity} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
            {createElement(describeAmenity(amenity)?.icon ?? Check, { 'aria-hidden': true, className: AMENITY_ICON })}
            <span className="min-w-0 break-words">{amenityLabel(amenity)}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <div>
          <Button type="button" variant="ghost" size="sm" className="-ms-2 min-h-11 px-2 text-primary-text" aria-expanded={all} onClick={() => setAll((value) => !value)} data-testid="property-amenities-toggle">
            {all ? t('property.detail.amenitiesLess') : t('property.detail.amenitiesMore', { count: hidden })}
          </Button>
        </div>
      ) : null}
    </InfoCard>
  );
}
