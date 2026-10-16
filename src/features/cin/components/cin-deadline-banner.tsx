import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CinComplianceSummary } from '@/types/cin.types';
import { deadlineMessage } from '../cin-deadline';

interface CinDeadlineBannerProps {
  summary: CinComplianceSummary;
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
