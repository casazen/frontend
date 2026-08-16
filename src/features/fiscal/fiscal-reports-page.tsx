import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { fiscalApi } from '@/api/fiscal.api';
import { useFiscalAnnualReport, useFiscalWithholdingReport } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';

const TAX_YEAR = new Date().getUTCFullYear() < 2026 ? 2026 : new Date().getUTCFullYear();

async function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function FiscalReportsPage() {
  const { t } = useTranslation();
  const annual = useFiscalAnnualReport(TAX_YEAR);
  const withholding = useFiscalWithholdingReport(TAX_YEAR);

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="fiscal-reports-page">
        <PageHeader title={t('fiscal.reports.title')} description={t('fiscal.reports.description')} />
        {annual.data && (
          <>
            <FiscalDisclaimer text={annual.data.disclaimer} />
            <p data-testid="fiscal-pack-label">{annual.data.packLabel}</p>
            <p data-testid="fiscal-annual-total">
              {t('fiscal.reports.totals', {
                gross: annual.data.totals.grossIncome,
                net: annual.data.totals.net,
              })}
            </p>
          </>
        )}
        {withholding.data && (
          <ul data-testid="fiscal-withholding-by-ota">
            {withholding.data.byOta.map((b) => (
              <li key={b.source}>
                {b.source}: {b.withholding}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="fiscal-export-csv"
            variant="outline"
            onClick={async () => {
              const blob = await fiscalApi.downloadAnnual(TAX_YEAR, 'csv');
              await saveBlob(blob, `casazen-redditi-${TAX_YEAR}.csv`);
            }}
          >
            CSV
          </Button>
          <Button
            data-testid="fiscal-export-pdf"
            variant="outline"
            onClick={async () => {
              const blob = await fiscalApi.downloadAnnual(TAX_YEAR, 'pdf');
              await saveBlob(blob, `casazen-redditi-${TAX_YEAR}.pdf`);
            }}
          >
            PDF
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
