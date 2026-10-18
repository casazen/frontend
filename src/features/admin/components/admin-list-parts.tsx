import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';

export function Pager({
  page,
  pageSize,
  totalCount,
  onPage,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" data-testid="admin-suppliers-pagination">
      <span>{t('admin.suppliers.pagination', { page, totalPages, totalCount })}</span>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="admin-suppliers-prev">
            {t('admin.suppliers.previous')}
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} data-testid="admin-suppliers-next">
            {t('admin.suppliers.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoadingRows() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid="admin-suppliers-loading" aria-busy="true" aria-label={t('admin.suppliers.loading')}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ErrorRow({ error, message, onRetry }: { error: unknown; message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 py-6" role="alert" data-testid="admin-suppliers-error">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-destructive">{getProblemMessage(error, t) ?? message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {t('admin.suppliers.retry')}
      </Button>
    </div>
  );
}

