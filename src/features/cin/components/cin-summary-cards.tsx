import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CinComplianceSummary } from '@/types/cin.types';

interface CinSummaryCardsProps {
  summary: CinComplianceSummary;
}

export function CinSummaryCards({ summary }: CinSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4" data-testid="cin-summary-cards">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Validi</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{summary.valid}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Mancanti</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{summary.missing}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Non validi</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{summary.invalid}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Giorni alla scadenza</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold" data-testid="cin-days-until-deadline">
          {summary.daysUntilDeadline}
        </CardContent>
      </Card>
    </div>
  );
}
