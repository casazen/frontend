import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

const AMENITY_LABELS: Record<string, string> = {
  WiFi: 'Wi-Fi',
  TV: 'TV',
  CableTV: 'TV via cavo',
  Workspace: 'Spazio di lavoro',
  AirConditioning: 'Aria condizionata',
  Heating: 'Riscaldamento',
  Kitchen: 'Cucina',
  Pool: 'Piscina',
  Washer: 'Lavatrice',
  Dryer: 'Asciugatrice',
  Parking: 'Parcheggio',
  Elevator: 'Ascensore',
};

function amenityLabel(name: string): string {
  return AMENITY_LABELS[name] ?? name.replace(/([A-Z])/g, ' $1').trim();
}

interface PropertyAmenitiesGridProps {
  amenities: string[];
}

export function PropertyAmenitiesGrid({ amenities }: PropertyAmenitiesGridProps) {
  if (!amenities.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servizi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {amenities.map((amenity) => (
            <div key={amenity} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm">{amenityLabel(amenity)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
