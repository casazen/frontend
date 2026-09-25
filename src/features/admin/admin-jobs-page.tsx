import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminJobsTable } from './components/admin-jobs-table';
import { useAdminJobs } from '@/queries/use-admin';

export function AdminJobsPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAdminJobs();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.jobs.title')}
        description={t('admin.jobs.description')}
      />
      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-destructive">{t('admin.jobs.loadError')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('admin.jobs.retry')}
              </Button>
            </div>
          ) : (
            <AdminJobsTable jobs={data ?? []} isLoading={isLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
