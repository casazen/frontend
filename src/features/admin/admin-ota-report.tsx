import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AdminOtaStatus } from '@/api/admin.api';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminOtaSync } from '@/queries/use-admin';
import { formatRomeDateTime } from '@/lib/stay-dates';

const PAGE_SIZE = 20;

export function AdminOtaReport({ status }: { status: AdminOtaStatus }) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 2147483647 ? rawPage : 1;
  const query = useAdminOtaSync(status, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil((query.data?.totalCount ?? 0) / PAGE_SIZE));

  function navigate(nextStatus: string, nextPage: number) {
    const next = new URLSearchParams(params);
    next.set('otaStatus', nextStatus);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setParams(next);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('admin.dashboard.ota.title')} />
      <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text underline" to="/app/admin">{t('admin.dashboard.title')}</Link>
      <Select wrapperClassName="max-w-sm" aria-label={t('admin.dashboard.ota.filter')} value={status}
        onChange={event => navigate(event.target.value, 1)}>
        {(['failed', 'neverSynced', 'synced'] as const).map(value =>
          <option key={value} value={value}>{t(`admin.dashboard.ota.${value}`)}</option>)}
      </Select>
      {query.isError ? <ErrorState title={t('admin.dashboard.ota.loadError')} error={query.error} onRetry={() => void query.refetch()} />
        : !query.data ? <Skeleton className="h-32" />
        : <>
          {query.data.items.length ? (
            <ul className="divide-y rounded-xl border bg-card px-4">
              {query.data.items.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0"><h2 className="break-words font-medium">{row.propertyName}</h2><p className="text-sm text-muted-foreground">{row.platform}</p></div>
                <span className="text-sm text-muted-foreground">{row.lastSyncAt
                  ? t('marketplace.mine.card.lastSync', { when: formatRomeDateTime(row.lastSyncAt, i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })
                  : t('marketplace.mine.card.neverSynced')}</span>
              </li>)}
            </ul>
          ) : <p role="status">{t('admin.dashboard.ota.empty')}</p>}
          {(page > 1 || pages > 1) && <nav aria-label={t('admin.dashboard.ota.pages')} className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => navigate(status, Math.min(page - 1, pages))}>{t('admin.cin.previous')}</Button>
            <span className="text-sm">{t('admin.dashboard.ota.page', { page, pages })}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate(status, page + 1)}>{t('admin.cin.next')}</Button>
          </nav>}
        </>}
    </div>
  );
}
