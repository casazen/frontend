import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CinComplianceTable } from './components/cin-compliance-table';
import { useCinCompliance } from '@/queries/use-admin';

export function AdminCinPage() {
  const { data, isLoading, isError } = useCinCompliance();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conformità CIN"
        description="Verifica dei codici identificativi nazionali (D.L. 145/2023)"
      />
      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <p className="py-8 text-center text-destructive">
              Impossibile caricare i dati CIN. Riprova più tardi.
            </p>
          ) : (
            <CinComplianceTable items={data ?? []} isLoading={isLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
