import { useTranslation } from 'react-i18next';
import { usePendingVerifications } from '@/queries/verification';
import { VerificationItem } from '@/components/verification/VerificationItem';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AlertCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { useState, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { isBefore, parseISO, startOfDay } from 'date-fns';

export function VerificationQueuePage() {
  const { t } = useTranslation();
  const { data: verifications, isLoading, error } = usePendingVerifications();

  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<string>('all');

  const filteredVerifications = useMemo(() => {
    if (!verifications) return [];

    let filtered = [...verifications];

    // Filter by reason
    if (reasonFilter !== 'all') {
      filtered = filtered.filter((v) => {
        const outcome = v.biometricOutcome?.toLowerCase();
        if (reasonFilter === 'unverified') {
          return !outcome || outcome === 'escalate';
        }
        if (reasonFilter === 'consent_refused') {
          return outcome === 'reject';
        }
        if (reasonFilter === 'model_error') {
          return outcome === 'escalate';
        }
        return true;
      });
    }

    // Filter by deadline (arrival date)
    if (deadlineFilter !== 'all') {
      const today = startOfDay(new Date());
      filtered = filtered.filter((v) => {
        try {
          const checkInDate = startOfDay(parseISO(v.checkInDate));
          if (deadlineFilter === 'past') {
            return isBefore(checkInDate, today);
          }
          if (deadlineFilter === 'today') {
            return checkInDate.getTime() === today.getTime();
          }
          if (deadlineFilter === 'upcoming') {
            return checkInDate.getTime() > today.getTime();
          }
        } catch {
          return true;
        }
        return true;
      });
    }

    return filtered;
  }, [verifications, reasonFilter, deadlineFilter]);

  if (isLoading) {
    return <LoadingScreen message={t('verification.queue.loading')} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
          {t('verification.queue.loadError')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('verification.queue.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('verification.queue.description')}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="w-full sm:w-64">
          <label htmlFor="reason-filter" className="text-sm font-medium mb-2 block">
            {t('verification.filter.reason')}
          </label>
          <Select id="reason-filter" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
            <option value="all">{t('verification.filter.allReasons')}</option>
            <option value="unverified">{t('verification.reason.unverified')}</option>
            <option value="consent_refused">{t('verification.reason.consent_refused')}</option>
            <option value="model_error">{t('verification.reason.model_error')}</option>
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
        <div className="space-y-4">
          {filteredVerifications.map((verification) => (
            <VerificationItem key={verification.bookingId} verification={verification} />
          ))}
        </div>
      )}
    </div>
  );
}
