import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { usePropertyDetail } from '@/queries/use-properties';
import { useUpdatePropertyCin } from '@/queries/use-cin';
import { Edit, ArrowRight, Sparkles } from 'lucide-react';
import { PropertyCinBadge } from './components/property-cin-badge';
import { PropertyCinDialog } from './components/property-cin-dialog';
import { PropertyPhotoCarousel } from './components/property-photo-carousel';
import { PropertyInfoCard } from './components/property-info-card';
import { PropertyAmenitiesGrid } from './components/property-amenities-grid';
import { PropertyDocumentsSection } from './components/property-documents-section';
import { PropertyOtaSummary } from './components/property-ota-summary';
import { PropertyBookingsKpi } from './components/property-bookings-kpi';
import { PropertyPricingSummaryCard } from './components/property-pricing-summary-card';

type PropertyTab = 'info' | 'pricing' | 'ota' | 'documents' | 'cin';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cinDialogOpen, setCinDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PropertyTab>('info');
  const { data: property, isLoading, isError } = usePropertyDetail(id!);
  const updateCin = useUpdatePropertyCin();

  if (isLoading) {
    return <LoadingScreen message="Caricamento proprieta..." />;
  }

  if (isError || !property) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Proprieta non trovata</h2>
          <p className="text-muted-foreground">La proprieta che stai cercando non esiste.</p>
        </div>
      </AppShell>
    );
  }

  const tabs: { key: PropertyTab; label: string }[] = [
    { key: 'info', label: 'Info & Foto' },
    { key: 'pricing', label: 'Prezzi AI' },
    { key: 'ota', label: 'Canali OTA' },
    { key: 'documents', label: 'Documenti' },
    { key: 'cin', label: 'CIN & Compliance' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <Breadcrumb />

        <PageHeader
          title={property.name}
          description={property.city}
          action={
            <div className="flex items-center gap-3">
              <PropertyCinBadge
                cinStatus={property.cinStatus}
                cinCode={property.cinCode}
                onEdit={() => setCinDialogOpen(true)}
              />
              <Badge variant={property.isActive ? 'success' : 'secondary'}>
                {property.isActive ? 'Attiva' : 'Inattiva'}
              </Badge>
              <Button onClick={() => navigate(`/app/short-rent/properties/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifica
              </Button>
            </div>
          }
        />

        <Link
          to={`/app/short-rent/bookings?propertyId=${property.id}`}
          className="text-primary hover:underline text-sm inline-block"
        >
          Prenotazioni di questa proprieta &#8594;
        </Link>

        <div className="flex gap-1 border-b mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
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
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Prezzi AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Configura l'adattatore AI per la tariffazione dinamica di questa proprieta.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/app/short-rent/properties/${id}/pricing`)}
                  >
                    Gestisci prezzi AI
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
              <PropertyBookingsKpi summary={property.bookingsSummary} />
            </div>

            <div className="space-y-6">
              <PropertyPricingSummaryCard
                propertyId={property.id}
                summary={property.pricingAdapterSummary}
              />
            </div>
          </div>
        )}

        {activeTab === 'ota' && (
          <div className="space-y-6">
            <PropertyOtaSummary integrations={property.otaIntegrations} />
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <PropertyDocumentsSection propertyId={property.id} documents={property.documents} />
          </div>
        )}

        {activeTab === 'cin' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Codice CIN</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <PropertyCinBadge
                    cinStatus={property.cinStatus}
                    cinCode={property.cinCode}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCinDialogOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Modifica CIN
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Il Codice Identificativo Nazionale (CIN) e obbligatorio ai sensi del D.L. 145/2023
                  per tutte le strutture ricettive in Italia. Formato richiesto: IT-XXXXX-XXXXXXXXXX.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Riepilogo compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Stato CIN</span>
                  <Badge
                    variant={
                      property.cinStatus === 'Valid'
                        ? 'success'
                        : property.cinStatus === 'Missing'
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {property.cinStatus === 'Valid'
                      ? 'Valido'
                      : property.cinStatus === 'Missing'
                        ? 'Mancante'
                        : 'Non valido'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Proprieta attiva</span>
                  <Badge variant={property.isActive ? 'success' : 'secondary'}>
                    {property.isActive ? 'Si' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Documenti</span>
                  <span className="text-sm font-medium">
                    {property.documents.length} caricati
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <PropertyCinDialog
        propertyId={property.id}
        open={cinDialogOpen}
        onOpenChange={setCinDialogOpen}
        cinStatus={property.cinStatus}
        cinCode={property.cinCode}
        isSaving={updateCin.isPending}
        onSave={async (cinCode) => {
          await updateCin.mutateAsync({ propertyId: property.id, cinCode });
        }}
      />
    </AppShell>
  );
}
