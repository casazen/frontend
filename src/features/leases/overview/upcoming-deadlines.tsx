import { useTranslation } from 'react-i18next';
import { DayList, PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import type { LongRentDeadlines } from '@/types';
import { deadlineRow } from '../deadlines/deadlines-model';
import { upcomingDeadlines } from './overview-model';

const DEADLINES_PATH = '/app/long-rent/deadlines';

interface UpcomingDeadlinesProps {
  /** The dates of the next four months; undefined while they load. */
  deadlines: LongRentDeadlines | undefined;
  isError: boolean;
  onRetry: () => void;
  today: string;
}

/**
 * «Scadenze»: the first four dates of the next four months that are not rents (the rents are in the numbers above), the late
 * ones among them in red, and the link to the whole agenda. Each row leads to the page that deals with the date.
 */
export function UpcomingDeadlines({ deadlines, isError, onRetry, today }: UpcomingDeadlinesProps) {
  const { t } = useTranslation();
  const rows = deadlines ? upcomingDeadlines(deadlines.items).map((item) => deadlineRow(item, { t, today })) : [];

  return (
    <PlainSection
      title={t('longRentOverview.upcoming.title')}
      actionLabel={t('longRentOverview.upcoming.all')}
      href={DEADLINES_PATH}
      data-testid="long-rent-upcoming"
    >
      {deadlines ? (
        rows.length > 0 ? (
          <DayList items={rows} />
        ) : (
          <p className="text-sm text-foreground/70">{t('longRentOverview.upcoming.empty')}</p>
        )
      ) : isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive">{t('longRentOverview.upcoming.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('longRentOverview.retry')}
          </Button>
        </div>
      ) : (
        <SkeletonLine lines={3} label={t('longRentOverview.loading')} />
      )}
    </PlainSection>
  );
}
