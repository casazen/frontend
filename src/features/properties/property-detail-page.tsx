import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useProperty } from '@/queries/use-properties';
import { formatCurrency } from '@/lib/utils';
import { Edit, MapPin, Bed, Bath, Users, CheckCircle } from 'lucide-react';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading } = useProperty(id!);

  if (isLoading) {
    return <LoadingScreen message="Loading property..." />;
  }

  if (!property) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Property not found</h2>
          <p className="text-muted-foreground">The property you're looking for doesn't exist.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={property.name}
          description={`${property.city}, ${property.country}`}
          action={
            <Button onClick={() => navigate(`/properties/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Property
            </Button>
          }
        />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Images */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
                  {property.images && property.images.length > 0 ? (
                    <img
                      src={property.images[0]}
                      alt={property.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <MapPin className="h-24 w-24 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <Badge variant={property.isActive ? 'success' : 'secondary'} className="text-base px-3 py-1">
                      {property.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{property.description}</p>
              </CardContent>
            </Card>

            {property.amenities && property.amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {property.amenities.map((amenity) => (
                      <div key={amenity} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Details Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">Bedrooms</span>
                  </div>
                  <span className="font-semibold">{property.bedrooms}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">Bathrooms</span>
                  </div>
                  <span className="font-semibold">{property.bathrooms}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">Max Guests</span>
                  </div>
                  <span className="font-semibold">{property.maxGuests}</span>
                </div>

                <div className="border-t pt-4">
                  <div className="text-sm text-muted-foreground mb-1">Price per Night</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(property.pricePerNight, property.currency)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Address</div>
                  <div className="font-medium">{property.address}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">City</div>
                  <div className="font-medium">{property.city}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Country</div>
                  <div className="font-medium">{property.country}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">ZIP Code</div>
                  <div className="font-medium">{property.zipCode}</div>
                </div>
                {property.latitude && property.longitude && (
                  <div>
                    <div className="text-sm text-muted-foreground">Coordinates</div>
                    <div className="font-medium text-sm">
                      {property.latitude.toFixed(6)}, {property.longitude.toFixed(6)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
