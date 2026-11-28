import { useTranslation } from 'react-i18next';
import { usePendingVerifications } from '@/queries/verification';
import { PageHeader } from '@/components/layout/page-header';
import { VerificationItem } from '@/components/verification/VerificationItem';
import { VerificationMetricsCard } from '@/components/verification/VerificationMetricsCard';
import { arrivalTiming, QUEUE_REASONS, queueReasonOf } from '@/components/verification/verification-model';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AlertCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { todayInRome } from '@/lib/stay-dates';

export function VerificationQueuePage() {
  const { t } = useTranslation();
  const { data: verifications, isLoading, error, refetch, isFetching } = usePendingVerifications();

  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<string>('all');

  const filteredVerifications = useMemo(() => {
    if (!verifications) return [];

    const today = todayInRome();
    return verifications.filter((verification) => {
      if (reasonFilter !== 'all' && queueReasonOf(verification) !== reasonFilter) return false;
      if (deadlineFilter !== 'all') {
        const timing = arrivalTiming(verification.checkInDate, today);
        if (timing !== 'unknown' && timing !== deadlineFilter) return false;
      }
      return true;
    });
  }, [verifications, reasonFilter, deadlineFilter]);

  if (isLoading) {
    return <LoadingScreen message={t('verification.queue.loading')} />;
  }

  if (error) {
    return (
      <div className="workspace-page">
        <Alert
          variant="danger"
          title={t('shared.error')}
          icon={AlertCircle}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {t('verification.queue.retry')}
            </Button>
          }
        >
          {t('verification.queue.loadError')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="workspace-page space-y-6">
      <PageHeader title={t('verification.queue.title')} description={t('verification.queue.description')} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4">
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="reason-filter" className="text-sm font-medium mb-2 block">
                {t('verification.filter.reason')}
              </label>
              <Select id="reason-filter" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
                <option value="all">{t('verification.filter.allReasons')}</option>
                {QUEUE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`verification.filter.reasons.${reason}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="min-w-0">
              <label htmlFor="deadline-filter" className="text-sm font-medium mb-2 block">
                {t('verification.filter.deadline')}
              </label>
              <Select id="deadline-filter" value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)}>
                <option value="all">{t('verification.filter.allDeadlines')}</option>
                <option value="past">{t('verification.filter.past')}</option>
                <option value="today">{t('verification.filter.today')}</option>
                <option value="upcoming">{t('verification.filter.upcoming')}</option>
              </Select>
            </div>
            {(reasonFilter !== 'all' || deadlineFilter !== 'all') && (
              <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => { setReasonFilter('all'); setDeadlineFilter('all'); }}>
                {t('revenue.resetFilters')}
              </Button>
            )}
          </div>

          {filteredVerifications.length === 0 ? (
            <Alert variant="info" title={t('verification.queue.emptyTitle')} icon={AlertCircle}>
              {verifications && verifications.length > 0
                ? t('verification.queue.emptyFiltered')
                : t('verification.queue.emptyQueue')}
            </Alert>
          ) : (
            <div className="space-y-4" data-testid="verification-list">
              {filteredVerifications.map((verification) => (
                <VerificationItem key={verification.bookingId} verification={verification} />
              ))}
            </div>
          )}
        </div>
        <aside><VerificationMetricsCard /></aside>
      </div>
    </div>
  );
}
