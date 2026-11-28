import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ListPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function ListPagination({ page, pageSize, totalCount, onPageChange }: ListPaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={t('listView.pagination.label')} className="flex items-center gap-2" data-testid="list-pagination">
      <span className="text-sm text-foreground/70">{t('listView.pagination.page', { page, pageCount })}</span>
      <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t('listView.pagination.previous')}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        {t('listView.pagination.next')}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
