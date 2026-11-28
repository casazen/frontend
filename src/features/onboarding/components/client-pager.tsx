import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ClientPagerProps {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
  testId: string;
}

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
