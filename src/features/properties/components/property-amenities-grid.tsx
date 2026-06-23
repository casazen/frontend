import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { getAmenityLabel } from '@/lib/i18n-labels';

interface PropertyAmenitiesGridProps {
  amenities: string[];
}

export function PropertyAmenitiesGrid({ amenities }: PropertyAmenitiesGridProps) {
  const { t } = useTranslation();

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
              <span className="text-sm">{getAmenityLabel(amenity, t)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
