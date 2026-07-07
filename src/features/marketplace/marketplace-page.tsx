import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Store, Calendar, Home } from 'lucide-react';
import { useServiceRequests } from '@/queries/use-service-requests';
import { useProperties } from '@/queries/use-properties';

export function MarketplacePage() {
  const { t } = useTranslation();
  const { data: requests, isLoading } = useServiceRequests({ listAll: true, page: 1, pageSize: 50 });
  const { data: properties } = useProperties();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('marketplace.title')}
          description={t('marketplace.description')}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('marketplace.quickActions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" asChild>
                <Link to="/app/short-rent/bookings">{t('marketplace.goToBookings')}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/short-rent/properties">{t('marketplace.goToProperties')}</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4" />
                {t('marketplace.propertiesTitle')}
              </CardTitle>
              <CardDescription>{t('marketplace.propertiesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {(properties ?? []).length} {t('nav.properties').toLowerCase()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('marketplace.requestsTitle')}
            </CardTitle>
            <CardDescription>{t('marketplace.requestsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && (requests?.items?.length ?? 0) === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-muted-foreground">{t('marketplace.noRequests')}</p>
                <p className="text-sm text-muted-foreground">{t('marketplace.noRequestsHint')}</p>
              </div>
            )}
            {!isLoading && (requests?.items?.length ?? 0) > 0 && (
              <div className="space-y-3">
                {requests!.items.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">
                        {req.propertyName ?? req.propertyId.slice(0, 8)}
                        {' · '}
                        {t(`serviceRequest.categories.${req.category}`, { defaultValue: req.category })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {req.supplierName ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {t(`serviceRequest.status.${req.status}`, { defaultValue: req.status })}
                      </Badge>
                      {req.bookingId && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/app/short-rent/bookings/${req.bookingId}`}>
                            {t('marketplace.viewBooking')}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
