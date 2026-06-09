import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Bed, Bath, Users, Euro } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { PropertyCinBadge } from '@/features/properties/components/property-cin-badge';
import type { PublicPropertyDto } from '@/types';

interface PropertySearchCardProps {
  property: PublicPropertyDto;
  onViewDetails: (property: PublicPropertyDto) => void;
}

export function PropertySearchCard({ property, onViewDetails }: PropertySearchCardProps) {
  const heroPhoto = property.photoUrls[0];

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        {heroPhoto ? (
          <img
            src={heroPhoto}
            alt={property.name}
            className="h-48 w-full object-cover"
          />
        ) : (
          <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <div className="text-6xl">🏠</div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg line-clamp-1">{property.name}</h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">
              {property.city}
              {property.postalCode ? ` (${property.postalCode})` : ''}
            </span>
          </div>
        </div>

        <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />

        {property.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {property.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Bed className="h-3 w-3" />
            {property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Bath className="h-3 w-3" />
            {property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {property.maxGuests} guests
          </Badge>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-baseline gap-1">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{formatCurrency(property.nightlyRate)}</span>
            <span className="text-sm text-muted-foreground">/night</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button className="w-full" onClick={() => onViewDetails(property)}>
          Dettagli
        </Button>
      </CardFooter>
    </Card>
  );
}
