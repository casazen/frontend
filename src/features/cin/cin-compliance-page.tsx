import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CinComplianceTable } from './components/cin-compliance-table';
import { CinDeadlineBanner } from './components/cin-deadline-banner';
import { CinSummaryCards } from './components/cin-summary-cards';
import { useCinCompliance } from '@/queries/use-cin';

export function CinCompliancePage() {
  const { data, isLoading } = useCinCompliance();

  return (
    <AppShell>
      <div className="space-y-6" data-testid="cin-compliance-page">
        <PageHeader
          title="Conformità CIN"
          description="Gestione codici identificativi nazionali — D.L. 145/2023"
        />

        {data?.summary && <CinDeadlineBanner summary={data.summary} />}
        {data?.summary && <CinSummaryCards summary={data.summary} />}

        <Card>
          <CardContent className="pt-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Richiedi il CIN sul portale{' '}
              <a
                href="https://bdsr.ministeroturismo.it"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                BDSR — Ministero del Turismo
              </a>
            </p>
            <CinComplianceTable items={data?.items ?? []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
