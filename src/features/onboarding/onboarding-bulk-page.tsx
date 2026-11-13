import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useBulkProgress } from '@/queries/use-onboarding-bulk';
import { BulkImportPanel } from './components/bulk-import-panel';
import { BulkProgressCard } from './components/bulk-progress-card';
import { BulkSelectionPanel } from './components/bulk-selection-panel';
import { PilotGroupPanel } from './components/pilot-group-panel';

/**
 * `/app/short-rent/onboarding/bulk`, the bulk configuration (E10/F03/US03/T02, NF-105, ONB-02): an agency with many properties (250 is the case) configures them
 * without going through the wizard 250 times. At the top «142 di 250 pronte» with the counts of each flow, which follows what the agency does (read again every
 * 15 seconds while the page is open); then one choice applied to all the properties or to a selection, after a check that says what would change; then the data
 * that changes from one property to the next, filled from a file with the check of every row; and the pilot group, 5 to 10 properties activated before the others.
 *
 * Every choice is made by the owning service on the server, property by property: the page only collects the choice, shows what would happen and what happened,
 * and never lists a result of hundreds of rows at once (50 at a time). It is the organization administrator's page (the server asks `OrgBillingAdmin`, and answers 403
 * to anyone else): who is not one opens it and reads who manages it, with no request sent. Behind the flag `octorateOnboarding`, in no menu: the plan leads here
 * when the agency has more than 10 properties.
 */
export function OnboardingBulkPage() {
  const { t } = useTranslation();
  const { contexts, hasPermission } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const progress = useBulkProgress({ enabled: isAdmin });

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="onboarding-bulk-page">
        <PageHeader title={t('onboardingPlan.bulk.title')} description={t('onboardingPlan.bulk.description')} />
        {isAdmin ? (
          <>
            <BulkProgressCard progress={progress} />
            <BulkSelectionPanel />
            <BulkImportPanel />
            <PilotGroupPanel totalProperties={progress.data ? progress.data.total : null} canReadProperties={hasPermission('short-rent', 'property.read')} />
          </>
        ) : (
          <p className="text-sm text-foreground/70" data-testid="bulk-admin-only">
            {t('onboardingPlan.bulk.adminOnly')}
          </p>
        )}
      </div>
    </AppShell>
  );
}
