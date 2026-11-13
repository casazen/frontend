import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAgencyPlan } from '@/hooks/use-agency-plan';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { AgencyAdminRequired } from './agency-admin-required';

/** The page where an organization changes its plan (the billing page of the account area). */
const PLAN_PATH = '/app/account/billing';

interface AgencyFinanceGateProps {
  /** The test id of the page, kept whatever the gate says. */
  testId: string;
  title: string;
  description: string;
  /** What the skeleton says while the plan of the organization is on its way. */
  loadingLabel: string;
  children: ReactNode;
}

/**
 * The door of the pages of the agency's money (the statements, the withholding, the wire files): they open only for the owner and the administrators of an
 * organization that is on the agency plan, as the backend asks (`agency.*` permissions and the agency tier). Anyone else is told so, and NOTHING is read: the
 * backend answers a bare 403 to a read it refuses, and the shared client sends the whole app to the page of no access on a 403 for a read. The role comes first
 * because the plan is read from an endpoint of the billing administrator, which anyone else would be refused in the same way. While the plan is on its way the
 * page waits; a plan that could not be read is told as such (never as «not on the agency plan»).
 */
export function AgencyFinanceGate({ testId, title, description, loadingLabel, children }: AgencyFinanceGateProps) {
  const { contexts } = useWorkspace();
  const shell = (content: ReactNode) => (
    <div className="space-y-6" data-testid={testId}>
      <PageHeader title={title} description={description} crumbs="auto" />
      {content}
    </div>
  );

  if (!isOrgBillingAdmin(contexts)) return shell(<AgencyAdminRequired />);
  return (
    <PlanGate shell={shell} loadingLabel={loadingLabel}>
      {children}
    </PlanGate>
  );
}

interface PlanGateProps {
  shell: (content: ReactNode) => ReactNode;
  loadingLabel: string;
  children: ReactNode;
}

function PlanGate({ shell, loadingLabel, children }: PlanGateProps) {
  const { t } = useTranslation();
  const plan = useAgencyPlan();

  if (plan.isLoading) return shell(<SkeletonCard lines={3} label={loadingLabel} />);
  if (plan.failed) return shell(<ErrorState title={t('agencyFinance.planError')} onRetry={plan.retry} />);
  if (!plan.isAgency) return shell(<AgencyPlanRequired />);
  return <>{children}</>;
}

function AgencyPlanRequired() {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid="agency-plan-required" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="font-medium">{t('agencyFinance.planRequired.title')}</p>
          <p className="text-foreground/70">{t('agencyFinance.planRequired.description')}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={PLAN_PATH}>{t('agencyFinance.planRequired.action')}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Shown when the server itself refuses a page's first read (403) although the person and the plan looked right here (a role or a plan that changed since the
 * page was drawn): the read accepts the refusal, so the app stays where it is, and the page says that the access is not there.
 */
export function AgencyAccessRefused() {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid="agency-access-refused" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t('agencyFinance.refused.title')}</p>
        <p className="text-foreground/70">{t('agencyFinance.refused.description')}</p>
      </div>
    </div>
  );
}
