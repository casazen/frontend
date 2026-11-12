import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import {
  isPanelStepKind,
  isStepId,
  panelKindOfSlug,
  panelPartOf,
  panelStepPath,
  panelTextKind,
  readPanelStepCallback,
  withoutPanelStepCallback,
} from '@/lib/onboarding-panel';
import { ONBOARDING_PLAN_PATH, partPath } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useCompletePanelStepCallback, usePanelSteps } from '@/queries/use-onboarding-panel-step';
import { OctoratePanelStep } from './components/octorate-panel-step';

/** At least 44 px high on every device (the product rule), and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/**
 * The end of a panel that sends the person back to CasaZen (`?step=<id>&state=<state>`): the state is taken out of the address at once and sent
 * in the body, once; the server then verifies the step, which the page shows as any other result. Nothing of it is logged or kept.
 */
function usePanelStepCallback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [callback] = useState(() => readPanelStepCallback(searchParams));
  const { mutate: complete, isSuccess, isError, error } = useCompletePanelStepCallback();
  const handled = useRef(false);

  useEffect(() => {
    if (!callback || handled.current) return;
    handled.current = true;
    setSearchParams((previous) => withoutPanelStepCallback(previous), { replace: true });
    complete({ id: callback.stepId, state: callback.state });
  }, [callback, complete, setSearchParams]);

  // Pending from the first render of a visit that came back from the panel (before the call leaves, while it is on its way): the step is shown once it ended.
  return { returned: callback !== null, pending: callback !== null && !isError && !isSuccess, error: isError ? error : null };
}

interface PanelPageProps {
  children: ReactNode;
  title: string;
  description?: string;
  /** Where «Torna al piano» leads: the plan, or the part the step belongs to. */
  backTo?: string;
}

/** The frame of the pages of a guided step: the title, the way back to the plan, and the content. */
function PanelPage({ children, title, description, backTo = ONBOARDING_PLAN_PATH }: PanelPageProps) {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="onboarding-panel-step-page">
        <PageHeader
          title={title}
          description={description}
          action={
            <Button asChild variant="ghost" className={TOUCH_TARGET}>
              <Link to={backTo} data-testid="panel-step-back">
                {t('onboardingPlan.panel.page.backToPlan')}
              </Link>
            </Button>
          }
        />
        {children}
      </div>
    </AppShell>
  );
}

/**
 * `/app/short-rent/onboarding/panel/:kind` (`police`, `istat` or `channel-access`; query `propertyId` and `channelCode`): a step that Octorate allows
 * only from its panel, guided from CasaZen (E10/F03/US02/T01, NF-107). The plan, the parts and the «Da fare» of a step left half way lead here, and
 * the page leads on to the part the step belongs to once it is done. In no menu.
 *
 * The panel steps and the «Do it for me» request are decisions of the organization administrator (the server asks `OrgBillingAdmin`): anyone else is
 * told who does this step, with no button to press and no 403 to meet. «Salva ed esci» leaves the step as it is: its «Da fare» was raised when it
 * was started.
 */
