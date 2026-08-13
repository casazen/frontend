import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFiscalRegime, useAssignFiscalRegime } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import type { StrFiscalRegime } from '@/api/fiscal.api';

const TAX_YEAR = new Date().getUTCFullYear() < 2026 ? 2026 : new Date().getUTCFullYear();

export function FiscalDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useFiscalRegime(TAX_YEAR);
  const assign = useAssignFiscalRegime(TAX_YEAR);

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="fiscal-dashboard-page">
        <PageHeader title={t('fiscal.page.title')} description={t('fiscal.page.description')} />
        {isLoading && <p>{t('fiscal.loading')}</p>}
        {data && (
          <>
            <FiscalDisclaimer text={data.disclaimer} />
            {data.requiresPartitaIva && (
              <div
                data-testid="fiscal-piva-alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
              >
                {t('fiscal.alert.piva')}{' '}
                <Link className="underline" to="/app/short-rent/fiscal/wizard">
                  {t('fiscal.alert.wizard')}
                </Link>
              </div>
            )}
            <p data-testid="fiscal-str-count">
              {t('fiscal.count', { count: data.strPropertyCount, year: data.taxYear })}
            </p>
            <div className="grid gap-3">
              {data.properties.map((row) => (
                <Card key={row.propertyId} data-testid={`fiscal-property-card-${row.propertyId}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{row.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      {t('fiscal.recommended')}: {row.recommendedRegime ?? '—'}
                    </p>
                    <p>
                      {t('fiscal.assigned')}: {row.assignedRegime ?? '—'}
                    </p>
                    {data.strPropertyCount === 2 && (
                      <Button
                        size="sm"
                        variant={row.isPrimaryForCedolare ? 'default' : 'outline'}
                        disabled={assign.isPending}
                        onClick={() =>
                          assign.mutate({
                            propertyId: row.propertyId,
                            regime: 'CedolareSecca21' as StrFiscalRegime,
                            isPrimaryForCedolare: true,
                          })
                        }
                      >
                        {t('fiscal.primary')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button asChild variant="outline">
              <Link to="/app/short-rent/fiscal/reports">{t('fiscal.reports.link')}</Link>
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}
