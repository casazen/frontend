import type { TFunction } from 'i18next';
import { formatStayDate } from '@/lib/stay-dates';
import type { CinComplianceSummary } from '@/types/cin.types';

/**
 * The deadline line of the CIN banner and of the CIN page (CO-20): days left before it, "today" only on the day itself,
 * "passed" after it, and the obligation without a date when no deadline is configured. The phase comes from the backend
 * (Europe/Rome day).
 */
export function deadlineMessage(summary: CinComplianceSummary, locale: string, t: TFunction): string {
  const deadline = summary.deadline ? formatStayDate(summary.deadline, locale) : '';
  if (!deadline) return t('cin.banner.obligation');

  switch (summary.deadlineStatus) {
    case 'upcoming':
      return t('cin.banner.daysUntilDeadline', { count: summary.daysUntilDeadline ?? 0, deadline });
    case 'today':
      return t('cin.banner.deadlineToday', { deadline });
    case 'passed':
      return t('cin.banner.deadlinePassed', { deadline });
    default:
      return t('cin.banner.obligation');
  }
}
