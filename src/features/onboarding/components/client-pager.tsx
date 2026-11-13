import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ClientPagerProps {
  page: number;
  pages: number;
  /** All the rows of the list, on every page. */
  total: number;
  onPage: (page: number) => void;
  testId: string;
}

/**
 * The pager of a long result the page holds whole and draws a page at a time (the rows of a check of a file, the properties of an apply): «Pagina 2 di 5 ·
 * 230 in tutto» and two buttons of at least 44 px. Nothing is drawn for a list of one page.
 */
export function ClientPager({ page, pages, total, onPage, testId }: ClientPagerProps) {
  const { t } = useTranslation();
  if (pages <= 1) return null;

  return (
    <nav aria-label={t('onboardingPlan.bulk.pager.label')} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid={testId}>
      <span data-testid={`${testId}-status`}>{t('onboardingPlan.bulk.pager.status', { page, pages, total })}</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-auto min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid={`${testId}-previous`}>
          {t('onboardingPlan.bulk.pager.previous')}
        </Button>
        <Button type="button" variant="outline" className="h-auto min-h-11" disabled={page >= pages} onClick={() => onPage(page + 1)} data-testid={`${testId}-next`}>
          {t('onboardingPlan.bulk.pager.next')}
        </Button>
      </div>
    </nav>
  );
}
