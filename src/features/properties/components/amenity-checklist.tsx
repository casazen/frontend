import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAmenityCatalog, useAmenityLabels } from '@/queries/use-amenity-catalog';

interface AmenityChecklistProps {
  /** The amenities the property has. */
  selected: readonly string[];
  onToggle: (amenity: string) => void;
}

/**
 * The amenities of the property as checkboxes, for the form that edits it. What can be chosen and how it is called come from the
 * catalog of the amenities (NF-33), the one source of both; while the catalog is not there the amenities the property already has stay
 * on screen, and so does one the catalog does not know (nothing the property has is hidden, or taken away by a save).
 */
export function AmenityChecklist({ selected, onToggle }: AmenityChecklistProps) {
  const catalog = useAmenityCatalog();
  const amenityLabel = useAmenityLabels();
  const names = [...new Set([...(catalog.data?.amenities.map((amenity) => amenity.name) ?? []), ...selected])];

  return (
    <div className="grid grid-cols-2 gap-4 @xl:grid-cols-3 @3xl:grid-cols-4">
      {names.map((amenity) => (
        <div key={amenity} className="flex items-center space-x-2">
          <Checkbox id={`amenity-${amenity}`} checked={selected.includes(amenity)} onCheckedChange={() => onToggle(amenity)} />
          <Label htmlFor={`amenity-${amenity}`} className="cursor-pointer text-sm">
            {amenityLabel(amenity)}
          </Label>
        </div>
      ))}
    </div>
  );
}
