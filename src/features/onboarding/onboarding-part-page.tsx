import { useMemo, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useWizardDraft } from '@/hooks/use-wizard-draft';
import { useWorkspace } from '@/hooks/use-workspace';
import { flowOfPart } from '@/lib/onboarding-flows';
import { resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import {
  ONBOARDING_PLAN_PATH,
  isOnboardingPartKey,
  isOnboardingPartReason,
  knownParts,
  needKey,
  normalizePartState,
  partTitleKey,
  partsWaitedFor,
  partWhatKey,
  reasonKey,
  stateKey,
} from '@/lib/onboarding-parts';
import { cn } from '@/lib/utils';
import { useOnboardingPlan } from '@/queries/use-onboarding-plan';
import { PartEntryQuestion } from './components/part-entry-question';
import { PartLaunchPanel } from './components/part-launch-panel';
import { PartPropertyTable } from './components/part-property-table';

/**
 * `/app/short-rent/onboarding/parts/:partKey`: one part of the plan «Inizia con CasaZen» (E10/F03/US02/T02, NF-104): what it does, what the host needs at
 * hand, where it stands, the properties it is about and the one button that opens the wizard that owns it. Each part opens the wizard of its epic (the
 * launch registry resolves it against the manifest) and comes back to the plan; nothing is re-implemented here, and nothing is lost on the way because
 * the state is derived by the server on every read. The first part asks «Dove si trovano oggi i tuoi annunci?» and always enters the connect wizard of
 * E02. An address that names no part leads to the plan. In no menu.
 */
export function OnboardingPartPage() {
  const { t, i18n } = useTranslation();
  const { partKey } = useParams();
  const { hasPermission } = useWorkspace();
  const plan = useOnboardingPlan();
  const known = isOnboardingPartKey(partKey);
  const parts = useMemo(() => knownParts(plan.data), [plan.data]);
  const part = parts.find((candidate) => candidate.code === partKey);
  // The answer the host gave to the first question (the draft of the wizard of E02): Police and ISTAT default to «Fallo per me» only for «new».
  const draft = useWizardDraft('octorate-connect', { server: { type: 'OnboardingActivation' }, enabled: partKey === 'compliance' });

  if (!known) return <Navigate to={ONBOARDING_PLAN_PATH} replace />;
  // An answer that holds no such part (the server knows less than the address): the plan.
  if (plan.isSuccess && !part) return <Navigate to={ONBOARDING_PLAN_PATH} replace />;

  const state = part ? normalizePartState(part.state) : 'open';
  const flow = flowOfPart(partKey);
  // The launch that the plan names for the part, resolved against the manifest; the reopen of the backend may name another target for a part that is done.
  const launch = part ? resolveLaunchTarget(part.launchTarget, null, null, hasPermission) : null;
  const waiting = state === 'blocked' || state === 'notAvailable' || state === 'done';
  // What is missing, in plain words; a part that waits for others names them, and a reason this version has no text for reads as a neutral line.
  const waitedFor = part ? partsWaitedFor(part, parts).map((waited) => t(partTitleKey(waited.code))).join(', ') : '';
  const reason = part && state !== 'done' ? (isOnboardingPartReason(part.reason) && i18n.exists(reasonKey(part.reason)) ? t(reasonKey(part.reason), { parts: waitedFor }) : t('onboardingPlan.reasons.unknown')) : null;
  const assistFirst = partKey === 'compliance' && draft.restored?.values.scenario === 'newInventory';

  let content: ReactNode;
  if (plan.isLoading) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="onboarding-part-loading">
        <span className="sr-only">{t('onboardingPlan.loading')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (plan.isError && !plan.data) {
    content = <ErrorState testId="onboarding-part-error" title={t('onboardingPlan.loadError')} error={plan.error} onRetry={() => void plan.refetch()} showSupport />;
  } else if (part) {
    content = (
      <>
        <section className="min-w-0 space-y-2 rounded-lg border p-4" aria-label={t('onboardingPlan.part.statusLabel')} data-testid="onboarding-part-status" data-state={state}>
          <p className="break-words text-sm text-foreground/70">{t(partWhatKey(part.code))}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold" data-testid="onboarding-part-state">
              {t(stateKey(state))}
            </span>
            {part.total > 0 ? <span data-testid="onboarding-part-progress">{t('onboardingPlan.progress', { done: part.done, total: part.total })}</span> : null}
          </p>
          {reason ? (
            <p className="break-words text-sm" data-testid="onboarding-part-reason">
              {reason}
            </p>
          ) : null}
          {Array.isArray(part.needs) && part.needs.length > 0 ? (
            <div className="space-y-1 pt-1" data-testid="onboarding-part-needs">
              <p className="text-sm font-semibold">{t('onboardingPlan.part.needsTitle')}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm" role="list">
                {part.needs.map((code) => (
                  <li key={code} className="break-words">
                    {t(needKey(code))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {part.code === 'octorateConnection' && !waiting ? <PartEntryQuestion /> : null}

        <PartLaunchPanel launch={launch} resuming={state === 'deferred' || (part.done > 0 && part.done < part.total)} blocked={waiting} />

        {flow && !waiting ? <PartPropertyTable flow={flow} target={part.launchTarget} panelSteps={part.code === 'compliance'} assistFirst={assistFirst} /> : null}
      </>
    );
  }

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="onboarding-part-page">
        <PageHeader title={t(partTitleKey(partKey))} description={t('onboardingPlan.part.description')} />
        {content}
      </div>
    </AppShell>
  );
}
