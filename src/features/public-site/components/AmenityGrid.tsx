import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AMENITY_GROUPS, listAmenities, type DescribedAmenity } from '@/lib/public-amenities';

/** More than this many amenities and the list is cut to the first `SHOWN`, with a button for the rest. */
const COLLAPSE_FROM = 10;
const SHOWN = 8;

interface AmenityGridProps {
  /** The `PropertyAmenity` names the backend sends (or any text the host wrote: it is shown readable either way). */
  amenities: string[];
}

function AmenityList({ items, label }: { items: DescribedAmenity[]; label: (amenity: DescribedAmenity) => string }) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((amenity) => {
        const Icon = amenity.icon;
        return (
          <li key={amenity.id} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cz-public-primary-text)]" aria-hidden />
            <span className="min-w-0 break-words">{label(amenity)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function AmenityGrid({ amenities }: AmenityGridProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const items = useMemo(() => listAmenities(amenities), [amenities]);

  if (items.length === 0) return null;

  const label = (amenity: DescribedAmenity) => (amenity.labelKey ? t(amenity.labelKey) : amenity.fallbackLabel);
  const collapsible = items.length > COLLAPSE_FROM;

  return (
    <div className="space-y-5" data-testid="property-amenities">
      <div id={listId}>
        {collapsible && expanded ? (
          <div className="space-y-6">
            {AMENITY_GROUPS.map((group) => {
              const members = items.filter((amenity) => amenity.group === group.id);
              if (members.length === 0) return null;
              return (
                <section key={group.id} className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--cz-public-muted)]">{t(group.labelKey)}</h3>
                  <AmenityList items={members} label={label} />
                </section>
              );
            })}
          </div>
        ) : (
          <AmenityList items={collapsible ? items.slice(0, SHOWN) : items} label={label} />
        )}
      </div>

      {collapsible ? (
        <Button
          type="button"
          variant="outline"
          aria-expanded={expanded}
          aria-controls={listId}
          iconRight={<ChevronDown className={expanded ? 'rotate-180' : undefined} />}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? t('publicProperty.amenitiesLess') : t('publicProperty.amenitiesAll', { total: items.length })}
        </Button>
      ) : null}
    </div>
  );
}
