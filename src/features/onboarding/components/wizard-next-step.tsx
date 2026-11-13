import { useEffect, useId, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import {
  isPathIncomplete,
  knownParts,
  knownPathSteps,
  nextStepWhyKey,
  partPath,
  pathStepTitleKey,
  stepAfterPart,
  stepTargetPart,
} from '@/lib/onboarding-parts';
import { useDeferNextStep, useOnboardingPath, useOnboardingPathEnabled } from '@/queries/use-onboarding-path';
import { useOnboardingPlan } from '@/queries/use-onboarding-plan';
import type { OnboardingPartKey } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface WizardNextStepProps {
  /** The part of the plan whose wizard has just ended: the step that holds it is not suggested again. */
  currentPart: OnboardingPartKey;
}

/**
 * The end of a wizard of the path «Inizia con CasaZen» (UX-10, AC-NF10-2): ONE card with the next logical step (its name and one line on why),
 * a step that can be done now (one that waits for another part is not suggested: the part it waits for is the one to do), and two buttons.
 * «Continua» opens the part of that step that is still to do; «Più tardi» puts it in «Da fare» (the server leaves a reminder
 * for tomorrow at 09:00), says where it went with a toast and a line, and never suggests anything else: the step after it waits for the host
 * to come back to the path.
 *
 * It renders nothing while the flag `octorateOnboarding` is off, for anyone who is not an organization administrator (putting a step off is
 * their decision), while it loads, when it cannot be read and once the path is complete or has nothing left to suggest.
 */
export function WizardNextStep({ currentPart }: WizardNextStepProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const enabled = useOnboardingPathEnabled();
  const pathQuery = useOnboardingPath({ enabled });
  const steps = useMemo(() => knownPathSteps(pathQuery.data), [pathQuery.data]);
  const suggested = enabled && isPathIncomplete(steps) ? stepAfterPart(steps, currentPart) : null;
  // The plan says which part of the step is still to do, and whether it can be put off: without it the card would guess.
  const plan = useOnboardingPlan({ enabled: suggested !== null });
  const defer = useDeferNextStep();
  const doneRef = useRef<HTMLParagraphElement>(null);
  const putOff = defer.isSuccess;

  // The button that was pressed leaves with the card: the confirmation takes the focus, so the keyboard does not start again from the top.
  useEffect(() => {
    if (putOff) doneRef.current?.focus();
  }, [putOff]);

  if (putOff) {
    return (
      <p ref={doneRef} tabIndex={-1} className="rounded-lg bg-muted p-4 text-sm outline-none" data-testid="wizard-next-step-later">
        {t('onboardingPlan.nextStep.laterDone')}
      </p>
    );
  }

  if (!suggested || plan.isPending) return null;

  const parts = knownParts(plan.data);
  const target = stepTargetPart(suggested, parts);
  // No part to open: the plan says everything that is left of the step waits for another part (it changed since the path was read).
  const part = target ? parts.find((candidate) => candidate.code === target) : undefined;
  if (!target || !part) return null;

  function later() {
    if (!part) return;
    defer.mutate(part, {
      onSuccess: () => toast.success(t('onboardingPlan.nextStep.laterToast')),
      onError: (error) => toast.error(getProblemMessage(error, t) ?? t('onboardingPlan.nextStep.laterError')),
    });
  }

  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-lg border border-primary/30 bg-primary/5 p-4 text-left" data-testid="wizard-next-step">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{t('onboardingPlan.nextStep.kicker')}</p>
      <h3 id={titleId} className="mt-1 break-words text-base font-semibold">
        {t(pathStepTitleKey(suggested.code))}
      </h3>
      <p className="mt-1 break-words text-sm text-foreground/70">{t(nextStepWhyKey(suggested.code))}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button asChild className={TOUCH_TARGET}>
          <Link to={partPath(target)} data-testid="wizard-next-step-continue">
            {t('onboardingPlan.nextStep.continue')}
          </Link>
        </Button>
        <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={later} loading={defer.isPending} data-testid="wizard-next-step-later-button">
          {t('onboardingPlan.nextStep.later')}
        </Button>
      </div>
    </section>
  );
}
