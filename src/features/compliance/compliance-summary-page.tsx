import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AutopilotDialog } from '@/features/compliance/autopilot/autopilot-dialog';
import { autopilotRelevant } from '@/features/compliance/autopilot/autopilot-model';
import { ComplianceSummaryWidget } from '@/features/compliance/compliance-summary-widget';
import { useComplianceSummary } from '@/features/compliance/use-compliance';
import { useWorkspace } from '@/hooks/use-workspace';

const countOf = (section: { count?: number } | null | undefined): number => (typeof section?.count === 'number' ? section.count : 0);

export function ComplianceSummaryPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const summary = useComplianceSummary();
  const [autopilotOpen, setAutopilotOpen] = useState(false);

  // «Gestisci con AI» changes stays (it closes departures and asks the guests for their data): only for whoever may write bookings. Its
  // button is on the page while the cockpit holds a stay it can look at; the layer stays mounted, so the result of a run that clears the
  // list is not lost with the button.
  const canWrite = hasPermission('short-rent', 'booking.write');
  const showAutopilot = canWrite && autopilotRelevant(summary.data);

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="compliance-summary-page">
        <PageHeader
          title={t('compliance.page.title')}
          description={t('compliance.page.description')}
          crumbs="auto"
          primary={
            showAutopilot
              ? { label: t('compliance.autopilot.button'), icon: Sparkles, onClick: () => setAutopilotOpen(true), testId: 'compliance-autopilot-open' }
              : undefined
          }
        />
        <ComplianceSummaryWidget />
        {canWrite ? (
          <AutopilotDialog
            open={autopilotOpen}
            onOpenChange={setAutopilotOpen}
            hostOnly={{ activation: countOf(summary.data?.propertiesPending), turnovers: countOf(summary.data?.turnoversPending) }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
