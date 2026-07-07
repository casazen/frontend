import { Bath, Car, Coffee, Dumbbell, Tv, Utensils, Waves, Wifi, Wind, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  'wi-fi': Wifi,
  parking: Car,
  parcheggio: Car,
  pool: Waves,
  piscina: Waves,
  kitchen: Utensils,
  cucina: Utensils,
  ac: Wind,
  'aria condizionata': Wind,
  tv: Tv,
  gym: Dumbbell,
  palestra: Dumbbell,
  breakfast: Coffee,
  colazione: Coffee,
  bathroom: Bath,
};

function iconForAmenity(label: string): LucideIcon {
  const key = label.toLowerCase();
  return AMENITY_ICONS[key] ?? Check;
}

interface AmenityGridProps {
  amenities: string[];
}

export function AmenityGrid({ amenities }: AmenityGridProps) {
  if (amenities.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {amenities.map((amenity) => {
        const Icon = iconForAmenity(amenity);
        return (
          <li key={amenity} className="public-site-card flex items-center gap-2 px-3 py-2 text-sm">
            <Icon className="h-4 w-4 shrink-0 text-[var(--cz-public-primary)]" aria-hidden />
            <span>{amenity}</span>
          </li>
        );
      })}
    </ul>
  );
}
