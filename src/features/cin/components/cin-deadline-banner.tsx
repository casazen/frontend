import { AlertTriangle } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import type { CinComplianceSummary } from '@/types/cin.types';

interface CinDeadlineBannerProps {
  summary: CinComplianceSummary;
}

/**
 * The deadline line of the banner (CO-20): days left before it, "today" only on the day itself, "passed" after it, and
 * the obligation without a date when no deadline is configured. The phase comes from the backend (Europe/Rome day).
 */
function deadlineMessage(summary: CinComplianceSummary, locale: string, t: TFunction): string {
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

export function CinDeadlineBanner({ summary }: CinDeadlineBannerProps) {
  const { t, i18n } = useTranslation();

  if (!summary.hasNonCompliant)
    return null;

  return (
    <div
      role="alert"
      data-testid="cin-deadline-banner"
      className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{t('cin.banner.title')}</p>
        <p className="text-sm">
          {t('cin.banner.nonCompliantCount', { count: summary.missing + summary.invalid })}
          {' '}
          <span data-testid="cin-deadline-message">{deadlineMessage(summary, i18n.language, t)}</span>
          {' '}
          {t('cin.banner.penalties')}
          {' '}
          <a
            href="https://bdsr.ministeroturismo.gov.it/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            {t('cin.banner.requestOnBdsr')}
          </a>
        </p>
      </div>
    </div>
  );
}
