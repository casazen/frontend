import { useState } from 'react';
import { RegisterSearch } from './register-search';
import { matchesSearch } from '@/components/shared/list-view/list-data';
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

  const [query, setQuery] = useState('');
  const visible = jobs.filter(job => matchesSearch(job.jobName, query));

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
    <div className="space-y-4">
      {jobs.length > 0 && <RegisterSearch value={query} onChange={setQuery} label={t('admin.jobs.table.job')} />}
      <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-surface-2 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t('admin.jobs.table.job')}</th>
            <th className="px-3 py-2 font-medium">{t('admin.jobs.table.cron')}</th>
            <th className="px-3 py-2 font-medium">{t('admin.jobs.table.lastRun')}</th>
            <th className="px-3 py-2 font-medium">{t('admin.jobs.table.nextRun')}</th>
            <th className="pb-2 font-medium">{t('admin.jobs.table.status')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((job) => (
            <tr key={job.jobName} className="border-b last:border-0">
              <td className="px-3 py-3 font-medium">{job.jobName}</td>
              <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                {job.cronExpression}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{formatDate(job.lastRun)}</td>
              <td className="px-3 py-3 text-muted-foreground">{formatDate(job.nextRun)}</td>
              <td className="py-3">
                <JobStatusBadge status={job.lastStatus} />
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                {t(jobs.length ? 'listView.noResults.title' : 'admin.jobs.table.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
