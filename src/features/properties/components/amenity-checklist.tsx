import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAmenityCatalog, useAmenityLabels } from '@/queries/use-amenity-catalog';

interface AmenityChecklistProps {
  selected: readonly string[];
  onToggle: (amenity: string) => void;
}

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
