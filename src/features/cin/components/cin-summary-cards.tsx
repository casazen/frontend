import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatStayDate } from '@/lib/stay-dates';
import type { CinComplianceSummary } from '@/types/cin.types';

interface CinSummaryCardsProps {
  summary: CinComplianceSummary;
}

export function CinSummaryCards({ summary }: CinSummaryCardsProps) {
  const { t, i18n } = useTranslation();
  // CO-20: the deadline card only when a deadline is configured; "passed" after it, never a count stuck at 0.
  const deadline = summary.deadline ? formatStayDate(summary.deadline, i18n.language) : '';
  const showDeadline = summary.deadlineStatus !== 'none' && deadline !== '';
  const deadlineValue =
    summary.deadlineStatus === 'upcoming'
      ? t('cin.summary.daysLeft', { count: summary.daysUntilDeadline ?? 0 })
      : summary.deadlineStatus === 'today'
        ? t('cin.summary.dueToday')
        : t('cin.summary.passed');

  return (
    <div className={`grid gap-4 ${showDeadline ? 'md:grid-cols-4' : 'md:grid-cols-3'}`} data-testid="cin-summary-cards">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('cin.summary.valid')}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{summary.valid}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('cin.summary.missing')}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{summary.missing}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('cin.summary.invalid')}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{summary.invalid}</CardContent>
      </Card>
      {showDeadline && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('cin.summary.deadline', { deadline })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold" data-testid="cin-days-until-deadline">
            {deadlineValue}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
