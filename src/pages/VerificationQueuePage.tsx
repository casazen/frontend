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

/**
 * The console of the identity verifications (NF-50, NF-51, E03/F04/US03/T02): the guests who wait for a person, each with the property, the arrival,
 * why it is here and the checks that put it here, with a quiet summary of the figures above. The operator contacts the guest outside CasaZen
 * (the video call is not part of this phase) and records the decision here.
 */
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
        // An arrival that cannot be read is never hidden: the operator would not see the guest at all.
        if (timing !== 'unknown' && timing !== deadlineFilter) return false;
      }
      return true;
    });
  }, [verifications, reasonFilter, deadlineFilter]);

  if (isLoading) {
    return <LoadingScreen message={t('verification.queue.loading')} />;
  }

  // The list that could not be read is an error, even when an older one is still in memory: nothing here may look like an empty queue.
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
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
    <div className="container mx-auto space-y-6 px-4 py-8">
      <PageHeader title={t('verification.queue.title')} description={t('verification.queue.description')} />

      <VerificationMetricsCard />

      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-64">
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

        <div className="w-full sm:w-64">
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
  );
}
