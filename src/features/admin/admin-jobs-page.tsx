import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AdminJobsTable } from './components/admin-jobs-table';
import { useAdminJobs } from '@/queries/use-admin';

export function AdminJobsPage() {
  const { data, isLoading } = useAdminJobs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Background Jobs"
        description="Stato dei job Hangfire (aggiornato ogni 30 secondi)"
      />
      <Card>
        <CardContent className="pt-6">
          <AdminJobsTable jobs={data ?? []} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
