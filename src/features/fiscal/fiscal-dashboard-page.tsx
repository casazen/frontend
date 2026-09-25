import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFiscalRegime, useAssignFiscalRegime } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { getProblemMessage } from '@/lib/api-errors';
import type { FiscalTaxNote, StrFiscalRegime } from '@/api/fiscal.api';

const TAX_YEAR = new Date().getUTCFullYear() < 2026 ? 2026 : new Date().getUTCFullYear();

const TAX_NOTE_KEYS: Record<FiscalTaxNote, string> = {
  irpef_ordinaria_not_computed: 'fiscal.taxNote.irpefOrdinariaNotComputed',
  short_stay_threshold_exceeded: 'fiscal.taxNote.thresholdExceeded',
};

export function FiscalDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useFiscalRegime(TAX_YEAR);
  const assign = useAssignFiscalRegime(TAX_YEAR);
  const regimeLabel = (regime: StrFiscalRegime | null) => (regime ? t(`fiscal.regime.${regime}`) : '—');
  const assignRegime = (propertyId: string, regime: StrFiscalRegime, isPrimaryForCedolare?: boolean) =>
    assign.mutate(
      { propertyId, regime, isPrimaryForCedolare },
      { onError: (error) => toast.error(getProblemMessage(error, t) ?? t('fiscal.assignFailed')) },
    );

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
                {t('fiscal.alert.piva', { max: data.maxShortStayApartmentsPerTaxpayer })}{' '}
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
                      {t('fiscal.recommended')}: {regimeLabel(row.recommendedRegime)}
                    </p>
                    <p data-testid={`fiscal-assigned-${row.propertyId}`}>
                      {t('fiscal.assigned')}: {regimeLabel(row.assignedRegime)}
                    </p>
                    {row.taxNote && TAX_NOTE_KEYS[row.taxNote] && (
                      <p data-testid={`fiscal-tax-note-${row.propertyId}`} className="text-muted-foreground">
                        {t(TAX_NOTE_KEYS[row.taxNote])}
                      </p>
                    )}
                    {data.strPropertyCount === 2 && (
                      <Button
                        size="sm"
                        variant={row.isPrimaryForCedolare ? 'default' : 'outline'}
                        disabled={assign.isPending}
                        onClick={() => assignRegime(row.propertyId, 'CedolareSecca21', true)}
                      >
                        {t('fiscal.primary')}
                      </Button>
                    )}
                    {row.taxNote !== 'short_stay_threshold_exceeded' && row.assignedRegime !== 'IrpefOrdinaria' && (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`fiscal-choose-irpef-${row.propertyId}`}
                        disabled={assign.isPending}
                        onClick={() => assignRegime(row.propertyId, 'IrpefOrdinaria')}
                      >
                        {t('fiscal.chooseIrpef')}
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
