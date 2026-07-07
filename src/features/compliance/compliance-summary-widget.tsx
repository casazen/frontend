import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight, ClipboardList, Home, LogOut, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useComplianceSummary } from '@/features/compliance/use-compliance';
import { normalizeComplianceRouteLink } from '@/lib/compliance-routes';
import type { ComplianceSummarySection } from '@/types/compliance.types';

interface SummaryRowProps {
  icon: React.ReactNode;
  title: string;
  section: ComplianceSummarySection;
  testId: string;
}

function SummaryRow({ icon, title, section, testId }: SummaryRowProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <Badge variant={section.count > 0 ? 'destructive' : 'outline'} data-testid={`${testId}-count`}>
          {section.count}
        </Badge>
      </div>
      {section.count > 0 && (
        <ul className="space-y-1">
          {section.items.map((item) => (
            <li key={`${item.id ?? item.label}-${item.routeLink}`}>
              <Link
                to={normalizeComplianceRouteLink(item.routeLink)}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors"
                data-testid={`${testId}-link`}
              >
                <span className="truncate">{item.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {section.count === 0 && (
        <p className="text-xs text-muted-foreground px-2">{t('compliance.summary.none')}</p>
      )}
    </div>
  );
}

export function ComplianceSummaryWidget() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useComplianceSummary();

  if (isLoading) {
    return (
      <Card data-testid="compliance-summary-widget">
        <CardContent className="py-8">
          <LoadingScreen message={t('compliance.summary.loading')} />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card data-testid="compliance-summary-widget">
        <CardContent className="py-6 text-sm text-muted-foreground">
          {t('compliance.summary.error')}
        </CardContent>
      </Card>
    );
  }

  const total =
    data.propertiesPending.count +
    data.guestCheckInsIncomplete.count +
    data.checkoutsDue.count +
    data.alloggiatiFailures.count;

  return (
    <Card data-testid="compliance-summary-widget">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {t('compliance.summary.title')}
          </CardTitle>
          <CardDescription>{t('compliance.summary.description')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/short-rent/compliance">{t('compliance.summary.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{t('compliance.summary.allClear')}</p>
        ) : (
          <>
            <SummaryRow
              icon={<Home className="h-4 w-4 text-muted-foreground" />}
              title={t('compliance.summary.propertiesPending')}
              section={data.propertiesPending}
              testId="compliance-summary-properties"
            />
            <SummaryRow
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              title={t('compliance.summary.guestCheckIns')}
              section={data.guestCheckInsIncomplete}
              testId="compliance-summary-checkins"
            />
            <SummaryRow
              icon={<LogOut className="h-4 w-4 text-muted-foreground" />}
              title={t('compliance.summary.checkoutsDue')}
              section={data.checkoutsDue}
              testId="compliance-summary-checkouts"
            />
            <SummaryRow
              icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
              title={t('compliance.summary.alloggiatiFailures')}
              section={data.alloggiatiFailures}
              testId="compliance-summary-alloggiati"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
