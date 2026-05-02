import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Bed, Bath, Users, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Property } from '@/types';

interface PropertyCardProps {
  property: Property;
  onEdit?: (property: Property) => void;
  onDelete?: (property: Property) => void;
  onView?: (property: Property) => void;
}

export function PropertyCard({ property, onEdit, onDelete, onView }: PropertyCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="relative h-48 bg-muted">
          {property.photoUrls && property.photoUrls.length > 0 ? (
            <img
              src={property.photoUrls[0]}
              alt={property.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Badge variant={property.isActive ? 'success' : 'secondary'}>
              {property.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-1">{property.name}</h3>

        <div className="flex items-center text-sm text-muted-foreground mb-3">
          <MapPin className="h-4 w-4 mr-1" />
          <span className="line-clamp-1">{property.city}, {property.country}</span>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {property.description}
        </p>

        <div className="flex items-center justify-between text-sm mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4 text-muted-foreground" />
              <span>{property.bedrooms}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4 text-muted-foreground" />
              <span>{property.bathrooms}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{property.maxGuests}</span>
            </div>
          </div>
        </div>

        <div className="text-lg font-bold">
          {formatCurrency(property.nightlyRate, property.currency)} / night
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        {onView && (
          <Button variant="outline" className="flex-1" onClick={() => onView(property)}>
            View
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="icon" onClick={() => onEdit(property)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="icon" onClick={() => onDelete(property)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
