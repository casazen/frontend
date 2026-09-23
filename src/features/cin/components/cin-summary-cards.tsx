import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CinComplianceSummary } from '@/types/cin.types';

interface CinSummaryCardsProps {
  summary: CinComplianceSummary;
}

export function CinSummaryCards({ summary }: CinSummaryCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-4" data-testid="cin-summary-cards">
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('cin.summary.daysUntilDeadline')}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold" data-testid="cin-days-until-deadline">
          {summary.daysUntilDeadline}
        </CardContent>
      </Card>
    </div>
  );
}
