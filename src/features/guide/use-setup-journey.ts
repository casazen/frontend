import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GuidePathState } from '@/components/shared/calm';
import { useWorkspace } from '@/hooks/use-workspace';
import { activationStepCtaKey, activationStepLinkState, activationStepRoute } from '@/lib/activation-routes';
import { nextActionableStep, normalizeSteps } from '@/lib/activation-steps';
import { ONBOARDING_PLAN_PATH, knownParts, partPath, pathStepTitleKey, stepTargetPart } from '@/lib/onboarding-parts';
import { useVisibleOnboardingPath } from '@/queries/use-onboarding-path';
import { useOnboardingPlan } from '@/queries/use-onboarding-plan';
import { useOnboardingStatus } from '@/queries/use-onboarding-status';

/** One stop of the setup, as the guide draws it. */
export interface SetupJourneyStep {
  id: string;
  /** The name of the step, translated. */
  title: string;
  state: GuidePathState;
  /** Where the step is done: only for the step to do now, and only when the person may open that page. */
  href?: string;
  /** Router state for `href` (the account step tells the onboarding it came to finish a step). */
  linkState?: unknown;
  /** The words of the button of the step, translated. */
  cta?: string;
}

/** The setup of the host as one road: where it stands, the steps and the one to do now. */
export interface SetupJourney {
  /** `path`: the path «Inizia con CasaZen» of the activation with Octorate. `checklist`: the activation checklist of the booking site. */
  source: 'path' | 'checklist';
  steps: SetupJourneyStep[];
  done: number;
  total: number;
  /** The step to do now; null when what is left waits for something else (or was put off). */
  current: SetupJourneyStep | null;
  /** The page with every step and its details, when there is one (the plan of «Inizia con CasaZen»). */
  allHref: string | null;
}

/**
 * The setup of the host as one road (the guide): the path «Inizia con CasaZen» while the activation with Octorate is on and the person is the
 * organization administrator (it is theirs to walk, `useVisibleOnboardingPath`), otherwise the activation checklist of the booking site
 * (`GET /onboarding/status`). It only reads what the home already reads, in the same cache, and decides nothing the server did not say: the
 * step to do now is the `next` of the path (and its part that can be done now, from the plan) or the first open step of the checklist.
 *
 * `journey` is null once the setup is complete, while it loads and when it cannot be read: the guide then says nothing about the setup.
 * `pending` is true only while it loads.
 */
export function useSetupJourney(options: { enabled?: boolean } = {}): { journey: SetupJourney | null; pending: boolean } {
  const enabled = options.enabled ?? true;
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const visible = useVisibleOnboardingPath({ enabled });
  const path = enabled ? visible.path : null;
  const next = path?.next ?? null;
  // The step is made of parts and only the plan tells which one is still to do (as the card of the path on the home).
  const plan = useOnboardingPlan({ enabled: enabled && next !== null });
  // The checklist is read only when there is no path to show (the flag is off, or the person is not the administrator).
  const useChecklist = enabled && !visible.pending && path === null;
  const status = useOnboardingStatus(useChecklist);

  return useMemo(() => {
    if (!enabled) return { journey: null, pending: false };
    if (visible.pending) return { journey: null, pending: true };

    if (path) {
      if (next !== null && plan.isPending) return { journey: null, pending: true };
      const target = next ? stepTargetPart(next, knownParts(plan.data)) : null;
      const steps: SetupJourneyStep[] = path.steps
        // A step nobody provides yet can never be done: it is not a stop of the road (`pathProgress` does not count it either).
        .filter((step) => step.state !== 'notAvailable')
        .map((step) => {
          const isCurrent = next !== null && step.code === next.code;
          return {
            id: step.code,
            title: t(pathStepTitleKey(step.code)),
            state: step.state === 'done' ? 'done' : isCurrent ? 'current' : 'upcoming',
            ...(isCurrent && target ? { href: partPath(target), cta: t('guide.setup.continue') } : {}),
          };
        });
      return {
        journey: {
          source: 'path',
          steps,
          done: path.done,
          total: path.total,
          current: steps.find((step) => step.state === 'current') ?? null,
          allHref: ONBOARDING_PLAN_PATH,
        },
        pending: false,
      };
    }

    if (status.isPending) return { journey: null, pending: useChecklist };
    const checklist = normalizeSteps(status.data);
    const nextStep = nextActionableStep(checklist);
    if (checklist.length === 0 || !nextStep) return { journey: null, pending: false };

    const steps: SetupJourneyStep[] = checklist.map((step) => {
      const isCurrent = step.key === nextStep.key;
      const route = isCurrent ? activationStepRoute(step, hasPermission) : null;
      return {
        id: step.key,
        title: t(`activation.steps.${step.key}.title`),
        state: step.state === 'done' ? 'done' : isCurrent ? 'current' : 'upcoming',
        ...(route ? { href: route, linkState: activationStepLinkState(step), cta: t(activationStepCtaKey(step)) } : {}),
      };
    });
    const done = checklist.filter((step) => step.state === 'done').length;
    return {
      journey: {
        source: 'checklist',
        steps,
        done,
        total: checklist.length,
        current: steps.find((step) => step.state === 'current') ?? null,
        allHref: null,
      },
      pending: false,
    };
  }, [enabled, visible.pending, path, next, plan.isPending, plan.data, status.isPending, status.data, useChecklist, hasPermission, t]);
}
