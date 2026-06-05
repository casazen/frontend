import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { usePropertyDetail } from '@/queries/use-properties';
import { Edit } from 'lucide-react';
import { PropertyCinBadge } from './components/property-cin-badge';
import { PropertyPhotoCarousel } from './components/property-photo-carousel';
import { PropertyInfoCard } from './components/property-info-card';
import { PropertyAmenitiesGrid } from './components/property-amenities-grid';
import { PropertyDocumentsSection } from './components/property-documents-section';
import { PropertyOtaSummary } from './components/property-ota-summary';
import { PropertyBookingsKpi } from './components/property-bookings-kpi';
import { PropertyPricingSummaryCard } from './components/property-pricing-summary-card';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading, isError } = usePropertyDetail(id!);

  if (isLoading) {
    return <LoadingScreen message="Caricamento proprietà..." />;
  }

  if (isError || !property) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Proprietà non trovata</h2>
          <p className="text-muted-foreground">La proprietà che stai cercando non esiste.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={property.name}
          description={property.city}
          action={
            <div className="flex items-center gap-3">
              <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
              <Badge variant={property.isActive ? 'success' : 'secondary'}>
                {property.isActive ? 'Attiva' : 'Inattiva'}
              </Badge>
              <Button onClick={() => navigate(`/properties/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifica
              </Button>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <PropertyPhotoCarousel photoUrls={property.photoUrls} name={property.name} />

            {property.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Descrizione</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{property.description}</p>
                </CardContent>
              </Card>
            )}

            <PropertyAmenitiesGrid amenities={property.amenities} />
            <PropertyDocumentsSection propertyId={property.id} documents={property.documents} />
            <PropertyOtaSummary integrations={property.otaIntegrations} />
            <PropertyBookingsKpi summary={property.bookingsSummary} />
          </div>

          <div className="space-y-6">
            <PropertyInfoCard
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              maxGuests={property.maxGuests}
              nightlyRate={property.nightlyRate}
              cleaningFee={property.cleaningFee}
              damageDeposit={property.damageDeposit}
              timezone={property.timezone}
            />
            <PropertyPricingSummaryCard
              propertyId={property.id}
              summary={property.pricingAdapterSummary}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
