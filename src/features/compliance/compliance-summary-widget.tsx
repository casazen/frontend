import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight, ClipboardList, Home, LogOut, Send, Sparkles, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useComplianceSummary } from '@/features/compliance/use-compliance';
import { complianceActionRoute } from '@/lib/compliance-routes';
import { useWorkspace } from '@/hooks/use-workspace';
import { ALLOGGIATI_ATTENTION_CLASS } from '@/features/alloggiati/alloggiati-status.utils';
import type { ComplianceSummarySection } from '@/types/compliance.types';

interface SummaryRowProps {
  icon: React.ReactNode;
  title: string;
  section: ComplianceSummarySection;
  testId: string;
  /** `attention` (orange): the host must act, nothing is wrong yet. Default: red. */
  tone?: 'destructive' | 'attention';
}

function SummaryRow({ icon, title, section, testId, tone = 'destructive' }: SummaryRowProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const hasItems = section.count > 0;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <Badge
          variant={hasItems ? (tone === 'attention' ? 'warning' : 'destructive') : 'outline'}
          className={hasItems && tone === 'attention' ? ALLOGGIATI_ATTENTION_CLASS : undefined}
          data-testid={`${testId}-count`}
        >
          {section.count}
        </Badge>
      </div>
      {section.count > 0 && (
        <ul className="space-y-1">
          {section.items.map((item) => {
            // Built from the action and its target (CO-04): null when the user can open no page for it.
            const route = complianceActionRoute(item, hasPermission);
            return (
              <li key={`${item.action}-${item.id}`}>
                {route ? (
                  <Link
                    to={route}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors"
                    data-testid={`${testId}-link`}
                  >
                    <span className="truncate">{item.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : (
                  <span className="block truncate px-2 py-1.5 text-sm" data-testid={`${testId}-item`}>
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {section.count > section.items.length && (
        <p className="text-xs text-muted-foreground px-2" data-testid={`${testId}-more`}>
          {t('compliance.summary.moreItems', { count: section.count - section.items.length })}
        </p>
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
    data.alloggiatiFailures.count +
    data.alloggiatiManualRequired.count +
    (data.turnoversPending?.count ?? 0);

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
            {data.turnoversPending && (
              <SummaryRow
                icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
                title={t('compliance.summary.turnoversPending')}
                section={data.turnoversPending}
                testId="compliance-summary-turnovers"
                tone="attention"
              />
            )}
            <SummaryRow
              icon={<Send className="h-4 w-4 text-muted-foreground" />}
              title={t('compliance.summary.alloggiatiManualRequired')}
              section={data.alloggiatiManualRequired}
              testId="compliance-summary-alloggiati-manual"
              tone="attention"
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
