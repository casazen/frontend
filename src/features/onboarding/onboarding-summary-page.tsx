import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Rocket } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { ONBOARDING_FLOW_KEYS, type OnboardingFlowKey } from '@/types/onboarding.types';
import { ActivationDialog } from './components/activation-dialog';
import { FinalTestPanel } from './components/final-test-panel';
import { FlowStatusTable } from './components/flow-status-table';

/** The flow an address names (`?flow=`, the target of the «Da fare» of a flow), whatever the case; `null` for anything else. */
function requestedFlow(value: string | null): OnboardingFlowKey | null {
  return ONBOARDING_FLOW_KEYS.find((flow) => flow.toLowerCase() === value?.trim().toLowerCase()) ?? null;
}

/**
 * `/app/short-rent/onboarding/summary`: the last part of the plan, «Riepilogo e attivazione» (E10/F03/US02/T03, NF-104 part 11, NF-106): the traffic light
 * of each flow on each property, the final read-only test and the activation with a confirmation. What is not ready is in «Da fare» (the server keeps it
 * there), and each property that is not has its own «Fai ora». `?flow=` opens the table on that flow's properties still to complete.
 *
 * The table is readable by anyone who can read the properties. The test and the activation are decisions of the organization administrator (the server
 * asks `OrgBillingAdmin`): anyone else is told who does them, with no button to press and no 403 to meet. In no menu.
 */
export function OnboardingSummaryPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const [activating, setActivating] = useState(false);

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-8')} data-testid="onboarding-summary-page">
        <PageHeader title={t('onboardingPlan.summary.title')} description={t('onboardingPlan.summary.description')} />

        <FlowStatusTable initialFlow={requestedFlow(searchParams.get('flow'))} />

        {isAdmin ? (
          <>
            <FinalTestPanel />
            <section className="min-w-0 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-labelledby="summary-activate-title" data-testid="summary-activation">
              <h2 id="summary-activate-title" className="text-lg font-semibold">
                {t('onboardingPlan.summary.activate.title')}
              </h2>
              <p className="text-sm text-foreground/70">{t('onboardingPlan.summary.activate.text')}</p>
              <Button type="button" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight" onClick={() => setActivating(true)} iconRight={<Rocket />} data-testid="summary-activate">
                {t('onboardingPlan.summary.activate.action')}
              </Button>
            </section>
            <ActivationDialog open={activating} onOpenChange={setActivating} />
          </>
        ) : (
          <p className="text-sm text-foreground/70" data-testid="summary-admin-only">
            {t('onboardingPlan.summary.adminOnly')}
          </p>
        )}
      </div>
    </AppShell>
  );
}
