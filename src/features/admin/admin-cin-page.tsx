import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CinComplianceTable } from './components/cin-compliance-table';
import { useCinCompliance } from '@/queries/use-admin';

const PAGE_SIZE = 20;

type CinStatusFilter = '' | 'valid' | 'missing' | 'invalid';

export function AdminCinPage() {
  const [page, setPage] = useState(1);
  const [cinStatus, setCinStatus] = useState<CinStatusFilter>('');

  const { data, isLoading, isError } = useCinCompliance(
    page,
    PAGE_SIZE,
    cinStatus || undefined,
  );

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conformità CIN"
        description="Verifica dei codici identificativi nazionali (D.L. 145/2023)"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={cinStatus}
            onChange={(e) => {
              setCinStatus(e.target.value as CinStatusFilter);
              setPage(1);
            }}
            data-testid="cin-status-filter"
          >
            <option value="">Tutti gli stati</option>
            <option value="valid">Valido</option>
            <option value="missing">Mancante</option>
            <option value="invalid">Non valido</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <p className="py-8 text-center text-destructive">
              Impossibile caricare i dati CIN. Riprova più tardi.
            </p>
          ) : (
            <>
              <CinComplianceTable items={data?.items ?? []} isLoading={isLoading} />
              {data && data.totalCount > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Pagina {page} di {totalPages} ({data.totalCount} proprietà)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Successiva
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
