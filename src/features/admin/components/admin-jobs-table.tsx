import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { JobStatusBadge } from './job-status-badge';
import type { JobStatus } from '@/types';

interface AdminJobsTableProps {
  jobs: JobStatus[];
  isLoading: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminJobsTable({ jobs, isLoading }: AdminJobsTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">{t('admin.jobs.table.job')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.jobs.table.cron')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.jobs.table.lastRun')}</th>
            <th className="pb-2 pr-4 font-medium">{t('admin.jobs.table.nextRun')}</th>
            <th className="pb-2 font-medium">{t('admin.jobs.table.status')}</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobName} className="border-b last:border-0">
              <td className="py-3 pr-4 font-medium">{job.jobName}</td>
              <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                {job.cronExpression}
              </td>
              <td className="py-3 pr-4 text-muted-foreground">{formatDate(job.lastRun)}</td>
              <td className="py-3 pr-4 text-muted-foreground">{formatDate(job.nextRun)}</td>
              <td className="py-3">
                <JobStatusBadge status={job.lastStatus} />
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('admin.jobs.table.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
