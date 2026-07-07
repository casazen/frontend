import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { usePropertyDetail } from '@/queries/use-properties';
import { useCurrentUser } from '@/queries/use-users';
import { useUpdatePropertyCin } from '@/queries/use-cin';
import { Edit, ArrowRight, Sparkles, ExternalLink, Wrench } from 'lucide-react';
import { buildPropertyBookingPath } from '@/lib/booking-url';
import { PropertyCinBadge } from './components/property-cin-badge';
import { PropertyCinDialog } from './components/property-cin-dialog';
import { PropertyPhotoCarousel } from './components/property-photo-carousel';
import { PropertyInfoCard } from './components/property-info-card';
import { PropertyAmenitiesGrid } from './components/property-amenities-grid';
import { PropertyDocumentsSection } from './components/property-documents-section';
import { PropertyOtaSummary } from './components/property-ota-summary';
import { IcalSettings } from './components/ical-settings';
import { PropertyBookingsKpi } from './components/property-bookings-kpi';
import { PropertyPricingSummaryCard } from './components/property-pricing-summary-card';

type PropertyTab = 'info' | 'pricing' | 'ota' | 'documents' | 'cin';

export function PropertyDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cinDialogOpen, setCinDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PropertyTab>('info');
  const { data: property, isLoading, isError } = usePropertyDetail(id!);
  const { org } = useCurrentUser();
  const updateCin = useUpdatePropertyCin();

  if (isLoading) {
    return <LoadingScreen message={t('property.detail.loading')} />;
  }

  if (isError || !property) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('property.detail.notFound')}</h2>
          <p className="text-muted-foreground">{t('property.detail.notFoundDescription')}</p>
        </div>
      </AppShell>
    );
  }

  const tabs: { key: PropertyTab; label: string }[] = [
    { key: 'info', label: t('property.detail.tabs.info') },
    { key: 'pricing', label: t('property.detail.tabs.pricing') },
    { key: 'ota', label: t('property.detail.tabs.ota') },
    { key: 'documents', label: t('property.detail.tabs.documents') },
    { key: 'cin', label: t('property.detail.tabs.cin') },
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
                {property.isActive ? t('property.detail.active') : t('property.detail.inactive')}
              </Badge>
              <Button
                variant="outline"
                onClick={() => navigate(`/app/short-rent/marketplace?propertyId=${property.id}`)}
                data-testid="property-request-service-btn"
              >
                <Wrench className="mr-2 h-4 w-4" />
                {t('serviceRequest.requestSupplier')}
              </Button>
              <Button onClick={() => navigate(`/app/short-rent/properties/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                {t('property.detail.edit')}
              </Button>
            </div>
          }
        />

        {org?.slug ? (
          <Card data-testid="host-public-site-link">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <p className="text-sm text-muted-foreground">{t('property.detail.publicSiteHint')}</p>
              <a
                href={buildPropertyBookingPath(org.slug, property)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {t('property.detail.viewOnPublicSite')}
                <ExternalLink className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        ) : null}

        <Link
          to={`/app/short-rent/bookings?propertyId=${property.id}`}
          className="text-primary hover:underline text-sm inline-block"
        >
          {t('property.detail.bookingsLink')} &#8594;
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
                    <CardTitle>{t('property.detail.description')}</CardTitle>
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
                    {t('property.detail.pricingTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {t('property.detail.pricingDescription')}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/app/short-rent/properties/${id}/pricing`)}
                  >
                    {t('property.detail.managePricing')}
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
            <IcalSettings propertyId={property.id} />
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
                <CardTitle>{t('property.detail.cinTitle')}</CardTitle>
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
                    {t('property.detail.editCin')}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('property.detail.cinDescription')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('property.detail.complianceSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('property.detail.cinStatus')}</span>
                  <Badge
                    variant={
                      property.cinStatus === 'Valid'
                        ? 'success'
                        : property.cinStatus === 'Missing'
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {t(`cin.status.${property.cinStatus}`)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('property.detail.propertyActive')}</span>
                  <Badge variant={property.isActive ? 'success' : 'secondary'}>
                    {property.isActive ? t('property.detail.yes') : t('property.detail.no')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('property.detail.documents')}</span>
                  <span className="text-sm font-medium">
                    {t('property.detail.documentsCount', { count: property.documents.length })}
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