export function OnboardingPanelStepPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kind: slug } = useParams();
  const [searchParams] = useSearchParams();
  const { contexts, getDefaultRoute } = useWorkspace();
  const callback = usePanelStepCallback();

  const kind = panelKindOfSlug(slug);
  if (!kind) return <Navigate to={ONBOARDING_PLAN_PATH} replace />;

  const textKind = panelTextKind(kind);
  const part = panelPartOf(kind);
  const propertyId = searchParams.get('propertyId')?.trim() || null;
  const channelCode = kind === 'channelAccess' ? searchParams.get('channelCode')?.trim() || null : null;
  // «Fallo per me» first: the part page sends the host who has new properties here (PO-19), where CasaZen support does the panel step.
  const assistFirst = searchParams.get('assist') === '1';
  const isAdmin = isOrgBillingAdmin(contexts);

  function saveAndExit() {
    toast.success(t('onboardingPlan.exit.saved'));
    navigate(getDefaultRoute('short-rent'));
  }

  let content: ReactNode;
  if (!isAdmin) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="panel-step-admin-only">
        {t('onboardingPlan.panel.adminOnly')}
      </p>
    );
  } else if (kind === 'channelAccess' && !channelCode) {
    // A channel access is about one channel: without it there is nothing to open, and the server would answer 422.
    content = (
      <Alert variant="warning" data-testid="panel-step-channel-missing">
        {t('onboardingPlan.panel.channelMissing')}
      </Alert>
    );
  } else if (callback.pending) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="panel-step-returning">
        <span className="sr-only">{t('onboardingPlan.panel.returning')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else {
    content = (
      <>
        {callback.error ? (
          <Alert variant="danger" data-testid="panel-step-callback-error">
            {getProblemMessage(callback.error, t) ?? t('onboardingPlan.panel.errors.callback')}
          </Alert>
        ) : null}
        <OctoratePanelStep
          kind={kind}
          propertyId={propertyId}
          channelCode={channelCode}
          cameFromPanel={callback.returned}
          assistFirst={assistFirst}
          onRecovered={() => navigate(partPath(part))}
          onSaveAndExit={saveAndExit}
        />
      </>
    );
  }

  return (
    <PanelPage
      title={t(`onboardingPlan.panel.${textKind}.title`)}
      description={t(`onboardingPlan.panel.${textKind}.description`)}
      backTo={partPath(part)}
    >
      {content}
    </PanelPage>
  );
}

/**
 * `/app/short-rent/onboarding/panel?step=<id>`: where the «Da fare» of a guided step left half way leads (the item knows the id of the step, not its
 * kind). It reads the steps of the org, finds that one and opens its page, keeping the single-use state of a callback if the address brought one;
 * a step that no longer exists leads back to the plan. Anyone who is not the organization administrator is told who does the step.
 */
export function OnboardingPanelResumePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const stepId = searchParams.get('step')?.trim() ?? null;
  const steps = usePanelSteps(undefined, { enabled: isAdmin && isStepId(stepId) });

  if (!isAdmin) {
    return (
      <PanelPage title={t('onboardingPlan.panel.page.resumeTitle')}>
        <p className="text-sm text-foreground/70" data-testid="panel-step-admin-only">
          {t('onboardingPlan.panel.adminOnly')}
        </p>
      </PanelPage>
    );
  }
  if (!isStepId(stepId)) return <Navigate to={ONBOARDING_PLAN_PATH} replace />;

  if (steps.isPending) {
    return (
      <PanelPage title={t('onboardingPlan.panel.page.resumeTitle')}>
        <div role="status" aria-busy="true" className="space-y-3" data-testid="panel-step-resuming">
          <span className="sr-only">{t('onboardingPlan.panel.returning')}</span>
          <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        </div>
      </PanelPage>
    );
  }
  if (steps.isError) {
    return (
      <PanelPage title={t('onboardingPlan.panel.page.resumeTitle')}>
        <ErrorState testId="panel-step-resume-error" title={t('onboardingPlan.panel.errors.load')} error={steps.error} onRetry={() => void steps.refetch()} showSupport />
      </PanelPage>
    );
  }

  const found = steps.data.find((candidate) => candidate.id.toLowerCase() === stepId.toLowerCase());
  if (!found || !isPanelStepKind(found.kind)) return <Navigate to={ONBOARDING_PLAN_PATH} replace />;

  // The callback (`state`) goes along: the page of the kind is the one that uses it, once.
  const target = panelStepPath({ kind: found.kind, propertyId: found.propertyId, channelCode: found.channelCode });
  const state = searchParams.get('state');
  const carried = state ? `${target}${target.includes('?') ? '&' : '?'}step=${encodeURIComponent(stepId)}&state=${encodeURIComponent(state)}` : target;
  return <Navigate to={carried} replace />;
}
