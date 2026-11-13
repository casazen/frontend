import { Fragment, useId, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CircleHelp } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supportConfig } from '@/config/support.config';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { firstOpenPart, knownNeeds, knownParts } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useExitPart, useOnboardingPlan } from '@/queries/use-onboarding-plan';
import type { OnboardingPart } from '@/types/onboarding.types';
import { OnboardingDeferDialog } from './components/onboarding-defer-dialog';
import { OnboardingNeedsPanel } from './components/onboarding-needs-panel';
import { OnboardingPartRow } from './components/onboarding-part-row';
import { OwnerStep } from './components/owner-step-row';

/** At least 44 px high on every device (the product rule), and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The window of «Lo faccio dopo» stays mounted while it closes, so the part it shows is kept apart from whether it is open. */
interface Deferring {
  part: OnboardingPart;
  open: boolean;
}

/**
 * `/app/short-rent/onboarding`, «Inizia con CasaZen» (NF-104, ONB-01, UX-06): the plan of the eleven parts that take a host from zero to
 * everything active. It only reads the plan and orchestrates: each part opens the wizard that owns it (its launcher, `partPath`), and the
 * plan is derived by the server on every read, so what other screens change shows up on the next visit. The first part that is open is the
 * one highlighted block, the other parts are plain rows.
 *
 * «Salva ed esci» and «Aiuto» are always on screen, whatever the state of the page (loading, error, loaded, read only). The deferral and the
 * exit are decisions of the organization administrator (the server asks `OrgBillingAdmin`): anyone else sees the plan, a deferral that says
 * why it is not for them instead of failing with a 403, and a «Salva ed esci» that only goes back to the home without calling the server.
 */
export function OnboardingPlanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contexts, getDefaultRoute } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { flags } = useFeatureFlags();
  // The owner step (NF-109) exists only for an org on the agency plan (the flag here, the plan of the org in `OwnerStep`) whose administrator may read the owners:
  // otherwise nothing of it is drawn or read.
  const showOwnerStep = flags.agencyTier && isAdmin;
  const plan = useOnboardingPlan();
  const exit = useExitPart();
  const adminNoteId = useId();
  const [deferring, setDeferring] = useState<Deferring | null>(null);

  const parts = useMemo(() => knownParts(plan.data), [plan.data]);
  const needs = useMemo(() => knownNeeds(plan.data), [plan.data]);
  const focus = firstOpenPart(parts);

  /** The home of the host: the plan is a page of Affitti brevi. */
  const home = getDefaultRoute('short-rent');

  function saveAndExit() {
    // What remains goes to «Da fare» through the part that is open (the server answers 403 to who is not an administrator): without such a
    // part, or without the right to, there is nothing to save and the person simply goes back.
    if (!isAdmin || !focus) {
      navigate(home);
      return;
    }
    exit.mutate(focus.code, {
      onSuccess: () => {
        toast.success(t('onboardingPlan.exit.saved'));
        navigate(home);
      },
      // Leaving without the «Da fare» would let what remains disappear silently: the person stays and is told.
      onError: (error) => toast.error(getProblemMessage(error, t) ?? t('onboardingPlan.exit.error')),
    });
  }

  const helpEmail = supportConfig.email;

  let content: ReactNode;
  if (plan.isLoading) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="onboarding-plan-loading">
        <span className="sr-only">{t('onboardingPlan.loading')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (plan.isError && !plan.data) {
    content = (
      <ErrorState
        testId="onboarding-plan-error"
        title={t('onboardingPlan.loadError')}
        error={plan.error}
        onRetry={() => void plan.refetch()}
        showSupport
      />
    );
  } else if (parts.length === 0) {
    // An answer with no part this version knows: nothing to show, said once, never an empty shell.
    content = (
      <p className="text-sm text-foreground/70" data-testid="onboarding-plan-empty">
        {t('onboardingPlan.empty')}
      </p>
    );
  } else {
    content = (
      <>
        <OnboardingNeedsPanel needs={needs} />

        {!isAdmin ? (
          <p id={adminNoteId} className="text-sm text-foreground/70" data-testid="onboarding-plan-admin-note">
            {t('onboardingPlan.defer.adminOnly')}
          </p>
        ) : null}

        <section aria-labelledby={`${adminNoteId}-list`} className="min-w-0">
          <h2 id={`${adminNoteId}-list`} className="sr-only">
            {t('onboardingPlan.listLabel')}
          </h2>
          <ol role="list" className="space-y-3" data-testid="onboarding-plan-parts">
            {parts.map((part) => (
              <Fragment key={part.code}>
                <OnboardingPartRow
                  part={part}
                  parts={parts}
                  highlighted={focus?.code === part.code}
                  canDefer={isAdmin}
                  adminNoteId={adminNoteId}
                  onDefer={(chosen) => setDeferring({ part: chosen, open: true })}
                />
                {/* After the reconciliation of the properties, before the fiscal documents and the summary: a plain row, never the highlighted block. */}
                {showOwnerStep && part.code === 'properties' ? <OwnerStep /> : null}
              </Fragment>
            ))}
            {showOwnerStep && !parts.some((part) => part.code === 'properties') ? <OwnerStep /> : null}
          </ol>
        </section>
      </>
    );
  }

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="onboarding-plan-page">
        <PageHeader
          title={t('onboardingPlan.title')}
          description={t('onboardingPlan.description')}
          action={
            // Always there, on every state of the page: the way out and the way to ask for help (UX-06).
            <div role="group" aria-label={t('onboardingPlan.actions.group')} className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={saveAndExit} loading={exit.isPending} data-testid="onboarding-plan-exit">
                {t('onboardingPlan.exit.action')}
              </Button>
              {helpEmail ? (
                <Button asChild variant="ghost" className={TOUCH_TARGET}>
                  <a href={`mailto:${helpEmail}`} data-testid="onboarding-plan-help">
                    <CircleHelp aria-hidden="true" className="size-4" />
                    {t('onboardingPlan.help.action')}
                  </a>
                </Button>
              ) : null}
            </div>
          }
        />

        {content}
      </div>

      <OnboardingDeferDialog
        part={deferring?.part ?? null}
        open={deferring?.open ?? false}
        onOpenChange={(open) => setDeferring((current) => (current ? { ...current, open } : null))}
      />
    </AppShell>
  );
}
