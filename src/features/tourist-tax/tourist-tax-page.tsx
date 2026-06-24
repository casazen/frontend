import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { touristTaxApi } from '@/api/tourist-tax.api';
import { formatDate } from '@/lib/utils';
import { Coins, Loader2, RefreshCw } from 'lucide-react';

export function TouristTaxPage() {
  const { t } = useTranslation();

  const {
    data: rates,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['tourist-tax-rates'],
    queryFn: () => touristTaxApi.getAll(),
  });

  const items = rates ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('taxRates.title')}
          description={t('taxRates.description')}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('taxRates.listTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('shared.loading.defaultMessage')}</span>
              </div>
            )}

            {/* Error State */}
            {isError && !isLoading && (
              <div className="py-12 text-center">
                <p className="text-destructive mb-4">{t('taxRates.loadError')}</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                  {t('taxRates.retry')}
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && items.length === 0 && (
              <EmptyState
                icon={Coins}
                title={t('taxRates.title')}
                description={t('taxRates.empty')}
              />
            )}

            {/* Table */}
            {!isLoading && !isError && items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.city')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.region')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('taxRates.ratePerNight')}
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                        {t('taxRates.maxNights')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.effectiveFrom')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((rate) => (
                      <tr
                        key={rate.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{rate.city}</td>
                        <td className="px-4 py-3 text-muted-foreground">{rate.regionCode}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          &euro;{rate.ratePerPersonPerNight.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {rate.maxNights ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(rate.effectiveFrom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
