import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RevenueDashboard } from './components/revenue-dashboard';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useRevenue } from '@/queries/use-payments';
import { useProperties } from '@/queries/use-properties';
import { ArrowLeft } from 'lucide-react';

function defaultStartDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RevenuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: properties } = useProperties();
  const [propertyId, setPropertyId] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const selectedPropertyId = useMemo(() => {
    if (propertyId) return propertyId;
    return properties?.[0]?.id ?? '';
  }, [propertyId, properties]);

  const { data: analytics, isLoading } = useRevenue({
    propertyId: selectedPropertyId || undefined,
    startDate,
    endDate,
    groupBy: selectedPropertyId ? undefined : groupBy,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('revenue.pageTitle', { defaultValue: 'Analisi ricavi' })}
          description={t('revenue.pageDescription', {
            defaultValue: 'Monitora e analizza l’andamento dei ricavi',
          })}
          action={
            <Button variant="outline" onClick={() => navigate('/app/short-rent/payments')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('revenue.backToPayments', { defaultValue: 'Torna agli incassi' })}
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('revenue.filters', { defaultValue: 'Filtri' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="propertyId">{t('revenue.property', { defaultValue: 'Proprietà' })}</Label>
                <select
                  id="propertyId"
                  value={selectedPropertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {(properties ?? []).length === 0 ? (
                    <option value="">{t('revenue.noProperties', { defaultValue: 'Nessuna proprietà' })}</option>
                  ) : (
                    (properties ?? []).map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">{t('revenue.startDate', { defaultValue: 'Data inizio' })}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">{t('revenue.endDate', { defaultValue: 'Data fine' })}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupBy">{t('revenue.groupBy', { defaultValue: 'Raggruppa per' })}</Label>
                <select
                  id="groupBy"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="day">{t('revenue.period.day', { defaultValue: 'Giorno' })}</option>
                  <option value="week">{t('revenue.period.week', { defaultValue: 'Settimana' })}</option>
                  <option value="month">{t('revenue.period.month', { defaultValue: 'Mese' })}</option>
                  <option value="year">{t('revenue.period.year', { defaultValue: 'Anno' })}</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPropertyId('');
                    setStartDate(defaultStartDate());
                    setEndDate(defaultEndDate());
                    setGroupBy('month');
                  }}
                >
                  {t('revenue.resetFilters', { defaultValue: 'Reimposta filtri' })}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <LoadingScreen message={t('revenue.loading', { defaultValue: 'Caricamento analisi...' })} />
        ) : analytics ? (
          <RevenueDashboard analytics={analytics} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {t('revenue.empty', { defaultValue: 'Nessun dato ricavi disponibile' })}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
