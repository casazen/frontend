import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { commercialPartAllowed, commercialRouteAllowed } from './commercial-access';
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, CircleHelp, ListChecks } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isEntryFeatureEnabled } from '@/config/route-manifest';
import { supportConfig } from '@/config/support.config';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { BULK_OFFER_ABOVE, ONBOARDING_BULK_PATH, firstOpenPart, knownNeeds, knownParts, normalizePartState, partsWaitedFor } from '@/lib/onboarding-parts';
import { resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useFlowSummaries } from '@/queries/use-onboarding-flows';
import { useOrgComplianceSender } from '@/queries/use-org-compliance-sender';
import { clearPlanResume, savePlanResume } from './plan-resume';
import { useExitPart, useOnboardingPlan } from '@/queries/use-onboarding-plan';
import type { OnboardingPart } from '@/types/onboarding.types';
import { OnboardingDeferDialog } from './components/onboarding-defer-dialog';
import { OnboardingNeedsPanel } from './components/onboarding-needs-panel';
import { OnboardingPartRow } from './components/onboarding-part-row';
import { OrgSenderPreference } from './components/org-sender-preference';
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
  const { hash } = useLocation();
  const handledAnchor = useRef('');
  const focusAfterSenderSave = useRef(false);
  const nextPanel = useRef<HTMLElement>(null);
  const { contexts, getDefaultRoute, hasPermission } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { flags } = useFeatureFlags();
  // The owner step (NF-109) exists only for an org on the agency plan (the flag here, the plan of the org in `OwnerStep`) whose administrator may read the owners:
  // otherwise nothing of it is drawn or read.
  const showOwnerStep = flags.agencyTier && isAdmin;
  const plan = useOnboardingPlan();
  const sender = useOrgComplianceSender(isAdmin);
  const senderMissing = isAdmin && sender.data?.sender === null && !sender.isError;
  const senderPrimary = isAdmin && (sender.isPending || senderMissing);
  // The offer of the bulk configuration is the administrator's (the page is, and the server asks `OrgBillingAdmin`): nobody else asks for the counts.
  const flowSummaries = useFlowSummaries({ enabled: isAdmin });
  const exit = useExitPart();
  const adminNoteId = useId();
  const [deferring, setDeferring] = useState<Deferring | null>(null);

  const commercial = useCommercialProfile();
  const userId = commercial?.id;
  const orgId = commercial?.org?.id ?? commercial?.orgId;
  const parts = useMemo(() => knownParts(plan.data).filter(part => commercialPartAllowed(commercial, part.code)), [plan.data, commercial]);
  const needs = useMemo(() => knownNeeds(plan.data), [plan.data]);
  function mayLaunch(part: OnboardingPart) {
    const destination = resolveLaunchTarget(part.launchTarget, null, null, hasPermission, part.reason, flags);
    return Boolean(destination && isEntryFeatureEnabled(destination.entry, flags) && commercialRouteAllowed(commercial, destination.entry.path));
  }
  const focus = plan.isError ? null : firstOpenPart(parts.filter(mayLaunch));
  const featured = senderPrimary ? null : focus;
  const requested = hash.startsWith('#passo-') ? parts.find(part => `#passo-${part.code}` === hash) : undefined;
  const requestedAvailable = requested && mayLaunch(requested) && (requested.state === 'open' || (requested.state === 'deferred' && !partsWaitedFor(requested, parts).length)) ? requested : null;
  const exitPart = requestedAvailable?.state === 'open' ? requestedAvailable : focus;
  const available = parts.filter(part => normalizePartState(part.state) !== 'notAvailable');
  const complete = available.filter(part => normalizePartState(part.state) === 'done').length;
  // Every flow counts every property the caller reaches (each is in exactly one state of each flow), so the largest total is the number of properties.
  const propertyCount = (flowSummaries.data ?? []).reduce((largest, summary) => Math.max(largest, Number.isFinite(summary.total) ? summary.total : 0), 0);
  const offerBulk = isAdmin && propertyCount > BULK_OFFER_ABOVE;
  const showOutline = parts.some(part => part.code !== featured?.code) || showOwnerStep || offerBulk;

  /** The home of the host: the plan is a page of Affitti brevi. */
  const home = getDefaultRoute('short-rent');

  useEffect(() => {
    if (!hash || plan.isPending || plan.isError || (isAdmin && sender.isPending)) return;
    const scope = JSON.stringify([userId, orgId, hash]);
    if (handledAnchor.current === scope) return;
    const requestedId = hash === '#mittente' && senderMissing ? 'mittente' : requestedAvailable ? `passo-${requestedAvailable.code}` : null;
    const fallback = senderMissing ? 'mittente' : featured ? `passo-${featured.code}` : 'piano-configurazione';
    const target = document.getElementById(requestedId ?? fallback);
    if (target) {
      handledAnchor.current = scope;
      const outline = target.closest('details');
      if (outline) outline.open = true;
      target.focus();
      target.scrollIntoView?.({ block: 'nearest' });
    }
  }, [hash, plan.isPending, plan.isError, isAdmin, sender.isPending, senderMissing, requestedAvailable, featured, userId, orgId]);

  useEffect(() => {
    if (!focusAfterSenderSave.current || senderPrimary || plan.isPending) return;
    focusAfterSenderSave.current = false;
    // The first link is the featured task. A finished or waiting plan has only its heading.
    const destination = nextPanel.current?.querySelector<HTMLAnchorElement>('a[href]')
      ?? nextPanel.current?.querySelector<HTMLHeadingElement>('h2')
      ?? document.getElementById('org-sender-title');
    destination?.focus();
  }, [senderPrimary, plan.isPending]);

  function goHome() {
    const resume = requestedAvailable?.code ?? (senderMissing ? 'mittente' : focus?.code);
    if (isAdmin && resume) savePlanResume(userId, orgId, resume);
    else if (isAdmin && plan.isSuccess && sender.isSuccess) clearPlanResume(userId, orgId);
    navigate(home);
  }

  function saveAndExit() {
    if (!isAdmin || !exitPart) {
      goHome();
      return;
    }
    exit.mutate(exitPart.code, {
      onSuccess: () => {
        toast.success(t('onboardingPlan.exit.saved'));
        goHome();
      },
      onError: (error) => toast.error(getProblemMessage(error, t) ?? t('onboardingPlan.exit.error')),
    });
  }

  function partRow(part: OnboardingPart, highlighted = false) {
    return <OnboardingPartRow
      part={part} parts={parts} highlighted={highlighted} canLaunch={mayLaunch(part)} canDefer={isAdmin}
      adminNoteId={adminNoteId} onDefer={chosen => setDeferring({ part: chosen, open: true })}
    />;
  }

  const helpEmail = supportConfig.email;
  const panel = 'min-w-0 rounded-xl border bg-card';
  const mainTask = 'order-1 lg:col-start-1 lg:row-start-1 lg:row-span-3';
  const planReady = plan.isSuccess && parts.length > 0;

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
  } else if (plan.isError) {
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
      <details id="piano-configurazione" tabIndex={-1} className={cn(panel, 'group/plan order-5 scroll-mt-5 lg:col-span-2')} data-testid="onboarding-plan-outline">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary sm:px-5 [&::-webkit-details-marker]:hidden">
          <ListChecks className="size-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <span className="min-w-0 flex-1 font-semibold">{t(featured ? 'onboardingPlan.workspace.otherSteps' : 'onboardingPlan.workspace.allSteps')}</span>
          <ChevronDown className="size-4 shrink-0 text-foreground/70 group-open/plan:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t px-4 py-2 sm:px-5">
          {!isAdmin && <p id={adminNoteId} className="pt-2 text-sm text-foreground/70" data-testid="onboarding-plan-admin-note">{t('onboardingPlan.defer.adminOnly')}</p>}
          <ol role="list" aria-label={t('onboardingPlan.listLabel')} className="divide-y" data-testid="onboarding-plan-parts">
            {parts.map(part => <Fragment key={part.code}>
              {part.code !== featured?.code && partRow(part)}
              {showOwnerStep && part.code === 'properties' && <OwnerStep />}
            </Fragment>)}
            {showOwnerStep && !parts.some(part => part.code === 'properties') && <OwnerStep />}
          </ol>
          {offerBulk && <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" data-testid="onboarding-plan-bulk">
            <div className="min-w-0">
              <h2 className="font-semibold">{t('onboardingPlan.bulk.entry.title')}</h2>
              <p className="max-w-prose text-sm text-foreground/70">{t('onboardingPlan.bulk.entry.text')}</p>
            </div>
            <Button asChild variant="outline" className={TOUCH_TARGET}>
              <Link to={ONBOARDING_BULK_PATH} data-testid="onboarding-plan-bulk-link">{t('onboardingPlan.bulk.entry.action')}</Link>
            </Button>
          </section>}
        </div>
      </details>
    );
  }

  const senderPanel = isAdmin && (
    <div key="sender" id="mittente" tabIndex={-1} className={cn(panel, 'scroll-mt-5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
      senderPrimary ? `${mainTask} p-4 shadow-sm sm:p-6` : 'order-4 p-4 lg:col-start-2 lg:row-start-3')} data-testid="onboarding-plan-sender">
      <OrgSenderPreference onFirstSaved={() => { focusAfterSenderSave.current = true; }} />
    </div>
  );
  const currentPanel = planReady && (
    <section key="next" ref={nextPanel} className={cn(panel, mainTask, 'space-y-4 p-4 shadow-sm sm:p-6')} data-testid="onboarding-plan-current">
      <h2 tabIndex={-1} className="text-sm font-semibold text-primary-text">{t('onboardingPlan.workspace.upNext')}</h2>
      {featured ? <ol role="list">{partRow(featured, true)}</ol> :
        <p className="text-lg font-semibold">{t(available.length > 0 && complete === available.length ? 'onboardingPlan.workspace.finished' : 'onboardingPlan.workspace.waiting')}</p>}
    </section>
  );

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="onboarding-plan-page">
        <PageHeader
          title={t('onboardingPlan.workspace.title')}
          action={
            // Always there, on every state of the page: the way out and the way to ask for help (UX-06).
            <div role="group" aria-label={t('onboardingPlan.actions.group')} className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={saveAndExit} loading={exit.isPending} data-testid="onboarding-plan-exit">
                {t(senderMissing ? 'onboardingPlan.workspace.later' : isAdmin && exitPart ? 'onboardingPlan.exit.action' : 'onboardingPlan.backToHome')}
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

        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)] lg:gap-x-6">
          {senderPrimary ? senderPanel : currentPanel}

          {planReady && available.length > 0 && <div className={cn(panel, 'order-2 space-y-2 p-3 sm:p-4 lg:col-start-2 lg:row-start-1')}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{t('onboardingPlan.workspace.progress')}</h2>
              <span className="text-sm tabular-nums text-foreground/70">{t('onboardingPlan.workspace.progressCount', { done: complete, total: available.length })}</span>
            </div>
            <progress value={complete} max={available.length} aria-label={t('onboardingPlan.availableProgress', { done: complete, total: available.length })}
              className="block h-2 w-full overflow-hidden rounded-full bg-muted accent-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary" data-testid="onboarding-plan-progress" />
          </div>}

          {planReady && needs.length > 0 && <div className="order-3 lg:col-start-2 lg:row-start-2"><OnboardingNeedsPanel needs={needs} /></div>}
          {!senderPrimary && senderPanel}
          {planReady ? showOutline && content : <div className="order-5 lg:col-span-2">{content}</div>}
        </div>
      </div>

      <OnboardingDeferDialog
        part={deferring?.part ?? null}
        open={deferring?.open ?? false}
        onOpenChange={(open) => setDeferring((current) => (current ? { ...current, open } : null))}
      />
    </AppShell>
  );
}
